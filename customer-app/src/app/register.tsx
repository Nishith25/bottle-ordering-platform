// customer-app/src/app/register.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";

export default function RegisterScreen() {
  const router = useRouter();

  const {
    register,
    authenticating,
    error,
    clearError,
    isAuthenticated,
  } = useAuth();

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [localError, setLocalError] =
    useState<string | null>(null);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)/account");
    }
  }, [isAuthenticated, router]);

  const cleanPhone =
    phone.replace(/\D/g, "");

  const canSubmit =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    cleanPhone.length === 10 &&
    password.length >= 8 &&
    confirmPassword.length >= 8 &&
    !authenticating;

  const resetErrors = () => {
    clearError();
    setLocalError(null);
  };

  const handleRegister = async () => {
    resetErrors();

    if (password !== confirmPassword) {
      setLocalError(
        "The passwords do not match."
      );

      return;
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setLocalError(
        "Enter a valid 10-digit Indian mobile number."
      );

      return;
    }

    const successful = await register({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      password,
    });

    if (successful) {
      router.replace("/(tabs)/account");
    }
  };

  const visibleError =
    localError ?? error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#203128"
            />
          </Pressable>

          <View style={styles.iconContainer}>
            <Ionicons
              name="person-add-outline"
              size={33}
              color="#245C42"
            />
          </View>

          <Text style={styles.title}>
            Create your account
          </Text>

          <Text style={styles.subtitle}>
            Save your details and manage future
            orders and subscriptions.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>
              Full name
            </Text>

            <TextInput
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                resetErrors();
              }}
              placeholder="Enter your full name"
              placeholderTextColor="#9AA39E"
              autoCapitalize="words"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>
              Email address
            </Text>

            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                resetErrors();
              }}
              placeholder="Enter your email address"
              placeholderTextColor="#9AA39E"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>
              Mobile number
            </Text>

            <TextInput
              value={phone}
              onChangeText={(value) => {
                setPhone(
                  value.replace(/\D/g, "")
                );

                resetErrors();
              }}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9AA39E"
              keyboardType="phone-pad"
              maxLength={10}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>
              Password
            </Text>

            <View style={styles.passwordInput}>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  resetErrors();
                }}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#9AA39E"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.passwordTextInput}
              />

              <Pressable
                onPress={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={20}
                  color="#66736B"
                />
              </Pressable>
            </View>

            <Text
              style={[
                styles.inputLabel,
                styles.confirmLabel,
              ]}
            >
              Confirm password
            </Text>

            <TextInput
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                resetErrors();
              }}
              placeholder="Enter password again"
              placeholderTextColor="#9AA39E"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.input}
            />

            {visibleError ? (
              <View style={styles.errorCard}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#A44949"
                />

                <Text style={styles.errorText}>
                  {visibleError}
                </Text>
              </View>
            ) : null}

            <Pressable
              disabled={!canSubmit}
              onPress={() => {
                void handleRegister();
              }}
              style={({ pressed }) => [
                styles.primaryButton,

                !canSubmit &&
                  styles.primaryButtonDisabled,

                pressed &&
                  canSubmit &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                {authenticating
                  ? "Creating account..."
                  : "Create account"}
              </Text>

              {!authenticating ? (
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color="#FFFFFF"
                />
              ) : null}
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Already registered?
            </Text>

            <Pressable
              onPress={() =>
                router.replace("/login")
              }
            >
              <Text style={styles.footerLink}>
                Log in
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 40,
  },

  backButton: {
    width: 45,
    height: 45,
    borderRadius: 16,
    backgroundColor: "#E7EBE5",
    alignItems: "center",
    justifyContent: "center",
  },

  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 31,
  },

  title: {
    color: "#18251E",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 22,
  },

  subtitle: {
    color: "#6E7872",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  formCard: {
    padding: 19,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
    marginTop: 25,
  },

  inputLabel: {
    color: "#45534B",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
  },

  confirmLabel: {
    marginTop: 17,
  },

  input: {
    height: 54,
    borderRadius: 17,
    paddingHorizontal: 15,
    backgroundColor: "#F1F4EF",
    borderWidth: 1,
    borderColor: "#E0E5DE",
    color: "#1C2922",
    fontSize: 13,
    marginBottom: 17,
  },

  passwordInput: {
    height: 54,
    borderRadius: 17,
    backgroundColor: "#F1F4EF",
    borderWidth: 1,
    borderColor: "#E0E5DE",
    flexDirection: "row",
    alignItems: "center",
  },

  passwordTextInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 15,
    color: "#1C2922",
    fontSize: 13,
  },

  passwordToggle: {
    width: 49,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  errorCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FAECEC",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },

  errorText: {
    flex: 1,
    color: "#914343",
    fontSize: 10,
    lineHeight: 15,
  },

  primaryButton: {
    minHeight: 55,
    borderRadius: 18,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 17,
  },

  primaryButtonDisabled: {
    backgroundColor: "#AAB8AF",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 23,
  },

  footerText: {
    color: "#747D78",
    fontSize: 11,
  },

  footerLink: {
    color: "#245C42",
    fontSize: 11,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});