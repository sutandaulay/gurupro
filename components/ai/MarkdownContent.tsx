"use client";

import React from "react";

/**
 * MarkdownContent — renderer markdown ringan (React murni, tanpa
 * dangerouslySetInnerHTML). Mendukung: bold, italic, bullet list,
 * numbered list, heading, link, dan line break.
 * Dipakai untuk bubble chat AI dan hasil generate AI lainnya.
 */
export default function MarkdownContent({
  content,
  variant = "light",
  className = "",
}: {
  content: string;
  variant?: "light" | "dark";
  className?: string;
}) {
  const blocks = parseBlocks(content || "");

  const themed = (cls: string) => {
    if (variant === "dark") return cls;
    return cls;
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} variant={variant} themed={themed} />
      ))}
    </div>
  );
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");

  let currentList: { ordered: boolean; items: string[] } | null = null;
  const flushList = () => {
    if (currentList) {
      blocks.push({
        type: "list",
        ordered: currentList.ordered,
        items: currentList.items,
      });
      currentList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (!currentList || currentList.ordered) {
        flushList();
        currentList = { ordered: false, items: [] };
      }
      currentList.items.push(bullet[1]);
      continue;
    }

    const numList = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (numList) {
      if (!currentList || !currentList.ordered) {
        flushList();
        currentList = { ordered: true, items: [] };
      }
      currentList.items.push(numList[1]);
      continue;
    }

    flushList();
    blocks.push({ type: "paragraph", text: line.trim() });
  }
  flushList();
  return blocks;
}

function BlockView({
  block,
  variant,
  themed,
}: {
  block: Block;
  variant: "light" | "dark";
  themed: (cls: string) => string;
}) {
  switch (block.type) {
    case "heading":
      const size =
        block.level === 1
          ? "text-base font-bold"
          : block.level === 2
            ? "text-sm font-bold"
            : "text-sm font-semibold";
      return (
        <div
          className={`${themed(
            variant === "dark" ? "text-white" : "text-slate-900"
          )} ${size} mt-0.5`}
        >
          <InlineText text={block.text} variant={variant} />
        </div>
      );
    case "list":
      if (block.ordered) {
        return (
          <ol className="list-decimal list-inside space-y-0.5 pl-1">
            {block.items.map((item, i) => (
              <li key={i} className={baseText(variant)}>
                <InlineText text={item} variant={variant} />
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc list-inside space-y-0.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className={baseText(variant)}>
              <InlineText text={item} variant={variant} />
            </li>
          ))}
        </ul>
      );
    case "paragraph":
    default:
      return (
        <p className={`${baseText(variant)} leading-relaxed`}>
          <InlineText text={block.text} variant={variant} />
        </p>
      );
  }
}

function baseText(variant: "light" | "dark") {
  return variant === "dark" ? "text-sm text-white/95" : "text-sm text-slate-700";
}

type InlinePart =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let m: RegExpExecArray | null;
  let last = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**") && tok.endsWith("**")) {
      parts.push({ type: "bold", text: tok.slice(2, -2) });
    } else if (tok.startsWith("`") && tok.endsWith("`")) {
      parts.push({ type: "code", text: tok.slice(1, -1) });
    } else if (tok.startsWith("[")) {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        parts.push({ type: "link", text: linkMatch[1], href: linkMatch[2] });
      } else {
        parts.push({ type: "text", text: tok });
      }
    } else if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      const inner = tok.slice(1, -1);
      if (inner.includes("**") || inner.includes("*")) {
        parts.push({ type: "text", text: tok });
      } else {
        parts.push({ type: "italic", text: inner });
      }
    } else {
      parts.push({ type: "text", text: tok });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

function InlineText({ text, variant }: { text: string; variant: "light" | "dark" }) {
  const parts = parseInline(text);
  return (
    <>
      {parts.map((part, i) => {
        switch (part.type) {
          case "bold":
            return (
              <strong
                key={i}
                className={`font-semibold ${
                  variant === "dark" ? "text-white" : "text-slate-900"
                }`}
              >
                {part.text}
              </strong>
            );
          case "italic":
            return (
              <em key={i} className="italic">
                {part.text}
              </em>
            );
          case "code":
            return (
              <code
                key={i}
                className={`px-1 py-0.5 rounded text-xs font-mono ${
                  variant === "dark" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {part.text}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  variant === "dark"
                    ? "underline text-indigo-200 hover:text-white"
                    : "underline text-indigo-600 hover:text-indigo-800"
                }
              >
                {part.text}
              </a>
            );
          case "text":
          default:
            return <React.Fragment key={i}>{part.text}</React.Fragment>;
        }
      })}
    </>
  );
}