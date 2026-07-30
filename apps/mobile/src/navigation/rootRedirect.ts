export interface RootRedirectInput {
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingLoaded: boolean;
  onboardingCompleted: boolean;
  firstSegment?: string | undefined;
  /**
   * Die Einführung wird freiwillig erneut angesehen (#609). Ohne diesen
   * Merker schickt die Regel unten jedes fertige Konto sofort aus
   * /onboarding zurück in die Tabs — „Einführung erneut ansehen" wäre
   * damit ein Knopf, der nichts tut.
   */
  onboardingReplay?: boolean | undefined;
}

export function resolveRootRedirect({
  isAuthenticated,
  isLoading,
  onboardingLoaded,
  onboardingCompleted,
  firstSegment,
  onboardingReplay,
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

  if (inOnboardingScreen && onboardingReplay) {
    return null;
  }

  if (inAuthScreen || inOnboardingScreen || !hasSegment) {
    return "/(tabs)";
  }

  return null;
}
