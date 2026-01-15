# 🚀 Jira CLI Helper

A lightning-fast, Git-aware CLI tool for managing Jira tickets directly from your terminal.

This tool automatically detects the Jira ticket ID from your current Git branch (e.g., `feature/TASK-123`), saving you from manually searching for or copy-pasting ticket numbers.

---

## ✨ Features

* **Git Integration**: Automatically detects ticket IDs from your current branch name.
* **Time Tracking**: Log work (e.g., `1h 30m`) and view daily/monthly time reports.
* **Smart Comments**: Post rich-text comments with automatic clickable link detection.
* **Workflow Automation**: Move tickets and update required fields like "Affected Area."
* **Quick Context**: Open tickets in the browser or view worklog history instantly.

---

## 🛠️ Installation

1.  **Clone and Install**:
    git clone <your-repo-url>
    cd jira-cli-ts
    npm install

2.  **Build and Link**:
    npm run build
    npm link

---

## ⚙️ Configuration

Run the setup command to connect the CLI to your Jira instance:

    jira setup

**Setup Prompts:**
* **Jira URL**: Your instance URL (e.g., `https://company.atlassian.net`).
* **Email**: Your Jira login email address.
* **API Token**: Generate a token at Atlassian's security settings.

---

## 📖 Usage Guide

Most commands automatically detect the ticket ID if you are inside a Git repository. You can always override this by passing a specific ID.

### 1. View Ticket Info
Show the summary and current status.

    # Auto-detects from branch
    jira i

    # Explicit ticket override
    jira i TASK-123

### 2. Open in Browser
Instantly opens the ticket in your default browser.

    jira o

### 3. Log Work (Time Tracking)
Log time against a ticket.

    # Log 45 minutes
    jira l 45m

    # Log with a comment
    jira l 1h 30m -c "Refactored API"

### 4. Time Reports
See your total logged hours.

    # Today's total
    jira r

    # Current month's total
    jira r -m

### 5. Add Comments
Add a comment. URLs in the text will be made clickable automatically.

    jira c "Reviewing PR: https://github.com/company/repo/pull/1"

### 6. Worklog History
See a table of who has logged time on a ticket and their descriptions.

    jira wl

### 7. Change Status (Transitions)
Move a ticket to a new state.

    jira s review   # Move to "In Review" or "Code Review"

> **Note**: If a transition requires mandatory fields, the CLI will enter "Rescue Mode" to guide you through selection.

---

## 🔧 Customization

### Aliases
Create shortcuts for long status names:

    jira alias add cr "Code Review"
    jira s cr  # Executes the move to Code Review

### Field Scanning
Find internal IDs for custom fields in your Jira project:

    jira scan "Affected Area"

---
