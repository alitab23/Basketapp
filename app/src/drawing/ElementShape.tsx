import { memo } from 'react';
import type { CourtElement } from '../types/model';
import { DEFAULT_COLOR } from './elements';
import { basePath, drawLine, SIZE } from './paths';

const SELECT_COLOR = '#F97316';

interface Props {
  element: CourtElement;
  selected?: boolean;
  /** Wider invisible stroke to make lines easy to hit (editor only). */
  interactive?: boolean;
}

function Label({ x, y, text, color, size = SIZE.labelFont }: { x: number; y: number; text: string; color: string; size?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={700} fill={color} textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif">
      {text}
    </text>
  );
}

/** One court element, drawn in metres. Memoised so dragging one object does not redraw the others. */
export const ElementShape = memo(function ElementShape({ element: e, selected = false, interactive = false }: Props) {
  const color = ('color' in e && e.color) || DEFAULT_COLOR[e.type];
  const common = {
    'data-element-id': e.id,
    'data-type': e.type,
    'data-testid': 'court-element',
    'data-selected': selected || undefined,
    style: interactive ? { cursor: 'move' } : undefined,
  } as const;
  const halo = selected ? { filter: `drop-shadow(0 0 0.12px ${SELECT_COLOR})` } : undefined;

  switch (e.type) {
    case 'offense':
    case 'defense':
    case 'coach':
    case 'ball':
    case 'cone': {
      const rot = e.rotation ? `rotate(${e.rotation} ${e.x} ${e.y})` : undefined;
      const R = SIZE.playerRadius;
      return (
        <g {...common} transform={rot} style={{ ...common.style, ...halo }}>
          {selected && <circle cx={e.x} cy={e.y} r={(e.type === 'ball' ? SIZE.ballRadius : R) + 0.15} fill="none" stroke={SELECT_COLOR} strokeWidth={0.06} strokeDasharray="0.15 0.1" />}
          {e.type === 'offense' && (
            <>
              <circle cx={e.x} cy={e.y} r={R} fill="#FFFFFF" stroke={color} strokeWidth={0.09} />
              <Label x={e.x} y={e.y} text={e.label ?? ''} color={color} />
            </>
          )}
          {e.type === 'defense' && (
            <>
              <circle cx={e.x} cy={e.y} r={R} fill="transparent" />
              <path
                d={`M ${e.x - 0.32} ${e.y - 0.32} L ${e.x + 0.32} ${e.y + 0.32} M ${e.x + 0.32} ${e.y - 0.32} L ${e.x - 0.32} ${e.y + 0.32}`}
                stroke={color}
                strokeWidth={0.11}
                strokeLinecap="round"
              />
              <Label x={e.x + 0.45} y={e.y + 0.35} text={e.label ?? ''} color={color} size={0.38} />
            </>
          )}
          {e.type === 'coach' && (
            <>
              <rect x={e.x - SIZE.coachSize / 2} y={e.y - SIZE.coachSize / 2} width={SIZE.coachSize} height={SIZE.coachSize} rx={0.08} fill={color} />
              <Label x={e.x} y={e.y} text={e.label || 'C'} color="#FFFFFF" />
            </>
          )}
          {e.type === 'ball' && <circle cx={e.x} cy={e.y} r={SIZE.ballRadius} fill={color} stroke="#7C2D12" strokeWidth={0.03} />}
          {e.type === 'cone' && (
            <polygon
              points={`${e.x},${e.y - SIZE.coneSize / 2} ${e.x + SIZE.coneSize / 2},${e.y + SIZE.coneSize / 2} ${e.x - SIZE.coneSize / 2},${e.y + SIZE.coneSize / 2}`}
              fill={color}
              stroke="#7C2D12"
              strokeWidth={0.03}
            />
          )}
          {e.rotation ? (
            // Shows which way a rotated symbol faces.
            <line x1={e.x} y1={e.y - SIZE.playerRadius} x2={e.x} y2={e.y - SIZE.playerRadius - 0.2} stroke={color} strokeWidth={0.08} />
          ) : null}
        </g>
      );
    }

    case 'text':
      return (
        <g {...common} style={{ ...common.style, ...halo }}>
          <text
            x={e.x}
            y={e.y}
            fontSize={e.size}
            fill={'color' in e && e.color ? (e.color as string) : DEFAULT_COLOR.text}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="system-ui, sans-serif"
            fontWeight={600}
            paintOrder="stroke"
            stroke="#FFFFFF"
            strokeWidth={e.size * 0.12}
          >
            {e.text}
          </text>
        </g>
      );

    case 'zone': {
      const shared = { fill: color, fillOpacity: 0.25, stroke: color, strokeWidth: 0.05 };
      return (
        <g {...common} style={{ ...common.style, ...halo }}>
          {e.shape === 'rect' ? (
            <rect x={e.x} y={e.y} width={e.w} height={e.h} {...shared} />
          ) : (
            <ellipse cx={e.x + e.w / 2} cy={e.y + e.h / 2} rx={e.w / 2} ry={e.h / 2} {...shared} />
          )}
          {selected && <rect x={e.x} y={e.y} width={e.w} height={e.h} fill="none" stroke={SELECT_COLOR} strokeWidth={0.05} strokeDasharray="0.15 0.1" />}
        </g>
      );
    }

    case 'freehand':
      return (
        <g {...common} style={{ ...common.style, ...halo }}>
          {interactive && <path d={basePath(e.points, false)} stroke="transparent" strokeWidth={SIZE.hitWidth} fill="none" />}
          <path d={basePath(e.points, false)} stroke={selected ? SELECT_COLOR : color} strokeWidth={SIZE.lineWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    default: {
      const d = drawLine(e.type, e.points, e.curved);
      const stroke = selected ? SELECT_COLOR : color;
      return (
        <g {...common}>
          {interactive && <path d={basePath(e.points, e.curved)} stroke="transparent" strokeWidth={SIZE.hitWidth} fill="none" />}
          {d.strokes.map((p, i) => (
            <path
              key={i}
              d={p}
              stroke={stroke}
              strokeWidth={SIZE.lineWidth}
              fill="none"
              strokeDasharray={d.dashed ? '0.3 0.2' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {d.extras.map((p, i) => (
            <path key={`x${i}`} d={p} stroke={stroke} strokeWidth={SIZE.lineWidth * 1.4} fill="none" strokeLinecap="round" />
          ))}
          {d.fills.map((p, i) => (
            <path key={`f${i}`} d={p} fill={stroke} />
          ))}
          {e.order ? (
            <g data-testid="line-order">
              <circle cx={d.labelAt.x} cy={d.labelAt.y} r={SIZE.orderRadius} fill="#FFFFFF" stroke={stroke} strokeWidth={0.04} />
              <Label x={d.labelAt.x} y={d.labelAt.y} text={String(e.order)} color={stroke} size={0.3} />
            </g>
          ) : null}
        </g>
      );
    }
  }
});
