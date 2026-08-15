import { useEffect, useRef } from 'react';
import SignatureCanvasImport from 'react-signature-canvas';
import type SignatureCanvasInstance from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

// react-signature-canvas ships a UMD build whose CJS export is
// `{ __esModule: true, default: SignatureCanvas }`. Vite's dependency
// pre-bundler exposes that whole object as the default export instead of
// unwrapping it, so the plain default import resolves to an object, not
// the component class — unwrap the extra `.default` layer defensively.
const SignatureCanvas =
  (SignatureCanvasImport as unknown as { default?: typeof SignatureCanvasImport }).default ??
  SignatureCanvasImport;

// Simple visual signature-capture widget — CLAUDE.md scope guard: this is
// NOT a legally-binding e-signature flow. No timestamp/IP/consent-text/
// audit-trail capture, just a base64 PNG of the drawn stroke.
interface SignaturePadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export default function SignaturePad({ value, onChange }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvasInstance>(null);

  // `value` alone was previously only used for the "נחתם" text label below
  // — reopening a quote with an existing signature never actually drew it
  // onto the pad. Loads it in once the canvas is mounted, and again if a
  // different quote's signature is passed in later.
  useEffect(() => {
    const canvas = sigRef.current;
    if (!canvas) return;
    if (value) {
      canvas.fromDataURL(value);
    } else if (!canvas.isEmpty()) {
      canvas.clear();
    }
  }, [value]);

  const handleEnd = () => {
    const canvas = sigRef.current;
    if (!canvas || canvas.isEmpty()) {
      onChange(null);
      return;
    }
    onChange(canvas.getTrimmedCanvas().toDataURL('image/png'));
  };

  const handleClear = () => {
    sigRef.current?.clear();
    onChange(null);
  };

  return (
    <div className="bg-secondary border border-border rounded-xl p-3" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-semibold">חתימת לקוח</span>
        <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 h-7 px-2 text-xs">
          <Eraser className="w-3.5 h-3.5" />
          נקה חתימה
        </Button>
      </div>
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <SignatureCanvas
          ref={sigRef}
          penColor="black"
          canvasProps={{ className: 'w-full h-32' }}
          onEnd={handleEnd}
        />
      </div>
      {value && <p className="text-[11px] text-primary font-semibold mt-1.5">נחתם</p>}
    </div>
  );
}
