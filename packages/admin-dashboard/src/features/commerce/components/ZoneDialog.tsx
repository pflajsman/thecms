import { useTranslation } from 'react-i18next'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/lib/api-error'
import type { ShippingZone } from '../shipping-api'
import { useShippingWrites } from '../shipping-queries'
import { parseCountries } from '../countries'
import { TextField } from './TextField'

interface ZoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  zone?: ShippingZone
}

export function ZoneDialog({ open, onOpenChange, zone }: ZoneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the form starts fresh on every open. */}
      <DialogContent>
        <ZoneForm zone={zone} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ZoneForm({ zone, onDone }: { zone?: ShippingZone; onDone: () => void }) {
  const { t } = useTranslation('shipping')
  const writes = useShippingWrites()
  const [name, setName] = useState(zone?.name ?? '')
  const [countries, setCountries] = useState(zone?.countries.join(', ') ?? '')
  const [rest, setRest] = useState(zone?.rest ?? false)
  const [errors, setErrors] = useState<{ name?: string; countries?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const next: { name?: string; countries?: string } = {}
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 50) next.name = t('zoneDialog.nameRequired')
    const parsed = parseCountries(countries)
    if (!rest && parsed.invalid.length) next.countries = t('zoneDialog.countriesInvalid', { codes: parsed.invalid.join(', ') })
    else if (!rest && parsed.codes.length === 0) next.countries = t('zoneDialog.countriesRequired')
    setErrors(next)
    if (next.name || next.countries) return
    setSaving(true)
    setServerError(null)
    try {
      await writes.saveZone(zone?.id, { name: trimmed, countries: rest ? [] : parsed.codes, rest })
      toast.success(t('zones.saved'))
      onDone()
    } catch (error) {
      setServerError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{zone ? t('zoneDialog.titleEdit') : t('zoneDialog.titleNew')}</DialogTitle>
        <DialogDescription>{t('zones.hint')}</DialogDescription>
      </DialogHeader>
      {serverError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      <TextField id="zone-name" label={t('zoneDialog.name')} value={name} onChange={setName} error={errors.name} />
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Switch id="zone-rest" checked={rest} onCheckedChange={setRest} aria-describedby="zone-rest-hint" />
          <Label htmlFor="zone-rest">{t('zoneDialog.rest')}</Label>
        </div>
        <p id="zone-rest-hint" className="text-xs text-muted-foreground">{t('zoneDialog.restHint')}</p>
      </div>
      {!rest && (
        <TextField id="zone-countries" label={t('zoneDialog.countries')} hint={t('zoneDialog.countriesHint')} value={countries} onChange={setCountries} error={errors.countries} />
      )}
      <DialogFooter>
        <Button type="submit" disabled={saving}>{t('zoneDialog.save')}</Button>
      </DialogFooter>
    </form>
  )
}
