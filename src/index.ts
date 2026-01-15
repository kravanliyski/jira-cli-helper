import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import open from 'open';
import {
  getAffectedFieldId,
  getAliases,
  getCreds,
  removeAlias,
  saveAlias,
  saveCreds,
  setAffectedFieldId,
} from './config.js';
import { getJiraClient } from './jiraClient.js';
import { Version3Models } from 'jira.js';
import {
  calculateTotalSeconds,
  extractText,
  formatTime,
  resolveKey,
} from './utils.js';

const program = new Command();

program.version('1.0.0').description('Jira CLI Helper');

// --- TYPES ---
interface JiraError {
  message?: string;
  response?: {
    data?: string | object;
  };
}

const DEFAULT_ALIASES: Record<string, string> = {
  todo: 'To Do',
  progress: 'In Progress',
  review: 'Code Review',
  cr: 'Code Review',
  done: 'Done',
};

// --- 1. SETUP COMMAND ---
program
  .command('setup')
  .description('Configure your Jira credentials')
  .action(async () => {
    console.log(chalk.blue('👋 Welcome to Jira CLI Setup!'));
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'jiraUrl',
        message: 'Jira Base URL (e.g. https://company.atlassian.net):',
        validate: (input: string) =>
          input.includes('http') ? true : 'Valid URL required',
      },
      { type: 'input', name: 'email', message: 'Your Jira Email Address:' },
      {
        type: 'confirm',
        name: 'openBrowser',
        message: 'Generate API Token?',
        default: false,
      },
    ]);

    if (answers.openBrowser) {
      await open('https://id.atlassian.com/manage-profile/security/api-tokens');
    }

    const tokenAnswer = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiToken',
        message: 'Paste API Token:',
        mask: '*',
      },
    ]);

    saveCreds({
      jiraUrl: answers.jiraUrl,
      email: answers.email,
      apiToken: tokenAnswer.apiToken,
    });
    console.log(chalk.green('\n✅ Credentials saved.'));
  });

// --- 2. INFO COMMAND ---
program
  .command('info [issueKey]')
  .alias('i')
  .description('Get info about a ticket')
  .action(async (issueKey: string) => {
    try {
      const finalKey = resolveKey(issueKey);
      const client = getJiraClient();
      const issue = await client.issues.getIssue({ issueIdOrKey: finalKey });

      console.log(chalk.green(`\nFound issue: ${issue.key}`));
      console.log(chalk.bold(issue.fields.summary));
      console.log(`Status: [${issue.fields.status.name}]`);
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(
        chalk.red('Error:'),
        err.message || JSON.stringify(err?.response?.data),
      );
    }
  });

// --- 3. OPTIONS COMMAND ---
program
  .command('options [issueKey]')
  .alias('opt')
  .description('List all available transitions')
  .action(async (issueKey: string) => {
    try {
      const finalKey = resolveKey(issueKey);
      const client = getJiraClient();
      console.log(chalk.blue(`Fetching options for ${finalKey}...`));

      const { transitions } = await client.issues.getTransitions({
        issueIdOrKey: finalKey,
      });

      if (!transitions || transitions.length === 0) {
        console.log(chalk.yellow('No transitions available.'));
        return;
      }
      transitions.forEach((t) => {
        console.log(
          `- ${chalk.bold(t.name)} ${chalk.dim(`(Moves to: ${t.to?.name})`)}`,
        );
      });
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(chalk.red('Error:'), err.message);
    }
  });

// --- 4. LOG WORK COMMAND ---
program
  .command('log [arg1] [arg2]')
  .alias('l')
  .description('Log work (usage: jira l 30m OR jira l PROJ-123 30m)')
  .option('-c, --comment <comment>', 'Worklog comment')
  .action(async (arg1: string, arg2: string, options: { comment?: string }) => {
    try {
      let finalKey: string;
      let timeSpent: string;

      if (arg1 && arg1.match(/[A-Z]+-\d+/i)) {
        finalKey = resolveKey(arg1);
        timeSpent = arg2;
      } else {
        finalKey = resolveKey();
        timeSpent = arg1;
      }

      if (!timeSpent)
        throw new Error('Time spent is required (e.g. "30m", "1h")');

      const client = getJiraClient();
      console.log(chalk.blue(`Logging ${timeSpent} to ${finalKey}...`));

      await client.issueWorklogs.addWorklog({
        issueIdOrKey: finalKey,
        timeSpent: timeSpent,
        comment: options.comment,
      });

      console.log(chalk.green('Success! Time logged.'));
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(chalk.red('Error:'), err.message);
    }
  });

// --- 5. UPDATE COMPONENT COMMAND ---
program
  .command('update [issueKey]')
  .alias('u')
  .description('Update issue component')
  .option('--component <name>', 'Name of the component')
  .action(async (issueKey: string, options: { component?: string }) => {
    try {
      const finalKey = resolveKey(issueKey);

      if (!options.component) {
        console.log(
          chalk.yellow('Please specify a component with --component "Name"'),
        );
        return;
      }

      const client = getJiraClient();
      await client.issues.editIssue({
        issueIdOrKey: finalKey,
        fields: { components: [{ name: options.component }] },
      });
      console.log(chalk.green(`Updated ${finalKey} successfully.`));
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(
        chalk.red('Update failed:'),
        err.message || JSON.stringify(err?.response?.data),
      );
    }
  });

// --- 6. STATUS COMMAND (Smart Git Support) ---
program
  .command('status [arg1] [arg2]')
  .alias('s')
  .description('Move ticket (usage: jira s review OR jira s PROJ-123 review)')
  .option('-c, --component <name>', 'Set Affected Area')
  .action(
    async (arg1: string, arg2: string, _options: { component?: string }) => {
      const client = getJiraClient();
      const userAliases = getAliases();
      const aliases = { ...DEFAULT_ALIASES, ...userAliases };

      let finalKey: string;
      let targetStatus: string;

      try {
        if (arg1 && arg1.match(/[A-Z]+-\d+/i)) {
          finalKey = arg1.toUpperCase();
          targetStatus = arg2;
        } else {
          finalKey = resolveKey();
          targetStatus = arg1;
        }

        if (!targetStatus) throw new Error('Target status is required.');
      } catch (e: unknown) {
        const err = e as JiraError;
        console.error(chalk.red(err.message));
        return;
      }

      const searchStatus = aliases[targetStatus] || targetStatus;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const findMatch = (transitions: any[], term: string) => {
        return transitions.find((t) => {
          const name = t.name?.toLowerCase() || '';
          const toName = t.to?.name?.toLowerCase() || '';
          return (
            name.includes(term.toLowerCase()) ||
            toName.includes(term.toLowerCase())
          );
        });
      };

      try {
        const { transitions } = await client.issues.getTransitions({
          issueIdOrKey: finalKey,
        });
        if (!transitions || transitions.length === 0)
          throw new Error('No transitions found or ticket is closed.');

        const match = findMatch(transitions, searchStatus);

        if (!match || !match.id) {
          console.log(
            chalk.yellow(
              `Transition "${searchStatus}" not found for ${finalKey}.`,
            ),
          );
          console.log(chalk.dim('Available options:'));
          transitions.forEach((t) => console.log(` - ${t.name}`));
          return;
        }

        console.log(
          chalk.dim(`Attempting move: ${match.name} on ${finalKey}...`),
        );

        try {
          await client.issues.doTransition({
            issueIdOrKey: finalKey,
            transition: { id: match.id },
          });
          const issueEnd = await client.issues.getIssue({
            issueIdOrKey: finalKey,
            fields: ['status'],
          });
          console.log(
            chalk.green(
              `✅ Success! Moved to [${issueEnd.fields.status.name}].`,
            ),
          );
          return;
        } catch (_e) {
          // Fall through to rescue mode
        }

        console.log(
          chalk.yellow('\n⚠️  Transition failed. Entering Rescue Mode...'),
        );

        const projectKey = finalKey.split('-')[0];
        const projectComponents =
          await client.projectComponents.getProjectComponents({
            projectIdOrKey: projectKey,
          });

        const componentChoices = projectComponents.map(
          (c: Version3Models.Component) => c.name || 'Unnamed',
        );

        componentChoices.unshift('[Manual Text Entry]');

        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'component',
            message: 'Select Affected Area:',
            choices: componentChoices,
          },
        ]);

        let finalValue = answer.component;
        if (finalValue === '[Manual Text Entry]') {
          const text = await inquirer.prompt([
            { type: 'input', name: 'val', message: 'Enter text:' },
          ]);
          finalValue = text.val;
        }

        const customFieldId = getAffectedFieldId() || 'components';
        const adfPayload = {
          version: 1,
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: finalValue }],
            },
          ],
        };

        const editPayloads = [
          { [customFieldId]: adfPayload },
          { [customFieldId]: finalValue },
          { [customFieldId]: [{ value: finalValue }] },
          { [customFieldId]: { value: finalValue } },
        ];

        if (customFieldId === 'components') {
          editPayloads.length = 0;
          editPayloads.push({ components: [{ name: finalValue }] });
        }

        let updateSuccess = false;
        for (const fields of editPayloads) {
          try {
            await client.issues.editIssue({ issueIdOrKey: finalKey, fields });
            updateSuccess = true;
            console.log(chalk.green(`  ✔ Field updated.`));
            break;
          } catch (_e) {
            // Attempting next payload format
          }
        }

        if (updateSuccess) {
          await client.issues.doTransition({
            issueIdOrKey: finalKey,
            transition: { id: match.id },
          });
          console.log(chalk.green(`✅ Success! Ticket moved.`));
        } else {
          console.log(chalk.red('❌ Failed to update field.'));
        }
      } catch (error: unknown) {
        const err = error as JiraError;
        console.error(
          chalk.red('Error:'),
          err.message || JSON.stringify(err?.response?.data),
        );
      }
    },
  );

// --- 7. ALIAS COMMANDS (Grouped Correctly) ---
const aliasCmd = program
  .command('alias')
  .description('Manage transition shortcuts');

aliasCmd.command('add <short> <long>').action((s: string, l: string) => {
  saveAlias(s, l);
  console.log('✅ Alias saved.');
});

aliasCmd.command('ls').action(() => {
  const aliases = getAliases();
  console.log(chalk.blue('Shortcuts:'), aliases);
});

aliasCmd.command('rm <short>').action((s: string) => {
  removeAlias(s);
  console.log('🗑️ Removed.');
});

// --- 8. UTILS ---
program.command('config-field <id>').action((id: string) => {
  setAffectedFieldId(id);
  console.log('✅ Field ID saved.');
});

// --- SCAN COMMAND ---
program
  .command('scan <keyword>')
  .description('Find field IDs')
  .action(async (keyword: string) => {
    try {
      const client = getJiraClient();
      console.log(chalk.blue(`Scanning for "${keyword}"...`));

      const fields = await client.issueFields.getFields();

      const matches = fields.filter(
        (f) => f.name && f.name.toLowerCase().includes(keyword.toLowerCase()),
      );

      matches.forEach((f) =>
        console.log(`${f.name} -> ID: ${f.id} (${f.schema?.type})`),
      );
    } catch (e: unknown) {
      console.error(e);
    }
  });

// --- 9. REPORT COMMAND ---
program
  .command('report')
  .alias('r')
  .description('Show hours logged (Default: Today. Use -m for Month)')
  .option('-m, --month', 'Show stats for the current month')
  .action(async (options: { month?: boolean }) => {
    try {
      const client = getJiraClient();
      const myself = await client.myself.getCurrentUser();
      const myAccountId = myself.accountId;

      // Ensure we have an ID to compare against
      if (!myAccountId) {
        throw new Error('Could not retrieve your Jira Account ID.');
      }

      const now = new Date();
      const mode = options.month ? 'Month' : 'Today';

      // Determine Start Date
      const startDate = options.month
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const jqlDate = startDate.toISOString().split('T')[0];

      console.log(chalk.blue(`Fetching worklogs for [${mode}]...`));

      const search =
        await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
          jql: `worklogAuthor = currentUser() AND worklogDate >= "${jqlDate}"`,
          fields: ['worklog'],
          maxResults: 100,
        });

      if (!search.issues || search.issues.length === 0) {
        console.log(chalk.yellow(`No worklogs found for ${mode}.`));
        return;
      }

      let totalSeconds = 0;

      await Promise.all(
        (search.issues || []).map(async (issue: Version3Models.Issue) => {
          let logs: Version3Models.Worklog[] =
            issue.fields.worklog?.worklogs || [];
          const totalLogs = issue.fields.worklog?.total || 0;

          // Fetch full logs if paginated
          if (totalLogs > logs.length && issue.id) {
            const fullLogReq = await client.issueWorklogs.getIssueWorklog({
              issueIdOrKey: issue.id,
            });
            logs = fullLogReq.worklogs || [];
          }

          totalSeconds += calculateTotalSeconds(logs, myAccountId, startDate);
        }),
      );

      console.log(
        chalk.bold(
          `\n⏱️  Total [${mode}]: ${chalk.green(formatTime(totalSeconds))}`,
        ),
      );
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(chalk.red('Error generating report:'), err.message || err);
    }
  });

// --- 10. WORKLOGS COMMAND ---
program
  .command('worklogs [issueKey]')
  .alias('wl')
  .description('List all worklogs for a specific ticket')
  .action(async (issueKey: string) => {
    try {
      const finalKey = resolveKey(issueKey);
      const client = getJiraClient();

      console.log(chalk.blue(`Fetching history for ${finalKey}...`));

      const response = await client.issueWorklogs.getIssueWorklog({
        issueIdOrKey: finalKey,
      });

      const logs = response.worklogs || [];

      if (logs.length === 0) {
        console.log(chalk.yellow(`No worklogs found for ${finalKey}.`));
        return;
      }

      console.log(chalk.bold(`\n⏱️  Time History for ${finalKey}`));
      console.log(chalk.dim('-'.repeat(80)));
      console.log(
        chalk.dim('Date       | Time    | Author          | Description'),
      );
      console.log(chalk.dim('-'.repeat(80)));

      let totalSeconds = 0;

      logs.forEach((log: Version3Models.Worklog) => {
        // 1. Handle Date
        const date = log.started
          ? new Date(log.started).toISOString().split('T')[0]
          : 'Unknown   ';

        // 2. Handle metadata
        const author = (log.author?.displayName || 'Unknown').substring(0, 15);
        const time = log.timeSpent || '0m';

        // 3. Use shared extractText utility
        let desc = extractText(log.comment).trim();
        desc = desc.replace(/\n/g, ' ');
        if (desc.length > 40) desc = desc.substring(0, 37) + '...';

        totalSeconds += log.timeSpentSeconds || 0;

        console.log(
          `${chalk.gray(date)} | ` +
            `${chalk.cyan(time.padEnd(7))} | ` +
            `${chalk.magenta(author.padEnd(15))} | ` +
            `${desc}`,
        );
      });

      console.log(chalk.dim('-'.repeat(80)));
      console.log(`Total: ${chalk.green.bold(formatTime(totalSeconds))}`);
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(chalk.red('Error:'), err.message || err);
    }
  });

// --- 11. COMMENT COMMAND ---
program
  .command('comment [arg1] [arg2]')
  .alias('c')
  .description('Add a comment to a ticket')
  .action(async (arg1: string, arg2: string) => {
    try {
      let finalKey: string;
      let commentText: string;

      if (arg1 && arg1.match(/[A-Z]+-\d+/i)) {
        finalKey = resolveKey(arg1);
        commentText = arg2;
      } else {
        finalKey = resolveKey();
        commentText = arg1;
      }

      if (!commentText) {
        const answer = await inquirer.prompt([
          { type: 'input', name: 'text', message: 'Enter your comment:' },
        ]);
        commentText = answer.text;
      }

      if (!commentText) return;

      const client = getJiraClient();
      console.log(chalk.blue(`Adding comment to ${finalKey}...`));

      const linkify = (text: string) => {
        const parts = text.split(/(https?:\/\/[^\s]+)/g);
        return parts
          .map((part) => {
            if (part.match(/^https?:\/\//)) {
              return {
                type: 'text',
                text: part,
                marks: [{ type: 'link', attrs: { href: part } }],
              };
            }
            return { type: 'text', text: part };
          })
          .filter((p) => p.text);
      };

      const adfBody = {
        version: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: linkify(commentText) }],
      };

      const updatePayload: Version3Models.IssueUpdateDetails = {
        update: {
          comment: [
            {
              add: {
                body: adfBody,
              },
            },
          ],
        },
      };

      await client.issues.editIssue({
        issueIdOrKey: finalKey,
        ...updatePayload,
      });

      console.log(chalk.green(`✅ Comment added successfully!`));
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(
        chalk.red('Error:'),
        err.message || JSON.stringify(err?.response?.data),
      );
    }
  });

program
  .command('open [issueKey]')
  .alias('o')
  .description('Open ticket in browser')
  .action(async (issueKey: string) => {
    try {
      const finalKey = resolveKey(issueKey);
      const creds = getCreds();

      if (!creds || !creds.jiraUrl) {
        console.log(chalk.red('Jira URL not configured. Run "jira setup".'));
        return;
      }

      const baseUrl = creds.jiraUrl.replace(/\/$/, '');
      const url = `${baseUrl}/browse/${finalKey}`;

      console.log(chalk.blue(`Opening ${chalk.bold(finalKey)} in browser...`));
      await open(url);
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(chalk.red('Error:'), err.message);
    }
  });

// --- 13. MINE COMMAND ---
program
  .command('mine')
  .alias('m')
  .description('List open tasks assigned to me')
  .action(async () => {
    try {
      const client = getJiraClient();
      console.log(chalk.blue('🔍 Fetching your open tasks...'));

      const jql =
        'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';

      const search =
        await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
          jql: jql,
          fields: ['summary', 'status', 'priority'],
          maxResults: 15,
        });

      if (!search.issues || search.issues.length === 0) {
        console.log(chalk.yellow('🎉 No open tasks assigned to you!'));
        return;
      }

      console.log(chalk.bold(`\n📋 My Open Tasks (${search.issues.length})`));
      console.log(chalk.dim('-'.repeat(80)));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search.issues.forEach((issue: any) => {
        const key = chalk.bold.cyan(issue.key.padEnd(12));
        const status = `[${issue.fields.status.name}]`;

        let statusColor = chalk.white;
        const sName = issue.fields.status.name.toLowerCase();
        if (sName.includes('progress')) statusColor = chalk.yellow;
        if (sName.includes('review')) statusColor = chalk.magenta;
        if (sName.includes('todo') || sName.includes('open'))
          statusColor = chalk.blue;

        console.log(
          `${key} ${statusColor(status.padEnd(18))} ${issue.fields.summary}`,
        );
      });
      console.log(chalk.dim('-'.repeat(80)));
    } catch (error: unknown) {
      const err = error as JiraError;
      console.error(chalk.red('Error:'), err.message);
    }
  });

program.parse(process.argv);
