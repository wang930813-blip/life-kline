import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gender } from '../types';
import { Calendar, Clock, Zap, Sparkles, Info } from 'lucide-react';
import LocationSelector, { LocationData } from './LocationSelector';
import BirthDateInput from './BirthDateInput';
import BirthTimeInput from './BirthTimeInput';

let Lunar: any;
let Solar: any;

const loadLunarLib = async () => {
  if (!Lunar || !Solar) {
    const lib = await import('lunar-javascript');
    Lunar = lib.Lunar;
    Solar = lib.Solar;
  }
};

interface SmartBaziInputProps {
  onBaziCalculated: (data: {
    birthPlace?: string;
    birthYear: string;
    yearPillar: string;
    monthPillar: string;
    dayPillar: string;
    hourPillar: string;
    startAge: string;
    firstDaYun: string;
    longitude?: number;
    latitude?: number;
    trueSolarTimeOffset?: number;
  }) => void;
  gender: Gender;
}

const DEFAULT_LOCATION: LocationData = {
  province: '北京市',
  city: '北京市',
  longitude: 116.4074,
  latitude: 39.9042,
  fullName: '北京市',
  trueSolarTimeOffset: -14,
  isChina: true,
};

const yangStems = ['甲', '丙', '戊', '庚', '壬'];

const getSolarDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const SmartBaziInput: React.FC<SmartBaziInputProps> = ({ onBaziCalculated, gender }) => {
  const [calendarMode, setCalendarMode] = useState<'lunar' | 'solar'>('lunar');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('12:00');
  const [location, setLocation] = useState<LocationData | null>(DEFAULT_LOCATION);
  const [calculatedBazi, setCalculatedBazi] = useState<any>(null);
  const [error, setError] = useState('');
  const [showTrueSolarInfo, setShowTrueSolarInfo] = useState(false);
  const lastCalculatedKeyRef = useRef('');

  const getSelectableDaysInMonth = useCallback((year: number, month: number) => {
    if (calendarMode === 'solar' || !Lunar) {
      return getSolarDaysInMonth(year, month);
    }

    try {
      return Lunar.fromYmd(year, month, 1).getMonthDays();
    } catch {
      return 30;
    }
  }, [calendarMode]);

  const calculateBazi = useCallback(async () => {
    try {
      setError('');

      if (!birthDate) {
        setCalculatedBazi(null);
        return;
      }

      await loadLunarLib();

      const [inputYear, inputMonth, inputDay] = birthDate.split('-').map(Number);
      const [hour, minute] = birthTime.split(':').map(Number);

      if (!inputYear || !inputMonth || !inputDay) {
        setCalculatedBazi(null);
        return;
      }

      const inputSolar = calendarMode === 'lunar'
        ? Lunar.fromYmdHms(inputYear, inputMonth, inputDay, hour, minute, 0).getSolar()
        : Solar.fromYmdHms(inputYear, inputMonth, inputDay, hour, minute, 0);

      const currentLocation = location || DEFAULT_LOCATION;
      const longitudeOffset = currentLocation.trueSolarTimeOffset;
      const solarDate = new Date(
        inputSolar.getYear(),
        inputSolar.getMonth() - 1,
        inputSolar.getDay(),
        hour,
        minute + longitudeOffset,
        0
      );

      const adjustedYear = solarDate.getFullYear();
      const adjustedMonth = solarDate.getMonth() + 1;
      const adjustedDay = solarDate.getDate();
      const adjustedHour = solarDate.getHours();
      const adjustedMinute = solarDate.getMinutes();

      const solar = Solar.fromYmdHms(adjustedYear, adjustedMonth, adjustedDay, adjustedHour, adjustedMinute, 0);
      const lunar = solar.getLunar();
      const eightChar = lunar.getEightChar();

      const yearPillar = eightChar.getYear();
      const monthPillar = eightChar.getMonth();
      const dayPillar = eightChar.getDay();
      const hourPillar = eightChar.getTime();

      const yun = eightChar.getYun(gender === Gender.MALE ? 1 : 0);
      const daYuns = yun.getDaYun();
      const startYear = yun.getStartYear();
      const startMonth = yun.getStartMonth();
      const startDay = yun.getStartDay();
      const startAge = startYear + 1;
      const firstDaYun = daYuns && daYuns.length > 0 ? daYuns[0].getGanZhi() : '';

      const direction = yun.isForward() ? '顺行' : '逆行';
      const isYangYear = yangStems.includes(yearPillar.charAt(0));
      const directionNote = gender === Gender.MALE
        ? (isYangYear ? '(阳男顺行)' : '(阴男逆行)')
        : (isYangYear ? '(阳女逆行)' : '(阴女顺行)');

      const localTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const trueSolarTime = `${String(adjustedHour).padStart(2, '0')}:${String(adjustedMinute).padStart(2, '0')}`;
      const inputCalendarLabel = calendarMode === 'lunar' ? '农历' : '阳历';
      const solarDateLabel = `${inputSolar.getYear()}-${String(inputSolar.getMonth()).padStart(2, '0')}-${String(inputSolar.getDay()).padStart(2, '0')}`;

      const baziData = {
        birthPlace: currentLocation.fullName,
        birthYear: String(inputSolar.getYear()),
        yearPillar,
        monthPillar,
        dayPillar,
        hourPillar,
        startAge: String(startAge),
        firstDaYun,
        lunarDate: lunar.toString(),
        solarDate: solarDateLabel,
        inputCalendarMode: calendarMode,
        inputDateLabel: `${inputCalendarLabel} ${inputYear}-${String(inputMonth).padStart(2, '0')}-${String(inputDay).padStart(2, '0')}`,
        solarTerm: lunar.getJieQi(),
        direction: direction + directionNote,
        startDetail: `${startYear}年${startMonth}个月${startDay}天`,
        longitude: currentLocation.longitude,
        latitude: currentLocation.latitude,
        trueSolarTimeOffset: longitudeOffset,
        localTime,
        trueSolarTime,
      };

      const nextCalculatedKey = JSON.stringify({
        birthPlace: baziData.birthPlace,
        birthYear: baziData.birthYear,
        yearPillar: baziData.yearPillar,
        monthPillar: baziData.monthPillar,
        dayPillar: baziData.dayPillar,
        hourPillar: baziData.hourPillar,
        startAge: baziData.startAge,
        firstDaYun: baziData.firstDaYun,
      });

      setCalculatedBazi(baziData);
      if (lastCalculatedKeyRef.current !== nextCalculatedKey) {
        lastCalculatedKeyRef.current = nextCalculatedKey;
        onBaziCalculated(baziData);
      }
    } catch (err: any) {
      setError(`计算八字时出错: ${err.message}`);
      console.error(err);
    }
  }, [birthDate, birthTime, calendarMode, gender, location, onBaziCalculated]);

  useEffect(() => {
    calculateBazi();
  }, [calculateBazi]);

  useEffect(() => {
    if (!birthDate) return;
    const [year, month, day] = birthDate.split('-').map(Number);
    const maxDay = getSelectableDaysInMonth(year, month);
    if (day > maxDay) {
      setBirthDate(`${year}-${String(month).padStart(2, '0')}-${String(maxDay).padStart(2, '0')}`);
    }
  }, [birthDate, calendarMode, getSelectableDaysInMonth]);

  const formatOffset = (offset: number) => {
    if (offset === 0) return '无偏移';
    const absOffset = Math.abs(offset);
    const hours = Math.floor(absOffset / 60);
    const minutes = absOffset % 60;
    const prefix = offset > 0 ? '+' : '-';
    if (hours > 0 && minutes > 0) return `${prefix}${hours}小时${minutes}分钟`;
    if (hours > 0) return `${prefix}${hours}小时`;
    return `${prefix}${minutes}分钟`;
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-200 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-indigo-600 text-white p-2 rounded-lg">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">智能八字计算</h3>
          <p className="text-xs text-gray-600">填写出生信息，自动生成准确八字（支持真太阳时校正）</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            出生日期
          </label>
          <div className="inline-flex rounded-xl border border-indigo-200 bg-white p-1">
            {[
              { value: 'lunar', label: '农历' },
              { value: 'solar', label: '阳历' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCalendarMode(item.value as 'lunar' | 'solar')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  calendarMode === item.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <BirthDateInput
          value={birthDate}
          onChange={setBirthDate}
          min="1900-01-01"
          max="2100-12-31"
          getDaysInMonth={getSelectableDaysInMonth}
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          出生时间（当地钟表时间）
        </label>
        <BirthTimeInput
          value={birthTime}
          onChange={setBirthTime}
          showShiChenInfo={true}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
            出生地点（用于真太阳时校正）
          </label>
          <button
            type="button"
            onClick={() => setShowTrueSolarInfo(!showTrueSolarInfo)}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            什么是真太阳时？
          </button>
        </div>

        {showTrueSolarInfo && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <p className="font-bold mb-1">真太阳时说明：</p>
            <p>中国统一使用北京时间（东经120度），但不同地区的实际太阳位置不同。</p>
            <p className="mt-1">八字排盘需要使用出生地的真太阳时，才能更准确确定时辰。</p>
          </div>
        )}

        <LocationSelector
          value={location}
          onChange={setLocation}
          placeholder="搜索或选择出生地点"
          showOffset={true}
          showCoordinates={false}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {calculatedBazi && (
        <div className="bg-white rounded-xl p-4 border border-indigo-200">
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            计算结果
          </h4>

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              ['年柱', calculatedBazi.yearPillar],
              ['月柱', calculatedBazi.monthPillar],
              ['日柱', calculatedBazi.dayPillar],
              ['时柱', calculatedBazi.hourPillar],
            ].map(([label, value]) => (
              <div key={label} className="text-center">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className="font-bold text-lg text-indigo-700 font-serif-sc">{value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-indigo-50 rounded-lg p-2">
                <span className="text-gray-600">输入日期：</span>
                <span className="font-medium text-gray-800">{calculatedBazi.inputDateLabel}</span>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2">
                <span className="text-gray-600">对应阳历：</span>
                <span className="font-medium text-gray-800">{calculatedBazi.solarDate}</span>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2">
                <span className="text-gray-600">农历：</span>
                <span className="font-medium text-gray-800">{calculatedBazi.lunarDate}</span>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2">
                <span className="text-gray-600">节气：</span>
                <span className="font-medium text-gray-800">{calculatedBazi.solarTerm || '无'}</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-700 font-bold">真太阳时校正</span>
                <span className="text-amber-700 font-bold text-xs">
                  {formatOffset(calculatedBazi.trueSolarTimeOffset)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-gray-600">钟表时间：</span>
                  <span className="font-medium text-gray-700">{calculatedBazi.localTime}</span>
                </div>
                <div>
                  <span className="text-gray-600">真太阳时：</span>
                  <span className="font-bold text-amber-700">{calculatedBazi.trueSolarTime}</span>
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                出生地：{calculatedBazi.birthPlace}（东经{location?.longitude.toFixed(2)}°）
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-700 font-bold">大运信息</span>
                <span className="text-indigo-600 font-bold text-xs">{calculatedBazi.direction}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-gray-600">起运年龄：</span>
                  <span className="font-bold text-indigo-700">{calculatedBazi.startAge}岁（虚岁）</span>
                </div>
                <div>
                  <span className="text-gray-600">第一步：</span>
                  <span className="font-bold text-indigo-700 font-serif-sc">{calculatedBazi.firstDaYun}</span>
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                精确起运：{calculatedBazi.startDetail}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartBaziInput;
