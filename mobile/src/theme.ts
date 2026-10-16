// Design tokens. Light, soft, rounded — modelled on the reference design, with a deep blue
// brand colour and a soft orange accent.

export const colors = {
  primary: '#3346AC', // brand blue; pair with white text (8:1)
  primaryDeep: '#26348A', // darker blue for text and icons on light backgrounds
  primarySoft: '#E2E7F8',
  primaryTint: '#EEF1FC',
  sky: '#A8B6F0', // light blue for decoration on primary

  accent: '#F8A877', // soft orange; pair with ink text
  accentDeep: '#99460F', // text on accentSoft
  accentSoft: '#FFEEE2',

  danger: '#D6363C', // urgent, errors and badges; pair with white text
  dangerDeep: '#B3262E', // text on dangerSoft
  dangerSoft: '#FDE7E8',
  field: '#EFF1F7',

  ink: '#1A1F36',
  inkMuted: '#5B6178',
  inkFaint: '#868CA2',

  bg: '#F5F6FA',
  surface: '#FFFFFF',
  border: '#E4E7F0',
  white: '#FFFFFF',
} as const;

/** Ink or white, whichever contrasts more with a #RRGGBB background (anything else gets ink). */
export function textOn(background: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(background)) return colors.ink;
  const luminance = (hex: string) => {
    const [r, g, b] = (hex.slice(1).match(/../g) ?? []).map((c) => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bg = luminance(background);
  const contrast = (fg: string) => (Math.max(bg, luminance(fg)) + 0.05) / (Math.min(bg, luminance(fg)) + 0.05);
  return contrast(colors.white) > contrast(colors.ink) ? colors.white : colors.ink;
}

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  hero: 40,
  pill: 999,
} as const;

export const shadow = {
  card: { boxShadow: '0px 6px 18px rgba(26, 31, 54, 0.06)' },
  raised: { boxShadow: '0px 12px 32px rgba(26, 31, 54, 0.14)' },
} as const;

// Space the floating tab bar takes at the bottom of tab screens (bar + gap), before safe-area inset.
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_GAP = 12;
