'use client'

import { secondaryDocumentName, visibleDocumentName } from '@/lib/documents-checklist'

export function DocumentFileName({
  displayName,
  originalFilename,
  className = '',
}: {
  displayName?: string | null
  originalFilename?: string | null
  className?: string
}) {
  const primary = visibleDocumentName({ displayName: displayName ?? null, originalFilename: originalFilename ?? '' })
  const secondary = secondaryDocumentName({ displayName: displayName ?? null, originalFilename: originalFilename ?? '' })

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <p className="break-words font-medium text-[#0C2340]">{primary}</p>
      {secondary ? <p className="break-words text-[11px] text-[#94A3B8]">{secondary}</p> : null}
    </div>
  )
}
