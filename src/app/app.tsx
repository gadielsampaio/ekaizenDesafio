import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import type { InspectionRepository } from '@/shared/contracts/inspection-repository'
import { CreateInspectionPage } from '@/features/create-inspection/create-inspection-page'
import { InspectionPlaceholder } from './inspection-placeholder'
import { ListInspectionsPage } from '@/features/list-inspections/list-inspections-page'
import { EditInspectionPage } from '@/features/edit-inspection/edit-inspection-page'

export function App({ repository }: {
  repository: InspectionRepository
}) {
  const location = useLocation()
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 px-6 py-12">
      <Routes>
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
              <h1 className="text-2xl font-semibold">Página não encontrada</h1>
              <Button asChild className="self-start">
                <Link to="/">Voltar ao início</Link>
              </Button>
            </>
          }
        />
      </Routes>
    </main>
  )
}
