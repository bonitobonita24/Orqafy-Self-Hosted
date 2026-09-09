import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Calendar</Text>
      <Text style={styles.body}>
        Coming soon — your schedule and site milestones will appear here.
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
