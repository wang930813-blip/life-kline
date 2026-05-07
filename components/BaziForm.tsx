
import React, { useState, useMemo, useEffect } from 'react';
import { UserInput, Gender } from '../types';
import { Loader2, Sparkles, AlertCircle, TrendingUp, Settings, Zap, Edit3 } from 'lucide-react';
import SmartBaziInput from './SmartBaziInput';

interface BaziFormProps {
  onSubmit: (data: UserInput) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
}

const AUTH_STORAGE_KEY = 'lifekline_auth';

const BaziForm: React.FC<BaziFormProps> = ({ onSubmit, isLoading, isLoggedIn }) => {
  const [useSmartInput, setUseSmartInput] = useState(true);
  const [formData, setFormData] = useState<UserInput>(() => {
    // 从 localStorage 读取保存的邮箱和密码
    let savedEmail = '';
    let savedPassword = '';
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          savedEmail = parsed.email || '';
          savedPassword = parsed.password || '';
        }
      } catch (e) {
        console.error('读取保存的登录信息失败:', e);
      }
    }
    return {
      name: '',
      birthPlace: '',
      gender: Gender.MALE,
      birthYear: '',
      yearPillar: '',
      monthPillar: '',
      dayPillar: '',
      hourPillar: '',
      startAge: '',
      firstDaYun: '',
      modelName: '',
      apiBaseUrl: '',
      apiKey: '',
      useCustomApi: false,
      authEmail: savedEmail,
      authPassword: savedPassword,
    };
  });

  const [formErrors, setFormErrors] = useState<{modelName?: string, apiBaseUrl?: string, apiKey?: string, authEmail?: string, authPassword?: string, bazi?: string}>({});

  // 检查八字是否完整 - 只要四柱有值就算完整
  const isBaziComplete = useMemo(() => {
    return !!(
      formData.yearPillar &&
      formData.monthPillar &&
      formData.dayPillar &&
      formData.hourPillar
    );
  }, [formData.yearPillar, formData.monthPillar, formData.dayPillar, formData.hourPillar]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // 当邮箱或密码变化时，保存到 localStorage
      if (name === 'authEmail' || name === 'authPassword') {
        try {
          const toSave = {
            email: name === 'authEmail' ? value : prev.authEmail,
            password: name === 'authPassword' ? value : prev.authPassword,
          };
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
          console.error('保存登录信息失败:', e);
        }
      }

      return newData;
    });
    // Clear error when user types
    if (name === 'apiBaseUrl' || name === 'apiKey' || name === 'modelName') {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBaziCalculated = (baziData: any) => {
    setFormData((prev) => ({
      ...prev,
      birthPlace: baziData.birthPlace || prev.birthPlace,
      birthYear: baziData.birthYear,
      yearPillar: baziData.yearPillar,
      monthPillar: baziData.monthPillar,
      dayPillar: baziData.dayPillar,
      hourPillar: baziData.hourPillar,
      startAge: baziData.startAge,
      firstDaYun: baziData.firstDaYun,
    }));
  };

  // 自动计算大运信息（手动输入模式下）
  useEffect(() => {
    const calculateDaYunFromPillars = async () => {
      // 只在手动输入模式下，且四柱都已填写时计算
      if (useSmartInput) return;
      if (!formData.yearPillar || !formData.monthPillar || !formData.dayPillar || !formData.hourPillar) return;
      if (!formData.birthYear) return;

      try {
        // 动态加载 lunar-javascript
        const lib = await import('lunar-javascript');
        const { Solar, EightChar } = lib;

        // 使用出生年份的某个日期来创建八字（只用于计算大运）
        const year = parseInt(formData.birthYear);
        const solar = Solar.fromYmd(year, 6, 15); // 使用年中日期
        const lunar = solar.getLunar();
        const eightChar = lunar.getEightChar();

        // 手动设置四柱（用实际输入的值）
        // 注意：这里我们用 EightChar 的 Yun 计算，但基于用户输入的年柱来判断顺逆
        const yun = eightChar.getYun(formData.gender === Gender.MALE ? 1 : 0);

        const startYear = yun.getStartYear();
        const startAge = startYear + 1; // 虚岁

        const daYuns = yun.getDaYun();
        const firstDaYun = daYuns && daYuns.length > 0 ? daYuns[0].getGanZhi() : '';

        // 自动填充
        setFormData((prev) => ({
          ...prev,
          startAge: startAge.toString(),
          firstDaYun: firstDaYun,
        }));
      } catch (err) {
        console.error('计算大运失败:', err);
      }
    };

    calculateDaYunFromPillars();
  }, [formData.yearPillar, formData.monthPillar, formData.dayPillar, formData.hourPillar, formData.birthYear, formData.gender, useSmartInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: {modelName?: string, apiBaseUrl?: string, apiKey?: string, bazi?: string} = {};

    // 验证八字信息是否完整
    if (!isBaziComplete) {
      errors.bazi = '请先填写出生日期以生成八字信息';
    }

    if (formData.useCustomApi) {
      if (!formData.modelName.trim()) {
        errors.modelName = '请输入模型名称';
      }
      if (!formData.apiBaseUrl.trim()) {
        errors.apiBaseUrl = '请输入 API Base URL';
      }
      if (!formData.apiKey.trim()) {
        errors.apiKey = '请输入 API Key';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    onSubmit({ ...formData, modelName: '', apiBaseUrl: '', apiKey: '', useCustomApi: false });
  };

  // Calculate direction for UI feedback
  const daYunDirectionInfo = useMemo(() => {
    if (!formData.yearPillar) return '等待输入年柱...';

    const firstChar = formData.yearPillar.trim().charAt(0);
    const yangStems = ['甲', '丙', '戊', '庚', '壬'];
    const yinStems = ['乙', '丁', '己', '辛', '癸'];

    let isYangYear = true;
    if (yinStems.includes(firstChar)) isYangYear = false;
    else if (!yangStems.includes(firstChar)) return '年柱格式错误';

    let isForward = false;
    let desc = '';

    if (formData.gender === Gender.MALE) {
      isForward = isYangYear;
      desc = isYangYear ? '顺行（阳男顺推）' : '逆行（阴男逆推）';
    } else {
      isForward = !isYangYear;
      desc = isYangYear ? '逆行（阳女逆推）' : '顺行（阴女顺推）';
    }

    return desc;
  }, [formData.yearPillar, formData.gender]);

  return (
    <div id="bazi-form-card" className="bamboo-card w-full max-w-md p-8">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-serif-sc font-bold text-[var(--color-qingdai)] mb-2">八字排盘</h2>
        <p className="text-gray-500 text-sm">请输入四柱与大运信息以生成分析</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Name & Gender */}
        <div className="grid grid-cols-2 gap-4">
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">姓名 (可选)</label>
             <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
            <div className="flex bg-[rgb(18_60_67_/_0.08)] rounded-lg p-1 border border-[var(--border-ink)]">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: Gender.MALE })}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                  formData.gender === Gender.MALE
                    ? 'classical-button shadow-sm'
                    : 'bg-[var(--color-xuan-paper)] text-[var(--color-qingdai)] hover:text-[var(--color-cinnabar)] border border-[var(--border-ink)]'
                }`}
              >
                乾造 (男)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, gender: Gender.FEMALE })}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                  formData.gender === Gender.FEMALE
                    ? 'classical-button shadow-sm'
                    : 'bg-[var(--color-xuan-paper)] text-[var(--color-qingdai)] hover:text-[var(--color-cinnabar)] border border-[var(--border-ink)]'
                }`}
              >
                坤造 (女)
              </button>
            </div>
          </div>
        </div>

        {/* Four Pillars Manual Input */}
        <div className="space-y-4">
          {/* Toggle between Smart and Manual Input */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUseSmartInput(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                useSmartInput
                  ? 'classical-button shadow-lg'
                  : 'bg-[var(--color-xuan-paper)] text-[var(--color-qingdai)] hover:text-[var(--color-cinnabar)] border border-[var(--border-ink)]'
              }`}
            >
              <Zap className="w-4 h-4" />
              智能输入
            </button>
            <button
              type="button"
              onClick={() => setUseSmartInput(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                !useSmartInput
                  ? 'classical-button shadow-lg'
                  : 'bg-[var(--color-xuan-paper)] text-[var(--color-qingdai)] hover:text-[var(--color-cinnabar)] border border-[var(--border-ink)]'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              手动输入
            </button>
          </div>

          {/* Smart Input */}
          {useSmartInput ? (
            <SmartBaziInput onBaziCalculated={handleBaziCalculated} gender={formData.gender} />
          ) : (
            /* Manual Input */
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <div className="flex items-center gap-2 mb-3 text-amber-800 text-sm font-bold">
                <Sparkles className="w-4 h-4" />
                <span>输入四柱干支 (必填)</span>
              </div>

              {/* Birth Year Input - Added as requested */}
              <div className="mb-4">
                 <label className="block text-xs font-bold text-gray-600 mb-1">出生年份 (阳历)</label>
                 <input
                    type="number"
                    name="birthYear"
                    required
                    min="1900"
                    max="2100"
                    value={formData.birthYear}
                    onChange={handleChange}
                    placeholder="如: 1990"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">年柱 (Year)</label>
                  <input
                    type="text"
                    name="yearPillar"
                    required
                    value={formData.yearPillar}
                    onChange={handleChange}
                    placeholder="如: 甲子"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center font-serif-sc font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">月柱 (Month)</label>
                  <input
                    type="text"
                    name="monthPillar"
                    required
                    value={formData.monthPillar}
                    onChange={handleChange}
                    placeholder="如: 丙寅"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center font-serif-sc font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">日柱 (Day)</label>
                  <input
                    type="text"
                    name="dayPillar"
                    required
                    value={formData.dayPillar}
                    onChange={handleChange}
                    placeholder="如: 戊辰"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center font-serif-sc font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">时柱 (Hour)</label>
                  <input
                    type="text"
                    name="hourPillar"
                    required
                    value={formData.hourPillar}
                    onChange={handleChange}
                    placeholder="如: 壬戌"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center font-serif-sc font-bold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Da Yun Manual Input */}
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
          <div className="flex items-center gap-2 mb-3 text-indigo-800 text-sm font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>大运排盘信息 (自动计算)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">起运年龄 (虚岁)</label>
              <input
                type="text"
                name="startAge"
                value={formData.startAge}
                readOnly
                placeholder="自动计算"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-indigo-50/50 text-center font-bold text-indigo-700 cursor-not-allowed"
                title="根据四柱自动计算"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">第一步大运</label>
              <input
                type="text"
                name="firstDaYun"
                value={formData.firstDaYun}
                readOnly
                placeholder="自动计算"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-indigo-50/50 text-center font-serif-sc font-bold text-indigo-700 cursor-not-allowed"
                title="根据四柱自动计算"
              />
            </div>
          </div>
           <p className="text-xs text-indigo-600/70 mt-2 text-center">
             当前大运排序规则：
             <span className="font-bold text-indigo-900">{daYunDirectionInfo}</span>
          </p>
          {formData.startAge && formData.firstDaYun && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2 text-center">
              ✓ 已自动计算大运信息
            </div>
          )}
        </div>

        {/* API Configuration Section */}
        <div className="hidden bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3 text-gray-700 text-sm font-bold">
            <Settings className="w-4 h-4" />
            <span>模型接口设置</span>
          </div>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, useCustomApi: false, modelName: '', apiBaseUrl: '', apiKey: '' }));
                setFormErrors({});
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition ${!formData.useCustomApi ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              免费模式(无需登录)
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, useCustomApi: true }));
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition ${formData.useCustomApi ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              自定义 API
            </button>
          </div>
          <div className="space-y-3">
            {formData.useCustomApi ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">使用模型</label>
                  <input
                    type="text"
                    name="modelName"
                    value={formData.modelName}
                    onChange={handleChange}
                    placeholder="gpt-5.5"
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono outline-none ${formErrors.modelName ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:ring-2 focus:ring-gray-400'}`}
                  />
                  {formErrors.modelName && <p className="text-red-500 text-xs mt-1">{formErrors.modelName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">API Base URL</label>
                  <input
                    type="text"
                    name="apiBaseUrl"
                    value={formData.apiBaseUrl}
                    onChange={handleChange}
                    placeholder="https://api.openai.com/v1"
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono outline-none ${formErrors.apiBaseUrl ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:ring-2 focus:ring-gray-400'}`}
                  />
                  {formErrors.apiBaseUrl && <p className="text-red-500 text-xs mt-1">{formErrors.apiBaseUrl}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">API Key</label>
                  <input
                    type="password"
                    name="apiKey"
                    value={formData.apiKey}
                    onChange={handleChange}
                    placeholder="sk-..."
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono outline-none ${formErrors.apiKey ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:ring-2 focus:ring-gray-400'}`}
                  />
                  {formErrors.apiKey && <p className="text-red-500 text-xs mt-1">{formErrors.apiKey}</p>}
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-600 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 leading-relaxed">
                {isLoggedIn ? (
                  <span>✓ 已登录，将从您的点数中扣除测算费用</span>
                ) : (
                  <span>🎁 测算免费体验，无需注册</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 八字验证错误提示 */}
        {formErrors.bazi && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-bold">{formErrors.bazi}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !isBaziComplete}
          className={`w-full font-bold py-3.5 rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-2 ${
            !isBaziComplete
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-golden hover:shadow-glow-golden text-white hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin h-5 w-5" />
              <span>大师推演中(3-5分钟)</span>
            </>
          ) : !isBaziComplete ? (
            <>
              <AlertCircle className="h-5 w-5" />
              <span>请先填写完整八字信息</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 text-amber-300" />
              <span>生成人生K线</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default BaziForm;
