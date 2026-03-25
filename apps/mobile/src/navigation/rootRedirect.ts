export interface RootRedirectInput {
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingLoaded: boolean;
  onboardingCompleted: boolean;
  firstSegment?: string | undefined;
}

export function resolveRootRedirect({
  isAuthenticated,
  isLoading,
  onboardingLoaded,
  onboardingCompleted,
  firstSegment,
}: RootRedirectInput): string | null {
  if (isLoading) {
    return null;
  }

  const inAuthScreen = firstSegment === "auth";
  const inOnboardingScreen = firstSegment === "onboarding";
  const hasSegment = Boolean(firstSegment);

  if (!isAuthenticated) {
    return inAuthScreen ? null : "/auth";
  }

  if (!onboardingLoaded) {
    return null;
  }

  if (!onboardingCompleted) {
    return inOnboardingScreen ? null : "/onboarding";
  }

  if (inAuthScreen || inOnboardingScreen || !hasSegment) {
    return "/(tabs)";
  }

  return null;
}
