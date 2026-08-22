import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpDown, Loader2, Plus, FileText, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { GlassPanel } from '@/components/shared/GlassPanel';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { listQuotes, deleteQuote } from '@/lib/quotes/quoteApi';
import { getBooking, deleteBookingAndCalendarEvent } from '@/lib/scheduling';
import { logActivity } from '@/lib/activity/activityLog';
import { QUOTE_STATUS_LABELS, QUOTE_TYPE_LABELS, formatDateHe, type Quote, type QuoteStatus } from '@/lib/quotes/quote';

// Typed-confirmation word required before a *signed* quote can be
// deleted — deleting one also cancels its calendar event (see
// handleConfirmDelete below), a real-world-consequential action that
// deserves more friction than an ordinary delete.
const SIGNED_DELETE_CONFIRM_WORD = 'בטל';

interface QuotesListScreenProps {
  onBack: () => void;
  onOpen: (quote: Quote) => void;
  onNew: () => void;
}

const STATUS_FILTERS: { id: QuoteStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'draft', label: QUOTE_STATUS_LABELS.draft },
  { id: 'sent', label: QUOTE_STATUS_LABELS.sent },
  { id: 'signed', label: QUOTE_STATUS_LABELS.signed },
  { id: 'rejected', label: QUOTE_STATUS_LABELS.rejected },
];

const STATUS_BADGE_CLASS: Record<QuoteStatus, string> = {
  draft: 'bg-secondary text-muted-foreground border-border',
  sent: 'bg-primary/10 text-primary border-primary/30',
  signed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};

type SortKey = 'createdAt' | 'eventDate';

function partyName(quote: Quote): string {
  return quote.quoteType === 'company_event' ? quote.companyName || 'ללא שם' : quote.clientName || 'ללא שם';
}

function partyPhone(quote: Quote): string {
  return quote.quoteType === 'company_event' ? quote.contactPersonPhone : quote.clientPhone;
}

export default function QuotesListScreen({ onBack, onOpen, onNew }: QuotesListScreenProps) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    listQuotes()
      .then(setQuotes)
      .catch((err) => setError(err instanceof Error ? err.message : 'טעינת ההצעות נכשלה.'));
  }, []);

  // Drafts callout — a dedicated, always-visible section for quotes that
  // were only ever autosaved and never explicitly sent/signed, independent
  // of the status filter chips above. Reuses the exact same onOpen/delete
  // mechanics as the main table (setPendingDeleteId opens the one shared
  // delete-confirmation dialog below), never a separate deletion path.
  const drafts = useMemo(() => (quotes ? quotes.filter((q) => q.status === 'draft') : []), [quotes]);

  const filtered = useMemo(() => {
    if (!quotes) return [];
    const term = search.trim().toLowerCase();
    let rows = quotes;
    if (statusFilter !== 'all') rows = rows.filter((q) => q.status === statusFilter);
    if (term) {
      rows = rows.filter((q) => {
        const haystack = `${partyName(q)} ${partyPhone(q)} ${q.eventDate ?? ''}`.toLowerCase();
        return haystack.includes(term);
      });
    }
    return [...rows].sort((a, b) => {
      const av = sortKey === 'createdAt' ? (a.createdAt?.getTime() ?? 0) : (a.eventDate ? new Date(a.eventDate).getTime() : 0);
      const bv = sortKey === 'createdAt' ? (b.createdAt?.getTime() ?? 0) : (b.eventDate ? new Date(b.eventDate).getTime() : 0);
      return sortDesc ? bv - av : av - bv;
    });
  }, [quotes, search, statusFilter, sortKey, sortDesc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const quoteToDelete = quotes?.find((q) => q.id === pendingDeleteId) ?? null;
  const deletingSignedQuote = quoteToDelete?.status === 'signed';
  const signedDeleteConfirmed = !deletingSignedQuote || deleteConfirmText.trim() === SIGNED_DELETE_CONFIRM_WORD;

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId || !quoteToDelete || !signedDeleteConfirmed) return;
    setDeleting(true);
    setDeleteError(null);
    // Snapshot captured before the delete — the activity row must stay
    // readable after the quote itself is gone (append-only, no live join).
    const deletedQuoteNumber = quoteToDelete.quoteNumber || quoteToDelete.id;
    const deletedPartyName = partyName(quoteToDelete);
    try {
      // A signed quote's id is also its bookings.id (see
      // sign-quote/index.ts's createBookingForSignedQuote) — tear that
      // down, and its Google Calendar event with it, before removing the
      // quote itself. Not gated on deletingSignedQuote: getBooking()
      // simply returns null for a quote that never had one (draft/sent/
      // rejected, or a clinic_treatment quote — those never sync a
      // booking in the first place), so this is safe to run for every
      // status without a special case.
      const booking = await getBooking(pendingDeleteId);
      if (booking) {
        await deleteBookingAndCalendarEvent(booking);
      }
      await deleteQuote(pendingDeleteId);
      setQuotes((prev) => (prev ? prev.filter((q) => q.id !== pendingDeleteId) : prev));
      setPendingDeleteId(null);
      setDeleteConfirmText('');
      toast({ title: 'ההצעה נמחקה' });
      logActivity({
        actionType: 'quote_deleted',
        entityType: 'quote',
        entityId: pendingDeleteId,
        title: `הצעה ${deletedQuoteNumber} — ${deletedPartyName} נמחקה`,
      }).catch((err) => console.error('QuotesListScreen: failed to log quote_deleted activity', err));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'מחיקת ההצעה נכשלה.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="חזרה"
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-bold text-foreground">הצעות שמורות</h2>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> הצעה חדשה
        </button>
      </div>

      {drafts.length > 0 && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">הצעות טיוטה שטרם נשלחו</h3>
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {draft.quoteNumber} · {partyName(draft)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {draft.createdAt ? draft.createdAt.toLocaleDateString('he-IL') : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onOpen(draft)}>
                    המשך עריכה
                  </Button>
                  <button
                    onClick={() => setPendingDeleteId(draft.id)}
                    aria-label={`מחק טיוטה ${draft.quoteNumber}`}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <GlassPanel className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם לקוח, טלפון או תאריך..."
              aria-label="חיפוש הצעות מחיר"
              className="pr-9 bg-secondary border-border"
            />
          </div>
          <div className="flex gap-1.5" role="group" aria-label="סינון לפי סטטוס">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold border transition-colors whitespace-nowrap',
                  statusFilter === f.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {quotes === null && !error && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            טוען...
          </div>
        )}

        {quotes && quotes.length === 0 && (
          <EmptyState icon={FileText} title="אין עדיין הצעות מחיר" description='לחצי על "הצעה חדשה" כדי ליצור את ההצעה הראשונה.' />
        )}

        {quotes && quotes.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">לא נמצאו הצעות התואמות את החיפוש/הסינון.</p>
        )}

        {filtered.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם לקוח / חברה</TableHead>
                <TableHead>סוג הצעה</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort('eventDate')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    תאריך אירוע <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    נוצרה בתאריך <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead aria-hidden="true" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((quote) => (
                <TableRow key={quote.id} onClick={() => onOpen(quote)} className="cursor-pointer animate-in fade-in-0 duration-150">
                  <TableCell className="font-bold text-foreground">
                    {quote.quoteNumber} · {partyName(quote)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{QUOTE_TYPE_LABELS[quote.quoteType]}</TableCell>
                  <TableCell className="text-muted-foreground">{quote.eventDate ? formatDateHe(quote.eventDate) : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {quote.createdAt ? quote.createdAt.toLocaleDateString('he-IL') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[quote.status]}>
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteId(quote.id);
                      }}
                      aria-label={`מחק הצעה ${quote.quoteNumber}`}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassPanel>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null);
            setDeleteError(null);
            setDeleteConfirmText('');
          }
        }}
      >
        <DialogContent dir="rtl" className="text-right">
          <DialogHeader>
            <DialogTitle>מחיקת הצעת מחיר</DialogTitle>
            <DialogDescription>
              למחוק את &quot;{quoteToDelete?.quoteNumber} · {quoteToDelete ? partyName(quoteToDelete) : ''}&quot;? פעולה זו אינה הפיכה.
            </DialogDescription>
          </DialogHeader>
          {deletingSignedQuote && (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-xs text-destructive font-semibold">
                ההצעה הזו נחתמה. מחיקתה תבטל גם את האירוע המשויך ביומן שלנו וב-Google Calendar.
              </p>
              <div className="space-y-1">
                <Label htmlFor="delete-confirm-word" className="text-xs text-muted-foreground">
                  כדי לאשר, הקלידי &quot;{SIGNED_DELETE_CONFIRM_WORD}&quot;
                </Label>
                <Input
                  id="delete-confirm-word"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="bg-secondary border-border"
                  autoComplete="off"
                />
              </div>
            </div>
          )}
          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          <DialogFooter className="sm:justify-start gap-2">
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting || !signedDeleteConfirmed}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'מחק הצעה'}
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
