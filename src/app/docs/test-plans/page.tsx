import { resolveLocale } from "@/lib/i18n/server";
import En from "./content.en.mdx";
import Es from "./content.es.mdx";

export default async function Page() {
  const locale = await resolveLocale();
  const Content = locale === "es" ? Es : En;
  return <Content />;
}
