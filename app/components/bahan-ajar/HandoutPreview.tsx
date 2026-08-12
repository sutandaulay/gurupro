/**
 * HandoutPreview Component
 *
 * Visual preview untuk handout - menampilkan teks terformat dengan rapi
 */

"use client";

import { IconRefresh, IconDownload, IconFileText } from "@tabler/icons-react";

interface HandoutPreviewProps {
  handout?: string | null;
  isLoading?: boolean;
  onRegenerate?: () => void;
  onExport?: () => void;
  isRegenerating?: boolean;
}

export default function HandoutPreview({
  handout,
  isLoading = false,
  onRegenerate,
  onExport,
  isRegenerating = false,
}: HandoutPreviewProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-20 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-4/5" />
      </div>
    );
  }

  if (!handout) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconFileText size={32} className="text-gray-400" />
        </div>
        <p className="text-gray-500 text-sm">Handout belum tersedia</p>
        <p className="text-gray-400 text-xs mt-1">
          Hasilkan handout untuk melihat preview
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">Handout</p>
          <p className="text-xs text-gray-500">
            Bahan ajar cetak untuk peserta didik
          </p>
        </div>
        <div className="flex gap-2">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                  Regenerate...
                </>
              ) : (
                <>
                  <IconRefresh size={14} />
                  Regenerate
                </>
              )}
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <IconDownload size={14} />
              Export Word
            </button>
          )}
        </div>
      </div>

      {/* Handout Content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <HandoutContent content={handout} />
      </div>
    </div>
  );
}

// ============================================
// HandoutContent Component
// ============================================

interface HandoutContentProps {
  content: string;
}

function HandoutContent({ content }: HandoutContentProps) {
  // Parse and render the handout content
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listStack: { type: "ul" | "ol"; items: React.ReactNode[] }[] = [];

  const flushList = () => {
    for (const list of listStack) {
      if (list.type === "ol") {
        blocks.push(
          <ol key={blocks.length} className="list-decimal list-inside space-y-1 ml-1">
            {list.items}
          </ol>
        );
      } else {
        blocks.push(
          <ul key={blocks.length} className="list-disc list-inside space-y-1 ml-1">
            {list.items}
          </ul>
        );
      }
    }
    listStack = [];
  };

  const renderBlock = (index: number, trimmed: string) => {
    // Heading 1
    if (trimmed.startsWith("# ")) {
      return (
        <h1
          key={index}
          className="text-lg font-bold text-gray-900 mt-5 mb-2 pb-1 border-b-2 border-gray-800"
        >
          {renderFormattedText(trimmed.slice(2))}
        </h1>
      );
    }

    // Heading 2
    if (trimmed.startsWith("## ")) {
      return (
        <h2
          key={index}
          className="text-base font-bold text-gray-800 mt-4 mb-1"
        >
          {renderFormattedText(trimmed.slice(3))}
        </h2>
      );
    }

    // Heading 3
    if (trimmed.startsWith("### ")) {
      return (
        <h3
          key={index}
          className="text-sm font-semibold text-gray-700 mt-3 mb-1"
        >
          {renderFormattedText(trimmed.slice(4))}
        </h3>
      );
    }

    // Unordered list item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listStack.push({
        type: "ul",
        items: [
          <li key={index} className="text-sm text-gray-700 leading-relaxed">
            {renderFormattedText(trimmed.slice(2))}
          </li>,
        ],
      });
      return null;
    }

    // Ordered list item
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.+)$/);
      if (match) {
        listStack.push({
          type: "ol",
          items: [
            <li key={index} className="text-sm text-gray-700 leading-relaxed">
              {renderFormattedText(match[2])}
            </li>,
          ],
        });
        return null;
      }
    }

    // Regular paragraph (justify)
    return (
      <p key={index} className="text-sm text-gray-700 leading-relaxed text-justify">
        {renderFormattedText(trimmed)}
      </p>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Empty line — flush current list, add spacing
    if (!trimmed) {
      flushList();
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    const block = renderBlock(i, trimmed);
    if (block !== null) blocks.push(block);
  }
  flushList();

  return <div className="space-y-1">{blocks}</div>;
}

// ============================================
// renderFormattedText
// Render text with bold and italic formatting
// ============================================

function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let currentIndex = 0;

  // Match **bold** and *italic* patterns
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(text.slice(currentIndex, match.index));
    }

    const matched = match[0];
    if (matched.startsWith("**") && matched.endsWith("**")) {
      // Bold text
      parts.push(
        <strong key={match.index} className="font-semibold">
          {matched.slice(2, -2)}
        </strong>
      );
    } else if (matched.startsWith("*") && matched.endsWith("*")) {
      // Italic text
      parts.push(
        <em key={match.index} className="italic">
          {matched.slice(1, -1)}
        </em>
      );
    }

    currentIndex = match.index + matched.length;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.slice(currentIndex));
  }

  return parts.length > 0 ? parts : text;
}
