import { Font } from '@react-pdf/renderer';
import heeboRegular from '@/assets/fonts/Heebo-Regular.ttf';
import heeboMedium from '@/assets/fonts/Heebo-Medium.ttf';
import heeboSemiBold from '@/assets/fonts/Heebo-SemiBold.ttf';
import heeboBold from '@/assets/fonts/Heebo-Bold.ttf';

// Locally bundled static weight instances (Vite-imported, same pattern as
// the business logo import) — replaces the previous runtime fetch from
// raw.githubusercontent.com, which silently fell back to Helvetica (no
// Hebrew glyphs at all) on any network failure. Real distinct static
// files per weight also fix bold text not actually rendering bold, which
// the old single-variable-file-at-two-weights registration couldn't do.
let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  Font.register({
    family: 'Heebo',
    fonts: [
      { src: heeboRegular, fontWeight: 400 },
      { src: heeboMedium, fontWeight: 500 },
      { src: heeboSemiBold, fontWeight: 600 },
      { src: heeboBold, fontWeight: 700 },
    ],
  });
  registered = true;
}
