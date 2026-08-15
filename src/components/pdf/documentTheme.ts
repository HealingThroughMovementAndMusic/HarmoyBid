// Resolved literal values for @react-pdf/renderer's StyleSheet — a manual
// snapshot of src/index.css's HSL custom-property tokens (brand
// primary/accent hues), not a live bridge. @react-pdf/renderer has its
// own layout engine (Yoga) with no CSS runtime, so it cannot read CSS
// custom properties or Tailwind classes. If the app's token values ever
// change, update this file to match — there is no automatic sync.
export const documentTheme = {
  colors: {
    brandDark: '#3F6350',
    brandLight: '#EAF2EC',
    brandBorder: '#BFDBC9',
    text: '#2B2B2B',
    muted: '#6b7280',
    warning: '#b45309',
    white: '#ffffff',
  },
  spacing: {
    page: 32,
    card: 16,
    section: 16,
  },
  radius: {
    card: 8,
    box: 6,
    badge: 999,
  },
  fontFamily: 'Heebo',
} as const;
