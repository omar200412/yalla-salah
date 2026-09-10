import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from '../theme/colors';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
};

export function TextField({ label, hint, style, ...rest }: Props) {
  const t = useTheme();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: t.textDim }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.textDim}
        selectionColor={t.primary}
        style={[
          styles.input,
          { backgroundColor: t.surface, borderColor: t.border, color: t.text },
          style,
        ]}
        {...rest}
      />
      {hint ? <Text style={[styles.hint, { color: t.textDim }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginLeft: 4 },
});
