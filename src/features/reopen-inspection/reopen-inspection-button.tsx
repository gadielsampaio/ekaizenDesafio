import { useRef, useState } from 'react'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import type { Inspecao } from '@/shared/domain/inspection'
import { Button } from '@/shared/ui/button'

export function ReopenInspectionButton({ inspection, repository, onReopened }: {
  inspection: Inspecao
  repository: Pick<InspectionRepository, 'reopen'>
  onReopened: (inspection: Inspecao) => void
}) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const processing = useRef(false)
  const completed = useRef(false)

  async function reopen() {
    if (processing.current || completed.current || inspection.status !== 'reprovada') return
    processing.current = true
    setPending(true)
    setFailed(false)
    try {
      const updated = await repository.reopen(inspection.id)
      completed.current = true
      onReopened(updated)
    } catch {
      setFailed(true)
    } finally {
      processing.current = false
      setPending(false)
    }
  }

  if (inspection.status !== 'reprovada') return null
  return <div className="space-y-3" aria-busy={pending}>
    {failed && <p role="alert" className="text-sm text-destructive">Não foi possível reabrir a inspeção. O estado foi mantido. Tente novamente.</p>}
    {pending && <p role="status">Reabrindo inspeção…</p>}
    <Button disabled={pending} onClick={() => { void reopen() }}>{pending ? 'Reabrindo…' : 'Reabrir para correção'}</Button>
  </div>
}
