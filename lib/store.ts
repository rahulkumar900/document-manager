import { supabase } from './supabaseClient';
import {
  UserAccount,
  SiteRecord,
  DocumentRecord,
  Role,
  DocumentType,
  DocumentStatus,
} from './types';
import { generateUUID, findDatabaseDuplicate } from './utils';

export * from './types';
export { supabase };

const STORAGE_KEY_USERS = 'sitedocs_users_v2';
const STORAGE_KEY_SITES = 'sitedocs_sites_v2';
const STORAGE_KEY_DOCS = 'sitedocs_documents_v2';
const STORAGE_KEY_SESSION = 'sitedocs_session_v2';

export const getStoredUsers = (): UserAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveUsers = (users: UserAccount[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
};

export const getStoredSites = (): SiteRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SITES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveSites = (sites: SiteRecord[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SITES, JSON.stringify(sites));
};

export const getStoredDocuments = (): DocumentRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOCS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveDocuments = (docs: DocumentRecord[]) => {
  if (typeof window === 'undefined') return;
  try {
    // Strip heavy base64 fileData strings so localStorage quota (~5MB) is never exceeded.
    // Full files are hosted on Supabase Storage via fileUrl.
    const lightweightDocs = docs.map((d) => {
      if (d.fileData && d.fileData.length > 5000) {
        const { fileData, ...rest } = d;
        return rest;
      }
      return d;
    });
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(lightweightDocs));
  } catch (err) {
    console.warn('localStorage quota exceeded for documents cache, pruning non-essential fields:', err);
    try {
      // Fallback: prune fileData completely
      const stripped = docs.map(({ fileData, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(stripped));
    } catch {
      // If even metadata exceeds storage, ignore to prevent crashing the UI
    }
  }
};

export const getStoredSession = (): UserAccount | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveSession = (user: UserAccount | null) => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }
};

/**
 * Fetches user profile record from Supabase 'profiles' table
 */
export const fetchUserProfile = async (userId: string, emailFallback?: string): Promise<UserAccount | null> => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as Role,
        assignedSiteId: data.assigned_site_id || 'all',
        createdAt: data.created_at,
      };
    }
  } catch (err) {
    console.warn('Error fetching user profile:', err);
  }
  return null;
};

/**
 * Authenticates user using Supabase Auth signInWithPassword and syncs profile
 */
export const signInWithSupabase = async (
  email: string,
  password: string
): Promise<{ user: UserAccount | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'Authentication failed. Please verify your credentials.' };
    }

    // Load matching profile from 'profiles' table
    let profile = await fetchUserProfile(data.user.id, data.user.email);

    // If profile record does not exist yet in table, auto-provision it from auth metadata
    if (!profile) {
      const fallbackName =
        data.user.user_metadata?.name ||
        data.user.user_metadata?.full_name ||
        data.user.email?.split('@')[0] ||
        'User';
      const fallbackRole = (data.user.user_metadata?.role as Role) || 'Site Accountant';

      const newProfile: UserAccount = {
        id: data.user.id,
        name: fallbackName,
        email: data.user.email || email,
        role: fallbackRole,
        assignedSiteId: 'all',
        createdAt: new Date().toISOString(),
      };

      await saveUserToSupabase(newProfile);
      profile = newProfile;
    }

    saveSession(profile);
    return { user: profile, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
    return { user: null, error: msg };
  }
};

/**
 * Registers new user using Supabase Auth signUp and auto-provisions profile
 */
export const signUpWithSupabase = async (
  email: string,
  password: string,
  name: string,
  role: Role,
  assignedSiteId: string = 'all'
): Promise<{ user: UserAccount | null; requiresEmailConfirmation: boolean; error: string | null }> => {
  try {
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    const cleanSiteId = assignedSiteId && assignedSiteId !== 'all' ? ensureUUID(assignedSiteId) : 'all';

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password.trim(),
      options: {
        data: {
          name: cleanName,
          role: role,
          assigned_site_id: cleanSiteId === 'all' ? null : cleanSiteId,
        },
      },
    });

    if (error) {
      return { user: null, requiresEmailConfirmation: false, error: error.message };
    }

    if (!data.user) {
      return { user: null, requiresEmailConfirmation: false, error: 'Failed to create user account.' };
    }

    const newUserProfile: UserAccount = {
      id: data.user.id,
      name: cleanName,
      email: cleanEmail,
      role: role,
      assignedSiteId: cleanSiteId,
      createdAt: new Date().toISOString(),
    };

    // Upsert profile into public.profiles
    await saveUserToSupabase(newUserProfile);

    if (data.session) {
      saveSession(newUserProfile);
      return { user: newUserProfile, requiresEmailConfirmation: false, error: null };
    } else {
      return { user: newUserProfile, requiresEmailConfirmation: true, error: null };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'An unexpected error occurred during registration.';
    return { user: null, requiresEmailConfirmation: false, error: msg };
  }
};

/**
 * Admin API: Provisions a new user in Supabase Auth & public.profiles
 * without disrupting or switching the active admin session.
 */
export const adminCreateUser = async (
  email: string,
  password: string,
  name: string,
  role: Role,
  assignedSiteId: string = 'all'
): Promise<{ user: UserAccount | null; error: string | null }> => {
  try {
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name,
        role,
        assignedSiteId,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { user: null, error: data.error || 'Failed to create user.' };
    }

    return { user: data.user, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error creating user.';
    return { user: null, error: msg };
  }
};

/**
 * Signs out active session from Supabase Auth
 */
export const signOutWithSupabase = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Supabase sign out note:', err);
  } finally {
    saveSession(null);
  }
};

/**
 * Initializes active auth session directly from Supabase
 */
export const initializeAuthSession = async (): Promise<UserAccount | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) {
      return getStoredSession();
    }

    const profile = await fetchUserProfile(session.user.id, session.user.email);
    if (profile) {
      saveSession(profile);
      return profile;
    }

    const fallbackProfile: UserAccount = {
      id: session.user.id,
      name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
      email: session.user.email || '',
      role: (session.user.user_metadata?.role as Role) || 'Site Accountant',
      assignedSiteId: 'all',
      createdAt: new Date().toISOString(),
    };
    await saveUserToSupabase(fallbackProfile);
    saveSession(fallbackProfile);
    return fallbackProfile;
  } catch {
    return getStoredSession();
  }
};

/**
 * Validates or converts an ID to standard UUID format
 */
export const ensureUUID = (id: string): string => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  if (isUuid) return id;
  return generateUUID();
};

/**
 * Synchronizes Construction Sites from Supabase 'sites' table
 */
export const syncSitesWithSupabase = async (): Promise<SiteRecord[]> => {
  try {
    const { data, error } = await supabase.from('sites').select('*').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      const mapped: SiteRecord[] = data.map((d: { id: string; name: string; code: string; location: string; created_at: string }) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        location: d.location,
        createdAt: d.created_at,
      }));
      saveSites(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('Supabase sites sync note:', err);
  }
  return getStoredSites();
};

/**
 * Synchronizes Documents from Supabase 'documents' table
 */
export const syncDocumentsWithSupabase = async (): Promise<DocumentRecord[]> => {
  try {
    const existingDocs = getStoredDocuments();
    const existingMap = new Map(existingDocs.map((d) => [d.id, d]));

    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      const mapped: DocumentRecord[] = data.map((d: {
        id: string;
        site_id: string;
        vendor_name: string;
        invoice_number: string;
        date: string;
        amount: number;
        type: DocumentType;
        status: DocumentStatus;
        uploaded_by: string;
        created_at: string;
        file_name?: string;
        file_url?: string;
        file_path?: string;
        verified_by?: string;
        verified_at?: string;
      }) => {
        const localDoc = existingMap.get(d.id);
        const resolvedFileUrl = d.file_url || localDoc?.fileUrl;

        return {
          id: d.id,
          siteId: d.site_id,
          vendorName: d.vendor_name,
          invoiceNumber: d.invoice_number,
          date: d.date,
          amount: Number(d.amount),
          type: d.type,
          status: d.status,
          uploadedBy: d.uploaded_by,
          createdAt: d.created_at,
          fileName: d.file_name || localDoc?.fileName,
          fileData: localDoc?.fileData,
          fileUrl: resolvedFileUrl,
          filePath: d.file_path || localDoc?.filePath,
          fileType: localDoc?.fileType,
          fileSize: localDoc?.fileSize,
          verifiedBy: d.verified_by,
          verifiedAt: d.verified_at,
        };
      });
      saveDocuments(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('Supabase documents sync note:', err);
  }
  return getStoredDocuments();
};

/**
 * Synchronizes User Accounts from Supabase 'profiles' table
 */
export const syncUsersWithSupabase = async (): Promise<UserAccount[]> => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      const mapped: UserAccount[] = data.map((d: {
        id: string;
        name: string;
        email: string;
        role: Role;
        assigned_site_id?: string;
        created_at: string;
      }) => ({
        id: d.id,
        name: d.name,
        email: d.email,
        role: d.role,
        assignedSiteId: d.assigned_site_id || 'all',
        createdAt: d.created_at,
      }));

      saveUsers(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('Supabase profiles sync note:', err);
  }
  return getStoredUsers();
};

/**
 * Persists a site into Supabase 'sites' table using valid UUID
 */
export const saveSiteToSupabase = async (site: SiteRecord): Promise<boolean> => {
  try {
    const validId = ensureUUID(site.id);
    const { error } = await supabase.from('sites').upsert({
      id: validId,
      name: site.name,
      code: site.code,
      location: site.location,
    });

    if (error) {
      console.warn('Supabase site insert note:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase site insert exception:', err);
    return false;
  }
};

/**
 * Persists a user profile into Supabase 'profiles' table
 */
export const saveUserToSupabase = async (user: UserAccount): Promise<boolean> => {
  try {
    const validId = ensureUUID(user.id);
    const validSiteId = user.assignedSiteId && user.assignedSiteId !== 'all' ? ensureUUID(user.assignedSiteId) : null;

    let payload: Record<string, unknown> = {
      id: validId,
      name: user.name,
      email: user.email,
      role: user.role,
      assigned_site_id: validSiteId,
    };

    let { error } = await supabase.from('profiles').upsert(payload);

    // If foreign key constraint on assigned_site_id failed, retry with null
    if (error && error.code === '23503') {
      payload.assigned_site_id = null;
      const retry = await supabase.from('profiles').upsert(payload);
      error = retry.error;
    }

    if (error) {
      console.warn('Supabase profile insert note:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase profile insert exception:', err);
    return false;
  }
};

/**
 * Updates current user profile details in Supabase 'profiles' table and auth metadata
 */
export const updateUserProfile = async (
  userId: string,
  updates: { name: string; assignedSiteId?: string }
): Promise<{ user: UserAccount | null; error: string | null }> => {
  try {
    const validId = ensureUUID(userId);
    const validSiteId =
      updates.assignedSiteId && updates.assignedSiteId !== 'all'
        ? ensureUUID(updates.assignedSiteId)
        : null;

    // 1. Update public.profiles table
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        name: updates.name.trim(),
        assigned_site_id: validSiteId,
      })
      .eq('id', validId);

    if (dbError) {
      console.warn('Supabase profile update note:', dbError.message);
    }

    // 2. Update auth user metadata
    try {
      await supabase.auth.updateUser({
        data: {
          name: updates.name.trim(),
          assigned_site_id: validSiteId,
        },
      });
    } catch {
      // ignore
    }

    // 3. Return fresh profile
    const freshProfile = await fetchUserProfile(validId);
    if (freshProfile) {
      saveSession(freshProfile);
      return { user: freshProfile, error: null };
    }

    return { user: null, error: 'Failed to fetch updated profile.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating profile';
    return { user: null, error: msg };
  }
};

/**
 * Updates user account password in Supabase Auth
 */
export const updateUserPassword = async (
  newPassword: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating password';
    return { success: false, error: msg };
  }
};

/**
 * Deletes a user profile from Supabase 'profiles' table
 */
export const deleteUserFromSupabase = async (userId: string): Promise<boolean> => {
  try {
    const validId = ensureUUID(userId);
    const { data, error } = await supabase.from('profiles').delete().eq('id', validId).select();
    if (error) {
      console.warn('Supabase profile delete note:', error.message);
      return false;
    } else if (data && data.length === 0) {
      console.warn('Supabase RLS note: 0 rows deleted from profiles table. Please ensure DELETE policy is enabled.');
    }
    return true;
  } catch (err) {
    console.warn('Supabase profile delete exception:', err);
    return false;
  }
};

/**
 * Uploads a real binary file (PDF / Image) up to 20MB directly to the Supabase Storage Bucket ('documents')
 */
export const uploadFileToSupabaseStorage = async (
  file: File,
  siteId: string,
  docId: string
): Promise<{ success: boolean; publicUrl?: string; filePath?: string; error?: string }> => {
  try {
    const rawExt = file.name.split('.').pop() || 'pdf';
    const fileExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'pdf';
    const cleanFileName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const cleanSiteId = siteId.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
    const cleanDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '') || generateUUID();
    const storagePath = `${cleanSiteId}/${cleanDocId}_${cleanFileName}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });

    if (error) {
      console.warn('Supabase storage upload error:', error.message);
      return { success: false, error: error.message };
    }

    const { data: publicData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    return {
      success: true,
      publicUrl: publicData.publicUrl,
      filePath: storagePath,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Storage upload exception';
    console.warn('Supabase storage upload exception:', err);
    return { success: false, error: msg };
  }
};

/**
 * Persists a document metadata record into the Supabase 'documents' table
 * with UUID compliance, duplicate prevention, and adaptive column matching.
 */
export const saveDocumentToSupabase = async (
  doc: DocumentRecord
): Promise<{ success: boolean; error?: string; isDuplicate?: boolean }> => {
  try {
    const validId = ensureUUID(doc.id);
    const validSiteId = ensureUUID(doc.siteId);

    // 1. Pre-flight duplicate check against local stored documents
    const localDocs = getStoredDocuments();
    const localDuplicate = findDatabaseDuplicate(doc, localDocs, validId);
    if (localDuplicate) {
      return {
        success: false,
        error: `Duplicate detected: Document matches Vendor "${doc.vendorName}", Invoice #${doc.invoiceNumber}, Date ${doc.date}, and Amount ₹${doc.amount}.`,
        isDuplicate: true,
      };
    }

    // 2. Pre-flight duplicate check against Supabase table
    const cleanVendor = doc.vendorName.trim();
    const cleanInvoice = doc.invoiceNumber.trim();
    const cleanDate = doc.date;
    const cleanAmount = Number(doc.amount);

    if (cleanVendor && cleanInvoice && cleanDate && !isNaN(cleanAmount)) {
      const { data: remoteMatches, error: checkError } = await supabase
        .from('documents')
        .select('id, vendor_name, invoice_number, date, amount')
        .ilike('vendor_name', cleanVendor)
        .ilike('invoice_number', cleanInvoice)
        .eq('date', cleanDate)
        .eq('amount', cleanAmount);

      if (!checkError && remoteMatches && remoteMatches.length > 0) {
        const conflict = remoteMatches.find((m) => m.id !== validId);
        if (conflict) {
          return {
            success: false,
            error: `Duplicate detected: Document matches Vendor "${doc.vendorName}", Invoice #${doc.invoiceNumber}, Date ${doc.date}, and Amount ₹${doc.amount}.`,
            isDuplicate: true,
          };
        }
      }
    }

    // Standard columns present in Supabase table
    const payload: Record<string, unknown> = {
      id: validId,
      site_id: validSiteId,
      vendor_name: doc.vendorName,
      invoice_number: doc.invoiceNumber,
      date: doc.date,
      amount: doc.amount,
      type: doc.type,
      status: doc.status || 'uploaded',
      uploaded_by: doc.uploadedBy,
      file_name: doc.fileName || 'document.pdf',
      verified_by: doc.verifiedBy || null,
      verified_at: doc.verifiedAt || null,
    };

    if (doc.fileUrl) payload.file_url = doc.fileUrl;
    if (doc.filePath) payload.file_path = doc.filePath;

    let { error } = await supabase.from('documents').upsert(payload);

    if (error) {
      // Handle Postgres unique constraint violation
      if (error.code === '23505') {
        return {
          success: false,
          error: `Duplicate document entry: This invoice already exists in the database.`,
          isDuplicate: true,
        };
      }
      // If table doesn't have file_url / file_path columns yet, retry with base payload
      delete payload.file_url;
      delete payload.file_path;
      const retry = await supabase.from('documents').upsert(payload);
      error = retry.error;
    }

    if (error) {
      console.warn('Supabase document insert note:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database save exception';
    console.warn('Supabase documents insert exception:', err);
    return { success: false, error: msg };
  }
};

/**
 * Updates document verification status in Supabase 'documents' table
 */
export const updateDocumentVerificationInSupabase = async (
  docId: string,
  verifiedBy: string,
  verifiedAt: string
): Promise<boolean> => {
  try {
    const validId = ensureUUID(docId);
    const { error } = await supabase
      .from('documents')
      .update({
        status: 'verified',
        verified_by: verifiedBy,
        verified_at: verifiedAt,
      })
      .eq('id', validId);

    if (error) {
      console.warn('Supabase verify update note:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase verify update exception:', err);
    return false;
  }
};

/**
 * Updates full document properties in Supabase 'documents' table
 */
export const updateDocumentInSupabase = async (doc: DocumentRecord): Promise<boolean> => {
  try {
    const validId = ensureUUID(doc.id);
    const validSiteId = ensureUUID(doc.siteId);

    // Duplicate check prior to update
    const localDocs = getStoredDocuments();
    const localDuplicate = findDatabaseDuplicate(doc, localDocs, validId);
    if (localDuplicate) {
      console.warn('Update blocked: Matches existing document:', localDuplicate.id);
      return false;
    }

    const cleanVendor = doc.vendorName.trim();
    const cleanInvoice = doc.invoiceNumber.trim();
    const cleanDate = doc.date;
    const cleanAmount = Number(doc.amount);

    if (cleanVendor && cleanInvoice && cleanDate && !isNaN(cleanAmount)) {
      const { data: remoteMatches } = await supabase
        .from('documents')
        .select('id, vendor_name, invoice_number, date, amount')
        .ilike('vendor_name', cleanVendor)
        .ilike('invoice_number', cleanInvoice)
        .eq('date', cleanDate)
        .eq('amount', cleanAmount);

      if (remoteMatches && remoteMatches.length > 0) {
        const conflict = remoteMatches.find((m) => m.id !== validId);
        if (conflict) {
          console.warn('Update blocked: remote document duplicate exists:', conflict.id);
          return false;
        }
      }
    }

    const { error } = await supabase
      .from('documents')
      .update({
        site_id: validSiteId,
        vendor_name: doc.vendorName,
        invoice_number: doc.invoiceNumber,
        date: doc.date,
        amount: doc.amount,
        type: doc.type,
      })
      .eq('id', validId);

    if (error) {
      console.warn('Supabase document update note:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase document update exception:', err);
    return false;
  }
};

/**
 * Deletes a document from Supabase DB and removes any attached file from Storage
 */
export const deleteDocumentFromSupabase = async (
  docId: string,
  filePath?: string
): Promise<boolean> => {
  try {
    const validId = ensureUUID(docId);
    const { data, error: dbError } = await supabase.from('documents').delete().eq('id', validId).select();
    if (dbError) {
      console.warn('Supabase document delete DB note:', dbError.message);
    } else if (data && data.length === 0) {
      console.warn('Supabase RLS note: 0 rows deleted. Please ensure the DELETE policy is enabled in Supabase SQL editor.');
    }

    if (filePath) {
      const { error: storageError } = await supabase.storage.from('documents').remove([filePath]);
      if (storageError) {
        console.warn('Supabase storage remove note:', storageError.message);
      }
    }
    return true;
  } catch (err) {
    console.warn('Supabase document delete exception:', err);
    return false;
  }
};

/**
 * Deletes a construction site from Supabase 'sites' table
 */
export const deleteSiteFromSupabase = async (siteId: string): Promise<boolean> => {
  try {
    const validId = ensureUUID(siteId);
    const { data, error } = await supabase.from('sites').delete().eq('id', validId).select();
    if (error) {
      console.warn('Supabase site delete note:', error.message);
      return false;
    } else if (data && data.length === 0) {
      console.warn('Supabase RLS note: 0 rows deleted from sites table. Please ensure DELETE policy is enabled.');
    }
    return true;
  } catch (err) {
    console.warn('Supabase site delete exception:', err);
    return false;
  }
};
