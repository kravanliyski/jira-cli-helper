import { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { selfUpdate } from '../selfUpdate.js';

// Mock child_process so we don't actually run git/npm commands
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('selfUpdate()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call git pull and npm install (which triggers build)', () => {
    selfUpdate();

    // 1. Verify git pull
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      'git pull origin main',
      expect.objectContaining({ stdio: 'inherit' }),
    );

    // 2. Verify npm install (this handles dependencies AND building via 'prepare')
    expect(execSync).toHaveBeenNthCalledWith(
      2,
      'npm install',
      expect.objectContaining({ stdio: 'inherit' }),
    );

    // 3. Confirm only 2 calls were made total
    expect(execSync).toHaveBeenCalledTimes(2);
  });

  it('should throw an error if a command fails', () => {
    // Cast to Mock to access vitest-specific methods safely
    (execSync as Mock).mockImplementationOnce(() => {
      throw new Error('Git conflict');
    });

    expect(() => selfUpdate()).toThrow('Update failed: Git conflict');
  });
});
