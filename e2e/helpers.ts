/**
 * E2E test helpers for clearn.ai
 *
 * Provides authenticated API access for test scenarios.
 * All credentials are read from the environment (.env locally, secrets in CI)
 * and are never hard-coded — see .env.example. Uses the apitest@clearn.test user.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". E2E tests read all ` +
        `credentials from the environment (.env locally, secrets in CI) — they ` +
        `must never be hard-coded. See .env.example for the required variables.`
    );
  }
  return value;
}

// Public base URL (not a secret); overridable for preview/staging runs.
const API_BASE = process.env.E2E_API_BASE_URL ?? "https://clearn-api.vercel.app";

let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * Get an authenticated JWT token for the test user.
 * Caches the token for the duration of the test run.
 */
export async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
  const testEmail = requireEnv("TEST_USER_EMAIL");
  const testPassword = requireEnv("TEST_USER_PASSWORD");

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  // Expire 5 minutes before actual expiry
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  return cachedToken!;
}

/**
 * Make an authenticated API request.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<{ status: number; body: T }> {
  const token = await getAuthToken();
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body as T };
}

/**
 * Make an unauthenticated API request.
 */
export async function apiRequestAnon<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<{ status: number; body: T }> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body as T };
}
