// Kibo UI Kanban wrapper (DESIGN §4 — Kibo board themed to Orqafy tokens).
// STUB: typed props + a themed skeleton render. TODO(part-5): drop in the Kibo
// UI kanban registry component (MIT, `npx shadcn add @kibo-ui/kanban`) and wire
// drag-drop to the Task board mutations. No AdminCN / paid-slice code (D-26).
import { cn } from '../../lib/utils';

export interface KanbanCard {
  id: string;
  title: string;
  meta?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  /** Fired when a card is dragged to another column (wired in Part 5). */
  onCardMove?: (cardId: string, toColumnId: string) => void;
  className?: string;
}

export function KanbanBoard({ columns, className }: KanbanBoardProps) {
  return (
    <div data-slot="kanban-board" className={cn('flex gap-4 overflow-x-auto pb-2', className)}>
      {columns.map((column) => (
        <div
          key={column.id}
          data-slot="kanban-column"
          className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3"
        >
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{column.title}</span>
            <span className="text-xs text-muted-foreground">{column.cards.length}</span>
          </div>
          {column.cards.map((card) => (
            <div
              key={card.id}
              data-slot="kanban-card"
              className="rounded-md border bg-card p-3 text-sm shadow-sm"
            >
              <p className="font-medium">{card.title}</p>
              {card.meta === undefined ? null : (
                <p className="mt-1 text-xs text-muted-foreground">{card.meta}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
