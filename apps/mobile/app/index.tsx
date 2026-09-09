import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export default function MyTasksScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Tasks</Text>
      <Text style={styles.body}>
        Coming soon — your assigned site tasks will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
    gap: 8,
  },
  heading: { fontSize: 24, fontWeight: '600', color: colors.foreground },
  body: { fontSize: 15, lineHeight: 22, color: colors.mutedForeground },
});
