import type { LucideIcon } from 'lucide-react';

interface PlaceholderTabProps {
  icon?: LucideIcon;
  title: string;
  description: string;
}

export default function PlaceholderTab({ icon: Icon, title, description }: PlaceholderTabProps) {
  return (
    <div className="bg-card rounded-2xl p-10 border border-dashed border-border flex flex-col items-center text-center gap-3" dir="rtl">
      {Icon && <Icon className="w-8 h-8 text-muted-foreground" />}
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}
