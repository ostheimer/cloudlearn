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
  const inAuthCallbackScreen = firstSegment === "auth-callback";
  const inOnboardingScreen = firstSegment === "onboarding";
  const inResetPasswordScreen = firstSegment === "reset-password";
  const hasSegment = Boolean(firstSegment);

  if (!isAuthenticated) {
    if (!hasSegment || inOnboardingScreen) {
      return "/(tabs)";
    }

    return null;
  }

  if (!onboardingLoaded) {
    return null;
  }

  if (!onboardingCompleted) {
    return inOnboardingScreen || inAuthCallbackScreen || inResetPasswordScreen
      ? null
      : "/onboarding";
  }

  if (inAuthScreen || inOnboardingScreen || !hasSegment) {
    return "/(tabs)";
  }

  return null;
}
