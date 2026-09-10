import { Skeleton } from '@/shared/ui/skeleton'

export function InspectionListSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" role="status" aria-label="Carregando inspeções">
      <span className="sr-only">Carregando inspeções...</span>
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_8rem_10rem] gap-6 border-b bg-neutral-50 px-5 py-3 lg:grid" aria-hidden="true">
        {[48, 32, 20, 24].map((width) => <Skeleton key={width} className="h-3" style={{ width: `${width}%` }} />)}
      </div>
      <div className="divide-y" aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_8rem_10rem] lg:items-center lg:gap-6 lg:px-5 lg:py-5">
            <div className="col-span-2 space-y-2 lg:col-span-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-3/5" /></div>
            <div className="col-span-2 space-y-2 lg:col-span-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28 justify-self-end rounded-full lg:justify-self-start" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function InspectionDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando inspeção">
      <span className="sr-only">Carregando inspeção...</span>
      <header className="space-y-4" aria-hidden="true">
        <div className="flex gap-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-7 w-28 rounded-full" /></div>
        <Skeleton className="h-10 w-2/3 max-w-lg" />
        <div className="flex flex-wrap gap-8"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-28" /></div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start" aria-hidden="true">
        <div className="surface space-y-5"><Skeleton className="h-5 w-24" />{[0, 1, 2].map((row) => <div key={row} className="flex justify-between gap-4 border-b pb-4 last:border-0"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-12" /></div>)}</div>
        <div className="surface space-y-5"><Skeleton className="h-5 w-24" />{[0, 1, 2].map((row) => <div key={row} className="space-y-2 border-l pl-5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>)}</div>
      </div>
    </div>
  )
}
