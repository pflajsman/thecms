import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import i18next from 'eslint-plugin-i18next'
import { readFileSync } from 'node:fs'

const i18nScope = JSON.parse(readFileSync(new URL('./i18n-scope.json', import.meta.url), 'utf8')).files
const i18nScopeTs = i18nScope.filter((f) => f.endsWith('.ts'))

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Generated shadcn/ui components export variant helpers next to components.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Converted files may not show literal text: JSX text and user-facing attributes must come from the catalogs.
    files: i18nScope.length ? i18nScope : ['__no-files-yet__'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            exclude: [
              'className', 'style', 'type', 'key', 'id', 'width', 'height', 'variant', 'size', 'align', 'side',
              'sideOffset', 'role', 'to', 'href', 'htmlFor', 'name', 'value', 'autoComplete', 'inputMode', 'rel',
              'target', 'accept', 'orientation', 'src', 'method', 'lang', 'dir', 'viewBox', 'fill', 'stroke', 'd',
              'xmlns', 'strokeWidth', 'tabIndex', 'pattern', 'min', 'max', 'step', 'scope', 'dateTime', 'mode', 'as', 'saveTone',
              'data-.+', 'aria-(hidden|pressed|invalid|busy|current|expanded|live|haspopup|controls|describedby|labelledby|multiline|modal|selected|checked|disabled|level|orientation|atomic)',
            ],
          },
          words: { exclude: ['[0-9!-/:-@[-`{-~·…×–•]+', '[A-Z_-]+', 'TheCMS', '⌘[A-Z]', 'https?://\\S*', '\\s*px'] },
          // Editor and state APIs take identifiers, not copy.
          callees: { exclude: ['i18n(ext)?', 't', 'isActive', 'getAttributes', 'updateAttributes', 'setTextAlign', 'extendMarkRange', 'setConfirm', 'renderField', 'includes', 'startsWith', 'endsWith'] },
          'object-properties': { exclude: ['[A-Z_-]+', 'textAlign', 'float'] },
        },
      ],
    },
  },
  {
    // Plain .ts files in scope have no JSX, so check every string literal there.
    files: i18nScopeTs.length ? i18nScopeTs : ['__no-files-yet__'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'all',
          // Single lowercase words here are identifiers (categories, statuses), not copy.
          words: { exclude: ['[0-9!-/:-@[-`{-~·…×–•]+', '[A-Z_-]+', 'https?://\\S*', '[a-z][a-zA-Z0-9]*'] },
          callees: { exclude: ['i18n(ext)?', 't', 'useTranslation', 'includes', 'startsWith', 'endsWith', 'RegExp', 'test', 'split', 'join', 'replace'] },
          'object-properties': { exclude: ['[A-Z_-]+', 'action', 'status', 'type', 'queryKey', 'labelKey', 'id', 'to'] },
        },
      ],
    },
  },
])
