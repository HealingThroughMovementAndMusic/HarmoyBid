import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer as DrawerPrimitive } from "vaul";
import {
  FileText,
  Users,
  BarChart3,
  Settings,
  ChevronsRight,
  Moon,
  Sun,
  Bell,
  HelpCircle,
  User,
  Search,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import harmonyLogo from "@/assets/harmony-healing-logo.jpg";
import { GradientBackground } from "@/components/ui/jade-sky";
import { VoltageCanvas } from "@/components/ui/voltage-canvas";

// Adapted for RTL Hebrew from a community "Example" dashboard-shell
// component, then reskinned onto Harmony's own CSS-variable design tokens
// (bg-card, border-border, text-primary, ...) instead of the original's
// hardcoded gray/blue Tailwind palette, for visual consistency with the
// rest of the app. RTL is handled with Tailwind logical properties
// (border-e, border-s, start/end) so the layout mirrors correctly under
// dir="rtl" instead of hardcoded left/right.
//
// Theme: `index.css` defines a real `:root` (light) / `.dark` palette
// split. Dark is the default (matches `index.html`'s static `class="dark"`
// on <html>, which avoids a flash-of-light-theme before React mounts) —
// the toggle below just adds/removes that class from then on.

export interface NavOption {
  title: string;
  icon: LucideIcon;
  notifs?: number;
  /** Groups consecutive items under a shared header (Design Spec Phase 2, Section B). */
  group?: string;
}

const DEFAULT_NAV_OPTIONS: NavOption[] = [
  { title: "הצעות מחיר", icon: FileText, notifs: 3, group: "תפעול" },
  { title: "לקוחות", icon: Users, group: "לקוחות" },
  { title: "דוחות וניתוחים", icon: BarChart3, group: "עסק" },
  { title: "הגדרות מערכת", icon: Settings, group: "עסק" },
];

export interface DashboardLayoutProps {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  navItems?: NavOption[];
  /** Controlled selection — pass together with onNavigate to drive content from the parent. */
  selected?: string;
  /** Initial selection when uncontrolled (no `selected` prop supplied). */
  defaultSelected?: string;
  onNavigate?: (title: string) => void;
  /** Opens the global command palette — see Section A7/B of the design spec. */
  onOpenCommandPalette?: () => void;
  /** Signs the user out — wired to the header's account icon button. Omit to leave that button non-functional (e.g. no auth context available). */
  onSignOut?: () => void;
  /** Controlled dark/light state — pass together with onIsDarkChange so the
   *  same state can also be driven by the Settings screen's Theme switch,
   *  not just this component's own header button. */
  isDark?: boolean;
  /** Initial value when uncontrolled (no `isDark` prop supplied) — defaults
   *  to true, preserving the app's original always-dark behavior exactly. */
  defaultIsDark?: boolean;
  onIsDarkChange?: (isDark: boolean) => void;
}

export function DashboardLayout({
  children,
  title = "מערכת תמחור והצעות מחיר",
  subtitle = "ניהול והפקת הצעות מחיר בזמן אמת",
  navItems = DEFAULT_NAV_OPTIONS,
  selected: selectedProp,
  defaultSelected = navItems[0]?.title,
  onNavigate,
  onOpenCommandPalette,
  onSignOut,
  isDark: isDarkProp,
  defaultIsDark = true,
  onIsDarkChange,
}: DashboardLayoutProps) {
  // Same controlled/uncontrolled shape as `selected`/`defaultSelected`
  // above — uncontrolled default stays `true` (dark), preserving the
  // app's original always-dark appearance exactly for any caller that
  // doesn't pass `isDark` (there's currently none, but the shape stays
  // backward-compatible either way).
  const [internalIsDark, setInternalIsDark] = useState(defaultIsDark);
  const isDarkControlled = isDarkProp !== undefined;
  const isDark = isDarkControlled ? isDarkProp : internalIsDark;
  const setIsDark = (next: boolean) => {
    if (!isDarkControlled) setInternalIsDark(next);
    onIsDarkChange?.(next);
  };
  const [internalSelected, setInternalSelected] = useState(defaultSelected);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isControlled = selectedProp !== undefined;
  const selected = isControlled ? selectedProp : internalSelected;
  // Tablet defaults the rail to collapsed (reclaims width without hiding
  // nav entirely) — Design Spec Phase 2, Section B.
  const isTablet = useMediaQuery("(min-width: 640px) and (max-width: 1023px)");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const handleSelect = (optionTitle: string) => {
    if (!isControlled) setInternalSelected(optionTitle);
    onNavigate?.(optionTitle);
  };

  const handleSelectAndClose = (optionTitle: string) => {
    handleSelect(optionTitle);
    setMobileNavOpen(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground" dir="rtl">
      <Sidebar
        navItems={navItems}
        selected={selected}
        onSelect={handleSelect}
        onOpenCommandPalette={onOpenCommandPalette}
        defaultCollapsed={isTablet}
      />
      <MobileNavDrawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        navItems={navItems}
        selected={selected}
        onSelect={handleSelectAndClose}
        onOpenCommandPalette={onOpenCommandPalette}
      />
      <DashboardContent
        title={title}
        subtitle={subtitle}
        isDark={isDark}
        setIsDark={setIsDark}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        onSignOut={onSignOut}
      >
        {children}
      </DashboardContent>
    </div>
  );
}

interface SidebarProps {
  navItems: NavOption[];
  selected: string;
  onSelect: (title: string) => void;
  onOpenCommandPalette?: () => void;
  defaultCollapsed?: boolean;
}

// Desktop/tablet persistent rail. Hidden below the sm breakpoint — mobile
// uses MobileNavDrawer instead (Design Spec Phase 2, Section B).
function Sidebar({ navItems, selected, onSelect, onOpenCommandPalette, defaultCollapsed }: SidebarProps) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <nav
      className={cn(
        "hidden sm:flex sm:flex-col sticky top-0 h-screen shrink-0 border-e transition-all duration-300 ease-in-out",
        open ? "w-64" : "w-16",
        "border-border bg-card p-2 shadow-sm"
      )}
    >
      <TitleSection open={open} onSelect={onSelect} />
      {/* flex-1 + min-h-0 reserves real space for everything below (the
          command-palette hint, account section, ToggleClose) instead of
          letting an absolutely-positioned bottom bar overlap them — see
          plan "Sidebar layout bugs" for the bug this replaced. */}
      <div className="flex-1 min-h-0 flex flex-col">
        <NavList navItems={navItems} selected={selected} onSelect={onSelect} onOpenCommandPalette={onOpenCommandPalette} open={open} instanceId="desktop" />
      </div>
      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
}

interface NavListProps {
  navItems: NavOption[];
  selected: string;
  onSelect: (title: string) => void;
  onOpenCommandPalette?: () => void;
  open: boolean;
  /** Distinguishes the desktop rail's nav list from the mobile drawer's —
   *  both can share DOM presence during the drawer's own mount/unmount
   *  transition, so the active-item indicator's layoutId is namespaced per
   *  instance to avoid two elements claiming the same shared layout id. */
  instanceId: string;
}

// The nav content shared between the persistent desktop rail and the mobile
// drawer, so the two never drift out of sync.
function NavList({ navItems, selected, onSelect, onOpenCommandPalette, open, instanceId }: NavListProps) {
  return (
    <>
      <div className="space-y-1 flex-1 min-h-0 overflow-y-auto harmony-scroll pr-0.5">
        {navItems.map((option, i) => {
          const isNewGroup = option.group && option.group !== navItems[i - 1]?.group;
          return (
            <div key={option.title}>
              {isNewGroup && open && (
                <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {option.group}
                </div>
              )}
              <Option
                icon={option.icon}
                title={option.title}
                notifs={option.notifs}
                open={open}
                selected={selected}
                onSelect={onSelect}
                instanceId={instanceId}
              />
            </div>
          );
        })}
      </div>

      {open && (
        <div className="border-t border-border pt-3 pb-2 space-y-1">
          <button
            onClick={onOpenCommandPalette}
            className="flex h-9 w-full items-center justify-between rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              חיפוש מהיר
            </span>
            <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
          </button>
        </div>
      )}

      {open && (
        <div className="border-t border-border pt-4 space-y-1">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            חשבון
          </div>
          <Option icon={HelpCircle} title="עזרה ותמיכה" open={open} selected={selected} onSelect={onSelect} instanceId={instanceId} />
        </div>
      )}
    </>
  );
}

interface MobileNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: NavOption[];
  selected: string;
  onSelect: (title: string) => void;
  onOpenCommandPalette?: () => void;
}

// Mobile (<640px) sidebar replacement — a right-edge panel (the RTL-correct
// side, matching where the persistent rail visually sits) built directly on
// vaul with direction="right", since the generic shadcn Drawer primitive
// (src/components/ui/drawer.tsx) is styled as a bottom sheet and isn't the
// right shape for a side nav panel. Design Spec Phase 2, Section B / A7.
function MobileNavDrawer({ open, onOpenChange, navItems, selected, onSelect, onOpenCommandPalette }: MobileNavDrawerProps) {
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DrawerPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex h-full w-72 flex-col border-s border-border bg-card p-3 focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSelect('לוח בקרה')}
              aria-label="חזרה ללוח הבקרה"
              className="flex items-center gap-3 rounded-md p-1 -m-1 transition-colors hover:bg-secondary"
            >
              <Logo />
              <div className="text-right">
                <span className="block text-sm font-semibold text-foreground">מערכת הצעות מחיר</span>
                <span className="block text-xs text-muted-foreground">חבילת Pro</span>
              </div>
            </button>
            <DrawerPrimitive.Close
              aria-label="סגור תפריט"
              className="grid size-8 place-content-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </DrawerPrimitive.Close>
          </div>
          <NavList navItems={navItems} selected={selected} onSelect={onSelect} onOpenCommandPalette={onOpenCommandPalette} open instanceId="mobile" />
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

interface OptionProps {
  icon: LucideIcon;
  title: string;
  selected: string;
  onSelect: (title: string) => void;
  open: boolean;
  notifs?: number;
  instanceId: string;
}

function Option({ icon: Icon, title, selected, onSelect, open, notifs, instanceId }: OptionProps) {
  const isSelected = selected === title;

  return (
    <button
      onClick={() => onSelect(title)}
      aria-label={title}
      aria-current={isSelected ? 'page' : undefined}
      className={cn(
        "relative flex h-11 w-full items-center rounded-md transition-colors duration-200",
        isSelected ? "text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {isSelected && (
        // Shared layout indicator — animates smoothly between nav items
        // instead of each button independently popping its own background.
        // House flat-easing convention (150-200ms, cubic-bezier(0.4,0,0.2,1)
        // — see FloatingDock.tsx's own spring-exception comment), not a
        // spring, to stay consistent with the rest of the app's motion.
        <motion.div
          layoutId={`nav-active-indicator-${instanceId}`}
          className="absolute inset-0 rounded-md bg-primary/10 shadow-sm border-r-2 border-primary"
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
      <div className="relative z-10 grid h-full w-12 shrink-0 place-content-center">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>

      {open && <span className="relative z-10 truncate text-sm font-medium">{title}</span>}

      {notifs !== undefined && open && (
        <span className="absolute right-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {notifs}
        </span>
      )}
    </button>
  );
}

function TitleSection({ open, onSelect }: { open: boolean; onSelect: (title: string) => void }) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <button
        type="button"
        onClick={() => onSelect('לוח בקרה')}
        aria-label="חזרה ללוח הבקרה"
        className="flex w-full items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
      >
        <Logo />
        {open && (
          <div className="text-right">
            <span className="block text-sm font-semibold text-foreground">מערכת הצעות מחיר</span>
            <span className="block text-xs text-muted-foreground">חבילת Pro</span>
          </div>
        )}
      </button>
    </div>
  );
}

function Logo() {
  // White backing + border so the logo's own white background reads as an
  // intentional badge in both themes — against Harmony's dark sidebar, and
  // (via the border) against a light-mode card that's also near-white.
  return (
    <div className="grid size-10 shrink-0 place-content-center rounded-lg border border-border bg-white p-1 shadow-sm">
      <img src={harmonyLogo} alt="ריפוי הרמוני · Harmony Healing" className="h-full w-full rounded object-contain" />
    </div>
  );
}

interface ToggleCloseProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

function ToggleClose({ open, setOpen }: ToggleCloseProps) {
  return (
    <button
      onClick={() => setOpen(!open)}
      className="shrink-0 w-full border-t border-border transition-colors hover:bg-secondary"
    >
      <div className="flex items-center p-3">
        <div className="grid size-10 shrink-0 place-content-center">
          <ChevronsRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-300",
              open ? "" : "rotate-180"
            )}
          />
        </div>
        {open && <span className="text-sm font-medium text-muted-foreground">הסתר</span>}
      </div>
    </button>
  );
}

interface DashboardContentProps {
  title: string;
  subtitle: string;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  onOpenMobileNav?: () => void;
  onSignOut?: () => void;
  children?: ReactNode;
}

function DashboardContent({ title, subtitle, isDark, setIsDark, onOpenMobileNav, onSignOut, children }: DashboardContentProps) {
  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="grid grid-cols-1 w-full">
      {/* Ambient background — "Jade Sky" in light mode, "Rationed Voltage
          Dark" canvas in dark mode. Grid-stacked with the content (both
          col-start-1 row-start-1) rather than absolutely positioned:
          GradientBackground's own inline style hardcodes position:relative,
          which always wins over a Tailwind `absolute` class, so a plain
          overlay approach silently failed. Grid stacking sizes the shared
          row to the content's real height automatically.
          IMPORTANT: both gradient components' inner layer is itself
          position:absolute — per CSS paint order, ANY positioned element
          paints above ALL position:static siblings regardless of DOM order.
          The content div below MUST stay `relative` (not just later in the
          DOM) so it paints above the gradient instead of being hidden
          under it — dropping `relative` here reintroduces the exact bug
          this comment is warning about. */}
      <div className="relative col-start-1 row-start-1">
        {/* Crossfade wrapper — a separate absolutely-positioned motion.div
            around each background, not a className passed into
            VoltageCanvas/GradientBackground themselves (those hardcode
            position:relative via inline style on their own root, which
            would silently win over an absolute utility class passed
            straight into them — see the comment above). Both backgrounds
            are static CSS gradients (no <canvas>, no animation loop), so
            briefly mounting both during the ~200ms crossfade is a one-time
            paint, not a per-frame cost. */}
        <AnimatePresence initial={false}>
          {isDark ? (
            <motion.div
              key="voltage"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <VoltageCanvas className="h-full w-full" />
            </motion.div>
          ) : (
            <motion.div
              key="gradient"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <GradientBackground className="h-full w-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="relative col-start-1 row-start-1 p-6">
      {/* Mobile: stacked and centered. sm+: 3-column grid so the title block
          sits in the true center of the row regardless of the icon group's
          width — spacer/title/icons DOM order flips correctly under RTL. */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center sm:grid sm:grid-cols-3 sm:items-center sm:text-inherit">
        <div className="hidden sm:block" aria-hidden="true" />
        <div className="text-center min-w-0">
          {/* Sized conservatively (not just capped at the previous text-3xl)
              so the full bilingual string fits within the header grid's
              middle column without wrapping OR overflowing into the icon
              cluster — measured against the narrowest realistic column
              width across sidebar states, not just typical ones. */}
          <h1 className="text-base sm:text-lg lg:text-xl font-bold text-foreground whitespace-nowrap">{title}</h1>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 sm:justify-self-end">
          <button
            onClick={onOpenMobileNav}
            aria-label="פתח תפריט ניווט"
            className="sm:hidden rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <button className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive" />
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <AnimatePresence initial={false}>
              {isDark ? (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Sun className="h-4 w-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Moon className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={onSignOut}
            disabled={!onSignOut}
            aria-label="התנתקות"
            title="התנתקות"
            className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>

      {children ?? (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">
          אזור תוכן ראשי — כאן ישולב מחשבון התמחור
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
