export const FALLBACK_API_BASE_URL = 'https://37chatgpt37.com/v1';
export const FALLBACK_MODEL = 'gpt-5.5';

export function normalizeApiBaseUrl(value = process.env.API_BASE_URL) {
  return String(value || FALLBACK_API_BASE_URL).trim().replace(/\/+$/, '');
}

export function normalizeModelName(value = process.env.DEFAULT_MODEL) {
  return String(value || FALLBACK_MODEL).trim().replace(/[，,]+$/g, '').trim() || FALLBACK_MODEL;
}
