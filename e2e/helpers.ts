/**
 * E2E test helpers for clearn.ai
 *
 * Provides authenticated API access for test scenarios.
 * Uses apitest@clearn.test user created via admin API.
 */

const SUPABASE_URL = "https://yektpwhycxusblnueplm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BN5r8pNWC40Eahc8h5NqpA_imO5Ky-f";
const API_BASE = "https://clearn-api.vercel.app";

const TEST_EMAIL = "apitest@clearn.test";
const TEST_PASSWORD = "ApiTest1234!";

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

  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    }
  );

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
