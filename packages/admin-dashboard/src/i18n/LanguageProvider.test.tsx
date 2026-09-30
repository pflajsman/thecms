import { act, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { LanguageProvider } from './LanguageProvider'
import { useLanguage } from './useLanguage'
import { LANGUAGE_STORAGE_KEY } from './language'

function Probe() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  return (
    <>
      <p>{t('actions.cancel')}</p>
      <p>lang:{language}</p>
      <button onClick={() => setLanguage('cs')}>to cs</button>
    </>
  )
}

it('switches language, saves the choice and sets html lang', async () => {
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  )
  expect(screen.getByText('Cancel')).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('en')
  await act(async () => screen.getByRole('button', { name: 'to cs' }).click())
  expect(screen.getByText('Zrušit')).toBeInTheDocument()
  expect(screen.getByText('lang:cs')).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('cs')
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('cs')
})
