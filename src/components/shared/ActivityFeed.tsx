import type { LucideIcon } from 'lucide-react';
import { Circle } from 'lucide-react';
import EmptyState from './EmptyState';

// Shared activity-feed row list (Design Spec Phase 2, C1 "Recent activity" /
// C6 "History" — explicitly the same component, not reinvented per screen).
export interface ActivityItem {
  id: string;
  icon?: LucideIcon;
  title: string;
  timestamp: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  emptyTitle?: string;
  emptyDescription: string;
}

export default function ActivityFeed({ items, emptyTitle = 'אין פעילות עדיין', emptyDescription }: ActivityFeedProps) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon ?? Circle;
        return (
          <li key={item.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
            <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <span className="text-sm text-foreground flex-1">{item.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">{item.timestamp}</span>
          </li>
        );
      })}
    </ul>
  );
}
