import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const seedDir = path.join(rootDir, 'data', 'seed-content');

const knowledgePath = path.join(seedDir, 'knowledge-articles.json');
const celebrityPath = path.join(seedDir, 'celebrity-cases.json');

const knowledgeCategories = ['quickstart', 'kline', 'bazi', 'dayun', 'method', 'faq'];
const celebrityCategories = ['sudden_downfall', 'rising_power', 'corporate_fate', 'ai_tech', 'crypto_macro'];

const fail = (message) => {
  console.error(`Seed content validation failed: ${message}`);
  process.exit(1);
};

const readJson = (filePath) => {
  if (!fs.existsSync(filePath)) {
    fail(`missing file ${path.relative(rootDir, filePath)}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`invalid JSON in ${path.relative(rootDir, filePath)}: ${error.message}`);
  }
};

const countBy = (items, key) => {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
    return counts;
  }, {});
};

const ensureUnique = (items, key, label) => {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item[key])) fail(`duplicate ${label} ${item[key]}`);
    seen.add(item[key]);
  }
};

const hasChineseText = (value) => /[\u4e00-\u9fff]/.test(value || '');

const knowledgeArticles = readJson(knowledgePath);
const celebrityCases = readJson(celebrityPath);

if (!Array.isArray(knowledgeArticles)) fail('knowledge articles must be an array');
if (!Array.isArray(celebrityCases)) fail('celebrity cases must be an array');

if (knowledgeArticles.length !== 30) fail(`expected 30 knowledge articles, found ${knowledgeArticles.length}`);
if (celebrityCases.length !== 25) fail(`expected 25 celebrity cases, found ${celebrityCases.length}`);

ensureUnique(knowledgeArticles, 'id', 'knowledge id');
ensureUnique(knowledgeArticles, 'slug', 'knowledge slug');
ensureUnique(celebrityCases, 'id', 'celebrity id');

const knowledgeCounts = countBy(knowledgeArticles, 'category');
for (const category of knowledgeCategories) {
  if (knowledgeCounts[category] !== 5) {
    fail(`knowledge category ${category} expected 5 articles, found ${knowledgeCounts[category] || 0}`);
  }
}

const celebrityCounts = countBy(celebrityCases, 'category');
for (const category of celebrityCategories) {
  if (celebrityCounts[category] !== 5) {
    fail(`celebrity category ${category} expected 5 cases, found ${celebrityCounts[category] || 0}`);
  }
}

for (const article of knowledgeArticles) {
  for (const field of ['id', 'slug', 'title', 'category', 'summary', 'content']) {
    if (!article[field]) fail(`knowledge article ${article.id || article.slug || '(unknown)'} missing ${field}`);
  }
  if (!knowledgeCategories.includes(article.category)) fail(`knowledge article ${article.id} has unknown category ${article.category}`);
  if (!Array.isArray(article.tags) || article.tags.length < 2) fail(`knowledge article ${article.id} needs at least 2 tags`);
  if (!Array.isArray(article.sourceRefs) || article.sourceRefs.length < 1) fail(`knowledge article ${article.id} needs sourceRefs`);
  if (!hasChineseText(article.title) || !hasChineseText(article.content)) fail(`knowledge article ${article.id} must contain Chinese text`);
  if (article.summary.length < 20) fail(`knowledge article ${article.id} summary is too short`);
  if (article.content.length < 450) fail(`knowledge article ${article.id} content is too short`);
}

for (const item of celebrityCases) {
  for (const field of ['id', 'name', 'name_cn', 'category', 'category_cn', 'birth_date', 'description']) {
    if (!item[field]) fail(`celebrity case ${item.id || item.name || '(unknown)'} missing ${field}`);
  }
  if (!celebrityCategories.includes(item.category)) fail(`celebrity case ${item.id} has unknown category ${item.category}`);
  if (!Array.isArray(item.tags) || item.tags.length < 2) fail(`celebrity case ${item.id} needs at least 2 tags`);
  if (!Array.isArray(item.events) || item.events.length < 3) fail(`celebrity case ${item.id} needs at least 3 events`);
  if (!Array.isArray(item.sourceRefs) || item.sourceRefs.length < 1) fail(`celebrity case ${item.id} needs sourceRefs`);
  if (!item.analysis_data?.summary) fail(`celebrity case ${item.id} needs cached analysis_data.summary`);
  if (item.analysis_data.summary.length < 100) fail(`celebrity case ${item.id} cached summary is too short`);
  if (typeof item.scores?.overall !== 'number') fail(`celebrity case ${item.id} needs numeric scores.overall`);
  if (!hasChineseText(item.name_cn) || !hasChineseText(item.description)) fail(`celebrity case ${item.id} must contain Chinese text`);
}

console.log('Seed content validation passed.');
