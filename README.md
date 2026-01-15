# 🚀 Jira CLI Helper

A high-performance, Git-aware CLI tool designed to eliminate the friction of managing Jira tickets. Instead of switching to your browser, manage your workflow directly from your terminal.

---

## 💡 Why use this?

* **Context Awareness**: The tool reads your current Git branch name (e.g., `feature/PROJ-123`) to automatically target the correct ticket.
* **Smart Transitions**: Move tickets through workflows using simple aliases like `jira s cr` instead of hunting through dropdown menus.
* **Speed**: Log time, add comments, and check your "To Do" list in seconds, not minutes.

---

## 🛠️ Installation & Setup

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

---
### 3. Command Reference


### 📋 Task Management

| Command        | Alias   | Description |
|----------------|---------|-------------|
| `jira mine`    | `jira m` | List all open tasks assigned to you. |
| `jira info`    | `jira i` | Show summary and status (auto-detects from branch). |
| `jira open`    | `jira o` | Instantly open the ticket in your default browser. |

---

### ⏱️ Time Tracking & Reporting

| Command                     | Alias        | Description |
|-----------------------------|--------------|-------------|
| `jira log 45m`              | `jira l`     | Log 45m to the current ticket. |
| `jira log 1h -c "..."`      | `jira l`     | Log time with a specific comment. |
| `jira report`               | `jira r`     | Show total hours logged today. |
| `jira report -m`            | `jira r -m`  | Show total hours logged this month. |

---

### 💬 Communication & Workflow

| Command                | Alias     | Description |
|------------------------|-----------|-------------|
| `jira comment "..."`   | `jira c`  | Add a comment (links are automatically clickable). |
| `jira status review`  | `jira s`  | Transition ticket (e.g., to "In Review"). |
| `jira worklogs`       | `jira wl` | See a table of who logged time on a ticket. |
| `jira options`        | `jira opt`| List all available transitions for the current ticket. |



###  Pro-Tips for Workflows

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

## 🔄 Updating

When new features are released, update your local version with:

```bash
git pull
npm run build
```
---

## 👩‍💻 Local Development

If you want to modify the code or add new features locally:

1. **Enable Watch Mode**  
   This will automatically rebuild the project whenever you save a file:

```bash
   npm run build -- --watch
```

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
- **Push & Open a PR:** Push to your fork and submit a Pull Request to the main branch.

### 🔒 Security & Privacy

- **Local Storage**: Your API token and credentials are stored securely on your local machine in your home directory (using `conf`). They are never uploaded or shared.
- **Permissions**: The MIT License ensures you have full control over the code.


