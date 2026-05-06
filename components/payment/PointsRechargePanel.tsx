import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Coins, Loader2, QrCode, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface PointPackage {
  id: string;
  name: string;
  points: number;
  bonus: number;
  price_cny: number;
  is_recommended?: boolean;
}

interface PaymentOrder {
  id: string;
  status: string;
  totalPoints: number;
  amountCents: number;
}

interface PricingResponse {
  packages: PointPackage[];
}

interface CreateOrderResponse {
  order: PaymentOrder;
  mode: 'native' | 'h5';
  codeUrl?: string;
  h5Url?: string;
  message?: string;
}

interface PointsRechargePanelProps {
  onPaid?: () => void;
}

const STORAGE_KEY = 'life-kline-pending-order';

const PointsRechargePanel: React.FC<PointsRechargePanelProps> = ({ onPaid }) => {
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [mode, setMode] = useState<'native' | 'h5'>('native');
  const [isMobile, setIsMobile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PaymentOrder | null>(null);
  const [codeUrl, setCodeUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const pollRef = useRef<number | null>(null);

  const clearPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const markPaid = (order: PaymentOrder) => {
    clearPolling();
    setPendingOrder(order);
    setCodeUrl('');
    setSuccessMessage(`支付成功，已到账 ${order.totalPoints} 点`);
    window.localStorage.removeItem(STORAGE_KEY);
    if (onPaid) onPaid();
  };

  const queryOrderById = async (orderId: string) => {
    const response = await fetch(`/api/payment/orders/${orderId}`, { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.order || null;
  };

  const startPolling = (orderId: string) => {
    clearPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const order = await queryOrderById(orderId);
        if (order?.status === 'paid') {
          markPaid(order);
        }
      } catch {
        // ignore transient polling errors
      }
    }, 3000);
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      setMode(mobile ? 'h5' : 'native');
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const loadPackages = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/public/pricing');
        if (!response.ok) throw new Error('加载积分套餐失败');
        const data: PricingResponse = await response.json();
        const list = data.packages || [];
        setPackages(list);
        const recommended = list.find((item) => item.is_recommended) || list[0];
        if (recommended) setSelectedPackageId(recommended.id);
      } catch (err: any) {
        setError(err.message || '加载积分套餐失败');
      } finally {
        setLoading(false);
      }
    };

    loadPackages();
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const order = JSON.parse(stored) as PaymentOrder;
      setPendingOrder(order);
      startPolling(order.id);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return clearPolling;
  }, []);

  const selectedPackage = packages.find((item) => item.id === selectedPackageId) || null;

  const createOrder = async () => {
    if (!selectedPackage) {
      setError('请选择积分套餐');
      return;
    }

    setCreating(true);
    setError('');
    setSuccessMessage('');
    setPendingOrder(null);
    setCodeUrl('');

    try {
      const response = await fetch('/api/payment/wechat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageId: selectedPackage.id,
          mode,
          returnUrl: window.location.href,
        }),
      });

      const data: CreateOrderResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '创建订单失败');
      }

      setPendingOrder(data.order);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.order));

      if (mode === 'h5' && data.h5Url) {
        window.location.href = data.h5Url;
        return;
      }

      if (data.codeUrl) {
        setCodeUrl(data.codeUrl);
        startPolling(data.order.id);
      }
    } catch (err: any) {
      setError(err.message || '创建订单失败');
    } finally {
      setCreating(false);
    }
  };

  const queryOrderNow = async () => {
    if (!pendingOrder) return;
    try {
      const order = await queryOrderById(pendingOrder.id);
      if (order?.status === 'paid') {
        markPaid(order);
      } else {
        setError('订单尚未支付完成，请稍后再试');
      }
    } catch {
      setError('查询订单状态失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-mystic-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {packages.map((pkg) => {
          const total = pkg.points + (pkg.bonus || 0);
          const active = pkg.id === selectedPackageId;
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedPackageId(pkg.id)}
              className={`rounded-xl border p-5 text-left transition-all ${
                active
                  ? 'border-mystic-500 bg-mystic-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-mystic-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-gray-900">{pkg.name}</div>
                {pkg.is_recommended ? (
                  <span className="rounded-full bg-golden-100 px-2 py-1 text-xs font-medium text-golden-700">
                    推荐
                  </span>
                ) : null}
              </div>
              <div className="mt-4 text-3xl font-bold text-gray-900">{total.toLocaleString()}</div>
              <div className="mt-1 text-sm text-gray-500">
                {pkg.points.toLocaleString()} 点{pkg.bonus ? ` + ${pkg.bonus} 赠送` : ''}
              </div>
              <div className="mt-4 text-lg font-semibold text-mystic-700">¥{pkg.price_cny}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-gray-900">支付方式</div>
            <div className="mt-1 text-sm text-gray-500">PC 端使用微信扫码支付，移动端跳转微信 H5 支付</div>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setMode('native')}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                mode === 'native' ? 'bg-mystic-600 text-white' : 'text-gray-600'
              }`}
            >
              <QrCode className="w-4 h-4" />
              PC 扫码
            </button>
            <button
              type="button"
              onClick={() => setMode('h5')}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
                mode === 'h5' ? 'bg-mystic-600 text-white' : 'text-gray-600'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              手机 H5
            </button>
          </div>
        </div>

        {isMobile && mode === 'native' ? (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            当前是移动端，推荐切换到“手机 H5”直接拉起微信支付。
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Coins className="w-4 h-4 text-golden-600" />
            <span>
              {selectedPackage
                ? `本次到账 ${selectedPackage.points + (selectedPackage.bonus || 0)} 点`
                : '请选择积分套餐'}
            </span>
          </div>
          <button
            type="button"
            onClick={createOrder}
            disabled={creating || !selectedPackage}
            className="rounded-lg bg-gradient-mystic px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? '创建订单中...' : mode === 'h5' ? '前往微信支付' : '生成扫码二维码'}
          </button>
        </div>

        {codeUrl && pendingOrder ? (
          <div className="mt-6 rounded-xl border border-dashed border-mystic-200 bg-mystic-50/50 p-6">
            <div className="flex flex-col items-center gap-4">
              <QRCodeSVG value={codeUrl} size={220} />
              <div className="text-center">
                <div className="text-base font-semibold text-gray-900">请使用微信扫码支付</div>
                <div className="mt-1 text-sm text-gray-500">
                  订单号 {pendingOrder.id}，支付完成后积分会自动到账
                </div>
              </div>
              <button
                type="button"
                onClick={queryOrderNow}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                我已支付，刷新状态
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PointsRechargePanel;
