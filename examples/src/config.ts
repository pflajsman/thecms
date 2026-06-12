/**
 * Runtime configuration, injected via /config.js (window.__CMS_CONFIG__).
 * In production config.js is generated from GitHub secrets at deploy time;
 * for local dev it lives in public/config.js.
 */
export interface CmsConfig {
  apiUrl: string;
  apiKey: string;
  siteTitle: string;
  /** slug of the content type used for blog posts */
  postsSlug: string;
  /** slug of the contact form */
  contactFormSlug: string;
}

declare global {
  interface Window {
    __CMS_CONFIG__?: Partial<CmsConfig>;
  }
}

const raw = window.__CMS_CONFIG__ ?? {};

export const config: CmsConfig = {
  apiUrl: raw.apiUrl || 'YOUR_API_URL_HERE',
  apiKey: raw.apiKey || 'YOUR_API_KEY_HERE',
  siteTitle: raw.siteTitle || 'flajsman.cz',
  postsSlug: raw.postsSlug || 'blog-post',
  contactFormSlug: raw.contactFormSlug || 'contact-us',
};

/** True when the site hasn't been configured with a real API key yet. */
export const isConfigured = config.apiKey !== 'YOUR_API_KEY_HERE' && !!config.apiUrl;
