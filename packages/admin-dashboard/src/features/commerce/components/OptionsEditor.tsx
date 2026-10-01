import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { apiErrorMessage } from '@/lib/api-error'
import type { Language } from '@/features/languages/languages-api'
import type { ProductOption, Variant } from '../commerce-api'
import { useCommerceWrites } from '../commerce-queries'
import { removedByOptions } from '../variant-plan'
import { cleanLabels, optionKey } from './option-keys'

const MAX_OPTIONS = 3

interface OptionsEditorProps {
  productId: string
  options: ProductOption[]
  variants: Variant[]
  languages: Language[]
  onDirty: (dirty: boolean) => void
  /** True while the variants table has unsaved edits: applying options replaces its rows. */
  variantsDirty?: boolean
}

export function OptionsEditor({ productId, options, variants, languages, onDirty, variantsDirty = false }: OptionsEditorProps) {
  const { t } = useTranslation('commerce')
  const writes = useCommerceWrites()
  const [draft, setDraft] = useState<ProductOption[]>(options)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Variant[] | null>(null)
  const [pending, setPending] = useState(false)
  const defaultCode = languages.find((l) => l.isDefault)?.code ?? languages[0]?.code ?? 'en'
  const languageName = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  const codes = languages.length ? languages.map((l) => l.code) : [defaultCode]

  const cleaned = draft.map((o) => ({ ...o, labels: cleanLabels(o.labels), values: o.values.map((v) => ({ ...v, labels: cleanLabels(v.labels) })) }))
  const dirty = JSON.stringify(cleaned) !== JSON.stringify(options)
  useEffect(() => onDirty(dirty), [dirty, onDirty])
  useEffect(() => setDraft(options), [options])

  // Saved keys never change (sites read them); new options and values take their key from the label.
  const withKeys = (list: ProductOption[]): ProductOption[] => {
    const keyed: ProductOption[] = []
    for (const o of list) {
      const saved = options.find((s) => s.key === o.key)
      const key = saved ? o.key : optionKey(o.labels[defaultCode] ?? o.key, [...keyed.map((k) => k.key), ...list.filter((x) => x !== o && options.some((s) => s.key === x.key)).map((x) => x.key)])
      const values: ProductOption['values'] = []
      for (const v of o.values) {
        const savedValue = saved?.values.some((s) => s.key === v.key)
        values.push({ ...v, key: savedValue ? v.key : optionKey(v.labels[defaultCode] ?? v.key, [...values.map((x) => x.key), ...o.values.filter((x) => x !== v && saved?.values.some((s) => s.key === x.key)).map((x) => x.key)]) })
      }
      keyed.push({ ...o, key, values })
    }
    return keyed
  }

  const setOption = (i: number, next: ProductOption) => setDraft(draft.map((o, j) => (j === i ? next : o)))

  const validate = (): string | null => {
    for (const o of cleaned) {
      if (!o.labels[defaultCode]) return t('options.labelRequired', { language: languageName(defaultCode) })
      for (const v of o.values) if (!v.labels[defaultCode]) return t('options.labelRequired', { language: languageName(defaultCode) })
      if (o.values.length === 0) return t('options.valueRequired')
    }
    return null
  }

  const apply = async () => {
    setConfirm(null)
    setPending(true)
    try {
      await writes.update(productId, { options: withKeys(cleaned) })
      toast.success(t('options.applied'))
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  const requestApply = () => {
    const problem = variantsDirty ? t('options.saveVariantsFirst') : validate()
    setError(problem)
    if (problem) return
    const removed = removedByOptions(variants, withKeys(cleaned))
    if (removed.length) setConfirm(removed)
    else void apply()
  }

  return (
    <section aria-label={t('options.title')} className="space-y-3">
      <div>
        <h2 className="font-serif text-xl font-semibold">{t('options.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('options.hint')}</p>
      </div>
      {draft.map((option, i) => {
        const optionName = option.labels[defaultCode] || option.key
        return (
          <div key={option.key} className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-end gap-2">
              {codes.map((code) => (
                <Input
                  key={code}
                  aria-label={t('options.name', { language: languageName(code) })}
                  value={option.labels[code] ?? ''}
                  onChange={(e) => setOption(i, { ...option, labels: { ...option.labels, [code]: e.target.value } })}
                  className="w-44"
                />
              ))}
              <span className="flex-1" />
              <Button variant="ghost" size="icon" aria-label={t('options.removeOption', { name: optionName })} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {option.values.map((value, k) => (
                <li key={value.key} className="flex flex-wrap items-center gap-2">
                  {codes.map((code) => (
                    <Input
                      key={code}
                      aria-label={t('options.value', { language: languageName(code) })}
                      value={value.labels[code] ?? ''}
                      onChange={(e) =>
                        setOption(i, {
                          ...option,
                          values: option.values.map((v, m) => (m === k ? { ...v, labels: { ...v.labels, [code]: e.target.value } } : v)),
                        })
                      }
                      className="w-36"
                    />
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('options.removeValue', { value: value.labels[defaultCode] || value.key })}
                    onClick={() => setOption(i, { ...option, values: option.values.filter((_, m) => m !== k) })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const label = t('options.newValue', { count: option.values.length + 1 })
                setOption(i, { ...option, values: [...option.values, { key: optionKey(label, option.values.map((v) => v.key)), labels: { [defaultCode]: label } }] })
              }}
            >
              <Plus aria-hidden />
              {t('options.addValue')}
            </Button>
          </div>
        )
      })}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={draft.length >= MAX_OPTIONS}
          onClick={() => {
            const label = t('options.newOption', { count: draft.length + 1 })
            const key = optionKey(label, draft.map((o) => o.key))
            const firstValue = t('options.newValue', { count: 1 })
            setDraft([...draft, { key, labels: { [defaultCode]: label }, values: [{ key: optionKey(firstValue, []), labels: { [defaultCode]: firstValue } }] }])
          }}
        >
          <Plus aria-hidden />
          {draft.length >= MAX_OPTIONS ? t('options.max') : t('options.addOption')}
        </Button>
        <Button disabled={!dirty || pending} onClick={requestApply}>{t('options.apply')}</Button>
      </div>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('options.removeTitle')}
        description={
          <span className="block space-y-2">
            <span className="block">{t('options.removeText')}</span>
            <span className="block font-mono text-xs">{(confirm ?? []).map((v) => v.sku).join(', ')}</span>
          </span>
        }
        confirmLabel={t('options.apply')}
        destructive
        onConfirm={() => void apply()}
      />
    </section>
  )
}
