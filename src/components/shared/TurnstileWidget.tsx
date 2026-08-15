import { useEffect, useRef } from 'react';

// Cloudflare Turnstile widget for src/pages/SignQuote.tsx — the public
// signing page's bot-protection layer. Built inert-but-ready per this
// project's established pattern for not-yet-activated integrations
// (Google Calendar/Drive, Resend): loads Cloudflare's script and renders
// the widget only when VITE_TURNSTILE_SITE_KEY is set; if unset, this
// component renders nothing and the signing page works exactly as it did
// before. See CLAUDE.md -> "Cloudflare Turnstile" for activation steps.
//
// No npm package — Turnstile's own <script> + window.turnstile.render()
// is the documented integration for a single widget instance, and avoids
// adding a dependency for what's currently an inert feature.

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void; theme?: 'light' | 'dark' | 'auto' }
      ) => string;
      reset: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;
      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'error-callback': onExpire,
      });
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    const existing = document.querySelector(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`);
    window.onloadTurnstileCallback = renderWidget;
    if (!existing) {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [siteKey, onVerify, onExpire]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
