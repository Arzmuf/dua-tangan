import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius } from '@/theme';
import { Text } from './Text';

type Props = TextInputProps & { label?: string; hint?: string; prefix?: string };

export const Field = forwardRef<TextInput, Props>(function Field(
  { label, hint, prefix, style, multiline, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="smallStrong" color={colors.inkMuted}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.box, multiline && styles.multiline, focused && styles.focused]}>
        {prefix ? (
          <Text variant="bodyStrong" color={colors.inkMuted}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkFaint}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...props}
        />
      </View>
      {hint ? (
        <Text variant="tiny" color={colors.inkFaint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  multiline: { alignItems: 'flex-start', paddingVertical: 12 },
  focused: { borderColor: colors.primary, backgroundColor: colors.surface },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 12,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  inputMultiline: { minHeight: 72, paddingVertical: 0, textAlignVertical: 'top' },
});
