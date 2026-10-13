'use client'

import { useState } from 'react'
import { SystemBackupRestoreModal } from '@/components/admin/system-backup-restore-modal'
import { admin } from '@/lib/admin/ui'

export function CandidatesBackupActions() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={admin.btnSecondary} onClick={() => setOpen(true)}>
        Backup / Restore
      </button>
      <SystemBackupRestoreModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
