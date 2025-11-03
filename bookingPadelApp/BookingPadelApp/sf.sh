#!/bin/bash

TASK="$*"

# Auto-detect agent type
if echo "$TASK" | grep -iE "apex|class|backend|service|trigger|soql|batch|handler" > /dev/null; then
    echo "🔧 Backend Agent (Apex + Tests)"
    SKILL=".claude/skills/sf-backend/SKILL.md"
    WS="force-app/main/default/classes"
    
elif echo "$TASK" | grep -iE "lwc|component|frontend|ui|html|javascript|css" > /dev/null; then
    echo "🎨 Frontend Agent (LWC Components)"
    SKILL=".claude/skills/sf-frontend/SKILL.md"
    WS="force-app/main/default/lwc"
    
else
    echo "❓ Could not detect - specify 'backend' or 'frontend' in your task"
    exit 1
fi

# Run Claude Code with skill
claude code --context "$SKILL" --workspace "$WS" "$TASK"