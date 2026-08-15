import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Library, Plus, Trash2, Copy, UserCheck, Clock, Wrench, Search, FilePlus2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { coerceValidatedNumber } from '@/lib/utils';
import { NICHES } from '@/components/calculator/NicheSelector';
import {
  EventPackageSchema,
  EQUIPMENT_PROVIDER_LABELS,
  EquipmentProviderSchema,
  createEmptyPackage,
  type EventPackage,
  type EquipmentProvider,
} from '@/lib/eventCatalog';

interface EventsLibraryProps {
  packages: EventPackage[];
  setPackages: Dispatch<SetStateAction<EventPackage[]>>;
  /** Opens the quotes module on a new quote, pre-filled from this package —
   *  the one actionable outbound path from an otherwise static catalog. */
  onCreateQuote: (pkg: EventPackage) => void;
}

// Event Library — product/package catalog. Distinct from the Calendar tab
// (scheduling of specific booked instances): this is the sellable-template
// layer (pricing template via nicheId, capacity, duration, equipment).
// State lifted to Home.tsx (Design Spec Phase 2, C1) so the Dashboard
// overview can read real, live package counts instead of a disconnected
// seed snapshot. Local state for now — see CLAUDE.md (no Supabase table
// wired yet).
export default function EventsLibrary({ packages, setPackages, onCreateQuote }: EventsLibraryProps) {
  const [search, setSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const updatePackage = (id: string, updates: Partial<EventPackage>) => {
    setPackages((prev) =>
      prev.map((pkg) => (pkg.id === id ? EventPackageSchema.parse({ ...pkg, ...updates }) : pkg))
    );
  };

  const removePackage = (id: string) => {
    setPackages((prev) => prev.filter((pkg) => pkg.id !== id));
    setPendingDeleteId(null);
  };

  const addPackage = () => {
    setPackages((prev) => [...prev, createEmptyPackage()]);
  };

  const duplicatePackage = (id: string) => {
    setPackages((prev) => {
      const source = prev.find((pkg) => pkg.id === id);
      if (!source) return prev;
      const copy = EventPackageSchema.parse({ ...source, id: crypto.randomUUID(), name: `${source.name} (עותק)` });
      const index = prev.findIndex((pkg) => pkg.id === id);
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  };

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch = !search || pkg.name.includes(search) || pkg.description.includes(search);
      const matchesNiche = !nicheFilter || pkg.nicheId === nicheFilter;
      return matchesSearch && matchesNiche;
    });
  }, [packages, search, nicheFilter]);

  const packageToDelete = packages.find((pkg) => pkg.id === pendingDeleteId);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">ספריית אירועים — קטלוג חבילות</h3>
        </div>
        <button
          onClick={addPackage}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> הוסף חבילה
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש חבילה..."
            aria-label="חיפוש חבילה"
            className="bg-secondary border-border pr-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterChip active={nicheFilter === null} onClick={() => setNicheFilter(null)} label="הכל" />
          {NICHES.map((niche) => (
            <FilterChip key={niche.id} active={nicheFilter === niche.id} onClick={() => setNicheFilter(niche.id)} label={niche.label} />
          ))}
        </div>
      </div>

      {filteredPackages.length === 0 ? (
        <EmptyState
          icon={Library}
          title={packages.length === 0 ? 'אין חבילות בקטלוג' : 'לא נמצאו חבילות'}
          description={packages.length === 0 ? 'הוסיפי חבילה ראשונה כדי להתחיל.' : 'נסי לשנות את החיפוש או הסינון.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onChange={(updates) => updatePackage(pkg.id, updates)}
              onRemove={() => setPendingDeleteId(pkg.id)}
              onDuplicate={() => duplicatePackage(pkg.id)}
              onCreateQuote={() => onCreateQuote(pkg)}
            />
          ))}
        </div>
      )}

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent dir="rtl" className="text-right">
          <DialogHeader>
            <DialogTitle>מחיקת חבילה</DialogTitle>
            <DialogDescription>
              למחוק את &quot;{packageToDelete?.name}&quot;? פעולה זו אינה הפיכה.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start gap-2">
            <Button variant="destructive" onClick={() => pendingDeleteId && removePackage(pendingDeleteId)}>
              מחק חבילה
            </Button>
            <DialogClose asChild>
              <Button variant="outline">ביטול</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

interface PackageCardProps {
  pkg: EventPackage;
  onChange: (updates: Partial<EventPackage>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onCreateQuote: () => void;
}

function PackageCard({ pkg, onChange, onRemove, onDuplicate, onCreateQuote }: PackageCardProps) {
  return (
    <motion.div
      layout
      className="relative text-right rounded-xl border border-border p-5 bg-card flex flex-col gap-3"
    >
      <div className="absolute top-3 left-3 flex items-center gap-1">
        <button
          onClick={onDuplicate}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="שכפל חבילה"
          title="שכפל חבילה"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="מחק חבילה"
          title="מחק חבילה"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">שם החבילה</Label>
        <Input
          value={pkg.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="bg-secondary border-border font-bold text-foreground"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">תיאור</Label>
        <Input
          value={pkg.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="bg-secondary border-border text-sm"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">תבנית תמחור (ניישה)</Label>
        <select
          value={pkg.nicheId}
          onChange={(e) => onChange({ nicheId: e.target.value })}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-bold text-foreground"
        >
          {NICHES.map((niche) => (
            <option key={niche.id} value={niche.id}>
              {niche.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> כמות מטפלים נדרשת
          </Label>
          <Input
            type="number"
            value={pkg.therapistsRequired}
            onChange={(e) =>
              onChange({
                therapistsRequired: coerceValidatedNumber(EventPackageSchema.shape.therapistsRequired, e.target.value, pkg.therapistsRequired),
              })
            }
            className="bg-secondary border-border text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> משך (שעות)
          </Label>
          <Input
            type="number"
            step={0.5}
            value={pkg.durationHours}
            onChange={(e) =>
              onChange({ durationHours: coerceValidatedNumber(EventPackageSchema.shape.durationHours, e.target.value, pkg.durationHours) })
            }
            className="bg-secondary border-border text-sm"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <Wrench className="w-3.5 h-3.5" /> ציוד
        </Label>
        <div className="flex gap-1 bg-secondary p-1 rounded-lg border border-border">
          {EquipmentProviderSchema.options.map((option: EquipmentProvider) => (
            <button
              key={option}
              onClick={() => onChange({ equipmentProvider: option })}
              className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                pkg.equipmentProvider === option
                  ? 'bg-card text-foreground border border-border'
                  : 'text-muted-foreground'
              }`}
            >
              {EQUIPMENT_PROVIDER_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onCreateQuote}
        className="flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <FilePlus2 className="w-3.5 h-3.5" /> צור הצעת מחיר מחבילה
      </button>
    </motion.div>
  );
}
