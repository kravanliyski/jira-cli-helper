import { execSync } from 'child_process';
import chalk from 'chalk';
import { Version3Models } from 'jira.js';
import path from 'path';
import { fileURLToPath } from 'url';

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
    return n.content.map(extractText)
        .join('');
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

export const formatTime = (seconds: number): string => {
  const totalMinutes = Math.floor(seconds / 60);
  const m = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);

  // Jira standard: 8h = 1d, 5d = 1w
  const totalDays = Math.floor(totalHours / 8);
  const w = Math.floor(totalDays / 5);
  const d = totalDays % 5;
  const h = totalHours % 8;

  const parts = [];
  if (w > 0) parts.push(`${w}w`);
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);

  return parts.join(' ');
};

export const getStartDate = (options: {
  month?: boolean;
  week?: boolean;
}): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Normalize to start of day

  if (options.month) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (options.week) {
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - daysFromMonday,
    );
  }

  return now;
};

export const selfUpdate = (): void => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..');

  try {
    const options = { cwd: rootDir, stdio: 'inherit' as const };

    console.log(chalk.blue('Checking for updates...'));
    execSync('git pull origin main', options);

    console.log(chalk.blue('Installing dependencies & rebuilding...'));
    // npm install triggers 'prepare' which runs build,
    // so we don't need a separate build call unless npm install does nothing.
    execSync('npm install', options);

    console.log(chalk.green.bold('\n✅ Update complete!'));
  } catch (error) {
    throw new Error(
      `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
