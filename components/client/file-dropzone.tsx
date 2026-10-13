'use client'

import { useId, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { formatFileSize, MAX_UPLOAD_MB, UPLOAD_ACCEPT, UPLOAD_TYPE_HINT, validateCandidateUploadFile } from '@/lib/upload-validation'

export type PendingFile = {
  id: string
  file: File
  /** Required explanation of what this file is. */
  description: string
  error?: string
}

type DropzoneState = 'empty' | 'selected' | 'uploading' | 'success' | 'error'

export function FileDropzone({
  files,
  onChange,
  disabled,
  state = 'empty',
  statusMessage,
}: {
  files: PendingFile[]
  onChange: (files: PendingFile[]) => void
  disabled?: boolean
  /** Kept for API compatibility — multiple attachments are always enabled. */
  multiple?: boolean
  state?: DropzoneState
  statusMessage?: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    const next: PendingFile[] = [...files]
    for (const file of incoming) {
      const check = validateCandidateUploadFile({
        filename: file.name,
        size: file.size,
        mimeType: file.type,
      })
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        description: '',
        error: check.ok ? undefined : check.error,
      })
    }
    onChange(next)
  }

  function removeFile(id: string) {
    onChange(files.filter((f) => f.id !== id))
  }

  function updateDescription(id: string, description: string) {
    onChange(files.map((item) => (item.id === id ? { ...item, description } : item)))
  }

  const border =
    state === 'error'
      ? 'border-destructive/40 bg-destructive/5'
      : state === 'success'
        ? 'border-accent/40 bg-accent/10'
        : state === 'uploading'
          ? 'border-accent/50 bg-accent/10'
          : dragOver
            ? 'border-accent bg-accent/10'
            : files.length
              ? 'border-foreground/25 bg-card'
              : 'border-foreground/20 bg-card'

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        aria-describedby={`${inputId}-hint`}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (disabled) return
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${border} ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
        onClick={() => {
          if (!disabled) inputRef.current?.click()
        }}
      >
        <Upload className="mx-auto h-5 w-5 text-accent" />
        <p className="mt-2 text-sm font-semibold text-foreground">Upload documents</p>
        <p className="mt-1 text-sm text-muted-foreground">Drag and drop one or more files here</p>
        <p className="mt-1 text-xs text-muted-foreground">or</p>
        <span className="sketch-btn sketch-btn-ink mt-3 px-4 py-2 text-sm">Choose Files</span>
        <p id={`${inputId}-hint`} className="mt-3 text-xs text-muted-foreground">
          {UPLOAD_TYPE_HINT}
          <br />
          Multiple files allowed. Maximum file size: {MAX_UPLOAD_MB} MB
          <br />
          Each file requires its own description.
        </p>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.currentTarget.value = ''
          }}
        />
      </div>

      {statusMessage && (
        <p
          className={`text-sm ${state === 'error' ? 'text-destructive' : state === 'success' ? 'text-accent' : 'text-muted-foreground'}`}
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {files.length === 0 ? 'No files selected' : `Selected files (${files.length})`}
        </p>
        {files.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No documents selected yet</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {files.map((item) => (
              <li
                key={item.id}
                className={`rounded-lg border-2 px-3 py-3 text-sm ${
                  item.error || (!item.description.trim() && !item.error)
                    ? item.error
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-foreground/15 bg-muted/40'
                    : 'border-foreground/10 bg-muted/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 break-words">
                    <p className="font-medium text-foreground">
                      {item.error ? '!' : '✓'} {item.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</p>
                    {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                  </div>
                  <button
                    type="button"
                    className="sketch-btn sketch-btn-paper px-2 py-1 text-xs disabled:opacity-50"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(item.id)
                    }}
                  >
                    Remove
                  </button>
                </div>
                <label className="mt-3 block text-xs font-semibold text-foreground">
                  Description <span className="text-destructive">*</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border-2 border-foreground/15 bg-card px-3 py-2 text-sm font-normal"
                    rows={2}
                    required
                    disabled={disabled}
                    placeholder="What is this document? (required)"
                    value={item.description}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateDescription(item.id, e.target.value)}
                  />
                </label>
                {!item.error && !item.description.trim() ? (
                  <p className="mt-1 text-xs text-destructive">Required — describe what this file is.</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
