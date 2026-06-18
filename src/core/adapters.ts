import type { CalculationMethodAdapter, CalculationParameters, Coordinates } from "./types";
import { defaultCalculationParameters } from "./types";

export const DiyanetAdapter: CalculationMethodAdapter = {
  id: "diyanet",
  displayName: "Diyanet Isleri (Turkiye)",
  summary: "Fajr 18 deg, Isha 17 deg, horizon -1.9 deg, +5 min Dhuhr, +4 min Asr.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 18,
      ishaAngle: 17,
      sunriseAngle: -1.9,
      asrShadowFactor: 1,
      dhuhrOffsetMinutes: 5,
      asrOffsetMinutes: 4,
      highLatitudeRule: "none",
    }),
};

export const MWLAdapter: CalculationMethodAdapter = {
  id: "mwl",
  displayName: "Muslim World League",
  summary: "Fajr 18 deg, Isha 17 deg. Global default.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 18,
      ishaAngle: 17,
      asrShadowFactor: 1,
      highLatitudeRule: "angleBased",
    }),
};

export const ISNAAdapter: CalculationMethodAdapter = {
  id: "isna",
  displayName: "Islamic Society of North America",
  summary: "Fajr 15 deg, Isha 15 deg. North America.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 15,
      ishaAngle: 15,
      asrShadowFactor: 1,
      highLatitudeRule: "angleBased",
    }),
};

export const UmmAlQuraAdapter: CalculationMethodAdapter = {
  id: "ummalqura",
  displayName: "Umm al-Qura (Makkah)",
  summary: "Fajr 18.5 deg, Isha = Maghrib + 90 min.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 18.5,
      ishaAngle: undefined,
      ishaFixedMinutes: 90,
      asrShadowFactor: 1,
      highLatitudeRule: "none",
    }),
};

export const EgyptianAdapter: CalculationMethodAdapter = {
  id: "egyptian",
  displayName: "Egyptian General Authority of Survey",
  summary: "Fajr 19.5 deg, Isha 17.5 deg.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 19.5,
      ishaAngle: 17.5,
      asrShadowFactor: 1,
      highLatitudeRule: "angleBased",
    }),
};

export const KarachiAdapter: CalculationMethodAdapter = {
  id: "karachi",
  displayName: "University of Islamic Sciences, Karachi",
  summary: "Fajr 18 deg, Isha 18 deg.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 18,
      ishaAngle: 18,
      asrShadowFactor: 1,
      highLatitudeRule: "angleBased",
    }),
};

export const JAKIMAdapter: CalculationMethodAdapter = {
  id: "jakim",
  displayName: "JAKIM (Malaysia)",
  summary: "Fajr 17.5 deg, Isha 18 deg, JAKIM ihtiyati. Matches e-Solat.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 17.5,
      ishaAngle: 18,
      asrShadowFactor: 1,
      dhuhrOffsetMinutes: 3,
      asrOffsetMinutes: 2,
      manualOffsets: { maghrib: 2, isha: 2 },
      highLatitudeRule: "angleBased",
    }),
};

export const KemenagAdapter: CalculationMethodAdapter = {
  id: "kemenag",
  displayName: "Kemenag (Indonesia)",
  summary: "Fajr 20 deg, Isha 18 deg, Kemenag ihtiyati.",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 20,
      ishaAngle: 18,
      asrShadowFactor: 1,
      dhuhrOffsetMinutes: 3,
      asrOffsetMinutes: 2,
      manualOffsets: { fajr: 2, maghrib: 3, isha: 2 },
      highLatitudeRule: "angleBased",
    }),
};

export const MoonsightingCommitteeAdapter: CalculationMethodAdapter = {
  id: "moonsighting",
  displayName: "Moonsighting Committee Worldwide",
  summary: "Fajr 18 deg, Isha 18 deg (seasonal approximation).",
  resolve: () =>
    defaultCalculationParameters({
      fajrAngle: 18,
      ishaAngle: 18,
      asrShadowFactor: 1,
      highLatitudeRule: "angleBased",
    }),
};

export function manualAdapter(parameters: CalculationParameters): CalculationMethodAdapter {
  return {
    id: "manual",
    displayName: "Manual",
    summary: "User-supplied angles, shadow factor, and offsets.",
    resolve: () => parameters,
  };
}

export function hanafiModifier(base: CalculationMethodAdapter): CalculationMethodAdapter {
  return {
    id: `${base.id}.hanafi`,
    displayName: `${base.displayName} (Hanafi)`,
    summary: `${base.summary} Hanafi Asr (shadow x2).`,
    resolve: (coordinates: Coordinates) => ({
      ...base.resolve(coordinates),
      asrShadowFactor: 2,
    }),
  };
}

export const builtInMethods: CalculationMethodAdapter[] = [
  DiyanetAdapter,
  MWLAdapter,
  ISNAAdapter,
  UmmAlQuraAdapter,
  EgyptianAdapter,
  KarachiAdapter,
  JAKIMAdapter,
  KemenagAdapter,
  MoonsightingCommitteeAdapter,
];

export function adapterForId(id: string): CalculationMethodAdapter | undefined {
  return builtInMethods.find((adapter) => adapter.id === id);
}

export function resolveMethod(
  methodId: string,
  hanafiAsr: boolean,
  manualParameters?: CalculationParameters,
): CalculationMethodAdapter | undefined {
  const base = methodId === "manual" ? (manualParameters ? manualAdapter(manualParameters) : undefined) : adapterForId(methodId);
  if (!base) return undefined;
  return hanafiAsr ? hanafiModifier(base) : base;
}

export const countryMethod: Record<string, string> = {
  TR: "diyanet",
  US: "isna",
  CA: "isna",
  SA: "ummalqura",
  EG: "egyptian",
  PK: "karachi",
  IN: "karachi",
  BD: "karachi",
  AF: "karachi",
  MY: "jakim",
  ID: "kemenag",
  GB: "mwl",
  IE: "mwl",
  NO: "mwl",
  SE: "mwl",
  FI: "mwl",
  DK: "mwl",
  IS: "mwl",
};

export function methodIdForCountryCode(code?: string): string {
  if (!code) return "mwl";
  return countryMethod[code.toUpperCase()] ?? "mwl";
}
