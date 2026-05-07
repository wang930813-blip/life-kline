
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
    // 浠?localStorage 璇诲彇淇濆瓨鐨勯偖绠卞拰瀵嗙爜
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
        console.error('璇诲彇淇濆瓨鐨勭櫥褰曚俊鎭け璐?', e);
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

  // 妫€鏌ュ叓瀛楁槸鍚﹀畬鏁?- 鍙鍥涙煴鏈夊€煎氨绠楀畬鏁?
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

      // 褰撻偖绠辨垨瀵嗙爜鍙樺寲鏃讹紝淇濆瓨鍒?localStorage
      if (name === 'authEmail' || name === 'authPassword') {
        try {
          const toSave = {
            email: name === 'authEmail' ? value : prev.authEmail,
            password: name === 'authPassword' ? value : prev.authPassword,
          };
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
          console.error('淇濆瓨鐧诲綍淇℃伅澶辫触:', e);
        }
      }

      return newData;
    });
    // Clear error when user types
    if (name === 'apiBaseUrl' || name === 'apiKey' || name === 'modelName') {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBaziCalculated = useCallback((baziData: any) => {
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
  }, []);

  // 鑷姩璁＄畻澶ц繍淇℃伅锛堟墜鍔ㄨ緭鍏ユā寮忎笅锛?
  useEffect(() => {
    const calculateDaYunFromPillars = async () => {
      // 鍙湪鎵嬪姩杈撳叆妯″紡涓嬶紝涓斿洓鏌遍兘宸插～鍐欐椂璁＄畻
      if (useSmartInput) return;
      if (!formData.yearPillar || !formData.monthPillar || !formData.dayPillar || !formData.hourPillar) return;
      if (!formData.birthYear) return;

      try {
        // 鍔ㄦ€佸姞杞?lunar-javascript
        const lib = await import('lunar-javascript');
        const { Solar, EightChar } = lib;

        // 浣跨敤鍑虹敓骞翠唤鐨勬煇涓棩鏈熸潵鍒涘缓鍏瓧锛堝彧鐢ㄤ簬璁＄畻澶ц繍锛?
        const year = parseInt(formData.birthYear);
        const solar = Solar.fromYmd(year, 6, 15); // 浣跨敤骞翠腑鏃ユ湡
        const lunar = solar.getLunar();
        const eightChar = lunar.getEightChar();

        // 鎵嬪姩璁剧疆鍥涙煴锛堢敤瀹為檯杈撳叆鐨勫€硷級
        // 娉ㄦ剰锛氳繖閲屾垜浠敤 EightChar 鐨?Yun 璁＄畻锛屼絾鍩轰簬鐢ㄦ埛杈撳叆鐨勫勾鏌辨潵鍒ゆ柇椤洪€?
        const yun = eightChar.getYun(formData.gender === Gender.MALE ? 1 : 0);

        const startYear = yun.getStartYear();
        const startAge = startYear + 1; // 铏氬瞾

        const daYuns = yun.getDaYun();
        const firstDaYun = daYuns && daYuns.length > 0 ? daYuns[0].getGanZhi() : '';

        // 鑷姩濉厖
        setFormData((prev) => ({
          ...prev,
          startAge: startAge.toString(),
          firstDaYun: firstDaYun,
        }));
      } catch (err) {
        console.error('璁＄畻澶ц繍澶辫触:', err);
      }
    };

    calculateDaYunFromPillars();
  }, [formData.yearPillar, formData.monthPillar, formData.dayPillar, formData.hourPillar, formData.birthYear, formData.gender, useSmartInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: {modelName?: string, apiBaseUrl?: string, apiKey?: string, bazi?: string} = {};

    // 楠岃瘉鍏瓧淇℃伅鏄惁瀹屾暣
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
             <label className="block text-sm font-medium text-gray-700 mb-1">濮撳悕 (鍙€?</label>
             <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="濮撳悕"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">鎬у埆</label>
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
                涔鹃€?(鐢?
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
                鍧ら€?(濂?
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
              鏅鸿兘杈撳叆
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
              鎵嬪姩杈撳叆
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
                <span>杈撳叆鍥涙煴骞叉敮 (蹇呭～)</span>
              </div>

              {/* Birth Year Input - Added as requested */}
              <div className="mb-4">
                 <label className="block text-xs font-bold text-gray-600 mb-1">鍑虹敓骞翠唤 (闃冲巻)</label>
                 <input
                    type="number"
                    name="birthYear"
                    required
                    min="1900"
                    max="2100"
                    value={formData.birthYear}
                    onChange={handleChange}
                    placeholder="濡? 1990"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">骞存煴 (Year)</label>
                  <input
                    type="text"
                    name="yearPillar"
                    required
                    value={formData.yearPillar}
                    onChange={handleChange}
                    placeholder="濡? 鐢插瓙"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center font-serif-sc font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">鏈堟煴 (Month)</label>
                  <input
                    type="text"
                    name="monthPillar"
                    required
                    value={formData.monthPillar}
                    onChange={handleChange}
                    placeholder="濡? 涓欏瘏"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center font-serif-sc font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">鏃ユ煴 (Day)</label>
                  <input
                    type="text"
                    name="dayPillar"
                    required
                    value={formData.dayPillar}
                    onChange={handleChange}
                    placeholder="濡? 鎴婅景"
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-center font-serif-sc font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">鏃舵煴 (Hour)</label>
                  <input
                    type="text"
                    name="hourPillar"
                    required
                    value={formData.hourPillar}
                    onChange={handleChange}
                    placeholder="濡? 澹垖"
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
            <span>澶ц繍鎺掔洏淇℃伅 (鑷姩璁＄畻)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">璧疯繍骞撮緞 (铏氬瞾)</label>
              <input
                type="text"
                name="startAge"
                value={formData.startAge}
                readOnly
                placeholder="鑷姩璁＄畻"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-indigo-50/50 text-center font-bold text-indigo-700 cursor-not-allowed"
                title="鏍规嵁鍥涙煴鑷姩璁＄畻"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">第一步大运</label>
              <input
                type="text"
                name="firstDaYun"
                value={formData.firstDaYun}
                readOnly
                placeholder="鑷姩璁＄畻"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg bg-indigo-50/50 text-center font-serif-sc font-bold text-indigo-700 cursor-not-allowed"
                title="鏍规嵁鍥涙煴鑷姩璁＄畻"
              />
            </div>
          </div>
           <p className="text-xs text-indigo-600/70 mt-2 text-center">
             褰撳墠澶ц繍鎺掑簭瑙勫垯锛?
             <span className="font-bold text-indigo-900">{daYunDirectionInfo}</span>
          </p>
          {formData.startAge && formData.firstDaYun && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2 text-center">
              鉁?宸茶嚜鍔ㄨ绠楀ぇ杩愪俊鎭?
            </div>
          )}
        </div>

        {/* API Configuration Section */}
        <div className="hidden bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3 text-gray-700 text-sm font-bold">
            <Settings className="w-4 h-4" />
            <span>妯″瀷鎺ュ彛璁剧疆</span>
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
              鍏嶈垂妯″紡(鏃犻渶鐧诲綍)
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, useCustomApi: true }));
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition ${formData.useCustomApi ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              鑷畾涔?API
            </button>
          </div>
          <div className="space-y-3">
            {formData.useCustomApi ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">浣跨敤妯″瀷</label>
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
                <span>{isLoggedIn ? '已登录，将从您的点数中扣除测算费用。' : '请先登录后再填写表单。'}</span>
              </div>
            )}
          </div>
        </div>

        {/* 鍏瓧楠岃瘉閿欒鎻愮ず */}
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
              <span>澶у笀鎺ㄦ紨涓?3-5鍒嗛挓)</span>
            </>
          ) : !isBaziComplete ? (
            <>
              <AlertCircle className="h-5 w-5" />
              <span>璇峰厛濉啓瀹屾暣鍏瓧淇℃伅</span>
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

