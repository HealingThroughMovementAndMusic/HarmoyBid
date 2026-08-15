import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PDFViewer } from '@react-pdf/renderer';
import QuoteDocument from '@/components/pdf/documents/QuoteDocument';
import { SAMPLE_QUOTES } from '@/components/pdf/sampleQuotes';

// Dev-only local preview loop for PDF document work: edit any component
// under src/components/pdf/, Vite HMR reloads this route, PDFViewer's
// iframe re-renders the new PDF automatically — no manual export/download
// step. Not linked from app navigation; reachable directly at the URL.
// Sample fixtures (sampleQuotes.ts) cover the RTL/bidi test matrix
// (mixed Hebrew+English, long names, long tables, signed state, etc.).
export default function PdfPreview() {
  const { type } = useParams<{ type?: string }>();
  const [selected, setSelected] = useState(type && type in SAMPLE_QUOTES ? type : 'clinic');
  const quote = SAMPLE_QUOTES[selected] ?? SAMPLE_QUOTES.clinic;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link to="/" style={{ fontSize: 13 }}>
          ← אפליקציה
        </Link>
        {Object.keys(SAMPLE_QUOTES).map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            style={{
              padding: '4px 10px',
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: selected === key ? '#111827' : '#fff',
              color: selected === key ? '#fff' : '#111827',
              cursor: 'pointer',
            }}
          >
            {key}
          </button>
        ))}
      </div>
      <PDFViewer style={{ flex: 1, width: '100%', border: 'none' }} showToolbar>
        <QuoteDocument quote={quote} signingUrl={`${window.location.origin}/sign/${quote.id}`} />
      </PDFViewer>
    </div>
  );
}
