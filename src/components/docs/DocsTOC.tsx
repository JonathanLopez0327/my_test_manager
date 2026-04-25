"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};

export function DocsTOC() {
  const t = useT();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const article = document.querySelector("article.docs-prose");
    if (!article) return;
    const nodes = article.querySelectorAll("h2[id], h3[id]");
    const list: Heading[] = Array.from(nodes).map((node) => ({
      id: node.id,
      text: node.textContent?.replace(/#$/, "").trim() ?? "",
      level: node.tagName === "H2" ? 2 : 3,
    }));
    setHeadings(list);
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-90px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {t.docs.chrome.onThisPage}
      </p>
      <ul className="mt-3 space-y-0.5">
        {headings.map((heading) => {
          const isActive = activeId === heading.id;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className={cn(
                  "block rounded-md py-1 transition-colors",
                  heading.level === 3 ? "pl-5 text-[0.8rem]" : "pl-2",
                  isActive
                    ? "font-semibold text-brand-700"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
