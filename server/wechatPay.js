import crypto from 'crypto';
import fetch from 'node-fetch';
import { getAdminSetting, setAdminSetting, getAdminSettingsByPrefix } from './database.js';

const PAY_BASE_URL = 'https://api.mch.weixin.qq.com';

const CONFIG_KEYS = [
  'enabled',
  'mchid',
  'appid',
  'serialNo',
  'privateKey',
  'apiV3Key',
  'notifyUrl',
  'h5Enabled',
  'nativeEnabled',
  'h5Type',
  'h5AppName',
  'platformPublicKey',
];

const envConfig = () => ({
  enabled: process.env.WECHAT_PAY_ENABLED || 'false',
  mchid: process.env.WECHAT_PAY_MCH_ID || '',
  appid: process.env.WECHAT_PAY_APP_ID || '',
  serialNo: process.env.WECHAT_PAY_SERIAL_NO || '',
  privateKey: (process.env.WECHAT_PAY_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  apiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
  notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
  h5Enabled: process.env.WECHAT_PAY_H5_ENABLED || 'true',
  nativeEnabled: process.env.WECHAT_PAY_NATIVE_ENABLED || 'true',
  h5Type: process.env.WECHAT_PAY_H5_TYPE || 'Wap',
  h5AppName: process.env.WECHAT_PAY_H5_APP_NAME || process.env.SITE_NAME || 'Life Kline',
  platformPublicKey: (process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
});

export function getWechatPayConfig() {
  const fromEnv = envConfig();
  const rows = getAdminSettingsByPrefix('wechatPay.');
  const fromDb = {};
  for (const key of CONFIG_KEYS) {
    const row = rows[`wechatPay.${key}`];
    if (row?.value !== undefined && row.value !== null && row.value !== '') {
      fromDb[key] = row.value;
    }
  }

  return {
    ...fromEnv,
    ...fromDb,
  };
}

export function getWechatPayPublicConfig() {
  const config = getWechatPayConfig();
  return {
    enabled: config.enabled === 'true',
    mchid: mask(config.mchid),
    appid: mask(config.appid),
    serialNo: mask(config.serialNo),
    notifyUrl: config.notifyUrl,
    h5Enabled: config.h5Enabled !== 'false',
    nativeEnabled: config.nativeEnabled !== 'false',
    h5Type: config.h5Type || 'Wap',
    h5AppName: config.h5AppName || '',
    hasPrivateKey: Boolean(config.privateKey),
    hasApiV3Key: Boolean(config.apiV3Key),
    hasPlatformPublicKey: Boolean(config.platformPublicKey),
    ready: isWechatPayReady(config),
  };
}

export function getWechatPayAdminConfig() {
  const config = getWechatPayConfig();
  return {
    enabled: config.enabled === 'true',
    mchid: config.mchid || '',
    appid: config.appid || '',
    serialNo: config.serialNo || '',
    privateKey: '',
    apiV3Key: '',
    notifyUrl: config.notifyUrl || '',
    h5Enabled: config.h5Enabled !== 'false',
    nativeEnabled: config.nativeEnabled !== 'false',
    h5Type: config.h5Type || 'Wap',
    h5AppName: config.h5AppName || '',
    platformPublicKey: '',
    hasPrivateKey: Boolean(config.privateKey),
    hasApiV3Key: Boolean(config.apiV3Key),
    hasPlatformPublicKey: Boolean(config.platformPublicKey),
    ready: isWechatPayReady(config),
  };
}

export function saveWechatPayConfig(input) {
  const allowed = new Set(CONFIG_KEYS);
  const sensitiveKeys = new Set(['privateKey', 'apiV3Key', 'platformPublicKey']);
  const saved = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!allowed.has(key)) continue;
    const normalized = typeof value === 'boolean' ? String(value) : String(value || '').trim();
    if (sensitiveKeys.has(key) && !normalized) continue;
    setAdminSetting(`wechatPay.${key}`, normalized);
    saved[key] = normalized;
  }
  return saved;
}

export function isWechatPayReady(config = getWechatPayConfig()) {
  return Boolean(
    config.enabled === 'true' &&
    config.mchid &&
    config.appid &&
    config.serialNo &&
    config.privateKey &&
    config.apiV3Key &&
    config.apiV3Key.length === 32 &&
    config.notifyUrl
  );
}

function mask(value) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= 8) return '****';
  return `${str.slice(0, 4)}****${str.slice(-4)}`;
}

function buildAuthorization({ method, urlPath, body = '', config }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = crypto.createSign('RSA-SHA256').update(message).end().sign(config.privateKey, 'base64');

  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;
}

async function requestWechatPay(method, urlPath, payload, config) {
  const body = payload ? JSON.stringify(payload) : '';
  const authorization = buildAuthorization({ method, urlPath, body, config });
  const response = await fetch(`${PAY_BASE_URL}${urlPath}`, {
    method,
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'life-kline/1.0',
    },
    body: body || undefined,
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = data.message || data.raw || `WeChat Pay HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function createWechatNativeOrder({ order, description }) {
  const config = getWechatPayConfig();
  if (!isWechatPayReady(config)) throw new Error('WECHAT_PAY_NOT_READY');
  if (config.nativeEnabled === 'false') throw new Error('WECHAT_NATIVE_DISABLED');

  const payload = {
    appid: config.appid,
    mchid: config.mchid,
    description,
    out_trade_no: order.id,
    notify_url: config.notifyUrl,
    amount: {
      total: order.amountCents,
      currency: 'CNY',
    },
  };

  return requestWechatPay('POST', '/v3/pay/transactions/native', payload, config);
}

export async function createWechatH5Order({ order, description, clientIp }) {
  const config = getWechatPayConfig();
  if (!isWechatPayReady(config)) throw new Error('WECHAT_PAY_NOT_READY');
  if (config.h5Enabled === 'false') throw new Error('WECHAT_H5_DISABLED');

  const payload = {
    appid: config.appid,
    mchid: config.mchid,
    description,
    out_trade_no: order.id,
    notify_url: config.notifyUrl,
    amount: {
      total: order.amountCents,
      currency: 'CNY',
    },
    scene_info: {
      payer_client_ip: clientIp || '127.0.0.1',
      h5_info: {
        type: config.h5Type || 'Wap',
        app_name: config.h5AppName || 'Life Kline',
      },
    },
  };

  return requestWechatPay('POST', '/v3/pay/transactions/h5', payload, config);
}

export async function queryWechatOrder(orderId) {
  const config = getWechatPayConfig();
  if (!isWechatPayReady(config)) throw new Error('WECHAT_PAY_NOT_READY');
  const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderId)}?mchid=${encodeURIComponent(config.mchid)}`;
  return requestWechatPay('GET', urlPath, null, config);
}

export function decryptWechatResource(resource) {
  const config = getWechatPayConfig();
  if (!config.apiV3Key || config.apiV3Key.length !== 32) {
    throw new Error('INVALID_WECHAT_API_V3_KEY');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(config.apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  );
  decipher.setAuthTag(Buffer.from(resource.ciphertext, 'base64').subarray(-16));
  decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf8'));

  const ciphertext = Buffer.from(resource.ciphertext, 'base64').subarray(0, -16);
  const decoded = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(decoded);
}

export function verifyWechatNotifySignature(headers, bodyText) {
  const config = getWechatPayConfig();
  if (!config.platformPublicKey) {
    throw new Error('WECHAT_PLATFORM_PUBLIC_KEY_NOT_SET');
  }

  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  const signature = headers['wechatpay-signature'];
  if (!timestamp || !nonce || !signature) {
    throw new Error('WECHAT_NOTIFY_HEADERS_MISSING');
  }

  const message = `${timestamp}\n${nonce}\n${bodyText}\n`;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(message);
  verifier.end();
  const ok = verifier.verify(config.platformPublicKey, signature, 'base64');
  if (!ok) {
    throw new Error('WECHAT_NOTIFY_SIGNATURE_INVALID');
  }
  return true;
}
