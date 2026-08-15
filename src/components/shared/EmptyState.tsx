import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// House "coming soon / no data" pattern — replaces PlaceholderTab everywhere.
// Per the design spec (Phase 2, A7): composable icon/title/description slots,
// optional action, icon is decorative (aria-hidden) since title+description
// already carry the real semantic content for screen readers.
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="bg-card rounded-xl p-10 border border-dashed border-border flex flex-col items-center text-center gap-3"
      dir="rtl"
    >
      {Icon && <Icon className="w-8 h-8 text-muted-foreground" aria-hidden="true" />}
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
