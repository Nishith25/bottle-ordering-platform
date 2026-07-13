import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useRouter,
} from "expo-router";

import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  usePushNotifications,
} from "../context/PushNotificationContext";

function formatStatus(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function showMessage(
  title: string,
  message: string
) {
  if (
    Platform.OS === "web" &&
    typeof window !==
      "undefined"
  ) {
    window.alert(
      `${title}\n\n${message}`
    );

    return;
  }

  Alert.alert(
    title,
    message
  );
}

/**
 * Remote push responses differ between:
 *
 * - Expo native push
 * - Browser Web Push
 *
 * This helper safely reads the first available numeric field without
 * assuming every result type contains acceptedCount or failedCount.
 */
function getNumericResultValue(
  result: unknown,
  fieldNames: string[]
) {
  if (
    !result ||
    typeof result !==
      "object"
  ) {
    return 0;
  }

  const record =
    result as Record<
      string,
      unknown
    >;

  for (
    const fieldName of
    fieldNames
  ) {
    const value =
      record[fieldName];

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      return value;
    }
  }

  return 0;
}

export default function PushNotificationTestScreen() {
  const router =
    useRouter();

  const {
    permissionState,
    expoPushToken,
    error,
    registering,
    testing,
    disabling,
    registerCurrentDevice,
    sendRemoteTest,
    sendLocalTest,
    disableCurrentDevice,
  } = usePushNotifications();

  const enableNotifications =
    async () => {
      const result =
        await registerCurrentDevice();

      if (result) {
        showMessage(
          "Notifications enabled",
          Platform.OS === "web"
            ? "This browser is now registered for Web Push notifications."
            : "This device is now registered for push notifications."
        );
      }
    };

  const testLocalNotification =
    async () => {
      try {
        await sendLocalTest();
      } catch {
        return;
      }
    };

  const testRemoteNotification =
    async () => {
      const result =
        await sendRemoteTest();

      if (!result) {
        return;
      }

      if (
        result.status ===
        "no_tokens"
      ) {
        showMessage(
          "No registered device",
          "The backend could not find an active notification subscription for this account."
        );

        return;
      }

      const acceptedCount =
        getNumericResultValue(
          result,
          [
            "acceptedCount",
            "sentCount",
            "successCount",
            "successfulCount",
          ]
        );

      const failedCount =
        getNumericResultValue(
          result,
          [
            "failedCount",
            "rejectedCount",
            "errorCount",
          ]
        );

      showMessage(
        "Test submitted",
        `Status: ${formatStatus(
          result.status
        )}\nAccepted: ${acceptedCount}\nFailed: ${failedCount}`
      );
    };

  const disableNotifications =
    async () => {
      const disabled =
        await disableCurrentDevice();

      if (disabled) {
        showMessage(
          "Notifications disabled",
          Platform.OS === "web"
            ? "This browser was removed from your Web Push subscriptions."
            : "This device was removed from your push-notification account."
        );
      }
    };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.header}
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#25372D"
          />
        </Pressable>

        <View>
          <Text
            style={styles.headerTitle}
          >
            Push notifications
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Development testing
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={styles.heroCard}
        >
          <View
            style={styles.heroIcon}
          >
            <Ionicons
              name="notifications-outline"
              size={28}
              color="#245C42"
            />
          </View>

          <Text
            style={styles.eyebrow}
          >
            IOS, ANDROID &amp; WEB
          </Text>

          <Text
            style={styles.title}
          >
            Notification testing
          </Text>

          <Text
            style={
              styles.description
            }
          >
            Register this device or browser and test local notifications
            and remote notifications sent through the backend.
          </Text>
        </View>

        <View
          style={styles.statusCard}
        >
          <View>
            <Text
              style={styles.statusLabel}
            >
              PERMISSION STATUS
            </Text>

            <Text
              style={styles.statusValue}
            >
              {formatStatus(
                permissionState
              )}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,

              permissionState ===
                "granted" &&
                styles.statusGranted,

              permissionState ===
                "denied" &&
                styles.statusDenied,
            ]}
          >
            <Ionicons
              name={
                permissionState ===
                "granted"
                  ? "checkmark-circle"
                  : permissionState ===
                      "denied"
                    ? "close-circle"
                    : "time-outline"
              }
              size={18}
              color={
                permissionState ===
                "granted"
                  ? "#2F714B"
                  : permissionState ===
                      "denied"
                    ? "#A34A4A"
                    : "#82621F"
              }
            />
          </View>
        </View>

        {error ? (
          <View
            style={styles.errorCard}
          >
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color="#A34848"
            />

            <Text
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {expoPushToken ? (
          <View
            style={styles.tokenCard}
          >
            <Text
              style={styles.tokenLabel}
            >
              EXPO PUSH TOKEN
            </Text>

            <Text
              selectable
              style={styles.tokenValue}
            >
              {expoPushToken}
            </Text>
          </View>
        ) : null}

        <ActionButton
          icon="notifications-outline"
          label={
            registering
              ? "Enabling notifications..."
              : "Enable notifications"
          }
          disabled={registering}
          primary
          onPress={() => {
            void enableNotifications();
          }}
        />

        <ActionButton
          icon="phone-portrait-outline"
          label="Show local notification"
          disabled={
            permissionState !==
            "granted"
          }
          onPress={() => {
            void testLocalNotification();
          }}
        />

        <ActionButton
          icon="cloud-download-outline"
          label={
            testing
              ? "Sending remote test..."
              : "Send backend push test"
          }
          disabled={
            testing ||
            permissionState !==
              "granted"
          }
          onPress={() => {
            void testRemoteNotification();
          }}
        />

        <ActionButton
          icon="notifications-off-outline"
          label={
            disabling
              ? "Disabling..."
              : "Disable on this device"
          }
          disabled={
            disabling ||
            (
              Platform.OS !==
                "web" &&
              !expoPushToken
            )
          }
          danger
          onPress={() => {
            void disableNotifications();
          }}
        />

        <View
          style={styles.noteCard}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#35694E"
          />

          <Text
            style={styles.noteText}
          >
            Native remote notifications require an Android or iOS build
            with valid push credentials. Web Push requires a supported
            browser and notification permission. On iPhone, Web Push
            requires the app to be installed on the Home Screen.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  disabled,
  primary = false,
  danger = false,
  onPress,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;

  label: string;
  disabled: boolean;
  primary?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,

        primary &&
          styles.primaryButton,

        danger &&
          styles.dangerButton,

        disabled &&
          styles.disabledButton,

        pressed &&
          !disabled &&
          styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={
          primary
            ? "#FFFFFF"
            : danger
              ? "#984848"
              : "#245C42"
        }
      />

      <Text
        style={[
          styles.actionText,

          primary &&
            styles.primaryText,

          danger &&
            styles.dangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F7F7F2",
    },

    header: {
      minHeight: 68,
      paddingHorizontal: 18,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E3E7E1",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    backButton: {
      width: 42,
      height: 42,
      borderWidth: 1,
      borderColor:
        "#DDE4DE",
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
    },

    headerTitle: {
      color: "#1D2922",
      fontSize: 17,
      fontWeight: "900",
    },

    headerSubtitle: {
      color: "#748078",
      fontSize: 9,
      marginTop: 3,
    },

    content: {
      width: "100%",
      maxWidth: 650,
      alignSelf: "center",
      padding: 20,
      paddingBottom: 80,
    },

    heroCard: {
      padding: 21,
      borderRadius: 25,
      backgroundColor:
        "#E7F0E9",
    },

    heroIcon: {
      width: 53,
      height: 53,
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
    },

    eyebrow: {
      color: "#4D765F",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginTop: 17,
    },

    title: {
      color: "#1D3025",
      fontSize: 22,
      fontWeight: "900",
      marginTop: 7,
    },

    description: {
      color: "#657269",
      fontSize: 10,
      lineHeight: 17,
      marginTop: 8,
    },

    statusCard: {
      marginTop: 14,
      padding: 16,
      borderWidth: 1,
      borderColor:
        "#DFE5DF",
      borderRadius: 19,
      backgroundColor:
        "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    statusLabel: {
      color: "#758079",
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    statusValue: {
      color: "#203128",
      fontSize: 14,
      fontWeight: "900",
      marginTop: 5,
    },

    statusBadge: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        "#FFF0D2",
      alignItems: "center",
      justifyContent:
        "center",
    },

    statusGranted: {
      backgroundColor:
        "#E3F1E7",
    },

    statusDenied: {
      backgroundColor:
        "#FAE8E8",
    },

    errorCard: {
      marginTop: 12,
      padding: 13,
      borderRadius: 15,
      backgroundColor:
        "#FAEAEA",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    errorText: {
      flex: 1,
      color: "#934747",
      fontSize: 9,
      lineHeight: 15,
    },

    tokenCard: {
      marginTop: 12,
      padding: 15,
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#DFE5DF",
    },

    tokenLabel: {
      color: "#758079",
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    tokenValue: {
      color: "#31483B",
      fontSize: 8,
      lineHeight: 13,
      marginTop: 8,
    },

    actionButton: {
      minHeight: 51,
      marginTop: 11,
      paddingHorizontal: 15,
      borderWidth: 1,
      borderColor:
        "#BCD3C4",
      borderRadius: 16,
      backgroundColor:
        "#EFF5F0",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    primaryButton: {
      borderColor:
        "#245C42",
      backgroundColor:
        "#245C42",
    },

    dangerButton: {
      borderColor:
        "#E9CACA",
      backgroundColor:
        "#FAECEC",
    },

    actionText: {
      color: "#245C42",
      fontSize: 10,
      fontWeight: "900",
    },

    primaryText: {
      color: "#FFFFFF",
    },

    dangerText: {
      color: "#984848",
    },

    disabledButton: {
      opacity: 0.5,
    },

    pressed: {
      opacity: 0.84,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    noteCard: {
      marginTop: 17,
      padding: 14,
      borderRadius: 17,
      backgroundColor:
        "#E8F0EA",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },

    noteText: {
      flex: 1,
      color: "#5F6E65",
      fontSize: 8,
      lineHeight: 14,
    },
  });