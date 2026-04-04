export type UiLanguage = "en" | "es";

export function resolveUiLanguage(
  configured: "auto" | UiLanguage | undefined,
  vscodeLanguage: string,
): UiLanguage {
  if (configured === "en" || configured === "es") {
    return configured;
  }
  return vscodeLanguage.toLowerCase().startsWith("es") ? "es" : "en";
}
