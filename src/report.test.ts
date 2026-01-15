import { describe, it, expect } from 'vitest';
import { Version3Models } from 'jira.js';
import { calculateTotalSeconds, formatTime } from './utils.js';

describe('Time Reporting Logic', () => {
  const myId = 'user-123';
  const today = new Date('2026-01-15T00:00:00Z');

  it('should sum seconds only for the current user', () => {
    const mockLogs: Version3Models.Worklog[] = [
      {
        author: { accountId: 'user-123' },
        timeSpentSeconds: 3600, // 1h
        started: '2026-01-15T10:00:00Z',
      },
      {
        author: { accountId: 'other-user' },
        timeSpentSeconds: 1800,
        started: '2026-01-15T11:00:00Z',
      },
    ];

    const total = calculateTotalSeconds(mockLogs, myId, today);
    expect(total).toBe(3600);
    expect(formatTime(total)).toBe('1h 0m');
  });

  it('should ignore logs from before the start date', () => {
    const mockLogs: Version3Models.Worklog[] = [
      {
        author: { accountId: 'user-123' },
        timeSpentSeconds: 3600,
        started: '2026-01-14T10:00:00Z', // Yesterday
      },
    ];

    const total = calculateTotalSeconds(mockLogs, myId, today);
    expect(total).toBe(0);
  });

  it('should correctly format complex totals (e.g., 90 minutes)', () => {
    expect(formatTime(5400)).toBe('1h 30m');
    expect(formatTime(450)).toBe('0h 7m');
  });
});
