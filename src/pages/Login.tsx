import { useState, type FormEvent } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { GlassPanel } from '@/components/shared/GlassPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth/auth';
import { BUSINESS_PROFILE } from '@/lib/business/businessProfile';

// The only entry point to the internal app (see App.tsx's auth guard).
// Single fixed account, no signup, no OAuth — by explicit design, not an
// interim state. /sign/:quoteId (the public client-signing page) is a
// completely separate route and never passes through here.
export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(username, password);
    if (signInError) setError(signInError);
    setSubmitting(false);
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-4">
      <GlassPanel className="w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={BUSINESS_PROFILE.logo} alt={BUSINESS_PROFILE.nameHe} className="h-14 w-14 rounded-xl object-contain bg-white p-1" />
          <div>
            <h1 className="text-lg font-extrabold text-foreground">{BUSINESS_PROFILE.nameHe}</h1>
            <p className="text-xs text-muted-foreground mt-1">מערכת הצעות מחיר — כניסה</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="login-username" className="text-xs text-muted-foreground mb-1 block">
              שם משתמש
            </Label>
            <Input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-secondary border-border"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="login-password" className="text-xs text-muted-foreground mb-1 block">
              סיסמה
            </Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary border-border"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-xs text-destructive text-center">{error}</p>}

          <Button type="submit" disabled={submitting || !username || !password} className="w-full gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            כניסה
          </Button>
        </form>
      </GlassPanel>
    </div>
  );
}
