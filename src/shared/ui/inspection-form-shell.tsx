import type { ReactNode } from 'react'
import { BackToInspections } from '@/shared/ui/back-to-inspections'

export function InspectionFormShell({ title, description, children }: {
  title: string
  description: string
  children: ReactNode
}) {
  return <>
    <BackToInspections />
    <header className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Módulo de inspeções</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
    <div className="w-full">{children}</div>
  </>
}
