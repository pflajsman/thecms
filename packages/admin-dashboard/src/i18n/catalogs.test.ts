import { NAMESPACES, resources } from './resources'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`)))
}

const PLURAL = /_(zero|one|two|few|many|other)$/

function split(keys: string[]) {
  const plain = new Set<string>()
  const plural = new Map<string, Set<string>>()
  for (const key of keys) {
    const m = key.match(PLURAL)
    if (!m) plain.add(key)
    else {
      const base = key.slice(0, -m[0].length)
      plural.set(base, (plural.get(base) ?? new Set()).add(m[1]))
    }
  }
  return { plain, plural }
}

describe.each(NAMESPACES)('%s catalog', (ns) => {
  const en = split(flatten(resources.en[ns] as Tree))
  const cs = split(flatten(resources.cs[ns] as Tree))

  it('has the same plain keys in Czech and English', () => {
    expect([...cs.plain].sort()).toEqual([...en.plain].sort())
  })

  it('has the same plural keys, with one/other in English and one/few/other in Czech', () => {
    expect([...cs.plural.keys()].sort()).toEqual([...en.plural.keys()].sort())
    for (const [base, forms] of en.plural) {
      expect({ base, forms: [...forms].sort() }).toEqual({ base, forms: ['one', 'other'] })
      const csForms = [...(cs.plural.get(base) ?? [])].filter((f) => f !== 'many').sort()
      expect({ base, forms: csForms }).toEqual({ base, forms: ['few', 'one', 'other'] })
    }
  })

  it('has no empty strings', () => {
    const values = [resources.en[ns], resources.cs[ns]].flatMap((t) => JSON.stringify(t).match(/":""/g) ?? [])
    expect(values).toEqual([])
  })
})
