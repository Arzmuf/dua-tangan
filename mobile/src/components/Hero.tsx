import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow } from '@/theme';
import { IconButton } from './Button';
import { Text } from './Text';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  color?: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  decor?: boolean | 'top';
  fab?: { icon: IconName; onPress: () => void; label: string };
};

/** Rounded coloured header from the reference design, with an optional floating action button
 *  that overlaps its bottom edge. */
export function Hero({ color = colors.primary, title, subtitle, onBack, left, right, children, decor, fab }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { backgroundColor: color, paddingTop: insets.top + 14 }]}>
      {decor ? <Decor placement={decor === 'top' ? 'top' : 'bottom'} /> : null}
      {onBack || left || right ? (
        <View style={styles.topRow}>
          {onBack ? <IconButton icon="chevron-back" label="Back" onPress={onBack} /> : (left ?? <View />)}
          {right ?? <View />}
        </View>
      ) : null}
      {title ? (
        <Text variant="title" style={[styles.title, !!decor && styles.besideDecor]}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text variant="body" color={colors.ink} style={[styles.subtitle, !!decor && styles.besideDecor]}>
          {subtitle}
        </Text>
      ) : null}
      {children}
      {fab ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fab.label}
          onPress={fab.onPress}
          style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name={fab.icon} size={26} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The circles from the reference header, clipped to the hero's rounded corners. `top` keeps them
 *  in the upper-right corner, for heroes whose text runs the full height. */
export function Decor({ placement = 'bottom' }: { placement?: 'bottom' | 'top' }) {
  const top = placement === 'top';
  return (
    <View pointerEvents="none" style={styles.decor}>
      <View style={[styles.circle, top ? styles.ringTop : styles.ring]} />
      <View style={[styles.circle, top ? styles.ringCoreTop : styles.ringCore]} />
      <View style={[styles.circle, top ? styles.sunTop : styles.sun]} />
      <View style={[styles.circle, top ? styles.mintTop : styles.mint]} />
      <View style={[styles.circle, top ? styles.dotTop : styles.dot]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 34,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    marginBottom: 8,
    zIndex: 2,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { maxWidth: '78%' },
  subtitle: { marginTop: 6, maxWidth: '80%', opacity: 0.8 },
  besideDecor: { maxWidth: '55%' },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: -24,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  decor: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
  },
  circle: { position: 'absolute', borderRadius: 999 },
  ring: { right: -64, bottom: -70, width: 210, height: 210, borderWidth: 30, borderColor: colors.white },
  ringCore: { right: -14, bottom: -20, width: 110, height: 110, backgroundColor: colors.primaryDeep },
  // Everything stays in the right ~40% so it never runs into the header text.
  sun: { right: 84, bottom: 92, width: 64, height: 64, backgroundColor: colors.yellow },
  mint: { right: 154, bottom: 128, width: 30, height: 30, backgroundColor: colors.mint },
  dot: { right: 126, bottom: 22, width: 24, height: 24, backgroundColor: colors.pink },
  ringTop: { right: -76, top: -86, width: 210, height: 210, borderWidth: 30, borderColor: colors.white },
  ringCoreTop: { right: -26, top: -36, width: 110, height: 110, backgroundColor: colors.primaryDeep },
  sunTop: { right: 104, top: 72, width: 52, height: 52, backgroundColor: colors.yellow },
  mintTop: { right: 140, top: 22, width: 32, height: 32, backgroundColor: colors.mint },
  dotTop: { right: 36, top: 150, width: 22, height: 22, backgroundColor: colors.pink },
});
