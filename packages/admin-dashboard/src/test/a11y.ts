import axe from 'axe-core'

/** Runs axe on a rendered container. Color contrast is covered by styles/contrast.test.ts (jsdom has no layout). */
export async function expectNoA11yViolations(container: Element) {
  const result = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.html.slice(0, 120)}`).join(', ')}`)
  expect(summary).toEqual([])
}
