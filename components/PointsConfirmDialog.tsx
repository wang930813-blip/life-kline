import React from 'react';
import { AlertCircle, Coins, Loader2, Sparkles, X } from 'lucide-react';

interface PointsConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  cost: number;
  currentPoints: number;
  loading?: boolean;
  featureName?: string;
}

export const PointsConfirmDialog: React.FC<PointsConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  cost,
  currentPoints,
  loading = false,
  featureName,
}) => {
  if (!isOpen) return null;

  const hasEnoughPoints = currentPoints >= cost;
  const remainingPoints = currentPoints - cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold text-lg">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600">{description}</p>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">消耗积分</span>
              <div className="flex items-center gap-1.5 text-amber-600">
                <Coins className="w-5 h-5" />
                <span className="text-xl font-bold">{cost}</span>
                <span className="text-sm">点</span>
              </div>
            </div>

            <div className="h-px bg-amber-200 mb-3" />

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">当前余额</span>
              <span className="text-sm font-medium text-gray-700">{currentPoints} 点</span>
            </div>

            {hasEnoughPoints && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-500">使用后余额</span>
                <span className="text-sm font-medium text-green-600">{remainingPoints} 点</span>
              </div>
            )}
          </div>

          {!hasEnoughPoints && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">积分不足</p>
                <p className="text-sm text-red-600 mt-1">
                  还需要 <span className="font-bold">{cost - currentPoints}</span> 点。
                </p>
              </div>
            </div>
          )}

          {featureName && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-700 mb-1">功能说明：</p>
              {featureName === 'DAILY_FORTUNE_AI' && (
                <ul className="space-y-1 list-disc list-inside">
                  <li>基于八字与流日的深度AI分析</li>
                  <li>12时辰吉凶详解</li>
                  <li>四维运势专业解读</li>
                  <li>个性化建议与注意事项</li>
                  <li>结果可长期查看</li>
                </ul>
              )}
              {featureName === 'DAILY_KLINE' && (
                <ul className="space-y-1 list-disc list-inside">
                  <li>61天运势K线图</li>
                  <li>每日详细批断</li>
                  <li>关键日期标注</li>
                </ul>
              )}
              {featureName === 'MONTHLY_KLINE' && (
                <ul className="space-y-1 list-disc list-inside">
                  <li>7个月运势K线图</li>
                  <li>月度趋势分析</li>
                  <li>重点月份提示</li>
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasEnoughPoints || loading}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                处理中...
              </>
            ) : hasEnoughPoints ? (
              <>
                <Coins className="w-4 h-4" />
                确认消耗 {cost} 点
              </>
            ) : (
              '积分不足'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PointsConfirmDialog;
