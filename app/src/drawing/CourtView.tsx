import type { Diagram } from '../types/model';
import { viewBounds, viewBoxString } from './court';
import { CourtBackground } from './CourtBackground';
import { ElementShape } from './ElementShape';
import { useCourtStyle } from './courtStyle';

/** A read-only drawing: thumbnails, the large viewer and (later) print. */
export function CourtView({ diagram, className, label }: { diagram: Diagram; className?: string; label?: string }) {
  const [style] = useCourtStyle();
  return (
    <svg
      viewBox={viewBoxString(viewBounds(diagram.court))}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="court-view"
    >
      <CourtBackground court={diagram.court} style={style} />
      {diagram.elements.map((e) => (
        <ElementShape key={e.id} element={e} />
      ))}
    </svg>
  );
}
