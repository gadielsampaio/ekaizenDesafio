import { useState, useSyncExternalStore } from 'react'
import { DataControls } from '@/features/recover-data/data-controls'
import type { createOperationSimulation } from '@/shared/storage/operation-simulation'
import { Route, Routes, useLocation } from 'react-router-dom'
import { BackToInspections } from '@/shared/ui/back-to-inspections'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import { CreateInspectionPage } from '@/features/create-inspection/create-inspection-page'
import { InspectionPlaceholder } from './inspection-placeholder'
import { ListInspectionsPage } from '@/features/list-inspections/list-inspections-page'
import { EditInspectionPage } from '@/features/edit-inspection/edit-inspection-page'

const subscribeIdle = () => () => {}
const isIdle = () => false

export function App({ repository, dataControls }: {
  repository: InspectionRepository
  dataControls?: { simulation: ReturnType<typeof createOperationSimulation>; reset: () => Promise<void> }
}) {
  const resetting = useSyncExternalStore(dataControls?.simulation.subscribe ?? subscribeIdle, dataControls ? () => dataControls.simulation.getSnapshot().resetting : isIdle)
  const location = useLocation()
  const [revision, setRevision] = useState(0)
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <fieldset disabled={resetting} inert={resetting} className="contents" aria-label="Inspeções">
      <Routes key={revision}>
        <Route
          path="/"
          element={<ListInspectionsPage repository={repository} />}
        />
        <Route path="/inspecoes/nova" element={<CreateInspectionPage repository={repository} />} />
        <Route path="/inspecoes/:id/editar" element={<EditInspectionPage key={location.pathname} repository={repository} />} />
        <Route path="/inspecoes/:id" element={<InspectionPlaceholder key={location.pathname} repository={repository} />} />
        <Route
          path="*"
          element={
            <>
              <BackToInspections />
              <h1 className="text-2xl font-semibold">Página não encontrada</h1>
            </>
          }
        />
      </Routes>
      </fieldset>
      {dataControls && <div className="mt-8"><DataControls {...dataControls} onRecovered={() => setRevision((value) => value + 1)} /></div>}
    </main>
  )
}
