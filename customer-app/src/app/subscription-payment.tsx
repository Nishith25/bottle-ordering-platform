import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  AppState,
  Linking,
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
  useAuth,
} from "../context/AuthContext";

import {
  useSubscriptions,
} from "../context/SubscriptionContext";

import {
  fetchCustomerRazorpayMandateStatus,
  prepareCustomerRazorpaySubscription,
  refreshCustomerRazorpayMandateStatus,
  type RazorpayCheckoutDetails,
  type RazorpayMandateStatus,
  type RazorpaySubscriptionMandate,
} from "../services/razorpaySubscriptionApi";

function getParam(
  value:
    | string
    | string[]
    | undefined
) {
  if (
    Array.isArray(value)
  ) {
    return value[0] || "";
  }

  return value || "";
}

function formatCurrencyFromPaise(
  value?: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value || 0) /
      100
  );
}

function formatCurrency(
  value?: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value || 0)
  );
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "Unavailable";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unavailable";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatStatus(
  value?: string
) {
  if (!value) {
    return "Not prepared";
  }

  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function isAuthorisedStatus(
  status?:
    RazorpayMandateStatus
) {
  return [
    "authenticated",
    "active",
  ].includes(
    status || ""
  );
}

function isTerminalStatus(
  status?:
    RazorpayMandateStatus
) {
  return [
    "cancelled",
    "completed",
    "expired",
  ].includes(
    status || ""
  );
}

function getStatusDescription(
  status?:
    RazorpayMandateStatus
) {
  switch (status) {
    case "created":
      return "The Razorpay subscription is ready. Complete the secure authorisation to activate recurring payments.";

    case "authenticated":
      return "Your recurring-payment mandate has been authorised. Razorpay will activate it according to the scheduled subscription start.";

    case "active":
      return "Your recurring-payment mandate is active and ready for future scheduled charges.";

    case "pending":
      return "A recurring payment is pending. Check the Razorpay page or refresh the status.";

    case "halted":
      return "Razorpay has halted recurring charges after payment failures. The mandate may require customer action.";

    case "paused":
      return "The Razorpay mandate is currently paused.";

    case "cancelled":
      return "The Razorpay mandate has been cancelled and cannot collect future recurring charges.";

    case "completed":
      return "All scheduled Razorpay subscription cycles have been completed.";

    case "expired":
      return "The Razorpay subscription has expired.";

    default:
      return "Prepare a secure Razorpay mandate to authorise recurring subscription payments.";
  }
}

function getStatusIcon(
  status?:
    RazorpayMandateStatus
):
  | "shield-checkmark-outline"
  | "time-outline"
  | "alert-circle-outline"
  | "close-circle-outline"
  | "card-outline" {
  if (
    isAuthorisedStatus(
      status
    )
  ) {
    return "shield-checkmark-outline";
  }

  if (
    [
      "pending",
      "paused",
    ].includes(
      status || ""
    )
  ) {
    return "time-outline";
  }

  if (
    status === "halted"
  ) {
    return "alert-circle-outline";
  }

  if (
    isTerminalStatus(
      status
    )
  ) {
    return "close-circle-outline";
  }

  return "card-outline";
}

export default function SubscriptionPaymentScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      subscriptionId?:
        | string
        | string[];
    }>();

  const subscriptionId =
    getParam(
      params.subscriptionId
    );

  const {
    token,
    isAuthenticated,
  } = useAuth();

  const {
    getSubscriptionById,
    refreshSubscriptions,
  } = useSubscriptions();

  const subscription =
    getSubscriptionById(
      subscriptionId
    );

  const [
    mandate,
    setMandate,
  ] =
    useState<RazorpaySubscriptionMandate | null>(
      null
    );

  const [
    checkout,
    setCheckout,
  ] =
    useState<RazorpayCheckoutDetails | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    preparing,
    setPreparing,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    opening,
    setOpening,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(null);

  const [
    authorisationStartedAt,
    setAuthorisationStartedAt,
  ] =
    useState<
      number | null
    >(null);

  const appStateRef =
    useRef(
      AppState.currentState
    );

  const authorised =
    isAuthorisedStatus(
      mandate?.status
    );

  const terminal =
    isTerminalStatus(
      mandate?.status
    );

  const authorisationUrl =
    checkout?.shortUrl ||
    mandate?.shortUrl ||
    "";

  const loadStoredStatus =
    useCallback(
      async (
        silent = false
      ) => {
        if (
          !token ||
          !subscriptionId
        ) {
          setLoading(false);
          return;
        }

        if (!silent) {
          setLoading(true);
        }

        try {
          const storedMandate =
            await fetchCustomerRazorpayMandateStatus(
              token,
              subscriptionId
            );

          setMandate(
            storedMandate
          );

          if (
            storedMandate &&
            isAuthorisedStatus(
              storedMandate.status
            )
          ) {
            setSuccess(
              "Recurring payment authorisation is complete."
            );

            await refreshSubscriptions();
          }
        } catch (
          requestError
        ) {
          if (!silent) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Unable to load the Razorpay mandate."
            );
          }
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [
        token,
        subscriptionId,
        refreshSubscriptions,
      ]
    );

  const refreshRemoteStatus =
    useCallback(
      async (
        silent = false
      ) => {
        if (
          !token ||
          !subscriptionId ||
          refreshing
        ) {
          return;
        }

        if (!silent) {
          setRefreshing(true);
          setError(null);
          setSuccess(null);
        }

        try {
          const refreshedMandate =
            await refreshCustomerRazorpayMandateStatus(
              token,
              subscriptionId
            );

          setMandate(
            refreshedMandate
          );

          if (
            isAuthorisedStatus(
              refreshedMandate.status
            )
          ) {
            setSuccess(
              "Recurring payment authorisation is complete."
            );

            await refreshSubscriptions();
          } else if (!silent) {
            setSuccess(
              `Razorpay status refreshed: ${formatStatus(
                refreshedMandate.status
              )}.`
            );
          }
        } catch (
          requestError
        ) {
          if (!silent) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Unable to refresh the Razorpay mandate."
            );
          }
        } finally {
          if (!silent) {
            setRefreshing(
              false
            );
          }
        }
      },
      [
        token,
        subscriptionId,
        refreshing,
        refreshSubscriptions,
      ]
    );

  useEffect(() => {
    void loadStoredStatus();
  }, [loadStoredStatus]);

  /*
   * Poll the local webhook-synchronised status
   * for two minutes after Razorpay is opened.
   */
  useEffect(() => {
    if (
      !authorisationStartedAt ||
      authorised ||
      terminal
    ) {
      return;
    }

    const intervalId =
      setInterval(() => {
        const elapsed =
          Date.now() -
          authorisationStartedAt;

        if (
          elapsed >
          2 * 60 * 1000
        ) {
          clearInterval(
            intervalId
          );

          return;
        }

        void loadStoredStatus(
          true
        );
      }, 5000);

    return () => {
      clearInterval(
        intervalId
      );
    };
  }, [
    authorisationStartedAt,
    authorised,
    terminal,
    loadStoredStatus,
  ]);

  /*
   * Refresh directly from Razorpay when
   * the customer returns to the app.
   */
  useEffect(() => {
    const subscriptionListener =
      AppState.addEventListener(
        "change",
        (nextAppState) => {
          const previousState =
            appStateRef.current;

          appStateRef.current =
            nextAppState;

          const returnedToApp =
            (
              previousState ===
                "inactive" ||
              previousState ===
                "background"
            ) &&
            nextAppState ===
              "active";

          if (
            returnedToApp &&
            authorisationStartedAt
          ) {
            void refreshRemoteStatus(
              true
            );
          }
        }
      );

    return () => {
      subscriptionListener.remove();
    };
  }, [
    authorisationStartedAt,
    refreshRemoteStatus,
  ]);

  /*
   * Browser tab visibility fallback.
   */
  useEffect(() => {
    if (
      Platform.OS !==
        "web" ||
      typeof document ===
        "undefined"
    ) {
      return;
    }

    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
            "visible" &&
          authorisationStartedAt
        ) {
          void refreshRemoteStatus(
            true
          );
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    authorisationStartedAt,
    refreshRemoteStatus,
  ]);

  const prepareMandate =
    async () => {
      if (
        !token ||
        !subscriptionId ||
        preparing
      ) {
        return;
      }

      setPreparing(true);
      setError(null);
      setSuccess(null);

      try {
        const result =
          await prepareCustomerRazorpaySubscription(
            token,
            subscriptionId
          );

        setMandate(
          result.mandate
        );

        setCheckout(
          result.checkout
        );

        setSuccess(
          "Secure Razorpay authorisation is ready. Open Razorpay to continue."
        );
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to prepare the Razorpay subscription."
        );
      } finally {
        setPreparing(false);
      }
    };

  const openRazorpay =
    async () => {
      if (
        !authorisationUrl ||
        opening
      ) {
        setError(
          "Prepare the Razorpay authorisation before continuing."
        );

        return;
      }

      setOpening(true);
      setError(null);
      setSuccess(null);

      try {
        if (
          Platform.OS ===
          "web"
        ) {
          if (
            typeof window ===
            "undefined"
          ) {
            throw new Error(
              "The browser window is unavailable."
            );
          }

          window.open(
            authorisationUrl,
            "_blank",
            "noopener,noreferrer"
          );
        } else {
          const supported =
            await Linking.canOpenURL(
              authorisationUrl
            );

          if (!supported) {
            throw new Error(
              "This device cannot open the Razorpay authorisation page."
            );
          }

          await Linking.openURL(
            authorisationUrl
          );
        }

        setAuthorisationStartedAt(
          Date.now()
        );

        setSuccess(
          "Razorpay was opened securely. Complete the authorisation, return here and check the status."
        );
      } catch (
        requestError
      ) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to open Razorpay."
        );
      } finally {
        setOpening(false);
      }
    };

  const statusTone =
    useMemo(() => {
      if (authorised) {
        return "positive";
      }

      if (
        mandate?.status ===
          "halted" ||
        terminal
      ) {
        return "negative";
      }

      if (
        mandate?.status ===
          "pending" ||
        mandate?.status ===
          "paused"
      ) {
        return "warning";
      }

      return "neutral";
    }, [
      authorised,
      terminal,
      mandate?.status,
    ]);

  if (
    !isAuthenticated
  ) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centerState}
        >
          <Ionicons
            name="person-outline"
            size={38}
            color="#35694E"
          />

          <Text
            style={styles.stateTitle}
          >
            Log in to manage recurring
            payment
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/login"
              )
            }
            style={
              styles.primaryButton
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Log in
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centerState}
        >
          <ActivityIndicator
            color="#245C42"
          />

          <Text
            style={styles.loadingText}
          >
            Loading recurring payment
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            color="#24362C"
          />
        </Pressable>

        <View
          style={styles.headerText}
        >
          <Text
            style={styles.headerTitle}
          >
            Recurring payment
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Secure authorisation by Razorpay
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={styles.heroCard}
        >
          <View
            style={styles.heroIcon}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={27}
              color="#245C42"
            />
          </View>

          <Text
            style={styles.heroEyebrow}
          >
            RAZORPAY SUBSCRIPTION
          </Text>

          <Text
            style={styles.heroTitle}
          >
            Authorise automatic payments
          </Text>

          <Text
            style={
              styles.heroDescription
            }
          >
            Complete a secure mandate once.
            Razorpay can then process future
            weekly or monthly subscription
            charges according to the billing
            schedule.
          </Text>
        </View>

        {subscription ? (
          <View
            style={
              styles.subscriptionCard
            }
          >
            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.subscriptionNumber
                }
              >
                {
                  subscription.subscriptionNumber
                }
              </Text>

              <Text
                style={
                  styles.subscriptionName
                }
              >
                {
                  subscription.planName
                }
              </Text>

              <Text
                style={
                  styles.subscriptionMeta
                }
              >
                {formatStatus(
                  subscription.billingCycle
                )}{" "}
                · Next billing{" "}
                {formatDate(
                  subscription.nextBillingAt
                )}
              </Text>
            </View>

            <Text
              style={
                styles.subscriptionAmount
              }
            >
              {formatCurrency(
                subscription.totalPerCycle
              )}
            </Text>
          </View>
        ) : null}

        <View
          style={styles.testModeCard}
        >
          <Ionicons
            name="flask-outline"
            size={19}
            color="#825F1D"
          />

          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.testModeTitle
              }
            >
              Razorpay Test Mode
            </Text>

            <Text
              style={
                styles.testModeText
              }
            >
              Use Card or bank eMandate for
              testing. UPI AutoPay can be
              enabled later after account
              approval.
            </Text>
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

        {success ? (
          <View
            style={styles.successCard}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color="#2E714A"
            />

            <Text
              style={
                styles.successText
              }
            >
              {success}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.statusCard,

            statusTone ===
              "positive" &&
              styles.positiveStatusCard,

            statusTone ===
              "warning" &&
              styles.warningStatusCard,

            statusTone ===
              "negative" &&
              styles.negativeStatusCard,
          ]}
        >
          <View
            style={[
              styles.statusIcon,

              statusTone ===
                "positive" &&
                styles.positiveStatusIcon,

              statusTone ===
                "warning" &&
                styles.warningStatusIcon,

              statusTone ===
                "negative" &&
                styles.negativeStatusIcon,
            ]}
          >
            <Ionicons
              name={getStatusIcon(
                mandate?.status
              )}
              size={23}
              color={
                statusTone ===
                "positive"
                  ? "#2E714A"
                  : statusTone ===
                      "warning"
                    ? "#88631D"
                    : statusTone ===
                        "negative"
                      ? "#A34848"
                      : "#35694E"
              }
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.statusLabel
              }
            >
              MANDATE STATUS
            </Text>

            <Text
              style={
                styles.statusValue
              }
            >
              {formatStatus(
                mandate?.status
              )}
            </Text>

            <Text
              style={
                styles.statusDescription
              }
            >
              {getStatusDescription(
                mandate?.status
              )}
            </Text>
          </View>
        </View>

        {mandate ? (
          <View
            style={styles.detailsCard}
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Razorpay details
            </Text>

            <InformationRow
              label="Subscription ID"
              value={
                mandate.razorpaySubscriptionId
              }
            />

            <InformationRow
              label="Plan ID"
              value={
                mandate.razorpayPlanId
              }
            />

            <InformationRow
              label="Mandate amount"
              value={formatCurrencyFromPaise(
                mandate.amountPaise
              )}
            />

            <InformationRow
              label="Payment method"
              value={formatStatus(
                mandate.paymentMethod
              )}
            />

            <InformationRow
              label="Paid cycles"
              value={`${mandate.paidCount} of ${mandate.totalCount}`}
            />

            <InformationRow
              label="Next Razorpay charge"
              value={formatDate(
                mandate.chargeAt
              )}
            />

            <InformationRow
              label="Last webhook"
              value={
                mandate.lastWebhookEventType
                  ? `${formatStatus(
                      mandate.lastWebhookEventType
                    )} · ${formatDate(
                      mandate.lastWebhookAt
                    )}`
                  : "No webhook received yet"
              }
              last
            />
          </View>
        ) : null}

        {mandate?.lastPaymentFailureReason ? (
          <View
            style={styles.failureCard}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color="#A34848"
            />

            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.failureTitle
                }
              >
                Previous payment failed
              </Text>

              <Text
                style={
                  styles.failureText
                }
              >
                {
                  mandate.lastPaymentFailureReason
                }
              </Text>
            </View>
          </View>
        ) : null}

        {!mandate ||
        terminal ? (
          <Pressable
            disabled={preparing}
            onPress={() => {
              void prepareMandate();
            }}
            style={[
              styles.primaryAction,

              preparing &&
                styles.disabledButton,
            ]}
          >
            {preparing ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="shield-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.primaryActionText
                  }
                >
                  {terminal
                    ? "Prepare new authorisation"
                    : "Prepare secure authorisation"}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {mandate &&
        !authorised &&
        !terminal &&
        authorisationUrl ? (
          <Pressable
            disabled={opening}
            onPress={() => {
              void openRazorpay();
            }}
            style={[
              styles.primaryAction,

              opening &&
                styles.disabledButton,
            ]}
          >
            {opening ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="open-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.primaryActionText
                  }
                >
                  Open Razorpay authorisation
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {mandate ? (
          <Pressable
            disabled={refreshing}
            onPress={() => {
              void refreshRemoteStatus();
            }}
            style={[
              styles.secondaryAction,

              refreshing &&
                styles.disabledButton,
            ]}
          >
            {refreshing ? (
              <ActivityIndicator
                color="#245C42"
              />
            ) : (
              <>
                <Ionicons
                  name="refresh"
                  size={18}
                  color="#245C42"
                />

                <Text
                  style={
                    styles.secondaryActionText
                  }
                >
                  I completed it — check status
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {authorised ? (
          <Pressable
            onPress={() =>
              router.replace({
                pathname:
                  "/subscription-details",

                params: {
                  subscriptionId,
                },
              })
            }
            style={
              styles.completedAction
            }
          >
            <Text
              style={
                styles.completedActionText
              }
            >
              Return to subscription
            </Text>

            <Ionicons
              name="arrow-forward"
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        ) : null}

        <View
          style={styles.securityCard}
        >
          <Ionicons
            name="lock-closed-outline"
            size={19}
            color="#35694E"
          />

          <Text
            style={
              styles.securityText
            }
          >
            Payment credentials are entered
            only on Razorpay’s secure page.
            This app stores the subscription
            and mandate references, not card
            or bank credentials.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InformationRow({
  label,
  value,
  last = false,
}: {
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
      <Text
        style={
          styles.informationLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.informationValue
        }
      >
        {value ||
          "Unavailable"}
      </Text>
    </View>
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
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E3E7E1",
      flexDirection: "row",
      alignItems: "center",
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        "#DEE5DF",
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
    },

    headerText: {
      marginLeft: 12,
    },

    headerTitle: {
      color: "#1D2922",
      fontSize: 18,
      fontWeight: "900",
    },

    headerSubtitle: {
      color: "#758079",
      fontSize: 9,
      marginTop: 3,
    },

    scrollContent: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      padding: 20,
      paddingBottom: 90,
    },

    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      padding: 25,
    },

    stateTitle: {
      color: "#1D2922",
      fontSize: 17,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 13,
    },

    loadingText: {
      color: "#68746D",
      fontSize: 10,
      marginTop: 12,
    },

    primaryButton: {
      minHeight: 46,
      marginTop: 18,
      paddingHorizontal: 25,
      borderRadius: 15,
      backgroundColor:
        "#245C42",
      alignItems: "center",
      justifyContent:
        "center",
    },

    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    heroCard: {
      padding: 21,
      borderRadius: 25,
      backgroundColor:
        "#E8F0EA",
    },

    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
    },

    heroEyebrow: {
      color: "#4D765F",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.2,
      marginTop: 17,
    },

    heroTitle: {
      color: "#1D3025",
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.5,
      marginTop: 7,
    },

    heroDescription: {
      color: "#647269",
      fontSize: 10,
      lineHeight: 17,
      marginTop: 8,
    },

    subscriptionCard: {
      marginTop: 14,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        "#DFE5DF",
      backgroundColor:
        "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    subscriptionNumber: {
      color: "#718078",
      fontSize: 8,
    },

    subscriptionName: {
      color: "#203128",
      fontSize: 14,
      fontWeight: "900",
      marginTop: 4,
    },

    subscriptionMeta: {
      color: "#748078",
      fontSize: 8,
      marginTop: 5,
    },

    subscriptionAmount: {
      color: "#245C42",
      fontSize: 17,
      fontWeight: "900",
    },

    testModeCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        "#FFF2D9",
      flexDirection: "row",
      gap: 10,
    },

    testModeTitle: {
      color: "#7A591D",
      fontSize: 10,
      fontWeight: "900",
    },

    testModeText: {
      color: "#80652E",
      fontSize: 9,
      lineHeight: 14,
      marginTop: 4,
    },

    errorCard: {
      marginTop: 14,
      padding: 13,
      borderRadius: 16,
      backgroundColor:
        "#FAECEC",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    errorText: {
      flex: 1,
      color: "#934545",
      fontSize: 9,
      lineHeight: 15,
    },

    successCard: {
      marginTop: 14,
      padding: 13,
      borderRadius: 16,
      backgroundColor:
        "#E7F2E9",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    successText: {
      flex: 1,
      color: "#2E714A",
      fontSize: 9,
      lineHeight: 15,
    },

    statusCard: {
      marginTop: 14,
      padding: 17,
      borderRadius: 21,
      borderWidth: 1,
      borderColor:
        "#DFE6E0",
      backgroundColor:
        "#FFFFFF",
      flexDirection: "row",
      gap: 12,
    },

    positiveStatusCard: {
      borderColor:
        "#C4DDCB",
      backgroundColor:
        "#F1F8F3",
    },

    warningStatusCard: {
      borderColor:
        "#E9D7AA",
      backgroundColor:
        "#FFF9EB",
    },

    negativeStatusCard: {
      borderColor:
        "#ECC8C8",
      backgroundColor:
        "#FFF4F4",
    },

    statusIcon: {
      width: 45,
      height: 45,
      borderRadius: 15,
      backgroundColor:
        "#E8F0EA",
      alignItems: "center",
      justifyContent:
        "center",
    },

    positiveStatusIcon: {
      backgroundColor:
        "#E1F0E5",
    },

    warningStatusIcon: {
      backgroundColor:
        "#FFF0D1",
    },

    negativeStatusIcon: {
      backgroundColor:
        "#FAE4E4",
    },

    statusLabel: {
      color: "#728078",
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.9,
    },

    statusValue: {
      color: "#203128",
      fontSize: 15,
      fontWeight: "900",
      marginTop: 5,
    },

    statusDescription: {
      color: "#68756D",
      fontSize: 9,
      lineHeight: 15,
      marginTop: 6,
    },

    detailsCard: {
      marginTop: 14,
      padding: 17,
      borderRadius: 21,
      borderWidth: 1,
      borderColor:
        "#E1E6E0",
      backgroundColor:
        "#FFFFFF",
    },

    sectionTitle: {
      color: "#203128",
      fontSize: 14,
      fontWeight: "900",
      marginBottom: 8,
    },

    informationRow: {
      minHeight: 45,
      borderBottomWidth: 1,
      borderBottomColor:
        "#EDF0EC",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 13,
    },

    lastInformationRow: {
      borderBottomWidth: 0,
    },

    informationLabel: {
      flex: 1,
      color: "#6D7971",
      fontSize: 8,
    },

    informationValue: {
      maxWidth: "62%",
      color: "#293A31",
      fontSize: 8,
      fontWeight: "800",
      textAlign: "right",
    },

    failureCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        "#FAEAEA",
      flexDirection: "row",
      gap: 10,
    },

    failureTitle: {
      color: "#934747",
      fontSize: 10,
      fontWeight: "900",
    },

    failureText: {
      color: "#985858",
      fontSize: 9,
      lineHeight: 14,
      marginTop: 4,
    },

    primaryAction: {
      minHeight: 53,
      marginTop: 15,
      paddingHorizontal: 16,
      borderRadius: 17,
      backgroundColor:
        "#245C42",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    primaryActionText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    secondaryAction: {
      minHeight: 50,
      marginTop: 10,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        "#BCD3C4",
      backgroundColor:
        "#EFF5F0",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    secondaryActionText: {
      color: "#245C42",
      fontSize: 10,
      fontWeight: "900",
    },

    completedAction: {
      minHeight: 51,
      marginTop: 10,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor:
        "#2D704D",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    completedActionText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.55,
    },

    securityCard: {
      marginTop: 17,
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        "#E8F0EA",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },

    securityText: {
      flex: 1,
      color: "#5D6C63",
      fontSize: 8,
      lineHeight: 14,
    },
  });