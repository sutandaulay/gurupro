"use client";

import React from "react";

/**
 * RichMarkdown — renderer markdown yang aman (React murni, tanpa
 * dangerouslySetInnerHTML). Mendukung: heading, bold, italic, code,
 * bullet & numbered list, link, tabel markdown (pipe), dan paragraf.
 * Dipakai untuk render hasil AI: RPP/Modul Ajar, ATP, PROTA, PROSEM,
 * dan dokumen administratif lainnya.
 */
export default function RichMarkdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;
  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => (
        <RichBlock key={i} block={block} />
      ))}
    </div>
  );
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "quote"; text: string }
  | { type: "p"; text: string };

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const rawLines = content.split("\n");
  const lines = rawLines.map((l) => l.replace(/\r$/, ""));

  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flushList = () => {
    if (list) {
      blocks.push({ type: list.type, items: list.items });
      list = null;
    }
  };

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l.trim()) && l.trim().split("|").length >= 3;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushList();
      continue;
    }

    // Table
    if (isTableRow(line)) {
      flushList();
      const header = splitTableRow(line);
      const rows: string[][] = [];
      i++;
      // separator row (|---|) lalu baris-baris berikutnya
      while (i < lines.length && isTableRow(lines[i].trim())) {
        const row = splitTableRow(lines[i].trim());
        // skip separator like |---|---|
        if (/^[-:\s|]+$/.test(lines[i].trim())) {
          i++;
          continue;
        }
        rows.push(row);
        i++;
      }
      i--;
      blocks.push({ type: "table", header, rows });
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList();
      blocks.push({ type: "quote", text: line.slice(2) });
      continue;
    }

    // Bullet list
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    // Numbered list
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(numbered[2]);
      continue;
    }

    flushList();
    blocks.push({ type: "p", text: line });
  }
  flushList();
  return blocks;
}

function splitTableRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function RichBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      const styles: Record<number, string> = {
        1: "text-base font-bold text-gray-900 mt-1 border-b-2 border-gray-800 pb-1",
        2: "text-sm font-bold text-gray-900 mt-1 border-b border-gray-200 pb-1",
        3: "text-sm font-semibold text-gray-800",
        4: "text-xs font-semibold text-gray-700 uppercase tracking-wide",
      };
      return (
        <div className={styles[block.level] || styles[2]}>
          <InlineMarkdown text={block.text} />
        </div>
      );
    case "ul":
      return (
        <ul className="list-disc list-outside pl-5 space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="text-xs text-gray-700 leading-relaxed">
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal list-outside pl-5 space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="text-xs text-gray-700 leading-relaxed">
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                {block.header.map((h, i) => (
                  <th key={i} className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-800">
                    <InlineMarkdown text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-gray-200 px-3 py-2 text-gray-700 align-top">
                      <InlineMarkdown text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-gray-300 pl-3 py-0.5 text-xs text-gray-600 italic">
          <InlineMarkdown text={block.text} />
        </blockquote>
      );
    case "p":
    default:
      return (
        <p className="text-xs text-gray-700 leading-relaxed text-justify">
          <InlineMarkdown text={block.text} />
        </p>
      );
  }
}

function InlineMarkdown({ text }: { text: string }) {
  // Parse **bold**, *italic*, `code`, [link](url) secara berurutan
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let m: RegExpExecArray | null;
  let last = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**") && tok.endsWith("**")) {
      parts.push(
        <strong key={parts.length} className="font-semibold text-gray-900">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`") && tok.endsWith("`")) {
      parts.push(
        <code key={parts.length} className="px-1 py-0.5 rounded bg-gray-100 text-gray-800 font-mono text-[11px]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        parts.push(
          <a
            key={parts.length}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-indigo-600 hover:text-indigo-800"
          >
            {link[1]}
          </a>
        );
      } else {
        parts.push(tok);
      }
    } else if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      parts.push(
        <em key={parts.length} className="italic">
          {tok.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}