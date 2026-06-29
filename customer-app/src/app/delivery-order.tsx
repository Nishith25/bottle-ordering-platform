import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import {
  fetchCustomerDeliveryTracking,
  type CustomerDeliveryTracking,
  type DeliveryPartnerSummary,
  type DeliveryStatus,
} from "../services/api";

const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  unassigned: "Waiting for assignment",
  assigned: "Delivery partner assigned",
  picked_up: "Order picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STEPS: Array<{
  key: DeliveryStatus;
  label: string;
}> = [
  {
    key: "assigned",
    label: "Partner assigned",
  },
  {
    key: "picked_up",
    label: "Picked up",
  },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
  },
  {
    key: "delivered",
    label: "Delivered",
  },
];

function readParam(
  value: string | string[] | undefined
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function getStepIndex(status: DeliveryStatus) {
  return STEPS.findIndex(
    (step) => step.key === status
  );
}

function getPartner(
  tracking: CustomerDeliveryTracking
): DeliveryPartnerSummary | null {
  const partner =
    tracking.order.deliveryPartner;

  if (
    partner &&
    typeof partner === "object"
  ) {
    return partner;
  }

  const snapshot =
    tracking.order.deliveryPartnerSnapshot;

  if (!snapshot) {
    return null;
  }

  return {
    fullName: snapshot.fullName,
    email: snapshot.email,
    phone: snapshot.phone,
  };
}

export default function DeliveryOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId?: string | string[];
  }>();

  const orderId = readParam(
    params.orderId
  );

  const {
    token,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const [tracking, setTracking] =
    useState<CustomerDeliveryTracking | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadTracking = useCallback(
    async () => {
      if (!token || !orderId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchCustomerDeliveryTracking(
            token,
            orderId
          );

        setTracking(result);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load delivery tracking."
        );
      } finally {
        setLoading(false);
      }
    },
    [token, orderId]
  );

  useEffect(() => {
    if (
      authLoading ||
      !isAuthenticated ||
      !token ||
      !orderId
    ) {
      if (!authLoading) {
        setLoading(false);
      }

      return;
    }

    void loadTracking();
  }, [
    authLoading,
    isAuthenticated,
    token,
    orderId,
    loadTracking,
  ]);

  const deliveryStatus =
    tracking?.order.deliveryStatus ??
    (tracking?.order.orderStatus ===
    "delivered"
      ? "delivered"
      : tracking?.order.orderStatus ===
          "cancelled"
        ? "cancelled"
        : "unassigned");

  const currentStepIndex =
    useMemo(
      () =>
        getStepIndex(
          deliveryStatus
        ),
      [deliveryStatus]
    );

  const partner = tracking
    ? getPartner(tracking)
    : null;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(
      "/(tabs)/orders"
    );
  };

  if (
    authLoading ||
    loading
  ) {
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
            Loading delivery tracking
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
          style={styles.centerState}
        >
          <Ionicons
            name="person-outline"
            size={42}
            color="#35694E"
          />

          <Text
            style={styles.stateTitle}
          >
            Log in to track delivery
          </Text>

          <Pressable
            onPress={() =>
              router.push("/login")
            }
            style={styles.primaryButton}
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

  if (!orderId || error || !tracking) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#203128"
            />
          </Pressable>

          <Text
            style={styles.headerTitle}
          >
            Delivery tracking
          </Text>

          <View
            style={styles.headerSpacer}
          />
        </View>

        <View
          style={styles.centerState}
        >
          <View
            style={styles.errorIcon}
          >
            <Ionicons
              name="alert-circle-outline"
              size={37}
              color="#A34848"
            />
          </View>

          <Text
            style={styles.stateTitle}
          >
            Tracking unavailable
          </Text>

          <Text
            style={styles.stateDescription}
          >
            {error ||
              "This order could not be found."}
          </Text>

          <Pressable
            onPress={() =>
              void loadTracking()
            }
            style={styles.primaryButton}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Try again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const order = tracking.order;

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#203128"
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text
            style={styles.headerTitle}
          >
            Delivery tracking
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            {order.orderNumber}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            void loadTracking()
          }
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="refresh"
            size={19}
            color="#35694E"
          />
        </Pressable>
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
          style={styles.statusHero}
        >
          <View
            style={styles.statusIcon}
          >
            <Ionicons
              name={
                deliveryStatus ===
                "delivered"
                  ? "checkmark-circle"
                  : deliveryStatus ===
                      "out_for_delivery"
                    ? "bicycle"
                    : "cube-outline"
              }
              size={30}
              color="#FFFFFF"
            />
          </View>

          <Text
            style={styles.statusEyebrow}
          >
            CURRENT STATUS
          </Text>

          <Text
            style={styles.statusTitle}
          >
            {
              DELIVERY_LABELS[
                deliveryStatus
              ]
            }
          </Text>

          <Text
            style={
              styles.statusDescription
            }
          >
            {deliveryStatus ===
            "out_for_delivery"
              ? "Your bottles are on the way. Keep the OTP ready, but share it only after receiving the order."
              : deliveryStatus ===
                  "delivered"
                ? "The delivery was completed successfully after OTP verification."
                : deliveryStatus ===
                    "assigned"
                  ? "A delivery partner has been assigned to your order."
                  : deliveryStatus ===
                      "picked_up"
                    ? "The partner has collected your bottles and will start delivery shortly."
                    : "The delivery team is preparing the next update."}
          </Text>
        </View>

        <View
          style={styles.timelineCard}
        >
          <Text
            style={styles.sectionTitle}
          >
            Delivery progress
          </Text>

          {STEPS.map(
            (step, index) => {
              const completed =
                currentStepIndex >=
                index;

              const active =
                currentStepIndex ===
                index;

              return (
                <View
                  key={step.key}
                  style={styles.timelineRow}
                >
                  <View
                    style={
                      styles.timelineIndicator
                    }
                  >
                    <View
                      style={[
                        styles.timelineDot,
                        completed &&
                          styles.timelineDotComplete,
                        active &&
                          styles.timelineDotActive,
                      ]}
                    >
                      {completed ? (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color="#FFFFFF"
                        />
                      ) : null}
                    </View>

                    {index <
                    STEPS.length -
                      1 ? (
                      <View
                        style={[
                          styles.timelineLine,
                          currentStepIndex >
                            index &&
                            styles.timelineLineComplete,
                        ]}
                      />
                    ) : null}
                  </View>

                  <View
                    style={
                      styles.timelineContent
                    }
                  >
                    <Text
                      style={[
                        styles.timelineLabel,
                        completed &&
                          styles.timelineLabelComplete,
                      ]}
                    >
                      {step.label}
                    </Text>

                    <Text
                      style={
                        styles.timelineHint
                      }
                    >
                      {step.key ===
                      "assigned"
                        ? "A partner is responsible for this delivery."
                        : step.key ===
                            "picked_up"
                          ? "The bottles were collected for delivery."
                          : step.key ===
                              "out_for_delivery"
                            ? "The partner is travelling to your address."
                            : "Delivery confirmation was completed with OTP."}
                    </Text>
                  </View>
                </View>
              );
            }
          )}
        </View>

        {partner ? (
          <View
            style={styles.partnerCard}
          >
            <View
              style={styles.partnerAvatar}
            >
              <Text
                style={
                  styles.partnerAvatarText
                }
              >
                {partner.fullName
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={styles.partnerContent}
            >
              <Text
                style={styles.sectionEyebrow}
              >
                DELIVERY PARTNER
              </Text>

              <Text
                style={styles.partnerName}
              >
                {partner.fullName}
              </Text>

              <Text
                style={styles.partnerPhone}
              >
                +91 {partner.phone}
              </Text>
            </View>

            <Pressable
              disabled={!partner.phone}
              onPress={() =>
                Linking.openURL(
                  `tel:+91${partner.phone}`
                )
              }
              style={({ pressed }) => [
                styles.callButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="call"
                size={19}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        ) : null}

        {tracking.deliveryOtp ? (
          <View style={styles.otpCard}>
            <View
              style={styles.otpHeadingRow}
            >
              <View>
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  SECURE DELIVERY OTP
                </Text>

                <Text
                  style={styles.otpTitle}
                >
                  Share only after receiving
                  your bottles
                </Text>
              </View>

              <Ionicons
                name="shield-checkmark-outline"
                size={26}
                color="#35694E"
              />
            </View>

            <View
              style={styles.otpDigits}
            >
              {tracking.deliveryOtp
                .split("")
                .map(
                  (digit, index) => (
                    <View
                      key={`${digit}-${index}`}
                      style={styles.otpDigit}
                    >
                      <Text
                        style={
                          styles.otpDigitText
                        }
                      >
                        {digit}
                      </Text>
                    </View>
                  )
                )}
            </View>

            <View
              style={styles.securityNote}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#80631B"
              />

              <Text
                style={
                  styles.securityNoteText
                }
              >
                Do not share this OTP over a
                phone call or before the
                delivery partner reaches your
                address.
              </Text>
            </View>
          </View>
        ) : null}

        <View
          style={styles.orderCard}
        >
          <Text
            style={styles.sectionTitle}
          >
            Delivery details
          </Text>

          <InformationRow
            icon="calendar-outline"
            label="Delivery date"
            value={
              order.deliverySchedule
                .deliveryDateLabel
            }
          />

          <InformationRow
            icon="time-outline"
            label="Time slot"
            value={
              order.deliverySchedule
                .deliverySlot
            }
          />

          <InformationRow
            icon="location-outline"
            label="Address"
            value={`${order.deliveryAddress.houseDetails}, ${order.deliveryAddress.areaDetails}, ${order.deliveryAddress.area}, ${order.deliveryAddress.city} – ${order.deliveryAddress.pincode}`}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InformationRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View
      style={styles.informationRow}
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
        style={styles.informationContent}
      >
        <Text
          style={styles.informationLabel}
        >
          {label}
        </Text>

        <Text
          style={styles.informationValue}
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

  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#E9ECE6",
    alignItems: "center",
    justifyContent: "center",
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#E9ECE6",
    alignItems: "center",
    justifyContent: "center",
  },

  headerText: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    color: "#19251E",
    fontSize: 17,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "#77807B",
    fontSize: 9,
    marginTop: 3,
  },

  headerSpacer: {
    width: 44,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 45,
  },

  statusHero: {
    padding: 22,
    borderRadius: 27,
    backgroundColor: "#245C42",
    alignItems: "center",
    marginTop: 8,
  },

  statusIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor:
      "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  statusEyebrow: {
    color: "#DDEBE2",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 18,
  },

  statusTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 7,
  },

  statusDescription: {
    color: "#DDEBE2",
    fontSize: 10,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 8,
  },

  timelineCard: {
    padding: 18,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
    marginTop: 13,
  },

  orderCard: {
    padding: 18,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
    marginTop: 13,
  },

  sectionTitle: {
    color: "#203128",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 16,
  },

  timelineRow: {
    flexDirection: "row",
    minHeight: 62,
  },

  timelineIndicator: {
    width: 32,
    alignItems: "center",
  },

  timelineDot: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#E3E8E3",
    alignItems: "center",
    justifyContent: "center",
  },

  timelineDotComplete: {
    backgroundColor: "#7FA28B",
  },

  timelineDotActive: {
    backgroundColor: "#245C42",
  },

  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E3E8E3",
  },

  timelineLineComplete: {
    backgroundColor: "#7FA28B",
  },

  timelineContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 15,
  },

  timelineLabel: {
    color: "#8A938E",
    fontSize: 11,
    fontWeight: "800",
  },

  timelineLabelComplete: {
    color: "#294534",
  },

  timelineHint: {
    color: "#7A847E",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  partnerCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E2",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
  },

  partnerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  partnerAvatarText: {
    color: "#245C42",
    fontSize: 17,
    fontWeight: "900",
  },

  partnerContent: {
    flex: 1,
    marginLeft: 12,
  },

  sectionEyebrow: {
    color: "#5E7A69",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  partnerName: {
    color: "#203128",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },

  partnerPhone: {
    color: "#737F77",
    fontSize: 9,
    marginTop: 4,
  },

  callButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  otpCard: {
    padding: 19,
    borderRadius: 24,
    backgroundColor: "#EDF4EF",
    borderWidth: 1,
    borderColor: "#D3E1D6",
    marginTop: 13,
  },

  otpHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  otpTitle: {
    maxWidth: 250,
    color: "#294534",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    marginTop: 5,
  },

  otpDigits: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 9,
    marginTop: 20,
  },

  otpDigit: {
    width: 54,
    height: 62,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E0D7",
    alignItems: "center",
    justifyContent: "center",
  },

  otpDigitText: {
    color: "#203128",
    fontSize: 25,
    fontWeight: "900",
  },

  securityNote: {
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#FFF5D9",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 17,
  },

  securityNoteText: {
    flex: 1,
    color: "#755C1C",
    fontSize: 9,
    lineHeight: 15,
  },

  informationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  informationIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#E8F0EA",
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
    color: "#394A40",
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 3,
  },

  centerState: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#607067",
    fontSize: 11,
    marginTop: 13,
  },

  errorIcon: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: "#FAECEC",
    alignItems: "center",
    justifyContent: "center",
  },

  stateTitle: {
    color: "#203128",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 17,
  },

  stateDescription: {
    color: "#727D76",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 7,
  },

  primaryButton: {
    minHeight: 49,
    paddingHorizontal: 27,
    borderRadius: 16,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 19,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});
