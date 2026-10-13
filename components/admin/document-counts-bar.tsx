import type { DocumentCounts } from '@/lib/document-counts'

/**
 * The one document-count strip used by Overview, Documents and Request Documents.
 * All three read the same DocumentCounts, so the numbers always match.
 */
export function DocumentCountsBar({
  counts,
  onMissingClick,
}: {
  counts: DocumentCounts
  onMissingClick?: () => void
}) {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="document-counts">
      <Stat label="Required" value={counts.required} />
      <Stat label="Submitted" value={counts.submitted} />
      <div className="flex gap-1">
        <dt className="text-[#64748B]">Missing:</dt>
        <dd>
          {onMissingClick ? (
            <button
              type="button"
              className="font-semibold text-[#0C2340] underline-offset-2 hover:underline"
              onClick={onMissingClick}
            >
              {counts.missing}
            </button>
          ) : (
            <strong>{counts.missing}</strong>
          )}
        </dd>
      </div>
      <Stat label="Under review" value={counts.underReview} />
      <Stat label="Accepted" value={counts.accepted} />
      <Stat label="Needs revision" value={counts.needsRevision} />
      <Stat label="Files" value={counts.files} />
      <Stat label="Links" value={counts.links} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex gap-1">
      <dt className="text-[#64748B]">{label}:</dt>
      <dd>
        <strong className="tabular-nums">{value}</strong>
      </dd>
    </div>
  )
}
