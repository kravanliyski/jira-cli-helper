import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { extractText, getIssueKeyFromBranch, resolveKey } from './utils.js';

// Mocking External Dependencies
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('Jira CLI Core Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getIssueKeyFromBranch', () => {
    it('should extract key from a standard feature branch', () => {
      vi.mocked(execSync).mockReturnValue(
        Buffer.from('feature/AD-62-daily-sync'),
      );
      const key = getIssueKeyFromBranch();
      expect(key).toBe('AD-62');
    });

    it('should return null if no ticket pattern is found', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('main'));
      const key = getIssueKeyFromBranch();
      expect(key).toBeNull();
    });

    it('should return null if git command fails (not a repo)', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      const key = getIssueKeyFromBranch();
      expect(key).toBeNull();
    });
  });

  describe('resolveKey', () => {
    it('should use manual input if it matches Jira pattern', () => {
      const result = resolveKey('PROJ-123');
      expect(result).toBe('PROJ-123');
    });

    it('should fallback to git branch when no input is provided', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('feature/PROJ-99'));
      const result = resolveKey();
      expect(result).toBe('PROJ-99');
    });

    it('should throw error if no input and no git branch found', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('master'));
      expect(() => resolveKey()).toThrow('Could not detect Issue Key');
    });
  });
});

describe('extractText()', () => {
  it('should return a plain string as is', () => {
    expect(extractText('Hello world')).toBe('Hello world');
  });

  it('should handle null or undefined gracefully', () => {
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
  });

  it('should extract text from a simple ADF node', () => {
    const node = {
      type: 'text',
      text: 'Simple comment',
    };
    expect(extractText(node)).toBe('Simple comment');
  });

  it('should recursively extract text from nested content (ADF structure)', () => {
    const complexNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'World!' },
          ],
        },
      ],
    };
    expect(extractText(complexNode)).toBe('Hello World!');
  });

  it('should handle deeply nested structures', () => {
    const deeplyNested = {
      content: [
        {
          content: [{ text: 'Deep' }, { text: ' ' }, { text: 'Logic' }],
        },
      ],
    };
    expect(extractText(deeplyNested)).toBe('Deep Logic');
  });
});
