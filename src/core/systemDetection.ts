const timeZoneCountryHints: Array<[RegExp, string]> = [
  [/^Europe\/Istanbul$/i, "TR"],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Anchorage|Phoenix|Detroit|Indiana\/.+)$/i, "US"],
  [/^America\/(Toronto|Vancouver|Edmonton|Halifax|Winnipeg|Regina|St_Johns)$/i, "CA"],
  [/^Asia\/Riyadh$/i, "SA"],
  [/^Africa\/Cairo$/i, "EG"],
  [/^Asia\/Karachi$/i, "PK"],
  [/^Asia\/Dhaka$/i, "BD"],
  [/^Asia\/Kuala_Lumpur$/i, "MY"],
  [/^Asia\/Jakarta$/i, "ID"],
  [/^Europe\/London$/i, "GB"],
  [/^Europe\/Dublin$/i, "IE"],
  [/^Europe\/(Oslo|Stockholm|Helsinki|Copenhagen)$/i, "NO"],
];

export function inferCountryCode(timeZone: string): string | undefined {
  const browserLocales = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const locale of browserLocales) {
    const region = locale.match(/-([A-Z]{2})(?:$|-)/i)?.[1]?.toUpperCase();
    if (region) return region;
  }
  for (const [pattern, country] of timeZoneCountryHints) {
    if (pattern.test(timeZone)) return country;
  }
  return undefined;
}
