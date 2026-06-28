// customer-app/src/app/(tabs)/account.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";

export default function AccountScreen() {
  const router = useRouter();

  const {
    user,
    loading,
    isAuthenticated,
    logout,
  } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#245C42"
          />

          <Text style={styles.loadingText}>
            Loading your account
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={
            styles.guestContent
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>
            YOUR ACCOUNT
          </Text>

          <Text style={styles.title}>
            Orders made easier
          </Text>

          <Text style={styles.subtitle}>
            Log in to manage your profile,
            orders and recurring bottle plans.
          </Text>

          <View style={styles.guestCard}>
            <View style={styles.guestIcon}>
              <Ionicons
                name="person-outline"
                size={37}
                color="#245C42"
              />
            </View>

            <Text style={styles.guestTitle}>
              You are browsing as a guest
            </Text>

            <Text
              style={styles.guestDescription}
            >
              Your cart can still be used, but
              an account will be required for
              saved orders and subscriptions.
            </Text>

            <Pressable
              onPress={() =>
                router.push("/login")
              }
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Log in
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push("/register")
              }
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Create account
              </Text>
            </Pressable>
          </View>

          <View style={styles.benefitsCard}>
            <BenefitItem
              icon="receipt-outline"
              title="Order history"
              description="Keep all your bottle orders in one place."
            />

            <BenefitItem
              icon="repeat-outline"
              title="Subscription control"
              description="Manage weekly and monthly deliveries."
            />

            <BenefitItem
              icon="location-outline"
              title="Saved details"
              description="Reuse delivery information during checkout."
              last
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const initial =
    user.fullName.trim().charAt(0).toUpperCase() ||
    "U";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.profileContent
        }
      >
        <Text style={styles.eyebrow}>
          YOUR ACCOUNT
        </Text>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initial}
            </Text>
          </View>

          <View style={styles.profileHeaderText}>
            <Text style={styles.profileName}>
              {user.fullName}
            </Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {user.role === "admin"
                  ? "Administrator"
                  : "Customer"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <AccountRow
            icon="mail-outline"
            label="Email address"
            value={user.email}
          />

          <AccountRow
            icon="call-outline"
            label="Mobile number"
            value={`+91 ${user.phone}`}
          />

          <AccountRow
            icon="shield-checkmark-outline"
            label="Account status"
            value={
              user.active
                ? "Active"
                : "Disabled"
            }
            last
          />
        </View>

        <View style={styles.actionCard}>
          <ActionRow
            icon="receipt-outline"
            title="My orders"
            description="View current and previous orders"
            onPress={() =>
              router.push("/(tabs)/orders")
            }
          />

          <ActionRow
            icon="repeat-outline"
            title="My subscriptions"
            description="Manage recurring bottle plans"
            onPress={() =>
              router.push("/(tabs)/plans")
            }
            last
          />
        </View>

        <Pressable
          onPress={() => {
            void handleLogout();
          }}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={19}
            color="#9B4545"
          />

          <Text style={styles.logoutText}>
            Log out
          </Text>
        </Pressable>

        <Text style={styles.sessionNote}>
          Your login is securely saved on this
          device until you log out.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function BenefitItem({
  icon,
  title,
  description,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.benefitItem,
        last && styles.lastItem,
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color="#35694E"
        />
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>
          {title}
        </Text>

        <Text style={styles.rowDescription}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function AccountRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.accountRow,
        last && styles.lastItem,
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color="#35694E"
        />
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>
          {label}
        </Text>

        <Text style={styles.rowValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  description,
  onPress,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        last && styles.lastItem,
        pressed && styles.actionPressed,
      ]}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color="#35694E"
        />
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>
          {title}
        </Text>

        <Text style={styles.rowDescription}>
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color="#8B958F"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#59665F",
    fontSize: 12,
    marginTop: 14,
  },

  guestContent: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
    paddingHorizontal: 21,
    paddingTop: 14,
    paddingBottom: 120,
  },

  profileContent: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
    paddingHorizontal: 21,
    paddingTop: 14,
    paddingBottom: 120,
  },

  eyebrow: {
    color: "#4D765F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },

  title: {
    color: "#17221C",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 10,
  },

  subtitle: {
    color: "#717A75",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  guestCard: {
    padding: 22,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8E3",
    alignItems: "center",
    marginTop: 27,
  },

  guestIcon: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  guestTitle: {
    color: "#1D2922",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },

  guestDescription: {
    color: "#707A74",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },

  primaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 21,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: "#EDF2EC",
    borderWidth: 1,
    borderColor: "#DCE5DD",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#245C42",
    fontSize: 12,
    fontWeight: "800",
  },

  benefitsCard: {
    paddingHorizontal: 17,
    borderRadius: 24,
    backgroundColor: "#E8F0EA",
    marginTop: 15,
  },

  benefitItem: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#D3E0D6",
  },

  profileHeader: {
    padding: 20,
    borderRadius: 25,
    backgroundColor: "#E4EFE7",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
  },

  avatar: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
  },

  profileHeaderText: {
    flex: 1,
    marginLeft: 15,
  },

  profileName: {
    color: "#1D3024",
    fontSize: 18,
    fontWeight: "900",
  },

  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginTop: 7,
  },

  roleText: {
    color: "#35694E",
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  infoCard: {
    paddingHorizontal: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8E3",
    marginTop: 15,
  },

  actionCard: {
    paddingHorizontal: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E8E3",
    marginTop: 15,
  },

  accountRow: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBE7",
  },

  actionRow: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBE7",
  },

  actionPressed: {
    opacity: 0.65,
  },

  lastItem: {
    borderBottomWidth: 0,
  },

  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E7F0E9",
    alignItems: "center",
    justifyContent: "center",
  },

  rowContent: {
    flex: 1,
    marginLeft: 12,
  },

  rowLabel: {
    color: "#7A847E",
    fontSize: 9,
  },

  rowValue: {
    color: "#28372F",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  rowTitle: {
    color: "#28372F",
    fontSize: 12,
    fontWeight: "800",
  },

  rowDescription: {
    color: "#738078",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  logoutButton: {
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: "#FAECEC",
    borderWidth: 1,
    borderColor: "#F0DADA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },

  logoutText: {
    color: "#994646",
    fontSize: 12,
    fontWeight: "800",
  },

  sessionNote: {
    color: "#7A847E",
    fontSize: 9,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 13,
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});