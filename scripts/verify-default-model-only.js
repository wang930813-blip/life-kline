import fs from 'fs';
import path from 'path';

const root = process.cwd();
const targetFiles = [
  'server/analyzeStream.js',
  'server/parallelAnalyzer.js',
  'server/unifiedAnalyzer.js',
  'server/celebrityAnalyzer.js',
  'server/index.js',
];

const forbiddenPatterns = [
  /grok-4/gi,
  /gemini-3-pro-preview/gi,
  /gemini-2\.5-pro/gi,
  /claude-haiku/gi,
  /claude-/gi,
];

const offenders = [];

for (const relativePath of targetFiles) {
  const absolutePath = path.join(root, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');

  for (const pattern of forbiddenPatterns) {
    const matches = content.match(pattern);
    if (matches?.length) {
      offenders.push({
        file: relativePath,
        pattern: pattern.toString(),
        count: matches.length,
      });
    }
  }
}

if (offenders.length > 0) {
  console.error('Found forbidden fallback model references:');
  for (const offender of offenders) {
    console.error(`- ${offender.file}: ${offender.pattern} x${offender.count}`);
  }
  process.exit(1);
}

console.log('OK: analysis chain only references DEFAULT_MODEL-compatible configuration.');
