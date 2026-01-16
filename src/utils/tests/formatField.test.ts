import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import { formatField } from '../formatField.js'; // Adjust path if needed

describe('formatField', () => {
  // --- 1. Primitives & Empty Values ---
  describe('Primitives and Empty Values', () => {
    it('returns empty string for null', () => {
      expect(formatField(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatField(undefined)).toBe('');
    });

    it('returns string representation of numbers', () => {
      expect(formatField(123)).toBe('123');
      expect(formatField(0)).toBe('0');
    });

    it('returns strings as-is', () => {
      expect(formatField('Hello World')).toBe('Hello World');
    });
  });

  // --- 2. Arrays ---
  describe('Arrays', () => {
    it('joins simple arrays with a comma', () => {
      expect(formatField(['Apple', 'Banana'])).toBe('Apple, Banana');
    });

    it('recursively formats objects inside arrays', () => {
      const input = [{ name: 'To Do' }, { name: 'In Progress' }];
      expect(formatField(input)).toBe('To Do, In Progress');
    });

    it('handles mixed types in arrays', () => {
      const input = ['Version 1.0', { name: 'Beta' }, 123];
      expect(formatField(input)).toBe('Version 1.0, Beta, 123');
    });
  });

  // --- 3. Time Tracking (Highest Priority) ---
  describe('Time Tracking objects', () => {
    it('formats full time tracking object correctly with colors', () => {
      const input = {
        originalEstimate: '8h',
        timeSpent: '2h',
        remainingEstimate: '6h',
      };

      // We reconstruct the expected string using chalk to match exactly
      const expected = [
        `${chalk.gray('Est:')} 8h`,
        `${chalk.blue('Spent:')} ${chalk.bold('2h')}`,
        `${chalk.yellow('Rem:')} 6h`,
      ].join(chalk.gray(' | '));

      expect(formatField(input)).toBe(expected);
    });

    it('formats partial time tracking (only Spent)', () => {
      const input = { timeSpent: '30m' };
      const expected = `${chalk.blue('Spent:')} ${chalk.bold('30m')}`;
      expect(formatField(input)).toBe(expected);
    });

    it('formats partial time tracking (Est + Rem)', () => {
      const input = { originalEstimate: '1d', remainingEstimate: '4h' };

      const expected = [
        `${chalk.gray('Est:')} 1d`,
        `${chalk.yellow('Rem:')} 4h`,
      ].join(chalk.gray(' | '));

      expect(formatField(input)).toBe(expected);
    });

    // Priority Check: TimeTracking is checked before 'hasName'
    it('prioritizes TimeTracking formatting over "name" property', () => {
      const input = {
        name: 'Should Ignored',
        timeSpent: '1h',
      };
      // Should NOT return 'Should Ignored'
      expect(formatField(input)).toContain('Spent:');
    });
  });

  // --- 4. Common Jira Objects ---
  describe('Common Jira Objects', () => {
    it('extracts "name" (Status, Priority, Resolution)', () => {
      expect(formatField({ name: 'In Progress' })).toBe('In Progress');
    });

    it('extracts "displayName" (Users/Assignees)', () => {
      expect(formatField({ displayName: 'John Doe' })).toBe('John Doe');
    });

    it('extracts "value" (Custom Field Dropdowns)', () => {
      expect(formatField({ value: 'High Impact' })).toBe('High Impact');
    });
  });

  // --- 5. Complex Keys (Parent/Epic) ---
  describe('Key & Summary Objects', () => {
    it('returns "Key - Summary" if both exist', () => {
      const input = {
        key: 'PROJ-123',
        fields: { summary: 'Login Bug' },
      };
      expect(formatField(input)).toBe('PROJ-123 - Login Bug');
    });

    it('returns only "Key" if fields/summary is missing', () => {
      const input = { key: 'PROJ-123' };
      expect(formatField(input)).toBe('PROJ-123');
    });

    it('handles empty fields object gracefully', () => {
      const input = { key: 'PROJ-123', fields: {} };
      expect(formatField(input)).toBe('PROJ-123');
    });
  });

  // --- 6. Fallback ---
  describe('Fallback', () => {
    it('stringifies unknown objects', () => {
      const input = { random: 'data', foo: 'bar' };
      expect(formatField(input)).toBe('{"random":"data","foo":"bar"}');
    });

    it('stringifies empty objects', () => {
      expect(formatField({})).toBe('{}');
    });
  });
});
