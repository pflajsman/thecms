import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/api-error'
import type { ProductType } from '../commerce-api'
import { useCommerceWrites } from '../commerce-queries'

const TYPES: ProductType[] = ['PHYSICAL', 'DIGITAL']

export function NewProductButton() {
  const { t } = useTranslation('commerce')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t('newProduct.button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Content unmounts when closed, so the form resets on every open. */}
        <DialogContent>
          <NewProductForm />
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewProductForm() {
  const { t } = useTranslation('commerce')
  const writes = useCommerceWrites()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState<ProductType>('PHYSICAL')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const nameError = name.trim() === '' || name.trim().length > 200

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setSubmitted(true)
        if (nameError) return
        setPending(true)
        try {
          const detail = await writes.create({ name: name.trim(), type })
          navigate(`/commerce/products/${detail.product.id}`)
        } catch (error) {
          toast.error(apiErrorMessage(error))
          setPending(false)
        }
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('newProduct.title')}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="new-product-name">{t('newProduct.name')}</Label>
        <Input id="new-product-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && nameError ? true : undefined} />
        {submitted && nameError && <p className="text-sm text-destructive">{t('newProduct.nameRequired')}</p>}
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t('products.type')}</legend>
        {TYPES.map((value) => (
          <label key={value} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3', type === value && 'border-foreground')}>
            <input type="radio" name="product-type" value={value} checked={type === value} onChange={() => setType(value)} className="mt-1" />
            <span>
              <span className="block font-medium">{t(`types.${value}`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`types.${value}_hint`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <DialogFooter>
        <Button type="submit" disabled={pending}>{t('newProduct.create')}</Button>
      </DialogFooter>
    </form>
  )
}
