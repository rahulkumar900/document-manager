import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimiter';

const VALID_ROLES = new Set(['Super Admin', 'Admin', 'Site Accountant', 'Site Auditor']);
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(req: Request) {
  try {
    // 1. Rate limiting check (max 10 user creations per minute per IP)
    const clientIp = getClientIp(req);
    const rateLimitResult = checkRateLimit(`admin-create:${clientIp}`, 10, 60000);
    if (rateLimitResult.isLimited) {
      return NextResponse.json(
        { error: 'Too many account creation requests. Please try again shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request payload.' }, { status: 400 });
    }

    const { email, password, name, role, assignedSiteId } = body;

    // 2. Strict input validation
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string' || !name || typeof name !== 'string' || !role || typeof role !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid required user fields.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPassword = password.trim();

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (cleanPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json({ error: `Invalid role selected. Allowed roles: ${Array.from(VALID_ROLES).join(', ')}` }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tkjdvwrexjemyrtvolbt.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const cleanSiteId = assignedSiteId && assignedSiteId !== 'all' ? String(assignedSiteId).trim() : null;

    let userId: string | null = null;

    // 3. Primary: Use Admin API with email_confirm: true (bypasses Supabase email rate limits completely)
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        name: cleanName,
        role: role,
        assigned_site_id: cleanSiteId,
      },
    });

    if (!adminError && adminData?.user) {
      userId = adminData.user.id;
    } else {
      // 4. Fallback: standard signUp if service role key fails or is restricted
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            name: cleanName,
            role: role,
            assigned_site_id: cleanSiteId,
          },
        },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      userId = authData.user?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to provision user credentials.' }, { status: 500 });
    }

    // 5. Sync profile in public.profiles table
    const profilePayload: Record<string, unknown> = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: role,
      assigned_site_id: cleanSiteId,
    };

    let { error: profileError } = await supabaseAdmin.from('profiles').upsert(profilePayload);

    if (profileError && profileError.code === '23503') {
      profilePayload.assigned_site_id = null;
      const retry = await supabaseAdmin.from('profiles').upsert(profilePayload);
      profileError = retry.error;
    }

    if (profileError) {
      console.warn('Profile sync note:', profileError.message);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: role,
        assignedSiteId: cleanSiteId || 'all',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error creating user.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
