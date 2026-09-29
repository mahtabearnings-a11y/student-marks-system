import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function resolveKey(variable: string, fallback: string[] = []): string {
  const raw = Deno.env.get(variable);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed?.default) return parsed.default;
      const first = Object.values(parsed || {})[0];
      if (typeof first === "string") return first;
    } catch {
      return raw;
    }
  }
  for (const name of fallback) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`Required Supabase key is not configured: ${variable}`);
}

const PUBLISHABLE_KEY = resolveKey("SUPABASE_PUBLISHABLE_KEYS", [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
]);

const SECRET_KEY = resolveKey("SUPABASE_SECRET_KEYS", [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeStudentId(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function studentAuthEmail(studentId: string): string {
  const bytes = new TextEncoder().encode(normalizeStudentId(studentId));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
    .toLowerCase();
  return `student-${encoded}@login.umssasauli.local`;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const byte of bytes) suffix += chars[byte % chars.length];
  return `Sasauli@${suffix}`;
}

function assertPassword(password: string) {
  if (!password || password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }
}

async function getCaller(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw new Error("Authentication is required.");

  const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Your session is no longer valid. Please sign in again.");

  const admin = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: roleRow, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const isAdmin = !roleError && roleRow?.role === "admin";
  return { user: data.user, admin, isAdmin };
}

async function findAuthUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = (data?.users || []).find((item: any) => String(item.email || "").toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (!data?.users?.length || data.users.length < 1000) break;
  }
  return null;
}

async function getStudent(admin: any, studentId: string) {
  const { data, error } = await admin
    .from("students")
    .select("id, student_id, student_name")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Student ID ${studentId} does not exist.`);
  return data;
}

async function getAccount(admin: any, studentId: string) {
  const { data, error } = await admin
    .from("student_accounts")
    .select("user_id, student_id, auth_email, is_enabled, must_change_password, password_changed_at")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getCredential(admin: any, studentId: string) {
  const { data, error } = await admin
    .from("student_login_credentials")
    .select("student_id, current_password, updated_at")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateAuthBan(admin: any, userId: string, enabled: boolean) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: enabled ? "none" : "876000h",
  });
  if (error) throw error;
}

async function updateAccount(admin: any, studentId: string, changes: Record<string, unknown>) {
  const { error } = await admin
    .from("student_accounts")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("student_id", studentId);
  if (error) throw error;
}

async function upsertCredential(admin: any, studentId: string, password: string) {
  const { error } = await admin
    .from("student_login_credentials")
    .upsert({
      student_id: studentId,
      current_password: password,
      updated_at: new Date().toISOString(),
    }, { onConflict: "student_id" });
  if (error) throw error;
}

async function createOrRepairStudentAccount(admin: any, studentId: string, options: { forcePassword?: string; keepDisabled?: boolean } = {}) {
  const student = await getStudent(admin, studentId);
  const authEmail = studentAuthEmail(studentId);
  let account = await getAccount(admin, studentId);
  let credential = await getCredential(admin, studentId);
  let password = options.forcePassword || credential?.current_password || "";
  let repaired = false;
  let created = false;

  if (!account) {
    if (!password) password = generatePassword();

    let authUser = await findAuthUserByEmail(admin, authEmail);
    if (!authUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: {
          student_id: studentId,
          full_name: student.student_name || "",
          portal_role: "student",
        },
        app_metadata: { portal_role: "student" },
      });
      if (error) throw error;
      authUser = data.user;
      created = true;
    } else if (options.forcePassword || !credential) {
      const { error } = await admin.auth.admin.updateUserById(authUser.id, {
        password,
        email: authEmail,
        email_confirm: true,
        user_metadata: {
          student_id: studentId,
          full_name: student.student_name || "",
          portal_role: "student",
        },
      });
      if (error) throw error;
      repaired = true;
    }

    const { error: accountError } = await admin
      .from("student_accounts")
      .insert({
        user_id: authUser.id,
        student_id: studentId,
        auth_email: authEmail,
        is_enabled: true,
        must_change_password: true,
        password_changed_at: null,
        updated_at: new Date().toISOString(),
      });
    if (accountError) throw accountError;

    account = { user_id: authUser.id, student_id: studentId, auth_email: authEmail, is_enabled: true, must_change_password: true };
    await upsertCredential(admin, studentId, password);
    credential = { current_password: password };
  } else {
    // Existing account from an earlier/manual setup. Normalize it to Student-ID login.
    const authUserId = account.user_id;
    const authUser = await admin.auth.admin.getUserById(authUserId);
    if (authUser.error) throw authUser.error;

    const currentAuthEmail = String(authUser.data.user?.email || "").toLowerCase();
    if (currentAuthEmail !== authEmail.toLowerCase()) {
      const { error } = await admin.auth.admin.updateUserById(authUserId, {
        email: authEmail,
        email_confirm: true,
        user_metadata: {
          ...(authUser.data.user?.user_metadata || {}),
          student_id: studentId,
          full_name: student.student_name || "",
          portal_role: "student",
        },
      });
      if (error) throw error;
      repaired = true;
    }

    if (!credential || options.forcePassword) {
      password = options.forcePassword || generatePassword();
      const { error } = await admin.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: {
          ...(authUser.data.user?.user_metadata || {}),
          student_id: studentId,
          full_name: student.student_name || "",
          portal_role: "student",
        },
      });
      if (error) throw error;
      await upsertCredential(admin, studentId, password);
      await updateAccount(admin, studentId, {
        auth_email: authEmail,
        must_change_password: true,
        password_changed_at: null,
      });
      credential = { current_password: password };
      repaired = true;
    } else {
      await updateAccount(admin, studentId, { auth_email: authEmail });
    }

    await updateAuthBan(admin, authUserId, account.is_enabled !== false);
  }

  if (account && options.keepDisabled) {
    await updateAuthBan(admin, account.user_id, false);
  }

  return {
    student_id: studentId,
    password: password || credential?.current_password || null,
    created,
    repaired,
    enabled: account?.is_enabled !== false,
  };
}

async function provisionAll(admin: any) {
  const { data: students, error } = await admin
    .from("students")
    .select("student_id")
    .not("student_id", "is", null)
    .order("student_id", { ascending: true });
  if (error) throw error;

  let created = 0;
  let repaired = 0;
  let skipped = 0;
  const errors: Array<{ student_id: string; error: string }> = [];

  for (const row of students || []) {
    const studentId = normalizeStudentId(row.student_id);
    if (!studentId) {
      skipped += 1;
      continue;
    }
    try {
      const result = await createOrRepairStudentAccount(admin, studentId);
      if (result.created) created += 1;
      else if (result.repaired) repaired += 1;
      else skipped += 1;
    } catch (error) {
      errors.push({ student_id: studentId, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { created, repaired, skipped, errors };
}

async function handleAction(action: string, body: any, caller: { user: any; admin: any; isAdmin: boolean }) {
  const { user, admin, isAdmin } = caller;

  if (action === "change_password") {
    const password = String(body?.password || "");
    assertPassword(password);

    const account = await admin
      .from("student_accounts")
      .select("student_id, is_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (account.error) throw account.error;
    if (!account.data) throw new Error("This account is not linked to a student.");
    if (account.data.is_enabled !== true) throw new Error("Student login is disabled by the school.");

    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (passwordError) throw passwordError;

    await admin
      .from("student_accounts")
      .update({ must_change_password: false, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    await upsertCredential(admin, account.data.student_id, password);

    return { ok: true };
  }

  if (!isAdmin) throw new Error("Only Admin can manage student login accounts.");

  const studentId = normalizeStudentId(body?.student_id);

  if (action === "create") {
    if (!studentId) throw new Error("Student ID is required.");
    return await createOrRepairStudentAccount(admin, studentId);
  }

  if (action === "provision_all") {
    return await provisionAll(admin);
  }

  if (action === "set_password") {
    if (!studentId) throw new Error("Student ID is required.");
    const password = String(body?.password || "");
    assertPassword(password);
    const account = await getAccount(admin, studentId);
    if (!account) throw new Error("Student login account does not exist.");
    const { error } = await admin.auth.admin.updateUserById(account.user_id, { password });
    if (error) throw error;
    await upsertCredential(admin, studentId, password);
    await updateAccount(admin, studentId, { must_change_password: true, password_changed_at: null });
    return { ok: true, password };
  }

  if (action === "set_enabled") {
    if (!studentId) throw new Error("Student ID is required.");
    const enabled = body?.enabled === true;
    const account = await getAccount(admin, studentId);
    if (!account) throw new Error("Student login account does not exist.");
    await updateAccount(admin, studentId, { is_enabled: enabled });
    await updateAuthBan(admin, account.user_id, enabled);
    return { ok: true, enabled };
  }

  if (action === "sync_student_id") {
    const oldStudentId = normalizeStudentId(body?.old_student_id);
    const newStudentId = normalizeStudentId(body?.new_student_id);
    if (!oldStudentId || !newStudentId) throw new Error("Both old and new Student IDs are required.");
    if (oldStudentId === newStudentId) return { ok: true };
    await getStudent(admin, newStudentId);
    const existingTarget = await getAccount(admin, newStudentId);
    if (existingTarget) throw new Error(`Student ID ${newStudentId} already has a login account.`);
    const account = await getAccount(admin, oldStudentId);
    if (!account) {
      return await createOrRepairStudentAccount(admin, newStudentId);
    }
    const oldCredential = await getCredential(admin, oldStudentId);
    const newEmail = studentAuthEmail(newStudentId);
    const authUser = await admin.auth.admin.getUserById(account.user_id);
    if (authUser.error) throw authUser.error;
    const { error: authError } = await admin.auth.admin.updateUserById(account.user_id, {
      email: newEmail,
      email_confirm: true,
      user_metadata: {
        ...(authUser.data.user?.user_metadata || {}),
        student_id: newStudentId,
        portal_role: "student",
      },
    });
    if (authError) throw authError;

    const { error: accountError } = await admin
      .from("student_accounts")
      .update({ student_id: newStudentId, auth_email: newEmail, updated_at: new Date().toISOString() })
      .eq("user_id", account.user_id);
    if (accountError) throw accountError;

    if (oldCredential?.current_password) {
      await upsertCredential(admin, newStudentId, oldCredential.current_password);
      await admin.from("student_login_credentials").delete().eq("student_id", oldStudentId);
    }

    return { ok: true, student_id: newStudentId };
  }

  throw new Error(`Unsupported student login action: ${action}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const caller = await getCaller(req);
    const body = await req.json().catch(() => ({}));
    const result = await handleAction(String(body?.action || ""), body, caller);
    return json(result, 200);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
