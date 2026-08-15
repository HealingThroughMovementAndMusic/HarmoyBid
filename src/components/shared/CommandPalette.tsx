import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { NavOption } from '@/components/ui/dashboard-layout';

// Global ⌘K command palette (Design Spec Phase 2, A7/B) — official shadcn
// Command primitive, unstyled/composable, the lowest-RTL-risk pick in the
// whole research pass since there's nothing pre-hardcoded to fight.
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: NavOption[];
  onSelect: (title: string) => void;
}

export default function CommandPalette({ open, onOpenChange, navItems, onSelect }: CommandPaletteProps) {
  const groups = new Map<string, NavOption[]>();
  for (const item of navItems) {
    const key = item.group ?? 'ניווט';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command dir="rtl">
        <CommandInput placeholder="חיפוש מהיר... (מסך, פעולה)" />
        <CommandList>
          <CommandEmpty>לא נמצאו תוצאות.</CommandEmpty>
          {[...groups.entries()].map(([groupName, items]) => (
            <CommandGroup key={groupName} heading={groupName}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.title}
                    value={item.title}
                    onSelect={() => {
                      onSelect(item.title);
                      onOpenChange(false);
                    }}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.title}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
