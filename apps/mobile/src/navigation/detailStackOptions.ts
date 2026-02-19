type DetailStackColors = {
  primary: string;
  background: string;
};

type CreateDetailStackOptionsParams = {
  title: string;
  backTitle: string;
  colors: DetailStackColors;
};

export function createDetailStackOptions({
  title,
  backTitle,
  colors,
}: CreateDetailStackOptionsParams) {
  return {
    headerShown: true as const,
    title,
    headerBackTitle: backTitle,
    headerTintColor: colors.primary,
    headerStyle: { backgroundColor: colors.background },
  };
}
