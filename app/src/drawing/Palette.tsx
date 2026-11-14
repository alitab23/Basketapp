import { useTranslation } from 'react-i18next';
import { Hand, MousePointer2, Pencil, Type } from 'lucide-react';
import { TOOL_GROUPS, type Tool } from './interaction';
import { drawLine } from './paths';
import type { LineType } from './elements';

// The icon is drawn in metres with the same shapes as on the court: a 3 m line in a 3.4 m box.
const LINE_ICON_POINTS = [
  { x: 0.25, y: 2.95 },
  { x: 3.05, y: 0.45 },
];

function LineIcon({ type }: { type: LineType }) {
  const d = drawLine(type, LINE_ICON_POINTS, false);
  return (
    <svg viewBox="0 0 3.4 3.4" className="h-5 w-5" aria-hidden="true">
      {d.strokes.map((p, i) => (
        <path key={i} d={p} stroke="currentColor" strokeWidth={0.16} fill="none" strokeDasharray={d.dashed ? '0.3 0.2' : undefined} strokeLinecap="round" />
      ))}
      {d.extras.map((p, i) => (
        <path key={`e${i}`} d={p} stroke="currentColor" strokeWidth={0.18} fill="none" strokeLinecap="round" />
      ))}
      {d.fills.map((p, i) => (
        <path key={`f${i}`} d={p} fill="currentColor" />
      ))}
    </svg>
  );
}

function ToolIcon({ tool }: { tool: Tool }) {
  const box = (children: React.ReactNode) => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      {children}
    </svg>
  );
  switch (tool) {
    case 'select':
      return <MousePointer2 className="h-5 w-5" aria-hidden="true" />;
    case 'pan':
      return <Hand className="h-5 w-5" aria-hidden="true" />;
    case 'text':
      return <Type className="h-5 w-5" aria-hidden="true" />;
    case 'freehand':
      return <Pencil className="h-5 w-5" aria-hidden="true" />;
    case 'offense':
      return box(
        <>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <text x="12" y="12.5" fontSize="10" fontWeight="700" textAnchor="middle" dominantBaseline="central" fill="currentColor">
            O
          </text>
        </>,
      );
    case 'defense':
      return box(<path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />);
    case 'coach':
      return box(
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
          <text x="12" y="12.5" fontSize="11" fontWeight="700" textAnchor="middle" dominantBaseline="central" fill="white">
            C
          </text>
        </>,
      );
    case 'ball':
      return box(<circle cx="12" cy="12" r="5" fill="#F97316" stroke="#7C2D12" strokeWidth="1" />);
    case 'cone':
      return box(<polygon points="12,4 20,20 4,20" fill="#F97316" stroke="#7C2D12" strokeWidth="1" />);
    case 'zoneRect':
      return box(<rect x="4" y="6" width="16" height="12" fill="#F59E0B" fillOpacity="0.3" stroke="#F59E0B" strokeWidth="1.5" />);
    case 'zoneEllipse':
      return box(<ellipse cx="12" cy="12" rx="8" ry="6" fill="#F59E0B" fillOpacity="0.3" stroke="#F59E0B" strokeWidth="1.5" />);
    default:
      return <LineIcon type={tool} />;
  }
}

/** Tool palette on the left of the court (SPEC.md section 5). */
export function Palette({ tool, onTool }: { tool: Tool; onTool: (t: Tool) => void }) {
  const { t } = useTranslation();
  return (
    <div role="toolbar" aria-label={t('drawing.tools')} aria-orientation="vertical" className="flex flex-row flex-wrap gap-1 sm:w-[88px] sm:flex-col">
      {TOOL_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-row flex-wrap gap-1 sm:grid sm:grid-cols-2 sm:border-b sm:border-slate-200 sm:pb-1 dark:sm:border-slate-700">
          {group.map((id) => {
            const label = t(`drawing.tool.${id}`);
            const active = tool === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-label={label}
                title={label}
                data-tool={id}
                onClick={() => onTool(id)}
                className={`flex h-10 w-10 items-center justify-center rounded-md border ${
                  active
                    ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200'
                    : 'border-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <ToolIcon tool={id} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
