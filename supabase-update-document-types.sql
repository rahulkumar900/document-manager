-- ==============================================================================
-- UPDATE CHECK CONSTRAINT FOR DOCUMENTS TABLE (SITE DOCS)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tkjdvwrexjemyrtvolbt/sql
-- ==============================================================================

-- 1. Drop existing type check constraint
alter table public.documents drop constraint if exists documents_type_check;

-- 2. Add updated check constraint supporting 'Credit Note' and 'Ledger'
alter table public.documents add constraint documents_type_check 
  check (type in ('Invoice', 'Challan', 'Credit Note', 'Ledger'));
