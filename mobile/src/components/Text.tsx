import { Platform, Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme';

const variants = StyleSheet.create({
  display: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 15 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }),
    fontSize: 11,
    lineHeight: 15,
  },
});

export type TextVariant = keyof typeof variants;

type Props = TextProps & { variant?: TextVariant; color?: string; center?: boolean };

export function Text({ variant = 'body', color = colors.ink, center, style, ...rest }: Props) {
  return <RNText style={[variants[variant], { color }, center && { textAlign: 'center' }, style]} {...rest} />;
}
