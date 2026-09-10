import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/shared/ui/button'

export function BackToInspections() {
  const { search } = useLocation()
  return (
    <Button asChild variant="ghost" className="self-start px-0">
      <Link to={`/${search}`}><span aria-hidden="true">←</span>Voltar para inspeções</Link>
    </Button>
  )
}
