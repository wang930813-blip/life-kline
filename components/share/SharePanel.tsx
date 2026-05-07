import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Download, Twitter, Send, Copy, Check, QrCode, X, Image, Eye, Plus, Gift } from 'lucide-react';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';

interface SharePanelProps {
  userName?: string;
  resultRef: React.RefObject<HTMLDivElement>;
  captureElementId?: string;
  shareUrl?: string;
  onShareSuccess?: (points: number) => void;
  userId?: string;
  analysisId?: string;
}

const SharePanel: React.FC<SharePanelProps> = ({
  userName,
  resultRef,
  captureElementId,
  shareUrl,
  onShareSuccess,
  userId,
  analysisId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showRewardNotification, setShowRewardNotification] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [trackingShare, setTrackingShare] = useState<string | null>(null);

  const currentUrl = shareUrl || window.location.href;
  const shareText = userName
    ? `查看${userName}的人生K线命理报告 - 洞悉命运起伏，预见人生轨迹`
    : '人生K线 - 结合八字命理与金融可视化，洞悉命运起伏';

  // Generate unique share ID
  const generateShareId = () => {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const getCaptureElement = () => {
    if (captureElementId) {
      const element = document.getElementById(captureElementId);
      if (element) return element;
    }
    return resultRef.current;
  };

  const captureReportImage = async (options: { xcom?: boolean } = {}) => {
    const element = getCaptureElement();
    if (!element) throw new Error('未找到可生成图片的报告内容');

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || element.scrollWidth === 0 || element.scrollHeight === 0) {
      throw new Error('报告内容当前不可见，无法生成图片');
    }

    const canvas = await html2canvas(element, {
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#fbf7ea',
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: Math.max(document.documentElement.clientWidth, element.scrollWidth),
      windowHeight: Math.max(document.documentElement.clientHeight, element.scrollHeight),
      width: options.xcom ? Math.min(1200, element.scrollWidth) : element.scrollWidth,
      height: options.xcom ? Math.min(630, element.scrollHeight) : element.scrollHeight,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('图片画布生成失败');
    }

    return canvas;
  };

  // Track share reward
  const trackShareReward = async (platform: string) => {
    if (!userId || !analysisId) return;

    const shareId = generateShareId();
    setTrackingShare(platform);

    try {
      const response = await fetch('/api/share/reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          analysisId,
          shareId,
          platform,
          points: 300,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        setShowRewardNotification(true);
        onShareSuccess?.(300);
        setTimeout(() => setShowRewardNotification(false), 3000);
      }
    } catch (error) {
      console.error('Failed to track share reward:', error);
    } finally {
      setTrackingShare(null);
    }
  };

  // Preview image before export/share
  const handlePreviewImage = async () => {
    try {
      setIsOpen(false);
      const canvas = await captureReportImage();
      setPreviewImage(canvas.toDataURL('image/png'));
      setShowPreview(true);
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  // 导出为图片
  const handleExportImage = async (isXCom: boolean = false) => {
    setExporting(true);

    try {
      const canvas = await captureReportImage({ xcom: isXCom });

      const link = document.createElement('a');
      link.download = `${userName || 'LifeKLine'}_Report_${isXCom ? 'Xcom_' : ''}${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出图片失败，请尝试使用截图功能');
    } finally {
      setExporting(false);
    }
  };

  // 分享到 X.com (Twitter)
  const handleShareTwitter = async () => {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(currentUrl)}&via=laoshiline`;
    window.open(url, '_blank', 'width=550,height=420');

    // Track reward after share
    await trackShareReward('xcom');
  };

  // 分享到 Telegram
  const handleShareTelegram = async () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'width=550,height=420');

    // Track reward after share
    await trackShareReward('telegram');
  };

  // 复制链接
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Track reward after copy
      await trackShareReward('copy');
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = currentUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Track reward after copy
      await trackShareReward('copy');
    }
  };

  // 显示微信二维码
  const handleShowQR = async () => {
    setShowQR(true);
    setIsOpen(false);

    // Track reward for QR share
    await trackShareReward('wechat');
  };

  return (
    <>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium text-sm shadow-sm"
      >
        <Share2 className="w-4 h-4" />
        分享
        {userId && (
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Plus className="w-3 h-3" />
            300积分
          </span>
        )}
      </button>

      {/* Share Panel Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-3 min-w-[240px] z-50 animate-fade-in">
          <div className="px-4 pb-2 mb-2 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-800">分享此报告</p>
            <p className="text-xs text-gray-500">
              让更多人了解人生K线
              {userId && (
                <span className="text-green-600 font-medium ml-1">• 获得积分奖励</span>
              )}
            </p>
          </div>

          {/* Preview Button */}
          <button
            onClick={handlePreviewImage}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <Eye className="w-5 h-5 text-indigo-600" />
            <span>预览图片</span>
          </button>

          {/* Export Options */}
          <div className="px-4 py-1">
            <p className="text-xs text-gray-500 font-medium mb-2">导出图片</p>
            <div className="space-y-1">
              {/* Standard Export */}
              <button
                onClick={() => handleExportImage(false)}
                disabled={exporting}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50 rounded-lg"
              >
                {exporting ? (
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Image className="w-5 h-5 text-green-600" />
                )}
                <span>{exporting ? '正在生成...' : '标准尺寸'}</span>
              </button>

              {/* X.com Export */}
              <button
                onClick={() => handleExportImage(true)}
                disabled={exporting}
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50 rounded-lg"
              >
                {exporting ? (
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Twitter className="w-5 h-5 text-sky-500" />
                )}
                <span>{exporting ? '正在生成...' : 'X.com优化 (1200×630)'}</span>
              </button>
            </div>
          </div>

          {/* 分享到 X.com */}
          <button
            onClick={handleShareTwitter}
            disabled={trackingShare === 'xcom'}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            {trackingShare === 'xcom' ? (
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Twitter className="w-5 h-5 text-sky-500" />
            )}
            <span className="flex-1">分享到 X.com</span>
            {userId && !trackingShare && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                300
              </span>
            )}
          </button>

          {/* 分享到 Telegram */}
          <button
            onClick={handleShareTelegram}
            disabled={trackingShare === 'telegram'}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            {trackingShare === 'telegram' ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-blue-500" />
            )}
            <span className="flex-1">分享到 Telegram</span>
            {userId && !trackingShare && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                300
              </span>
            )}
          </button>

          {/* 微信二维码 */}
          <button
            onClick={handleShowQR}
            disabled={trackingShare === 'wechat'}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            {trackingShare === 'wechat' ? (
              <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <QrCode className="w-5 h-5 text-green-500" />
            )}
            <span className="flex-1">微信扫码分享</span>
            {userId && !trackingShare && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                300
              </span>
            )}
          </button>

          <div className="my-2 border-t border-gray-100" />

          {/* 复制链接 */}
          <button
            onClick={handleCopyLink}
            disabled={trackingShare === 'copy'}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50"
          >
            {trackingShare === 'copy' ? (
              <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            ) : copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5 text-gray-500" />
            )}
            <span className="flex-1">{copied ? '已复制!' : '复制链接'}</span>
            {userId && !trackingShare && !copied && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Plus className="w-3 h-3" />
                300
              </span>
            )}
          </button>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">微信扫码分享</h3>
              <button
                onClick={() => setShowQR(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center p-6 bg-gray-50 rounded-xl">
              <QRCodeSVG
                value={currentUrl}
                size={180}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            <p className="text-center text-sm text-gray-500 mt-4">
              使用微信扫描二维码分享给好友
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* Reward Notification */}
      {showRewardNotification && createPortal(
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-white rounded-lg shadow-lg border border-green-200 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800">🎉 获得300积分奖励！</p>
              <p className="text-sm text-gray-600">感谢您的分享</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {showPreview && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[min(92vw,960px)] max-h-[88vh] overflow-auto animate-fade-in">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">图片预览</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <img
                src={previewImage}
                alt="Preview"
                className="w-full h-auto rounded-lg shadow-sm"
              />
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `${userName || 'LifeKLine'}_Report_${Date.now()}.png`;
                  link.href = previewImage;
                  link.click();
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium text-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载图片
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Click outside to close */}
      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />,
        document.body
      )}
    </>
  );
};

export default SharePanel;
