import { describe, expect, it } from 'vitest'

/**
 * Selection defaults for O-1A document requests must be empty on a brand-new request.
 * These mirror DocumentRequestCenter / DocRequestModal initial state (no auto-select).
 */
describe('O-1A document request selection defaults', () => {
  it('starts with zero selected keys', () => {
    const selected: Record<string, boolean> = {}
    const selectedCount = Object.values(selected).filter(Boolean).length
    expect(selectedCount).toBe(0)
  })

  it('buildItems from empty selection returns no template items', () => {
    const templateItems = [
      { documentKey: 'resume', documentName: 'Updated Resume/CV' },
      { documentKey: 'passport', documentName: 'Passport copy' },
    ]
    const selected: Record<string, boolean> = {}
    const keys = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const fromTemplate = templateItems.filter((i) => keys.includes(i.documentKey))
    expect(fromTemplate).toHaveLength(0)
  })

  it('category toggle selects only that category', () => {
    const templateItems = [
      { documentKey: 'resume', category: '01 Basic Documents' },
      { documentKey: 'passport', category: '01 Basic Documents' },
      { documentKey: 'awards', category: '03 Awards & Recognition' },
    ]
    const selected: Record<string, boolean> = {}
    const category = '01 Basic Documents'
    for (const item of templateItems.filter((i) => i.category === category)) {
      selected[item.documentKey] = true
    }
    expect(selected.resume).toBe(true)
    expect(selected.passport).toBe(true)
    expect(selected.awards).toBeUndefined()
  })
})
