import fs from 'fs';
import path from 'path';

const dirs = [
    './src/pages',
    './src/components',
    './src'
];

const classMap = {
    'bg-slate-950': 'bg-slate-50 dark:bg-slate-950',
    'bg-slate-900': 'bg-white dark:bg-slate-900',
    'bg-slate-800': 'bg-slate-100 dark:bg-slate-800',
    'bg-slate-700': 'bg-slate-200 dark:bg-slate-700',
    'border-slate-800': 'border-slate-200 dark:border-slate-800',
    'border-slate-700': 'border-slate-300 dark:border-slate-700',
    'text-slate-400': 'text-slate-500 dark:text-slate-400',
    'text-slate-300': 'text-slate-700 dark:text-slate-300',
    'text-slate-200': 'text-slate-800 dark:text-slate-200'
};

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    if (!fs.statSync(filePath).isFile()) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Process mapping dictionary
    for (const [oldClass, newClassStr] of Object.entries(classMap)) {
        const escapedOldClass = oldClass.replace(/-/g, '\\-');
        const regex = new RegExp(`(?<!dark:)\\b${escapedOldClass}(?:\\/(\\d+))?\\b`, 'g');

        content = content.replace(regex, (match, opacity) => {
            const newClassParts = newClassStr.split(' ');
            if (opacity) {
                return `${newClassParts[0]}/${opacity} ${newClassParts[1]}/${opacity}`;
            }
            return newClassStr;
        });
    }

    // Handle text-white
    // Find all className strings (both "..." and `...`)
    const classStringRegex = /className=(?:(["'])(.*?)\1|\{`([^`]+)`\})/g;

    content = content.replace(classStringRegex, (match, quote, p2, p3) => {
        let inner = p2 || p3;
        if (!inner) return match;

        // Check if it's a colored button/badge
        const hasColoredBg = /\bbg-(blue|red|emerald|green|amber|purple)-(400|500|600|700)\b/.test(inner);

        if (!hasColoredBg) {
            // safe to replace text-white
            inner = inner.replace(/(?<!dark:)\btext-white(?:\/(\d+))?\b/g, (m, opacity) => {
                if (opacity) {
                    return `text-slate-900/${opacity} dark:text-white/${opacity}`;
                }
                return 'text-slate-900 dark:text-white';
            });
        }

        if (p2) return `className=${quote}${inner}${quote}`;
        return `className={\`${inner}\`}`;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

dirs.forEach(walkDir);
console.log('Done mapping tailwind classes.');
