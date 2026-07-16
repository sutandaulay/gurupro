/**
 * Unit Tests for AI Validation Utilities
 * Run with: npx jest lib/ai/validation-utils.test.ts
 */

import { describe, test, expect } from 'vitest';
import { truncateText, truncateWords, stripMarkdown, enforceMaxItems, sanitizeForDocument } from './validation-utils';

describe('truncateText', () => {
  test('returns empty string for null/undefined', () => {
    expect(truncateText(null, 10)).toBe('');
    expect(truncateText(undefined, 10)).toBe('');
  });

  test('returns original text if shorter than maxLength', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('exactly10!', 10)).toBe('exactly10!');
  });

  test('truncates with ellipsis when exceeding maxLength', () => {
    const result = truncateText('This is a very long text', 15);
    expect(result).toMatch(/^This is a\.\.\.$/);
    expect(result.length).toBe(12);
  });

  test('preserves word boundaries', () => {
    const result = truncateText('Hello world foo', 14);
    expect(result).toBe('Hello world...');
  });

  test('respects custom ellipsis', () => {
    const result = truncateText('Some long text here', 10, '~~');
    expect(result).toBe('Some lon~~');
  });

  test('handles maxLength of 0', () => {
    expect(truncateText('text', 0)).toBe('');
    expect(truncateText('text', 0, '...')).toBe('');
  });
});

describe('truncateWords', () => {
  test('returns empty string for null/undefined', () => {
    expect(truncateWords(null, 5)).toBe('');
    expect(truncateWords(undefined, 5)).toBe('');
  });

  test('returns original if within word limit', () => {
    expect(truncateWords('one two three', 5)).toBe('one two three');
  });

  test('truncates to word limit', () => {
    const result = truncateWords('one two three four five six', 3);
    expect(result).toBe('one two three...');
  });
});

describe('stripMarkdown', () => {
  test('removes bold text', () => {
    expect(stripMarkdown('**bold text**')).toBe('bold text');
  });

  test('removes italic text', () => {
    expect(stripMarkdown('*italic text*')).toBe('italic text');
  });

  test('removes headings', () => {
    expect(stripMarkdown('# Heading 1')).toBe('Heading 1');
    expect(stripMarkdown('## Heading 2')).toBe('Heading 2');
  });

  test('removes code blocks', () => {
    expect(stripMarkdown('```code block```')).toBe('');
  });

  test('removes bullet points', () => {
    expect(stripMarkdown('- Item 1\n- Item 2')).toBe('Item 1\nItem 2');
  });

  test('handles complex input', () => {
    const input = '# heading\n**Bold** and *italic* with ```code```';
    const result = stripMarkdown(input);
    expect(result).not.toContain('**');
    expect(result).not.toContain('*');
    expect(result).not.toContain('#');
    expect(result).not.toContain('```');
  });
});

describe('enforceMaxItems', () => {
  test('returns empty array for non-array input', () => {
    expect(enforceMaxItems(null, 5)).toEqual([]);
    expect(enforceMaxItems(undefined, 5)).toEqual([]);
  });

  test('returns original array if within limit', () => {
    const arr = [1, 2, 3];
    expect(enforceMaxItems(arr, 5)).toEqual([1, 2, 3]);
  });

  test('truncates array to maxItems', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7];
    expect(enforceMaxItems(arr, 3)).toEqual([1, 2, 3]);
  });
});

describe('sanitizeForDocument', () => {
  test('removes markdown and control characters', () => {
    const input = '**Bold** with \x00control\x07 chars';
    const result = sanitizeForDocument(input);
    expect(result).toBe('Bold with control chars');
  });

  test('normalizes whitespace', () => {
    const input = 'Text    with   multiple   spaces';
    const result = sanitizeForDocument(input);
    expect(result).toBe('Text with multiple spaces');
  });
});
