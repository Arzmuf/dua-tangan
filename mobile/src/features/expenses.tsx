import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { del, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { groupDigits, parseAmount, plainDate, rupiah } from '@/lib/format';
import { EXPENSE_CATEGORIES, expenseStatus, who, Who } from '@/lib/labels';
import { useAction, useHome } from '@/lib/queries';
import type { Expense, ExpenseCategory } from '@/lib/types';
import { colors, radius } from '@/theme';
import { useLastShown } from '@/lib/hooks';
import { Fact } from './schedule';

export function ExpenseRow({ expense, onPress }: { expense: Expense; onPress: () => void }) {
  const meId = useAuth().me?.user.id ?? 0;
  const cat = EXPENSE_CATEGORIES[expense.category];
  const status = expenseStatus(expense, meId);
  return (
    <ListRow
      tile={cat.emoji}
      tileColor={cat.tile}
      title={expense.title}
      subtitle={`Paid by ${who(expense.paid_by, meId)} · ${plainDate(expense.spent_on)}`}
      meta={
        <View style={styles.rowMeta}>
          <Text variant="bodyStrong">{rupiah(expense.amount)}</Text>
          <Pill label={status.label} tone={status.tone} />
        </View>
      }
      onPress={onPress}
    />
  );
}

const SUCCESS: Record<string, string> = {
  approve: 'Expense approved',
  decline: 'Expense declined',
  settle: 'Marked as settled',
};

export function ExpenseSheet({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const meId = useAuth().me?.user.id ?? 0;
  const x = useLastShown(expense);

  const act = useAction((path: string) => post<Expense>(`/expenses/${x?.id}/${path}`), {
    success: (_, path) => SUCCESS[path],
    onDone: onClose,
  });
  const remove = useAction(() => del(`/expenses/${x?.id}`), { success: 'Expense withdrawn', onDone: onClose });

  if (!x) return null;
  const cat = EXPENSE_CATEGORIES[x.category];
  const status = expenseStatus(x, meId);
  const busy = act.isPending || remove.isPending;
  const iOwe = x.debtor?.id === meId;
  const payerName = Who(x.paid_by, meId);
  const otherName = x.debtor ? Who(x.debtor, meId) : 'Co-parent';

  return (
    <Sheet visible={!!expense} onClose={onClose} title={x.title} subtitle={`${cat.emoji} ${cat.label} · ${plainDate(x.spent_on)}`}>
      <View style={styles.amountBox}>
        <Text variant="label" color={colors.inkMuted}>
          Total
        </Text>
        <Text variant="display">{rupiah(x.amount)}</Text>
        <View style={styles.split}>
          <Text variant="small" color={colors.inkMuted}>
            {payerName} {x.payer_share}% · {otherName} {100 - x.payer_share}%
          </Text>
        </View>
      </View>
      <View style={styles.facts}>
        <Fact label="Status" value={<Pill label={status.label} tone={status.tone} />} />
        <Fact label="Paid by" value={payerName} />
        <Fact label={iOwe ? 'Your share' : `${otherName}'s share`} value={rupiah(x.owed_amount)} />
        <Fact label="Added by" value={Who(x.created_by, meId)} />
      </View>
      <View style={{ gap: 10 }}>
        {x.actions.approve ? (
          <Button title={x.owed_amount ? `Approve · your share ${rupiah(x.owed_amount)}` : 'Approve'} loading={busy} onPress={() => act.mutate('approve')} />
        ) : null}
        {x.actions.decline ? <Button title="Decline" variant="outline" disabled={busy} onPress={() => act.mutate('decline')} /> : null}
        {x.actions.settle ? (
          <Button
            title={iOwe ? `I've paid my share (${rupiah(x.owed_amount)})` : `I've received ${rupiah(x.owed_amount)}`}
            icon="checkmark-circle"
            loading={busy}
            onPress={() => act.mutate('settle')}
          />
        ) : null}
        {x.actions.delete ? <Button title="Withdraw expense" variant="danger" disabled={busy} onPress={() => remove.mutate()} /> : null}
      </View>
    </Sheet>
  );
}

const CATEGORY_OPTIONS = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((value) => ({
  value,
  label: `${EXPENSE_CATEGORIES[value].emoji} ${EXPENSE_CATEGORIES[value].label}`,
}));

export function NewExpenseSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The form lives inside the sheet, so it mounts empty every time the sheet opens.
  return (
    <Sheet visible={visible} onClose={onClose} title="Add an expense" subtitle="Your co-parent approves it before it counts.">
      <NewExpenseForm onSent={onClose} />
    </Sheet>
  );
}

function NewExpenseForm({ onSent }: { onSent: () => void }) {
  const { me } = useAuth();
  const { data: home } = useHome();
  const partner = home?.partner;

  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('school');
  const [paidBy, setPaidBy] = useState<'me' | 'partner'>('me');
  const [payerShare, setPayerShare] = useState(50);

  const amount = parseAmount(amountText);
  const payerName = paidBy === 'me' ? 'You' : (partner?.first_name ?? 'Co-parent');
  const otherName = paidBy === 'me' ? (partner?.first_name ?? 'Co-parent') : 'You';
  const payerPart = Math.floor((amount * payerShare) / 100);

  const create = useAction(
    () =>
      post<Expense>('/expenses', {
        title: title.trim(),
        category,
        amount,
        paid_by_id: paidBy === 'me' ? me?.user.id : partner?.id,
        payer_share: payerShare,
      }),
    { success: partner ? `Sent to ${partner.first_name} to approve` : 'Expense added', onDone: onSent },
  );

  const step = (delta: number) => setPayerShare((s) => Math.min(100, Math.max(0, s + delta)));

  return (
    <>
      <Field label="What was it for?" value={title} onChangeText={setTitle} placeholder="e.g. School shoes" />
      <Field
        label="Amount"
        prefix="Rp"
        value={groupDigits(amountText)}
        onChangeText={setAmountText}
        keyboardType="number-pad"
        placeholder="0"
      />
      <View style={{ gap: 8 }}>
        <Text variant="smallStrong" color={colors.inkMuted}>
          Category
        </Text>
        <Chips scroll value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
      </View>
      {partner ? (
        <View style={{ gap: 8 }}>
          <Text variant="smallStrong" color={colors.inkMuted}>
            Who paid?
          </Text>
          <Chips
            value={paidBy}
            onChange={setPaidBy}
            options={[
              { value: 'me', label: 'Me' },
              { value: 'partner', label: partner.first_name },
            ]}
          />
        </View>
      ) : null}
      <View style={styles.splitBox}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="smallStrong" color={colors.inkMuted}>
            Split
          </Text>
          <Text variant="bodyStrong">
            {payerName} {payerShare}% · {otherName} {100 - payerShare}%
          </Text>
          {amount ? (
            <Text variant="small" color={colors.inkMuted}>
              {payerName} {rupiah(payerPart)} · {otherName} {rupiah(amount - payerPart)}
            </Text>
          ) : null}
        </View>
        <Stepper icon="remove" label="Payer covers less" onPress={() => step(-10)} />
        <Stepper icon="add" label="Payer covers more" onPress={() => step(10)} />
      </View>
      <Chips
        value={payerShare === 50 ? '50' : payerShare === 100 ? '100' : null}
        onChange={(v) => setPayerShare(Number(v))}
        options={[
          { value: '50', label: '50 / 50' },
          { value: '100', label: paidBy === 'me' ? 'I cover it all' : `${payerName} covers it all` },
        ]}
      />
      <Button
        title={amount ? `Add ${rupiah(amount)}` : 'Add expense'}
        disabled={!title.trim() || !amount}
        loading={create.isPending}
        onPress={() => create.mutate()}
      />
    </>
  );
}

function Stepper({ icon, onPress, label }: { icon: 'add' | 'remove'; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.stepper, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={colors.primaryDeep} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  amountBox: { alignItems: 'center', paddingVertical: 8, gap: 2 },
  split: { marginTop: 4 },
  facts: { backgroundColor: colors.field, borderRadius: radius.lg, padding: 16, gap: 12 },
  splitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.field,
    borderRadius: radius.lg,
    padding: 14,
  },
  stepper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
