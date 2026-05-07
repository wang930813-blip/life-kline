import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const seedDir = path.join(rootDir, 'data', 'seed-content');

const sourceRefs = {
  fourPillars: 'https://en.wikipedia.org/wiki/Four_Pillars_of_Destiny',
  chineseAstrology: 'https://en.wikipedia.org/wiki/Chinese_astrology',
  taiSui: 'https://en.wikipedia.org/wiki/Tai_Sui',
  ohlc: 'https://en.wikipedia.org/wiki/Open-high-low-close_chart',
  candlestick: 'https://en.wikipedia.org/wiki/Candlestick_chart',
  luckPillars: 'https://www.mingdecode.com/bazi/en/explain/big-luck',
  steveJobs: 'https://en.wikipedia.org/wiki/Steve_Jobs',
  samAltman: 'https://en.wikipedia.org/wiki/Sam_Altman',
  jensenHuang: 'https://en.wikipedia.org/wiki/Jensen_Huang',
  vitalik: 'https://en.wikipedia.org/wiki/Vitalik_Buterin',
  ethereum: 'https://en.wikipedia.org/wiki/Ethereum',
  nvidia: 'https://nvidianews.nvidia.com/_gallery/download_pdf/54481904f6091d2735000003/',
  britannicaJobs: 'https://www.britannica.com/biography/Steve-Jobs',
  britannicaHuang: 'https://www.britannica.com/biography/Jensen-Huang',
  arsOpenAI: 'https://arstechnica.com/information-technology/2023/11/sam-altman-officially-back-as-openai-ceo-we-didnt-lose-a-single-employee/',
};

const categoryNames = {
  quickstart: '快速入门',
  kline: 'K线逻辑',
  bazi: '八字基础',
  dayun: '大运流年',
  method: '方法误区',
  faq: '常见问题',
};

const topics = [
  ['quickstart', '四柱填写第一步：年、月、日、时分别看什么', '四柱不是四个孤立标签，而是时间信息的四层坐标。', ['四柱', '入门']],
  ['quickstart', '起运年龄怎么理解：虚岁、周岁与节气差', '起运年龄表示大运何时开始接管人生节奏。', ['起运', '大运']],
  ['quickstart', '顺排与逆排：第一步大运为什么会不同', '大运方向来自性别、年干阴阳和传统排盘规则。', ['顺逆', '排盘']],
  ['quickstart', '一分钟看懂人生K线：峰、谷、趋势和波动', '人生K线把年份运势转成可以扫描的趋势图。', ['K线', '趋势']],
  ['quickstart', '吉年不等于躺赢，凶年不等于失败', '运势更像环境风向，真正结果还取决于行动和风险控制。', ['吉凶', '决策']],
  ['kline', '人生K线四价：开、高、低、收如何映射年度状态', 'OHLC 思路可以帮助理解一年中的起落过程。', ['OHLC', '年度']],
  ['kline', '牛市、熊市与震荡期：人生阶段的三种节奏', '趋势判断比单一年份分数更适合做长期规划。', ['牛熊', '阶段']],
  ['kline', '大运切换为什么像换挡', '十年周期改变背景能量，也会改变同一年事件的解释。', ['大运', '换挡']],
  ['kline', '单年冲高回落：好年份也要防止过度扩张', '高点年份不只意味着机会，也意味着暴露度上升。', ['冲高', '风控']],
  ['kline', '深V走势：低谷中的反转信号怎么读', '低分年份如果后续接连续上行，往往是重组和反弹窗口。', ['反转', '低谷']],
  ['bazi', '天干地支入门：十天干与十二地支的组合', '干支是四柱系统的基本字符集。', ['干支', '基础']],
  ['bazi', '五行生克：金木水火土如何形成动态平衡', '五行不是标签，而是互相推动和制约的关系网。', ['五行', '生克']],
  ['bazi', '日主是什么：为什么日柱天干最关键', '日主是命盘分析的观察中心。', ['日主', '命盘']],
  ['bazi', '十神入门：把抽象关系翻译成人生事件', '十神帮助把五行关系转成人际、事业和资源语言。', ['十神', '事件']],
  ['bazi', '喜用与忌神：同一流年为何有人顺有人难', '同一外部年份进入不同命盘，会产生不同作用。', ['喜用', '流年']],
  ['dayun', '大运是背景，流年是触发器', '十年大运提供底色，年度流年触发具体事件。', ['大运', '流年']],
  ['dayun', '十年大运如何分段：前期、中期、后期', '一个大运内部也有渐入、发力和收束。', ['十年', '节奏']],
  ['dayun', '冲合刑害的直观理解', '冲合刑害可理解为关系结构的拉扯、绑定与摩擦。', ['冲合', '刑害']],
  ['dayun', '太岁和犯太岁：文化概念如何理性使用', '太岁源自岁星周期和民俗信仰，适合作为年度提醒。', ['太岁', '民俗']],
  ['dayun', '迁移变动年：换城市、换行业和换身份', '变动年不一定坏，关键是提前留出缓冲。', ['迁移', '变动']],
  ['method', '评分怎么看：不要只盯最高分年份', '分数是压缩指标，必须结合趋势、波动和主题。', ['评分', '方法']],
  ['method', '误区一：把命理当确定性预言', '命理分析更适合做风险地图，而不是替代选择。', ['误区', '预言']],
  ['method', '误区二：只追旺运，忽略能力修炼', '好运放大能力，坏运考验系统。', ['能力', '旺运']],
  ['method', '如何用K线图做人生复盘', '年度、三年和十年三个尺度可以互相校验。', ['复盘', '规划']],
  ['method', '如何看待AI命理：模型输出需要人类校准', 'AI适合整理线索，但不应取代现实判断。', ['AI', '校准']],
  ['faq', '没有准确出生时辰怎么办', '时辰会影响时柱和细节判断，不确定时应降低结论精度。', ['时辰', 'FAQ']],
  ['faq', '阳历、农历和节气到底按哪个算', '四柱排盘通常以节气系统划分月份。', ['历法', '节气']],
  ['faq', '同八字的人命运会完全一样吗', '命盘相同不等于环境、教育、选择和时代相同。', ['同八字', '差异']],
  ['faq', '人生K线分数能不能当投资建议', '不能，K线分数只做人生节奏参考，不构成金融建议。', ['投资', '风险']],
  ['faq', '为什么历史数据会影响未来解读', '历史事件能帮助校准模型，但不能机械外推未来。', ['历史', '校准']],
];

const articleSourceFor = (category) => {
  if (category === 'kline') return [sourceRefs.ohlc, sourceRefs.candlestick];
  if (category === 'dayun') return [sourceRefs.luckPillars, sourceRefs.taiSui, sourceRefs.chineseAstrology];
  if (category === 'faq') return [sourceRefs.fourPillars, sourceRefs.chineseAstrology];
  return [sourceRefs.fourPillars, sourceRefs.chineseAstrology];
};

const makeArticle = ([category, title, summary, tags], index) => {
  const slug = `${category}-${String(index + 1).padStart(2, '0')}-${title
    .replace(/[：、，。？]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)}`;
  const sourceList = articleSourceFor(category);
  const fullSummary = summary.length < 20 ? `${summary} 这是读懂人生K线前需要先掌握的基础概念。` : summary;
  const content = `# ${title}

## 核心理解
${fullSummary} 在人生K线里，我们不把它当作神秘口号，而是把它转成可以观察的时间结构：哪些年份更适合主动推进，哪些年份更适合收缩、复盘和修补系统。

## 放到图上怎么看
阅读时先看十年大势，再看单年波动。高点代表资源、曝光和机会变多，低点代表消耗、阻力或结构调整。若连续数年上行，说明阶段势能在积累；若高点后迅速回落，就要关注过度扩张、现金流和关系压力。

## 实用建议
使用这个概念时，不要只问“好不好”，而要问“该怎么行动”。上行阶段适合争取机会、建立作品和扩大连接；下行阶段适合降杠杆、补短板、整理健康和家庭关系。这样命理分析才会变成决策辅助，而不是情绪暗示。

## 使用边界
命理和K线都不是确定性预言。它们更像一张复盘地图，把过去的经验、当下的状态和未来的风险放在同一个时间轴上。真正落地时，仍要结合行业周期、家庭责任、健康状况、现金流和个人选择来判断。尤其涉及投资、医疗、婚姻和重大迁移时，应把命理结论作为提醒，而不是唯一依据。

## 参考资料
${sourceList.map((url) => `- ${url}`).join('\n')}`;

  return {
    id: `knowledge_${category}_${String(index + 1).padStart(2, '0')}`,
    slug,
    title,
    category,
    level: category === 'quickstart' || category === 'faq' ? 1 : 2,
    tags: [...tags, categoryNames[category]],
    summary: fullSummary,
    content,
    sourceRefs: sourceList,
    published: true,
    createdAt: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
  };
};

const categoryCn = {
  sudden_downfall: '巨星陨落与意外',
  rising_power: '逆袭与实力爆发',
  corporate_fate: '商业帝国运势',
  ai_tech: 'AI纪元与科技新贵',
  crypto_macro: '虚拟资产与宏观',
};

const celebrityCases = [
  ['steve-jobs', 'Steve Jobs', '史蒂夫·乔布斯', 'sudden_downfall', '1955-02-24', 'San Francisco, California, USA', ['1976: co-founded Apple', '1985: left Apple', '1997: returned to Apple', '2011: died'], [sourceRefs.steveJobs, sourceRefs.britannicaJobs]],
  ['kobe-bryant', 'Kobe Bryant', '科比·布莱恩特', 'sudden_downfall', '1978-08-23', 'Philadelphia, Pennsylvania, USA', ['1996: entered NBA', '2000: first NBA title era', '2016: final game', '2020: died in accident'], ['https://en.wikipedia.org/wiki/Kobe_Bryant']],
  ['bruce-lee', 'Bruce Lee', '李小龙', 'sudden_downfall', '1940-11-27', 'San Francisco, California, USA', ['1959: moved to United States', '1971: The Big Boss released', '1973: died', '1973: Enter the Dragon released'], ['https://en.wikipedia.org/wiki/Bruce_Lee']],
  ['leslie-cheung', 'Leslie Cheung', '张国荣', 'sudden_downfall', '1956-09-12', 'Hong Kong', ['1977: entered music industry', '1986: A Better Tomorrow', '1993: Farewell My Concubine', '2003: died'], ['https://en.wikipedia.org/wiki/Leslie_Cheung']],
  ['elizabeth-holmes', 'Elizabeth Holmes', '伊丽莎白·霍姆斯', 'sudden_downfall', '1984-02-03', 'Washington, D.C., USA', ['2003: founded Theranos', '2014: public peak', '2015: investigations began', '2022: convicted'], ['https://en.wikipedia.org/wiki/Elizabeth_Holmes', 'https://en.wikipedia.org/wiki/Theranos']],

  ['j-k-rowling', 'J. K. Rowling', 'J.K.罗琳', 'rising_power', '1965-07-31', 'Yate, England', ['1997: Harry Potter first published', '2001: first film released', '2004: became billionaire author'], ['https://en.wikipedia.org/wiki/J._K._Rowling']],
  ['elon-musk', 'Elon Musk', '埃隆·马斯克', 'rising_power', '1971-06-28', 'Pretoria, South Africa', ['1995: founded Zip2', '2002: founded SpaceX', '2008: Tesla crisis and recovery', '2020: Tesla market value surged'], ['https://en.wikipedia.org/wiki/Elon_Musk']],
  ['oprah-winfrey', 'Oprah Winfrey', '奥普拉·温弗瑞', 'rising_power', '1954-01-29', 'Kosciusko, Mississippi, USA', ['1986: The Oprah Winfrey Show nationally syndicated', '1998: founded Harpo projects', '2013: Presidential Medal of Freedom'], ['https://en.wikipedia.org/wiki/Oprah_Winfrey']],
  ['jack-ma', 'Jack Ma', '马云', 'rising_power', '1964-09-10', 'Hangzhou, China', ['1999: founded Alibaba', '2014: Alibaba IPO', '2020: Ant Group IPO suspended'], ['https://en.wikipedia.org/wiki/Jack_Ma']],
  ['cristiano-ronaldo', 'Cristiano Ronaldo', '克里斯蒂亚诺·罗纳尔多', 'rising_power', '1985-02-05', 'Funchal, Madeira, Portugal', ['2003: joined Manchester United', '2008: first Ballon d Or', '2016: European champion'], ['https://en.wikipedia.org/wiki/Cristiano_Ronaldo']],

  ['warren-buffett', 'Warren Buffett', '沃伦·巴菲特', 'corporate_fate', '1930-08-30', 'Omaha, Nebraska, USA', ['1965: took control of Berkshire Hathaway', '1988: began Coca-Cola investment', '2006: pledged philanthropy'], ['https://en.wikipedia.org/wiki/Warren_Buffett']],
  ['bill-gates', 'Bill Gates', '比尔·盖茨', 'corporate_fate', '1955-10-28', 'Seattle, Washington, USA', ['1975: founded Microsoft', '1986: Microsoft IPO', '2000: stepped down as CEO'], ['https://en.wikipedia.org/wiki/Bill_Gates']],
  ['jeff-bezos', 'Jeff Bezos', '杰夫·贝索斯', 'corporate_fate', '1964-01-12', 'Albuquerque, New Mexico, USA', ['1994: founded Amazon', '1997: Amazon IPO', '2021: stepped down as CEO'], ['https://en.wikipedia.org/wiki/Jeff_Bezos']],
  ['satya-nadella', 'Satya Nadella', '萨提亚·纳德拉', 'corporate_fate', '1967-08-19', 'Hyderabad, India', ['1992: joined Microsoft', '2014: became CEO', '2023: AI strategy accelerated'], ['https://en.wikipedia.org/wiki/Satya_Nadella']],
  ['pony-ma', 'Pony Ma', '马化腾', 'corporate_fate', '1971-10-29', 'Shantou, China', ['1998: co-founded Tencent', '2004: Tencent IPO', '2011: WeChat launched'], ['https://en.wikipedia.org/wiki/Pony_Ma']],

  ['sam-altman', 'Sam Altman', '山姆·奥特曼', 'ai_tech', '1985-04-22', 'Chicago, Illinois, USA', ['2014: became Y Combinator president', '2019: became OpenAI CEO', '2022: ChatGPT released', '2023: returned as OpenAI CEO'], [sourceRefs.samAltman, sourceRefs.arsOpenAI]],
  ['jensen-huang', 'Jensen Huang', '黄仁勋', 'ai_tech', '1963-02-17', 'Tainan, Taiwan', ['1993: founded NVIDIA', '1999: NVIDIA IPO', '2023: AI chip demand surged'], [sourceRefs.jensenHuang, sourceRefs.nvidia, sourceRefs.britannicaHuang]],
  ['demis-hassabis', 'Demis Hassabis', '戴密斯·哈萨比斯', 'ai_tech', '1976-07-27', 'London, England', ['2010: co-founded DeepMind', '2014: Google acquired DeepMind', '2024: Nobel Prize in Chemistry'], ['https://en.wikipedia.org/wiki/Demis_Hassabis']],
  ['ilya-sutskever', 'Ilya Sutskever', '伊利亚·苏茨克维', 'ai_tech', '1986-12-08', 'Nizhny Novgorod, Russia', ['2012: AlexNet era', '2015: co-founded OpenAI', '2024: founded Safe Superintelligence'], ['https://en.wikipedia.org/wiki/Ilya_Sutskever', 'https://apnews.com/article/c6b48a3675fb3fb459859dece2b45499']],
  ['fei-fei-li', 'Fei-Fei Li', '李飞飞', 'ai_tech', '1976-07-03', 'Beijing, China', ['2009: ImageNet launched', '2017: joined Google Cloud AI', '2024: launched World Labs'], ['https://en.wikipedia.org/wiki/Fei-Fei_Li']],

  ['vitalik-buterin', 'Vitalik Buterin', '维塔利克·布特林', 'crypto_macro', '1994-01-31', 'Kolomna, Russia', ['2011: co-founded Bitcoin Magazine', '2013: Ethereum idea proposed', '2015: Ethereum launched'], [sourceRefs.vitalik, sourceRefs.ethereum]],
  ['satoshi-nakamoto', 'Satoshi Nakamoto', '中本聪', 'crypto_macro', '1975-04-05', 'Unknown', ['2008: Bitcoin white paper published', '2009: Bitcoin network launched', '2010: withdrew from public activity'], ['https://en.wikipedia.org/wiki/Satoshi_Nakamoto', 'https://en.wikipedia.org/wiki/Bitcoin']],
  ['changpeng-zhao', 'Changpeng Zhao', '赵长鹏', 'crypto_macro', '1977-09-10', 'Jiangsu, China', ['2017: founded Binance', '2021: Binance became dominant exchange', '2023: stepped down as CEO'], ['https://en.wikipedia.org/wiki/Changpeng_Zhao', 'https://en.wikipedia.org/wiki/Binance']],
  ['sam-bankman-fried', 'Sam Bankman-Fried', '萨姆·班克曼-弗里德', 'crypto_macro', '1992-03-06', 'Stanford, California, USA', ['2019: founded FTX', '2021: crypto boom peak', '2022: FTX collapsed', '2023: convicted'], ['https://en.wikipedia.org/wiki/Sam_Bankman-Fried', 'https://en.wikipedia.org/wiki/FTX']],
  ['do-kwon', 'Do Kwon', '权道亨', 'crypto_macro', '1991-09-06', 'Seoul, South Korea', ['2018: co-founded Terraform Labs', '2021: Terra ecosystem expanded', '2022: TerraUSD and Luna collapsed'], ['https://en.wikipedia.org/wiki/Do_Kwon', 'https://en.wikipedia.org/wiki/Terra_(blockchain)']],
];

const eventToPoint = (event, birthYear) => {
  const year = Number(event.slice(0, 4));
  const isTrough = /died|convicted|collapsed|suspended|left|down|crisis|investigations|stepped down/.test(event);
  const isPeak = /IPO|released|founded|launched|surged|champion|Nobel|returned|became|published|first/.test(event);
  const score = isTrough ? 28 : isPeak ? 86 : 62;
  return {
    age: Math.max(1, year - birthYear),
    year,
    ganZhi: '',
    open: Math.max(10, score - 10),
    close: score,
    high: Math.min(100, score + 8),
    low: Math.max(1, score - 18),
    score,
    reason: event.replace(/^\d{4}:\s*/, ''),
  };
};

const makeChart = (events, birthDate) => {
  const birthYear = Number(birthDate.slice(0, 4));
  const points = [];
  for (let age = 1; age <= 80; age += 5) {
    const year = birthYear + age;
    const base = 48 + Math.round(Math.sin(age / 7) * 12 + age * 0.18);
    points.push({
      age,
      year,
      ganZhi: '',
      open: Math.max(1, base - 5),
      close: base,
      high: Math.min(100, base + 8),
      low: Math.max(1, base - 12),
      score: base,
      reason: '阶段性背景走势',
    });
  }
  return [...points, ...events.map((event) => eventToPoint(event, birthYear))]
    .filter((point, index, arr) => arr.findIndex((item) => item.age === point.age) === index)
    .sort((a, b) => a.age - b.age);
};

const makeCelebrity = ([id, name, nameCn, category, birthDate, city, events, refs], index) => {
  const birthYear = Number(birthDate.slice(0, 4));
  const chartData = makeChart(events, birthDate);
  const highlights = events.slice(0, 4).map((event) => {
    const point = eventToPoint(event, birthYear);
    return {
      age: point.age,
      year: point.year,
      type: point.score >= 70 ? 'peak' : 'trough',
      note: event.replace(/^\d{4}:\s*/, ''),
    };
  });
  const analysisData = buildCelebrityAnalysisData(nameCn, category, events, refs);
  const scores = buildCelebrityScores(category, chartData);
  return {
    id,
    name,
    name_cn: nameCn,
    category,
    category_cn: categoryCn[category],
    birth_date: birthDate,
    birth_location_city: city,
    birth_location_lat: 0,
    birth_location_lng: 0,
    description: `${nameCn}的公开轨迹适合作为「${categoryCn[category]}」样本：从公开履历中的关键年份出发，观察高光、转折和风险释放如何在一条人生K线中呈现。公开资料通常没有可靠出生时辰，本案例不伪造精确四柱，主要用于学习事件节奏与趋势复盘。`,
    tags: [categoryCn[category], '公开资料', '人生K线'],
    year_pillar: '未详',
    month_pillar: '未详',
    day_pillar: '未详',
    hour_pillar: '未详',
    chart_data: chartData,
    highlights,
    events,
    sourceRefs: refs,
    analysis_data: analysisData,
    scores,
    financial_data: buildFinancialData(category, nameCn),
    honors: buildHonors(events),
    analysis_generated_at: new Date(Date.UTC(2025, 0, 15 + index)).toISOString(),
    analysis_version: 1,
    hotness_score: Math.max(60, 98 - index),
    view_count: 0,
    published: true,
  };
};

const categoryTone = {
  sudden_downfall: '高光之后出现剧烈回落，适合观察风险暴露、健康压力、舆论周期和人生无常。',
  rising_power: '早期积累较长，后续通过关键机会实现跃迁，适合观察低谷蓄势和爆发窗口。',
  corporate_fate: '事业曲线带有明显组织周期，适合观察长期复利、平台选择和权力交接。',
  ai_tech: '技术浪潮推动个人与组织快速上行，适合观察时代风口和认知杠杆。',
  crypto_macro: '波动强、周期短、风险释放猛烈，适合观察财富弹性与风控边界。',
};

function buildCelebrityAnalysisData(nameCn, category, events, refs) {
  const eventText = events.map((event) => event.replace(':', ' 年：')).join('；');
  const tone = categoryTone[category];
  const sourceText = refs.join('、');

  return {
    summary: `${nameCn}的公开人生轨迹显示出「${tone}」这一类样本特征。这里的命理分析不依赖未经证实的出生时辰，而是把公开年份事件放入人生K线中观察：${eventText}。从复盘角度看，关键不是把某一年简单判成吉凶，而是理解资源、压力、选择和时代环境如何共同改变曲线。参考公开资料：${sourceText}。`,
    personality: `${nameCn}的案例提示我们，人物性格不能只用单一标签解释。公开事件中的持续投入、关键转向和危机反应，往往比抽象描述更能说明问题。若按人生K线阅读，此类人物通常在高压阶段展现强目标感和强行动力，但也可能因为节奏过快、外部期待过高而承受额外消耗。学习这个案例时，应重点看其如何处理机会、声誉、团队关系与长期压力。`,
    career: `${nameCn}的事业线最值得观察的是关键节点之间的连接，而不是孤立的成败。公开资料中的年份事件提供了可复盘坐标：${eventText}。当曲线连续上行时，往往对应平台扩张、作品突破、资本关注或技术浪潮；当曲线回落时，常见原因包括周期结束、管理失衡、外部冲击或个人健康压力。这个案例适合用来训练“先看趋势，再看节点”的阅读方式。`,
    wealth: `${nameCn}相关的财富或资源变化，应被理解为影响力、资产、声誉和选择权的综合变化。人生K线中的高点并不等于绝对安全，高点也可能伴随更高曝光和更高风险；低点也不必然意味着失败，低点有时是资源重组和策略调整的窗口。这个案例提醒用户，在上行阶段要保留冗余，在波动阶段要降低不可逆风险。`,
    marriage: `${nameCn}的公开资料主要集中在事业和社会事件，私人关系部分不宜过度推断。因此本模块只给方法提示：阅读名人案例时，关系维度应关注责任、支持系统、压力分担和舆论边界，而不是把公开事件直接等同于亲密关系结论。若缺少可靠资料，应主动降低判断强度，避免用命理语言包装猜测。`,
    health: `${nameCn}的曲线复盘也提醒我们，健康和心理承压是人生K线中容易被忽略的底层变量。高强度上行期常伴随睡眠、情绪、决策疲劳和身体透支；剧烈回落期则可能放大焦虑和孤立感。无论命理评分如何，健康都应被视为长期复利的地基。案例阅读的实用结论是：越在高点，越要建立休息、体检、运动和支持系统。`,
    lifeTrajectory: `${nameCn}的轨迹可以拆成三个层次：第一是公开事件层，记录关键年份发生了什么；第二是趋势层，观察这些年份之间是连续上行、震荡还是断崖回落；第三是策略层，思考如果处在相似阶段，应如何管理机会和风险。人生K线的价值正在于把这三层放在同一张图上，帮助用户从故事转向复盘。`,
    fengShui: `此处的风水建议采用现代化解释：环境就是长期行为的容器。学习${nameCn}这类案例时，可以把“风水”理解为信息环境、人际环境、工作节奏和风险边界。若曲线处于上升期，应让环境支持专注和恢复；若曲线处于震荡期，应减少噪音、整理资产和关系账本，先稳住系统。`,
  };
}

function buildCelebrityScores(category, chartData) {
  const avg = Math.round(chartData.reduce((sum, item) => sum + item.score, 0) / chartData.length);
  const categoryBias = {
    sudden_downfall: -8,
    rising_power: 10,
    corporate_fate: 8,
    ai_tech: 12,
    crypto_macro: -2,
  }[category] || 0;
  const clamp = (value) => Math.max(35, Math.min(96, value));

  return {
    overall: clamp(avg + categoryBias),
    personality: clamp(avg + 8),
    career: clamp(avg + categoryBias + 10),
    wealth: clamp(avg + categoryBias + 5),
    marriage: clamp(avg - 2),
    health: clamp(avg - (category === 'sudden_downfall' ? 15 : 4)),
  };
}

function buildFinancialData(category, nameCn) {
  if (!['corporate_fate', 'ai_tech', 'crypto_macro', 'rising_power'].includes(category)) return null;
  return {
    netWorth: '以公开资料和媒体报道为参考，具体数值随时间变化',
    marketCap: category === 'corporate_fate' || category === 'ai_tech' ? '关联企业市值随市场周期变化' : undefined,
    peakNetWorth: category === 'crypto_macro' ? '高波动周期中峰值变化较大' : undefined,
    majorHoldings: [nameCn, categoryCn[category], '公开资料复盘'],
  };
}

function buildHonors(events) {
  return events.slice(0, 5).map((event) => {
    const year = Number(event.slice(0, 4));
    return {
      year,
      title: event.replace(/^\d{4}:\s*/, ''),
      category: '公开事件',
    };
  });
}

fs.mkdirSync(seedDir, { recursive: true });

const articles = topics.map(makeArticle);
const celebrities = celebrityCases.map(makeCelebrity);

fs.writeFileSync(path.join(seedDir, 'knowledge-articles.json'), `${JSON.stringify(articles, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(seedDir, 'celebrity-cases.json'), `${JSON.stringify(celebrities, null, 2)}\n`, 'utf8');

console.log(`Wrote ${articles.length} knowledge articles and ${celebrities.length} celebrity cases.`);
