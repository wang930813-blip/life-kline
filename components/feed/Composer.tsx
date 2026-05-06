import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { UserInput, Gender } from '../../types';

interface ComposerProps {
  onSubmit: (data: UserInput) => void;
  isLoading: boolean;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

const Composer: React.FC<ComposerProps> = ({
  onSubmit,
  isLoading,
  isExpanded: controlledExpanded,
  onToggle
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const [formData, setFormData] = useState({
    name: '',
    gender: Gender.MALE,
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    birthHour: '',
  });

  const handleExpand = () => {
    const newExpanded = !isExpanded;
    if (onToggle) {
      onToggle(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
    }
  };

  const handleCollapse = () => {
    if (onToggle) {
      onToggle(false);
    } else {
      setInternalExpanded(false);
    }
    // Reset form
    setFormData({
      name: '',
      gender: Gender.MALE,
      birthYear: '',
      birthMonth: '',
      birthDay: '',
      birthHour: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Import lunar-javascript dynamically to calculate bazi
    try {
      const lib = await import('lunar-javascript');
      const { Solar } = lib;

      const solar = Solar.fromYmdHms(
        parseInt(formData.birthYear),
        parseInt(formData.birthMonth),
        parseInt(formData.birthDay),
        parseInt(formData.birthHour),
        0,
        0
      );
      const lunar = solar.getLunar();
      const eightChar = lunar.getEightChar();

      const yun = eightChar.getYun(formData.gender === Gender.MALE ? 1 : 0);
      const startYear = yun.getStartYear();
      const startAge = startYear + 1;
      const daYuns = yun.getDaYun();
      const firstDaYun = daYuns && daYuns.length > 0 ? daYuns[0].getGanZhi() : '';

      const userInput: UserInput = {
        name: formData.name,
        gender: formData.gender,
        birthYear: formData.birthYear,
        yearPillar: eightChar.getYearGanZhi(),
        monthPillar: eightChar.getMonthGanZhi(),
        dayPillar: eightChar.getDayGanZhi(),
        hourPillar: eightChar.getTimeGanZhi(),
        startAge: startAge.toString(),
        firstDaYun: firstDaYun,
        modelName: '',
        apiBaseUrl: '',
        apiKey: '',
        useCustomApi: false,
        authEmail: '',
        authPassword: '',
      };

      onSubmit(userInput);
      handleCollapse();
    } catch (err) {
      console.error('Failed to calculate bazi:', err);
      alert('生成八字失败，请检查输入的日期信息');
    }
  };

  const isFormValid = formData.birthYear && formData.birthMonth && formData.birthDay && formData.birthHour;

  if (!isExpanded) {
    return (
      <div className="bg-white border-b border-gray-200 p-4">
        <button
          onClick={handleExpand}
          className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
        >
          开始测算您的人生K线...
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            生成人生K线
          </h3>
          <button
            onClick={handleCollapse}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓名 (可选)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                placeholder="姓名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                性别
              </label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: Gender.MALE })}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                    formData.gender === Gender.MALE
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  男
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: Gender.FEMALE })}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                    formData.gender === Gender.FEMALE
                      ? 'bg-white text-pink-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  女
                </button>
              </div>
            </div>
          </div>

          {/* Birth Date & Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              出生日期时辰 (阳历)
            </label>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="number"
                value={formData.birthYear}
                onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                placeholder="年"
                min="1900"
                max="2100"
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-center"
              />
              <input
                type="number"
                value={formData.birthMonth}
                onChange={(e) => setFormData({ ...formData, birthMonth: e.target.value })}
                placeholder="月"
                min="1"
                max="12"
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-center"
              />
              <input
                type="number"
                value={formData.birthDay}
                onChange={(e) => setFormData({ ...formData, birthDay: e.target.value })}
                placeholder="日"
                min="1"
                max="31"
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-center"
              />
              <input
                type="number"
                value={formData.birthHour}
                onChange={(e) => setFormData({ ...formData, birthHour: e.target.value })}
                placeholder="时"
                min="0"
                max="23"
                required
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-center"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              请输入准确的出生年月日时（24小时制）
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isFormValid}
            className={`w-full font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
              !isFormValid
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isLoading
                ? 'bg-indigo-400 text-white cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>生成K线</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Composer;
