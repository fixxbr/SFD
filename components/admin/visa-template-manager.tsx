'use client'

import { useEffect, useState } from 'react'

const btn = 'rounded border border-[#D7DEE6] px-3 py-1.5 text-xs hover:bg-[#F3F5F7]'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

type TemplateItem = {
  id: string
  category: string
  documentKey: string
  documentName: string
  instructions: string | null
  defaultRequired: boolean
  sortOrder: number
  isActive: boolean
}

export function VisaTemplateManager() {
  const [visas, setVisas] = useState<Array<{ code: string; name: string }>>([])
  const [code, setCode] = useState('O_1A')
  const [template, setTemplate] = useState<{
    id: string
    templateName: string
    version: number
    items: TemplateItem[]
  } | null>(null)
  const [newVisaCode, setNewVisaCode] = useState('')
  const [newVisaName, setNewVisaName] = useState('')
  const [docName, setDocName] = useState('')
  const [category, setCategory] = useState('Additional Evidence')
  const [instructions, setInstructions] = useState('')
  const [message, setMessage] = useState('')

  async function load(visaCode = code) {
    const res = await fetch(`/api/admin/visa-templates?visaTypeCode=${visaCode}`)
    const json = await res.json()
    if (!res.ok) return
    setVisas(json.visas ?? [])
    setTemplate(json.template)
    setCode(visaCode)
  }

  useEffect(() => {
    void load('O_1A')
  }, [])

  async function createVisa() {
    const res = await fetch('/api/admin/visa-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-visa', code: newVisaCode, name: newVisaName }),
    })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? 'Unable to create visa type')
      return
    }
    setMessage(`Created ${json.visa.code}`)
    setNewVisaCode('')
    setNewVisaName('')
    await load(json.visa.code)
  }

  async function addItem() {
    if (!template || !docName.trim()) return
    const res = await fetch('/api/admin/visa-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add-item',
        templateId: template.id,
        category,
        documentName: docName,
        instructions,
      }),
    })
    if (!res.ok) {
      alert((await res.json()).error ?? 'Unable to add item')
      return
    }
    setDocName('')
    setInstructions('')
    await load(code)
  }

  async function archiveItem(itemId: string) {
    await fetch('/api/admin/visa-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'archive-item', itemId }),
    })
    await load(code)
  }

  async function bump() {
    if (!template) return
    const res = await fetch('/api/admin/visa-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bump-version', templateId: template.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? 'Unable to version')
      return
    }
    setMessage(`Now on version ${json.template.version}`)
    await load(code)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Visa Document Templates</h1>
        <p className="mt-1 text-sm text-[#5B6B7C]">
          Starting checklists only — customize per visa. Historical requests keep their original items when you version a template.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {visas.map((v) => (
          <button key={v.code} type="button" className={code === v.code ? primary : btn} onClick={() => void load(v.code)}>
            {v.name}
          </button>
        ))}
      </div>

      <div className="grid gap-2 rounded-lg border border-[#D7DEE6] bg-white p-4 md:grid-cols-3">
        <input className={input} placeholder="New visa code (e.g. H1B1)" value={newVisaCode} onChange={(e) => setNewVisaCode(e.target.value)} />
        <input className={input} placeholder="Display name" value={newVisaName} onChange={(e) => setNewVisaName(e.target.value)} />
        <button type="button" className={primary} onClick={() => void createVisa()}>
          Create Visa Type
        </button>
      </div>

      {template ? (
        <div className="space-y-3 rounded-lg border border-[#D7DEE6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{template.templateName}</h2>
              <p className="text-xs text-[#5B6B7C]">Version {template.version} · {template.items.length} active items</p>
            </div>
            <button type="button" className={btn} onClick={() => void bump()}>
              Create New Version
            </button>
          </div>
          <ul className="divide-y divide-[#EEF1F4] text-sm">
            {template.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{item.documentName}</p>
                  <p className="text-xs text-[#5B6B7C]">
                    {item.category}
                    {item.defaultRequired ? ' · Required' : ' · Optional'}
                  </p>
                  {item.instructions && <p className="text-xs text-[#5B6B7C]">{item.instructions}</p>}
                </div>
                <button type="button" className={`${btn} text-red-700`} onClick={() => void archiveItem(item.id)}>
                  Archive
                </button>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 border-t border-[#EEF1F4] pt-3 md:grid-cols-4">
            <input className={input} placeholder="Document name" value={docName} onChange={(e) => setDocName(e.target.value)} />
            <input className={input} placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className={input} placeholder="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            <button type="button" className={primary} onClick={() => void addItem()}>
              Add Item
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#5B6B7C]">No active template for this visa. Seed templates or create items after creating the visa type.</p>
      )}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </div>
  )
}
