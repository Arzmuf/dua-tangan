import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, EmptyState } from '@/components/Bits';
import { Button, IconButton } from '@/components/Button';
import { ListRow } from '@/components/ListRow';
import { Pill } from '@/components/Pill';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { InviteCard } from '@/features/requests';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relativeDay, sameDay, time } from '@/lib/format';
import { useKeyboardVisible } from '@/lib/hooks';
import { kidsLabel } from '@/lib/labels';
import { keys, useAction, useHome, useMessages } from '@/lib/queries';
import type { Message, ToneResult } from '@/lib/types';
import { colors, fonts, radius, shadow, TAB_BAR_GAP, TAB_BAR_HEIGHT, textOn } from '@/theme';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const { data: home } = useHome();
  const queryClient = useQueryClient();
  const keyboardVisible = useKeyboardVisible();

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { data: messages } = useMessages(focused);

  // Mark the co-parent's messages as read while this screen is open.
  const unread = (messages ?? []).filter((m) => !m.mine && !m.read_at).map((m) => m.id).join(',');
  useEffect(() => {
    if (!focused || !unread) return;
    post('/messages/read')
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: keys.home });
        void queryClient.invalidateQueries({ queryKey: keys.messages });
      })
      .catch(() => {});
  }, [focused, unread, queryClient]);

  // Stay pinned to the newest message unless the user scrolled up to read history.
  const scroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
  };

  const partner = home?.partner;
  const composerBottom = keyboardVisible ? 8 : TAB_BAR_HEIGHT + TAB_BAR_GAP + insets.bottom + 10;

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Avatar name={partner?.name ?? '?'} size={46} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{partner ? partner.first_name : 'Messages'}</Text>
          <Text variant="small" color={colors.inkMuted} numberOfLines={1}>
            About {kidsLabel(home?.children)} · kept in your shared record
          </Text>
        </View>
        <IconButton icon="shield-checkmark-outline" label="Shared record" background={colors.primarySoft} onPress={() => router.push('/record')} />
      </View>

      {home && !partner ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: composerBottom }}>
          <EmptyState emoji="💬" title="Chat opens when your co-parent joins" text="Share your family code and you can start talking here." />
          {me?.family ? <InviteCard code={me.family.invite_code} /> : null}
        </ScrollView>
      ) : (
        // Android draws edge-to-edge, so the window no longer shrinks for the keyboard: pad on both.
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={styles.thread}
            onScroll={onScroll}
            scrollEventThrottle={64}
            onContentSizeChange={() => {
              if (nearBottom.current) scroll.current?.scrollToEnd({ animated: false });
            }}
            keyboardShouldPersistTaps="handled"
          >
            {messages && messages.length === 0 ? (
              <EmptyState emoji="👋" title="Say hello" text="Keep it short and about the kids — the tone check helps keep it calm." />
            ) : null}
            {(messages ?? []).map((m, i, all) => (
              <View key={m.id}>
                {i === 0 || !sameDay(new Date(all[i - 1].created_at), new Date(m.created_at)) ? (
                  <Text variant="tiny" color={colors.inkFaint} center style={styles.day}>
                    {relativeDay(m.created_at)}
                  </Text>
                ) : null}
                <Bubble message={m} />
              </View>
            ))}
          </ScrollView>
          <Composer
            partnerName={partner?.first_name ?? 'your co-parent'}
            childName={home?.children[0]?.name ?? 'our child'}
            style={{ marginBottom: composerBottom }}
            onSent={() => {
              nearBottom.current = true;
            }}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Bubble({ message: m }: { message: Message }) {
  return (
    <View style={[styles.row, m.mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs, m.is_urgent && styles.urgent]}>
        {m.is_urgent ? (
          <Text variant="label" color={m.mine ? colors.dangerSoft : colors.dangerDeep}>
            Urgent
          </Text>
        ) : null}
        <Text variant="body" color={m.mine ? textOn(colors.primary) : colors.ink}>
          {m.body}
        </Text>
      </View>
      <View style={[styles.meta, m.mine && { justifyContent: 'flex-end' }]}>
        <Text variant="tiny" color={colors.inkFaint}>
          {time(m.created_at)}
          {m.mine && m.read_at ? ' · Read' : ''}
        </Text>
        {m.tone === 'heated' ? <Pill label="May read as heated" tone="warn" /> : null}
      </View>
    </View>
  );
}

const templates = (partner: string, child: string) => [
  { emoji: '🩺', title: 'Health update', text: `Health update: ${child} is doing well today. ` },
  { emoji: '📅', title: 'Schedule question', text: `Hi ${partner}, could we look at the handoff on ` },
  { emoji: '💸', title: 'Expense', text: `I added an expense for ${child} — could you take a look when you have a moment?` },
  { emoji: '👋', title: 'Check-in', text: `Hi ${partner}, just checking in — how was ${child}'s day?` },
];

function Composer({
  partnerName,
  childName,
  style,
  onSent,
}: {
  partnerName: string;
  childName: string;
  style: object;
  onSent: () => void;
}) {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  // Each tone result remembers the text it was computed for, so stale results are simply ignored.
  const [tone, setTone] = useState<(ToneResult & { body: string }) | null>(null);
  // "Send anyway" applies to exactly the text that was flagged; editing it asks again.
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const body = text.trim();
  const confirmHeated = confirmedFor === body;

  // Check the tone shortly after typing stops.
  useEffect(() => {
    if (body.length < 3) return;
    const t = setTimeout(() => {
      post<ToneResult>('/messages/tone', { body })
        .then((r) => setTone({ ...r, body }))
        .catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [body]);

  const send = useAction(() => post<Message>('/messages', { body, is_urgent: urgent }), {
    onDone: () => {
      setText('');
      setUrgent(false);
      setTone(null);
      setConfirmedFor(null);
      onSent();
    },
  });

  const onSend = async () => {
    if (!body || send.isPending) return;
    let current = tone;
    if (!current || current.body !== body) {
      // Sent before the debounced check finished: check now.
      try {
        current = { ...(await post<ToneResult>('/messages/tone', { body })), body };
        setTone(current);
      } catch {
        current = null;
      }
    }
    if (current?.tone === 'heated' && !confirmHeated) {
      setConfirmedFor(body);
      return;
    }
    send.mutate();
  };

  const heated = tone?.tone === 'heated' && tone.body === body;

  return (
    <View style={[styles.composerWrap, style]}>
      {heated ? (
        <View style={styles.toneBox}>
          <View style={styles.toneHead}>
            <Ionicons name="alert-circle" size={18} color={colors.dangerDeep} />
            <Text variant="smallStrong" color={colors.dangerDeep}>
              This may read as heated
            </Text>
          </View>
          {tone?.tip ? (
            <Text variant="small" color={colors.ink}>
              {tone.tip}
            </Text>
          ) : null}
          {tone?.flags.length ? (
            <Text variant="tiny" color={colors.inkMuted}>
              Flagged: {tone.flags.map((f) => `“${f}”`).join(', ')}
            </Text>
          ) : null}
          {confirmHeated ? (
            <View style={styles.toneActions}>
              <Text variant="tiny" color={colors.inkMuted} style={{ flex: 1 }}>
                It will be marked as heated in your shared record.
              </Text>
              <Button title="Send anyway" size="sm" variant="danger" loading={send.isPending} onPress={() => send.mutate()} />
            </View>
          ) : null}
        </View>
      ) : body.length >= 3 && tone?.body === body ? (
        <View style={styles.calm}>
          <Ionicons name="checkmark-circle" size={15} color={colors.primaryDeep} />
          <Text variant="tiny" color={colors.primaryDeep}>
            Reads calm and clear
          </Text>
        </View>
      ) : null}

      <View style={styles.composer}>
        <IconButton icon="add" label="Message templates" background={colors.field} size={40} onPress={() => setShowTemplates(true)} />
        <View style={styles.inputBox}>
          {urgent ? (
            <View style={{ marginBottom: 4 }}>
              <Pill label="Urgent" tone="warn" />
            </View>
          ) : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`Message ${partnerName}…`}
            placeholderTextColor={colors.inkFaint}
            multiline
            style={styles.input}
          />
        </View>
        <IconButton
          icon={urgent ? 'flag' : 'flag-outline'}
          label={urgent ? 'Unmark urgent' : 'Mark as urgent'}
          color={urgent ? colors.dangerDeep : colors.inkMuted}
          background={urgent ? colors.dangerSoft : colors.field}
          size={40}
          onPress={() => setUrgent((u) => !u)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={!body || send.isPending}
          onPress={onSend}
          style={({ pressed }) => [styles.send, (!body || send.isPending) && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="arrow-up" size={22} color={colors.white} />
        </Pressable>
      </View>

      <Sheet visible={showTemplates} onClose={() => setShowTemplates(false)} title="Quick messages" subtitle="Start from a calm, clear template.">
        {templates(partnerName, childName).map((t) => (
          <ListRow
            key={t.title}
            tile={t.emoji}
            title={t.title}
            subtitle={t.text}
            onPress={() => {
              setText(t.text);
              setShowTemplates(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow.card,
    zIndex: 2,
  },
  thread: { padding: 16, paddingTop: 20, gap: 4, width: '100%', maxWidth: 680, alignSelf: 'center' },
  day: { marginVertical: 10 },
  row: { maxWidth: '82%', marginVertical: 3, gap: 4 },
  rowMine: { alignSelf: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 2 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadow.card },
  urgent: { borderWidth: 1.5, borderColor: colors.danger },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingHorizontal: 4 },
  composerWrap: { paddingHorizontal: 12, gap: 8, width: '100%', maxWidth: 680, alignSelf: 'center' },
  toneBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: 14, gap: 6 },
  toneHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toneActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  calm: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 8,
    ...shadow.raised,
  },
  inputBox: { flex: 1, justifyContent: 'center', minHeight: 40 },
  input: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    maxHeight: 110,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
