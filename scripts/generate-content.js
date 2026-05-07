import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import { normalizeApiBaseUrl, normalizeModelName } from '../server/llmConfig.js';

dotenv.config();

const API_BASE_URL = normalizeApiBaseUrl();
const API_KEY = process.env.API_KEY;
const MODEL = normalizeModelName();

// 文章生成 Prompt
const ARTICLE_PROMPT = (topic, category) => `
你是人生K线产品的知识内容作者。请为以下主题撰写知识文章：

主题：${topic}
类别：${category}

目标读者：对命理感兴趣但不懂术语的普通用户

要求：
1. 简明扼要，通俗易懂，不要有废话
2. 使用具体例子解释抽象概念
3. 关联到K线图的实际展示
4. 正文300-500字

请直接输出JSON格式（不要markdown代码块）：
{
  "title": "文章标题",
  "summary": "一句话总结（60字内）",
  "content": "正文内容（Markdown格式）"
}
`;

// 待生成的文章清单
const ARTICLES_TO_GENERATE = [
  // 快速入门 (quickstart)
  { topic: '如何正确填写四柱（年柱、月柱、日柱、时柱）', category: 'quickstart' },
  { topic: '起运年龄是什么，虚岁与周岁的区别', category: 'quickstart' },
  { topic: '第一部大运怎么找，顺行逆行的简单判断', category: 'quickstart' },
  { topic: '一分钟看懂人生K线图（峰值、谷底、趋势）', category: 'quickstart' },
  { topic: '"吉"和"凶"不等于"好"和"坏"，风险与机会的双面性', category: 'quickstart' },
  { topic: '为什么同一年对不同人意义完全不同', category: 'quickstart' },

  // K线逻辑 (kline)
  { topic: 'K线四价（开盘、收盘、最高、最低）与人生事件的对应', category: 'kline' },
  { topic: '人生的牛市、熊市、震荡期如何把握决策节奏', category: 'kline' },
  { topic: '大运切换：为什么人生会"换挡"', category: 'kline' },
  { topic: '单年冲高回落：为什么看似好年也可能翻车', category: 'kline' },
  { topic: '单年深V走势：先苦后甜还是先甜后苦', category: 'kline' },
  { topic: '为什么K线模型必须有明显波动才有参考价值', category: 'kline' },

  // 八字基础 (bazi)
  { topic: '四柱代表的四个信息维度：年月日时', category: 'bazi' },
  { topic: '天干地支入门：只需掌握这些就够用', category: 'bazi' },
  { topic: '五行生克的核心规则：生、克、泄、耗', category: 'bazi' },
  { topic: '阴阳与顺逆大运的逻辑关系', category: 'bazi' },
  { topic: '十神入门：与人生事件类型的映射', category: 'bazi' },
  { topic: '喜用神和忌神：为什么影响"同一年不同命"', category: 'bazi' },
  { topic: '身强身弱：对风险承受和人生节奏的意义', category: 'bazi' },
  { topic: '神煞是什么：如何理性看待和使用', category: 'bazi' },

  // 大运流年 (dayun)
  { topic: '大运是背景，流年是触发器：理解两者的关系', category: 'dayun' },
  { topic: '大运十年如何分段：前期、中期、后期', category: 'dayun' },
  { topic: '流年冲合刑害的直观解释', category: 'dayun' },
  { topic: '太岁与犯太岁的现实意义和应对', category: 'dayun' },
  { topic: '迁移变动年：如何提前布局', category: 'dayun' },
  { topic: '贵人年与破财年的防守策略', category: 'dayun' },

  // 方法误区 (method)
  { topic: '评分怎么看：不要只盯着最高分年份', category: 'method' },
  { topic: '常见误区：把命理当成确定性预言', category: 'method' },
  { topic: '常见误区：只追求旺运而忽视能力修炼', category: 'method' },
  { topic: '如何用K线图做人生复盘：年度、三年、十年规划', category: 'method' },
];

// 生成单篇文章
async function generateArticle(topic, category) {
  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'user', content: ARTICLE_PROMPT(topic, category) }
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '';

  // 清理 JSON
  content = content.trim();
  if (content.startsWith('```json')) content = content.slice(7);
  if (content.startsWith('```')) content = content.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  content = content.trim();

  return JSON.parse(content);
}

// 主函数
async function main() {
  console.log('开始生成知识文章...');
  const results = [];

  for (const item of ARTICLES_TO_GENERATE) {
    console.log(`生成: ${item.topic}`);
    try {
      const article = await generateArticle(item.topic, item.category);
      const slug = nanoid(10);
      results.push({
        id: nanoid(),
        slug,
        category: item.category,
        level: 1,
        tags: [],
        ...article,
        createdAt: new Date().toISOString(),
      });
      console.log(`  ✓ ${article.title}`);
      // 避免 rate limit
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ✗ 失败: ${err.message}`);
    }
  }

  // 输出 SQL 插入语句
  console.log('\n=== SQL 插入语句 ===\n');
  for (const a of results) {
    const sql = `INSERT INTO knowledge_articles (id, slug, title, category, level, tags, summary, content, created_at) VALUES ('${a.id}', '${a.slug}', '${a.title.replace(/'/g, "''")}', '${a.category}', ${a.level}, '${JSON.stringify(a.tags)}', '${a.summary.replace(/'/g, "''")}', '${a.content.replace(/'/g, "''")}', '${a.createdAt}');`;
    console.log(sql);
  }

  // 保存为 JSON
  const fs = await import('fs');
  fs.writeFileSync('./scripts/generated-articles.json', JSON.stringify(results, null, 2));
  console.log('\n已保存到 scripts/generated-articles.json');
}

main().catch(console.error);
