import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function LelystadScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lelystad</Text>
      <Text style={styles.subtitle}>Deze regio komt binnenkort.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1a17',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e7f8f4',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ac6bc',
    textAlign: 'center',
  },
});
