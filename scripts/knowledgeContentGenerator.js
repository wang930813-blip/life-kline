/**
 * 知识内容批量生成器
 *
 * 功能：
 * 1. 从内容计划队列读取待生成任务
 * 2. 调用 LLM 生成文章内容
 * 3. 质量检查后保存到数据库
 * 4. 支持异步执行，不影响主服务
 *
 * 使用方法：
 * node scripts/knowledgeContentGenerator.js [options]
 *
 * 参数：
 * --phase=1|2|3     运行阶段 (1=首发期, 2=扩展期, 3=维护期)
 * --batch=N         每批生成数量 (默认10)
 * --category=xxx    只生成指定栏目
 * --status          查看生成状态
 * --retry-failed    重试失败任务
 * --init            初始化内容计划队列
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import {
  getDb,
  createArticle,
} from '../server/database.js';
import { normalizeApiBaseUrl, normalizeModelName } from '../server/llmConfig.js';
import { buildArticlePrompt } from './knowledgeContentPrompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ 配置 ============

const API_BASE_URL = normalizeApiBaseUrl();
const API_KEY = process.env.API_KEY || ''; // 需要在 .env 中配置
const PRIMARY_MODEL = normalizeModelName();
const FALLBACK_MODELS = [];

// 解析命令行参数
const args = process.argv.slice(2);
const PHASE = parseInt(args.find(a => a.startsWith('--phase='))?.split('=')[1] || '1');
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '10');
const CATEGORY_FILTER = args.find(a => a.startsWith('--category='))?.split('=')[1];
const SHOW_STATUS = args.includes('--status');
const RETRY_FAILED = args.includes('--retry-failed');
const INIT_QUEUE = args.includes('--init');

// 阶段配置
const PHASE_CONFIG = {
  1: { batchSize: 8, delayBetweenArticles: 5000, maxDaily: 30 },
  2: { batchSize: 5, delayBetweenArticles: 5000, maxDaily: 25 },
  3: { batchSize: 2, delayBetweenArticles: 8000, maxDaily: 10 },
};

const config = PHASE_CONFIG[PHASE] || PHASE_CONFIG[1];

// ============ 数据库扩展 ============

function initSchema() {
  const db = getDb();

  // 创建内容生成队列表
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_generation_queue (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      category TEXT NOT NULL,
      topic_hub TEXT,
      priority INTEGER DEFAULT 5,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      article_id TEXT,
      error_message TEXT,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_status ON content_generation_queue(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_queue_priority ON content_generation_queue(priority DESC)`);

  // 扩展 knowledge_articles 表
  try {
    db.exec(`ALTER TABLE knowledge_articles ADD COLUMN topic_hub TEXT`);
  } catch (e) { /* 列已存在 */ }

  try {
    db.exec(`ALTER TABLE knowledge_articles ADD COLUMN generation_model TEXT`);
  } catch (e) { /* 列已存在 */ }

  try {
    db.exec(`ALTER TABLE knowledge_articles ADD COLUMN generation_version INTEGER DEFAULT 1`);
  } catch (e) { /* 列已存在 */ }

  try {
    db.exec(`ALTER TABLE knowledge_articles ADD COLUMN related_articles TEXT`);
  } catch (e) { /* 列已存在 */ }

  console.log('✓ 数据库 schema 初始化完成');
}

// ============ 内容计划 (300篇) ============

const CONTENT_PLAN = [
  // === A. 入门与术语 (30篇) ===
  { topic: '什么是八字命理？现代人的科学解读', category: 'basics', priority: 10, hub: 'what-is-bazi' },
  { topic: '四柱是什么？年月日时的信息维度', category: 'basics', priority: 10, hub: 'what-is-bazi' },
  { topic: '天干地支入门：22个符号全解析', category: 'basics', priority: 9, hub: 'common-terms' },
  { topic: '五行是什么？金木水火土的核心逻辑', category: 'basics', priority: 9, hub: 'common-terms' },
  { topic: '阴阳是什么？万物二元的哲学基础', category: 'basics', priority: 8, hub: 'common-terms' },
  { topic: '十神是什么？与人生事件的映射关系', category: 'basics', priority: 9, hub: 'common-terms' },
  { topic: '大运是什么？十年一运的节奏规律', category: 'basics', priority: 9, hub: 'what-is-bazi' },
  { topic: '流年是什么？每年运势的触发器', category: 'basics', priority: 8, hub: 'what-is-bazi' },
  { topic: '喜用神与忌神：影响"同年不同命"的关键', category: 'basics', priority: 9, hub: 'how-to-read-chart' },
  { topic: '身强身弱：风险承受与人生节奏', category: 'basics', priority: 8, hub: 'how-to-read-chart' },
  { topic: '三步读盘法：从四柱到运势的快速入门', category: 'basics', priority: 9, hub: 'how-to-read-chart' },
  { topic: '如何判断日主强弱？五个关键指标', category: 'basics', priority: 8, hub: 'how-to-read-chart' },
  { topic: '如何找到喜用神？三种判断方法', category: 'basics', priority: 8, hub: 'how-to-read-chart' },
  { topic: '如何理解十神组合？常见格局解析', category: 'basics', priority: 7, hub: 'how-to-read-chart' },
  { topic: '如何看大运走势？十年周期分析', category: 'basics', priority: 7, hub: 'how-to-read-chart' },
  { topic: '如何分析流年吉凶？年运判断技巧', category: 'basics', priority: 7, hub: 'how-to-read-chart' },
  { topic: '如何识别人生转折点？关键年份信号', category: 'basics', priority: 8, hub: 'how-to-read-chart' },
  { topic: '读盘的优先级：哪些信息最重要？', category: 'basics', priority: 6, hub: 'how-to-read-chart' },
  { topic: '读盘的常见误区：新手必避的五个坑', category: 'basics', priority: 7, hub: 'how-to-read-chart' },
  { topic: '从K线图读人生：可视化解读入门', category: 'basics', priority: 9, hub: 'how-to-read-chart' },
  { topic: '时间误差对八字的影响有多大？', category: 'basics', priority: 6, hub: 'accuracy' },
  { topic: '出生时间不确定怎么办？校时方法', category: 'basics', priority: 6, hub: 'accuracy' },
  { topic: '夏令时与时区：计算八字的注意事项', category: 'basics', priority: 5, hub: 'accuracy' },
  { topic: '八字能预测什么？科学的边界', category: 'basics', priority: 7, hub: 'accuracy' },
  { topic: '八字不能预测什么？合理的期望', category: 'basics', priority: 7, hub: 'accuracy' },
  { topic: '如何验证八字分析的准确性？', category: 'basics', priority: 6, hub: 'accuracy' },
  { topic: '"不准"的常见原因与应对', category: 'basics', priority: 6, hub: 'accuracy' },
  { topic: '命理与自由意志：决定论vs概率论', category: 'basics', priority: 5, hub: 'accuracy' },
  { topic: '如何正确使用八字做决策？', category: 'basics', priority: 7, hub: 'accuracy' },
  { topic: '八字与现代心理学的交叉视角', category: 'basics', priority: 5, hub: 'accuracy' },

  // === B. 本命盘解读 (60篇) ===
  // 十二宫 (24篇)
  { topic: '第一宫：自我与外在表现', category: 'birth_chart', priority: 8, hub: 'twelve-houses' },
  { topic: '第一宫常见问题自检', category: 'birth_chart', priority: 7, hub: 'twelve-houses' },
  { topic: '第二宫：财富与价值观', category: 'birth_chart', priority: 8, hub: 'twelve-houses' },
  { topic: '第二宫财运模式分析', category: 'birth_chart', priority: 7, hub: 'twelve-houses' },
  { topic: '第三宫：沟通与学习', category: 'birth_chart', priority: 7, hub: 'twelve-houses' },
  { topic: '第三宫思维特质解读', category: 'birth_chart', priority: 6, hub: 'twelve-houses' },
  { topic: '第四宫：家庭与根基', category: 'birth_chart', priority: 8, hub: 'twelve-houses' },
  { topic: '第四宫原生家庭影响', category: 'birth_chart', priority: 7, hub: 'twelve-houses' },
  { topic: '第五宫：创造与子女', category: 'birth_chart', priority: 7, hub: 'twelve-houses' },
  { topic: '第五宫才华表达方式', category: 'birth_chart', priority: 6, hub: 'twelve-houses' },
  { topic: '第六宫：工作与健康', category: 'birth_chart', priority: 7, hub: 'twelve-houses' },
  { topic: '第六宫日常习惯分析', category: 'birth_chart', priority: 6, hub: 'twelve-houses' },
  { topic: '第七宫：伴侣与合作', category: 'birth_chart', priority: 9, hub: 'twelve-houses' },
  { topic: '第七宫婚恋模式解读', category: 'birth_chart', priority: 8, hub: 'twelve-houses' },
  { topic: '第八宫：共享资源与转化', category: 'birth_chart', priority: 7, hub: 'twelve-houses' },
  { topic: '第八宫危机应对能力', category: 'birth_chart', priority: 6, hub: 'twelve-houses' },
  { topic: '第九宫：远方与信仰', category: 'birth_chart', priority: 6, hub: 'twelve-houses' },
  { topic: '第九宫人生哲学特质', category: 'birth_chart', priority: 5, hub: 'twelve-houses' },
  { topic: '第十宫：事业与成就', category: 'birth_chart', priority: 9, hub: 'twelve-houses' },
  { topic: '第十宫社会地位分析', category: 'birth_chart', priority: 8, hub: 'twelve-houses' },
  { topic: '第十一宫：群体与愿景', category: 'birth_chart', priority: 6, hub: 'twelve-houses' },
  { topic: '第十一宫社交模式解读', category: 'birth_chart', priority: 5, hub: 'twelve-houses' },
  { topic: '第十二宫：隐藏与灵性', category: 'birth_chart', priority: 6, hub: 'twelve-houses' },
  { topic: '第十二宫潜意识解析', category: 'birth_chart', priority: 5, hub: 'twelve-houses' },

  // 十神 (20篇)
  { topic: '正官：权威与规则', category: 'birth_chart', priority: 8, hub: 'ten-gods' },
  { topic: '正官格的职业发展', category: 'birth_chart', priority: 7, hub: 'ten-gods' },
  { topic: '七杀：魄力与压力', category: 'birth_chart', priority: 8, hub: 'ten-gods' },
  { topic: '七杀旺的应对策略', category: 'birth_chart', priority: 7, hub: 'ten-gods' },
  { topic: '正印：支持与庇护', category: 'birth_chart', priority: 7, hub: 'ten-gods' },
  { topic: '印绶格的学业事业', category: 'birth_chart', priority: 6, hub: 'ten-gods' },
  { topic: '偏印：独特与孤独', category: 'birth_chart', priority: 6, hub: 'ten-gods' },
  { topic: '枭神旺的心理特质', category: 'birth_chart', priority: 5, hub: 'ten-gods' },
  { topic: '正财：稳定收入与务实', category: 'birth_chart', priority: 8, hub: 'ten-gods' },
  { topic: '财星旺的理财模式', category: 'birth_chart', priority: 7, hub: 'ten-gods' },
  { topic: '偏财：投机与人脉财', category: 'birth_chart', priority: 7, hub: 'ten-gods' },
  { topic: '偏财格的投资倾向', category: 'birth_chart', priority: 6, hub: 'ten-gods' },
  { topic: '食神：才华与享受', category: 'birth_chart', priority: 7, hub: 'ten-gods' },
  { topic: '食神生财的成功路径', category: 'birth_chart', priority: 6, hub: 'ten-gods' },
  { topic: '伤官：创新与反叛', category: 'birth_chart', priority: 7, hub: 'ten-gods' },
  { topic: '伤官旺的事业选择', category: 'birth_chart', priority: 6, hub: 'ten-gods' },
  { topic: '比肩：独立与竞争', category: 'birth_chart', priority: 6, hub: 'ten-gods' },
  { topic: '比肩多的人际关系', category: 'birth_chart', priority: 5, hub: 'ten-gods' },
  { topic: '劫财：冒险与突破', category: 'birth_chart', priority: 6, hub: 'ten-gods' },
  { topic: '劫财旺的风险管理', category: 'birth_chart', priority: 5, hub: 'ten-gods' },

  // 相位组合 (16篇)
  { topic: '天干五合详解：甲己合土的化学反应', category: 'birth_chart', priority: 7, hub: 'aspects' },
  { topic: '地支六合详解：子丑合土的微妙变化', category: 'birth_chart', priority: 7, hub: 'aspects' },
  { topic: '地支三合详解：寅午戌三合火局', category: 'birth_chart', priority: 7, hub: 'aspects' },
  { topic: '地支六冲详解：子午冲的化解之道', category: 'birth_chart', priority: 8, hub: 'aspects' },
  { topic: '地支三刑详解：无恩之刑与风险', category: 'birth_chart', priority: 7, hub: 'aspects' },
  { topic: '天克地冲：最强烈的冲突信号', category: 'birth_chart', priority: 7, hub: 'aspects' },
  { topic: '财官双美格：事业财富俱佳的配置', category: 'birth_chart', priority: 7, hub: 'aspects' },
  { topic: '伤官见官：为什么说"祸百端"？', category: 'birth_chart', priority: 6, hub: 'aspects' },
  { topic: '官杀混杂：权力与压力的两难', category: 'birth_chart', priority: 6, hub: 'aspects' },
  { topic: '食神制杀：化压力为动力的格局', category: 'birth_chart', priority: 6, hub: 'aspects' },
  { topic: '印绶护身：贵人运旺的信号', category: 'birth_chart', priority: 6, hub: 'aspects' },
  { topic: '枭神夺食：才华被压制的原因', category: 'birth_chart', priority: 5, hub: 'aspects' },
  { topic: '羊刃格：极端性格的双刃剑', category: 'birth_chart', priority: 5, hub: 'aspects' },
  { topic: '禄神与财库：财富积累的根基', category: 'birth_chart', priority: 6, hub: 'aspects' },
  { topic: '驿马星：迁徙变动的命理信号', category: 'birth_chart', priority: 6, hub: 'aspects' },
  { topic: '桃花星：人缘与感情的指标', category: 'birth_chart', priority: 7, hub: 'aspects' },

  // === C. 关系与婚恋 (45篇) ===
  { topic: '暧昧期如何用八字判断对方心意？', category: 'relationship', priority: 8, hub: 'dating' },
  { topic: '八字看Ta是不是"对的人"', category: 'relationship', priority: 9, hub: 'dating' },
  { topic: '感情淡了是命中注定吗？', category: 'relationship', priority: 7, hub: 'dating' },
  { topic: '异地恋能不能走到最后？', category: 'relationship', priority: 7, hub: 'dating' },
  { topic: '办公室恋情：八字看职场桃花', category: 'relationship', priority: 6, hub: 'dating' },
  { topic: '八字看分手复合的可能性', category: 'relationship', priority: 8, hub: 'dating' },
  { topic: '为什么我总是遇到渣男/渣女？', category: 'relationship', priority: 8, hub: 'dating' },
  { topic: '八字看你的择偶标准是否合理', category: 'relationship', priority: 7, hub: 'dating' },
  { topic: '恋爱中的沟通障碍：八字解读', category: 'relationship', priority: 6, hub: 'dating' },
  { topic: '八字看你适合早恋还是晚婚', category: 'relationship', priority: 7, hub: 'dating' },
  { topic: '一见钟情vs日久生情：八字倾向', category: 'relationship', priority: 6, hub: 'dating' },
  { topic: '八字看你的恋爱节奏', category: 'relationship', priority: 6, hub: 'dating' },
  { topic: '为什么有些人恋爱总是很短？', category: 'relationship', priority: 6, hub: 'dating' },
  { topic: '八字看感情中的安全感来源', category: 'relationship', priority: 7, hub: 'dating' },
  { topic: '恋爱中的物质与精神：八字平衡', category: 'relationship', priority: 6, hub: 'dating' },

  { topic: '八字看婚姻的稳定性指标', category: 'relationship', priority: 9, hub: 'marriage' },
  { topic: '夫妻宫详解：Ta是什么样的人？', category: 'relationship', priority: 8, hub: 'marriage' },
  { topic: '八字看婚后的相处模式', category: 'relationship', priority: 8, hub: 'marriage' },
  { topic: '七年之痒：八字预警与化解', category: 'relationship', priority: 7, hub: 'marriage' },
  { topic: '八字看家庭责任的分配', category: 'relationship', priority: 6, hub: 'marriage' },
  { topic: '婆媳关系：八字看相处之道', category: 'relationship', priority: 6, hub: 'marriage' },
  { topic: '八字看子女缘与亲子关系', category: 'relationship', priority: 7, hub: 'marriage' },
  { topic: '二婚比头婚好的八字特征', category: 'relationship', priority: 6, hub: 'marriage' },
  { topic: '八字看婚姻中的财务管理', category: 'relationship', priority: 6, hub: 'marriage' },
  { topic: '八字看你会不会被婚姻改变', category: 'relationship', priority: 5, hub: 'marriage' },
  { topic: '中年危机与婚姻：八字视角', category: 'relationship', priority: 6, hub: 'marriage' },
  { topic: '八字看老年夫妻的相伴之道', category: 'relationship', priority: 5, hub: 'marriage' },
  { topic: '如何用八字经营长期关系？', category: 'relationship', priority: 7, hub: 'marriage' },
  { topic: '八字看离婚的高风险年份', category: 'relationship', priority: 7, hub: 'marriage' },
  { topic: '分居与离婚：八字的区别信号', category: 'relationship', priority: 5, hub: 'marriage' },

  // === D. 事业与财富 (45篇) ===
  { topic: '八字看你适合什么行业？', category: 'career', priority: 9, hub: 'career-positioning' },
  { topic: '五行与行业对应：选对赛道', category: 'career', priority: 8, hub: 'career-positioning' },
  { topic: '八字看你适合打工还是创业？', category: 'career', priority: 9, hub: 'career-positioning' },
  { topic: '八字看领导力潜质', category: 'career', priority: 7, hub: 'career-positioning' },
  { topic: '八字看团队协作能力', category: 'career', priority: 6, hub: 'career-positioning' },
  { topic: '八字看你的职场人设', category: 'career', priority: 7, hub: 'career-positioning' },
  { topic: '八字看跳槽的最佳时机', category: 'career', priority: 8, hub: 'career-positioning' },
  { topic: '八字看副业与兼职的潜力', category: 'career', priority: 6, hub: 'career-positioning' },
  { topic: '八字看职场瓶颈与突破', category: 'career', priority: 7, hub: 'career-positioning' },
  { topic: '八字看退休规划', category: 'career', priority: 5, hub: 'career-positioning' },
  { topic: '八字看升职加薪的时机', category: 'career', priority: 8, hub: 'career-positioning' },
  { topic: '八字看与上司的关系', category: 'career', priority: 6, hub: 'career-positioning' },
  { topic: '八字看与同事的竞合关系', category: 'career', priority: 5, hub: 'career-positioning' },
  { topic: '八字看职场贵人运', category: 'career', priority: 7, hub: 'career-positioning' },
  { topic: '八字看创业的最佳时机', category: 'career', priority: 8, hub: 'career-positioning' },

  { topic: '八字看赚钱方式：主动vs被动收入', category: 'career', priority: 8, hub: 'wealth' },
  { topic: '八字看消费习惯与理财倾向', category: 'career', priority: 7, hub: 'wealth' },
  { topic: '八字看投资风格：保守vs激进', category: 'career', priority: 7, hub: 'wealth' },
  { topic: '八字看财运的周期性', category: 'career', priority: 8, hub: 'wealth' },
  { topic: '八字看意外之财与横财', category: 'career', priority: 6, hub: 'wealth' },
  { topic: '八字看破财的高风险年份', category: 'career', priority: 7, hub: 'wealth' },
  { topic: '八字看债务与借贷', category: 'career', priority: 5, hub: 'wealth' },
  { topic: '八字看合伙做生意的风险', category: 'career', priority: 6, hub: 'wealth' },
  { topic: '八字看房产投资的时机', category: 'career', priority: 6, hub: 'wealth' },
  { topic: '八字看存钱能力', category: 'career', priority: 6, hub: 'wealth' },
  { topic: '八字看财富积累的长期路径', category: 'career', priority: 7, hub: 'wealth' },
  { topic: '八字看你的财富天花板', category: 'career', priority: 6, hub: 'wealth' },
  { topic: '八字看家族财运的传承', category: 'career', priority: 5, hub: 'wealth' },
  { topic: '八字看经济危机中的应对', category: 'career', priority: 6, hub: 'wealth' },
  { topic: '八字看数字货币投资倾向', category: 'career', priority: 6, hub: 'wealth' },

  // === E. 行运与时机 (35篇) - 部分示例 ===
  { topic: '大运切换：为什么人生会"换挡"', category: 'timing', priority: 9, hub: 'dayun' },
  { topic: '大运十年如何分段：前中后期', category: 'timing', priority: 8, hub: 'dayun' },
  { topic: '好大运坏流年vs坏大运好流年', category: 'timing', priority: 8, hub: 'dayun' },
  { topic: '土星回归：30岁的人生考验', category: 'timing', priority: 9, hub: 'cycles' },
  { topic: '木星回归：12年的成长周期', category: 'timing', priority: 7, hub: 'cycles' },
  { topic: '本命年：真的那么可怕吗？', category: 'timing', priority: 8, hub: 'cycles' },
  { topic: '犯太岁的年份怎么过？', category: 'timing', priority: 8, hub: 'cycles' },
  { topic: '水逆真的影响很大吗？', category: 'timing', priority: 6, hub: 'cycles' },
  { topic: '日食月食对运势的影响', category: 'timing', priority: 5, hub: 'cycles' },
  { topic: '如何选择结婚的黄道吉日？', category: 'timing', priority: 7, hub: 'timing-selection' },
  { topic: '如何选择开业的最佳时机？', category: 'timing', priority: 7, hub: 'timing-selection' },
  { topic: '如何选择搬家的吉日？', category: 'timing', priority: 6, hub: 'timing-selection' },
  { topic: '择日的基本原则', category: 'timing', priority: 6, hub: 'timing-selection' },

  // 继续添加更多...省略部分以节省空间

  // === F-J 栏目 (其余90篇) ===
  // 合盘25篇、预测20篇、案例30篇、方法5篇、FAQ 10篇
  // 完整列表请参考 knowledgeContentPlan.json
];

// ============ 核心函数 ============

// 初始化队列
function initQueue() {
  const db = getDb();

  // 检查已存在的任务
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM content_generation_queue').get().count;
  if (existingCount > 0) {
    console.log(`队列中已有 ${existingCount} 个任务，跳过初始化`);
    return;
  }

  const insertStmt = db.prepare(`
    INSERT INTO content_generation_queue
    (id, topic, category, topic_hub, priority, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `);

  const now = new Date().toISOString();
  let count = 0;

  for (const item of CONTENT_PLAN) {
    insertStmt.run(
      nanoid(),
      item.topic,
      item.category,
      item.hub || null,
      item.priority || 5,
      now
    );
    count++;
  }

  console.log(`✓ 已初始化 ${count} 个生成任务到队列`);
}

// 获取待处理任务
function getPendingTasks(limit, category = null) {
  const db = getDb();
  let sql = `
    SELECT * FROM content_generation_queue
    WHERE status = 'pending'
  `;
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY priority DESC, created_at ASC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

// 更新任务状态
function updateTaskStatus(taskId, status, articleId = null, errorMessage = null) {
  const db = getDb();
  const now = new Date().toISOString();

  if (status === 'generating') {
    db.prepare(`
      UPDATE content_generation_queue
      SET status = ?, started_at = ?
      WHERE id = ?
    `).run(status, now, taskId);
  } else if (status === 'completed') {
    db.prepare(`
      UPDATE content_generation_queue
      SET status = ?, article_id = ?, completed_at = ?
      WHERE id = ?
    `).run(status, articleId, now, taskId);
  } else if (status === 'failed') {
    db.prepare(`
      UPDATE content_generation_queue
      SET status = ?, error_message = ?, retry_count = retry_count + 1
      WHERE id = ?
    `).run(status, errorMessage, taskId);
  }
}

// 调用 LLM API
async function callLLM(prompt, model = PRIMARY_MODEL) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 解析 JSON 响应
function parseArticleResponse(content) {
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('JSON 解析失败:', error.message);
    return null;
  }
}

// 质量检查
function validateArticle(article) {
  const checks = {
    hasTitle: !!article.title && article.title.length >= 8,
    hasSummary: !!article.summary && article.summary.length >= 30,
    hasContent: !!article.content && article.content.length >= 500,
    contentNotTooLong: article.content && article.content.length <= 3000,
    hasTags: article.tags && article.tags.length >= 2,
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;

  return {
    valid: passed >= total * 0.8,
    score: passed / total,
    details: checks,
  };
}

// 生成单篇文章
async function generateArticle(task) {
  const prompt = buildArticlePrompt(task.topic, task.category, task.topic_hub);

  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`  [${model}] 生成中...`);
      const response = await callLLM(prompt, model);
      const article = parseArticleResponse(response);

      if (!article) {
        console.log(`  [${model}] JSON 解析失败，切换模型`);
        continue;
      }

      const validation = validateArticle(article);
      if (!validation.valid) {
        console.log(`  [${model}] 质量检查未通过:`, validation.details);
        continue;
      }

      return { success: true, article, model };
    } catch (error) {
      console.log(`  [${model}] 失败: ${error.message}`);
      lastError = error;
    }
  }

  return { success: false, error: lastError?.message || '所有模型均失败' };
}

// 保存文章到数据库
function saveArticle(task, articleData, model) {
  const slug = articleData.title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || nanoid(10);

  const articleId = nanoid();
  const now = new Date().toISOString();

  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO knowledge_articles (
      id, slug, title, category, level, tags, summary, content,
      view_count, created_at, updated_at, published,
      topic_hub, generation_model, generation_version, related_articles
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    articleId,
    slug + '-' + nanoid(4), // 确保唯一性
    articleData.title,
    task.category,
    articleData.difficulty || 1,
    JSON.stringify(articleData.tags || []),
    articleData.summary,
    articleData.content,
    0,
    now,
    now,
    1,
    task.topic_hub || null,
    model,
    1,
    JSON.stringify(articleData.relatedSlugs || [])
  );

  return articleId;
}

// 批量生成
async function processBatch(limit, category = null) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  知识内容批量生成器');
  console.log('═'.repeat(60));
  console.log(`阶段: ${PHASE} | 批次大小: ${limit} | 栏目: ${category || '全部'}`);
  console.log('');

  const tasks = getPendingTasks(limit, category);
  if (tasks.length === 0) {
    console.log('✓ 没有待处理的任务');
    return;
  }

  console.log(`找到 ${tasks.length} 个待处理任务\n`);

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`[${i + 1}/${tasks.length}] ${task.topic}`);
    console.log(`  栏目: ${task.category} | 优先级: ${task.priority}`);

    updateTaskStatus(task.id, 'generating');

    const result = await generateArticle(task);

    if (result.success) {
      const articleId = saveArticle(task, result.article, result.model);
      updateTaskStatus(task.id, 'completed', articleId);
      console.log(`  ✓ 成功 (模型: ${result.model})`);
      completed++;
    } else {
      updateTaskStatus(task.id, 'failed', null, result.error);
      console.log(`  ✗ 失败: ${result.error}`);
      failed++;
    }

    // 批次间延迟
    if (i < tasks.length - 1) {
      console.log(`  等待 ${config.delayBetweenArticles / 1000} 秒...`);
      await new Promise(r => setTimeout(r, config.delayBetweenArticles));
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`完成: ${completed} | 失败: ${failed}`);
  console.log('─'.repeat(60));
}

// 显示状态
function showStatus() {
  const db = getDb();

  const queueStats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM content_generation_queue
    GROUP BY status
  `).all();

  const articleCount = db.prepare(`
    SELECT COUNT(*) as count FROM knowledge_articles WHERE published = 1
  `).get().count;

  const categoryStats = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM content_generation_queue
    WHERE status = 'pending'
    GROUP BY category
    ORDER BY count DESC
  `).all();

  console.log('\n═══ 知识内容生成状态 ═══\n');
  console.log('队列状态:');
  for (const stat of queueStats) {
    console.log(`  ${stat.status}: ${stat.count}`);
  }
  console.log(`\n已发布文章: ${articleCount} / 300 (${Math.round(articleCount / 300 * 100)}%)`);
  console.log('\n待生成 (按栏目):');
  for (const stat of categoryStats) {
    console.log(`  ${stat.category}: ${stat.count}`);
  }
}

// 重试失败任务
function retryFailed() {
  const db = getDb();
  const result = db.prepare(`
    UPDATE content_generation_queue
    SET status = 'pending'
    WHERE status = 'failed' AND retry_count < 3
  `).run();

  console.log(`✓ 已重置 ${result.changes} 个失败任务`);
}

// ============ 主函数 ============

async function main() {
  // 初始化数据库
  initSchema();

  if (INIT_QUEUE) {
    initQueue();
    return;
  }

  if (SHOW_STATUS) {
    showStatus();
    return;
  }

  if (RETRY_FAILED) {
    retryFailed();
    return;
  }

  // 执行批量生成
  await processBatch(BATCH_SIZE, CATEGORY_FILTER);
}

// 运行
main().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
