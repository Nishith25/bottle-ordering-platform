// customer-app/src/app/payment-result.tsx

import Ionicons from
  "@expo/vector-icons/Ionicons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import * as WebBrowser from
  "expo-web-browser";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from
  "react-native-safe-area-context";

import { useAuth } from
  "../context/AuthContext";

import { useOrders } from
  "../context/OrderContext";

WebBrowser.maybeCompleteAuthSession();

function readParameter(
  value:
    | string
    | string[]
    | undefined
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default function PaymentResultScreen() {
  const router = useRouter();

  const startedRef =
    useRef(false);

  const params =
    useLocalSearchParams<{
      status?:
        | string
        | string[];

      session?:
        | string
        | string[];

      message?:
        | string
        | string[];

      orderId?:
        | string
        | string[];
    }>();

  const status =
    readParameter(
      params.status
    )?.toLowerCase();

  const sessionToken =
    readParameter(
      params.session
    );

  const returnedMessage =
    readParameter(
      params.message
    );

  const {
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const {
    checkoutReady,
    placingOrder,
    error,
    completeOnlinePayment,
    dismissOnlinePaymentSession,
    clearError,
  } = useOrders();

  const [
    checkingPayment,
    setCheckingPayment,
  ] = useState(false);

  const [
    localMessage,
    setLocalMessage,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    clearError();
  }, [clearError]);

  const verifyPayment =
    useCallback(async () => {
      if (!sessionToken) {
        setLocalMessage(
          "Payment session information is missing."
        );

        return;
      }

      setCheckingPayment(true);
      setLocalMessage(null);
      clearError();

      const order =
        await completeOnlinePayment(
          sessionToken
        );

      setCheckingPayment(false);

      if (order) {
        router.replace({
          pathname:
            "/order-success",

          params: {
            orderId:
              order._id,
          },
        });

        return;
      }

      setLocalMessage(
        returnedMessage ||
          "Payment confirmation is still processing. You can check again."
      );
    }, [
      sessionToken,
      returnedMessage,
      completeOnlinePayment,
      clearError,
      router,
    ]);

  useEffect(() => {
    if (
      authLoading ||
      !checkoutReady ||
      !isAuthenticated ||
      startedRef.current
    ) {
      return;
    }

    startedRef.current = true;

    if (
      status === "failed" ||
      status === "cancelled"
    ) {
      dismissOnlinePaymentSession();

      setLocalMessage(
        returnedMessage ||
          (status === "cancelled"
            ? "Payment was cancelled. Your cart has been retained."
            : "Payment failed. Please use another payment method.")
      );

      return;
    }

    void verifyPayment();
  }, [
    authLoading,
    checkoutReady,
    isAuthenticated,
    status,
    returnedMessage,
    dismissOnlinePaymentSession,
    verifyPayment,
  ]);

  if (
    authLoading ||
    !checkoutReady ||
    checkingPayment ||
    placingOrder
  ) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.container}
        >
          <ActivityIndicator
            size="large"
            color="#245C42"
          />

          <Text
            style={styles.title}
          >
            Confirming payment
          </Text>

          <Text
            style={styles.description}
          >
            Please wait while the backend
            checks your Razorpay payment.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.container}
        >
          <View
            style={styles.icon}
          >
            <Ionicons
              name="person-outline"
              size={34}
              color="#35694E"
            />
          </View>

          <Text
            style={styles.title}
          >
            Log in to check payment
          </Text>

          <Text
            style={styles.description}
          >
            Log in using the same account
            used to begin this payment.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/login"
              )
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
        </View>
      </SafeAreaView>
    );
  }

  const paymentCancelled =
    status === "cancelled";

  const paymentFailed =
    status === "failed";

  const displayMessage =
    returnedMessage ||
    localMessage ||
    error ||
    "The payment could not be confirmed. No order has been created.";

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.container}
      >
        <View
          style={[
            styles.icon,

            paymentCancelled
              ? styles.warningIcon
              : styles.errorIcon,
          ]}
        >
          <Ionicons
            name={
              paymentCancelled
                ? "close-outline"
                : "alert-outline"
            }
            size={36}
            color={
              paymentCancelled
                ? "#826014"
                : "#9A4949"
            }
          />
        </View>

        <Text style={styles.title}>
          {paymentCancelled
            ? "Payment cancelled"
            : paymentFailed
              ? "Payment failed"
              : "Payment not confirmed"}
        </Text>

        <Text
          style={styles.description}
        >
          {displayMessage}
        </Text>

        {!paymentFailed &&
        !paymentCancelled &&
        sessionToken ? (
          <Pressable
            onPress={() => {
              void verifyPayment();
            }}
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
              Check payment again
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              router.replace(
                "/payment"
              )
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
              Return to payment
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() =>
            router.replace(
              "/(tabs)/orders"
            )
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
            Check my orders
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace(
              "/cart"
            )
          }
          style={({ pressed }) => [
            styles.cartButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="bag-outline"
            size={17}
            color="#245C42"
          />

          <Text
            style={
              styles.cartButtonText
            }
          >
            View retained cart
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F7F7F2",
    },

    container: {
      flex: 1,
      maxWidth: 500,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: 30,
      alignItems: "center",
      justifyContent:
        "center",
    },

    icon: {
      width: 82,
      height: 82,
      borderRadius: 27,
      backgroundColor:
        "#E5EFE7",
      alignItems: "center",
      justifyContent:
        "center",
    },

    warningIcon: {
      backgroundColor:
        "#FFF3CF",
    },

    errorIcon: {
      backgroundColor:
        "#FAEAEA",
    },

    title: {
      color: "#1D2922",
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 21,
    },

    description: {
      color: "#707B74",
      fontSize: 12,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 9,
    },

    primaryButton: {
      width: "100%",
      minHeight: 53,
      marginTop: 24,
      borderRadius: 18,
      backgroundColor:
        "#245C42",
      alignItems: "center",
      justifyContent:
        "center",
    },

    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "900",
    },

    secondaryButton: {
      width: "100%",
      minHeight: 52,
      marginTop: 10,
      borderRadius: 18,
      backgroundColor:
        "#E8EEE8",
      alignItems: "center",
      justifyContent:
        "center",
    },

    secondaryButtonText: {
      color: "#245C42",
      fontSize: 12,
      fontWeight: "800",
    },

    cartButton: {
      minHeight: 45,
      paddingHorizontal: 17,
      borderRadius: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      marginTop: 12,
    },

    cartButtonText: {
      color: "#245C42",
      fontSize: 11,
      fontWeight: "800",
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