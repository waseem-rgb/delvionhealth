import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

export function LoadingScreen() {
  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color={Colors.teal} />
      <Text style={s.text}>DELViON Health</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  text: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },
});
