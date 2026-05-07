import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const collectionDir = path.join(repoRoot, 'docs', 'awesome-design-md', 'design-md');
const targetFile = path.join(repoRoot, 'DESIGN.md');

function listDesigns() {
  return fs
    .readdirSync(collectionDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function printUsage(designs) {
  console.log('Usage: npm run design:use -- <design-name>');
  console.log('');
  console.log('Examples:');
  console.log('  npm run design:use -- linear.app');
  console.log('  npm run design:use -- apple');
  console.log('');
  console.log(`Available designs (${designs.length}):`);
  console.log(designs.join(', '));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(collectionDir)) {
  fail(`Design collection not found: ${collectionDir}`);
}

const designName = process.argv[2];
const designs = listDesigns();

if (!designName || designName === '--list' || designName === '-l') {
  printUsage(designs);
  process.exit(0);
}

if (designName.includes('/') || designName.includes('\\') || designName.includes('..')) {
  fail('Design name must be a folder name from docs/awesome-design-md/design-md.');
}

const sourceFile = path.join(collectionDir, designName, 'DESIGN.md');

if (!fs.existsSync(sourceFile)) {
  fail(`Unknown design "${designName}". Run "npm run design:use -- --list" to see options.`);
}

const source = fs.readFileSync(sourceFile, 'utf8');
const header = [
  '<!--',
  `Generated from VoltAgent awesome-design-md: ${designName}`,
  'Source: https://github.com/voltagent/awesome-design-md',
  'Run "npm run design:use -- <design-name>" to switch styles.',
  '-->',
  '',
].join('\n');

fs.writeFileSync(targetFile, `${header}${source}`);

console.log(`Applied ${designName} design to DESIGN.md`);
