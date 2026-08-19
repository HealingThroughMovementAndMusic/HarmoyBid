import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Top-level safety net — without this, any uncaught render error (e.g. an
// unexpected Supabase row shape failing a Zod .parse()) blanks the entire
// app, including the public /sign/:quoteId page an external client is
// looking at. Reset is a full reload rather than clearing local state,
// since the error's actual cause is unknown at this level.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled render error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-sm text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-foreground">משהו השתבש</h1>
              <p className="text-sm text-muted-foreground">
                אירעה שגיאה בלתי צפויה. נסי לרענן את הדף — אם הבעיה חוזרת, פני לתמיכה.
              </p>
            </div>
            <Button onClick={() => window.location.reload()} className="gap-1.5">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              רענון הדף
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
