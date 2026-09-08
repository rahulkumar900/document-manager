export type Role = 'Admin' | 'Site Accountant' | 'Checker';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedSiteId: string;
  createdAt: string;
  passwordHash?: string;
}

export interface SiteRecord {
  id: string;
  name: string;
  code: string;
  location: string;
  createdAt: string;
}

export type DocumentType = 'Invoice' | 'Challan' | 'Credit Note' | 'Ledger';
export type DocumentStatus = 'uploaded' | 'verified';

export interface DocumentRecord {
  id: string;
  siteId: string;
  vendorName: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  type: DocumentType;
  status: DocumentStatus;
  uploadedBy: string;
  createdAt: string;
  fileName?: string;
  fileData?: string; // Base64 data URL for instant local fallback
  fileUrl?: string; // Supabase Storage public URL
  filePath?: string; // Supabase Storage bucket path
  fileType?: string; // MIME type e.g. application/pdf, image/png
  fileSize?: number; // Size in bytes
  verifiedBy?: string;
  verifiedAt?: string;
}

export type ViewMode = 'auth' | 'dashboard' | 'documents' | 'upload' | 'preview';
export type DisplayLayout = 'grid' | 'list';

export type FilterKey =
  | 'type'
  | 'status'
  | 'siteId'
  | 'vendorName'
  | 'invoiceNumber'
  | 'amount'
  | 'date'
  | 'uploadedBy';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'is_one_of'
  | 'greater_than'
  | 'less_than'
  | 'between';

export interface FilterRule {
  id: string;
  key: FilterKey;
  operator: FilterOperator;
  value: any;
}
