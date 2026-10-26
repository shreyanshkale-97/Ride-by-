import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, SafeAreaView,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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

  // Determine active step based on filled fields
  const step = !name.trim() ? 0 : !email.trim() ? 1 : 2;

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

          {/* Steps Indicator */}
          <View style={styles.stepsRow}>
            {['Name', 'Email', 'Password'].map((label, i) => (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                  {i < step ? (
                    <Text style={styles.stepCheck}>✓</Text>
                  ) : (
                    <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>
                  {label}
                </Text>
                {i < 2 && (
                  <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
                )}
              </View>
            ))}
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Join RideBy</Text>
            <Text style={styles.cardSubtitle}>Create your free account</Text>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            )}

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>YOUR NAME</Text>
              <TextInput
                style={[styles.input, nameFocused && styles.inputFocused]}
                placeholder="John Rider"
                placeholderTextColor="#4B5563"
                value={name}
                onChangeText={(t) => { setName(t); setErrorMsg(null); }}
                autoCapitalize="words"
                autoComplete="name"
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>

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
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#4B5563"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
                  secureTextEntry={!passwordVisible}
                  autoComplete="new-password"
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
              {password.length > 0 && password.length < 6 && (
                <Text style={styles.passwordHint}>Need at least 6 characters</Text>
              )}
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Create Account</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>already a member?</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Login link */}
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.linkBtn} activeOpacity={0.7}>
                <Text style={styles.linkText}>
                  Already have an account?{' '}
                  <Text style={styles.linkBold}>Login</Text>
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

  hero: { alignItems: 'center', paddingTop: 48, paddingBottom: 28 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  logoEmoji: { fontSize: 34, marginRight: 8 },
  logoText: { fontSize: 38, fontWeight: '800', color: '#F9FAFB', letterSpacing: -1 },
  logoAccent: { color: '#FF6B35' },
  tagline: { fontSize: 14, color: '#9CA3AF', fontWeight: '500', letterSpacing: 0.3 },

  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepItem: { alignItems: 'center', flex: 1, position: 'relative' },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1A2035',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1,
  },
  stepDotActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  stepNumActive: { color: '#fff' },
  stepCheck: { fontSize: 13, fontWeight: '800', color: '#fff' },
  stepLabel: { fontSize: 11, color: '#4B5563', marginTop: 6, fontWeight: '600', letterSpacing: 0.3 },
  stepLabelActive: { color: '#FF6B35' },
  stepLine: {
    position: 'absolute',
    top: 15, right: -12,
    width: 24, height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 0,
  },
  stepLineActive: { backgroundColor: '#FF6B35' },

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
  passwordHint: { fontSize: 12, color: '#EF4444', marginTop: 6, fontWeight: '500' },

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
