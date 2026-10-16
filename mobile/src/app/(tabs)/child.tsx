import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState, Loading } from '@/components/Bits';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Hero } from '@/components/Hero';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text, TextColorProvider } from '@/components/Text';
import { del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { age, day } from '@/lib/format';
import { useLastShown, useRefreshOnFocus } from '@/lib/hooks';
import { INFO_CATEGORIES, who } from '@/lib/labels';
import { useAction, useHome, useInfo } from '@/lib/queries';
import type { InfoCategory, InfoItem } from '@/lib/types';
import { colors, radius, textOn } from '@/theme';

const CATEGORIES = Object.keys(INFO_CATEGORIES) as InfoCategory[];

const phoneOf = (value: string) => {
  const digits = value.replace(/[^\d+]/g, '');
  return /\d{8,}/.test(digits.replace('+', '')) && !value.includes('x') ? digits : null;
};

export default function ChildScreen() {
  const meId = useAuth().me?.user.id ?? 0;
  const { data: home } = useHome();
  const children = home?.children ?? [];
  const [childId, setChildId] = useState<number | null>(null);
  const child = children.find((c) => c.id === childId) ?? children[0];

  const { data: items, refetch, isRefetching, isLoading } = useInfo(child?.id);
  useRefreshOnFocus(refetch);
  const [category, setCategory] = useState<InfoCategory>('health');
  const [editing, setEditing] = useState<InfoItem | 'new' | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items ?? []) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [items]);
  const visible = (items ?? []).filter((i) => i.category === category);

  return (
    <>
      <Screen
        refreshing={isRefetching}
        onRefresh={refetch}
        header={
          <Hero color={colors.accent}>
            <View style={styles.profile}>
              <View style={styles.profileDecor} pointerEvents="none">
                <View style={[styles.circle, styles.ring]} />
                <View style={[styles.circle, styles.core]} />
                <View style={[styles.circle, styles.sun]} />
                <View style={[styles.circle, styles.dot]} />
              </View>
              <View style={styles.face}>
                <Text style={{ fontSize: 30, lineHeight: 38 }}>🧒</Text>
              </View>
              <TextColorProvider value={textOn(colors.primary)}>
                <Text variant="display">{child?.name ?? 'Your child'}</Text>
                <Text variant="small">{age(child?.birth_date ?? null) ?? 'Shared by both parents'}</Text>
              </TextColorProvider>
            </View>
          </Hero>
        }
      >
        {children.length > 1 ? (
          <View style={{ marginTop: 16 }}>
            <Chips
              scroll
              value={String(child?.id)}
              onChange={(v) => setChildId(Number(v))}
              options={children.map((c) => ({ value: String(c.id), label: c.name }))}
            />
          </View>
        ) : null}

        <Text variant="heading" style={styles.heading}>
          What both of you should know
        </Text>
        <Chips
          scroll
          size="lg"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({
            value: c,
            label: `${INFO_CATEGORIES[c].emoji} ${INFO_CATEGORIES[c].label}${counts[c] ? ` · ${counts[c]}` : ''}`,
          }))}
        />

        <View style={styles.list}>
          {isLoading ? (
            <View style={{ height: 160 }}>
              <Loading />
            </View>
          ) : visible.length === 0 ? (
            <EmptyState
              emoji={INFO_CATEGORIES[category].emoji}
              title={`No ${INFO_CATEGORIES[category].label.toLowerCase()} details yet`}
              text="Add what the other parent might need — it stays in sync for both of you."
            />
          ) : (
            visible.map((item) => {
              const phone = item.category === 'contacts' ? phoneOf(item.value) : null;
              return (
                <Card key={item.id} style={styles.item}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Edit this detail"
                    onPress={() => setEditing(item)}
                    style={({ pressed }) => [{ flex: 1, gap: 2 }, pressed && { opacity: 0.7 }]}
                  >
                    <Text variant="small" color={colors.inkMuted}>
                      {item.label}
                    </Text>
                    <Text variant="bodyStrong">{item.value}</Text>
                    {item.updated_by ? (
                      <Text variant="tiny" color={colors.inkFaint}>
                        Updated by {who(item.updated_by, meId)} · {day(item.updated_at)}
                      </Text>
                    ) : null}
                  </Pressable>
                  {phone ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${item.label}`}
                      onPress={() => Linking.openURL(`tel:${phone}`)}
                      style={styles.call}
                    >
                      <Ionicons name="call" size={18} color={colors.white} />
                    </Pressable>
                  ) : null}
                </Card>
              );
            })
          )}
          <Button title={`Add ${INFO_CATEGORIES[category].label.toLowerCase()} detail`} icon="add" variant="soft" onPress={() => setEditing('new')} />
        </View>
      </Screen>
      {child ? (
        <InfoSheet
          editing={editing}
          childId={child.id}
          childName={child.name}
          defaultCategory={category}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function InfoSheet({
  editing,
  childId,
  childName,
  defaultCategory,
  onClose,
}: {
  editing: InfoItem | 'new' | null;
  childId: number;
  childName: string;
  defaultCategory: InfoCategory;
  onClose: () => void;
}) {
  const current = useLastShown(editing);
  const item = current && current !== 'new' ? current : null;

  return (
    <Sheet
      visible={!!editing}
      onClose={onClose}
      title={item ? 'Edit detail' : `Add to ${childName}’s info`}
      subtitle="Both parents see changes right away, and they’re noted in the record."
    >
      <InfoForm key={item?.id ?? 'new'} item={item} childId={childId} defaultCategory={defaultCategory} onDone={onClose} />
    </Sheet>
  );
}

function InfoForm({
  item,
  childId,
  defaultCategory,
  onDone,
}: {
  item: InfoItem | null;
  childId: number;
  defaultCategory: InfoCategory;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<InfoCategory>(item?.category ?? defaultCategory);
  const [label, setLabel] = useState(item?.label ?? '');
  const [value, setValue] = useState(item?.value ?? '');

  const save = useAction(
    () =>
      item
        ? patch<InfoItem>(`/info/${item.id}`, { category, label: label.trim(), value: value.trim() })
        : post<InfoItem>(`/children/${childId}/info`, { category, label: label.trim(), value: value.trim() }),
    { success: item ? 'Detail updated' : 'Detail added', onDone },
  );
  const remove = useAction(() => del(`/info/${item?.id}`), { success: 'Detail removed', onDone });
  const meta = INFO_CATEGORIES[category];

  return (
    <>
      <Chips
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c, label: INFO_CATEGORIES[c].label }))}
      />
      <Field label="Label" value={label} onChangeText={setLabel} placeholder={meta.labelHint} />
      <Field label="Detail" value={value} onChangeText={setValue} placeholder={meta.valueHint} multiline />
      <Button
        title={item ? 'Save changes' : 'Add detail'}
        disabled={!label.trim() || !value.trim()}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
      {item ? <Button title="Remove" variant="danger" loading={remove.isPending} onPress={() => remove.mutate()} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  profile: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 22,
    gap: 2,
    overflow: 'hidden',
  },
  profileDecor: { ...StyleSheet.absoluteFill },
  circle: { position: 'absolute', borderRadius: 999 },
  ring: { right: -40, bottom: -46, width: 150, height: 150, borderWidth: 22, borderColor: colors.white },
  core: { right: -6, bottom: -12, width: 82, height: 82, backgroundColor: colors.primaryDeep },
  sun: { right: 70, top: 18, width: 34, height: 34, backgroundColor: colors.accent },
  dot: { right: 118, bottom: 26, width: 18, height: 18, backgroundColor: colors.sky },
  face: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heading: { marginTop: 24, marginBottom: 12 },
  list: { gap: 12, marginTop: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  call: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
