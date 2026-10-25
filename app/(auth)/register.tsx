import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { signUp } = useAuthStore();

  const handleRegister = async () => {
    setErrorMsg(null);
    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const error = await signUp(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);
    if (error) {
      setErrorMsg(error);
    } else {
      router.replace('/(tabs)/home');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>🏍 RideBy</Text>
        <Text style={styles.tagline}>Create your account</Text>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Join RideBy</Text>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={(t) => { setName(t); setErrorMsg(null); }}
          autoCapitalize="words"
          autoComplete="name"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={(t) => { setEmail(t); setErrorMsg(null); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
          secureTextEntry
          autoComplete="new-password"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkBold}>Login</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FF6B35' },
  header: {
    flex: 0.6, justifyContent: 'center', alignItems: 'center', paddingTop: 40,
  },
  logo: { fontSize: 38, fontWeight: '800', color: '#fff', marginBottom: 8 },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  form: {
    flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30,
    borderTopRightRadius: 30, padding: 32, paddingTop: 36,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  errorBox: {
    backgroundColor: '#fee2e2', borderRadius: 10,
    padding: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#ef4444',
  },
  errorText: { color: '#b91c1c', fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    padding: 14, fontSize: 16, color: '#1a1a1a',
    marginBottom: 16, backgroundColor: '#fafafa',
  },
  btn: {
    backgroundColor: '#FF6B35', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 20 },
  linkText: { color: '#666', fontSize: 15 },
  linkBold: { color: '#FF6B35', fontWeight: '700' },
});
