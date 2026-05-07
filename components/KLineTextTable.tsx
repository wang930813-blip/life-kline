import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, FileSpreadsheet, TrendingUp, TrendingDown, X } from 'lucide-react';
import { KLinePoint } from '../types';

interface KLineTextTableProps {
  data: KLinePoint[];
  birthYear?: number;
  className?: string;
}

const KLineTextTable: React.FC<KLineTextTableProps> = ({
  data,
  birthYear,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<KLinePoint | null>(null);
  const currentYear = new Date().getFullYear();

  // Calculate display range - default show 10 years around current age
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];

    if (expanded) {
      return data;
    }

    // Find current year index
    const currentYearIndex = data.findIndex(d => d.year === currentYear);

    if (currentYearIndex === -1) {
      // If current year not found, show first 10 items
      return data.slice(0, 10);
    }

    // Show 5 years before and 5 years after current year
    const startIndex = Math.max(0, currentYearIndex - 5);
    const endIndex = Math.min(data.length, currentYearIndex + 5);

    return data.slice(startIndex, endIndex);
  }, [data, expanded, currentYear]);

  // Export to Excel (CSV format)
  const handleExportExcel = () => {
    if (!data || data.length === 0) return;

    // Create CSV content with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const headers = ['年龄', '年份', '干支', '大运', '评分', '趋势', '运势分析'];
    const rows = data.map(item => {
      const trend = item.close >= item.open ? '上涨' : '下跌';
      // Escape quotes and handle line breaks in reason
      const reason = (item.reason || '').replace(/"/g, '""').replace(/\n/g, ' ');
      return [
        `${item.age}岁`,
        item.year,
        item.ganZhi || '',
        item.daYun || '',
        item.score,
        trend,
        `"${reason}"`,
      ].join(',');
    });

    const csvContent = BOM + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `人生K线_流年详批_${new Date().getTime()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
          <h3 className="text-lg font-bold text-gray-800 font-serif-sc">流年运势详批</h3>
          <span className="text-sm text-gray-500">
            ({expanded ? `全部 ${data.length} 年` : `近10年`})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 font-medium">
              <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-100 w-16">年龄</th>
              <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-100 w-32">年份/干支</th>
              <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-100 w-16">大运</th>
              <th className="px-4 py-3 text-center whitespace-nowrap border-r border-gray-100 w-20">评分</th>
              <th className="px-4 py-3 text-center md:text-left">运势分析</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayData.map((item, index) => {
              const isCurrentYear = item.year === currentYear;
              const isUpTrend = item.close >= item.open;
              const scoreColor = isUpTrend ? 'text-green-600' : 'text-red-600';
              const scoreBg = isUpTrend ? 'bg-green-50' : 'bg-red-50';

              return (
                <tr
                  key={item.year}
                  className={`hover:bg-gray-50 transition-colors ${isCurrentYear ? 'bg-amber-50/50' : ''}`}
                >
                  {/* Age */}
                  <td className="px-4 py-3 text-center border-r border-gray-100">
                    <span className="font-mono font-medium text-gray-700">
                      {item.age}<span className="text-gray-400 text-xs">岁</span>
                    </span>
                  </td>

                  {/* Year + GanZhi */}
                  <td className="px-4 py-3 text-center border-r border-gray-100">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-gray-800">{item.year}</span>
                      <span className="text-indigo-600 font-medium">{item.ganZhi || '-'}</span>
                    </div>
                  </td>

                  {/* DaYun */}
                  <td className="px-4 py-3 text-center border-r border-gray-100">
                    <span className="text-purple-600 font-medium">{item.daYun || '-'}</span>
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-center border-r border-gray-100">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${scoreBg}`}>
                      <span className={`font-bold ${scoreColor}`}>{item.score}</span>
                      {isUpTrend ? (
                        <TrendingUp className={`w-3.5 h-3.5 ${scoreColor}`} />
                      ) : (
                        <TrendingDown className={`w-3.5 h-3.5 ${scoreColor}`} />
                      )}
                    </div>
                  </td>

                  {/* Reason */}
                  <td className="hidden px-4 py-3 md:table-cell">
                    <p className="text-gray-700 leading-relaxed text-justify">
                      {item.reason || '暂无详细分析'}
                    </p>
                  </td>

                  <td className="px-3 py-3 text-center md:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(item)}
                      className="ink-ripple classical-button inline-flex items-center justify-center px-3 py-2 text-xs font-bold"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse Button */}
      <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              收起，仅显示近10年
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              展开查看全部 {data.length} 年运势
            </>
          )}
        </button>
      </div>

      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm md:hidden">
          <div className="scroll-panel max-h-[84vh] w-full max-w-sm overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-ink)] bg-[rgb(18_60_67_/_0.08)] px-5 py-4">
              <div>
                <h4 className="font-serif-sc text-xl font-bold text-[var(--color-qingdai)]">
                  {selectedDetail.year} 年运势详批
                </h4>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  {selectedDetail.age}岁 · {selectedDetail.ganZhi || '-'} · 大运 {selectedDetail.daYun || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="ink-ripple rounded-full p-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-cinnabar)]"
                aria-label="关闭详情"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto px-5 py-5">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[rgb(18_60_67_/_0.08)] px-3 py-1.5">
                <span className="text-sm text-[var(--color-ink-muted)]">评分</span>
                <span className="font-bold text-[var(--color-cinnabar)]">{selectedDetail.score}</span>
                {selectedDetail.close >= selectedDetail.open ? (
                  <TrendingUp className="h-4 w-4 text-[var(--color-cinnabar)]" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-[var(--color-cinnabar)]" />
                )}
              </div>

              <p className="whitespace-pre-line text-justify text-base leading-8 text-[var(--color-ink)]">
                {selectedDetail.reason || '暂无详细分析'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KLineTextTable;
