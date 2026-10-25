#!/bin/bash

# SecondLook Code Cleanup Script
# This script helps automate some cleanup tasks

echo "🧹 SecondLook Code Cleanup Script"
echo "=================================="
echo ""

# Function to count console statements
count_console_statements() {
    echo "📊 Counting console statements..."
    echo ""
    
    total=$(grep -r "console\." --include="*.js" --exclude-dir=node_modules . | wc -l | tr -d ' ')
    logs=$(grep -r "console\.log" --include="*.js" --exclude-dir=node_modules . | wc -l | tr -d ' ')
    warns=$(grep -r "console\.warn" --include="*.js" --exclude-dir=node_modules . | wc -l | tr -d ' ')
    errors=$(grep -r "console\.error" --include="*.js" --exclude-dir=node_modules . | wc -l | tr -d ' ')
    
    echo "Total console statements: $total"
    echo "  - console.log: $logs"
    echo "  - console.warn: $warns"
    echo "  - console.error: $errors"
    echo ""
}

# Function to find large files
find_large_files() {
    echo "📁 Finding large files (>500 lines)..."
    echo ""
    
    find . -name "*.js" -type f -not -path "./node_modules/*" -not -path "./.git/*" | while read file; do
        lines=$(wc -l < "$file")
        if [ "$lines" -gt 500 ]; then
            echo "  $file: $lines lines"
        fi
    done
    echo ""
}

# Function to find TODOs and FIXMEs
find_todos() {
    echo "📝 Finding TODOs and FIXMEs..."
    echo ""
    
    grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.js" --exclude-dir=node_modules . | head -20
    echo ""
}

# Function to find commented code
find_commented_code() {
    echo "💬 Finding blocks of commented code..."
    echo ""
    
    grep -rn "^[[:space:]]*//.*function\|^[[:space:]]*//.*const\|^[[:space:]]*//.*let" \
        --include="*.js" --exclude-dir=node_modules . | head -15
    echo ""
}

# Function to backup before cleanup
create_backup() {
    echo "💾 Creating backup before cleanup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_dir="backup_${timestamp}"
    
    mkdir -p "$backup_dir"
    
    # Backup JavaScript files
    rsync -av --include="*.js" --include="*/" --exclude="*" \
        --exclude="node_modules" --exclude=".git" \
        ./js ./workers ./server "$backup_dir/" 2>/dev/null
    
    echo "✅ Backup created in $backup_dir/"
    echo ""
}

# Main menu
show_menu() {
    echo "Choose an option:"
    echo "1) Count console statements"
    echo "2) Find large files"
    echo "3) Find TODOs/FIXMEs"
    echo "4) Find commented code"
    echo "5) Create backup"
    echo "6) Run all analyses"
    echo "0) Exit"
    echo ""
    read -p "Enter choice: " choice
    
    case $choice in
        1) count_console_statements ;;
        2) find_large_files ;;
        3) find_todos ;;
        4) find_commented_code ;;
        5) create_backup ;;
        6)
            count_console_statements
            find_large_files
            find_todos
            find_commented_code
            ;;
        0) echo "Goodbye!"; exit 0 ;;
        *) echo "Invalid choice"; show_menu ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# Start
show_menu
