import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const checks = [
  ['DESIGN.md', '青黛'],
  ['DESIGN.md', '朱砂'],
  ['DESIGN.md', '宣纸'],
  ['styles/design-tokens.css', '--color-qingdai'],
  ['styles/design-tokens.css', '--color-cinnabar'],
  ['index.css', 'paper-texture'],
  ['index.css', 'scroll-unfurl'],
  ['index.css', 'ink-ripple'],
  ['index.css', 'scroll-panel'],
  ['index.css', 'bamboo-card'],
  ['index.css', 'theme-color-normalization'],
  ['index.css', 'theme-button-normalization'],
  ['index.css', 'theme-layout-normalization'],
  ['styles/design-tokens.css', '--color-action-text'],
  ['styles/design-tokens.css', '--color-surface-paper'],
  ['components/layout/AppShell.tsx', 'paper-texture'],
  ['components/layout/AppShell.tsx', 'scroll-unfurl'],
  ['components/layout/MobileNav.tsx', 'ink-ripple'],
  ['App.tsx', 'scroll-panel'],
  ['pages/HomePage.tsx', 'classical-hero-title'],
  ['components/BaziForm.tsx', 'bamboo-card'],
  ['components/BaziForm.tsx', 'classical-button'],
  ['pages/HomePage.tsx', 'mobile-compact-home'],
  ['components/layout/AppShell.tsx', 'safe-area-inset-bottom'],
  ['components/layout/MobileNav.tsx', 'mobile-bottom-nav'],
  ['index.css', '.mobile-bottom-nav'],
  ['components/KLineTextTable.tsx', 'selectedDetail'],
  ['components/KLineTextTable.tsx', '查看详情'],
  ['components/KLineTextTable.tsx', 'md:table-cell'],
  ['components/KLineTextTable.tsx', 'scroll-panel'],
];

const forbiddenChecks = [
  ['index.css', '.paper-texture main .from-indigo-600'],
  ['index.css', '.paper-texture main .from-purple-600'],
  ['components/BaziForm.tsx', 'border-golden-300'],
  ['components/BaziForm.tsx', 'text-purple-700'],
  ['pages/HomePage.tsx', 'min-h-[60vh] gap-8'],
  ['pages/HomePage.tsx', 'leading-relaxed mb-8'],
  ['components/layout/AppShell.tsx', 'pb-24'],
];

const missing = [];

for (const [file, token] of checks) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    missing.push(`${file}: file missing`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(token)) {
    missing.push(`${file}: missing "${token}"`);
  }
}

for (const [file, token] of forbiddenChecks) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(token)) {
    missing.push(`${file}: forbidden "${token}"`);
  }
}

if (missing.length > 0) {
  console.error('Oriental theme verification failed:');
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log('Oriental theme verification passed.');
