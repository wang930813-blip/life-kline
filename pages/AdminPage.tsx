import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Coins,
  CreditCard,
  FileText,
  Loader2,
  Package,
  QrCode,
  RefreshCw,
  Shield,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'analyses' | 'pricing' | 'vouchers' | 'wechat' | 'orders' | 'knowledge' | 'cases';

interface AdminStats {
  userCount: number;
  analysisCount: number;
  totalPoints: number;
  todayUsers: number;
}

interface AdminUser {
  id: string;
  email: string;
  points: number;
  role?: string;
  createdAt: string;
  lastLoginAt?: string;
  loginCount?: number;
}

interface AdminAnalysis {
  id: string;
  userId: string;
  userEmail?: string;
  cost: number;
  modelUsed?: string;
  summary?: string;
  createdAt: string;
  status?: string;
}

interface PricingFeature {
  feature_key: string;
  points: number;
  price_usd: number;
  price_cny: number;
  display_name: string;
}

interface PointPackage {
  id: string;
  name: string;
  points: number;
  price_cny: number;
  bonus: number;
  is_recommended: boolean;
}

interface OrderSummary {
  id: string;
  packageName: string;
  totalPoints: number;
  amountCents: number;
  provider: string;
  status: string;
  createdAt: string;
}

interface WechatPayConfig {
  enabled: boolean;
  notifyUrl: string;
  h5Enabled: boolean;
  nativeEnabled: boolean;
  ready: boolean;
}

interface KnowledgeItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  published: boolean;
}

interface CaseItem {
  id: string;
  title: string;
  persona: string;
  curveType: string;
  narrative: string;
  published: boolean;
}

const tabs: Array<{ id: AdminTab; label: string; icon: any }> = [
  { id: 'overview', label: '概览', icon: TrendingUp },
  { id: 'users', label: '用户列表', icon: Users },
  { id: 'analyses', label: '分析历史', icon: FileText },
  { id: 'pricing', label: '价格配置', icon: Package },
  { id: 'vouchers', label: '兑换码', icon: Ticket },
  { id: 'wechat', label: '微信支付', icon: QrCode },
  { id: 'orders', label: '订单列表', icon: CreditCard },
  { id: 'knowledge', label: '知识中心', icon: BookOpen },
  { id: 'cases', label: '案例库', icon: FileText },
];

const emptyKnowledge: KnowledgeItem = {
  id: '',
  slug: '',
  title: '',
  category: 'bazi',
  summary: '',
  content: '',
  published: true,
};

const emptyCase: CaseItem = {
  id: '',
  title: '',
  persona: '',
  curveType: '早发',
  narrative: '',
  published: true,
};

const safeJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      throw new Error('接口返回的是 HTML 页面，不是 JSON。请确认线上请求已转发到 Node 服务。');
    }
    throw new Error(text || '接口返回非 JSON 数据');
  }
};

const AdminPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analyses, setAnalyses] = useState<AdminAnalysis[]>([]);
  const [features, setFeatures] = useState<PricingFeature[]>([]);
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [wechat, setWechat] = useState<WechatPayConfig | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeItem>(emptyKnowledge);
  const [caseForm, setCaseForm] = useState<CaseItem>(emptyCase);

  const [voucherPoints, setVoucherPoints] = useState(1000);
  const [generatedVoucher, setGeneratedVoucher] = useState('');
  const [wechatForm, setWechatForm] = useState({
    enabled: true,
    mchid: '',
    appid: '',
    serialNo: '',
    privateKey: '',
    apiV3Key: '',
    notifyUrl: '',
    nativeEnabled: true,
    h5Enabled: true,
    h5Type: 'Wap',
    h5AppName: '',
    platformPublicKey: '',
  });

  const adminFetch = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data?.message || data?.error || `${url} 请求失败`);
    }
    return data;
  };

  const loadAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [overview, pricing, wechatData, ordersData, usersData, analysesData, knowledgeData, casesData] = await Promise.all([
        adminFetch('/api/admin/overview'),
        adminFetch('/api/admin/pricing'),
        adminFetch('/api/admin/wechat-pay'),
        adminFetch('/api/admin/orders'),
        adminFetch('/api/admin/users'),
        adminFetch('/api/admin/analyses'),
        adminFetch('/api/admin/content/knowledge'),
        adminFetch('/api/admin/content/cases'),
      ]);

      setStats(overview.stats || null);
      setUsers(usersData.users || []);
      setAnalyses(analysesData.analyses || []);
      setFeatures(pricing.features || []);
      setPackages(pricing.packages || []);
      setOrders(ordersData.orders || []);
      setWechat(wechatData.publicConfig || null);
      setKnowledgeItems(knowledgeData.items || []);
      setCaseItems(casesData.items || []);
      setWechatForm((prev) => ({
        ...prev,
        enabled: wechatData.config?.enabled ?? prev.enabled,
        mchid: wechatData.config?.mchid || '',
        appid: wechatData.config?.appid || '',
        serialNo: wechatData.config?.serialNo || '',
        privateKey: wechatData.config?.privateKey || '',
        apiV3Key: wechatData.config?.apiV3Key || '',
        notifyUrl: wechatData.config?.notifyUrl || '',
        nativeEnabled: wechatData.config?.nativeEnabled ?? prev.nativeEnabled,
        h5Enabled: wechatData.config?.h5Enabled ?? prev.h5Enabled,
        h5Type: wechatData.config?.h5Type || 'Wap',
        h5AppName: wechatData.config?.h5AppName || '',
        platformPublicKey: wechatData.config?.platformPublicKey || '',
      }));
    } catch (err: any) {
      setMessage(err.message || '加载后台数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const check = async () => {
      try {
        await adminFetch('/api/admin/me');
        setAuthed(true);
        loadAll();
      } catch {
        setAuthed(false);
      }
    };
    check();
  }, []);

  const login = async () => {
    setLoading(true);
    setMessage('');
    try {
      await adminFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setAuthed(true);
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || '后台登录失败');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthed(false);
    setUsername('');
    setPassword('');
  };

  const savePricing = async () => {
    setLoading(true);
    setMessage('');
    try {
      await Promise.all([
        adminFetch('/api/admin/pricing', {
          method: 'PUT',
          body: JSON.stringify({ features }),
        }),
        adminFetch('/api/admin/packages', {
          method: 'PUT',
          body: JSON.stringify({ packages }),
        }),
      ]);
      setMessage('价格配置已保存');
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || '保存价格失败');
    } finally {
      setLoading(false);
    }
  };

  const saveWechat = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await adminFetch('/api/admin/wechat-pay', {
        method: 'PUT',
        body: JSON.stringify(wechatForm),
      });
      setWechat(data.publicConfig || null);
      setMessage('微信支付配置已保存');
    } catch (err: any) {
      setMessage(err.message || '保存微信支付配置失败');
    } finally {
      setLoading(false);
    }
  };

  const generateVoucher = async () => {
    setLoading(true);
    setMessage('');
    setGeneratedVoucher('');
    try {
      const data = await adminFetch('/api/admin/voucher/generate-v2', {
        method: 'POST',
        body: JSON.stringify({ points: voucherPoints }),
      });
      setGeneratedVoucher(`${data.code} / ${data.points} 点`);
      setMessage('兑换码已生成');
    } catch (err: any) {
      setMessage(err.message || '生成兑换码失败');
    } finally {
      setLoading(false);
    }
  };

  const saveKnowledge = async () => {
    setLoading(true);
    setMessage('');
    try {
      const url = knowledgeForm.id ? `/api/admin/content/knowledge/${knowledgeForm.id}` : '/api/admin/content/knowledge';
      const method = knowledgeForm.id ? 'PUT' : 'POST';
      await adminFetch(url, {
        method,
        body: JSON.stringify(knowledgeForm),
      });
      setKnowledgeForm(emptyKnowledge);
      setMessage('知识文章已保存');
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || '保存知识文章失败');
    } finally {
      setLoading(false);
    }
  };

  const saveCase = async () => {
    setLoading(true);
    setMessage('');
    try {
      const url = caseForm.id ? `/api/admin/content/cases/${caseForm.id}` : '/api/admin/content/cases';
      const method = caseForm.id ? 'PUT' : 'POST';
      await adminFetch(url, {
        method,
        body: JSON.stringify(caseForm),
      });
      setCaseForm(emptyCase);
      setMessage('案例已保存');
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || '保存案例失败');
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">后台管理登录</h1>
              <p className="text-sm text-gray-500">独立后台入口</p>
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-900"
              placeholder="后台账号"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-900"
              placeholder="后台密码"
            />
            {message ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
            ) : null}
            <button
              type="button"
              onClick={login}
              disabled={loading}
              className="w-full rounded-xl bg-gray-900 px-4 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? '登录中...' : '进入后台'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">后台管理</h1>
            <p className="mt-1 text-sm text-gray-500">用户、支付、内容、案例统一管理</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
            >
              退出登录
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                activeTab === tab.id ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {message ? (
          <div className="mb-6 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-700" />
          </div>
        ) : null}

        {!loading && activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="用户数" value={stats?.userCount || 0} icon={Users} />
              <StatCard label="分析总数" value={stats?.analysisCount || 0} icon={FileText} />
              <StatCard label="站内积分" value={stats?.totalPoints || 0} icon={Coins} />
              <StatCard label="今日新增" value={stats?.todayUsers || 0} icon={Users} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="最新用户">
                <SimpleUserList users={users.slice(0, 8)} />
              </Panel>
              <Panel title="微信支付状态">
                <div className="space-y-2 text-sm text-gray-700">
                  <div>已启用：{wechat?.enabled ? '是' : '否'}</div>
                  <div>PC 扫码：{wechat?.nativeEnabled ? '开启' : '关闭'}</div>
                  <div>H5：{wechat?.h5Enabled ? '开启' : '关闭'}</div>
                  <div>配置完整：{wechat?.ready ? '是' : '否'}</div>
                  <div>回调地址：{wechat?.notifyUrl || '未配置'}</div>
                </div>
              </Panel>
            </div>
          </div>
        )}

        {!loading && activeTab === 'users' && (
          <Panel title="用户列表">
            <SimpleUserTable users={users} />
          </Panel>
        )}

        {!loading && activeTab === 'analyses' && (
          <Panel title="分析历史">
            <SimpleAnalysisTable analyses={analyses} />
          </Panel>
        )}

        {!loading && activeTab === 'pricing' && (
          <div className="space-y-6">
            <Panel title="功能价格">
              <div className="mb-4 flex justify-end">
                <button type="button" onClick={savePricing} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
                  保存价格
                </button>
              </div>
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={feature.feature_key} className="grid gap-3 rounded-xl border border-gray-100 p-4 md:grid-cols-4">
                    <div>
                      <div className="font-medium text-gray-900">{feature.display_name}</div>
                      <div className="text-xs text-gray-500">{feature.feature_key}</div>
                    </div>
                    <input
                      type="number"
                      value={feature.points}
                      onChange={(e) => {
                        const next = [...features];
                        next[index] = { ...feature, points: parseInt(e.target.value, 10) || 0 };
                        setFeatures(next);
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-2"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={feature.price_cny}
                      onChange={(e) => {
                        const next = [...features];
                        next[index] = { ...feature, price_cny: parseFloat(e.target.value) || 0 };
                        setFeatures(next);
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-2"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={feature.price_usd}
                      onChange={(e) => {
                        const next = [...features];
                        next[index] = { ...feature, price_usd: parseFloat(e.target.value) || 0 };
                        setFeatures(next);
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-2"
                    />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="积分套餐">
              <div className="grid gap-4 md:grid-cols-3">
                {packages.map((pkg, index) => (
                  <div key={pkg.id} className="rounded-xl border border-gray-100 p-4">
                    <input
                      value={pkg.name}
                      onChange={(e) => {
                        const next = [...packages];
                        next[index] = { ...pkg, name: e.target.value };
                        setPackages(next);
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 font-medium"
                    />
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        value={pkg.points}
                        onChange={(e) => {
                          const next = [...packages];
                          next[index] = { ...pkg, points: parseInt(e.target.value, 10) || 0 };
                          setPackages(next);
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="number"
                        value={pkg.bonus}
                        onChange={(e) => {
                          const next = [...packages];
                          next[index] = { ...pkg, bonus: parseInt(e.target.value, 10) || 0 };
                          setPackages(next);
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={pkg.price_cny}
                        onChange={(e) => {
                          const next = [...packages];
                          next[index] = { ...pkg, price_cny: parseFloat(e.target.value) || 0 };
                          setPackages(next);
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-2"
                      />
                      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={pkg.is_recommended}
                          onChange={(e) => {
                            const next = packages.map((item, i) => ({
                              ...item,
                              is_recommended: i === index ? e.target.checked : false,
                            }));
                            setPackages(next);
                          }}
                        />
                        推荐
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {!loading && activeTab === 'vouchers' && (
          <Panel title="生成兑换码">
            <div className="flex flex-wrap gap-3">
              <input
                type="number"
                value={voucherPoints}
                onChange={(e) => setVoucherPoints(parseInt(e.target.value, 10) || 0)}
                className="rounded-lg border border-gray-200 px-4 py-2"
              />
              <button type="button" onClick={generateVoucher} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
                生成兑换码
              </button>
            </div>
            {generatedVoucher && <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{generatedVoucher}</div>}
          </Panel>
        )}

        {!loading && activeTab === 'wechat' && (
          <Panel title="微信支付配置">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="商户号" value={wechatForm.mchid} onChange={(value) => setWechatForm({ ...wechatForm, mchid: value })} />
              <Field label="AppID" value={wechatForm.appid} onChange={(value) => setWechatForm({ ...wechatForm, appid: value })} />
              <Field label="证书序列号" value={wechatForm.serialNo} onChange={(value) => setWechatForm({ ...wechatForm, serialNo: value })} />
              <Field label="回调地址" value={wechatForm.notifyUrl} onChange={(value) => setWechatForm({ ...wechatForm, notifyUrl: value })} />
              <Field label="APIv3 Key" value={wechatForm.apiV3Key} onChange={(value) => setWechatForm({ ...wechatForm, apiV3Key: value })} />
              <Field label="H5 应用名" value={wechatForm.h5AppName} onChange={(value) => setWechatForm({ ...wechatForm, h5AppName: value })} />
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">商户私钥</label>
              <textarea
                value={wechatForm.privateKey}
                onChange={(e) => setWechatForm({ ...wechatForm, privateKey: e.target.value })}
                rows={6}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm"
              />
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">微信支付平台公钥</label>
              <textarea
                value={wechatForm.platformPublicKey}
                onChange={(e) => setWechatForm({ ...wechatForm, platformPublicKey: e.target.value })}
                rows={6}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wechatForm.enabled}
                  onChange={(e) => setWechatForm({ ...wechatForm, enabled: e.target.checked })}
                />
                启用微信支付
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wechatForm.nativeEnabled}
                  onChange={(e) => setWechatForm({ ...wechatForm, nativeEnabled: e.target.checked })}
                />
                启用 PC 扫码支付
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wechatForm.h5Enabled}
                  onChange={(e) => setWechatForm({ ...wechatForm, h5Enabled: e.target.checked })}
                />
                启用移动端 H5 支付
              </label>
            </div>
            <div className="mt-4">
              <button type="button" onClick={saveWechat} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
                保存微信支付配置
              </button>
            </div>
          </Panel>
        )}

        {!loading && activeTab === 'orders' && (
          <Panel title="订单列表">
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.packageName}</div>
                      <div className="text-xs text-gray-500">{order.id}</div>
                    </div>
                    <div className="text-sm text-gray-700">¥{(order.amountCents / 100).toFixed(2)}</div>
                    <div className="text-sm text-gray-700">{order.totalPoints} 点</div>
                    <div className="text-sm text-gray-700">{order.provider}</div>
                    <div className={`text-sm font-medium ${order.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                      {order.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {!loading && activeTab === 'knowledge' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="知识文章列表">
              <div className="space-y-3">
                {knowledgeItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setKnowledgeForm(item)}
                    className="w-full rounded-xl border border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{item.title}</div>
                    <div className="text-xs text-gray-500">{item.slug} / {item.category}</div>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="编辑知识文章">
              <div className="space-y-3">
                <Field label="标题" value={knowledgeForm.title} onChange={(value) => setKnowledgeForm({ ...knowledgeForm, title: value })} />
                <Field label="Slug" value={knowledgeForm.slug} onChange={(value) => setKnowledgeForm({ ...knowledgeForm, slug: value })} />
                <Field label="分类" value={knowledgeForm.category} onChange={(value) => setKnowledgeForm({ ...knowledgeForm, category: value })} />
                <Field label="摘要" value={knowledgeForm.summary} onChange={(value) => setKnowledgeForm({ ...knowledgeForm, summary: value })} />
                <label className="block text-sm font-medium text-gray-700">
                  正文
                  <textarea
                    value={knowledgeForm.content}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                    rows={10}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={knowledgeForm.published}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, published: e.target.checked })}
                  />
                  发布
                </label>
                <button type="button" onClick={saveKnowledge} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
                  保存知识文章
                </button>
              </div>
            </Panel>
          </div>
        )}

        {!loading && activeTab === 'cases' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="案例列表">
              <div className="space-y-3">
                {caseItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCaseForm(item)}
                    className="w-full rounded-xl border border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{item.title}</div>
                    <div className="text-xs text-gray-500">{item.persona} / {item.curveType}</div>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="编辑案例">
              <div className="space-y-3">
                <Field label="标题" value={caseForm.title} onChange={(value) => setCaseForm({ ...caseForm, title: value })} />
                <Field label="人物标签" value={caseForm.persona} onChange={(value) => setCaseForm({ ...caseForm, persona: value })} />
                <Field label="曲线类型" value={caseForm.curveType} onChange={(value) => setCaseForm({ ...caseForm, curveType: value })} />
                <label className="block text-sm font-medium text-gray-700">
                  案例正文
                  <textarea
                    value={caseForm.narrative}
                    onChange={(e) => setCaseForm({ ...caseForm, narrative: e.target.value })}
                    rows={10}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={caseForm.published}
                    onChange={(e) => setCaseForm({ ...caseForm, published: e.target.checked })}
                  />
                  发布
                </label>
                <button type="button" onClick={saveCase} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">
                  保存案例
                </button>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
};

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl bg-white p-6 shadow-sm">
    <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
    {children}
  </section>
);

const StatCard = ({ label, value, icon: Icon }: { label: string; value: number; icon: any }) => (
  <div className="rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="mt-2 text-3xl font-bold text-gray-900">{value.toLocaleString()}</div>
      </div>
      <div className="rounded-xl bg-gray-100 p-3">
        <Icon className="h-5 w-5 text-gray-700" />
      </div>
    </div>
  </div>
);

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="block text-sm font-medium text-gray-700">
    {label}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3"
    />
  </label>
);

const SimpleUserList = ({ users }: { users: AdminUser[] }) => {
  if (users.length === 0) return <div className="text-sm text-gray-500">暂无用户</div>;
  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div key={user.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-900">{user.email}</div>
            <div className="text-xs text-gray-500">{user.createdAt}</div>
          </div>
          <div className="text-sm font-semibold text-amber-700">{user.points} 点</div>
        </div>
      ))}
    </div>
  );
};

const SimpleUserTable = ({ users }: { users: AdminUser[] }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-3 pr-4">邮箱</th>
          <th className="py-3 pr-4">积分</th>
          <th className="py-3 pr-4">角色</th>
          <th className="py-3 pr-4">注册时间</th>
          <th className="py-3 pr-4">最后登录</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} className="border-b border-gray-100">
            <td className="py-3 pr-4">{user.email}</td>
            <td className="py-3 pr-4">{user.points}</td>
            <td className="py-3 pr-4">{user.role || 'user'}</td>
            <td className="py-3 pr-4">{user.createdAt}</td>
            <td className="py-3 pr-4">{user.lastLoginAt || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SimpleAnalysisTable = ({ analyses }: { analyses: AdminAnalysis[] }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-gray-500">
          <th className="py-3 pr-4">用户</th>
          <th className="py-3 pr-4">摘要</th>
          <th className="py-3 pr-4">消耗积分</th>
          <th className="py-3 pr-4">模型</th>
          <th className="py-3 pr-4">时间</th>
          <th className="py-3 pr-4">状态</th>
        </tr>
      </thead>
      <tbody>
        {analyses.map((item) => (
          <tr key={item.id} className="border-b border-gray-100">
            <td className="py-3 pr-4">{item.userEmail || item.userId || '游客'}</td>
            <td className="py-3 pr-4">{item.summary || '-'}</td>
            <td className="py-3 pr-4">{item.cost}</td>
            <td className="py-3 pr-4">{item.modelUsed || '-'}</td>
            <td className="py-3 pr-4">{item.createdAt}</td>
            <td className="py-3 pr-4">{item.status || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default AdminPage;
