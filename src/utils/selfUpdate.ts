import { fileURLToPath } from 'url';
import path from 'node:path';
import chalk from 'chalk';
import { execSync } from 'child_process';

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
