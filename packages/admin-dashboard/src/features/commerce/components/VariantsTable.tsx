import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/api-error'
import type { ProductOption, ProductType, ShopCurrency, Variant, VariantRow } from '../commerce-api'
import { useCommerceWrites } from '../commerce-queries'
import { fromMinor, toMinor } from '../money'

interface Row {
  id: string
  sku: string
  optionValues: Record<string, string>
  prices: Record<string, string>
  weight: string
  tracked: boolean
  quantity: string
  active: boolean
}

interface VariantsTableProps {
  productId: string
  productName: string
  type: ProductType
  options: ProductOption[]
  variants: Variant[]
  currencies: ShopCurrency[]
  defaultLanguage: string
  onDirty: (dirty: boolean) => void
}

const WHOLE = /^\d+$/

export function VariantsTable({ productId, productName, type, options, variants, currencies, defaultLanguage, onDirty }: VariantsTableProps) {
  const { t, i18n } = useTranslation('commerce')
  const language = i18n.language
  const writes = useCommerceWrites()
  const physical = type === 'PHYSICAL'
  const initial = useMemo(
    () =>
      variants.map<Row>((v) => ({
        id: v.id,
        sku: v.sku,
        optionValues: v.optionValues,
        prices: Object.fromEntries(currencies.map((c) => [c.code, typeof v.prices[c.code] === 'number' ? fromMinor(v.prices[c.code], c.decimals, language) : ''])),
        weight: String(v.weightGrams ?? 0),
        tracked: v.stock.tracked,
        quantity: String(v.stock.quantity),
        active: v.active,
      })),
    [variants, currencies, language],
  )
  const [rows, setRows] = useState<Row[]>(initial)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => setRows(initial), [initial])
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial)
  useEffect(() => onDirty(dirty), [dirty, onDirty])

  const variantName = (row: Row) => {
    const parts = options.map((o) => {
      const value = o.values.find((v) => v.key === row.optionValues[o.key])
      return value?.labels[defaultLanguage] ?? Object.values(value?.labels ?? {})[0] ?? row.optionValues[o.key]
    })
    return parts.length ? parts.join(' / ') : productName
  }
  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const setAll = (code: string) => {
    const value = rows.find((r) => r.prices[code]?.trim())?.prices[code] ?? ''
    setRows(rows.map((r) => ({ ...r, prices: { ...r.prices, [code]: value } })))
  }

  const save = async () => {
    const bad = new Set<string>()
    const payload: VariantRow[] = rows.map((r, i) => {
      const prices: Record<string, number> = {}
      for (const c of currencies) {
        const text = r.prices[c.code]?.trim() ?? ''
        if (!text) continue
        const minor = toMinor(text, c.decimals, language)
        if (minor === null) bad.add(`${i}:price:${c.code}`)
        else prices[c.code] = minor
      }
      if (physical && !WHOLE.test(r.weight.trim())) bad.add(`${i}:weight`)
      if (physical && !WHOLE.test(r.quantity.trim())) bad.add(`${i}:quantity`)
      return {
        id: r.id,
        sku: r.sku.trim(),
        optionValues: r.optionValues,
        prices,
        weightGrams: physical ? Number(r.weight) : 0,
        stock: { tracked: physical && r.tracked, quantity: physical ? Number(r.quantity) : 0 },
        active: r.active,
      }
    })
    setInvalid(bad)
    if (bad.size) {
      const priceBad = [...bad].some((k) => k.includes(':price:'))
      setMessage(priceBad ? t('variants.priceInvalid', { example: fromMinor(49000, 2, language) }) : t('variants.numberInvalid'))
      return
    }
    setPending(true)
    setMessage(null)
    try {
      await writes.saveVariants(productId, payload)
      toast.success(t('variants.saved'))
    } catch (error) {
      const text = apiErrorMessage(error)
      setMessage(text)
      // Mark rows whose SKU the server named.
      setInvalid(new Set(rows.flatMap((r, i) => (r.sku.trim() && text.includes(r.sku.trim()) ? [`${i}:sku`] : []))))
    } finally {
      setPending(false)
    }
  }

  const cellInvalid = (key: string) => (invalid.has(key) ? true : undefined)

  return (
    <section aria-labelledby="variants-title" className="space-y-3">
      <h2 id="variants-title" className="font-serif text-xl font-semibold">{t('variants.title')}</h2>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table aria-label={t('variants.title')} className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">{t('variants.variant')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('variants.sku')}</th>
              {currencies.map((c) => (
                <th key={c.code} scope="col" className="px-3 py-2 font-medium">
                  <span className="block">{t('variants.price', { currency: c.code })}</span>
                  <button type="button" className="text-xs underline" onClick={() => setAll(c.code)}>{t('variants.setAll', { currency: c.code })}</button>
                </th>
              ))}
              {physical && <th scope="col" className="px-3 py-2 font-medium">{t('variants.weight')}</th>}
              {physical && <th scope="col" className="px-3 py-2 font-medium">{t('variants.stock')}</th>}
              <th scope="col" className="px-3 py-2 font-medium">{t('variants.active')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const name = variantName(row)
              return (
                <tr key={row.id} className="border-b last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-medium">{name}</th>
                  <td className="px-3 py-2">
                    <Input aria-label={t('variants.skuLabel', { variant: name })} value={row.sku} onChange={(e) => setRow(i, { sku: e.target.value })} className={cn('w-36 font-mono')} aria-invalid={cellInvalid(`${i}:sku`)} />
                  </td>
                  {currencies.map((c) => (
                    <td key={c.code} className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        aria-label={t('variants.priceLabel', { currency: c.code, variant: name })}
                        value={row.prices[c.code] ?? ''}
                        onChange={(e) => setRow(i, { prices: { ...row.prices, [c.code]: e.target.value } })}
                        className="w-28"
                        aria-invalid={cellInvalid(`${i}:price:${c.code}`)}
                      />
                    </td>
                  ))}
                  {physical && (
                    <td className="px-3 py-2">
                      <Input inputMode="numeric" aria-label={t('variants.weightLabel', { variant: name })} value={row.weight} onChange={(e) => setRow(i, { weight: e.target.value })} className="w-20" aria-invalid={cellInvalid(`${i}:weight`)} />
                    </td>
                  )}
                  {physical && (
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" aria-label={t('variants.tracked', { variant: name })} checked={row.tracked} onChange={(e) => setRow(i, { tracked: e.target.checked })} />
                        <Input inputMode="numeric" aria-label={t('variants.quantityLabel', { variant: name })} value={row.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} disabled={!row.tracked} className="w-20" aria-invalid={cellInvalid(`${i}:quantity`)} />
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={t('variants.activeLabel', { variant: name })} checked={row.active} onChange={(e) => setRow(i, { active: e.target.checked })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button onClick={() => void save()} disabled={pending}>{t('variants.save')}</Button>
    </section>
  )
}
