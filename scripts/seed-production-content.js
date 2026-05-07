import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../server/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const seedDir = path.join(rootDir, 'data', 'seed-content');

const db = getDb();

const readJson = (fileName) => {
  const filePath = path.join(seedDir, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing seed file: ${path.relative(rootDir, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const nowIso = () => new Date().toISOString();

const seedKnowledgeArticles = (articles) => {
  const stmt = db.prepare(`
    INSERT INTO knowledge_articles (
      id, slug, title, category, level, tags, summary, content,
      view_count, created_at, updated_at, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      category = excluded.category,
      level = excluded.level,
      tags = excluded.tags,
      summary = excluded.summary,
      content = excluded.content,
      updated_at = excluded.updated_at,
      published = excluded.published
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      stmt.run(
        item.id,
        item.slug,
        item.title,
        item.category,
        item.level || 1,
        JSON.stringify(item.tags || []),
        item.summary,
        item.content,
        item.viewCount || 0,
        item.createdAt || nowIso(),
        nowIso(),
        item.published === false ? 0 : 1
      );
    }
  });

  insertMany(articles);
  return articles.length;
};

const seedCelebrityCases = (cases) => {
  const stmt = db.prepare(`
    INSERT INTO celebrity_cases (
      id, name, name_cn, category, category_cn, birth_date, birth_location_city,
      birth_location_lat, birth_location_lng, description, tags, year_pillar,
      month_pillar, day_pillar, hour_pillar, chart_data, highlights,
      hotness_score, view_count, created_at, published,
      analysis_data, scores, financial_data, honors, analysis_generated_at, analysis_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      name_cn = excluded.name_cn,
      category = excluded.category,
      category_cn = excluded.category_cn,
      birth_date = excluded.birth_date,
      birth_location_city = excluded.birth_location_city,
      birth_location_lat = excluded.birth_location_lat,
      birth_location_lng = excluded.birth_location_lng,
      description = excluded.description,
      tags = excluded.tags,
      year_pillar = excluded.year_pillar,
      month_pillar = excluded.month_pillar,
      day_pillar = excluded.day_pillar,
      hour_pillar = excluded.hour_pillar,
      chart_data = excluded.chart_data,
      highlights = excluded.highlights,
      hotness_score = excluded.hotness_score,
      published = excluded.published,
      analysis_data = excluded.analysis_data,
      scores = excluded.scores,
      financial_data = excluded.financial_data,
      honors = excluded.honors,
      analysis_generated_at = excluded.analysis_generated_at,
      analysis_version = excluded.analysis_version
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      stmt.run(
        item.id,
        item.name,
        item.name_cn,
        item.category,
        item.category_cn,
        item.birth_date,
        item.birth_location_city || '',
        item.birth_location_lat || 0,
        item.birth_location_lng || 0,
        `${item.description}\n\n参考资料：${(item.sourceRefs || []).join('、')}`,
        JSON.stringify(item.tags || []),
        item.year_pillar || '未详',
        item.month_pillar || '未详',
        item.day_pillar || '未详',
        item.hour_pillar || '未详',
        JSON.stringify(item.chart_data || []),
        JSON.stringify(item.highlights || []),
        item.hotness_score || 60,
        item.view_count || 0,
        item.createdAt || nowIso(),
        item.published === false ? 0 : 1,
        item.analysis_data ? JSON.stringify(item.analysis_data) : null,
        item.scores ? JSON.stringify(item.scores) : null,
        item.financial_data ? JSON.stringify(item.financial_data) : null,
        item.honors ? JSON.stringify(item.honors) : null,
        item.analysis_generated_at || nowIso(),
        item.analysis_version || 1
      );
    }
  });

  insertMany(cases);
  return cases.length;
};

const main = () => {
  const articles = readJson('knowledge-articles.json');
  const cases = readJson('celebrity-cases.json');

  const articleCount = seedKnowledgeArticles(articles);
  const caseCount = seedCelebrityCases(cases);

  console.log(`Seeded ${articleCount} knowledge articles.`);
  console.log(`Seeded ${caseCount} celebrity cases.`);
};

main();
