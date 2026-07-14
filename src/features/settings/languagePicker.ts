export type LanguageOption = {
  id: string;
  label: string;
  detail?: string;
  keywords?: string[];
};

/** Keep the system choice visible while searching concrete languages. */
export function filterLanguageOptions(
  options: LanguageOption[],
  query: string,
): LanguageOption[] {
  const value = query.trim().toLocaleLowerCase();
  if (!value) return options;

  return options.filter((option) => {
    if (option.id === "system") return true;
    return [option.id, option.label, option.detail, ...(option.keywords ?? [])]
      .filter(Boolean)
      .some((text) => text!.toLocaleLowerCase().includes(value));
  });
}
