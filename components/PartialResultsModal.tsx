import React from 'react';
import { X, CheckCircle, Loader2, Brain, Briefcase, Heart, Bitcoin, Clock } from 'lucide-react';
import { AgentStatus, AgentType, LifeDestinyResult } from '../types';

interface PartialResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentStatuses: Record<AgentType, AgentStatus>;
  result?: LifeDestinyResult | null;
}

const agentNames: Record<AgentType, string> = {
  core: '核心命理',
  kline: 'K线数据',
  career: '事业财富',
  marriage: '婚姻健康',
  crypto: '币圈分析',
};

const agentIcons: Record<AgentType, React.ComponentType<{ className?: string }>> = {
  core: Brain,
  kline: Clock,
  career: Briefcase,
  marriage: Heart,
  crypto: Bitcoin,
};

const hasValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const hasRenderableAgentData = (
  agentType: AgentType,
  agentStatuses: Record<AgentType, AgentStatus>,
  result?: LifeDestinyResult | null
) => {
  const data = getAgentData(agentType, agentStatuses, result) as any;

  switch (agentType) {
    case 'core':
      return [data.summary, data.personality, data.family, data.fengShui].some(hasValue);
    case 'kline':
      return (
        (Array.isArray(data.chartData) && data.chartData.length > 0) ||
        (Array.isArray(data.pastEvents) && data.pastEvents.length > 0) ||
        (Array.isArray(data.futureEvents) && data.futureEvents.length > 0)
      );
    case 'career':
      return [data.industry, data.wealth].some(hasValue);
    case 'marriage':
      return [data.marriage, data.health].some(hasValue);
    case 'crypto':
      return [data.crypto, data.cryptoYear, data.cryptoStyle].some(hasValue);
    default:
      return false;
  }
};

const getAgentData = (
  agentType: AgentType,
  agentStatuses: Record<AgentType, AgentStatus>,
  result?: LifeDestinyResult | null
) => {
  const liveData = agentStatuses[agentType]?.data || {};
  const finalAnalysis = result?.analysis;

  switch (agentType) {
    case 'core':
      return {
        summary: liveData.summary || finalAnalysis?.summary,
        personality: liveData.personality || finalAnalysis?.personality,
        family: liveData.family || finalAnalysis?.family,
        fengShui: liveData.fengShui || finalAnalysis?.fengShui,
      };
    case 'kline':
      return {
        chartData: liveData.chartPoints || result?.chartData,
        pastEvents: liveData.pastEvents || finalAnalysis?.pastEvents,
        futureEvents: liveData.futureEvents || finalAnalysis?.futureEvents,
      };
    case 'career':
      return {
        industry: liveData.industry || finalAnalysis?.industry,
        wealth: liveData.wealth || finalAnalysis?.wealth,
      };
    case 'marriage':
      return {
        marriage: liveData.marriage || finalAnalysis?.marriage,
        health: liveData.health || finalAnalysis?.health,
      };
    case 'crypto':
      return {
        crypto: liveData.crypto || finalAnalysis?.crypto,
        cryptoYear: liveData.cryptoYear || finalAnalysis?.cryptoYear,
        cryptoStyle: liveData.cryptoStyle || finalAnalysis?.cryptoStyle,
      };
    default:
      return {};
  }
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h5 className="mb-2 font-medium text-gray-700">{title}</h5>
    <div className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">{children}</div>
  </div>
);

const renderAgentContent = (
  agentType: AgentType,
  agentStatuses: Record<AgentType, AgentStatus>,
  result?: LifeDestinyResult | null
) => {
  const data = getAgentData(agentType, agentStatuses, result) as any;

  switch (agentType) {
    case 'core':
      return (
        <div className="space-y-4">
          {hasValue(data.summary) && <Section title="命理总评">{data.summary}</Section>}
          {hasValue(data.personality) && <Section title="性格分析">{data.personality}</Section>}
          {hasValue(data.family) && <Section title="六亲关系">{data.family}</Section>}
          {hasValue(data.fengShui) && <Section title="发展风水">{data.fengShui}</Section>}
        </div>
      );
    case 'kline':
      return (
        <div className="space-y-4">
          {Array.isArray(data.chartData) && data.chartData.length > 0 && (
            <Section title="K线数据已生成">共 {data.chartData.length} 个数据点。</Section>
          )}
          {Array.isArray(data.pastEvents) && data.pastEvents.length > 0 && (
            <Section title="过去事件">{data.pastEvents.slice(0, 3).map((item: any) => item.event || item.reason || String(item)).join('\n')}</Section>
          )}
          {Array.isArray(data.futureEvents) && data.futureEvents.length > 0 && (
            <Section title="未来事件">{data.futureEvents.slice(0, 3).map((item: any) => item.event || item.reason || String(item)).join('\n')}</Section>
          )}
        </div>
      );
    case 'career':
      return (
        <div className="space-y-4">
          {hasValue(data.industry) && <Section title="事业行业">{data.industry}</Section>}
          {hasValue(data.wealth) && <Section title="财富层级">{data.wealth}</Section>}
        </div>
      );
    case 'marriage':
      return (
        <div className="space-y-4">
          {hasValue(data.marriage) && <Section title="婚姻情感">{data.marriage}</Section>}
          {hasValue(data.health) && <Section title="身体健康">{data.health}</Section>}
        </div>
      );
    case 'crypto':
      return (
        <div className="space-y-4">
          {hasValue(data.crypto) && <Section title="币圈交易运势">{data.crypto}</Section>}
          {(hasValue(data.cryptoYear) || hasValue(data.cryptoStyle)) && (
            <div className="flex flex-wrap gap-2">
              {hasValue(data.cryptoYear) && <span className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700">暴富流年: {data.cryptoYear}</span>}
              {hasValue(data.cryptoStyle) && <span className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700">推荐: {data.cryptoStyle}</span>}
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
};

const PartialResultsModal: React.FC<PartialResultsModalProps> = ({
  isOpen,
  onClose,
  agentStatuses,
  result,
}) => {
  if (!isOpen) return null;

  const completedAgents = (Object.keys(agentStatuses) as AgentType[]).filter(
    (type) => agentStatuses[type].status === 'completed'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle className="w-5 h-5" />
            <h3 className="text-lg font-bold">已完成分析预览</h3>
            <span className="text-sm opacity-80">({completedAgents.length}/5)</span>
          </div>
          <button onClick={onClose} className="transition-colors text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {completedAgents.length === 0 ? (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-indigo-500 animate-spin" />
              <p className="text-gray-600">正在分析中，暂无已完成的部分...</p>
              <p className="mt-2 text-sm text-gray-500">请稍候，分析完成后将自动显示。</p>
            </div>
          ) : (
            <div className="space-y-6">
              {completedAgents.map((agentType) => {
                const Icon = agentIcons[agentType];
                const status = agentStatuses[agentType];
                const content = renderAgentContent(agentType, agentStatuses, result);
                const isEmpty = !hasRenderableAgentData(agentType, agentStatuses, result);

                return (
                  <div key={agentType} className="p-5 border border-gray-200 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-indigo-600" />
                        <h4 className="font-bold text-gray-800">{agentNames[agentType]}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        <span>已完成</span>
                        {status.elapsed && <span className="text-gray-500">({status.elapsed}s)</span>}
                      </div>
                    </div>

                    {isEmpty ? <p className="text-sm text-gray-500">该模块已完成，正在整理可展示内容。</p> : content}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600">其他部分仍在分析中，完成后将自动显示在主页面。</p>
          <button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartialResultsModal;
