import type { FieldControlProps } from './field-aria'
import { BooleanField, NumberField, TextField } from './BasicFields'
import { DateField } from './DateField'
import { RelationField } from './RelationField'
import { MediaField, RichTextField } from './LegacyFields'

export function FieldControl(props: FieldControlProps) {
  switch (props.field.type) {
    case 'TEXT':
      return <TextField {...props} />
    case 'RICH_TEXT':
      return <RichTextField {...props} />
    case 'NUMBER':
      return <NumberField {...props} />
    case 'DATE':
      return <DateField {...props} />
    case 'BOOLEAN':
      return <BooleanField {...props} />
    case 'MEDIA':
      return <MediaField {...props} />
    case 'RELATION':
      return <RelationField {...props} />
    default:
      return null
  }
}
