import fs from 'fs';
import path from 'path';

const root = process.cwd();
const targets = {
  'server/parallelAnalyzer.js': /onProgress|industry:|wealth:/,
  'server/analyzeStream.js': /sendSSE|onProgress|message:|summary:|personality:|crypto/,
  'server/analyzeUnifiedStream.js': /sendSSE|message:|summary:|cryptoYear|cryptoStyle/,
  'server/unifiedAnalyzer.js': /onProgress|summary:|console\.(log|warn|error)/,
  'server/index.js': /overallSummary|dailyAdvice|lunarDateStr|userPrompt|summary:|crypto:|cryptoYear|cryptoStyle/,
  'pages/DashboardPage.tsx': /recentAnalyses|analysis\.summary|handleOpenHistory|normalizeText|onHistorySelect/,
  'pages/ProfilePage.tsx': /recent|birthMonth|birthDay|birthHour|formatBirthInfo|profile\.input/,
  'pages/HomePage.tsx': /HelpGuide|使用帮助/,
  'components/SmartBaziInput.tsx': /calendarMode|农历|阳历|BirthDateInput|Solar\.fromYmdHms|Lunar\.fromYmdHms/,
  'components/BirthDateInput.tsx': /return \[0, 0, 0\]|0月|0日|ZODIAC_ANIMALS|placeholder/,
  'components/layout/LeftNav.tsx': /<span|confirm|formatDate|onHistorySelect|historyExpanded|item\.input/,
  'components/HistoryList.tsx': /<h3|<p|confirm|formatDate|item\.input|item\.cost/,
  'components/fortune/DailyFortuneCard.tsx': /fortune\.lunarDate|fortune\.overallSummary|StatRow label|<h3|setFortune/,
  'pages/DailyFortunePage.tsx': /fortune\.lunarDate|fortune\.overallSummary|<h1|<h2|setFortune/,
  'utils/normalizeText.ts': /getDayInChinese|REPLACEMENTS|replace/,
};

const mojibakePattern = /[閿涢崷閻ㄦ稉閺勫牆鍕仸濞翠礁濮╃痪妤犻墎鍛鏈鏌娴]|锟|鉁|\?(?=['"`\)])/;
const offenders = [];

for (const [relativePath, relevantLine] of Object.entries(targets)) {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  content.split(/\r?\n/).forEach((line, index) => {
    if (relevantLine.test(line) && mojibakePattern.test(line)) {
      offenders.push(`${relativePath}:${index + 1}: ${line.trim()}`);
    }
  });
}

const dashboard = fs.readFileSync(path.join(root, 'pages/DashboardPage.tsx'), 'utf8');
if (!/onHistorySelect\?: \(result: LifeDestinyResult, input: UserInput\) => void/.test(dashboard)) {
  offenders.push('pages/DashboardPage.tsx: missing onHistorySelect prop for opening history items');
}
if (!/fetch\(`\/api\/history\/\$\{analysis\.id\}`/.test(dashboard)) {
  offenders.push('pages/DashboardPage.tsx: missing detail fetch before opening server history items');
}

const app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const dashboardPropsCount = [...app.matchAll(/<DashboardPage[\s\S]*?\/>/g)]
  .filter((match) => match[0].includes('onHistorySelect={handleHistorySelect}')).length;
if (dashboardPropsCount < 2) {
  offenders.push('App.tsx: Dashboard routes must pass onHistorySelect={handleHistorySelect}');
}

const serverIndex = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');
if (!/input:\s*analysis\.input/.test(serverIndex)) {
  offenders.push('server/index.js: /api/history/:id must return analysis.input');
}

const profilePage = fs.readFileSync(path.join(root, 'pages/ProfilePage.tsx'), 'utf8');
if (/birthMonth:\s*0|birthDay:\s*0|birthHour:\s*0/.test(profilePage)) {
  offenders.push('pages/ProfilePage.tsx: must not fabricate missing birth date parts as 0');
}
if (/\{profile\.input\.birthYear\}年\{profile\.input\.birthMonth\}月/.test(profilePage)) {
  offenders.push('pages/ProfilePage.tsx: must not render incomplete birth date as full 年月日时');
}

const homePage = fs.readFileSync(path.join(root, 'pages/HomePage.tsx'), 'utf8');
if (/HelpGuide|components\/HelpGuide/.test(homePage)) {
  offenders.push('pages/HomePage.tsx: remove HelpGuide from the home page');
}

const analysisResult = fs.readFileSync(path.join(root, 'components/AnalysisResult.tsx'), 'utf8');
if (!/import \{ normalizeText \} from '\.\.\/utils\/normalizeText'/.test(analysisResult)) {
  offenders.push('components/AnalysisResult.tsx: analysis output must import normalizeText');
}
if (!/const normalizedAnalysis = normalizeText\(analysis\)/.test(analysisResult)) {
  offenders.push('components/AnalysisResult.tsx: analysis output must normalize analysis before rendering');
}
if (!/const toDisplayText = \(content: unknown\)/.test(analysisResult) || !/return normalizeText\(content\)/.test(analysisResult)) {
  offenders.push('components/AnalysisResult.tsx: card content must normalize text before display');
}
if (!/FALLBACK_ANALYSIS_TEXT/.test(analysisResult) || !/displayContent \|\| fallback/.test(analysisResult)) {
  offenders.push('components/AnalysisResult.tsx: analysis cards must render fallback text for empty fields');
}

const smartBaziInput = fs.readFileSync(path.join(root, 'components/SmartBaziInput.tsx'), 'utf8');
if (!/const \[calendarMode,\s*setCalendarMode\] = useState<'lunar' \| 'solar'>\('lunar'\)/.test(smartBaziInput)) {
  offenders.push('components/SmartBaziInput.tsx: calendar mode must default to lunar');
}
if (!/Lunar\.fromYmdHms/.test(smartBaziInput) || !/Solar\.fromYmdHms/.test(smartBaziInput)) {
  offenders.push('components/SmartBaziInput.tsx: must support both lunar and solar date conversion');
}

const birthDateInput = fs.readFileSync(path.join(root, 'components/BirthDateInput.tsx'), 'utf8');
if (/return \[0,\s*0,\s*0\]/.test(birthDateInput) || />\s*0\s*</.test(birthDateInput)) {
  offenders.push('components/BirthDateInput.tsx: empty date state must not render bare 0');
}

if (offenders.length > 0) {
  console.error('Found visible mojibake candidates:');
  for (const offender of offenders) console.error(`- ${offender}`);
  process.exit(1);
}

console.log('OK: no visible mojibake candidates in scanned UI paths.');
