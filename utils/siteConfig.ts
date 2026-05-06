import { useEffect, useState } from 'react';

interface SiteConfig {
  name: string;
  domain: string;
  url: string;
  description: string;
  keywords: string;
  copyright: string;
  showOfficialLink: boolean;
  officialUrl: string;
}

const DEFAULT_SITE_CONFIG: SiteConfig = {
  name: '人生K线',
  domain: 'localhost:5173',
  url: 'http://localhost:5173',
  description: '基于 AI 大模型 + 传统八字命理的人生运势可视化工具',
  keywords: '八字,命理,K线,运势,AI分析',
  copyright: '',
  showOfficialLink: true,
  officialUrl: 'https://www.life-kline.com',
};

export function useSiteConfig() {
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/site-config')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.name) {
          setSiteConfig({ ...DEFAULT_SITE_CONFIG, ...data });
        }
      })
      .catch(() => {
        // Keep local defaults when the API is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return siteConfig;
}
