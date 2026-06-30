import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Platform } from "react-native";

import * as Notifications from "expo-notifications";

import { useAuth } from "./AuthContext";

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

type PushNotificationContextValue = {
  permissionState: PushPermissionState;

  expoPushToken: string | null;

  lastNotification:
    Notifications.Notification | null;

  error: string | null;

  registering: boolean;
  testing: boolean;
  disabling: boolean;

  registerCurrentDevice:
    () => Promise<string | null>;

  sendRemoteTest:
    () => Promise<PushTestResult | null>;

  sendLocalTest:
    () => Promise<void>;

  disableCurrentDevice:
    () => Promise<boolean>;
};

type RegistrationPromiseRecord = {
  authToken: string;
  promise: Promise<string | null>;
};

const PushNotificationContext =
  createContext<
    PushNotificationContextValue | undefined
  >(undefined);

export function PushNotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    token,
    loading: authLoading,
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
    useState<string | null>(
      null
    );

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
    useState<string | null>(
      null
    );

  const [
    registering,
    setRegistering,
  ] =
    useState(false);

  const [
    testing,
    setTesting,
  ] =
    useState(false);

  const [
    disabling,
    setDisabling,
  ] =
    useState(false);

  const registrationPromiseRef =
    useRef<
      RegistrationPromiseRecord | null
    >(null);

  const registeredAuthTokenRef =
    useRef<string | null>(
      null
    );

  const previousAuthTokenRef =
    useRef<string | null>(
      null
    );

  const currentAuthTokenRef =
    useRef<string | null>(
      token
    );

  const expoPushTokenRef =
    useRef<string | null>(
      null
    );

  /*
   * Keep the latest authentication and
   * Expo token values available inside
   * asynchronous callbacks.
   */
  useEffect(() => {
    currentAuthTokenRef.current =
      token;
  }, [token]);

  useEffect(() => {
    expoPushTokenRef.current =
      expoPushToken;
  }, [expoPushToken]);

  /*
   * Notification-tap navigation is now
   * handled by NotificationNavigationHandler.
   *
   * This listener only stores notifications
   * received while the application is open.
   */
  useEffect(() => {
    if (
      Platform.OS === "web"
    ) {
      return;
    }

    const receivedSubscription =
      Notifications.addNotificationReceivedListener(
        (notification) => {
          setLastNotification(
            notification
          );
        }
      );

    return () => {
      receivedSubscription.remove();
    };
  }, []);

  const registerCurrentDevice =
    useCallback(
      async (): Promise<
        string | null
      > => {
        if (
          Platform.OS === "web"
        ) {
          setPermissionState(
            "unsupported"
          );

          setError(
            "Remote push notifications are available only in the Android and iOS applications."
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

        const existingRegistration =
          registrationPromiseRef.current;

        if (
          existingRegistration &&
          existingRegistration.authToken ===
            token
        ) {
          return existingRegistration.promise;
        }

        const authTokenAtStart =
          token;

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

              /*
               * The user may have logged out while
               * native token generation was running.
               */
              if (
                currentAuthTokenRef.current !==
                authTokenAtStart
              ) {
                try {
                  await unregisterDevicePushToken(
                    authTokenAtStart,
                    nativeRegistration.expoPushToken
                  );
                } catch {
                  // Session cleanup must not crash the app.
                }

                return null;
              }

              await registerDevicePushToken(
                authTokenAtStart,
                nativeRegistration
              );

              /*
               * Check again because the backend
               * request may also take some time.
               */
              if (
                currentAuthTokenRef.current !==
                authTokenAtStart
              ) {
                try {
                  await unregisterDevicePushToken(
                    authTokenAtStart,
                    nativeRegistration.expoPushToken
                  );
                } catch {
                  // Session cleanup must not crash the app.
                }

                return null;
              }

              setExpoPushToken(
                nativeRegistration.expoPushToken
              );

              expoPushTokenRef.current =
                nativeRegistration.expoPushToken;

              registeredAuthTokenRef.current =
                authTokenAtStart;

              previousAuthTokenRef.current =
                authTokenAtStart;

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
                registrationError instanceof
                  Error
                  ? registrationError.message
                  : "Unable to enable push notifications."
              );

              return null;
            } finally {
              setRegistering(
                false
              );

              if (
                registrationPromiseRef
                  .current
                  ?.authToken ===
                authTokenAtStart
              ) {
                registrationPromiseRef.current =
                  null;
              }
            }
          })();

        registrationPromiseRef.current =
          {
            authToken:
              authTokenAtStart,

            promise:
              registrationPromise,
          };

        return registrationPromise;
      },
      [
        isAuthenticated,
        token,
      ]
    );

  /*
   * Automatically register the current
   * device whenever authentication is
   * restored or login succeeds.
   *
   * On logout, remove the device token
   * from the previous account.
   */
  useEffect(() => {
    if (authLoading) {
      return;
    }

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
      previousAuthToken
    ) {
      const pushTokenToRemove =
        expoPushTokenRef.current;

      const cleanupLoggedOutDevice =
        async () => {
          if (
            pushTokenToRemove
          ) {
            try {
              await unregisterDevicePushToken(
                previousAuthToken,
                pushTokenToRemove
              );
            } catch {
              /*
               * Logout must remain successful even
               * when the backend is unavailable.
               */
            }
          }

          setExpoPushToken(
            null
          );

          expoPushTokenRef.current =
            null;

          registeredAuthTokenRef.current =
            null;

          previousAuthTokenRef.current =
            null;

          registrationPromiseRef.current =
            null;

          setLastNotification(
            null
          );

          setError(null);

          setPermissionState(
            Platform.OS === "web"
              ? "unsupported"
              : "idle"
          );

          void clearApplicationBadge();
        };

      void cleanupLoggedOutDevice();
    }
  }, [
    authLoading,
    isAuthenticated,
    token,
    registerCurrentDevice,
  ]);

  const sendRemoteTest =
    useCallback(
      async (): Promise<
        PushTestResult | null
      > => {
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
            requestError instanceof
              Error
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
      async (): Promise<void> => {
        setError(null);

        try {
          await scheduleLocalPushTest();
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof
              Error
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
      async (): Promise<boolean> => {
        if (
          !token ||
          !expoPushTokenRef.current
        ) {
          return false;
        }

        const pushTokenToDisable =
          expoPushTokenRef.current;

        setDisabling(true);
        setError(null);

        try {
          const disabled =
            await unregisterDevicePushToken(
              token,
              pushTokenToDisable
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

            void clearApplicationBadge();
          }

          return disabled;
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof
              Error
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