import {
  Platform,
} from "react-native";

import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export type PushPermissionState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported"
  | "error";

export type NativePushRegistration = {
  expoPushToken: string;
  projectId: string;

  platform:
    | "ios"
    | "android"
    | "unknown";

  deviceId: string;
  deviceName: string;
  appVersion: string;
};

export class PushRegistrationError extends Error {
  code: string;

  constructor(
    code: string,
    message: string
  ) {
    super(message);

    this.name =
      "PushRegistrationError";

    this.code =
      code;
  }
}

/*
 * Display notifications while the app
 * is open in the foreground.
 */
Notifications.setNotificationHandler({
  handleNotification:
    async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

function cleanText(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function getProjectId() {
  const extra =
    Constants.expoConfig
      ?.extra as
      | {
          eas?: {
            projectId?: string;
          };
        }
      | undefined;

  return cleanText(
    extra?.eas?.projectId ||
      Constants.easConfig
        ?.projectId ||
      process.env
        .EXPO_PUBLIC_EAS_PROJECT_ID
  );
}

function hasNotificationPermission(
  permission:
    Notifications.NotificationPermissionsStatus
) {
  if (
    Platform.OS === "ios"
  ) {
    const iosStatus =
      permission.ios?.status;

    return [
      Notifications
        .IosAuthorizationStatus
        .AUTHORIZED,

      Notifications
        .IosAuthorizationStatus
        .PROVISIONAL,

      Notifications
        .IosAuthorizationStatus
        .EPHEMERAL,
    ].includes(
      iosStatus as
        Notifications.IosAuthorizationStatus
    );
  }

  return (
    permission.status ===
    "granted"
  );
}

async function getDeviceId() {
  try {
    if (
      Platform.OS ===
      "android"
    ) {
      return (
        Application.getAndroidId() ||
        ""
      );
    }

    if (
      Platform.OS ===
      "ios"
    ) {
      return (
        (await Application.getIosIdForVendorAsync()) ||
        ""
      );
    }
  } catch {
    return "";
  }

  return "";
}

export async function configureAndroidNotificationChannels() {
  if (
    Platform.OS !==
    "android"
  ) {
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync(
      "default",
      {
        name:
          "General notifications",

        description:
          "Important bottle-ordering updates.",

        importance:
          Notifications
            .AndroidImportance
            .HIGH,

        sound:
          "default",

        enableVibrate:
          true,

        vibrationPattern: [
          0,
          250,
          250,
          250,
        ],

        showBadge:
          true,
      }
    ),

    Notifications.setNotificationChannelAsync(
      "orders",
      {
        name:
          "Order updates",

        description:
          "Payment, preparation and delivery updates.",

        importance:
          Notifications
            .AndroidImportance
            .HIGH,

        sound:
          "default",

        enableVibrate:
          true,

        showBadge:
          true,
      }
    ),

    Notifications.setNotificationChannelAsync(
      "subscriptions",
      {
        name:
          "Subscription updates",

        description:
          "Recurring payment and subscription delivery updates.",

        importance:
          Notifications
            .AndroidImportance
            .HIGH,

        sound:
          "default",

        enableVibrate:
          true,

        showBadge:
          true,
      }
    ),

    Notifications.setNotificationChannelAsync(
      "delivery",
      {
        name:
          "Delivery alerts",

        description:
          "New assignments and active delivery updates.",

        importance:
          Notifications
            .AndroidImportance
            .MAX,

        sound:
          "default",

        enableVibrate:
          true,

        vibrationPattern: [
          0,
          300,
          150,
          300,
        ],

        showBadge:
          true,
      }
    ),
  ]);
}

export async function registerForNativePushNotifications():
  Promise<NativePushRegistration> {
  if (
    Platform.OS === "web"
  ) {
    throw new PushRegistrationError(
      "unsupported_platform",
      "Mobile push notifications are available only in the iOS and Android apps."
    );
  }

  /*
   * Android 13 does not display its
   * notification permission prompt
   * until a notification channel exists.
   */
  await configureAndroidNotificationChannels();

  let permission =
    await Notifications.getPermissionsAsync();

  if (
    !hasNotificationPermission(
      permission
    )
  ) {
    permission =
      await Notifications.requestPermissionsAsync(
        Platform.OS === "ios"
          ? {
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
              },
            }
          : undefined
      );
  }

  if (
    !hasNotificationPermission(
      permission
    )
  ) {
    throw new PushRegistrationError(
      "permission_denied",
      "Notification permission was not granted. You can enable it later from your phone settings."
    );
  }

  const projectId =
    getProjectId();

  if (!projectId) {
    throw new PushRegistrationError(
      "project_id_missing",
      "Expo EAS project ID is missing. Run EAS project initialization before generating a push token."
    );
  }

  let expoPushToken =
    "";

  try {
    const result =
      await Notifications.getExpoPushTokenAsync(
        {
          projectId,
        }
      );

    expoPushToken =
      cleanText(
        result.data
      );
  } catch (error) {
    throw new PushRegistrationError(
      "token_generation_failed",
      error instanceof Error
        ? error.message
        : "Unable to generate an Expo push token."
    );
  }

  if (!expoPushToken) {
    throw new PushRegistrationError(
      "empty_push_token",
      "Expo returned an empty push token."
    );
  }

  const deviceId =
    await getDeviceId();

  const deviceName =
    cleanText(
      Device.deviceName ||
        Device.modelName ||
        Application.applicationName ||
        `${Platform.OS} device`
    );

  const appVersion =
    cleanText(
      Application
        .nativeApplicationVersion ||
        Constants.expoConfig
          ?.version ||
        "development"
    );

  const platform:
    | "ios"
    | "android"
    | "unknown" =
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS ===
          "android"
        ? "android"
        : "unknown";

  return {
    expoPushToken,
    projectId,
    platform,
    deviceId,
    deviceName,
    appVersion,
  };
}

export async function clearApplicationBadge() {
  if (
    Platform.OS === "web"
  ) {
    return false;
  }

  try {
    return await Notifications.setBadgeCountAsync(
      0
    );
  } catch {
    return false;
  }
}

export async function scheduleLocalPushTest() {
  if (
    Platform.OS === "web"
  ) {
    throw new Error(
      "Local notifications are available only in the mobile app."
    );
  }

  await Notifications.scheduleNotificationAsync(
    {
      content: {
        title:
          "Bottle notification test",

        body:
          "Local notifications are working on this device.",

        sound:
          "default",

        data: {
          route:
            "/notifications",

          type:
            "local_push_test",
        },
      },

      trigger: null,
    }
  );
}