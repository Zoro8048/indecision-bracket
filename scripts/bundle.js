/**
 * Zero-dependency ES Module -> IIFE Bundler for IndecisionBracket.
 * Concatenates modular src/ files in topological order into app.js
 * so the application works seamlessly both via file:// and local HTTP/GitHub Pages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const MODULE_ORDER = [
  'src/core/EventBus.js',
  'src/domain/CooldownManager.js',
  'src/domain/BracketEngine.js',
  'src/domain/SwipeMatcher.js',
  'src/domain/WheelPhysics.js',
  'src/storage/StorageManager.js',
  'src/services/AudioService.js',
  'src/services/HapticsService.js',
  'src/ui/Confetti.js',
  'src/ui/WinnerModal.js',
  'src/ui/TreeModal.js',
  'src/ui/PoolEditorModal.js',
  'src/ui/BracketView.js',
  'src/ui/SwipeView.js',
  'src/ui/WheelView.js',
  'src/main.js',
];

function stripImportsAndExports(code) {
  return code
    // Remove import statements
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    // Convert `export class/function/const/let` to plain declarations
    .replace(/^\s*export\s+(class|function|const|let|var)\s+/gm, '$1 ')
    .trim();
}

const chunks = [
  '/**',
  ' * IndecisionBracket - Bundled Runtime (Generated via `npm run build`)',
  ' * Pure client-side, zero runtime dependencies, local-first.',
  ' */',
  '(() => {',
  '  "use strict";',
];

for (const relPath of MODULE_ORDER) {
  const fullPath = path.join(rootDir, relPath);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const transformed = stripImportsAndExports(raw);
  chunks.push(`\n  // --- Module: ${relPath} ---\n  ${transformed.split('\n').join('\n  ')}`);
}

chunks.push('})();\n');

const outputPath = path.join(rootDir, 'app.js');
fs.writeFileSync(outputPath, chunks.join('\n'), 'utf8');
console.log(`Successfully bundled ${MODULE_ORDER.length} modules into app.js`);
