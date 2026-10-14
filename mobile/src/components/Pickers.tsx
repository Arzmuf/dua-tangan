import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MONTHS_LONG, sameDay } from '@/lib/format';
import { colors, radius } from '@/theme';
import { Text } from './Text';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Month grid date picker. Days before `minDate` are disabled. */
export function CalendarPicker({
  value,
  onChange,
  minDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  minDate?: Date;
}) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const today = new Date();
  const min = minDate ? startOfDay(minDate) : null;

  const cells = useMemo(() => {
    const offset = (month.getDay() + 6) % 7; // Monday first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const list: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) list.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (list.length % 7) list.push(null);
    return list;
  }, [month]);

  const canGoBack = !min || new Date(month.getFullYear(), month.getMonth(), 0) >= min;

  return (
    <View style={styles.calendar}>
      <View style={styles.calHead}>
        <Pressable
          accessibilityLabel="Previous month"
          disabled={!canGoBack}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          style={[styles.navBtn, !canGoBack && { opacity: 0.3 }]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Text variant="subheading">
          {MONTHS_LONG[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable
          accessibilityLabel="Next month"
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <Text key={w} variant="tiny" color={colors.inkFaint} style={styles.cellText} center>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const disabled = !!min && d < min;
          const selected = sameDay(d, value);
          const isToday = sameDay(d, today);
          return (
            <Pressable
              key={d.toISOString()}
              disabled={disabled}
              accessibilityLabel={`${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`}
              accessibilityState={{ selected, disabled }}
              onPress={() => onChange(d)}
              style={styles.cell}
            >
              <View style={[styles.day, isToday && styles.today, selected && styles.selectedDay]}>
                <Text
                  variant="smallStrong"
                  color={selected ? colors.white : disabled ? colors.border : colors.ink}
                >
                  {d.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type ClockTime = { h: number; m: number };

const SLOTS: ClockTime[] = [];
for (let h = 6; h <= 21; h++) {
  SLOTS.push({ h, m: 0 }, { h, m: 30 });
}
const label = (t: ClockTime) => `${t.h < 10 ? '0' : ''}${t.h}:${t.m === 0 ? '00' : '30'}`;

/** Horizontal list of half-hour slots between 06:00 and 21:30. */
export function TimePicker({ value, onChange }: { value: ClockTime; onChange: (t: ClockTime) => void }) {
  const ref = useRef<ScrollView>(null);
  const index = SLOTS.findIndex((s) => s.h === value.h && s.m === value.m);

  useEffect(() => {
    if (index > 2) ref.current?.scrollTo({ x: (index - 2) * 78, animated: false });
    // Only on mount: keep the user's scroll position afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>
      {SLOTS.map((s, i) => {
        const selected = i === index;
        return (
          <Pressable
            key={label(s)}
            accessibilityState={{ selected }}
            onPress={() => onChange(s)}
            style={[styles.slot, selected ? styles.slotOn : styles.slotOff]}
          >
            <Text variant="smallStrong" color={selected ? colors.white : colors.primaryDeep}>
              {label(s)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  calendar: { backgroundColor: colors.field, borderRadius: radius.lg, padding: 12 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  week: { flexDirection: 'row', marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1.15, alignItems: 'center', justifyContent: 'center' },
  cellText: { width: `${100 / 7}%` },
  day: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: colors.primary },
  selectedDay: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  slots: { gap: 8, paddingVertical: 2 },
  slot: { width: 70, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  slotOn: { backgroundColor: colors.primaryDeep },
  slotOff: { backgroundColor: colors.primarySoft },
});
