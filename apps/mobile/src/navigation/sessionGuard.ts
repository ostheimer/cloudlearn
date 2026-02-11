export function resolveAuthRedirect(isAuthenticated: boolean, firstSegment?: string): string | null {
  const inAuthGroup = firstSegment === "(auth)";
  if (!isAuthenticated && !inAuthGroup) {
    return "/(auth)";
  }

  if (isAuthenticated && inAuthGroup) {
    return "/(tabs)";
  }

  return null;
}
