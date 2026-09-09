import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>This screen doesn&rsquo;t exist.</Text>
      <Link href="/" style={styles.link}>
        Go to My Tasks
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  heading: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  link: { fontSize: 15, color: colors.primary },
});
