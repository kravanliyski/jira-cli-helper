# 🚀 Jira CLI Helper

A high-performance, Git-aware CLI tool designed to eliminate the friction of managing Jira tickets. Instead of switching to your browser, manage your workflow directly from your terminal.

---

## 💡 Why use this?

- **Context Awareness**: The tool reads your current Git branch name (e.g., `feature/PROJ-123`) to automatically target the correct ticket.
- **Smart Transitions**: Move tickets through workflows using simple aliases like `jira s cr` instead of hunting through dropdown menus.
- **Speed**: Log time, add comments, and check your "To Do" list in seconds, not minutes.

---

## 🛠️ Installation & Setup

### Prerequisites

Before installing, ensure you have the following:

- **Node.js**: Version 18.x or higher (check with `node -v`).
- **NPM**: Version 9.x or higher.
- **Jira API Token**: You need an API token to authenticate.
  - [Generate one here](https://id.atlassian.com/manage-profile/security/api-tokens).
- **Git**: Installed and configured in your path.

### 1. Install

```bash
git clone https://github.com/kravanliyski/jira-cli-helper.git
cd jira-cli-helper
npm install
npm run build
npm link
```

---

### 2. Configure

```bash
jira setup
```

_You will be prompted for your Jira Base URL, Email, and an API Token._

## 🎯 Manual Overrides (Non-Git Usage)

While the tool is "Git-aware," it does not require a Git repository to function. You can explicitly target any ticket by passing the Jira Key as the first argument.

### Examples:

- **Log time to a specific ticket**:

```bash
#Logs 1 hour and 30 minutes to TASK-1 with a comment
jira l Task-1 1h 30m -c "Testing new feature"
# Open the ticket TASK-1 in your browser
jira o PROJ-99
```

**Logic Flow:**

1. If a **Key** is provided (e.g., `TASK-1`), the tool uses that.
2. If no **Key** is provided, the tool looks for a **Jira ID** in your Git branch name.

---

### 3. Command Reference

### 📋 Task Management

| Command     | Alias    | Description                                         |
| ----------- | -------- | --------------------------------------------------- |
| `jira mine` | `jira m` | List all open tasks assigned to you.                |
| `jira info` | `jira i` | Show summary and status (auto-detects from branch). |
| `jira open` | `jira o` | Instantly open the ticket in your default browser.  |

---

### ⏱️ Time Tracking & Reporting

| Command                | Alias       | Description                         |
| ---------------------- | ----------- | ----------------------------------- |
| `jira log 45m`         | `jira l`    | Log 45m to the current ticket.      |
| `jira log 1h -c "..."` | `jira l`    | Log time with a specific comment.   |
| `jira report`          | `jira r`    | Show total hours logged today.      |
| `jira report -m`       | `jira r -w` | Show total hours logged this week.  |
| `jira report -m`       | `jira r -m` | Show total hours logged this month. |

---

### 💬 Communication & Workflow

| Command              | Alias      | Description                                            |
| -------------------- | ---------- | ------------------------------------------------------ |
| `jira comment "..."` | `jira c`   | Add a comment (links are automatically clickable).     |
| `jira status review` | `jira s`   | Transition ticket (e.g., to "In Review").              |
| `jira worklogs`      | `jira wl`  | See a table of who logged time on a ticket.            |
| `jira options`       | `jira opt` | List all available transitions for the current ticket. |

### 🧩 Custom Fields

| Command                       | Alias | Description                                           |
| ----------------------------- | ----- | ----------------------------------------------------- |
| `jira scan <keyword>`         | —     | Search Jira for field IDs matching the given keyword. |
| `jira field:add <alias> <id>` | —     | Save a custom field and map it to a friendly alias.   |
| `jira field:list`             | —     | List all configured custom fields.                    |
| `jira field:remove <alias>`   | —     | Remove a custom field from the local configuration.   |

**Notes:**

- Custom fields automatically appear in the **Details** section of `jira info`
- Field values are rendered with smart formatting (time tracking, links, objects)

### Pro-Tips for Workflows

### 📂 Folder Integration

You don’t need to be in the project folder to use this tool. Once linked, you can run it inside any of your work repositories.

If your branch is named `feature/PROJ-123`, simply typing `jira i` will pull data for `PROJ-123`.

## 🔧 Customization

### Status Aliases

Map short names to your specific Jira workflow states:

```bash
# Example: Map 'cr' to your company's 'Code Review' status
jira alias add cr "Code Review"

# Use it
jira s cr
```

### Shell Aliases (Optional)

To make your workflow even faster, you can add shortcuts to your shell profile `(~/.zshrc or ~/.bashrc)`:

```bash
# Add these to your shell config
alias jm='jira mine'
alias ji='jira info'
alias js='jira status'
alias jl='jira log'
```

### Affected Area (Rescue Mode)

If your Jira project requires a mandatory field (such as **Affected Area**) during a transition, the CLI enters **Rescue Mode**, allowing you to select the correct component interactively.

---

### 🔄 How to Update

This tool can self-update. To pull the latest features and rebuild:

```bash
jira self-update
#alias version
jira su
```

---

## Test Changes Instantly

Since you've already run `npm link`, any changes you save will be reflected immediately when you run the `jira` command in your terminal.

## Code Structure

- `src/index.ts`: The entry point and CLI command definitions.
- `src/jiraClient.ts`: Jira API client configuration.
- `src/config.ts`: Logic for handling local storage and credentials.

## 🤝 Contributing & Pull Requests

Contributions are welcome! If you have a feature request or a bug fix:

- **Fork the Repository**: Create your own copy of the project.
- **Create a Branch**: Use a descriptive name, e.g.,

```bash
   git checkout -b feat/add-delete-command
```

- **Commit Your Changes**: Follow clear commit messaging.
- **Test are passing**: Ensure all existing tests pass and add new tests if necessary.

```bash
   npm test
```

- **Push & Open a PR:** Push to your fork and submit a Pull Request to the main branch.

### 🔒 Security & Privacy

- **Local Storage**: Your API token and credentials are stored securely on your local machine in your home directory (using `conf`). They are never uploaded or shared.
- **Permissions**: The MIT License ensures you have full control over the code.
