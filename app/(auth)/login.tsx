import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { signIn } = useAuthStore();

  const handleLogin = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    const error = await signIn(email.trim().toLowerCase(), password);
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🏍 RideBy</Text>
        <Text style={styles.tagline}>Ride together, stay together</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.title}>Welcome back</Text>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        )}

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
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Login</Text>
          }
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FF6B35' },
  header: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingTop: 40,
  },
  logo: { fontSize: 42, fontWeight: '800', color: '#fff', marginBottom: 8 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  form: {
    flex: 2, backgroundColor: '#fff', borderTopLeftRadius: 30,
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
