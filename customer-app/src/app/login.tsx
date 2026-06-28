// customer-app/src/app/login.tsx

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

export default function LoginScreen() {
  const router = useRouter();

  const {
    login,
    authenticating,
    error,
    clearError,
    isAuthenticated,
  } = useAuth();

  const [identifier, setIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)/account");
    }
  }, [isAuthenticated, router]);

  const canSubmit =
    identifier.trim().length > 0 &&
    password.length > 0 &&
    !authenticating;

  const handleLogin = async () => {
    if (!canSubmit) {
      return;
    }

    const successful = await login({
      identifier: identifier.trim(),
      password,
    });

    if (successful) {
      router.replace("/(tabs)/account");
    }
  };

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
              name="person-outline"
              size={34}
              color="#245C42"
            />
          </View>

          <Text style={styles.title}>
            Welcome back
          </Text>

          <Text style={styles.subtitle}>
            Log in using your email address or
            mobile number.
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>
              Email or mobile number
            </Text>

            <TextInput
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                clearError();
              }}
              placeholder="Enter email or mobile number"
              placeholderTextColor="#9AA39E"
              autoCapitalize="none"
              autoCorrect={false}
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
                  clearError();
                }}
                placeholder="Enter your password"
                placeholderTextColor="#9AA39E"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
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

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#A44949"
                />

                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              disabled={!canSubmit}
              onPress={() => {
                void handleLogin();
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
                  ? "Logging in..."
                  : "Log in"}
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
              New customer?
            </Text>

            <Pressable
              onPress={() =>
                router.replace("/register")
              }
            >
              <Text style={styles.footerLink}>
                Create an account
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
    marginTop: 44,
  },

  title: {
    color: "#18251E",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 23,
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
    marginTop: 27,
  },

  inputLabel: {
    color: "#45534B",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
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
    marginTop: 15,
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
    marginTop: 20,
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