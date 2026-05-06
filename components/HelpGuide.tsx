import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ExternalLink, Key, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HelpGuideProps {
  defaultOpen?: boolean;
}

const HelpGuide: React.FC<HelpGuideProps> = ({ defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'usage' | 'api'>('usage');

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-gray-800">使用帮助</h3>
            <p className="text-xs text-gray-500">点击展开查看详细教程</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="animate-fade-in">
          {/* Tab Buttons */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('usage')}
              className={`flex-1 px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'usage'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              使用教程
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`hidden flex-1 px-4 py-3 text-sm font-bold items-center justify-center gap-2 transition-colors ${
                activeTab === 'api'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Key className="w-4 h-4" />
              API设置
            </button>
          </div>

          {/* Content */}
          <div className="p-5 max-h-96 overflow-y-auto">
            {activeTab === 'usage' ? (
              <div className="space-y-4 text-sm">
                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  获取八字信息
                </h4>
                <p className="text-gray-600 pl-8">
                  打开
                  <a
                    href="https://pcbz.iwzwh.com/#/paipan/index"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline mx-1 inline-flex items-center gap-1"
                  >
                    问真八字排盘 <ExternalLink className="w-3 h-3" />
                  </a>
                  输入出生信息，点击【开始排盘】
                </p>

                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  记录关键信息
                </h4>
                <div className="text-gray-600 pl-8 space-y-1">
                  <p>选择【专业细盘】，记录以下内容：</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li>四柱：年柱、月柱、日柱、时柱</li>
                    <li>起运年龄：看"小运"右边第一个运上面的年龄（虚岁）</li>
                    <li>第一步大运：第一个大运的干支</li>
                  </ul>
                </div>

                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  填写表单
                </h4>
                <p className="text-gray-600 pl-8">
                  将信息填入本站表单，或使用【智能输入】模式自动计算。
                </p>

                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  生成报告
                </h4>
                <p className="text-gray-600 pl-8">
                  点击【生成人生K线】，等待3-5分钟即可获得完整报告。
                </p>

                {/* Quick Link */}
                <a
                  href="https://jcnjmxofi1yl.feishu.cn/wiki/OPa4woxiBiFP9okQ9yWcbcXpnEw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  查看图文详细教程
                </a>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800 text-xs">
                    <strong>推荐使用免费模式</strong>：填写邮箱密码即可，系统自动注册登录。如需自定义API请参考以下教程。
                  </p>
                </div>

                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  购买API
                </h4>
                <p className="text-gray-600 pl-8">
                  去闲鱼搜索 <strong>"gemini API"</strong>，大概5块钱能用60次。
                </p>

                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  获取配置信息
                </h4>
                <div className="text-gray-600 pl-8 space-y-1">
                  <p>卖家会提供：</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    <li><strong>URL地址</strong>：如 https://xxx.com/v1</li>
                    <li><strong>API Key</strong>：sk-xxxxxxxx...</li>
                    <li><strong>推荐模型</strong>：gemini-3-pro-preview</li>
                  </ul>
                </div>

                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  填写API配置
                </h4>
                <p className="text-gray-600 pl-8">
                  在表单底部选择【自定义API】，填入URL、Key和模型名称。
                </p>

                <h4 className="font-bold text-gray-800 flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  推荐模型
                </h4>
                <div className="pl-8 space-y-1">
                  <code className="block bg-gray-100 px-2 py-1 rounded text-xs">gemini-3-pro-preview</code>
                  <code className="block bg-gray-100 px-2 py-1 rounded text-xs">gemini-2.5-pro</code>
                  <code className="block bg-gray-100 px-2 py-1 rounded text-xs">grok-4</code>
                </div>

                {/* Common Errors */}
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                  <h5 className="font-bold text-red-700 text-xs mb-2">常见错误</h5>
                  <ul className="text-xs text-red-600 space-y-1">
                    <li><strong>Failed to fetch</strong>: 网络或VPN问题，尝试关闭VPN</li>
                    <li><strong>Invalid JSON</strong>: 换个模型试试</li>
                    <li><strong>超时</strong>: API拥堵，换个时间或模型</li>
                  </ul>
                </div>

                {/* Quick Link */}
                <a
                  href="https://jcnjmxofi1yl.feishu.cn/wiki/JX0iwzoeqie3GEkJ8XQcMesan3c"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  查看API详细教程
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpGuide;
