import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import open from 'open';
import { execSync } from 'child_process';
import {
    saveCreds,
    getAliases,
    removeAlias,
    saveAlias,
    setAffectedFieldId,
    getAffectedFieldId, getCreds
} from './config.js';
import { getJiraClient } from './jiraClient.js';

const program = new Command();

program
    .version('1.0.0')
    .description('Jira CLI Helper');

const DEFAULT_ALIASES: Record<string, string> = {
    'todo': 'To Do',
    'progress': 'In Progress',
    'review': 'Code Review',
    'cr': 'Code Review',
    'done': 'Done'
};

// --- HELPER: Detect Ticket from Git Branch ---
const getIssueKeyFromBranch = (): string | null => {
    try {
        const branchName = execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' })
            .toString()
            .trim();
        const match = branchName.match(/([A-Z]+-\d+)/);
        if (match && match[1]) {
            return match[1];
        }
    } catch (e) {
        // Not a git repo
    }
    return null;
};

// --- HELPER: Resolve Key (User Input vs Git) ---
const resolveKey = (userInput?: string): string => {
    if (userInput && userInput.match(/[A-Z]+-\d+/i)) {
        return userInput.toUpperCase();
    }
    const gitKey = getIssueKeyFromBranch();
    if (gitKey) {
        console.log(chalk.dim(`🎯 Detected ticket from branch: ${chalk.bold(gitKey)}`));
        return gitKey;
    }
    throw new Error('Could not detect Issue Key. Please provide it explicitly (e.g. "TASK-123") or run inside a Git branch.');
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
                validate: (input) => input.includes('http') ? true : 'Valid URL required'
            },
            { type: 'input', name: 'email', message: 'Your Jira Email Address:' },
            { type: 'confirm', name: 'openBrowser', message: 'Generate API Token?', default: false }
        ]);

        if (answers.openBrowser) {
            await open('https://id.atlassian.com/manage-profile/security/api-tokens');
        }

        const tokenAnswer = await inquirer.prompt([{
            type: 'password', name: 'apiToken', message: 'Paste API Token:', mask: '*'
        }]);

        saveCreds({
            jiraUrl: answers.jiraUrl,
            email: answers.email,
            apiToken: tokenAnswer.apiToken
        });
        console.log(chalk.green('\n✅ Credentials saved.'));
    });

// --- 2. INFO COMMAND ---
program
    .command('info [issueKey]')
    .alias('i')
    .description('Get info about a ticket')
    .action(async (issueKey) => {
        try {
            const finalKey = resolveKey(issueKey);
            const client = getJiraClient();
            const issue = await client.issues.getIssue({ issueIdOrKey: finalKey });

            console.log(chalk.green(`\nFound issue: ${issue.key}`));
            console.log(chalk.bold(issue.fields.summary));
            console.log(`Status: [${issue.fields.status.name}]`);
        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message || error?.response?.data);
        }
    });

// --- 3. OPTIONS COMMAND ---
program
    .command('options [issueKey]')
    .alias('opt')
    .description('List all available transitions')
    .action(async (issueKey) => {
        try {
            const finalKey = resolveKey(issueKey);
            const client = getJiraClient();
            console.log(chalk.blue(`Fetching options for ${finalKey}...`));

            const { transitions } = await client.issues.getTransitions({ issueIdOrKey: finalKey });

            if (!transitions || transitions.length === 0) {
                console.log(chalk.yellow('No transitions available.'));
                return;
            }
            transitions.forEach(t => {
                console.log(`- ${chalk.bold(t.name)} ${chalk.dim(`(Moves to: ${t.to?.name})`)}`);
            });
        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message);
        }
    });

// --- 4. LOG WORK COMMAND ---
program
    .command('log [arg1] [arg2]')
    .alias('l')
    .description('Log work (usage: jira l 30m OR jira l PROJ-123 30m)')
    .option('-c, --comment <comment>', 'Worklog comment')
    .action(async (arg1, arg2, options) => {
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

            if (!timeSpent) throw new Error('Time spent is required (e.g. "30m", "1h")');

            const client = getJiraClient();
            console.log(chalk.blue(`Logging ${timeSpent} to ${finalKey}...`));

            await client.issueWorklogs.addWorklog({
                issueIdOrKey: finalKey,
                timeSpent: timeSpent,
                comment: options.comment,
            });

            console.log(chalk.green('Success! Time logged.'));
        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message);
        }
    });

// --- 5. UPDATE COMPONENT COMMAND ---
program
    .command('update [issueKey]')
    .alias('u')
    .description('Update issue component')
    .option('--component <name>', 'Name of the component')
    .action(async (issueKey, options) => {
        try {
            const finalKey = resolveKey(issueKey);

            if (!options.component) {
                console.log(chalk.yellow('Please specify a component with --component "Name"'));
                return;
            }

            const client = getJiraClient();
            await client.issues.editIssue({
                issueIdOrKey: finalKey,
                fields: { components: [{ name: options.component }] }
            });
            console.log(chalk.green(`Updated ${finalKey} successfully.`));

        } catch (error: any) {
            console.error(chalk.red('Update failed:'), error.message || error?.response?.data);
        }
    });

// --- 6. STATUS COMMAND (Smart Git Support) ---
program
    .command('status [arg1] [arg2]')
    .alias('s')
    .description('Move ticket (usage: jira s review OR jira s PROJ-123 review)')
    .option('-c, --component <name>', 'Set Affected Area')
    .action(async (arg1, arg2, options) => {
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
        } catch (e: any) {
            console.error(chalk.red(e.message));
            return;
        }

        const searchStatus = aliases[targetStatus] || targetStatus;

        const findMatch = (transitions: any[], term: string) => {
            return transitions.find(t => {
                const name = t.name?.toLowerCase() || '';
                const toName = t.to?.name?.toLowerCase() || '';
                return name.includes(term.toLowerCase()) || toName.includes(term.toLowerCase());
            });
        };

        try {
            const { transitions } = await client.issues.getTransitions({ issueIdOrKey: finalKey });
            if (!transitions || transitions.length === 0) throw new Error('No transitions found or ticket is closed.');

            const match = findMatch(transitions, searchStatus);

            if (!match || !match.id) {
                console.log(chalk.yellow(`Transition "${searchStatus}" not found for ${finalKey}.`));
                console.log(chalk.dim('Available options:'));
                transitions.forEach(t => console.log(` - ${t.name}`));
                return;
            }

            console.log(chalk.dim(`Attempting move: ${match.name} on ${finalKey}...`));

            try {
                await client.issues.doTransition({
                    issueIdOrKey: finalKey,
                    transition: { id: match.id }
                });
                const issueEnd = await client.issues.getIssue({ issueIdOrKey: finalKey, fields: ['status'] });
                console.log(chalk.green(`✅ Success! Moved to [${issueEnd.fields.status.name}].`));
                return;
            } catch (e) { /* fall through */ }

            console.log(chalk.yellow('\n⚠️  Transition failed. Entering Rescue Mode...'));

            const projectKey = finalKey.split('-')[0];
            const projectComponents = await client.projectComponents.getProjectComponents({ projectIdOrKey: projectKey });
            const componentChoices = projectComponents.map((c: any) => c.name || 'Unnamed');
            componentChoices.unshift('[Manual Text Entry]');

            const answer = await inquirer.prompt([{
                type: 'list', name: 'component', message: 'Select Affected Area:', choices: componentChoices
            }]);

            let finalValue = answer.component;
            if (finalValue === '[Manual Text Entry]') {
                const text = await inquirer.prompt([{ type: 'input', name: 'val', message: 'Enter text:' }]);
                finalValue = text.val;
            }

            const customFieldId = getAffectedFieldId() || 'components';
            const adfPayload = {
                version: 1, type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: finalValue }] }]
            };

            const editPayloads = [
                { [customFieldId]: adfPayload },
                { [customFieldId]: finalValue },
                { [customFieldId]: [{ value: finalValue }] },
                { [customFieldId]: { value: finalValue } }
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
                } catch (e) { }
            }

            if (updateSuccess) {
                await client.issues.doTransition({ issueIdOrKey: finalKey, transition: { id: match.id } });
                console.log(chalk.green(`✅ Success! Ticket moved.`));
            } else {
                console.log(chalk.red('❌ Failed to update field.'));
            }

        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message || JSON.stringify(error?.response?.data));
        }
    });

// --- 7. ALIAS COMMANDS (Grouped Correctly) ---
const aliasCmd = program.command('alias').description('Manage transition shortcuts');

aliasCmd.command('add <short> <long>')
    .action((s, l) => { saveAlias(s, l); console.log('✅ Alias saved.'); });

aliasCmd.command('ls')
    .action(() => {
        const aliases = getAliases();
        console.log(chalk.blue('Shortcuts:'), aliases);
    });

aliasCmd.command('rm <short>')
    .action((s) => { removeAlias(s); console.log('🗑️ Removed.'); });

// --- 8. UTILS ---
program.command('config-field <id>')
    .action((id) => { setAffectedFieldId(id); console.log('✅ Field ID saved.'); });

// --- SCAN COMMAND (Fixed TS Error) ---
program.command('scan <keyword>')
    .description('Find field IDs')
    .action(async (keyword) => {
        try {
            const client = getJiraClient();
            console.log(chalk.blue(`Scanning for "${keyword}"...`));

            const fields = await client.issueFields.getFields();

            // Fix: Check if 'f.name' exists before calling toLowerCase()
            const matches = fields.filter(f =>
                f.name && f.name.toLowerCase().includes(keyword.toLowerCase())
            );

            matches.forEach(f =>
                console.log(`${f.name} -> ID: ${f.id} (${f.schema?.type})`)
            );

        } catch (e) { console.error(e); }
    });

// --- 9. REPORT COMMAND (Clean & Focused) ---
program
    .command('report')
    .alias('r')
    .description('Show hours logged (Default: Today. Use -m for Month)')
    .option('-m, --month', 'Show stats for the current month')
    .action(async (options) => {
        try {
            const client = getJiraClient();
            const myself = await client.myself.getCurrentUser();
            const myAccountId = myself.accountId;

            const now = new Date();
            const mode = options.month ? 'Month' : 'Today';

            // Calculate Start Date
            let startDate: Date;
            if (options.month) {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            }

            const jqlDate = startDate.toISOString().split('T')[0];

            console.log(chalk.blue(`Fetching worklogs for [${mode}]...`));

            const search = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
                jql: `worklogAuthor = currentUser() AND worklogDate >= "${jqlDate}"`,
                fields: ['worklog'],
                maxResults: 100
            });

            if (!search.issues || search.issues.length === 0) {
                console.log(chalk.yellow(`No worklogs found for ${mode}.`));
                return;
            }

            let totalSeconds = 0;

            await Promise.all(search.issues.map(async (issue: any) => {
                let logs = issue.fields.worklog?.worklogs || [];
                const totalLogs = issue.fields.worklog?.total || 0;

                // Fetch full logs if truncated
                if (totalLogs > logs.length) {
                    const fullLogReq = await client.issueWorklogs.getIssueWorklog({ issueIdOrKey: issue.id });
                    logs = fullLogReq.worklogs || [];
                }

                logs.forEach((log: any) => {
                    if (log.author?.accountId !== myAccountId) return;

                    const logDate = new Date(log.started);
                    if (logDate >= startDate) {
                        totalSeconds += log.timeSpentSeconds || 0;
                    }
                });
            }));

            const formatTime = (seconds: number) => {
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                return `${h}h ${m}m`;
            };

            // Minimal Output
            console.log(chalk.bold(`\n⏱️  Total [${mode}]: ${chalk.green(formatTime(totalSeconds))}`));

        } catch (error: any) {
            console.error(chalk.red('Error generating report:'), error.message || error);
        }
    });


// --- 10. WORKLOGS COMMAND (With Descriptions) ---
program
    .command('worklogs [issueKey]')
    .alias('wl')
    .description('List all worklogs for a specific ticket')
    .action(async (issueKey) => {
        try {
            const finalKey = resolveKey(issueKey);
            const client = getJiraClient();

            console.log(chalk.blue(`Fetching history for ${finalKey}...`));

            const response = await client.issueWorklogs.getIssueWorklog({
                issueIdOrKey: finalKey
            });

            const logs = response.worklogs || [];

            if (logs.length === 0) {
                console.log(chalk.yellow(`No worklogs found for ${finalKey}.`));
                return;
            }

            console.log(chalk.bold(`\n⏱️  Time History for ${finalKey}`));
            console.log(chalk.dim('--------------------------------------------------------------------------------'));
            // Header
            console.log(chalk.dim(
                'Date       | Time    | Author          | Description'
            ));
            console.log(chalk.dim('--------------------------------------------------------------------------------'));

            let totalSeconds = 0;

            // Helper to extract clean text from Jira's complex Rich Text (ADF) structure
            const extractText = (node: any): string => {
                if (!node) return '';
                if (typeof node === 'string') return node;
                if (node.text) return node.text;
                if (node.content && Array.isArray(node.content)) {
                    return node.content.map(extractText).join(' ');
                }
                return '';
            };

            logs.forEach((log: any) => {
                const date = new Date(log.started).toISOString().split('T')[0];
                // Shorten name to fit column (e.g. "John Doe" -> "John Doe")
                const author = (log.author?.displayName || 'Unknown').substring(0, 15);
                const time = log.timeSpent || '0m';

                // Get Description & Clean it up
                let desc = extractText(log.comment).trim();
                // Replace newlines with spaces to keep table format
                desc = desc.replace(/\n/g, ' ');
                // Truncate if too long
                if (desc.length > 40) desc = desc.substring(0, 37) + '...';

                totalSeconds += log.timeSpentSeconds || 0;

                // Formatted Columns
                console.log(
                    `${chalk.gray(date)} | ` +
                    `${chalk.cyan(time.padEnd(7))} | ` +
                    `${chalk.magenta(author.padEnd(15))} | ` +
                    `${desc}`
                );
            });

            // Calculate Total
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);

            console.log(chalk.dim('--------------------------------------------------------------------------------'));
            console.log(`Total: ${chalk.green.bold(`${h}h ${m}m`)}`);

        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message || error);
        }
    });


// --- 11. COMMENT COMMAND (With Auto-Link Detection) ---
program
    .command('comment [arg1] [arg2]')
    .alias('c')
    .description('Add a comment to a ticket')
    .action(async (arg1, arg2) => {
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
                const answer = await inquirer.prompt([{
                    type: 'input', name: 'text', message: 'Enter your comment:'
                }]);
                commentText = answer.text;
            }

            if (!commentText) return;

            const client = getJiraClient();
            console.log(chalk.blue(`Adding comment to ${finalKey}...`));

            // --- SMART LINKIFIER ---
            // Splits text by URLs and creates the correct ADF structure for each part
            const linkify = (text: string) => {
                // Regex to find http/https links
                const parts = text.split(/(https?:\/\/[^\s]+)/g);

                return parts.map(part => {
                    // If part is a URL, return a Link Node
                    if (part.match(/^https?:\/\//)) {
                        return {
                            type: "text",
                            text: part,
                            marks: [{ type: "link", attrs: { href: part } }]
                        };
                    }
                    // Otherwise, return a regular Text Node
                    return { type: "text", text: part };
                }).filter(p => p.text); // Remove empty splits
            };

            const adfBody = {
                version: 1,
                type: "doc",
                content: [{
                    type: "paragraph",
                    content: linkify(commentText) // <--- Use the helper here
                }]
            };

            // Send via editIssue (Robust Method)
            await client.issues.editIssue({
                issueIdOrKey: finalKey,
                update: {
                    comment: [{ add: { body: adfBody } }]
                } as any
            });

            console.log(chalk.green(`✅ Comment added successfully!`));

        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message || JSON.stringify(error?.response?.data));
        }
    });

program
    .command('open [issueKey]')
    .alias('o')
    .description('Open ticket in browser')
    .action(async (issueKey) => {
        try {
            const finalKey = resolveKey(issueKey);
            const creds = getCreds();

            if (!creds || !creds.jiraUrl) {
                console.log(chalk.red('Jira URL not configured. Run "jira setup".'));
                return;
            }

            // Clean up URL (remove trailing slash if present)
            const baseUrl = creds.jiraUrl.replace(/\/$/, '');
            const url = `${baseUrl}/browse/${finalKey}`;

            console.log(chalk.blue(`Opening ${chalk.bold(finalKey)} in browser...`));
            console.log(chalk.dim(url));

            await open(url);

        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message);
        }
    });


// --- 13. MINE COMMAND (Assigned to Me) ---
program
    .command('mine')
    .alias('m')
    .description('List open tasks assigned to me')
    .action(async () => {
        try {
            const client = getJiraClient();
            console.log(chalk.blue('🔍 Fetching your open tasks...'));

            // JQL: Assigned to current user AND not in a 'Done' or 'Closed' category
            const jql = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';

            const search = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
                jql: jql,
                fields: ['summary', 'status', 'priority'],
                maxResults: 15
            });

            if (!search.issues || search.issues.length === 0) {
                console.log(chalk.yellow('🎉 No open tasks assigned to you!'));
                return;
            }

            console.log(chalk.bold(`\n📋 My Open Tasks (${search.issues.length})`));
            console.log(chalk.dim('--------------------------------------------------------------------------------'));

            search.issues.forEach((issue: any) => {
                const key = chalk.bold.cyan(issue.key.padEnd(12));
                const status = `[${issue.fields.status.name}]`;

                // Color the status based on common names
                let statusColor = chalk.white;
                const sName = issue.fields.status.name.toLowerCase();
                if (sName.includes('progress')) statusColor = chalk.yellow;
                if (sName.includes('review')) statusColor = chalk.magenta;
                if (sName.includes('todo') || sName.includes('open')) statusColor = chalk.blue;

                console.log(`${key} ${statusColor(status.padEnd(18))} ${issue.fields.summary}`);
            });
            console.log(chalk.dim('--------------------------------------------------------------------------------'));

        } catch (error: any) {
            console.error(chalk.red('Error:'), error.message);
        }
    });

program.parse(process.argv);
