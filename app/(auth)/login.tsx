import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, SafeAreaView,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Header */}
          <View style={styles.hero}>
            <View style={styles.logoRow}>
              <Text style={styles.logoEmoji}>🏍</Text>
              <Text style={styles.logoText}>
                Ride<Text style={styles.logoAccent}>By</Text>
              </Text>
            </View>
            <Text style={styles.tagline}>Ride Together. Arrive Together.</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                placeholder="you@example.com"
                placeholderTextColor="#4B5563"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={[styles.inputRow, passwordFocused && styles.inputFocused]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
                  secureTextEntry={!passwordVisible}
                  autoComplete="password"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setPasswordVisible(!passwordVisible)}
                  style={styles.eyeBtn}
                >
                  <Text style={styles.eyeIcon}>{passwordVisible ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register link */}
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.linkBtn} activeOpacity={0.7}>
                <Text style={styles.linkText}>
                  Don't have an account?{' '}
                  <Text style={styles.linkBold}>Register</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0A0E1A' },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoEmoji: { fontSize: 36, marginRight: 8 },
  logoText: { fontSize: 40, fontWeight: '800', color: '#F9FAFB', letterSpacing: -1 },
  logoAccent: { color: '#FF6B35' },
  tagline: { fontSize: 15, color: '#9CA3AF', fontWeight: '500', letterSpacing: 0.3 },

  card: {
    backgroundColor: '#12172B',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 24, fontWeight: '800', color: '#F9FAFB',
    letterSpacing: -0.5, marginBottom: 4,
  },
  cardSubtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 24, fontWeight: '500' },

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    padding: 12, marginBottom: 16,
    borderLeftWidth: 4, borderLeftColor: '#EF4444',
  },
  errorText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },

  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 11, fontWeight: '600', color: '#9CA3AF',
    letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#232B45',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  inputFocused: {
    borderColor: '#FF6B35',
    borderWidth: 1.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232B45',
    borderRadius: 12,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 16,
  },
  inputInner: { flex: 1, fontSize: 15, color: '#F9FAFB' },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 17 },

  btn: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 24, gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },

  linkBtn: { alignItems: 'center', paddingVertical: 4 },
  linkText: { color: '#9CA3AF', fontSize: 15, fontWeight: '400' },
  linkBold: { color: '#FF6B35', fontWeight: '700' },
});
