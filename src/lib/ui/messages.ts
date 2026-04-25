import { en } from "@/lib/i18n/messages/en";

/**
 * @deprecated Import from `@/lib/i18n/LocaleProvider` (`useT()`) or
 * `@/lib/i18n/server` (`getT()`) so strings switch with the user's locale.
 * This export always returns English and exists only until every component
 * has been migrated.
 */
export const uiMessages = en;

export type AppMessageKey = `${keyof typeof uiMessages}.${string}`;
