import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// config.ts reads this when it is first imported, so it is set before any test imports the app.
window.__CMS_CONFIG__ = { apiUrl: 'http://cms.test/api/v1/public', apiKey: 'test-key', contentLanguage: 'cs' };

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
