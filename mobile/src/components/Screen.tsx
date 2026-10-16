import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/theme';

type Props = {
  children: ReactNode;
  header?: ReactNode;
  /** Pinned below the scrolling content, e.g. a price and a Book button. */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  withTabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Scrollable page: an optional hero header, then padded content that clears the floating tab bar. */
export function Screen({ children, header, footer, refreshing, onRefresh, withTabBar = true, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = footer ? 28 : (withTabBar ? TAB_BAR_HEIGHT + TAB_BAR_GAP : 0) + insets.bottom + 28;
  const scroll = (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: bottom, paddingTop: header ? 0 : insets.top }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primaryDeep} />
        ) : undefined
      }
    >
      {header}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </ScrollView>
  );
  if (!footer) return scroll;
  return (
    <View style={styles.page}>
      {scroll}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerInner}>{footer}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, width: '100%', maxWidth: 640, alignSelf: 'center' },
  footer: {
    backgroundColor: colors.surface,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...shadow.raised,
  },
  footerInner: { width: '100%', maxWidth: 640, alignSelf: 'center' },
});
