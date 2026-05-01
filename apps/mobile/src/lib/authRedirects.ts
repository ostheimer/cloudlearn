const AUTH_REDIRECT_QUERY_KEYS = [
  "code",
  "type",
  "error",
  "error_code",
  "error_description",
] as const;

function collectParams(parsedUrl: URL) {
  const params = new URLSearchParams(parsedUrl.search);

  if (parsedUrl.hash.length > 1) {
    const hashParams = new URLSearchParams(parsedUrl.hash.slice(1));
    hashParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }

  return params;
}

function buildQuery(params: URLSearchParams) {
  const query = new URLSearchParams();

  for (const key of AUTH_REDIRECT_QUERY_KEYS) {
    const value = params.get(key);
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function getAuthRedirectRouteFromUrl(url: string): string | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const params = collectParams(parsedUrl);
  const hostRoute = parsedUrl.hostname;
  const pathRoute = parsedUrl.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  const route = pathRoute || hostRoute;
  const isRecoveryRoute =
    route === "reset-password" || params.get("type") === "recovery";
  const isAuthCallbackRoute = route === "auth-callback";

  if (isRecoveryRoute) {
    return `/reset-password${buildQuery(params)}`;
  }

  if (isAuthCallbackRoute) {
    return `/auth-callback${buildQuery(params)}`;
  }

  return null;
}
