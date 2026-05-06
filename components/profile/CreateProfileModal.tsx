import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, MapPin, User, Loader2 } from 'lucide-react';
import { UserInput, Gender } from '../../types';
import SmartBaziInput from '../SmartBaziInput';

interface CreateProfileModalProps {
  onClose: () => void;
  onSave: (data: UserInput) => void;
  initialData?: UserInput & {
    id: string;
    isDefault: boolean;
    createdAt: string;
  };
}

const CreateProfileModal: React.FC<CreateProfileModalProps> = ({
  onClose,
  onSave,
  initialData
}) => {
  const [useSmartInput, setUseSmartInput] = useState(() => !initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<UserInput>(() => {
    if (initialData) {
      const { id, isDefault, createdAt, ...userData } = initialData;
      return userData;
    }

    // Default values for new profile
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
      authEmail: '',
      authPassword: '',
    };
  });

  const handleBasicInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBaziCalculated = (baziData: any) => {
    setFormData(prev => ({
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

    // Clear bazi errors if they exist
    if (errors.bazi) {
      setErrors(prev => ({ ...prev, bazi: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name is required
    if (!formData.name.trim()) {
      newErrors.name = '请输入档案名称';
    }

    // Check if Bazi data is complete
    const hasBasicInfo = formData.birthYear && formData.birthPlace;
    const hasCompleteBazi = formData.yearPillar && formData.monthPillar &&
                           formData.dayPillar && formData.hourPillar;

    if (!hasBasicInfo && !hasCompleteBazi) {
      newErrors.bazi = '请填写出生信息，或完整输入四柱八字';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setErrors({ submit: '保存档案失败，请重试。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleInputMode = () => {
    setUseSmartInput(!useSmartInput);
    // Clear bazi-related errors when switching modes
    if (errors.bazi) {
      setErrors(prev => ({ ...prev, bazi: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? '编辑档案' : '创建新档案'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">基本信息</h3>

            {/* Name */}
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4" />
                <span>档案名称</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleBasicInputChange}
                placeholder="输入档案名称"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">性别</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={Gender.MALE}
                    checked={formData.gender === Gender.MALE}
                    onChange={handleBasicInputChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">男</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value={Gender.FEMALE}
                    checked={formData.gender === Gender.FEMALE}
                    onChange={handleBasicInputChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">女</span>
                </label>
              </div>
            </div>
          </div>

          {/* Bazi Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">出生信息</h3>
              <button
                type="button"
                onClick={toggleInputMode}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {useSmartInput ? '切换为手动输入' : '使用智能排盘'}
              </button>
            </div>

            {errors.bazi && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {errors.bazi}
              </div>
            )}

            {useSmartInput ? (
              <SmartBaziInput
                onBaziCalculated={handleBaziCalculated}
                gender={formData.gender}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Manual input fields */}
                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>出生年份</span>
                  </label>
                  <input
                    type="text"
                    name="birthYear"
                    value={formData.birthYear}
                    onChange={handleBasicInputChange}
                    placeholder="例如：1990"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span>出生地点</span>
                  </label>
                  <input
                    type="text"
                    name="birthPlace"
                    value={formData.birthPlace}
                    onChange={handleBasicInputChange}
                    placeholder="例如：北京市"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Bazi Pillars */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">年柱</label>
                  <input
                    type="text"
                    name="yearPillar"
                    value={formData.yearPillar}
                    onChange={handleBasicInputChange}
                    placeholder="e.g., 甲子"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">月柱</label>
                  <input
                    type="text"
                    name="monthPillar"
                    value={formData.monthPillar}
                    onChange={handleBasicInputChange}
                    placeholder="e.g., 丙寅"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">日柱</label>
                  <input
                    type="text"
                    name="dayPillar"
                    value={formData.dayPillar}
                    onChange={handleBasicInputChange}
                    placeholder="e.g., 丁卯"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">时柱</label>
                  <input
                    type="text"
                    name="hourPillar"
                    value={formData.hourPillar}
                    onChange={handleBasicInputChange}
                    placeholder="e.g., 戊辰"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">起运年龄</label>
                  <input
                    type="text"
                    name="startAge"
                    value={formData.startAge}
                    onChange={handleBasicInputChange}
                    placeholder="e.g., 8"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">第一步大运</label>
                  <input
                    type="text"
                    name="firstDaYun"
                    value={formData.firstDaYun}
                    onChange={handleBasicInputChange}
                    placeholder="e.g., 甲戌"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{initialData ? '更新档案' : '创建档案'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProfileModal;
