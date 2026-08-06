import { useState, useEffect, type ReactNode } from "react";
import {
  Calculator,
  FileText,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronsRight,
  Moon,
  Sun,
  Bell,
  HelpCircle,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Adapted for RTL Hebrew from a community "Example" dashboard-shell
// component, then reskinned onto Harmony's own CSS-variable design tokens
// (bg-card, border-border, text-primary, ...) instead of the original's
// hardcoded gray/blue Tailwind palette, for visual consistency with the
// rest of the app. RTL is handled with Tailwind logical properties
// (border-e, border-s, start/end) so the layout mirrors correctly under
// dir="rtl" instead of hardcoded left/right.
//
// Note: Harmony's theme is currently always-dark (defined directly on
// :root, no `.dark` class variant) — the light/dark toggle below still
// mechanically flips the `dark` class per the original spec, but until a
// light palette is added elsewhere it won't visibly change Harmony's own
// tokens.

export interface NavOption {
  title: string;
  icon: LucideIcon;
  notifs?: number;
}

const DEFAULT_NAV_OPTIONS: NavOption[] = [
  { title: "מחשבון תמחור", icon: Calculator },
  { title: "הצעות מחיר", icon: FileText, notifs: 3 },
  { title: "לקוחות", icon: Users },
  { title: "דוחות וניתוחים", icon: BarChart3 },
  { title: "הגדרות מערכת", icon: Settings },
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
}

export function DashboardLayout({
  children,
  title = "מערכת תמחור והצעות מחיר",
  subtitle = "ניהול והפקת הצעות מחיר בזמן אמת",
  navItems = DEFAULT_NAV_OPTIONS,
  selected: selectedProp,
  defaultSelected = navItems[0]?.title,
  onNavigate,
}: DashboardLayoutProps) {
  const [isDark, setIsDark] = useState(false);
  const [internalSelected, setInternalSelected] = useState(defaultSelected);
  const isControlled = selectedProp !== undefined;
  const selected = isControlled ? selectedProp : internalSelected;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const handleSelect = (optionTitle: string) => {
    if (!isControlled) setInternalSelected(optionTitle);
    onNavigate?.(optionTitle);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground" dir="rtl">
      <Sidebar navItems={navItems} selected={selected} onSelect={handleSelect} />
      <DashboardContent title={title} subtitle={subtitle} isDark={isDark} setIsDark={setIsDark}>
        {children}
      </DashboardContent>
    </div>
  );
}

interface SidebarProps {
  navItems: NavOption[];
  selected: string;
  onSelect: (title: string) => void;
}

function Sidebar({ navItems, selected, onSelect }: SidebarProps) {
  const [open, setOpen] = useState(true);

  return (
    <nav
      className={cn(
        "relative sticky top-0 h-screen shrink-0 border-e transition-all duration-300 ease-in-out",
        open ? "w-64" : "w-16",
        "border-border bg-card p-2 shadow-sm"
      )}
    >
      <TitleSection open={open} />

      <div className="space-y-1 mb-8 overflow-y-auto max-h-[calc(100vh-14rem)]">
        {navItems.map((option) => (
          <Option
            key={option.title}
            icon={option.icon}
            title={option.title}
            notifs={option.notifs}
            open={open}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
      </div>

      {open && (
        <div className="border-t border-border pt-4 space-y-1">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            חשבון
          </div>
          <Option icon={HelpCircle} title="עזרה ותמיכה" open={open} selected={selected} onSelect={onSelect} />
        </div>
      )}

      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
}

interface OptionProps {
  icon: LucideIcon;
  title: string;
  selected: string;
  onSelect: (title: string) => void;
  open: boolean;
  notifs?: number;
}

function Option({ icon: Icon, title, selected, onSelect, open, notifs }: OptionProps) {
  const isSelected = selected === title;

  return (
    <button
      onClick={() => onSelect(title)}
      className={cn(
        "relative flex h-11 w-full items-center rounded-md transition-all duration-200",
        isSelected
          ? "bg-primary/10 text-primary shadow-sm border-s-2 border-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <div className="grid h-full w-12 shrink-0 place-content-center">
        <Icon className="h-4 w-4" />
      </div>

      {open && <span className="truncate text-sm font-medium">{title}</span>}

      {notifs !== undefined && open && (
        <span className="absolute end-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {notifs}
        </span>
      )}
    </button>
  );
}

function TitleSection({ open }: { open: boolean }) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <div className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-secondary">
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div>
              <span className="block text-sm font-semibold text-foreground">מערכת הצעות מחיר</span>
              <span className="block text-xs text-muted-foreground">חבילת Pro</span>
            </div>
          )}
        </div>
        {open && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-sm">
      <svg width="20" viewBox="0 0 50 39" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-primary-foreground">
        <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
        <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z" />
      </svg>
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
      className="absolute inset-x-0 bottom-0 border-t border-border transition-colors hover:bg-secondary"
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
  children?: ReactNode;
}

function DashboardContent({ title, subtitle, isDark, setIsDark, children }: DashboardContentProps) {
  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -end-1 h-3 w-3 rounded-full bg-destructive" />
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground">
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
  );
}

export default DashboardLayout;
