import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { ListRow } from '@/components/ListRow';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { api, del, upload } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { confirm } from '@/lib/confirm';
import { day } from '@/lib/format';
import { useAction } from '@/lib/queries';
import type { DocumentCategory, FamilyDocument } from '@/lib/types';
import { colors, radius } from '@/theme';

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, { label: string; emoji: string }> = {
  'birth-certificate': { label: 'Birth certificate', emoji: '📜' },
  medical: { label: 'Medical', emoji: '🩺' },
  school: { label: 'School', emoji: '🎒' },
  legal: { label: 'Legal', emoji: '⚖️' },
  id: { label: 'ID', emoji: '🪪' },
  other: { label: 'Other', emoji: '📄' },
};

const MAX_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = [
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Opens a document in the browser through a short-lived link (the browser can't send our sign-in). */
async function openDocument(doc: FamilyDocument) {
  // On the web, open the tab during the tap so pop-up blockers allow it, then point it at the file.
  const tab = Platform.OS === 'web' ? window.open('', '_blank') : null;
  try {
    const { path } = await api<{ path: string }>(`/documents/${doc.id}/link`);
    if (tab) tab.location.href = `${API_URL}${path}`;
    else await Linking.openURL(`${API_URL}${path}`);
  } catch (e) {
    tab?.close();
    throw e;
  }
}

export function DocumentRow({ doc }: { doc: FamilyDocument }) {
  const toast = useToast();
  const remove = useAction(() => del(`/documents/${doc.id}`), { success: 'Document removed' });
  const category = DOCUMENT_CATEGORIES[doc.category];

  const onOpen = () => openDocument(doc).catch((e) => toast.show(e instanceof Error ? e.message : 'Couldn’t open it', 'error'));
  const onRemove = async () => {
    const sure = await confirm(
      'Remove this document?',
      `“${doc.title}” will be removed for both of you. The info bank keeps a note that it was removed.`,
      'Remove',
    );
    if (sure) remove.mutate();
  };

  // The remove button sits over the row rather than inside it: a button can't contain another button.
  return (
    <View>
      <ListRow
        tile={category.emoji}
        tileColor={colors.primarySoft}
        title={doc.title}
        subtitle={`${category.label} · ${fileSize(doc.size)} · ${doc.uploaded_by.first_name}, ${day(doc.created_at)}`}
        onPress={onOpen}
        chevron={false}
        right={doc.mine ? <View style={{ width: 36 }} /> : undefined}
      />
      {doc.mine ? (
        <View style={styles.over}>
          <IconButton icon="trash-outline" label="Remove document" color={colors.dangerDeep} background={colors.dangerSoft} size={36} onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

export function UploadSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The form lives inside the sheet, so it starts empty every time it opens.
  return (
    <Sheet visible={visible} onClose={onClose} title="Add a document" subtitle="A PDF, photo or Word file up to 5 MB. Both of you can open it.">
      <UploadForm onDone={onClose} />
    </Sheet>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('other');
  const tooBig = !!file?.size && file.size > MAX_BYTES;

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: FILE_TYPES, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile(asset);
    if (!title.trim()) setTitle(asset.name.replace(/\.[^.]+$/, ''));
  };

  const save = useAction(
    async () => {
      if (!file) return;
      const form = new FormData();
      if (Platform.OS === 'web') {
        form.append('file', file.file ?? (await (await fetch(file.uri)).blob()), file.name);
      } else {
        // React Native uploads a local file from its uri.
        form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      }
      form.append('title', title.trim());
      form.append('category', category);
      return upload<FamilyDocument>('/documents', form);
    },
    { success: 'Added to the info bank', onDone },
  );

  return (
    <>
      {file ? (
        <View style={[styles.file, tooBig && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="document-attach-outline" size={24} color={tooBig ? colors.dangerDeep : colors.primaryDeep} />
          <View style={{ flex: 1 }}>
            <Text variant="smallStrong" numberOfLines={1}>
              {file.name}
            </Text>
            <Text variant="small" color={tooBig ? colors.dangerDeep : colors.inkMuted}>
              {file.size ? fileSize(file.size) : 'Ready to upload'}
              {tooBig ? ' · too big, the limit is 5 MB' : ''}
            </Text>
          </View>
          <Button title="Change" size="sm" variant="ghost" onPress={pick} />
        </View>
      ) : (
        <Button title="Choose a file" icon="folder-open-outline" variant="soft" size="lg" onPress={pick} />
      )}
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Kirana’s birth certificate" />
      <View style={{ gap: 8 }}>
        <Text variant="smallStrong" color={colors.inkMuted}>
          Type
        </Text>
        <Chips
          scroll
          value={category}
          onChange={setCategory}
          options={(Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).map((c) => ({
            value: c,
            label: `${DOCUMENT_CATEGORIES[c].emoji} ${DOCUMENT_CATEGORIES[c].label}`,
          }))}
        />
      </View>
      <Button
        title="Add to the info bank"
        size="lg"
        disabled={!file || tooBig || !title.trim()}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.field, borderRadius: radius.lg, padding: 14 },
  over: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
});
