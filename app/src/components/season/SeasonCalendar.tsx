import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Session } from '../../types/model';
import { formatMonth, monthGrid, shiftMonth, todayISO, weekdayNames, type Month } from '../../lib/dates';
import { calculateSchedule } from '../../lib/schedule';
import { ui } from '../ui';

interface Props {
  sessions: Session[];
  initialMonth: Month;
  /** Called when a session is dropped on another day. */
  onMove: (sessionId: string, date: string) => void;
}

/** Month calendar; sessions can be dragged between dates (SPEC.md section 8). */
export function SeasonCalendar({ sessions, initialMonth, onMove }: Props) {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(initialMonth);
  const [activeId, setActiveId] = useState<string | null>(null);
  const days = monthGrid(month);
  const today = todayISO();
  const byDate = new Map<string, Session[]>();
  for (const s of sessions) if (s.date) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const date = e.over ? String(e.over.id).replace(/^day:/, '') : null;
    const session = sessions.find((s) => s.id === e.active.id);
    if (date && session && session.date !== date) onMove(session.id, date);
  };

  const active = sessions.find((s) => s.id === activeId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" className={ui.icon} onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label={t('season.previousMonth')}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3 data-testid="calendar-month" className="min-w-40 text-center font-semibold capitalize">
          {formatMonth(month, i18n.language)}
        </h3>
        <button type="button" className={ui.icon} onClick={() => setMonth((m) => shiftMonth(m, 1))} aria-label={t('season.nextMonth')}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-xs dark:border-slate-700 dark:bg-slate-700">
          {weekdayNames(i18n.language).map((d) => (
            <div key={d} className="bg-slate-50 px-1.5 py-1 font-medium capitalize text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              {d}
            </div>
          ))}
          {days.map((date) => (
            <DayCell
              key={date}
              date={date}
              inMonth={Number(date.slice(5, 7)) - 1 === month.month}
              isToday={date === today}
              sessions={byDate.get(date) ?? []}
            />
          ))}
        </div>
        <DragOverlay>{active ? <Chip session={active} dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function DayCell({ date, inMonth, isToday, sessions }: { date: string; inMonth: boolean; isToday: boolean; sessions: Session[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  return (
    <div
      ref={setNodeRef}
      data-testid={`day-${date}`}
      className={`min-h-20 space-y-1 p-1 ${inMonth ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 text-slate-400 dark:bg-slate-900'} ${
        isOver ? 'outline-2 -outline-offset-2 outline-orange-500' : ''
      }`}
    >
      <div className={`text-right ${isToday ? 'font-bold text-orange-600' : ''}`}>{Number(date.slice(8))}</div>
      {sessions.map((s) => (
        <DraggableChip key={s.id} session={s} />
      ))}
    </div>
  );
}

function DraggableChip({ session }: { session: Session }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: session.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`touch-none ${isDragging ? 'opacity-30' : ''}`}>
      <Chip session={session} />
    </div>
  );
}

function Chip({ session, dragging = false }: { session: Session; dragging?: boolean }) {
  const end = calculateSchedule(session.startTime, session.items).endLabel;
  const className = `block truncate rounded bg-orange-100 px-1 py-0.5 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100 ${
    dragging ? 'shadow-lg' : 'hover:bg-orange-200'
  }`;
  const text = `${session.startTime}–${end} ${session.title}`;
  return dragging ? (
    <span className={className}>{text}</span>
  ) : (
    <Link to={`/pass/${session.id}`} className={className} data-testid="calendar-session" title={text}>
      {text}
    </Link>
  );
}
