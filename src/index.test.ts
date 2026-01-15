import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import {
  extractText,
  formatTime,
  getIssueKeyFromBranch,
  getStartDate,
  resolveKey,
} from './utils.js';

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

describe('formatTime() - Jira Style', () => {
  it('should format 1 hour correctly', () => {
    expect(formatTime(3600)).toBe('1h');
  });

  it('should convert 8 hours to 1 day', () => {
    expect(formatTime(28800)).toBe('1d');
  });

  it('should convert 40 hours to 1 week', () => {
    expect(formatTime(144000)).toBe('1w');
  });

  it('should handle complex combinations', () => {
    // 1w (144000) + 1d (28800) + 1h (3600) + 30m (1800) = 178200
    expect(formatTime(178200)).toBe('1w 1d 1h 30m');
  });
});

describe('getStartDate', () => {
  beforeEach(() => {
    // Lock the "current time" to Monday, May 12, 2025
    // This allows us to predict the "start of week" and "start of month" exactly.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-12T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the start of today (midnight) when no options are provided', () => {
    const result = getStartDate({});

    // Check that hours are zeroed out in LOCAL time
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);

    // Check that the date matches the mocked 'today'
    const expectedDate = new Date('2025-05-12T10:00:00Z');
    expect(result.getDate()).toBe(expectedDate.getDate());
    expect(result.getMonth()).toBe(expectedDate.getMonth());
  });

  it('should return the first day of the current month when month option is true', () => {
    const result = getStartDate({ month: true });
    // May 1st, 2025
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(4); // May is index 4
    expect(result.getDate()).toBe(1);
  });

  it('should return the most recent Monday when week option is true', () => {
    // Our fake system time is already a Monday (May 12)
    const result = getStartDate({ week: true });
    expect(result.getDate()).toBe(12);
    expect(result.getDay()).toBe(1); // 1 = Monday
  });

  it('should correctly find Monday if today is Sunday', () => {
    // Set time to Sunday, May 18, 2025
    vi.setSystemTime(new Date('2025-05-18T10:00:00Z'));

    const result = getStartDate({ week: true });
    // Should go back to Monday, May 12
    expect(result.getDate()).toBe(12);
    expect(result.getMonth()).toBe(4);
  });
});
