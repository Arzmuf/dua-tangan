import { Pressable, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { day, dayTime, rupiah, time } from '@/lib/format';
import { EXPENSE_CATEGORIES, kidsLabel, who } from '@/lib/labels';
import { useAction } from '@/lib/queries';
import type { Child, Expense, HandoffEvent } from '@/lib/types';
import { colors, radius } from '@/theme';

function RequestShell({
  emoji,
  tint,
  label,
  title,
  lines,
  primary,
  secondary,
  busy,
  onPress,
}: {
  emoji: string;
  tint: string;
  label: string;
  title: string;
  lines: string[];
  primary: { label: string; onPress: () => void };
  secondary: { label: string; onPress: () => void };
  busy: boolean;
  onPress?: () => void;
}) {
  // Only the summary opens the details: the action buttons must not sit inside another button.
  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the details"
        onPress={onPress}
        style={({ pressed }) => [styles.summary, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.head}>
          <View style={[styles.tile, { backgroundColor: tint }]}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color={colors.inkFaint}>
              {label}
            </Text>
            <Text variant="subheading">{title}</Text>
          </View>
        </View>
        {lines.map((line) => (
          <Text key={line} variant="small" color={colors.inkMuted}>
            {line}
          </Text>
        ))}
      </Pressable>
      <View style={styles.buttons}>
        <Button title={primary.label} size="sm" loading={busy} onPress={primary.onPress} style={{ flex: 1 }} />
        <Button title={secondary.label} size="sm" variant="outline" disabled={busy} onPress={secondary.onPress} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

export function PendingEventCard({ event, kids, onOpen }: { event: HandoffEvent; kids: Child[]; onOpen: () => void }) {
  const meId = useAuth().me?.user.id ?? 0;
  const act = useAction((path: string) => post<HandoffEvent>(`/events/${event.id}/${path}`), {
    success: (_, path) =>
      ({ confirm: 'Handoff confirmed', decline: 'Handoff declined', 'change/accept': 'Change accepted', 'change/decline': 'Change declined' })[path] ?? 'Done',
  });

  if (event.change && event.actions.respond_change) {
    const lines = [`${dayTime(event.starts_at)} → ${day(event.change.starts_at)} · ${time(event.change.starts_at)}`];
    if (event.change.reason) lines.push(`“${event.change.reason}”`);
    return (
      <RequestShell
        emoji="🔁"
        tint={colors.accentSoft}
        label="Schedule change"
        title={`${event.change.by.first_name} wants to move a handoff`}
        lines={lines}
        busy={act.isPending}
        onPress={onOpen}
        primary={{ label: 'Accept', onPress: () => act.mutate('change/accept') }}
        secondary={{ label: 'Keep original', onPress: () => act.mutate('change/decline') }}
      />
    );
  }

  return (
    <RequestShell
      emoji="📅"
      tint={colors.primarySoft}
      label="New handoff"
      title={`${event.created_by.first_name} proposed a handoff`}
      lines={[`${dayTime(event.starts_at)} · ${kidsLabel(kids)} to ${who(event.to_parent, meId)}`, event.location]}
      busy={act.isPending}
      onPress={onOpen}
      primary={{ label: 'Confirm', onPress: () => act.mutate('confirm') }}
      secondary={{ label: 'Decline', onPress: () => act.mutate('decline') }}
    />
  );
}

export function PendingExpenseCard({ expense, onOpen }: { expense: Expense; onOpen: () => void }) {
  const act = useAction((path: string) => post<Expense>(`/expenses/${expense.id}/${path}`), {
    success: (_, path) => (path === 'approve' ? 'Expense approved' : 'Expense declined'),
  });
  const cat = EXPENSE_CATEGORIES[expense.category];
  return (
    <RequestShell
      emoji={cat.emoji}
      tint={cat.tile}
      label="Expense"
      title={`${expense.created_by.first_name} added an expense`}
      lines={[`${expense.title} · ${rupiah(expense.amount)}`, `Your share: ${rupiah(expense.owed_amount)}`]}
      busy={act.isPending}
      onPress={onOpen}
      primary={{ label: 'Approve', onPress: () => act.mutate('approve') }}
      secondary={{ label: 'Decline', onPress: () => act.mutate('decline') }}
    />
  );
}

export function InviteCard({ code }: { code: string }) {
  const toast = useToast();
  const share = async () => {
    try {
      await Share.share({
        message: `Join me on Dua Tangan so we can plan handoffs and share costs for our child. Our family code is ${code}.`,
      });
    } catch {
      toast.show(`Your family code is ${code}`);
    }
  };
  return (
    <Card color={colors.primarySoft} style={styles.invite}>
      <Text variant="label" color={colors.primaryDeep}>
        Invite your co-parent
      </Text>
      <Text variant="body">Dua Tangan works when both of you are here. Share this code — they enter it after signing up.</Text>
      <View style={styles.codeBox}>
        <Text variant="display" style={styles.code}>
          {code}
        </Text>
      </View>
      <Button title="Share the code" icon="share-outline" onPress={share} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  summary: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  invite: { gap: 12, marginTop: 18 },
  codeBox: { backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  code: { letterSpacing: 6 },
});
