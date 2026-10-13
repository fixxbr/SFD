'use client'

import { useState, type ReactNode } from 'react'

/**
 * Collapsed email template row. The HTML preview iframe is mounted only after the
 * row is opened — rendering all previews up front loaded every email (and its
 * images) on page load.
 */
export function EmailTemplatePreview({
  title,
  summary,
  html,
  children,
}: {
  title: string
  summary: ReactNode
  html: string
  children?: ReactNode
}) {
  const [opened, setOpened] = useState(false)
  return (
    <details
      className="rounded-lg border border-[#D7DEE6] bg-white p-4"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setOpened(true)
      }}
    >
      <summary className="cursor-pointer font-semibold">{summary}</summary>
      {opened ? (
        <>
          {children}
          <iframe title={title} className="mt-3 h-[420px] w-full max-w-[680px] rounded border" srcDoc={html} />
        </>
      ) : null}
    </details>
  )
}
