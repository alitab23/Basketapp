import { memo } from 'react';
import type { Diagram, Point } from '../types/model';
import { COURT, courtBounds, halfCourtShapes, viewBounds } from './court';
import { COURT_COLORS, type CourtStyle } from './courtStyle';

const pts = (p: readonly Point[]) => p.map((q) => `${q.x},${q.y}`).join(' ');

function Half({ side, line, paint }: { side: 1 | -1; line: string; paint: string }) {
  const s = halfCourtShapes(side);
  const w = COURT.lineWidth;
  return (
    <g fill="none" stroke={line} strokeWidth={w}>
      <polygon points={pts(s.paint)} fill={paint} />
      <polyline points={pts(s.threePoint)} />
      <polyline points={pts(s.freeThrowSolid)} />
      <polyline points={pts(s.freeThrowDashed)} strokeDasharray="0.3 0.25" />
      <polyline points={pts(s.noCharge)} />
      <line x1={s.backboard[0].x} y1={s.backboard[0].y} x2={s.backboard[1].x} y2={s.backboard[1].y} strokeWidth={w * 2} />
      <circle cx={s.rim.centre.x} cy={s.rim.centre.y} r={s.rim.radius} stroke="#EA580C" strokeWidth={w * 1.2} />
    </g>
  );
}

/** The court drawn to FIBA measures, plus an optional 0.5 m grid. */
export const CourtBackground = memo(function CourtBackground({
  court,
  style,
  grid = false,
}: {
  court: Diagram['court'];
  style: CourtStyle;
  grid?: boolean;
}) {
  const c = COURT_COLORS[style];
  const b = courtBounds(court);
  const v = viewBounds(court);
  const W = COURT.halfWidth;
  return (
    <g data-testid="court" pointerEvents="none">
      <rect x={v.minX} y={v.minY} width={v.width} height={v.height} fill={c.outside} />
      <rect x={b.minX} y={b.minY} width={b.width} height={b.height} fill={c.floor} />
      {grid && (
        <g stroke={c.line} strokeOpacity={0.25} strokeWidth={0.015}>
          {Array.from({ length: Math.round(b.width / 0.5) - 1 }, (_, i) => b.minX + (i + 1) * 0.5).map((x) => (
            <line key={`x${x}`} x1={x} y1={b.minY} x2={x} y2={b.minY + b.height} />
          ))}
          {Array.from({ length: Math.round(b.height / 0.5) - 1 }, (_, i) => b.minY + (i + 1) * 0.5).map((y) => (
            <line key={`y${y}`} x1={b.minX} y1={y} x2={b.minX + b.width} y2={y} />
          ))}
        </g>
      )}
      <Half side={1} line={c.line} paint={c.paint} />
      {court === 'full' && <Half side={-1} line={c.line} paint={c.paint} />}
      <g fill="none" stroke={c.line} strokeWidth={COURT.lineWidth}>
        <rect x={b.minX} y={b.minY} width={b.width} height={b.height} />
        <line x1={0} y1={-W} x2={0} y2={W} />
        {court === 'full' ? (
          <circle cx={0} cy={0} r={COURT.centreCircleRadius} />
        ) : (
          <path d={`M 0 ${-COURT.centreCircleRadius} A ${COURT.centreCircleRadius} ${COURT.centreCircleRadius} 0 0 1 0 ${COURT.centreCircleRadius}`} />
        )}
      </g>
    </g>
  );
});
