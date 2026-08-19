import { Loader2 } from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import { Toaster } from "@/components/ui/toaster"
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import SignQuote from '@/pages/SignQuote';
import PdfPreview from '@/pages/PdfPreview';
import { useAuthSession } from '@/hooks/useAuthSession';

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
            <Routes>
              <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/sign/:quoteId" element={<SignQuote />} />
              {/* Dev-only PDF local-preview loop — never linked from app nav. */}
              {import.meta.env.DEV && <Route path="/pdf-preview/:type?" element={<PdfPreview />} />}
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App
