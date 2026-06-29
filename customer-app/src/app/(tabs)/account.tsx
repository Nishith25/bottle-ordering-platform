import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";

const DASHBOARD_BASE_URL = (
  process.env
    .EXPO_PUBLIC_ADMIN_DASHBOARD_URL ??
  "http://localhost:5174"
).replace(/\/$/, "");

const ADMIN_DASHBOARD_URL =
  `${DASHBOARD_BASE_URL}/dashboard`;

const DELIVERY_DASHBOARD_URL =
  `${DASHBOARD_BASE_URL}/delivery`;

export default function AccountScreen() {
  const router = useRouter();

  const {
    user,
    loading,
    isAuthenticated,
    logout,
  } = useAuth();

  const [loggingOut, setLoggingOut] =
    useState(false);

  const openDashboard = async (
    dashboardUrl: string,
    dashboardName: string
  ) => {
    try {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined"
      ) {
        const openedWindow =
          window.open(
            dashboardUrl,
            "_blank",
            "noopener,noreferrer"
          );

        if (!openedWindow) {
          window.location.assign(
            dashboardUrl
          );
        }

        return;
      }

      const supported =
        await Linking.canOpenURL(
          dashboardUrl
        );

      if (!supported) {
        Alert.alert(
          `Unable to open ${dashboardName}`,
          "The dashboard URL is not available."
        );

        return;
      }

      await Linking.openURL(
        dashboardUrl
      );
    } catch {
      Alert.alert(
        `Unable to open ${dashboardName}`,
        "Please check that the dashboard is running."
      );
    }
  };

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centerState}
        >
          <ActivityIndicator
            size="large"
            color="#245C42"
          />

          <Text
            style={styles.loadingText}
          >
            Loading your account
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (
    !isAuthenticated ||
    !user
  ) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.guestContent
          }
        >
          <View
            style={styles.guestIcon}
          >
            <Ionicons
              name="person-outline"
              size={39}
              color="#35694E"
            />
          </View>

          <Text
            style={styles.guestTitle}
          >
            Your account
          </Text>

          <Text
            style={
              styles.guestDescription
            }
          >
            Log in to save orders, manage
            subscriptions and view your
            delivery history.
          </Text>

          <Pressable
            onPress={() =>
              router.push("/login")
            }
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.pressed,
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
              pressed &&
                styles.pressed,
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

          <Pressable
            onPress={() =>
              router.push(
                "/(tabs)/bottles"
              )
            }
            style={({ pressed }) => [
              styles.browseButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="nutrition-outline"
              size={18}
              color="#35694E"
            />

            <Text
              style={
                styles.browseButtonText
              }
            >
              Continue browsing bottles
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isAdmin =
    user.role === "admin";

  const isDeliveryPartner =
    user.role === "delivery";

  const hasOperationsDashboard =
    isAdmin ||
    isDeliveryPartner;

  const accountType = isAdmin
    ? "Customer and administrator"
    : isDeliveryPartner
      ? "Delivery partner and customer"
      : "Customer";

  const roleBadgeText = isAdmin
    ? "Admin"
    : isDeliveryPartner
      ? "Delivery partner"
      : "";

  const roleBadgeIcon:
    keyof typeof Ionicons.glyphMap =
    isAdmin
      ? "shield-checkmark"
      : "car-outline";

  const dashboardUrl = isAdmin
    ? ADMIN_DASHBOARD_URL
    : DELIVERY_DASHBOARD_URL;

  const dashboardName = isAdmin
    ? "admin dashboard"
    : "delivery dashboard";

  const dashboardTitle = isAdmin
    ? "Administrator dashboard"
    : "Delivery dashboard";

  const dashboardDescription =
    isAdmin
      ? "Manage bottle prices, stock, orders, delivery areas, coupons and subscription plans."
      : "View assigned orders, update delivery progress and complete deliveries securely.";

  const dashboardButtonText =
    isAdmin
      ? "Open Admin Dashboard"
      : "Open Delivery Dashboard";

  const dashboardIcon:
    keyof typeof Ionicons.glyphMap =
    isAdmin
      ? "settings-outline"
      : "navigate-outline";

  const roleNotice = isAdmin
    ? "Your administrator account can also buy bottles and subscribe through this customer app."
    : "Your delivery partner account can also place personal bottle orders and subscriptions without changing roles.";

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <Text style={styles.eyebrow}>
          MY ACCOUNT
        </Text>

        <Text style={styles.title}>
          Hello,{" "}
          {user.fullName.split(" ")[0]}
        </Text>

        <Text style={styles.subtitle}>
          {isDeliveryPartner
            ? "Manage your assigned deliveries, personal orders and recurring plans."
            : "Manage your orders, recurring plans and account details."}
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.fullName
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>

          <View
            style={styles.profileDetails}
          >
            <View style={styles.nameRow}>
              <Text
                style={styles.profileName}
              >
                {user.fullName}
              </Text>

              {hasOperationsDashboard ? (
                <View
                  style={[
                    styles.roleBadge,

                    isDeliveryPartner &&
                      styles.deliveryBadge,
                  ]}
                >
                  <Ionicons
                    name={roleBadgeIcon}
                    size={12}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.roleBadgeText
                    }
                  >
                    {roleBadgeText}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={styles.profileEmail}
            >
              {user.email}
            </Text>

            <Text
              style={styles.profilePhone}
            >
              +91 {user.phone}
            </Text>
          </View>
        </View>

        {hasOperationsDashboard ? (
          <View
            style={[
              styles.operationsCard,

              isDeliveryPartner &&
                styles.deliveryOperationsCard,
            ]}
          >
            <View
              style={styles.operationsCardTop}
            >
              <View
                style={
                  styles.operationsIcon
                }
              >
                <Ionicons
                  name={dashboardIcon}
                  size={24}
                  color="#245C42"
                />
              </View>

              <View
                style={
                  styles.operationsCardContent
                }
              >
                <Text
                  style={
                    styles.operationsCardTitle
                  }
                >
                  {dashboardTitle}
                </Text>

                <Text
                  style={
                    styles.operationsCardDescription
                  }
                >
                  {dashboardDescription}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                void openDashboard(
                  dashboardUrl,
                  dashboardName
                );
              }}
              style={({ pressed }) => [
                styles.dashboardButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="open-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.dashboardButtonText
                }
              >
                {dashboardButtonText}
              </Text>
            </Pressable>

            <Text
              style={styles.roleNotice}
            >
              {roleNotice}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          Shopping
        </Text>

        <MenuButton
          icon="nutrition-outline"
          title="Browse bottles"
          description="Order fresh bottles for delivery"
          onPress={() =>
            router.push(
              "/(tabs)/bottles"
            )
          }
        />

        <MenuButton
          icon="receipt-outline"
          title="My orders"
          description="Track and review your bottle orders"
          onPress={() =>
            router.push(
              "/(tabs)/orders"
            )
          }
        />

        <MenuButton
          icon="repeat-outline"
          title="My subscriptions"
          description="Manage recurring bottle plans"
          onPress={() =>
            router.push(
              "/(tabs)/plans"
            )
          }
        />

        <Text style={styles.sectionTitle}>
          Account information
        </Text>

        <View
          style={styles.informationCard}
        >
          <InformationRow
            icon="mail-outline"
            label="Email"
            value={user.email}
          />

          <InformationRow
            icon="call-outline"
            label="Mobile"
            value={`+91 ${user.phone}`}
          />

          <InformationRow
            icon={
              isDeliveryPartner
                ? "car-outline"
                : isAdmin
                  ? "shield-checkmark-outline"
                  : "person-circle-outline"
            }
            label="Account type"
            value={accountType}
          />

          <InformationRow
            icon="checkmark-circle-outline"
            label="Account status"
            value={
              user.active
                ? "Active"
                : "Inactive"
            }
            last
          />
        </View>

        <Pressable
          disabled={loggingOut}
          onPress={() => {
            void handleLogout();
          }}
          style={({ pressed }) => [
            styles.logoutButton,

            loggingOut &&
              styles.logoutButtonDisabled,

            pressed &&
              !loggingOut &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={19}
            color="#A34848"
          />

          <Text
            style={styles.logoutText}
          >
            {loggingOut
              ? "Logging out..."
              : "Log out"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuButton({
  icon,
  title,
  description,
  onPress,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;

  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuButton,

        pressed &&
          styles.pressed,
      ]}
    >
      <View style={styles.menuIcon}>
        <Ionicons
          name={icon}
          size={22}
          color="#35694E"
        />
      </View>

      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>
          {title}
        </Text>

        <Text
          style={
            styles.menuDescription
          }
        >
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={19}
        color="#87918B"
      />
    </Pressable>
  );
}

function InformationRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;

  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.informationRow,

        last &&
          styles.lastInformationRow,
      ]}
    >
      <View
        style={styles.informationIcon}
      >
        <Ionicons
          name={icon}
          size={18}
          color="#35694E"
        />
      </View>

      <View
        style={
          styles.informationContent
        }
      >
        <Text
          style={
            styles.informationLabel
          }
        >
          {label}
        </Text>

        <Text
          numberOfLines={2}
          style={
            styles.informationValue
          }
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  scrollContent: {
    width: "100%",
    maxWidth: 650,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 130,
  },

  eyebrow: {
    color: "#4D765F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },

  title: {
    color: "#17221C",
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 8,
  },

  subtitle: {
    color: "#717A75",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },

  profileCard: {
    padding: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
  },

  avatar: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: "#DDEBDD",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#245C42",
    fontSize: 25,
    fontWeight: "900",
  },

  profileDetails: {
    flex: 1,
    marginLeft: 14,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  profileName: {
    color: "#203128",
    fontSize: 15,
    fontWeight: "900",
  },

  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  deliveryBadge: {
    backgroundColor: "#35637A",
  },

  roleBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },

  profileEmail: {
    color: "#6F7B74",
    fontSize: 10,
    marginTop: 6,
  },

  profilePhone: {
    color: "#6F7B74",
    fontSize: 10,
    marginTop: 3,
  },

  operationsCard: {
    padding: 17,
    borderRadius: 24,
    backgroundColor: "#E2EFE4",
    borderWidth: 1,
    borderColor: "#CFE0D2",
    marginTop: 14,
  },

  deliveryOperationsCard: {
    backgroundColor: "#E5EFF3",
    borderColor: "#CEDFE6",
  },

  operationsCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  operationsIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  operationsCardContent: {
    flex: 1,
    marginLeft: 12,
  },

  operationsCardTitle: {
    color: "#244332",
    fontSize: 13,
    fontWeight: "900",
  },

  operationsCardDescription: {
    color: "#617168",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 4,
  },

  dashboardButton: {
    minHeight: 51,
    borderRadius: 17,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 15,
  },

  dashboardButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  roleNotice: {
    color: "#617168",
    fontSize: 8,
    lineHeight: 13,
    textAlign: "center",
    marginTop: 10,
  },

  sectionTitle: {
    color: "#1D2922",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 24,
    marginBottom: 11,
  },

  menuButton: {
    minHeight: 72,
    padding: 13,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  menuIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  menuContent: {
    flex: 1,
    marginLeft: 12,
  },

  menuTitle: {
    color: "#26372E",
    fontSize: 12,
    fontWeight: "900",
  },

  menuDescription: {
    color: "#747F78",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  informationCard: {
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
  },

  informationRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBE7",
    flexDirection: "row",
    alignItems: "center",
  },

  lastInformationRow: {
    borderBottomWidth: 0,
  },

  informationIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#E7F0E9",
    alignItems: "center",
    justifyContent: "center",
  },

  informationContent: {
    flex: 1,
    marginLeft: 11,
  },

  informationLabel: {
    color: "#7A847E",
    fontSize: 8,
  },

  informationValue: {
    color: "#28372F",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },

  logoutButton: {
    minHeight: 51,
    borderRadius: 17,
    backgroundColor: "#FAECEC",
    borderWidth: 1,
    borderColor: "#F0D7D7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },

  logoutButtonDisabled: {
    opacity: 0.55,
  },

  logoutText: {
    color: "#A34848",
    fontSize: 11,
    fontWeight: "900",
  },

  guestContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingHorizontal: 25,
    paddingBottom: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  guestIcon: {
    width: 85,
    height: 85,
    borderRadius: 28,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  guestTitle: {
    color: "#1D2922",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 20,
  },

  guestDescription: {
    color: "#727D76",
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
    marginTop: 23,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: "#E8EEE8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#245C42",
    fontSize: 11,
    fontWeight: "900",
  },

  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },

  browseButtonText: {
    color: "#35694E",
    fontSize: 10,
    fontWeight: "800",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#657269",
    fontSize: 11,
    marginTop: 12,
  },

  pressed: {
    opacity: 0.84,

    transform: [
      {
        scale: 0.98,
      },
    ],
  },
});