import JSZip from 'jszip';
import { DocumentRecord, SiteRecord } from './types';
import { formatDate } from './utils';

/**
 * Escapes a field for CSV export
 */
function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Converts a base64 Data URL to Uint8Array for JSZip
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index === -1) {
    const encoder = new TextEncoder();
    return encoder.encode(dataUrl);
  }
  const base64 = dataUrl.substring(base64Index + 8);
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface ExportProgressCallback {
  (current: number, total: number, message: string): void;
}

/**
 * Exports selected documents with a CSV metadata sheet and downloaded binary files into a ZIP
 */
export async function exportDocumentsToZip(
  documents: DocumentRecord[],
  siteMap: Map<string, SiteRecord>,
  onProgress?: ExportProgressCallback
): Promise<void> {
  if (documents.length === 0) return;

  const zip = new JSZip();
  const total = documents.length;

  onProgress?.(0, total, 'Preparing metadata spreadsheet...');

  // 1. Generate CSV Metadata Content (with UTF-8 BOM)
  const headers = [
    'Document ID',
    'Invoice / Reference #',
    'Vendor / Supplier',
    'Site Code',
    'Site Name',
    'Site Location',
    'Document Type',
    'Amount (INR)',
    'Issue Date',
    'Status',
    'Uploaded By',
    'Created At',
    'Verified By',
    'Verified At',
    'File Name',
    'File Storage Path',
    'File Public URL',
  ];

  const rows = documents.map((doc) => {
    const site = siteMap.get(doc.siteId);
    return [
      escapeCsv(doc.id),
      escapeCsv(doc.invoiceNumber),
      escapeCsv(doc.vendorName),
      escapeCsv(site?.code || 'N/A'),
      escapeCsv(site?.name || 'Unassigned'),
      escapeCsv(site?.location || 'N/A'),
      escapeCsv(doc.type),
      doc.amount,
      escapeCsv(doc.date),
      escapeCsv(doc.status),
      escapeCsv(doc.uploadedBy),
      escapeCsv(doc.createdAt ? formatDate(doc.createdAt) : ''),
      escapeCsv(doc.verifiedBy || ''),
      escapeCsv(doc.verifiedAt ? formatDate(doc.verifiedAt) : ''),
      escapeCsv(doc.fileName || ''),
      escapeCsv(doc.filePath || ''),
      escapeCsv(doc.fileUrl || ''),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  zip.file('document_metadata.csv', csvContent);

  // 2. Add files folder inside ZIP
  const filesFolder = zip.folder('files') || zip;
  const usedFileNames = new Set<string>();

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const itemNum = i + 1;
    onProgress?.(itemNum, total, `Packaging file ${itemNum} of ${total}: ${doc.invoiceNumber}...`);

    // Determine clean file name to avoid collisions
    const safeInvoice = (doc.invoiceNumber || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeVendor = (doc.vendorName || 'vendor').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
    const originalExt = doc.fileName ? doc.fileName.substring(doc.fileName.lastIndexOf('.')) : '.pdf';
    
    let targetFileName = `${safeInvoice}_${safeVendor}${originalExt}`;
    if (usedFileNames.has(targetFileName)) {
      targetFileName = `${safeInvoice}_${safeVendor}_${doc.id.substring(0, 5)}${originalExt}`;
    }
    usedFileNames.add(targetFileName);

    try {
      if (doc.fileUrl) {
        // Fetch from Supabase Storage public URL
        const res = await fetch(doc.fileUrl);
        if (res.ok) {
          const blob = await res.blob();
          filesFolder.file(targetFileName, blob);
        } else if (doc.fileData) {
          // Fallback to local base64 stream
          const bytes = dataUrlToUint8Array(doc.fileData);
          filesFolder.file(targetFileName, bytes);
        } else {
          filesFolder.file(
            `${targetFileName}.txt`,
            `Metadata record for ${doc.invoiceNumber}.\nDirect URL: ${doc.fileUrl}`
          );
        }
      } else if (doc.fileData) {
        // Base64 data url
        const bytes = dataUrlToUint8Array(doc.fileData);
        filesFolder.file(targetFileName, bytes);
      } else {
        // Text descriptor if no file attached
        filesFolder.file(
          `${targetFileName}.txt`,
          `Document: ${doc.invoiceNumber}\nVendor: ${doc.vendorName}\nAmount: INR ${doc.amount}\nSite: ${siteMap.get(doc.siteId)?.name || 'N/A'}\nDate: ${doc.date}`
        );
      }
    } catch {
      // In case of network / CORS error fallback to descriptor with URL
      filesFolder.file(
        `${targetFileName}_link.txt`,
        `Document: ${doc.invoiceNumber}\nVendor: ${doc.vendorName}\nFile URL: ${doc.fileUrl || 'Local'}`
      );
    }
  }

  onProgress?.(total, total, 'Compressing ZIP package...');

  // 3. Generate ZIP blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // 4. Trigger download
  const dateStamp = new Date().toISOString().split('T')[0];
  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `SiteDocs_Export_${dateStamp}_${documents.length}_items.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
