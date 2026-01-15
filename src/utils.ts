import { execSync } from 'child_process';
import chalk from 'chalk';
import { Version3Models } from 'jira.js';

// --- HELPER: Detect Ticket from Git Branch ---
export const getIssueKeyFromBranch = (): string | null => {
  try {
    const branchName = execSync('git rev-parse --abbrev-ref HEAD', {
      stdio: 'pipe',
    })
      .toString()
      .trim();
    const match = branchName.match(/([A-Z]+-\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (_e) {
    // Not a git repo - ignore error
  }
  return null;
};

// --- HELPER: Resolve Key (User Input vs Git) ---
export const resolveKey = (userInput?: string): string => {
  if (userInput && userInput.match(/[A-Z]+-\d+/i)) {
    return userInput.toUpperCase();
  }
  const gitKey = getIssueKeyFromBranch();
  if (gitKey) {
    console.log(
      chalk.dim(`🎯 Detected ticket from branch: ${chalk.bold(gitKey)}`),
    );
    return gitKey;
  }
  throw new Error(
    'Could not detect Issue Key. Please provide it explicitly (e.g. "TASK-123") or run inside a Git branch.',
  );
};

/**
 * Helper to extract clean text from Jira's complex Rich Text (ADF) structure.
 * It recursively traverses the document nodes to build a single string.
 */
export const extractText = (node: unknown): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;

  const n = node as Record<string, unknown>;

  if (typeof n.text === 'string') return n.text;

  if (Array.isArray(n.content)) {
    // Change .join(' ') to .join('')
    return n.content.map(extractText).join('');
  }
  return '';
};

// Helper function we want to test (you should export this in your code)
export const calculateTotalSeconds = (
  logs: Version3Models.Worklog[],
  myAccountId: string,
  startDate: Date,
): number => {
  let total = 0;
  logs.forEach((log) => {
    if (log.author?.accountId !== myAccountId) return;
    if (log.started) {
      const logDate = new Date(log.started);
      if (logDate >= startDate) {
        total += log.timeSpentSeconds || 0;
      }
    }
  });
  return total;
};

export const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};
