import { O1_CATEGORIES, questionByKey } from '@/lib/onboarding-catalog'
import { randomToken } from '@/lib/crypto'

export type RequestedDocItem = {
  key: string
  label: string
  category: string
  instructions?: string | null
  source: 'catalog' | 'custom' | 'link' | 'template'
  inputKind?: 'file' | 'url' | 'urls'
  requestStatus?: string | null
}

/** All catalog file upload slots for checkbox UI. */
export function catalogFileOptions(): RequestedDocItem[] {
  const items: RequestedDocItem[] = []
  for (const cat of O1_CATEGORIES) {
    for (const q of cat.questions) {
      if (q.type !== 'file') continue
      items.push({
        key: q.key,
        label: q.label,
        category: cat.id,
        instructions: q.help ?? null,
        source: 'catalog',
      })
    }
  }
  return items
}

export function resolveRequestedItems(input: {
  requestType: 'FULL' | 'CUSTOM' | 'SINGLE'
  selectedKeys?: string[]
  customItems?: Array<{ label: string; instructions?: string; category?: string }>
  single?: { name: string; note?: string; category?: string }
}): RequestedDocItem[] {
  if (input.requestType === 'FULL') {
    return catalogFileOptions()
  }

  if (input.requestType === 'SINGLE') {
    const name = input.single?.name?.trim()
    if (!name) return []
    const key = `custom_${slugKey(name)}_${randomToken(4)}`
    return [
      {
        key,
        label: name,
        category: input.single?.category || 'additional',
        instructions: input.single?.note ?? null,
        source: 'custom',
      },
    ]
  }

  const items: RequestedDocItem[] = []
  for (const key of input.selectedKeys ?? []) {
    const mapped = questionByKey(key)
    if (mapped?.question.type === 'file') {
      items.push({
        key,
        label: mapped.question.label,
        category: mapped.category.id,
        instructions: mapped.question.help ?? null,
        source: 'catalog',
      })
    }
  }
  for (const custom of input.customItems ?? []) {
    const label = custom.label.trim()
    if (!label) continue
    items.push({
      key: `custom_${slugKey(label)}_${randomToken(4)}`,
      label,
      category: custom.category || 'additional',
      instructions: custom.instructions?.trim() || null,
      source: 'custom',
    })
  }
  return items
}

function slugKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'doc'
}

export function groupItemsForPortal(items: RequestedDocItem[]) {
  const byCat = new Map<string, { id: string; title: string; questions: RequestedDocItem[] }>()
  for (const item of items) {
    const catMeta = O1_CATEGORIES.find((c) => c.id === item.category)
    const id = item.category || 'additional'
    const title = catMeta?.title ?? (id === 'additional' ? 'Additional Evidence' : id.replaceAll('_', ' '))
    if (!byCat.has(id)) byCat.set(id, { id, title, questions: [] })
    byCat.get(id)!.questions.push(item)
  }
  return [...byCat.values()]
}
