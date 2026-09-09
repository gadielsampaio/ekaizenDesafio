import { Link, Route, Routes } from 'react-router-dom'
import { Button } from '@/shared/ui/button'

export function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 px-6 py-12">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <h1 className="text-3xl font-semibold tracking-tight">Sistema de inspeções</h1>
              <p className="text-muted-foreground">
                Base do projeto configurada. As funcionalidades serão implementadas nas próximas etapas.
              </p>
            </>
          }
        />
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
