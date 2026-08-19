import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Users, Search, Plus, ChevronLeft } from 'lucide-react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import EmptyState from '@/components/shared/EmptyState';
import { cn, coerceValidatedText } from '@/lib/utils';
import {
  ClientSchema,
  CLIENT_STATUS_LABELS,
  type Client,
  type ClientStatus,
} from '@/lib/clients';
import { usePersistedClients } from '@/hooks/usePersistedClients';
import ClientProfile from './ClientProfile';

const NAME_SCHEMA = z.string().min(1).max(200);
const TEXT_SCHEMA = z.string().max(200);

interface ClientsListProps {
  /** Set true (by the parent) to pop the create dialog open on mount/update — the Dashboard's "לקוח חדש" quick action deep-link. One-shot: consumed via onAutoOpenHandled. */
  autoOpenCreate?: boolean;
  onAutoOpenHandled?: () => void;
}

const STATUS_BADGE_VARIANT: Record<ClientStatus, string> = {
  active: 'bg-primary/10 text-primary border-primary/30',
  dormant: 'bg-secondary text-muted-foreground border-border',
  new: 'bg-accent/10 text-accent border-accent/30',
};

// Client Management / CRM (Design Spec Phase 2, C6). Data Table (shadcn,
// TanStack-based) on desktop, stacked card list on mobile — no candidate
// researched had a built-in mobile fallback, so this is designed in
// explicitly per the spec's cross-cutting risk note.
export default function ClientsList({ autoOpenCreate, onAutoOpenHandled }: ClientsListProps = {}) {
  const { clients, setClients } = usePersistedClients();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftTreatment, setDraftTreatment] = useState('');

  useEffect(() => {
    if (autoOpenCreate) {
      setCreateOpen(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpenCreate, onAutoOpenHandled]);

  const resetDraft = () => {
    setDraftName('');
    setDraftPhone('');
    setDraftEmail('');
    setDraftTreatment('');
  };

  const handleCreateSubmit = () => {
    if (!draftName.trim()) return;
    const newClient = ClientSchema.parse({
      id: crypto.randomUUID(),
      createdAt: new Date(),
      name: draftName,
      phone: draftPhone,
      email: draftEmail,
      treatment: draftTreatment,
    });
    setClients((prev) => [newClient, ...prev]);
    setCreateOpen(false);
    resetDraft();
  };

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        !search || c.name.includes(search) || c.email.includes(search) || c.phone.includes(search);
      const matchesStatus = !statusFilter || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? ClientSchema.parse({ ...c, ...updates }) : c)));
  };

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      { accessorKey: 'name', header: 'שם', cell: (info) => <span className="font-bold text-foreground">{info.getValue<string>()}</span> },
      { accessorKey: 'email', header: 'אימייל', cell: (info) => info.getValue<string>() || '—' },
      { accessorKey: 'phone', header: 'טלפון', cell: (info) => info.getValue<string>() || '—' },
      {
        accessorKey: 'status',
        header: 'סטטוס',
        cell: (info) => {
          const status = info.getValue<ClientStatus>();
          return (
            <Badge variant="outline" className={STATUS_BADGE_VARIANT[status]}>
              {CLIENT_STATUS_LABELS[status]}
            </Badge>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel() });

  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selectedClient ? (
        <motion.div
          key="profile"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <ClientProfile
            client={selectedClient}
            onBack={() => setSelectedClientId(null)}
            onChange={(updates) => updateClient(selectedClient.id, updates)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
    <div dir="rtl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">לקוחות</h3>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> הוסף לקוח
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, אימייל או טלפון..."
            aria-label="חיפוש לקוחות"
            className="bg-secondary border-border pr-9"
          />
        </div>
        <div className="flex gap-1.5">
          <FilterChip active={statusFilter === null} onClick={() => setStatusFilter(null)} label="הכל" />
          {(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((status) => (
            <FilterChip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)} label={CLIENT_STATUS_LABELS[status]} />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={clients.length === 0 ? 'אין עדיין לקוחות' : 'לא נמצאו לקוחות'}
          description={clients.length === 0 ? 'הוסיפי לקוח ראשון כדי להתחיל.' : 'נסי לשנות את החיפוש או הסינון.'}
        />
      ) : (
        <>
          {/* Desktop / tablet: Data Table */}
          <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => setSelectedClientId(row.original.id)}
                    className="cursor-pointer animate-in fade-in-0 duration-150"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards — no table candidate researched had a
              built-in fallback, so this is a deliberate, explicit design
              (Design Spec Phase 2, cross-cutting mobile risk note). */}
          <div className="sm:hidden space-y-2">
            {filtered.map((client) => (
              <button
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-4 text-right animate-in fade-in-0 duration-150"
              >
                <div>
                  <p className="font-bold text-foreground text-sm">{client.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{client.phone || client.email || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE_VARIANT[client.status])}>
                    {CLIENT_STATUS_LABELS[client.status]}
                  </Badge>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Create client — replaces the old silent blank-row insert with a
          real form, same coerce-validate-with-fallback pattern used
          throughout the app (see EventsCalendar's booking dialog). */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetDraft(); }}>
        <DialogContent dir="rtl" className="text-right">
          <DialogHeader>
            <DialogTitle>לקוח חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="client-name" className="text-xs text-muted-foreground mb-1 block">
                שם *
              </Label>
              <Input
                id="client-name"
                value={draftName}
                onChange={(e) => setDraftName(coerceValidatedText(NAME_SCHEMA, e.target.value, draftName))}
                className="bg-secondary border-border"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="client-phone" className="text-xs text-muted-foreground mb-1 block">
                טלפון
              </Label>
              <Input
                id="client-phone"
                value={draftPhone}
                onChange={(e) => setDraftPhone(coerceValidatedText(TEXT_SCHEMA, e.target.value, draftPhone))}
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <Label htmlFor="client-email" className="text-xs text-muted-foreground mb-1 block">
                אימייל
              </Label>
              <Input
                id="client-email"
                value={draftEmail}
                onChange={(e) => setDraftEmail(coerceValidatedText(TEXT_SCHEMA, e.target.value, draftEmail))}
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <Label htmlFor="client-treatment" className="text-xs text-muted-foreground mb-1 block">
                טיפול
              </Label>
              <Input
                id="client-treatment"
                value={draftTreatment}
                onChange={(e) => setDraftTreatment(coerceValidatedText(TEXT_SCHEMA, e.target.value, draftTreatment))}
                className="bg-secondary border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateSubmit} disabled={!draftName.trim()}>
              הוסף לקוח
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors',
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}
