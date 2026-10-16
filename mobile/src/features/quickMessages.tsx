import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { del, post } from '@/lib/api';
import { useAction, useTemplates } from '@/lib/queries';
import type { MessageTemplate, TemplateCategory } from '@/lib/types';
import { colors, radius } from '@/theme';

type Category = { key: TemplateCategory; emoji: string; title: string; builtIn: string[] };

// {child} and {partner} are filled in when a template is used; "…" marks a gap to complete.
const CATEGORIES: Category[] = [
  {
    key: 'health',
    emoji: '🩺',
    title: 'Health update',
    builtIn: [
      'Health update: {child} is doing well today, eating and sleeping fine.',
      'Health update: {child} is sick today (…). I’ll keep an eye on it and let you know how it goes.',
      '{child} has a fever of … °C. Medicine given at ….',
      '{child} is feeling much better now.',
      '{child} has a doctor’s appointment on … at ….',
    ],
  },
  {
    key: 'schedule',
    emoji: '📅',
    title: 'Schedule',
    builtIn: [
      'Hi {partner}, could we look at the handoff on …?',
      'Running about 15 minutes late, sorry. On my way.',
      'I’ve arrived at the meeting place.',
    ],
  },
  {
    key: 'expenses',
    emoji: '💸',
    title: 'Expenses',
    builtIn: [
      'I added an expense for {child}. Could you take a look when you have a moment?',
      'I’ve paid my share for …. Thanks!',
    ],
  },
  {
    key: 'check-in',
    emoji: '👋',
    title: 'Check-in',
    builtIn: ['Hi {partner}, just checking in. How was {child}’s day?', '{child} had a great day today 😊'],
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (text: string) => void;
  partnerName: string;
  childName: string;
};

export function QuickMessagesSheet({ visible, onClose, ...rest }: Props) {
  // The steps live inside the sheet, so it reopens on the category list every time.
  return (
    <Sheet visible={visible} onClose={onClose} title="Quick messages" subtitle="Start from a calm, clear template.">
      <QuickMessages {...rest} />
    </Sheet>
  );
}

type Step = { view: 'categories' } | { view: 'list' | 'add'; category: Category };

function QuickMessages({ onPick, partnerName, childName }: Omit<Props, 'visible' | 'onClose'>) {
  const [step, setStep] = useState<Step>({ view: 'categories' });
  const { data: mine = [] } = useTemplates();
  const fill = (text: string) => text.replaceAll('{child}', childName).replaceAll('{partner}', partnerName);
  const ownIn = (key: TemplateCategory) => mine.filter((t) => t.category === key);

  if (step.view === 'categories') {
    return (
      <View style={styles.list}>
        {CATEGORIES.map((c) => {
          const count = c.builtIn.length + ownIn(c.key).length;
          return (
            <ListRow
              key={c.key}
              tile={c.emoji}
              title={c.title}
              subtitle={`${count} template${count === 1 ? '' : 's'}`}
              onPress={() => setStep({ view: 'list', category: c })}
            />
          );
        })}
      </View>
    );
  }

  const back = (
    <Pressable accessibilityRole="button" onPress={() => setStep({ view: 'categories' })} style={styles.back}>
      <Ionicons name="chevron-back" size={18} color={colors.primaryDeep} />
      <Text variant="smallStrong" color={colors.primaryDeep}>
        {step.category.emoji} {step.category.title}
      </Text>
    </Pressable>
  );

  if (step.view === 'add') {
    return (
      <>
        {back}
        <AddTemplateForm category={step.category.key} onSaved={(key) => setStep({ view: 'list', category: byKey(key) })} />
      </>
    );
  }

  return (
    <>
      {back}
      <View style={styles.list}>
        {step.category.builtIn.map((text) => (
          <TemplateRow key={text} text={fill(text)} onPress={() => onPick(fill(text))} />
        ))}
        {ownIn(step.category.key).map((t) => (
          <TemplateRow key={t.id} text={t.body} own={t} onPress={() => onPick(t.body)} />
        ))}
      </View>
      <Button title="Add template" icon="add" variant="soft" onPress={() => setStep({ view: 'add', category: step.category })} />
    </>
  );
}

const byKey = (key: TemplateCategory) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];

function TemplateRow({ text, own, onPress }: { text: string; own?: MessageTemplate; onPress: () => void }) {
  const remove = useAction(() => del(`/messages/templates/${own?.id}`), { success: 'Template removed' });
  // The delete button sits over the row rather than inside it: a button can't contain another button.
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.template, pressed && { opacity: 0.8 }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="small">{text}</Text>
          {own ? <Pill label="Yours" tone="info" /> : null}
        </View>
        {own ? <View style={{ width: 36 }} /> : <Ionicons name="arrow-forward" size={18} color={colors.inkFaint} />}
      </Pressable>
      {own ? (
        <View style={styles.over}>
          <IconButton icon="trash-outline" label="Delete template" color={colors.dangerDeep} background={colors.surface} size={36} onPress={() => remove.mutate()} />
        </View>
      ) : null}
    </View>
  );
}

function AddTemplateForm({ category, onSaved }: { category: TemplateCategory; onSaved: (category: TemplateCategory) => void }) {
  const [body, setBody] = useState('');
  const [key, setKey] = useState(category);
  const save = useAction(() => post<MessageTemplate>('/messages/templates', { category: key, body: body.trim() }), {
    success: 'Template saved',
    onDone: () => onSaved(key),
  });
  return (
    <>
      <Field
        label="Your template"
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="e.g. She took her medicine at …"
        hint="Only you see your templates."
      />
      <Chips scroll value={key} onChange={setKey} options={CATEGORIES.map((c) => ({ value: c.key, label: `${c.emoji} ${c.title}` }))} />
      <Button title="Save template" disabled={!body.trim()} loading={save.isPending} onPress={() => save.mutate()} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  template: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.field, borderRadius: radius.lg, padding: 14 },
  over: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
});
