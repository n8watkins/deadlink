# Claude Code Slash Commands

This directory contains custom slash commands for Claude Code. Slash commands are shortcuts that help Claude perform specific tasks or follow certain patterns.

## How Slash Commands Work

Slash commands in Claude Code allow you to quickly trigger predefined prompts or behaviors. When you type a command like `/todo`, Claude will read the corresponding markdown file and follow its instructions.

## Creating Custom Commands

1. Create a markdown file in this directory (`.claude/commands/`)
2. Name the file after your command (e.g., `todo.md` for `/todo`)
3. Write the instructions you want Claude to follow

## Using Commands

Simply type `/` followed by the command name in your chat:
- `/todo` - Lists current todos and creates a markdown file
- `/help` - Shows available commands
- `/review` - Triggers a code review

## Command Features

### Arguments
Commands can accept arguments using `$ARGUMENTS`:
```markdown
Review this code: $ARGUMENTS
```

### File References
Use `@` to reference files:
```markdown
Analyze @file.js for performance issues
```

### Bash Commands
Execute bash commands with `!`:
```markdown
!npm test
```

## Directory Structure

- Project commands: `.claude/commands/` (this directory)
- Personal commands: `~/.claude/commands/` (user home directory)

## Available Commands in This Project

- `/todo` - Lists all current todos in the project and creates a markdown file for reference

## Tips

- Keep commands focused on a single task
- Use descriptive names
- Include clear instructions in the markdown file
- Commands can be organized in subdirectories for namespacing