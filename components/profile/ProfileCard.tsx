import React, { useState } from 'react';
import { Star, Edit, Trash2, Check, Calendar, MapPin, User as UserIcon, TrendingUp, AlertCircle, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { UserInput, Gender } from '../../types';

type CoreDocumentStatus = 'pending' | 'generating' | 'ready' | 'failed';

interface ProfileCardProps {
  profile: UserInput & {
    id: string;
    isDefault: boolean;
    createdAt: string;
    coreDocumentStatus?: CoreDocumentStatus;
  };
  isCurrent?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onSelect: () => void;
  onRegenerateCore: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  isCurrent,
  onEdit,
  onDelete,
  onSetDefault,
  onSelect,
  onRegenerateCore
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getGenderIcon = () => {
    return profile.gender === Gender.MALE ? '♂️' : '♀️';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCoreDocumentBadge = () => {
    const status = profile.coreDocumentStatus || 'pending';

    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <span>待生成</span>
          </div>
        );
      case 'generating':
        return (
          <div className="flex items-center space-x-1 text-xs text-blue-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>生成中</span>
          </div>
        );
      case 'ready':
        return (
          <div className="flex items-center space-x-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span>已就绪</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-1 text-xs text-red-600">
            <AlertCircle className="w-3 h-3" />
            <span>生成失败</span>
          </div>
        );
    }
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  const renderMiniChart = () => {
    // Mock mini K-line chart data
    const mockData = [30, 45, 35, 60, 40, 70, 50, 65, 55, 80];
    const max = Math.max(...mockData);
    const min = Math.min(...mockData);
    const range = max - min;

    return (
      <div className="h-16 flex items-end justify-between space-x-1 px-1">
        {mockData.map((value, index) => {
          const height = ((value - min) / range) * 100;
          const isGreen = index % 3 === 0 || index % 3 === 1;

          return (
            <div
              key={index}
              className="flex-1 rounded-t-xs"
              style={{
                height: `${height}%`,
                backgroundColor: isGreen ? '#10b981' : '#ef4444'
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 ${
        isCurrent ? 'ring-2 ring-blue-500' : ''
      }`}>
        {/* Header with Default Badge and Core Document Status */}
        <div className="flex items-center justify-between mb-3">
          {profile.isDefault && (
            <div className="flex items-center space-x-1 text-amber-600 text-xs font-medium">
              <Star className="w-3 h-3 fill-current" />
              <span>默认档案</span>
            </div>
          )}
          <div className={profile.isDefault ? '' : 'ml-auto'}>
            {getCoreDocumentBadge()}
          </div>
        </div>

        {/* Profile Info */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <UserIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {profile.name || '未命名档案'}
                </h3>
                <p className="text-xs text-gray-500">
                  创建于 {formatDate(profile.createdAt)}
                </p>
              </div>
            </div>
            <span className="text-2xl">{getGenderIcon()}</span>
          </div>

          {/* Bazi Info */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              <span>出生年份：{profile.birthYear}</span>
            </div>

            {(profile.birthPlace) && (
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                  <MapPin className="w-3 h-3" />
                  <span>{profile.birthPlace}</span>
                </div>
            )}

            <div className="bg-gray-50 rounded p-2">
              <p className="text-xs font-medium text-gray-700 mb-1">八字四柱：</p>
              <div className="grid grid-cols-4 gap-1 text-xs">
                <div className="text-center">
                  <div className="text-gray-500">年柱</div>
                  <div className="font-mono font-bold">{profile.yearPillar || '--'}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">月柱</div>
                  <div className="font-mono font-bold">{profile.monthPillar || '--'}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">日柱</div>
                  <div className="font-mono font-bold">{profile.dayPillar || '--'}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500">时柱</div>
                  <div className="font-mono font-bold">{profile.hourPillar || '--'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mini K-line Chart Preview */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-1 mb-2">
            <TrendingUp className="w-3 h-3 text-gray-600" />
            <p className="text-xs text-gray-600">人生走势预览</p>
          </div>
          {renderMiniChart()}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Regenerate button for failed status */}
          {profile.coreDocumentStatus === 'failed' && (
            <button
              onClick={onRegenerateCore}
              className="w-full py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              重新生成核心文档
            </button>
          )}

          <button
            onClick={onSelect}
            className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              isCurrent
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isCurrent ? (
              <>
                <Check className="w-4 h-4 inline mr-1" />
                当前已选中
              </>
            ) : (
              '查看分析'
            )}
          </button>

          <div className="flex space-x-2">
            <button
              onClick={onEdit}
              className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center"
            >
              <Edit className="w-4 h-4 mr-1" />
              编辑
            </button>

            {!profile.isDefault ? (
              <button
                onClick={onSetDefault}
                className="flex-1 py-2 px-3 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium flex items-center justify-center"
              >
                <Star className="w-4 h-4 mr-1" />
                设为默认
              </button>
            ) : (
              <div className="flex-1" />
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="py-2 px-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              删除档案？
            </h3>
            <p className="text-gray-600 mb-6">
              确认删除“{profile.name || '未命名档案'}”吗？删除后将无法恢复。
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileCard;
