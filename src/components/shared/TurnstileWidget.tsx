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
      remove: (widgetId: string) => void;
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

  // `onVerify`/`onExpire` are inline arrow functions on the caller's side
  // (SignQuote.tsx), so they get a new identity on every render. Reading
  // them through refs — updated on every render, but never part of the
  // render-effect's dependency array below — means the render effect can
  // depend on `siteKey` alone (effectively constant for the component's
  // lifetime) instead of re-running, and re-calling
  // `window.turnstile.render()` on the same container, every time
  // SignQuote re-renders (e.g. right after a token comes in and
  // `setTurnstileToken` fires). Cloudflare's own script rejects those
  // duplicate render() calls ("Turnstile has already been rendered in
  // this container"), confirmed in real production console output — this
  // is that call site becoming stable, not a workaround for the rejection
  // itself.
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let widgetId: string | undefined;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;
      // Wrapper closures, not onVerify/onExpire directly — these read the
      // ref at call time, so the single rendered widget instance always
      // invokes whichever callback is current, even though it was only
      // ever render()'d once.
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onVerifyRef.current(token),
        'error-callback': () => onExpireRef.current?.(),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`);
      window.onloadTurnstileCallback = renderWidget;
      if (!existing) {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
    }

    // Widget lifecycle cleanup — per Cloudflare's own Turnstile API, not a
    // workaround: if this component unmounts (e.g. the parent navigates
    // away from the signing page) while a widget is live, remove() tears
    // it down properly instead of leaking a rendered widget bound to a
    // container that's about to be detached from the DOM.
    return () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
