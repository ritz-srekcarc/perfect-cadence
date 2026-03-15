import fs from 'fs';
const markdown = fs.readFileSync('demo_markdown.txt', 'utf-8');
const fileContent = `export const DEMO_MARKDOWN = \`\n${markdown.replace(/`/g, '\\`')}\`;\n`;
fs.writeFileSync('src/demoPreset.ts', fileContent);
