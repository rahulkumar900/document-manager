import { DocumentRecord, FilterRule, FilterKey, FilterOperator, SiteRecord } from './types';
import { formatCurrency, formatDate, generateUUID } from './utils';

export const FILTER_KEY_OPTIONS: { key: FilterKey; label: string; group: 'Category' | 'Details' | 'Financial' }[] = [
  { key: 'type', label: 'Document Type', group: 'Category' },
  { key: 'status', label: 'Verification Status', group: 'Category' },
  { key: 'siteId', label: 'Construction Site', group: 'Category' },
  { key: 'vendorName', label: 'Vendor / Supplier Name', group: 'Details' },
  { key: 'invoiceNumber', label: 'Invoice / Ref / Period #', group: 'Details' },
  { key: 'uploadedBy', label: 'Uploaded By', group: 'Details' },
  { key: 'amount', label: 'Total Amount (₹)', group: 'Financial' },
  { key: 'date', label: 'Invoice / Document Date', group: 'Financial' },
  { key: 'createdAt', label: 'Uploaded Date', group: 'Financial' },
];

export const OPERATOR_OPTIONS: Record<FilterKey, { operator: FilterOperator; label: string }[]> = {
  type: [
    { operator: 'equals', label: 'is (=)' },
    { operator: 'not_equals', label: 'is not (≠)' },
    { operator: 'is_one_of', label: 'is one of' },
  ],
  status: [
    { operator: 'equals', label: 'is (=)' },
    { operator: 'not_equals', label: 'is not (≠)' },
  ],
  siteId: [
    { operator: 'equals', label: 'is (=)' },
    { operator: 'not_equals', label: 'is not (≠)' },
    { operator: 'is_one_of', label: 'is one of' },
  ],
  vendorName: [
    { operator: 'contains', label: 'contains' },
    { operator: 'equals', label: 'equals (=)' },
    { operator: 'starts_with', label: 'starts with' },
    { operator: 'not_equals', label: 'does not equal (≠)' },
  ],
  invoiceNumber: [
    { operator: 'contains', label: 'contains' },
    { operator: 'equals', label: 'equals (=)' },
    { operator: 'starts_with', label: 'starts with' },
    { operator: 'not_equals', label: 'does not equal (≠)' },
  ],
  uploadedBy: [
    { operator: 'contains', label: 'contains' },
    { operator: 'equals', label: 'equals (=)' },
    { operator: 'starts_with', label: 'starts with' },
    { operator: 'not_equals', label: 'does not equal (≠)' },
  ],
  amount: [
    { operator: 'greater_than', label: 'greater than or equal to (>=)' },
    { operator: 'less_than', label: 'less than or equal to (<=)' },
    { operator: 'between', label: 'is between range' },
    { operator: 'equals', label: 'exactly equals (=)' },
  ],
  date: [
    { operator: 'equals', label: 'exact date (=)' },
    { operator: 'between', label: 'is between range' },
    { operator: 'greater_than', label: 'on or after (>=)' },
    { operator: 'less_than', label: 'on or before (<=)' },
  ],
  createdAt: [
    { operator: 'equals', label: 'exact date (=)' },
    { operator: 'between', label: 'is between range' },
    { operator: 'greater_than', label: 'on or after (>=)' },
    { operator: 'less_than', label: 'on or before (<=)' },
  ],
};

export const createDefaultFilterRule = (
  key: FilterKey = 'type',
  operator?: FilterOperator
): FilterRule => {
  const id = generateUUID();
  const defaultOp = operator || OPERATOR_OPTIONS[key][0].operator;

  switch (key) {
    case 'type':
      return {
        id,
        key,
        operator: defaultOp,
        value: defaultOp === 'is_one_of' ? ['Invoice'] : 'Invoice',
      };
    case 'status':
      return { id, key, operator: defaultOp, value: 'uploaded' };
    case 'siteId':
      return {
        id,
        key,
        operator: defaultOp,
        value: defaultOp === 'is_one_of' ? [] : '',
      };
    case 'vendorName':
    case 'invoiceNumber':
    case 'uploadedBy':
      return { id, key, operator: defaultOp, value: '' };
    case 'amount':
      return {
        id,
        key,
        operator: defaultOp,
        value: defaultOp === 'between' ? { min: '', max: '' } : '',
      };
    case 'date':
    case 'createdAt':
      return {
        id,
        key,
        operator: defaultOp,
        value: defaultOp === 'between' ? { from: '', to: '' } : '',
      };
    default:
      return { id, key, operator: defaultOp, value: '' };
  }
};

/**
 * Checks if a single document matches a single filter rule
 */
export function matchDocumentRule(doc: DocumentRecord, rule: FilterRule): boolean {
  const { key, operator, value } = rule;

  if (value === undefined || value === null || value === '') {
    return true; // Skip blank / incomplete rule
  }

  if (Array.isArray(value) && value.length === 0) {
    return true;
  }

  if (operator === 'between' && typeof value === 'object') {
    if (key === 'amount') {
      const minEmpty = value.min === undefined || value.min === '';
      const maxEmpty = value.max === undefined || value.max === '';
      if (minEmpty && maxEmpty) return true;
    } else if (key === 'date' || key === 'createdAt') {
      if (!value.from && !value.to) return true;
    }
  }

  switch (key) {
    case 'type': {
      if (operator === 'is_one_of') {
        const list = Array.isArray(value) ? value : [value];
        if (list.length === 0) return true;
        return list.includes(doc.type);
      }
      if (operator === 'equals') return doc.type === value;
      if (operator === 'not_equals') return doc.type !== value;
      return true;
    }

    case 'status': {
      if (operator === 'equals') return doc.status === value;
      if (operator === 'not_equals') return doc.status !== value;
      return true;
    }

    case 'siteId': {
      if (operator === 'is_one_of') {
        const list = Array.isArray(value) ? value : [value];
        if (list.length === 0) return true;
        return list.includes(doc.siteId);
      }
      if (operator === 'equals') return doc.siteId === value;
      if (operator === 'not_equals') return doc.siteId !== value;
      return true;
    }

    case 'vendorName': {
      const target = (doc.vendorName || '').toLowerCase();
      const val = String(value || '').toLowerCase().trim();
      if (!val) return true;
      if (operator === 'contains') return target.includes(val);
      if (operator === 'equals') return target === val;
      if (operator === 'not_equals') return target !== val;
      if (operator === 'starts_with') return target.startsWith(val);
      return true;
    }

    case 'invoiceNumber': {
      const target = (doc.invoiceNumber || '').toLowerCase();
      const val = String(value || '').toLowerCase().trim();
      if (!val) return true;
      if (operator === 'contains') return target.includes(val);
      if (operator === 'equals') return target === val;
      if (operator === 'not_equals') return target !== val;
      if (operator === 'starts_with') return target.startsWith(val);
      return true;
    }

    case 'uploadedBy': {
      const target = (doc.uploadedBy || '').toLowerCase();
      const val = String(value || '').toLowerCase().trim();
      if (!val) return true;
      if (operator === 'contains') return target.includes(val);
      if (operator === 'equals') return target === val;
      if (operator === 'not_equals') return target !== val;
      if (operator === 'starts_with') return target.startsWith(val);
      return true;
    }

    case 'amount': {
      const amount = Number(doc.amount) || 0;
      if (operator === 'between') {
        const min = typeof value === 'object' && value?.min !== '' ? parseFloat(value.min) : -Infinity;
        const max = typeof value === 'object' && value?.max !== '' ? parseFloat(value.max) : Infinity;
        if (isNaN(min) && isNaN(max)) return true;
        return amount >= (isNaN(min) ? -Infinity : min) && amount <= (isNaN(max) ? Infinity : max);
      }
      const numVal = parseFloat(String(value));
      if (isNaN(numVal)) return true;
      if (operator === 'greater_than') return amount >= numVal;
      if (operator === 'less_than') return amount <= numVal;
      if (operator === 'equals') return Math.abs(amount - numVal) < 0.01;
      return true;
    }

    case 'date': {
      const docDate = doc.date;
      if (!docDate) return true;
      if (operator === 'between') {
        const from = typeof value === 'object' ? value?.from : '';
        const to = typeof value === 'object' ? value?.to : '';
        if (!from && !to) return true;
        if (from && docDate < from) return false;
        if (to && docDate > to) return false;
        return true;
      }
      const targetDate = String(value || '').trim();
      if (!targetDate) return true;
      if (operator === 'greater_than') return docDate >= targetDate;
      if (operator === 'less_than') return docDate <= targetDate;
      if (operator === 'equals') return docDate === targetDate;
      return true;
    }

    case 'createdAt': {
      const docUploadDate = doc.createdAt ? doc.createdAt.substring(0, 10) : '';
      if (!docUploadDate) return true;
      if (operator === 'between') {
        const from = typeof value === 'object' ? value?.from : '';
        const to = typeof value === 'object' ? value?.to : '';
        if (!from && !to) return true;
        if (from && docUploadDate < from) return false;
        if (to && docUploadDate > to) return false;
        return true;
      }
      const targetDate = String(value || '').trim();
      if (!targetDate) return true;
      if (operator === 'greater_than') return docUploadDate >= targetDate;
      if (operator === 'less_than') return docUploadDate <= targetDate;
      if (operator === 'equals') return docUploadDate === targetDate;
      return true;
    }

    default:
      return true;
  }
}

/**
 * Evaluates all documents against a set of rules (AND conjunction)
 */
export function applyFilterRules(documents: DocumentRecord[], rules: FilterRule[]): DocumentRecord[] {
  if (rules.length === 0) return documents;
  return documents.filter((doc) => rules.every((rule) => matchDocumentRule(doc, rule)));
}

/**
 * Returns user-friendly summary string for badge chips
 */
export function formatRuleLabel(rule: FilterRule, siteMap: Map<string, SiteRecord>): string {
  const { key, operator, value } = rule;

  switch (key) {
    case 'type': {
      const items = Array.isArray(value) ? value : [value];
      if (operator === 'is_one_of') return `Type: ${items.join(', ') || 'Any'}`;
      if (operator === 'not_equals') return `Type ≠ ${value}`;
      return `Type = ${value}`;
    }
    case 'status':
      return `Status: ${value === 'verified' ? 'Verified' : 'Pending'}`;
    case 'siteId': {
      const siteIds = Array.isArray(value) ? value : [value];
      const names = siteIds.map((id) => siteMap.get(id)?.code || siteMap.get(id)?.name || 'Site').join(', ');
      return `Site: ${names || 'Selected'}`;
    }
    case 'vendorName': {
      const opLabel = operator === 'contains' ? 'contains' : operator === 'starts_with' ? 'starts with' : operator === 'not_equals' ? '≠' : '=';
      return `Vendor ${opLabel} "${value}"`;
    }
    case 'invoiceNumber': {
      const opLabel = operator === 'contains' ? 'contains' : operator === 'starts_with' ? 'starts with' : operator === 'not_equals' ? '≠' : '=';
      return `Ref/Invoice # ${opLabel} "${value}"`;
    }
    case 'uploadedBy': {
      const opLabel = operator === 'contains' ? 'contains' : operator === 'starts_with' ? 'starts with' : operator === 'not_equals' ? '≠' : '=';
      return `Uploaded by ${opLabel} "${value}"`;
    }
    case 'amount': {
      if (operator === 'between') {
        const min = value?.min ? formatCurrency(parseFloat(value.min)) : '₹0';
        const max = value?.max ? formatCurrency(parseFloat(value.max)) : 'Any';
        return `Amount: ${min} - ${max}`;
      }
      const num = formatCurrency(parseFloat(value) || 0);
      if (operator === 'greater_than') return `Amount ≥ ${num}`;
      if (operator === 'less_than') return `Amount ≤ ${num}`;
      return `Amount = ${num}`;
    }
    case 'date': {
      if (operator === 'between') {
        const from = value?.from ? formatDate(value.from) : 'Start';
        const to = value?.to ? formatDate(value.to) : 'End';
        return `Date: ${from} → ${to}`;
      }
      const d = formatDate(value);
      if (operator === 'greater_than') return `Date ≥ ${d}`;
      if (operator === 'less_than') return `Date ≤ ${d}`;
      return `Date = ${d}`;
    }
    case 'createdAt': {
      if (operator === 'between') {
        const from = value?.from ? formatDate(value.from) : 'Start';
        const to = value?.to ? formatDate(value.to) : 'End';
        return `Uploaded: ${from} → ${to}`;
      }
      const d = formatDate(value);
      if (operator === 'greater_than') return `Uploaded ≥ ${d}`;
      if (operator === 'less_than') return `Uploaded ≤ ${d}`;
      return `Uploaded = ${d}`;
    }
    default:
      return `${key} ${operator} ${JSON.stringify(value)}`;
  }
}
