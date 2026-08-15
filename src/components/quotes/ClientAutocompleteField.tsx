import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { ClientDirectoryEntry } from '@/lib/quotes/clientDirectory';

const DEBOUNCE_MS = 150;
const MAX_MATCHES = 8;

interface ClientAutocompleteFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSelectClient: (entry: ClientDirectoryEntry) => void;
  clients: ClientDirectoryEntry[];
  /** Which of the entry's fields this particular input filters against —
   *  the name field filters/matches on name, the phone field on phone,
   *  etc., but selecting from any of them fills all three (per spec). */
  matchField: keyof ClientDirectoryEntry;
  type?: string;
  className?: string;
}

// Combobox built from the existing Popover+Command primitives (same ones
// backing the ⌘K command palette) rather than a new dependency — matches
// the project's RTL/dark-theme styling automatically since both already
// support it. Filtering is debounced client-side only; the client
// directory itself is fetched once (react-query cached) and re-filtered
// in-memory per keystroke, so there's no network round-trip to debounce —
// the debounce exists to keep the dropdown from flickering open/closed
// against fast typing, per the explicit request.
export function ClientAutocompleteField({
  value,
  onChange,
  onSelectClient,
  clients,
  matchField,
  type,
  className,
}: ClientAutocompleteFieldProps) {
  const [open, setOpen] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const matches = useMemo(() => {
    const query = debouncedValue.trim().toLowerCase();
    if (!query) return [];
    return clients.filter((entry) => entry[matchField].toLowerCase().includes(query)).slice(0, MAX_MATCHES);
  }, [clients, debouncedValue, matchField]);

  const showDropdown = open && matches.length > 0;

  return (
    <Popover open={showDropdown} onOpenChange={(next) => setOpen(next)}>
      <PopoverAnchor asChild>
        <Input
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={cn('bg-secondary border-border', className)}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <Command shouldFilter={false} dir="rtl">
          <CommandList>
            <CommandEmpty className="text-xs text-muted-foreground">לא נמצאו לקוחות תואמים</CommandEmpty>
            <CommandGroup>
              {matches.map((entry, i) => (
                <CommandItem
                  key={`${entry.name}-${entry.phone}-${entry.email}-${i}`}
                  onSelect={() => {
                    onSelectClient(entry);
                    setOpen(false);
                  }}
                  className="flex-col items-end gap-0.5 text-right cursor-pointer"
                >
                  <span className="font-medium text-foreground">{entry.name}</span>
                  {(entry.phone || entry.email) && (
                    <span className="text-xs text-muted-foreground">
                      {[entry.phone, entry.email].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
