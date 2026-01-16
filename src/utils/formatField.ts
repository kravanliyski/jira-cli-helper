import chalk from 'chalk';

interface WithName {
  name: string;
}
interface WithDisplayName {
  displayName: string;
}
interface WithKey {
  key: string;
  fields?: { summary: string };
}
interface WithValue {
  value: string;
}
interface TimeTracking {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
}

const isTimeTracking = (val: object): val is TimeTracking => {
  return (
    'originalEstimate' in val ||
    'timeSpent' in val ||
    'remainingEstimate' in val
  );
};

const hasName = (val: object): val is WithName => 'name' in val;
const hasDisplayName = (val: object): val is WithDisplayName =>
  'displayName' in val;
const hasKey = (val: object): val is WithKey => 'key' in val;
const hasValue = (val: object): val is WithValue => 'value' in val;

// --- Main Formatter ---
export const formatField = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  // 1. Strings & Numbers (Primitives)
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  // 2. Arrays (Recursively format items)
  if (Array.isArray(value)) {
    return value.map(formatField).join(', ');
  }

  // 3. Objects (Narrowing types safely)
  if (typeof value === 'object') {
    // Time Tracking
    if (isTimeTracking(value)) {
      const parts: string[] = [];
      if (value.originalEstimate)
        parts.push(`${chalk.gray('Est:')} ${value.originalEstimate}`);
      if (value.timeSpent)
        parts.push(`${chalk.blue('Spent:')} ${chalk.bold(value.timeSpent)}`);
      if (value.remainingEstimate)
        parts.push(`${chalk.yellow('Rem:')} ${value.remainingEstimate}`);
      return parts.join(chalk.gray(' | '));
    }

    // Common Jira Objects
    if (hasName(value)) return value.name; // Status, Priority
    if (hasDisplayName(value)) return value.displayName; // Assignee

    // Parent / Epic / Related (Complex Key+Summary)
    if (hasKey(value)) {
      return value.fields?.summary
        ? `${value.key} - ${value.fields.summary}`
        : value.key;
    }

    // Custom Field Dropdowns
    if (hasValue(value)) return value.value;
  }

  // 4. Fallback for unknown shapes
  return JSON.stringify(value);
};
