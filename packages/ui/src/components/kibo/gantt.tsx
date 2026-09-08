// Kibo UI Gantt wrapper (DESIGN §4 — Gantt themed to Orqafy tokens).
// STUB: typed props + a themed skeleton. TODO(part-5): drop in the Kibo UI
// gantt registry component (MIT) and bind to milestone/task schedules.
import { cn } from '../../lib/utils';

export interface GanttTask {
  id: string;
  name: string;
  /** ISO date or epoch ms — normalised by the app before render. */
  start: number;
  end: number;
  progress?: number;
}

export interface GanttChartProps {
  tasks: GanttTask[];
  className?: string;
}

export function GanttChart({ tasks, className }: GanttChartProps) {
  return (
    <div data-slot="gantt-chart" className={cn('flex flex-col gap-1', className)}>
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 truncate text-muted-foreground">{task.name}</span>
          <div className="relative h-4 flex-1 rounded bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded bg-primary"
              style={{ width: `${Math.round((task.progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
