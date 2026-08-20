import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Toaster } from "@/components/ui/toaster"
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Login from '@/pages/Login';
import { useAuthSession } from '@/hooks/useAuthSession';

// Route-level code splitting: Home pulls in the entire internal CRM
// (dashboard, calculator, calendar, PDF export libraries) — none of that
// belongs in the bundle a first-time client has to download just to reach
// /sign/:quoteId. Each of these becomes its own chunk, fetched only when
// that route is actually visited (see CLAUDE.md's "Signing page load
// performance" for the measured before/after). Login/PageNotFound stay
// static imports — both are small and Login is needed immediately for any
// unauthenticated visit to "/".
const Home = lazy(() => import('@/pages/Home'));
const SignQuote = lazy(() => import('@/pages/SignQuote'));
const PdfPreview = lazy(() => import('@/pages/PdfPreview'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// Gate for the internal app only — /sign/:quoteId (the public
// client-signing page) is a completely separate route, never wrapped by
// this, since an external client has no account and shouldn't need one.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthSession();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Login />;
  return <>{children}</>;
}

function App() {
  return (
    // reducedMotion="user" — respects the OS-level prefers-reduced-motion
    // setting globally, for every framer-motion animation in the app
    // (existing and new), without each component needing its own check.
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
                <Route path="/sign/:quoteId" element={<SignQuote />} />
                {/* Dev-only PDF local-preview loop — never linked from app nav. */}
                {import.meta.env.DEV && <Route path="/pdf-preview/:type?" element={<PdfPreview />} />}
                <Route path="*" element={<PageNotFound />} />
              </Routes>
            </Suspense>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App
