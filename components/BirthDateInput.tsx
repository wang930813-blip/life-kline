import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface BirthDateInputProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  className?: string;
  getDaysInMonth?: (year: number, month: number) => number;
}

const ZODIAC_ANIMALS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const getSolarDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const getChineseYearInfo = (year: number) => {
  const stemIndex = (year - 4) % 10;
  const branchIndex = (year - 4) % 12;
  const zodiacIndex = (year - 4) % 12;
  return {
    ganZhi: HEAVENLY_STEMS[stemIndex] + EARTHLY_BRANCHES[branchIndex],
    zodiac: ZODIAC_ANIMALS[zodiacIndex],
  };
};

const parseDateValue = (value: string): [number | null, number | null, number | null] => {
  if (!value) return [null, null, null];
  const [year, month, day] = value.split('-').map(Number);
  return [year || null, month || null, day || null];
};

const BirthDateInput: React.FC<BirthDateInputProps> = ({
  value,
  onChange,
  min = '1900-01-01',
  max = '2100-12-31',
  className = '',
  getDaysInMonth = getSolarDaysInMonth,
}) => {
  const [year, month, day] = useMemo(() => parseDateValue(value), [value]);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [yearDecade, setYearDecade] = useState(Math.floor((year || new Date().getFullYear()) / 10) * 10);
  const containerRef = useRef<HTMLDivElement>(null);

  const minYear = parseInt(min.split('-')[0], 10);
  const maxYear = parseInt(max.split('-')[0], 10);
  const currentYear = new Date().getFullYear();

  const decades = useMemo(() => {
    const result: number[] = [];
    for (let d = Math.floor(minYear / 10) * 10; d <= maxYear; d += 10) result.push(d);
    return result;
  }, [minYear, maxYear]);

  const yearsInDecade = useMemo(() => {
    const result: number[] = [];
    for (let y = yearDecade; y < yearDecade + 10 && y <= maxYear; y += 1) {
      if (y >= minYear) result.push(y);
    }
    return result;
  }, [yearDecade, minYear, maxYear]);

  const daysInMonth = useMemo(() => {
    if (!year || !month) return [];
    const days = getDaysInMonth(year, month);
    return Array.from({ length: days }, (_, i) => i + 1);
  }, [year, month, getDaysInMonth]);

  const quickYears = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);
  const yearInfo = year ? getChineseYearInfo(year) : null;

  const updateDate = (newYear: number, newMonth: number, newDay: number) => {
    const maxDay = getDaysInMonth(newYear, newMonth);
    const validDay = Math.min(newDay, maxDay);
    onChange(`${newYear}-${String(newMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`);
  };

  const handleSelectYear = (selectedYear: number) => {
    setShowYearPicker(false);
    updateDate(selectedYear, month || 1, day || 1);
  };

  const handleSelectMonth = (selectedMonth: number) => {
    setShowMonthPicker(false);
    if (year) updateDate(year, selectedMonth, day || 1);
  };

  const handleSelectDay = (selectedDay: number) => {
    setShowDayPicker(false);
    if (year && month) updateDate(year, month, selectedDay);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowYearPicker(false);
        setShowMonthPicker(false);
        setShowDayPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="grid grid-cols-[minmax(7.5rem,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowYearPicker(!showYearPicker);
              setShowMonthPicker(false);
              setShowDayPicker(false);
              if (year) setYearDecade(Math.floor(year / 10) * 10);
            }}
            className={`w-full min-h-[4.25rem] px-3 py-2.5 border rounded-xl text-left flex items-center justify-between gap-2 transition-colors ${
              showYearPicker ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-indigo-200 hover:border-indigo-300'
            } bg-white`}
          >
            <div className="min-w-0 flex flex-col gap-1">
              <span className={`block truncate ${year ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                {year ? `${year}年` : '年'}
              </span>
              {yearInfo && (
                <span className="inline-flex w-fit max-w-full whitespace-nowrap text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {yearInfo.zodiac}年
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${showYearPicker ? 'rotate-180' : ''}`} />
          </button>

          {showYearPicker && (
            <div className="absolute z-50 w-64 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1.5">快速选择</div>
                <div className="flex flex-wrap gap-1">
                  {quickYears.map((quickYear) => (
                    <button
                      key={quickYear}
                      type="button"
                      onClick={() => handleSelectYear(quickYear)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                        year === quickYear ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-indigo-100'
                      }`}
                    >
                      {quickYear}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setYearDecade(Math.max(Math.floor(minYear / 10) * 10, yearDecade - 10))}
                  disabled={yearDecade <= Math.floor(minYear / 10) * 10}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-700">{yearDecade}s</span>
                <button
                  type="button"
                  onClick={() => setYearDecade(Math.min(Math.floor(maxYear / 10) * 10, yearDecade + 10))}
                  disabled={yearDecade >= Math.floor(maxYear / 10) * 10}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-100">
                {decades.map((decade) => (
                  <button
                    key={decade}
                    type="button"
                    onClick={() => setYearDecade(decade)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      yearDecade === decade ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {decade}s
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-1">
                {yearsInDecade.map((pickerYear) => {
                  const info = getChineseYearInfo(pickerYear);
                  return (
                    <button
                      key={pickerYear}
                      type="button"
                      onClick={() => handleSelectYear(pickerYear)}
                      className={`p-1.5 rounded-lg text-center transition-colors ${
                        year === pickerYear ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-gray-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{pickerYear}</div>
                      <div className={`text-xs ${year === pickerYear ? 'text-indigo-100' : 'text-gray-400'}`}>{info.ganZhi}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowMonthPicker(!showMonthPicker);
              setShowYearPicker(false);
              setShowDayPicker(false);
            }}
            className={`w-full min-h-[4.25rem] px-3 py-2.5 border rounded-xl text-left flex items-center justify-between gap-2 transition-colors ${
              showMonthPicker ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-indigo-200 hover:border-indigo-300'
            } bg-white ${!year ? 'opacity-60' : ''}`}
            disabled={!year}
          >
            <span className={`truncate ${month ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
              {month ? `${month}月` : '月'}
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${showMonthPicker ? 'rotate-180' : ''}`} />
          </button>

          {showMonthPicker && year && (
            <div className="absolute z-50 w-48 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((pickerMonth) => (
                  <button
                    key={pickerMonth}
                    type="button"
                    onClick={() => handleSelectMonth(pickerMonth)}
                    className={`p-2 rounded-lg text-center transition-colors ${
                      month === pickerMonth ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-gray-700'
                    }`}
                  >
                    {pickerMonth}月
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowDayPicker(!showDayPicker);
              setShowYearPicker(false);
              setShowMonthPicker(false);
            }}
            className={`w-full min-h-[4.25rem] px-3 py-2.5 border rounded-xl text-left flex items-center justify-between gap-2 transition-colors ${
              showDayPicker ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-indigo-200 hover:border-indigo-300'
            } bg-white ${!year || !month ? 'opacity-60' : ''}`}
            disabled={!year || !month}
          >
            <span className={`truncate ${day ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
              {day ? `${day}日` : '日'}
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${showDayPicker ? 'rotate-180' : ''}`} />
          </button>

          {showDayPicker && year && month && (
            <div className="absolute right-0 z-50 w-56 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
              <div className="grid grid-cols-7 gap-1 max-h-64 overflow-y-auto">
                {daysInMonth.map((pickerDay) => (
                  <button
                    key={pickerDay}
                    type="button"
                    onClick={() => handleSelectDay(pickerDay)}
                    className={`p-2 rounded-lg text-center text-sm transition-colors ${
                      day === pickerDay ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-gray-700'
                    }`}
                  >
                    {pickerDay}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BirthDateInput;
