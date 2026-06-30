import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Platform,
} from "react-native";

import * as Notifications from "expo-notifications";

import {
  useRouter,
} from "expo-router";

import {
  useAuth,
} from "./AuthContext";

import {
  registerDevicePushToken,
  sendCustomerTestPush,
  unregisterDevicePushToken,
  type PushTestResult,
} from "../services/pushNotificationApi";

import {
  clearApplicationBadge,
  PushRegistrationError,
  registerForNativePushNotifications,
  scheduleLocalPushTest,
  type PushPermissionState,
} from "../services/pushNotificationService";

type NotificationData =
  Record<
    string,
    unknown
  >;

type PushNotificationContextValue = {
  permissionState:
    PushPermissionState;

  expoPushToken:
    string | null;

  lastNotification:
    Notifications.Notification | null;

  error:
    string | null;

  registering:
    boolean;
  testing:
    boolean;
  disabling:
    boolean;

  registerCurrentDevice:
    () => Promise<
      string | null
    >;

  sendRemoteTest:
    () => Promise<
      PushTestResult | null
    >;

  sendLocalTest:
    () => Promise<void>;

  disableCurrentDevice:
    () => Promise<boolean>;
};

const PushNotificationContext =
  createContext<
    PushNotificationContextValue | undefined
  >(undefined);

function cleanText(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function getDataValue(
  data:
    NotificationData,
  key: string
) {
  return cleanText(
    data[key]
  );
}

export function PushNotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router =
    useRouter();

  const {
    token,
    isAuthenticated,
  } = useAuth();

  const [
    permissionState,
    setPermissionState,
  ] =
    useState<PushPermissionState>(
      Platform.OS === "web"
        ? "unsupported"
        : "idle"
    );

  const [
    expoPushToken,
    setExpoPushToken,
  ] =
    useState<
      string | null
    >(null);

  const [
    lastNotification,
    setLastNotification,
  ] =
    useState<
      Notifications.Notification | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    registering,
    setRegistering,
  ] = useState(false);

  const [
    testing,
    setTesting,
  ] = useState(false);

  const [
    disabling,
    setDisabling,
  ] = useState(false);

  const registrationPromiseRef =
    useRef<
      Promise<
        string | null
      > | null
    >(null);

  const registeredAuthTokenRef =
    useRef<
      string | null
    >(null);

  const previousAuthTokenRef =
    useRef<
      string | null
    >(null);

  const expoPushTokenRef =
    useRef<
      string | null
    >(null);

  useEffect(() => {
    expoPushTokenRef.current =
      expoPushToken;
  }, [expoPushToken]);

  const openNotificationDestination =
    useCallback(
      (
        data:
          NotificationData
      ) => {
        const route =
          getDataValue(
            data,
            "route"
          ).toLowerCase();

        const action =
          getDataValue(
            data,
            "action"
          ).toLowerCase();

        const orderId =
          getDataValue(
            data,
            "orderId"
          );

        const subscriptionId =
          getDataValue(
            data,
            "subscriptionId"
          );

        if (
          route ===
            "/subscription-payment" &&
          subscriptionId
        ) {
          router.push({
            pathname:
              "/subscription-payment",

            params: {
              subscriptionId,
            },
          });

          return;
        }

        if (
          (
            route ===
              "/subscription-details" ||
            action ===
              "subscription_details"
          ) &&
          subscriptionId
        ) {
          router.push({
            pathname:
              "/subscription-details",

            params: {
              subscriptionId,
            },
          });

          return;
        }

        if (
          (
            route ===
              "/delivery-order" ||
            action ===
              "delivery_order"
          ) &&
          orderId
        ) {
          router.push({
            pathname:
              "/delivery-order",

            params: {
              orderId,
            },
          });

          return;
        }

        if (
          route === "/orders" ||
          route ===
            "/(tabs)/orders" ||
          action ===
            "orders" ||
          action ===
            "order"
        ) {
          router.push(
            "/orders"
          );

          return;
        }

        if (
          route === "/plans" ||
          route ===
            "/(tabs)/plans" ||
          action ===
            "subscriptions" ||
          action ===
            "subscription"
        ) {
          router.push(
            "/plans"
          );

          return;
        }

        router.push(
          "/notifications"
        );
      },
      [router]
    );

  const handleNotificationResponse =
    useCallback(
      (
        response:
          Notifications.NotificationResponse
      ) => {
        if (
          response.actionIdentifier !==
          Notifications.DEFAULT_ACTION_IDENTIFIER
        ) {
          return;
        }

        const data =
          response.notification
            .request.content
            .data as
            NotificationData;

        openNotificationDestination(
          data || {}
        );

        void clearApplicationBadge();

        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          // Nothing else is required.
        }
      },
      [
        openNotificationDestination,
      ]
    );

  /*
   * Listen for notifications received
   * while open and notification taps.
   */
  useEffect(() => {
    if (
      Platform.OS ===
      "web"
    ) {
      return;
    }

    const receivedSubscription =
      Notifications.addNotificationReceivedListener(
        (
          notification
        ) => {
          setLastNotification(
            notification
          );
        }
      );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    /*
     * Handle a notification that opened
     * the app from a completely closed
     * state.
     */
    void Notifications.getLastNotificationResponseAsync()
      .then(
        (
          response
        ) => {
          if (response) {
            handleNotificationResponse(
              response
            );
          }
        }
      )
      .catch(() => {
        // No previous response is available.
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [
    handleNotificationResponse,
  ]);

  const registerCurrentDevice =
    useCallback(
      async () => {
        if (
          Platform.OS ===
          "web"
        ) {
          setPermissionState(
            "unsupported"
          );

          setError(
            "Remote push notifications must be tested in the Android or iOS app."
          );

          return null;
        }

        if (
          !isAuthenticated ||
          !token
        ) {
          setError(
            "Log in before enabling notifications."
          );

          return null;
        }

        if (
          registeredAuthTokenRef.current ===
            token &&
          expoPushTokenRef.current
        ) {
          return expoPushTokenRef.current;
        }

        if (
          registrationPromiseRef.current
        ) {
          return registrationPromiseRef.current;
        }

        const registrationPromise =
          (async () => {
            setRegistering(true);

            setPermissionState(
              "requesting"
            );

            setError(null);

            try {
              const nativeRegistration =
                await registerForNativePushNotifications();

              await registerDevicePushToken(
                token,
                nativeRegistration
              );

              setExpoPushToken(
                nativeRegistration.expoPushToken
              );

              expoPushTokenRef.current =
                nativeRegistration.expoPushToken;

              registeredAuthTokenRef.current =
                token;

              setPermissionState(
                "granted"
              );

              return nativeRegistration.expoPushToken;
            } catch (
              registrationError
            ) {
              if (
                registrationError instanceof
                PushRegistrationError
              ) {
                if (
                  registrationError.code ===
                  "permission_denied"
                ) {
                  setPermissionState(
                    "denied"
                  );
                } else if (
                  registrationError.code ===
                  "unsupported_platform"
                ) {
                  setPermissionState(
                    "unsupported"
                  );
                } else {
                  setPermissionState(
                    "error"
                  );
                }

                setError(
                  registrationError.message
                );

                return null;
              }

              setPermissionState(
                "error"
              );

              setError(
                registrationError instanceof Error
                  ? registrationError.message
                  : "Unable to enable push notifications."
              );

              return null;
            } finally {
              setRegistering(
                false
              );

              registrationPromiseRef.current =
                null;
            }
          })();

        registrationPromiseRef.current =
          registrationPromise;

        return registrationPromise;
      },
      [
        isAuthenticated,
        token,
      ]
    );

  /*
   * Register whenever an authenticated
   * customer or delivery partner opens
   * the app.
   *
   * When they log out during the same
   * session, remove this device token
   * from their account.
   */
  useEffect(() => {
    const previousAuthToken =
      previousAuthTokenRef.current;

    if (
      isAuthenticated &&
      token
    ) {
      previousAuthTokenRef.current =
        token;

      void registerCurrentDevice();

      return;
    }

    if (
      !isAuthenticated &&
      previousAuthToken &&
      expoPushTokenRef.current
    ) {
      const pushTokenToRemove =
        expoPushTokenRef.current;

      void unregisterDevicePushToken(
        previousAuthToken,
        pushTokenToRemove
      )
        .catch(() => {
          // Logout should not be blocked.
        })
        .finally(() => {
          setExpoPushToken(
            null
          );

          expoPushTokenRef.current =
            null;

          registeredAuthTokenRef.current =
            null;

          previousAuthTokenRef.current =
            null;

          setPermissionState(
            "idle"
          );
        });
    }
  }, [
    isAuthenticated,
    token,
    registerCurrentDevice,
  ]);

  const sendRemoteTest =
    useCallback(
      async () => {
        if (
          !token ||
          !isAuthenticated
        ) {
          setError(
            "Log in before sending a test notification."
          );

          return null;
        }

        setTesting(true);
        setError(null);

        try {
          if (
            !expoPushTokenRef.current
          ) {
            const registeredToken =
              await registerCurrentDevice();

            if (
              !registeredToken
            ) {
              return null;
            }
          }

          return await sendCustomerTestPush(
            token
          );
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to send the test notification."
          );

          return null;
        } finally {
          setTesting(false);
        }
      },
      [
        token,
        isAuthenticated,
        registerCurrentDevice,
      ]
    );

  const sendLocalTest =
    useCallback(
      async () => {
        setError(null);

        try {
          await scheduleLocalPushTest();
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to show the local notification."
          );

          throw requestError;
        }
      },
      []
    );

  const disableCurrentDevice =
    useCallback(
      async () => {
        if (
          !token ||
          !expoPushTokenRef.current
        ) {
          return false;
        }

        setDisabling(true);
        setError(null);

        try {
          const disabled =
            await unregisterDevicePushToken(
              token,
              expoPushTokenRef.current
            );

          if (disabled) {
            setExpoPushToken(
              null
            );

            expoPushTokenRef.current =
              null;

            registeredAuthTokenRef.current =
              null;

            setPermissionState(
              "idle"
            );
          }

          return disabled;
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to disable notifications on this device."
          );

          return false;
        } finally {
          setDisabling(false);
        }
      },
      [token]
    );

  return (
    <PushNotificationContext.Provider
      value={{
        permissionState,
        expoPushToken,
        lastNotification,
        error,
        registering,
        testing,
        disabling,
        registerCurrentDevice,
        sendRemoteTest,
        sendLocalTest,
        disableCurrentDevice,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const context =
    useContext(
      PushNotificationContext
    );

  if (!context) {
    throw new Error(
      "usePushNotifications must be used inside PushNotificationProvider."
    );
  }

  return context;
}