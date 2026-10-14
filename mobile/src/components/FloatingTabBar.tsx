import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardVisible } from '@/lib/hooks';
import { useHome } from '@/lib/queries';
import { colors, radius, shadow, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/theme';
import { Text } from './Text';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  schedule: { label: 'Schedule', icon: 'calendar-outline', active: 'calendar' },
  messages: { label: 'Chat', icon: 'chatbubble-ellipses-outline', active: 'chatbubble-ellipses' },
  expenses: { label: 'Expenses', icon: 'wallet-outline', active: 'wallet' },
  child: { label: 'Child', icon: 'happy-outline', active: 'happy' },
};

/** Floating pill navigation. The active tab expands to show its label. */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const { data: home } = useHome();

  if (keyboardVisible) return null;

  const childName = home?.children[0]?.name;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_GAP }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const label = route.name === 'child' && childName ? childName : tab.label;
          const badge =
            route.name === 'messages'
              ? home?.unread_messages
              : route.name === 'index'
                ? (home?.pending_events.length ?? 0) + (home?.pending_expenses.length ?? 0)
                : 0;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={[styles.item, focused && styles.itemActive]}
            >
              <View>
                <Ionicons name={focused ? tab.active : tab.icon} size={22} color={focused ? colors.ink : colors.inkFaint} />
                {badge ? (
                  <View style={styles.badge}>
                    <Text variant="tiny" color={colors.white} style={styles.badgeText}>
                      {badge > 9 ? '9+' : badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              {focused ? (
                <Text variant="smallStrong" numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 480,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.raised,
  },
  item: {
    height: 50,
    minWidth: 50,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  itemActive: { backgroundColor: colors.primary, paddingHorizontal: 16 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
});
