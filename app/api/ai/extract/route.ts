import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { checkRateLimit, getClientIp } from '@/lib/rateLimiter';
import dns from 'node:dns';

// Ensure IPv4 first to prevent local and serverless IPv6 connection timeouts
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Edge runtime or unsupported environments ignore safely
}

export const maxDuration = 60;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/tiff',
]);

const invoiceBatchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    invoices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          vendorName: { type: Type.STRING, description: 'Official vendor / supplier / company / account name' },
          invoiceNumber: {
            type: Type.STRING,
            description:
              'For Invoices: Invoice #. For Challans: Delivery Challan #. For Credit Notes: Credit Note #. For Ledgers/Statements: The statement period or date range (e.g. "01-Apr-2023 to 31-Mar-2024" or "01/04/2024 - 31/03/2025" or "Apr 2024 - Mar 2025").',
          },
          date: { type: Type.STRING, description: 'Document issue date or Ledger ending date in YYYY-MM-DD' },
          documentType: {
            type: Type.STRING,
            enum: ['Invoice', 'Challan', 'Credit Note', 'Ledger'],
            description: 'Classify as Invoice, Challan, Credit Note, or Ledger (Account Statement)',
          },
          totalAmount: {
            type: Type.NUMBER,
            description: 'Total amount, net payable, credit amount, or closing balance for Ledger',
          },
          subtotal: { type: Type.NUMBER, description: 'Taxable subtotal or opening amount' },
          taxAmount: { type: Type.NUMBER, description: 'Total tax / GST amount' },
          taxId: { type: Type.STRING, description: 'GSTIN / Tax ID of vendor or account' },
          pageNumber: { type: Type.INTEGER, description: '1-based page number where document appears' },
          notes: { type: Type.STRING, description: 'Summary of items or ledger account description' },
        },
        required: ['vendorName', 'invoiceNumber', 'date', 'documentType', 'totalAmount'],
      },
    },
  },
  required: ['invoices'],
};

// Verified active models in order of instant latency, high quota availability, and accuracy
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

// Persistent client cache for HTTP keep-alive connection reuse across Vercel invocations
let cachedClient: GoogleGenAI | null = null;
let cachedApiKey = '';

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedClient;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalizes any date string (e.g. 14/08/2026, 14-Aug-2026, 27-3-26) to standard YYYY-MM-DD
 */
function normalizeDateString(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const trimmed = rawDate.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];

    if (year.length === 2) {
      year = `20${year}`;
    }

    if (day.length === 2 && year.length === 4) {
      if (parseInt(month, 10) > 12 && parseInt(day, 10) <= 12) {
        const tmp = day;
        day = month;
        month = tmp;
      }
      return `${year}-${month}-${day}`;
    } else if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }

  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting check (Pro-Tier: up to 500 requests per minute per IP to accommodate high-speed parallel batch uploads)
    const clientIp = getClientIp(req);
    const rateLimitResult = checkRateLimit(clientIp, 500, 60000);
    if (rateLimitResult.isLimited) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait before processing more documents.',
          isRateLimited: true,
          retryAfterMs: rateLimitResult.resetMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
          },
        }
      );
    }

class FileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileTooLargeError';
  }
}

    const contentType = req.headers.get('content-type') || '';

    interface DocumentInput {
      file?: File;
      url?: string;
      name: string;
      mimeType?: string;
    }

    const documentInputs: DocumentInput[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      if (body.documents && Array.isArray(body.documents)) {
        for (const doc of body.documents) {
          if (doc?.url) {
            documentInputs.push({
              url: doc.url,
              name: doc.name || 'document.pdf',
              mimeType: doc.mimeType,
            });
          }
        }
      } else if (body.fileUrl) {
        documentInputs.push({
          url: body.fileUrl,
          name: body.fileName || body.name || 'document.pdf',
          mimeType: body.fileType || body.mimeType,
        });
      }
    } else {
      const formData = await req.formData();
      const filesList = formData.getAll('files') as File[];
      const singleFile = formData.get('file') as File | null;
      const rawFileUrls = formData.get('fileUrls') as string | null;
      const rawFileUrl = formData.get('fileUrl') as string | null;
      const rawDocuments = formData.get('documents') as string | null;

      if (rawDocuments) {
        try {
          const parsedDocs = JSON.parse(rawDocuments);
          if (Array.isArray(parsedDocs)) {
            parsedDocs.forEach((d: any) => {
              if (d?.url) {
                documentInputs.push({
                  url: d.url,
                  name: d.name || 'document.pdf',
                  mimeType: d.mimeType,
                });
              }
            });
          }
        } catch {}
      }

      if (rawFileUrls) {
        try {
          const parsed = JSON.parse(rawFileUrls);
          if (Array.isArray(parsed)) {
            parsed.forEach((u: any) => {
              const url = typeof u === 'string' ? u : u?.url;
              const name = typeof u === 'object' && u?.name ? u.name : 'document.pdf';
              const mime = typeof u === 'object' && u?.mimeType ? u.mimeType : undefined;
              if (url) documentInputs.push({ url, name, mimeType: mime });
            });
          }
        } catch {}
      }

      if (rawFileUrl) {
        documentInputs.push({
          url: rawFileUrl,
          name: (formData.get('fileName') as string) || 'document.pdf',
          mimeType: (formData.get('fileType') as string) || undefined,
        });
      }

      const files: File[] = filesList.length > 0 ? filesList : (singleFile ? [singleFile] : []);
      files.forEach((f) => {
        documentInputs.push({
          file: f,
          name: f.name,
          mimeType: f.type,
        });
      });
    }

    if (documentInputs.length === 0) {
      return NextResponse.json({ success: false, error: 'No document file or storage URL was provided.' }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'GEMINI_API_KEY is not configured on the server. Please add your Gemini API key.',
        },
        { status: 500 }
      );
    }

    // Convert each file or storage URL to base64 buffer
    let fileBuffers: Array<{ docIndex: number; name: string; mimeType: string; base64Data: string }>;
    try {
      fileBuffers = await Promise.all(
        documentInputs.map(async (doc, idx) => {
          let buffer: Buffer;
          let mimeType = doc.mimeType || (doc.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

          if (doc.url) {
            const fetchRes = await fetch(doc.url);
            if (!fetchRes.ok) {
              throw new Error(`Failed to download document from storage (${fetchRes.status}: ${fetchRes.statusText})`);
            }
            const arrayBuffer = await fetchRes.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
            const headerMime = fetchRes.headers.get('content-type');
            if (headerMime && !doc.mimeType) {
              mimeType = headerMime.split(';')[0].trim();
            }
          } else if (doc.file) {
            const arrayBuffer = await doc.file.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          } else {
            throw new Error('Invalid document input: missing file or URL');
          }

          if (buffer.length > MAX_FILE_SIZE_BYTES) {
            throw new FileTooLargeError(
              `File "${doc.name}" (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds maximum limit of 25 MB.`
            );
          }

          const normalizedMime = mimeType.toLowerCase();
          if (!ALLOWED_MIME_TYPES.has(normalizedMime) && !normalizedMime.startsWith('image/')) {
            throw new Error(`Unsupported file format for "${doc.name}" (${mimeType}). Supported types: PDF, PNG, JPG, WEBP.`);
          }

          return {
            docIndex: idx + 1,
            name: doc.name,
            mimeType,
            base64Data: buffer.toString('base64'),
          };
        })
      );
    } catch (err: unknown) {
      if (err instanceof FileTooLargeError) {
        return NextResponse.json({ success: false, error: err.message }, { status: 413 });
      }
      const errMsg = (err as { message?: string })?.message || 'Error processing document buffer';
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    const isMultiDocBatch = fileBuffers.length > 1;

    const ai = getGeminiClient(apiKey);
    const startTime = Date.now();
    let lastError: Error | null = null;
    let rawParsedData: any = null;
    let usedModelName = '';

    // Multi-doc vs Single-doc schema
    const multiDocBatchSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        documents: {
          type: Type.ARRAY,
          description: 'Extracted results for each input document in corresponding order',
          items: {
            type: Type.OBJECT,
            properties: {
              docIndex: { type: Type.INTEGER, description: '1-based index corresponding to Document 1, Document 2, etc.' },
              invoices: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    vendorName: { type: Type.STRING, description: 'Official vendor / supplier / company / account name' },
                    invoiceNumber: {
                      type: Type.STRING,
                      description:
                        'For Invoices: Invoice #. For Challans: Delivery Challan #. For Credit Notes: Credit Note #. For Ledgers/Statements: The statement period or date range (e.g. "01-Apr-2023 to 31-Mar-2024" or "01/04/2024 - 31/03/2025" or "Apr 2024 - Mar 2025").',
                    },
                    date: { type: Type.STRING, description: 'Document issue date or Ledger ending date in YYYY-MM-DD' },
                    documentType: {
                      type: Type.STRING,
                      enum: ['Invoice', 'Challan', 'Credit Note', 'Ledger'],
                      description: 'Classify as Invoice, Challan, Credit Note, or Ledger (Account Statement)',
                    },
                    totalAmount: {
                      type: Type.NUMBER,
                      description: 'Total amount, net payable, credit amount, or closing balance for Ledger',
                    },
                    subtotal: { type: Type.NUMBER, description: 'Taxable subtotal or opening amount' },
                    taxAmount: { type: Type.NUMBER, description: 'Total tax / GST amount' },
                    taxId: { type: Type.STRING, description: 'GSTIN / Tax ID of vendor or account' },
                    pageNumber: { type: Type.INTEGER, description: '1-based page number where document appears' },
                    notes: { type: Type.STRING, description: 'Summary of items or ledger account description' },
                  },
                  required: ['vendorName', 'invoiceNumber', 'date', 'documentType', 'totalAmount'],
                },
              },
            },
            required: ['docIndex', 'invoices'],
          },
        },
      },
      required: ['documents'],
    };

    // System instruction
    // Highly-compressed system instruction: saves ~400 input tokens per call while maintaining precision
    const systemInstruction = `Expert OCR AI for invoices, delivery challans, credit notes, and ledgers.
Classify documentType as: "Invoice", "Challan", "Credit Note", or "Ledger".
Extract:
- vendorName: Official company / party name.
- invoiceNumber: Bill #, Challan #, CN #, or for Ledger the date range (e.g. "01-Apr-2023 to 31-Mar-2024").
- date: YYYY-MM-DD.
- totalAmount: Grand Total or Ledger net closing balance.
- subtotal: Taxable value if present.
- taxAmount: Total GST/tax if present.
- taxId: GSTIN/PAN if present.
- notes: Short item summary.`;

    // Construct prompt parts
    const contentParts: any[] = [];
    if (isMultiDocBatch) {
      contentParts.push({
        text: `Extract all records from Document 1 to Document ${fileBuffers.length} into the "documents" array with matching docIndex.`,
      });
      fileBuffers.forEach((fb) => {
        contentParts.push({ text: `--- BEGIN DOCUMENT ${fb.docIndex} ---` });
        contentParts.push({
          inlineData: {
            data: fb.base64Data,
            mimeType: fb.mimeType,
          },
        });
      });
    } else {
      contentParts.push({
        inlineData: {
          data: fileBuffers[0].base64Data,
          mimeType: fileBuffers[0].mimeType,
        },
      });
      contentParts.push({
        text: 'Extract all distinct invoices, challans, or ledgers into the "invoices" array.',
      });
    }

    // Try candidate models in order with generous timeout & token budget
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const timeoutMs = isMultiDocBatch ? 35000 : 25000;
        let timeoutHandle: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Model ${modelName} timed out after ${timeoutMs / 1000}s`)), timeoutMs);
        });

        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: contentParts }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: isMultiDocBatch ? multiDocBatchSchema : invoiceBatchSchema,
            temperature: 0.0,
            maxOutputTokens: isMultiDocBatch ? 8192 : 4096,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (timeoutHandle) clearTimeout(timeoutHandle);

        const responseText = response.text?.trim() || '{}';
        let parsed: any;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          const rawCandidate = (match ? match[1] : responseText).trim();
          try {
            parsed = JSON.parse(rawCandidate);
          } catch {
            // Self-repair truncated JSON (in case model stops before closing braces)
            try {
              let cleaned = rawCandidate
                .replace(/,\s*$/, '')
                .replace(/"[^"]*$/, '')
                .replace(/:\s*$/, ': null')
                .replace(/,\s*$/, '');
              const openBraces = (cleaned.match(/\{/g) || []).length;
              const closeBraces = (cleaned.match(/\}/g) || []).length;
              const openBrackets = (cleaned.match(/\[/g) || []).length;
              const closeBrackets = (cleaned.match(/\]/g) || []).length;
              for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += ']';
              for (let i = 0; i < openBraces - closeBraces; i++) cleaned += '}';
              parsed = JSON.parse(cleaned);
            } catch {
              throw new Error(`AI returned invalid JSON: ${responseText.slice(0, 100)}`);
            }
          }
        }

        if (isMultiDocBatch) {
          if (parsed.documents && Array.isArray(parsed.documents)) {
            rawParsedData = parsed;
            usedModelName = modelName;
            break;
          }
        } else {
          if (parsed.invoices && Array.isArray(parsed.invoices) && parsed.invoices.length > 0) {
            rawParsedData = parsed;
            usedModelName = modelName;
            break;
          } else if (parsed.vendorName || parsed.invoiceNumber || parsed.totalAmount !== undefined) {
            rawParsedData = { invoices: [parsed] };
            usedModelName = modelName;
            break;
          }
        }
      } catch (err: unknown) {
        lastError = err as Error;
        const errMsg = (err as { message?: string })?.message || String(err);
        const isRateLimit = /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(errMsg);
        console.warn(`[Gemini API] Failover from ${modelName} (${isRateLimit ? '429 Rate Limit' : 'Error'}):`, errMsg);
        if (isRateLimit) {
          await sleep(1500);
        }
      }
    }

    if (!rawParsedData) {
      console.error('All Gemini model candidates failed. Last error:', lastError);
      const errMsg = lastError?.message || '';
      const isRateLimited = /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(errMsg);

      const userFacingError = isRateLimited
        ? 'Gemini API quota or rate limit reached (429). Please wait a few seconds and retry.'
        : lastError?.message || 'AI document processing failed to extract records from this file.';

      return NextResponse.json(
        {
          success: false,
          error: userFacingError,
          isRateLimited,
        },
        { status: isRateLimited ? 429 : 500 }
      );
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Gemini API] Batch (${fileBuffers.length} doc) completed via ${usedModelName} in ${durationMs}ms`);

    const normalizeInvoiceItem = (inv: Record<string, unknown>, idx: number) => {
      const rawDate = (inv.date as string) || '';
      const normalizedDate = normalizeDateString(rawDate);
      const rawAmount = typeof inv.totalAmount === 'number' ? inv.totalAmount : parseFloat(String(inv.totalAmount || 0)) || 0;

      let docType: 'Invoice' | 'Challan' | 'Credit Note' | 'Ledger' = 'Invoice';
      const rawType = String(inv.documentType || '').trim();
      if (rawType === 'Credit Note' || /credit|cn|cr\s*note/i.test(rawType)) {
        docType = 'Credit Note';
      } else if (rawType === 'Ledger' || /ledger|statement|account|soa/i.test(rawType)) {
        docType = 'Ledger';
      } else if (rawType === 'Challan' || /challan|delivery|dc|dispatch/i.test(rawType)) {
        docType = 'Challan';
      }

      let invNumber = (inv.invoiceNumber as string) || '';
      if (!invNumber) {
        if (docType === 'Ledger') {
          invNumber = `01-Apr-${new Date().getFullYear() - 1} to 31-Mar-${new Date().getFullYear()}`;
        } else if (docType === 'Credit Note') {
          invNumber = `CN-${Date.now().toString().slice(-4)}-${idx + 1}`;
        } else if (docType === 'Challan') {
          invNumber = `DC-${Date.now().toString().slice(-4)}-${idx + 1}`;
        } else {
          invNumber = `INV-${Date.now().toString().slice(-4)}-${idx + 1}`;
        }
      }

      return {
        id: `extracted-${idx + 1}-${Date.now()}`,
        vendorName: (inv.vendorName as string) || 'UNKNOWN VENDOR',
        invoiceNumber: invNumber,
        date: normalizedDate,
        documentType: docType,
        totalAmount: rawAmount,
        subtotal: (inv.subtotal as number) || rawAmount,
        taxAmount: (inv.taxAmount as number) || 0,
        taxId: (inv.taxId as string) || undefined,
        pageNumber: (inv.pageNumber as number) || idx + 1,
        notes: (inv.notes as string) || undefined,
        confidenceScore: 0.98,
      };
    };

    if (isMultiDocBatch) {
      const docsArray = (rawParsedData.documents as Array<{ docIndex: number; invoices: Array<Record<string, unknown>> }>) || [];
      const docResults = fileBuffers.map((fb, idx) => {
        const docIdx = idx + 1;
        const matched = docsArray.find((d) => d.docIndex === docIdx);
        const invList = matched?.invoices && Array.isArray(matched.invoices) ? matched.invoices : [];
        const normalized = invList.map((inv, i) => normalizeInvoiceItem(inv, i));
        return {
          docIndex: docIdx,
          fileName: fb.name,
          invoices: normalized,
        };
      });

      return NextResponse.json({
        success: true,
        source: usedModelName,
        durationMs,
        isMultiDoc: true,
        documents: docResults,
      });
    }

    const rawInvoices = (rawParsedData.invoices as Array<Record<string, unknown>>) || [];
    const normalizedInvoices = rawInvoices.map((inv, idx) => normalizeInvoiceItem(inv, idx));

    const primaryInvoice = normalizedInvoices[0] || {};
    console.log(`[Gemini API] Single doc extraction completed via ${usedModelName} in ${durationMs}ms`);

    const result = {
      invoices: normalizedInvoices,
      count: normalizedInvoices.length,
      // Backward compatibility fields
      vendorName: primaryInvoice.vendorName,
      invoiceNumber: primaryInvoice.invoiceNumber,
      date: primaryInvoice.date,
      documentType: primaryInvoice.documentType,
      totalAmount: primaryInvoice.totalAmount,
      confidenceScore: 0.98,
      source: usedModelName,
      durationMs,
    };

    return NextResponse.json({
      success: true,
      source: usedModelName,
      durationMs,
      data: result,
    });
  } catch (error: unknown) {
    console.error('AI Extraction Unhandled Error:', error);
    const err = error as { message?: string };
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'AI document processing failed',
      },
      { status: 500 }
    );
  }
}
