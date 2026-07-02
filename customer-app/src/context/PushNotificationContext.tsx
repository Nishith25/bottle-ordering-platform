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

import {
  getWebPushPublicKey,
  registerBrowserWebPushSubscription,
  sendCustomerWebPushTest,
  unregisterBrowserWebPushSubscription,
  type WebPushTestResult,
} from "../services/webPushApi";

import {
  getCurrentWebNotificationPermission,
  getExistingWebPushSubscription,
  getWebPushDeviceName,
  getWebPushPlatform,
  getWebPushSupport,
  getWebPushUserAgent,
  registerForWebPushNotifications,
  requestWebPushPermission,
  unsubscribeFromWebPushNotifications,
  WebPushRegistrationError,
} from "../services/webPushNotificationService";

type RemotePushTestResult =
  | PushTestResult
  | WebPushTestResult;

type PushNotificationContextValue = {
  permissionState:
    PushPermissionState;

  /*
   * Native: Expo token.
   * Web: Web Push endpoint.
   */
  expoPushToken:
    string | null;

  lastNotification:
    Notifications.Notification |
    null;

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
      RemotePushTestResult |
      null
    >;

  sendLocalTest:
    () => Promise<void>;

  disableCurrentDevice:
    () => Promise<boolean>;
};

type RegistrationPromiseRecord = {
  authToken: string;

  promise:
    Promise<string | null>;
};

const PushNotificationContext =
  createContext<
    PushNotificationContextValue |
    undefined
  >(undefined);

function getInitialPermissionState():
  PushPermissionState {
  if (
    Platform.OS !== "web"
  ) {
    return "idle";
  }

  const support =
    getWebPushSupport();

  if (!support.supported) {
    return "unsupported";
  }

  const permission =
    getCurrentWebNotificationPermission();

  if (
    permission === "denied"
  ) {
    return "denied";
  }

  return "idle";
}

export function PushNotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    token,

    loading:
      authLoading,

    isAuthenticated,
  } = useAuth();

  const [
    permissionState,

    setPermissionState,
  ] =
    useState<PushPermissionState>(
      getInitialPermissionState
    );

  /*
   * Existing Account screen
   * compatibility:
   *
   * Native platforms store the
   * Expo push token here.
   *
   * Web stores the browser push
   * subscription endpoint here.
   */
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
      Notifications.Notification |
      null
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

  const currentAuthTokenRef =
    useRef<string | null>(
      token
    );

  const previousAuthTokenRef =
    useRef<string | null>(
      null
    );

  const registeredAuthTokenRef =
    useRef<string | null>(
      null
    );

  const registeredIdentifierRef =
    useRef<string | null>(
      null
    );

  const registrationPromiseRef =
    useRef<
      RegistrationPromiseRecord |
      null
    >(null);

  useEffect(() => {
    currentAuthTokenRef.current =
      token;
  }, [token]);

  useEffect(() => {
    registeredIdentifierRef.current =
      expoPushToken;
  }, [expoPushToken]);

  /*
   * Native foreground listener.
   *
   * Web notifications are displayed
   * by public/sw.js.
   */
  useEffect(() => {
    if (
      Platform.OS === "web"
    ) {
      const support =
        getWebPushSupport();

      if (!support.supported) {
        setPermissionState(
          "unsupported"
        );

        setError(
          support.reason ===
          "not_installed"
            ? "Open SipBite from its iPhone Home Screen icon to enable notifications."
            : "This browser does not support Web Push notifications."
        );
      }

      return;
    }

    const receivedSubscription =
      Notifications
        .addNotificationReceivedListener(
          (
            notification
          ) => {
            setLastNotification(
              notification
            );
          }
        );

    return () => {
      receivedSubscription
        .remove();
    };
  }, []);

  const restoreExistingWebRegistration =
    useCallback(
      async (
        authToken:
          string
      ): Promise<
        string | null
      > => {
        if (
          Platform.OS !==
          "web"
        ) {
          return null;
        }

        const support =
          getWebPushSupport();

        if (!support.supported) {
          setPermissionState(
            "unsupported"
          );

          return null;
        }

        const existingSubscription =
          await getExistingWebPushSubscription();

        if (
          !existingSubscription
        ) {
          const permission =
            getCurrentWebNotificationPermission();

          setPermissionState(
            permission ===
            "denied"
              ? "denied"
              : "idle"
          );

          return null;
        }

        await registerBrowserWebPushSubscription(
          authToken,

          {
            subscription:
              existingSubscription,

            platform:
              getWebPushPlatform(),

            deviceName:
              getWebPushDeviceName(),

            userAgent:
              getWebPushUserAgent(),
          }
        );

        if (
          currentAuthTokenRef
            .current !==
          authToken
        ) {
          return null;
        }

        setExpoPushToken(
          existingSubscription
            .endpoint
        );

        registeredIdentifierRef.current =
          existingSubscription
            .endpoint;

        registeredAuthTokenRef.current =
          authToken;

        setPermissionState(
          "granted"
        );

        setError(null);

        return existingSubscription
          .endpoint;
      },

      []
    );

  const registerCurrentDevice =
    useCallback(
      async (): Promise<
        string | null
      > => {
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
          registeredAuthTokenRef
            .current ===
            token &&
          registeredIdentifierRef
            .current
        ) {
          return registeredIdentifierRef
            .current;
        }

        const activePromise =
          registrationPromiseRef
            .current;

        if (
          activePromise &&
          activePromise
            .authToken ===
            token
        ) {
          return activePromise
            .promise;
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
              if (
                Platform.OS ===
                "web"
              ) {
                /*
                 * This runs directly from
                 * the user's Enable button.
                 */
                await requestWebPushPermission();

                const publicKey =
                  await getWebPushPublicKey();

                const subscription =
                  await registerForWebPushNotifications(
                    publicKey
                  );

                if (
                  currentAuthTokenRef
                    .current !==
                  authTokenAtStart
                ) {
                  return null;
                }

                await registerBrowserWebPushSubscription(
                  authTokenAtStart,

                  {
                    subscription,

                    platform:
                      getWebPushPlatform(),

                    deviceName:
                      getWebPushDeviceName(),

                    userAgent:
                      getWebPushUserAgent(),
                  }
                );

                if (
                  currentAuthTokenRef
                    .current !==
                  authTokenAtStart
                ) {
                  try {
                    await unregisterBrowserWebPushSubscription(
                      authTokenAtStart,

                      subscription
                        .endpoint
                    );
                  } catch {
                    /*
                     * Session cleanup must
                     * not crash the app.
                     */
                  }

                  return null;
                }

                setExpoPushToken(
                  subscription
                    .endpoint
                );

                registeredIdentifierRef.current =
                  subscription
                    .endpoint;

                registeredAuthTokenRef.current =
                  authTokenAtStart;

                previousAuthTokenRef.current =
                  authTokenAtStart;

                setPermissionState(
                  "granted"
                );

                return subscription
                  .endpoint;
              }

              const nativeRegistration =
                await registerForNativePushNotifications();

              if (
                currentAuthTokenRef
                  .current !==
                authTokenAtStart
              ) {
                try {
                  await unregisterDevicePushToken(
                    authTokenAtStart,

                    nativeRegistration
                      .expoPushToken
                  );
                } catch {
                  /*
                   * Session cleanup must
                   * not crash the app.
                   */
                }

                return null;
              }

              await registerDevicePushToken(
                authTokenAtStart,

                nativeRegistration
              );

              if (
                currentAuthTokenRef
                  .current !==
                authTokenAtStart
              ) {
                try {
                  await unregisterDevicePushToken(
                    authTokenAtStart,

                    nativeRegistration
                      .expoPushToken
                  );
                } catch {
                  /*
                   * Session cleanup must
                   * not crash the app.
                   */
                }

                return null;
              }

              setExpoPushToken(
                nativeRegistration
                  .expoPushToken
              );

              registeredIdentifierRef.current =
                nativeRegistration
                  .expoPushToken;

              registeredAuthTokenRef.current =
                authTokenAtStart;

              previousAuthTokenRef.current =
                authTokenAtStart;

              setPermissionState(
                "granted"
              );

              return nativeRegistration
                .expoPushToken;
            } catch (
              registrationError
            ) {
              if (
                registrationError instanceof
                PushRegistrationError
              ) {
                setPermissionState(
                  registrationError
                    .code ===
                  "permission_denied"
                    ? "denied"
                    : registrationError
                          .code ===
                        "unsupported_platform"
                      ? "unsupported"
                      : "error"
                );

                setError(
                  registrationError
                    .message
                );

                return null;
              }

              if (
                registrationError instanceof
                WebPushRegistrationError
              ) {
                setPermissionState(
                  registrationError
                    .code ===
                  "permission_denied"
                    ? "denied"
                    : [
                          "unsupported_platform",
                          "not_installed",
                        ].includes(
                          registrationError
                            .code
                        )
                      ? "unsupported"
                      : "error"
                );

                setError(
                  registrationError
                    .message
                );

                return null;
              }

              setPermissionState(
                "error"
              );

              setError(
                registrationError instanceof
                  Error
                  ? registrationError
                      .message
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
   * Native devices are automatically
   * registered after login.
   *
   * Web restores an existing browser
   * subscription without opening an
   * automatic permission prompt.
   */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    const previousAuthToken =
      previousAuthTokenRef
        .current;

    if (
      isAuthenticated &&
      token
    ) {
      previousAuthTokenRef.current =
        token;

      if (
        Platform.OS === "web"
      ) {
        void restoreExistingWebRegistration(
          token
        ).catch(
          (
            restoreError
          ) => {
            setPermissionState(
              "error"
            );

            setError(
              restoreError instanceof
                Error
                ? restoreError
                    .message
                : "Unable to restore Web Push notifications."
            );
          }
        );
      } else {
        void registerCurrentDevice();
      }

      return;
    }

    if (
      !isAuthenticated &&
      previousAuthToken
    ) {
      const identifierToRemove =
        registeredIdentifierRef
          .current;

      const cleanupLoggedOutDevice =
        async () => {
          if (
            identifierToRemove
          ) {
            try {
              if (
                Platform.OS ===
                "web"
              ) {
                await unregisterBrowserWebPushSubscription(
                  previousAuthToken,

                  identifierToRemove
                );
              } else {
                await unregisterDevicePushToken(
                  previousAuthToken,

                  identifierToRemove
                );
              }
            } catch {
              /*
               * Logout must stay
               * successful when the
               * backend is unavailable.
               */
            }
          }

          setExpoPushToken(
            null
          );

          registeredIdentifierRef.current =
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
            getInitialPermissionState()
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
    restoreExistingWebRegistration,
  ]);

  const sendRemoteTest =
    useCallback(
      async (): Promise<
        RemotePushTestResult |
        null
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
            !registeredIdentifierRef
              .current
          ) {
            const registeredIdentifier =
              await registerCurrentDevice();

            if (
              !registeredIdentifier
            ) {
              return null;
            }
          }

          if (
            Platform.OS ===
            "web"
          ) {
            return await sendCustomerWebPushTest(
              token
            );
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
              ? requestError
                  .message
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

        if (
          Platform.OS ===
          "web"
        ) {
          throw new Error(
            "Use Send test to test Web Push notifications."
          );
        }

        try {
          await scheduleLocalPushTest();
        } catch (
          requestError
        ) {
          setError(
            requestError instanceof
              Error
              ? requestError
                  .message
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
        if (!token) {
          return false;
        }

        setDisabling(true);

        setError(null);

        try {
          if (
            Platform.OS ===
            "web"
          ) {
            const existingSubscription =
              await getExistingWebPushSubscription();

            const endpoint =
              registeredIdentifierRef
                .current ||
              existingSubscription
                ?.endpoint ||
              "";

            let backendDisabled =
              false;

            if (endpoint) {
              backendDisabled =
                await unregisterBrowserWebPushSubscription(
                  token,

                  endpoint
                );
            }

            const localResult =
              await unsubscribeFromWebPushNotifications();

            setExpoPushToken(
              null
            );

            registeredIdentifierRef.current =
              null;

            registeredAuthTokenRef.current =
              null;

            setPermissionState(
              "idle"
            );

            return Boolean(
              backendDisabled ||
                localResult
                  .unsubscribed ||
                endpoint
            );
          }

          const nativeToken =
            registeredIdentifierRef
              .current;

          if (!nativeToken) {
            return false;
          }

          const disabled =
            await unregisterDevicePushToken(
              token,

              nativeToken
            );

          if (disabled) {
            setExpoPushToken(
              null
            );

            registeredIdentifierRef.current =
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
              ? requestError
                  .message
              : "Unable to disable notifications on this device."
          );

          return false;
        } finally {
          setDisabling(
            false
          );
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