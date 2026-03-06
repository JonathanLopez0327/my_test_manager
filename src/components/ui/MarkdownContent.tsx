"use client";

import { Fragment, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

/**
 * Shared markdown renderer for rich text blocks in chat-like surfaces.
 * Keeps a compact, readable typographic scale aligned with existing UI tokens.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const blocks = renderBlocks(content);

  return (
    <div
      className={cn(
        "markdown-content break-words text-sm leading-relaxed",
        "[&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-stroke [&_blockquote]:pl-3 [&_blockquote]:text-ink-muted",
        "[&_code]:rounded [&_code]:bg-surface-elevated [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
        "[&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-2 [&_h2]:text-[15px] [&_h2]:font-semibold",
        "[&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-stroke [&_pre]:bg-surface [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
    >
      {blocks}
    </div>
  );
}

function renderBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const fence = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;

      blocks.push(
        <pre key={`code-${i}`} data-language={fence || undefined}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
      blocks.push(<HeadingTag key={`h-${i}`}>{renderInline(text, `h-inline-${i}`)}</HeadingTag>);
      i += 1;
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].trim().match(/^[-*]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`}>
          {items.map((item, index) => (
            <li key={`ul-item-${i}-${index}`}>{renderInline(item, `ul-inline-${i}-${index}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].trim().match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`}>
          {items.map((item, index) => (
            <li key={`ol-item-${i}-${index}`}>{renderInline(item, `ol-inline-${i}-${index}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(<blockquote key={`quote-${i}`}>{renderInline(quoteLines.join(" "), `q-inline-${i}`)}</blockquote>);
      continue;
    }

    const paragraphLines = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim()) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(<p key={`p-${i}`}>{renderInline(paragraphLines.join(" "), `p-inline-${i}`)}</p>);
  }

  return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(
        <Fragment key={`${keyPrefix}-text-${tokenIndex}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>,
      );
      tokenIndex += 1;
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(<strong key={`${keyPrefix}-strong-${tokenIndex}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(<em key={`${keyPrefix}-em-${tokenIndex}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(<code key={`${keyPrefix}-code-${tokenIndex}`}>{token.slice(1, -1)}</code>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const href = linkMatch[2];
        tokens.push(
          <a
            key={`${keyPrefix}-a-${tokenIndex}`}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        tokens.push(<Fragment key={`${keyPrefix}-raw-${tokenIndex}`}>{token}</Fragment>);
      }
    }

    tokenIndex += 1;
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(<Fragment key={`${keyPrefix}-tail`}>{text.slice(lastIndex)}</Fragment>);
  }

  return tokens.length > 0 ? tokens : [text];
}
