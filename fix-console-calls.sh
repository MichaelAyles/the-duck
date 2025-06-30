#!/bin/bash

# Script to replace console calls with logger calls in the remaining files
# This script will be more efficient for bulk processing

SRC_DIR="/mnt/c/Users/mikea/OneDrive/Desktop/Projects/the-duck/src"

echo "Fixing console calls in remaining files..."

# Find all TypeScript and TSX files that still contain console calls
files=$(find "$SRC_DIR" -name "*.ts" -o -name "*.tsx" | xargs grep -l "console\.")

for file in $files; do
    echo "Processing: $file"
    
    # Check if logger is already imported
    if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
        # Add logger import after the last import statement
        sed -i '/^import.*from/a import { logger } from '"'"'@/lib/logger'"'"';' "$file"
    fi
    
    # Replace console.log with logger.dev.log (for development logs)
    sed -i 's/console\.log(/logger.dev.log(/g' "$file"
    
    # Replace console.warn with logger.dev.warn (for development warnings)
    sed -i 's/console\.warn(/logger.dev.warn(/g' "$file"
    
    # Replace console.error with logger.error (for production errors)
    sed -i 's/console\.error(/logger.error(/g' "$file"
    
    # Remove NODE_ENV checks before logger.dev calls since logger already handles this
    sed -i '/if (process\.env\.NODE_ENV === '"'"'development'"'"') {/{
        N
        /logger\.dev\./d
    }' "$file"
    
    echo "Fixed: $file"
done

echo "Console call replacement complete!"
echo "Files processed: $(echo "$files" | wc -l)"