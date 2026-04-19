import type { Locale } from "../config";
import { en, type Messages } from "./en";
import { es } from "./es";

const DICTIONARIES: Record<Locale, Messages> = { en, es };

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? en;
}

export type { Messages };
