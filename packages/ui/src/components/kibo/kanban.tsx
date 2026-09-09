'use client';

// Kibo UI Kanban wrapper (DESIGN §4 — Kibo board themed to Orqafy tokens).
// Real drag-and-drop board built on @dnd-kit/core (MIT). Columns are droppable
// zones (id = column.id = TaskStatus); cards are draggable (id = card.id). On a
// cross-column drop, `onCardMove(cardId, toColumnId)` fires — the consumer maps
// toColumnId directly to a TaskStatus (no mapping needed) and mutates tasks.move.
// INHERIT-not-REPLACE over the prior themed skeleton: same column/card look, plus
// a subtle drag/over affordance only. No AdminCN / paid-slice code (D-26).
import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
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
  /** Fired when a card is dragged onto a different column (id === TaskStatus). */
  onCardMove?: (cardId: string, toColumnId: string) => void;
  className?: string;
}

function KanbanCardItem({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const style =
    transform === null
      ? undefined
      : { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-slot="kanban-card"
      className={cn(
        'cursor-grab touch-none rounded-md border bg-card p-3 text-sm shadow-sm',
        'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'cursor-grabbing opacity-50 shadow-lg',
      )}
      {...listeners}
      {...attributes}
    >
      <p className="font-medium">{card.title}</p>
      {card.meta === undefined ? null : (
        <p className="mt-1 text-xs text-muted-foreground">{card.meta}</p>
      )}
    </div>
  );
}

function KanbanColumnZone({
  column,
  isActiveDrag,
}: {
  column: KanbanColumn;
  isActiveDrag: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      data-slot="kanban-column"
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3 transition-colors',
        // Subtle over-affordance while a card hovers this column mid-drag.
        isActiveDrag && 'border-dashed',
        isOver && 'border-primary bg-primary/5 ring-1 ring-primary/40',
      )}
    >
      <div className="flex items-center justify-between text-sm font-medium">
        <span>{column.title}</span>
        <span className="text-xs text-muted-foreground">{column.cards.length}</span>
      </div>
      {column.cards.map((card) => (
        <KanbanCardItem key={card.id} card={card} />
      ))}
    </div>
  );
}

export function KanbanBoard({ columns, onCardMove, className }: KanbanBoardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sensors = useSensors(
    // Small activation distance so a plain click/tap on a card is not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function columnIdOfCard(cardId: string): string | undefined {
    return columns.find((col) => col.cards.some((card) => card.id === cardId))?.id;
  }

  function handleDragStart() {
    setIsDragging(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    const { active, over } = event;
    if (over === null) return;
    const cardId = String(active.id);
    const toColumnId = String(over.id);
    if (columnIdOfCard(cardId) === toColumnId) return;
    onCardMove?.(cardId, toColumnId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setIsDragging(false)}
    >
      <div data-slot="kanban-board" className={cn('flex gap-4 overflow-x-auto pb-2', className)}>
        {columns.map((column) => (
          <KanbanColumnZone key={column.id} column={column} isActiveDrag={isDragging} />
        ))}
      </div>
    </DndContext>
  );
}
