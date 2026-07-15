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
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import { usePushNotifications } from "../../context/PushNotificationContext";

import {
  deleteCustomerAddress,
  updateCustomerAddress,
  type SavedDeliveryAddress,
} from "../../services/api";

const DASHBOARD_BASE_URL = (
  process.env.EXPO_PUBLIC_ADMIN_DASHBOARD_URL ??
  "http://localhost:5174"
).replace(/\/$/, "");

const ADMIN_DASHBOARD_URL =
  `${DASHBOARD_BASE_URL}/login?role=admin`;

const DELIVERY_DASHBOARD_URL =
  `${DASHBOARD_BASE_URL}/login?role=delivery`;

type AddressEditForm = {
  label: string;
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark: string;
  area: string;
  city: string;
  isDefault: boolean;
};

function getPushTokenPreview(
  token: string | null
) {
  if (!token) {
    return "";
  }

  if (token.length <= 36) {
    return token;
  }

  return `${token.slice(0, 23)}...${token.slice(-8)}`;
}

function normalisePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function normalisePincode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function createAddressEditForm(
  address: SavedDeliveryAddress
): AddressEditForm {
  return {
    label: address.label,
    fullName: address.fullName,
    phone: address.phone,
    pincode: address.pincode,
    houseDetails: address.houseDetails,
    areaDetails: address.areaDetails,
    landmark: address.landmark || "",
    area: address.area,
    city: address.city,
    isDefault: address.isDefault,
  };
}

function validateAddressEditForm(
  form: AddressEditForm
) {
  if (!form.label.trim()) {
    return "Address label is required.";
  }

  if (form.fullName.trim().length < 2) {
    return "Full name must contain at least 2 characters.";
  }

  if (!/^[6-9]\d{9}$/.test(form.phone)) {
    return "Enter a valid 10-digit mobile number.";
  }

  if (!/^\d{6}$/.test(form.pincode)) {
    return "Enter a valid 6-digit pincode.";
  }

  if (form.houseDetails.trim().length < 3) {
    return "House, flat or building must contain at least 3 characters.";
  }

  if (form.areaDetails.trim().length < 3) {
    return "Area and street must contain at least 3 characters.";
  }

  if (!form.area.trim()) {
    return "Delivery area is required.";
  }

  if (!form.city.trim()) {
    return "Delivery city is required.";
  }

  return "";
}

export default function AccountScreen() {
  const router = useRouter();

  const {
    user,
    token,
    loading,
    isAuthenticated,
    logout,
    refreshUser,
  } = useAuth();

  const {
    permissionState,
    expoPushToken,
    error: pushError,
    registering,
    testing,
    disabling,
    registerCurrentDevice,
    sendRemoteTest,
    disableCurrentDevice,
  } = usePushNotifications();

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const [
    updatingAddressId,
    setUpdatingAddressId,
  ] = useState<string | null>(
    null
  );

  const [
    deletingAddressId,
    setDeletingAddressId,
  ] = useState<string | null>(
    null
  );

  const [
    editingAddressId,
    setEditingAddressId,
  ] = useState<string | null>(
    null
  );

  const [
    editForm,
    setEditForm,
  ] = useState<AddressEditForm | null>(
    null
  );

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

  const openNotificationSettings =
    async () => {
      if (Platform.OS === "web") {
        Alert.alert(
          "Mobile app required",
          "Notification settings are available inside the Android or iOS app."
        );

        return;
      }

      try {
        await Linking.openSettings();
      } catch {
        Alert.alert(
          "Unable to open settings",
          "Open your phone settings and allow notifications for SipBite."
        );
      }
    };

  const handleEnableNotifications =
    async () => {
      if (
        registering ||
        disabling
      ) {
        return;
      }

      const registeredToken =
        await registerCurrentDevice();

      if (registeredToken) {
        Alert.alert(
          "Notifications enabled",
          "This device will now receive important order, delivery and subscription updates."
        );
      }
    };

  const handleSendTestNotification =
    async () => {
      if (
        testing ||
        registering ||
        disabling
      ) {
        return;
      }

      const result =
        await sendRemoteTest();

      if (result) {
        Alert.alert(
          "Test notification sent",
          "Minimize SipBite and check your phone notification tray."
        );
      }
    };

  const confirmDisableNotifications =
    () => {
      if (
        disabling ||
        registering
      ) {
        return;
      }

      Alert.alert(
        "Disable notifications?",
        "This device will stop receiving SipBite push notifications until notifications are enabled again.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Disable",
            style: "destructive",

            onPress: () => {
              void handleDisableNotifications();
            },
          },
        ]
      );
    };

  const handleDisableNotifications =
    async () => {
      const disabled =
        await disableCurrentDevice();

      if (disabled) {
        Alert.alert(
          "Notifications disabled",
          "This device was removed from your registered notification devices.",
          [
            {
              text: "Done",
            },
            {
              text: "Phone settings",

              onPress: () => {
                void openNotificationSettings();
              },
            },
          ]
        );
      }
    };

  const handleSetDefaultAddress =
    async (address: SavedDeliveryAddress) => {
      if (
        !token ||
        updatingAddressId ||
        address.isDefault
      ) {
        return;
      }

      setUpdatingAddressId(address.id);

      try {
        await updateCustomerAddress(
          token,
          address.id,
          {
            isDefault: true,
          }
        );

        await refreshUser();
      } catch (requestError) {
        Alert.alert(
          "Unable to update address",
          requestError instanceof Error
            ? requestError.message
            : "Please try again."
        );
      } finally {
        setUpdatingAddressId(null);
      }
    };

  const startEditingAddress = (
    address: SavedDeliveryAddress
  ) => {
    if (
      updatingAddressId ||
      deletingAddressId
    ) {
      return;
    }

    setEditingAddressId(address.id);
    setEditForm(
      createAddressEditForm(address)
    );
  };

  const cancelEditingAddress = () => {
    setEditingAddressId(null);
    setEditForm(null);
  };

  const updateEditField = <
    Key extends keyof AddressEditForm,
  >(
    key: Key,
    value: AddressEditForm[Key]
  ) => {
    setEditForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [key]: value,
      };
    });
  };

  const saveEditedAddress =
    async (
      address: SavedDeliveryAddress
    ) => {
      if (
        !token ||
        !editForm ||
        updatingAddressId
      ) {
        return;
      }

      const validationError =
        validateAddressEditForm(
          editForm
        );

      if (validationError) {
        Alert.alert(
          "Check address details",
          validationError
        );

        return;
      }

      setUpdatingAddressId(address.id);

      try {
        await updateCustomerAddress(
          token,
          address.id,
          {
            label:
              editForm.label.trim(),

            fullName:
              editForm.fullName.trim(),

            phone:
              editForm.phone,

            pincode:
              editForm.pincode,

            houseDetails:
              editForm.houseDetails.trim(),

            areaDetails:
              editForm.areaDetails.trim(),

            landmark:
              editForm.landmark.trim(),

            area:
              editForm.area.trim(),

            city:
              editForm.city.trim(),

            isDefault:
              editForm.isDefault,
          }
        );

        await refreshUser();

        setEditingAddressId(null);
        setEditForm(null);
      } catch (requestError) {
        Alert.alert(
          "Unable to save address",
          requestError instanceof Error
            ? requestError.message
            : "Please try again."
        );
      } finally {
        setUpdatingAddressId(null);
      }
    };

  const handleDeleteAddress =
    async (address: SavedDeliveryAddress) => {
      if (
        !token ||
        deletingAddressId
      ) {
        return;
      }

      const deleteNow =
        async () => {
          setDeletingAddressId(address.id);

          try {
            await deleteCustomerAddress(
              token,
              address.id
            );

            if (
              editingAddressId ===
              address.id
            ) {
              setEditingAddressId(null);
              setEditForm(null);
            }

            await refreshUser();
          } catch (requestError) {
            Alert.alert(
              "Unable to delete address",
              requestError instanceof Error
                ? requestError.message
                : "Please try again."
            );
          } finally {
            setDeletingAddressId(null);
          }
        };

      if (
        Platform.OS === "web" &&
        typeof window !== "undefined"
      ) {
        const confirmed =
          window.confirm(
            `Delete saved address "${address.label}"?`
          );

        if (confirmed) {
          await deleteNow();
        }

        return;
      }

      Alert.alert(
        "Delete saved address?",
        `Delete "${address.label}" from your saved delivery addresses?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void deleteNow();
            },
          },
        ]
      );
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

  const notificationsEnabled =
    permissionState === "granted" &&
    Boolean(expoPushToken);

  const notificationBusy =
    registering ||
    testing ||
    disabling;

  const notificationStatus =
    notificationsEnabled
      ? "Enabled"
      : permissionState === "requesting"
        ? "Enabling"
        : permissionState === "denied"
          ? "Permission blocked"
          : permissionState === "unsupported"
            ? "Mobile app only"
            : permissionState === "error"
              ? "Needs attention"
              : "Not enabled";

  const notificationDescription =
    notificationsEnabled
      ? "This device is registered for order, delivery, payment and subscription updates."
      : permissionState === "denied"
        ? "Notification permission is blocked. Open your phone settings to allow notifications for SipBite."
        : permissionState === "unsupported"
          ? "Push notifications can only be enabled in the installed Android or iOS application."
          : permissionState === "error"
            ? pushError ||
              "SipBite could not register this device for push notifications."
            : "Enable notifications to receive important updates even when SipBite is closed.";

  const notificationIcon:
    keyof typeof Ionicons.glyphMap =
    notificationsEnabled
      ? "notifications"
      : permissionState === "denied"
        ? "notifications-off-outline"
        : permissionState === "error"
          ? "alert-circle-outline"
          : "notifications-outline";

  const tokenPreview =
    getPushTokenPreview(
      expoPushToken
    );

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
          Saved addresses
        </Text>

        <View style={styles.addressBookCard}>
          {user.savedAddresses.length === 0 ? (
            <View style={styles.emptyAddressState}>
              <View style={styles.emptyAddressIcon}>
                <Ionicons
                  name="location-outline"
                  size={24}
                  color="#35694E"
                />
              </View>

              <Text style={styles.emptyAddressTitle}>
                No saved addresses
              </Text>

              <Text style={styles.emptyAddressDescription}>
                Save an address during checkout to reuse it next time.
              </Text>

              <Pressable
                onPress={() =>
                  router.push("/cart")
                }
                style={({ pressed }) => [
                  styles.addAddressButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text style={styles.addAddressButtonText}>
                  Go to checkout
                </Text>
              </Pressable>
            </View>
          ) : (
            user.savedAddresses.map((address) => {
              const updating =
                updatingAddressId ===
                address.id;

              const deleting =
                deletingAddressId ===
                address.id;

              const editing =
                editingAddressId ===
                address.id &&
                editForm !== null;

              if (editing) {
                return (
                  <AddressEditCard
                    key={address.id}
                    form={editForm}
                    saving={updating}
                    onChange={updateEditField}
                    onCancel={cancelEditingAddress}
                    onSave={() => {
                      void saveEditedAddress(
                        address
                      );
                    }}
                  />
                );
              }

              return (
                <View
                  key={address.id}
                  style={styles.savedAddressItem}
                >
                  <View style={styles.savedAddressTop}>
                    <View style={styles.savedAddressIcon}>
                      <Ionicons
                        name={
                          address.isDefault
                            ? "home"
                            : "location-outline"
                        }
                        size={20}
                        color="#35694E"
                      />
                    </View>

                    <View style={styles.savedAddressContent}>
                      <View style={styles.savedAddressTitleRow}>
                        <Text style={styles.savedAddressTitle}>
                          {address.label}
                        </Text>

                        {address.isDefault ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>
                              Default
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.savedAddressName}>
                        {address.fullName} · +91 {address.phone}
                      </Text>

                      <Text style={styles.savedAddressText}>
                        {address.houseDetails}, {address.areaDetails}
                        {address.landmark
                          ? `, ${address.landmark}`
                          : ""}
                      </Text>

                      <Text style={styles.savedAddressMeta}>
                        {address.area}, {address.city} - {address.pincode}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.savedAddressActions}>
                    <Pressable
                      disabled={
                        updating ||
                        deleting
                      }
                      onPress={() =>
                        startEditingAddress(
                          address
                        )
                      }
                      style={({ pressed }) => [
                        styles.addressActionButton,
                        (updating ||
                          deleting) &&
                          styles.disabledButton,
                        pressed &&
                          !updating &&
                          !deleting &&
                          styles.pressed,
                      ]}
                    >
                      <Text style={styles.addressActionText}>
                        Edit
                      </Text>
                    </Pressable>

                    {!address.isDefault ? (
                      <Pressable
                        disabled={
                          updating ||
                          deleting
                        }
                        onPress={() => {
                          void handleSetDefaultAddress(
                            address
                          );
                        }}
                        style={({ pressed }) => [
                          styles.addressActionButton,
                          (updating ||
                            deleting) &&
                            styles.disabledButton,
                          pressed &&
                            !updating &&
                            !deleting &&
                            styles.pressed,
                        ]}
                      >
                        {updating ? (
                          <ActivityIndicator
                            size="small"
                            color="#245C42"
                          />
                        ) : (
                          <Text style={styles.addressActionText}>
                            Set default
                          </Text>
                        )}
                      </Pressable>
                    ) : null}

                    <Pressable
                      disabled={
                        updating ||
                        deleting
                      }
                      onPress={() => {
                        void handleDeleteAddress(
                          address
                        );
                      }}
                      style={({ pressed }) => [
                        styles.addressDeleteButton,
                        (updating ||
                          deleting) &&
                          styles.disabledButton,
                        pressed &&
                          !updating &&
                          !deleting &&
                          styles.pressed,
                      ]}
                    >
                      {deleting ? (
                        <ActivityIndicator
                          size="small"
                          color="#A34848"
                        />
                      ) : (
                        <Text style={styles.addressDeleteText}>
                          Delete
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>
          Notifications
        </Text>

        <View
          style={styles.notificationCard}
        >
          <View
            style={styles.notificationTop}
          >
            <View
              style={[
                styles.notificationIcon,
                notificationsEnabled &&
                  styles.notificationIconEnabled,
                permissionState === "denied" &&
                  styles.notificationIconBlocked,
              ]}
            >
              <Ionicons
                name={notificationIcon}
                size={23}
                color={
                  notificationsEnabled
                    ? "#245C42"
                    : permissionState ===
                        "denied"
                      ? "#A34848"
                      : "#5C7165"
                }
              />
            </View>

            <View
              style={
                styles.notificationContent
              }
            >
              <View
                style={
                  styles.notificationTitleRow
                }
              >
                <Text
                  style={
                    styles.notificationTitle
                  }
                >
                  Push notifications
                </Text>

                <View
                  style={[
                    styles.notificationStatusBadge,
                    notificationsEnabled
                      ? styles.notificationStatusEnabled
                      : permissionState ===
                            "denied" ||
                          permissionState ===
                            "error"
                        ? styles.notificationStatusError
                        : styles.notificationStatusIdle,
                  ]}
                >
                  {registering ? (
                    <ActivityIndicator
                      size="small"
                      color="#245C42"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.notificationStatusText,
                        notificationsEnabled
                          ? styles.notificationStatusTextEnabled
                          : permissionState ===
                                "denied" ||
                              permissionState ===
                                "error"
                            ? styles.notificationStatusTextError
                            : styles.notificationStatusTextIdle,
                      ]}
                    >
                      {notificationStatus}
                    </Text>
                  )}
                </View>
              </View>

              <Text
                style={
                  styles.notificationDescription
                }
              >
                {notificationDescription}
              </Text>
            </View>
          </View>

          {pushError &&
          permissionState !==
            "denied" ? (
            <View
              style={styles.pushErrorBox}
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color="#9C4C4C"
              />

              <Text
                style={styles.pushErrorText}
              >
                {pushError}
              </Text>
            </View>
          ) : null}

          {notificationsEnabled &&
          tokenPreview ? (
            <View
              style={styles.tokenBox}
            >
              <View
                style={styles.tokenLabelRow}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={15}
                  color="#587063"
                />

                <Text
                  style={styles.tokenLabel}
                >
                  Registered device
                </Text>
              </View>

              <Text
                numberOfLines={1}
                selectable
                style={styles.tokenValue}
              >
                {tokenPreview}
              </Text>
            </View>
          ) : null}

          <View
            style={
              styles.notificationButtons
            }
          >
            {!notificationsEnabled &&
            permissionState !==
              "unsupported" ? (
              <Pressable
                disabled={
                  notificationBusy
                }
                onPress={() => {
                  void handleEnableNotifications();
                }}
                style={({ pressed }) => [
                  styles.notificationPrimaryButton,
                  notificationBusy &&
                    styles.disabledButton,
                  pressed &&
                    !notificationBusy &&
                    styles.pressed,
                ]}
              >
                {registering ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="notifications-outline"
                    size={17}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={
                    styles.notificationPrimaryButtonText
                  }
                >
                  {registering
                    ? "Enabling..."
                    : "Enable notifications"}
                </Text>
              </Pressable>
            ) : null}

            {notificationsEnabled ? (
              <Pressable
                disabled={
                  notificationBusy
                }
                onPress={() => {
                  void handleSendTestNotification();
                }}
                style={({ pressed }) => [
                  styles.notificationPrimaryButton,
                  notificationBusy &&
                    styles.disabledButton,
                  pressed &&
                    !notificationBusy &&
                    styles.pressed,
                ]}
              >
                {testing ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="paper-plane-outline"
                    size={17}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={
                    styles.notificationPrimaryButtonText
                  }
                >
                  {testing
                    ? "Sending..."
                    : "Send test"}
                </Text>
              </Pressable>
            ) : null}

            {(permissionState ===
              "denied" ||
              permissionState ===
                "error" ||
              notificationsEnabled) &&
            Platform.OS !== "web" ? (
              <Pressable
                disabled={
                  notificationBusy
                }
                onPress={() => {
                  void openNotificationSettings();
                }}
                style={({ pressed }) => [
                  styles.notificationSecondaryButton,
                  notificationBusy &&
                    styles.disabledButton,
                  pressed &&
                    !notificationBusy &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={17}
                  color="#245C42"
                />

                <Text
                  style={
                    styles.notificationSecondaryButtonText
                  }
                >
                  Phone settings
                </Text>
              </Pressable>
            ) : null}

            {notificationsEnabled ? (
              <Pressable
                disabled={
                  notificationBusy
                }
                onPress={
                  confirmDisableNotifications
                }
                style={({ pressed }) => [
                  styles.notificationDangerButton,
                  notificationBusy &&
                    styles.disabledButton,
                  pressed &&
                    !notificationBusy &&
                    styles.pressed,
                ]}
              >
                {disabling ? (
                  <ActivityIndicator
                    size="small"
                    color="#A34848"
                  />
                ) : (
                  <Ionicons
                    name="notifications-off-outline"
                    size={17}
                    color="#A34848"
                  />
                )}

                <Text
                  style={
                    styles.notificationDangerButtonText
                  }
                >
                  {disabling
                    ? "Disabling..."
                    : "Disable"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {notificationsEnabled ? (
            <Text
              style={styles.notificationNote}
            >
              Disabling removes this device
              from your account. Use phone
              settings to keep notifications
              permanently blocked.
            </Text>
          ) : null}
        </View>

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

function AddressEditCard({
  form,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  form: AddressEditForm;
  saving: boolean;
  onChange: <
    Key extends keyof AddressEditForm,
  >(
    key: Key,
    value: AddressEditForm[Key]
  ) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.addressEditCard}>
      <View style={styles.addressEditHeader}>
        <View style={styles.savedAddressIcon}>
          <Ionicons
            name="create-outline"
            size={20}
            color="#35694E"
          />
        </View>

        <View style={styles.savedAddressContent}>
          <Text style={styles.savedAddressTitle}>
            Edit saved address
          </Text>

          <Text style={styles.savedAddressMeta}>
            Update the details shown during checkout.
          </Text>
        </View>
      </View>

      <EditInput
        label="Label"
        value={form.label}
        onChangeText={(value) =>
          onChange("label", value)
        }
        placeholder="Home, Office, Hostel"
      />

      <EditInput
        label="Full name"
        value={form.fullName}
        onChangeText={(value) =>
          onChange("fullName", value)
        }
        placeholder="Customer name"
      />

      <EditInput
        label="Mobile number"
        value={form.phone}
        onChangeText={(value) =>
          onChange(
            "phone",
            normalisePhone(value)
          )
        }
        placeholder="10-digit mobile number"
        keyboardType="phone-pad"
        maxLength={10}
      />

      <EditInput
        label="Pincode"
        value={form.pincode}
        onChangeText={(value) =>
          onChange(
            "pincode",
            normalisePincode(value)
          )
        }
        placeholder="6-digit pincode"
        keyboardType="number-pad"
        maxLength={6}
      />

      <EditInput
        label="House, flat or building"
        value={form.houseDetails}
        onChangeText={(value) =>
          onChange(
            "houseDetails",
            value
          )
        }
        placeholder="Flat number, house or building"
      />

      <EditInput
        label="Area and street"
        value={form.areaDetails}
        onChangeText={(value) =>
          onChange(
            "areaDetails",
            value
          )
        }
        placeholder="Area, street or locality"
        multiline
      />

      <EditInput
        label="Landmark"
        value={form.landmark}
        onChangeText={(value) =>
          onChange("landmark", value)
        }
        placeholder="Nearby landmark"
      />

      <View style={styles.editTwoColumn}>
        <View style={styles.editColumn}>
          <EditInput
            label="Area"
            value={form.area}
            onChangeText={(value) =>
              onChange("area", value)
            }
            placeholder="Area"
          />
        </View>

        <View style={styles.editColumn}>
          <EditInput
            label="City"
            value={form.city}
            onChangeText={(value) =>
              onChange("city", value)
            }
            placeholder="City"
          />
        </View>
      </View>

      <Pressable
        onPress={() =>
          onChange(
            "isDefault",
            !form.isDefault
          )
        }
        style={({ pressed }) => [
          styles.defaultToggle,
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.defaultCheckbox,
            form.isDefault &&
              styles.defaultCheckboxChecked,
          ]}
        >
          {form.isDefault ? (
            <Ionicons
              name="checkmark"
              size={15}
              color="#FFFFFF"
            />
          ) : null}
        </View>

        <View style={styles.defaultToggleTextContent}>
          <Text style={styles.defaultToggleTitle}>
            Make this my default address
          </Text>

          <Text style={styles.defaultToggleDescription}>
            Checkout will automatically select this address.
          </Text>
        </View>
      </Pressable>

      <View style={styles.editActions}>
        <Pressable
          disabled={saving}
          onPress={onCancel}
          style={({ pressed }) => [
            styles.editCancelButton,
            saving &&
              styles.disabledButton,
            pressed &&
              !saving &&
              styles.pressed,
          ]}
        >
          <Text style={styles.editCancelText}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          disabled={saving}
          onPress={onSave}
          style={({ pressed }) => [
            styles.editSaveButton,
            saving &&
              styles.disabledButton,
            pressed &&
              !saving &&
              styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.editSaveText}>
              Save changes
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function EditInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View style={styles.editInputGroup}>
      <Text style={styles.editInputLabel}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9EA9A2"
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={
          multiline ? "top" : "center"
        }
        style={[
          styles.editInput,
          multiline &&
            styles.editInputMultiline,
        ]}
      />
    </View>
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

  addressBookCard: {
    padding: 15,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
  },

  emptyAddressState: {
    paddingVertical: 18,
    alignItems: "center",
  },

  emptyAddressIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyAddressTitle: {
    color: "#26372E",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
  },

  emptyAddressDescription: {
    color: "#747F78",
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 5,
  },

  addAddressButton: {
    minHeight: 42,
    paddingHorizontal: 17,
    borderRadius: 14,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  addAddressButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  savedAddressItem: {
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#F5F8F5",
    borderWidth: 1,
    borderColor: "#E1E7E1",
    marginBottom: 10,
  },

  savedAddressTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  savedAddressIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  savedAddressContent: {
    flex: 1,
    marginLeft: 11,
  },

  savedAddressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  savedAddressTitle: {
    color: "#26372E",
    fontSize: 12,
    fontWeight: "900",
  },

  defaultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#DDEBDD",
  },

  defaultBadgeText: {
    color: "#245C42",
    fontSize: 7,
    fontWeight: "900",
  },

  savedAddressName: {
    color: "#506158",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 5,
  },

  savedAddressText: {
    color: "#6C7770",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
  },

  savedAddressMeta: {
    color: "#7B857F",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 3,
  },

  savedAddressActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  addressActionButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: "#E7EFE8",
    borderWidth: 1,
    borderColor: "#D7E3D9",
    alignItems: "center",
    justifyContent: "center",
  },

  addressActionText: {
    color: "#245C42",
    fontSize: 8,
    fontWeight: "900",
  },

  addressDeleteButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: "#FAECEC",
    borderWidth: 1,
    borderColor: "#F0D7D7",
    alignItems: "center",
    justifyContent: "center",
  },

  addressDeleteText: {
    color: "#A34848",
    fontSize: 8,
    fontWeight: "900",
  },

  addressEditCard: {
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#F5F8F5",
    borderWidth: 1,
    borderColor: "#D9E5DC",
    marginBottom: 10,
  },

  addressEditHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  editInputGroup: {
    marginBottom: 10,
  },

  editInputLabel: {
    color: "#4E5A53",
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 6,
  },

  editInput: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE5DF",
    color: "#26372E",
    fontSize: 11,
    fontWeight: "600",
  },

  editInputMultiline: {
    minHeight: 74,
    paddingTop: 12,
  },

  editTwoColumn: {
    flexDirection: "row",
    gap: 9,
  },

  editColumn: {
    flex: 1,
  },

  defaultToggle: {
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#EEF5EF",
    borderWidth: 1,
    borderColor: "#D8E5DA",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },

  defaultCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFCBC3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  defaultCheckboxChecked: {
    backgroundColor: "#245C42",
    borderColor: "#245C42",
  },

  defaultToggleTextContent: {
    flex: 1,
  },

  defaultToggleTitle: {
    color: "#26372E",
    fontSize: 10,
    fontWeight: "900",
  },

  defaultToggleDescription: {
    color: "#6F7A73",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 3,
  },

  editActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 13,
  },

  editCancelButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#E8EEE8",
    alignItems: "center",
    justifyContent: "center",
  },

  editCancelText: {
    color: "#245C42",
    fontSize: 9,
    fontWeight: "900",
  },

  editSaveButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  editSaveText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  notificationCard: {
    padding: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7E1",
  },

  notificationTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EDF1ED",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationIconEnabled: {
    backgroundColor: "#DDECDD",
  },

  notificationIconBlocked: {
    backgroundColor: "#FAEAEA",
  },

  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },

  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },

  notificationTitle: {
    flexShrink: 1,
    color: "#26372E",
    fontSize: 13,
    fontWeight: "900",
  },

  notificationStatusBadge: {
    minHeight: 23,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationStatusEnabled: {
    backgroundColor: "#DDECDD",
  },

  notificationStatusIdle: {
    backgroundColor: "#EDF0ED",
  },

  notificationStatusError: {
    backgroundColor: "#FAEAEA",
  },

  notificationStatusText: {
    fontSize: 8,
    fontWeight: "900",
  },

  notificationStatusTextEnabled: {
    color: "#245C42",
  },

  notificationStatusTextIdle: {
    color: "#68746D",
  },

  notificationStatusTextError: {
    color: "#A34848",
  },

  notificationDescription: {
    color: "#6E7972",
    fontSize: 9,
    lineHeight: 15,
    marginTop: 6,
  },

  pushErrorBox: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#FAEDED",
    borderWidth: 1,
    borderColor: "#F0D6D6",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 13,
  },

  pushErrorText: {
    flex: 1,
    color: "#8C4747",
    fontSize: 8,
    lineHeight: 13,
  },

  tokenBox: {
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#F1F5F1",
    borderWidth: 1,
    borderColor: "#E0E7E0",
    marginTop: 13,
  },

  tokenLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  tokenLabel: {
    color: "#587063",
    fontSize: 8,
    fontWeight: "900",
  },

  tokenValue: {
    color: "#526159",
    fontSize: 8,
    marginTop: 7,
  },

  notificationButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 14,
  },

  notificationPrimaryButton: {
    minHeight: 45,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  notificationPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  notificationSecondaryButton: {
    minHeight: 45,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#E7EFE8",
    borderWidth: 1,
    borderColor: "#D7E3D9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  notificationSecondaryButtonText: {
    color: "#245C42",
    fontSize: 9,
    fontWeight: "900",
  },

  notificationDangerButton: {
    minHeight: 45,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#FAECEC",
    borderWidth: 1,
    borderColor: "#F0D7D7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  notificationDangerButtonText: {
    color: "#A34848",
    fontSize: 9,
    fontWeight: "900",
  },

  notificationNote: {
    color: "#7B857F",
    fontSize: 8,
    lineHeight: 13,
    marginTop: 12,
  },

  disabledButton: {
    opacity: 0.5,
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