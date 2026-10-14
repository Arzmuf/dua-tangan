// Design tokens. Light, soft, rounded — modelled on the reference design, with the
// prototype's turquoise kept as the brand colour.

export const colors = {
  primary: '#7EBBA8', // brand turquoise from the prototype; pair with ink text
  primaryDeep: '#3F7F6E', // same hue, dark enough for white text/icons (4.7:1)
  primarySoft: '#DDEFE9',
  primaryTint: '#EEF7F4',

  pink: '#EF5F7E',
  pinkDeep: '#B83A57', // text on pinkSoft
  pinkSoft: '#FFE4EA',
  yellow: '#FED06B',
  yellowDeep: '#7A5500', // text on yellowSoft
  yellowSoft: '#FFF3D6',
  mint: '#BFE3D8',
  field: '#F1F4F3',

  ink: '#1D2B28',
  inkMuted: '#5F6F6B',
  inkFaint: '#97A3A0',

  bg: '#F6F7F6',
  surface: '#FFFFFF',
  border: '#E7ECEA',
  white: '#FFFFFF',
} as const;

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
  card: { boxShadow: '0px 6px 18px rgba(29, 43, 40, 0.06)' },
  raised: { boxShadow: '0px 12px 32px rgba(29, 43, 40, 0.14)' },
} as const;

// Space the floating tab bar takes at the bottom of tab screens (bar + gap), before safe-area inset.
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_GAP = 12;
