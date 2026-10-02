import { createContext, type ReactNode } from 'react'

/** Extra controls shown in a field's label row (the AI menu), provided by a wrapper around the field. */
export const FieldAddonContext = createContext<ReactNode>(null)
