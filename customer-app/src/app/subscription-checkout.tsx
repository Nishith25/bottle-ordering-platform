// customer-app/src/app/subscription-checkout.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSubscriptions } from "../context/SubscriptionContext";
import { useServiceablePincode } from "../hooks/useServiceablePincode";
import { getSubscriptionPlan } from "../data/subscriptionPlans";

type FormInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;

  keyboardType?:
    | "default"
    | "phone-pad"
    | "number-pad";

  maxLength?: number;
  multiline?: boolean;
};

function FormInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  maxLength,
  multiline = false,
}: FormInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0A7A3"
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={
          multiline ? "top" : "center"
        }
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
      />
    </View>
  );
}

export default function SubscriptionCheckoutScreen() {
  const router = useRouter();

  const {
    pendingSubscriptionDraft,
    saveSubscriptionDeliveryDetails,
  } = useSubscriptions();

  const {
    checking: checkingPincode,
    checked: pincodeChecked,
    location: serviceableLocation,
    message: pincodeMessage,
    requestError: pincodeRequestError,
    checkPincode,
    resetPincodeCheck,
  } = useServiceablePincode();

  const plan = pendingSubscriptionDraft
    ? getSubscriptionPlan(
        pendingSubscriptionDraft.planId
      )
    : undefined;

  const [fullName, setFullName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [pincode, setPincode] =
    useState("");

  const [
    houseDetails,
    setHouseDetails,
  ] = useState("");

  const [
    areaDetails,
    setAreaDetails,
  ] = useState("");

  const [landmark, setLandmark] =
    useState("");

  const cleanPhone =
    phone.replace(/\D/g, "");

  const phoneIsValid =
    cleanPhone.length === 10;

  const addressIsComplete =
    fullName.trim().length >= 2 &&
    phoneIsValid &&
    houseDetails.trim().length >= 3 &&
    areaDetails.trim().length >= 3;

  const meetsMinimumOrder = Boolean(
    serviceableLocation &&
      pendingSubscriptionDraft &&
      pendingSubscriptionDraft.total >=
        serviceableLocation.minimumOrder
  );

  const canContinue = Boolean(
    pendingSubscriptionDraft &&
      plan &&
      serviceableLocation &&
      addressIsComplete &&
      meetsMinimumOrder &&
      !checkingPincode
  );

  const handlePincodeChange = (
    value: string
  ) => {
    const digitsOnly =
      value.replace(/\D/g, "");

    setPincode(digitsOnly);
    resetPincodeCheck();
  };

  const handleCheckPincode =
    async () => {
      if (pincode.length !== 6) {
        Alert.alert(
          "Enter a valid pincode",
          "Please enter a six-digit delivery pincode."
        );

        return;
      }

      await checkPincode(pincode);
    };

  const handleContinue = () => {
    if (
      !canContinue ||
      !serviceableLocation
    ) {
      Alert.alert(
        "Complete your delivery details",
        "Enter a valid address and confirm a serviceable pincode."
      );

      return;
    }

    const saved =
      saveSubscriptionDeliveryDetails({
        fullName: fullName.trim(),
        phone: cleanPhone,
        pincode,

        houseDetails:
          houseDetails.trim(),

        areaDetails:
          areaDetails.trim(),

        landmark: landmark.trim(),

        area: serviceableLocation.area,
        city: serviceableLocation.city,
      });

    if (!saved) {
      Alert.alert(
        "Unable to continue",
        "Your subscription details are missing. Please rebuild the plan."
      );

      return;
    }

    router.push("/subscription-payment");
  };

  if (
    !pendingSubscriptionDraft ||
    !plan
  ) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="repeat-outline"
              size={38}
              color="#35694E"
            />
          </View>

          <Text style={styles.emptyTitle}>
            Plan details unavailable
          </Text>

          <Text
            style={styles.emptyDescription}
          >
            Choose a weekly or monthly plan
            before entering your address.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/(tabs)/plans"
              )
            }
            style={({ pressed }) => [
              styles.returnButton,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={
                styles.returnButtonText
              }
            >
              View plans
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
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
            <Text style={styles.headerTitle}>
              Subscription delivery
            </Text>

            <Text
              style={styles.headerSubtitle}
            >
              Address and availability
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <View
            style={styles.progressContainer}
          >
            <View style={styles.progressItem}>
              <View
                style={styles.progressComplete}
              >
                <Ionicons
                  name="checkmark"
                  size={15}
                  color="#FFFFFF"
                />
              </View>

              <Text
                style={styles.progressLabel}
              >
                Plan
              </Text>
            </View>

            <View
              style={styles.progressLineActive}
            />

            <View style={styles.progressItem}>
              <View
                style={styles.progressCurrent}
              >
                <Text
                  style={
                    styles.progressCurrentText
                  }
                >
                  2
                </Text>
              </View>

              <Text
                style={
                  styles.progressLabelActive
                }
              >
                Delivery
              </Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressItem}>
              <View
                style={styles.progressPending}
              >
                <Text
                  style={
                    styles.progressPendingText
                  }
                >
                  3
                </Text>
              </View>

              <Text
                style={styles.progressLabel}
              >
                Payment
              </Text>
            </View>
          </View>

          <View style={styles.planCard}>
            <View style={styles.planIcon}>
              <Ionicons
                name="repeat-outline"
                size={22}
                color="#35694E"
              />
            </View>

            <View style={styles.planContent}>
              <Text style={styles.planName}>
                {plan.name}
              </Text>

              <Text
                style={styles.planDetails}
              >
                {plan.bottleCount} bottles ·{" "}
                {
                  pendingSubscriptionDraft.preferredDay
                }{" "}
                ·{" "}
                {
                  pendingSubscriptionDraft.preferredSlot
                }
              </Text>
            </View>

            <Text style={styles.planPrice}>
              ₹{pendingSubscriptionDraft.total}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Check delivery availability
            </Text>

            <Text
              style={styles.sectionDescription}
            >
              Subscriptions are available only
              in selected delivery locations.
            </Text>

            <View style={styles.pincodeRow}>
              <TextInput
                value={pincode}
                onChangeText={
                  handlePincodeChange
                }
                placeholder="Enter 6-digit pincode"
                placeholderTextColor="#A0A7A3"
                keyboardType="number-pad"
                maxLength={6}
                editable={!checkingPincode}
                style={styles.pincodeInput}
              />

              <Pressable
                disabled={checkingPincode}
                onPress={() => {
                  void handleCheckPincode();
                }}
                style={({ pressed }) => [
                  styles.checkButton,

                  checkingPincode &&
                    styles.checkButtonDisabled,

                  pressed &&
                    !checkingPincode &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={styles.checkButtonText}
                >
                  {checkingPincode
                    ? "Checking..."
                    : "Check"}
                </Text>
              </Pressable>
            </View>

            {pincodeChecked &&
            serviceableLocation ? (
              <View
                style={styles.availableCard}
              >
                <View
                  style={styles.availableIcon}
                >
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={styles.statusContent}
                >
                  <Text
                    style={
                      styles.availableTitle
                    }
                  >
                    Subscription delivery
                    available
                  </Text>

                  <Text
                    style={
                      styles.statusDescription
                    }
                  >
                    {serviceableLocation.area},{" "}
                    {serviceableLocation.city}
                  </Text>

                  <Text
                    style={
                      styles.minimumOrderText
                    }
                  >
                    Minimum order ₹
                    {
                      serviceableLocation.minimumOrder
                    }
                  </Text>
                </View>
              </View>
            ) : null}

            {pincodeChecked &&
            !serviceableLocation ? (
              <View
                style={
                  styles.unavailableCard
                }
              >
                <View
                  style={styles.unavailableIcon}
                >
                  <Ionicons
                    name={
                      pincodeRequestError
                        ? "cloud-offline-outline"
                        : "close"
                    }
                    size={18}
                    color="#FFFFFF"
                  />
                </View>

                <View
                  style={styles.statusContent}
                >
                  <Text
                    style={
                      styles.unavailableTitle
                    }
                  >
                    {pincodeRequestError
                      ? "Unable to check pincode"
                      : "Delivery not available"}
                  </Text>

                  <Text
                    style={
                      styles.statusDescription
                    }
                  >
                    {pincodeMessage ??
                      "We do not serve this pincode yet."}
                  </Text>
                </View>
              </View>
            ) : null}

            {serviceableLocation &&
            !meetsMinimumOrder ? (
              <View
                style={styles.minimumWarning}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#8A6815"
                />

                <Text
                  style={
                    styles.minimumWarningText
                  }
                >
                  This plan is ₹
                  {Math.max(
                    0,
                    serviceableLocation.minimumOrder -
                      pendingSubscriptionDraft.total
                  )}{" "}
                  below the minimum order for
                  this delivery location.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Delivery address
            </Text>

            <Text
              style={styles.sectionDescription}
            >
              Future recurring deliveries will
              be sent to this address.
            </Text>

            <FormInput
              label="Full name"
              placeholder="Enter customer name"
              value={fullName}
              onChangeText={setFullName}
            />

            <FormInput
              label="Mobile number"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={(value) =>
                setPhone(
                  value.replace(/\D/g, "")
                )
              }
              keyboardType="phone-pad"
              maxLength={10}
            />

            <FormInput
              label="House, flat or building"
              placeholder="Flat number, house number or building"
              value={houseDetails}
              onChangeText={setHouseDetails}
            />

            <FormInput
              label="Area and street"
              placeholder="Area, street or locality"
              value={areaDetails}
              onChangeText={setAreaDetails}
              multiline
            />

            <FormInput
              label="Landmark (optional)"
              placeholder="Nearby landmark"
              value={landmark}
              onChangeText={setLandmark}
            />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              Subscription summary
            </Text>

            <View style={styles.summaryRow}>
              <Text
                style={styles.summaryLabel}
              >
                Bottle total
              </Text>

              <Text
                style={styles.summaryValue}
              >
                ₹
                {
                  pendingSubscriptionDraft.originalTotal
                }
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text
                style={styles.summaryLabel}
              >
                Plan saving
              </Text>

              <Text
                style={styles.savingValue}
              >
                − ₹
                {
                  pendingSubscriptionDraft.savings
                }
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text
                style={styles.summaryLabel}
              >
                Recurring delivery
              </Text>

              <Text
                style={styles.savingValue}
              >
                Free
              </Text>
            </View>

            <View
              style={styles.summaryDivider}
            />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>
                {plan.billingCycle ===
                "weekly"
                  ? "Weekly total"
                  : "Monthly total"}
              </Text>

              <Text style={styles.totalValue}>
                ₹{pendingSubscriptionDraft.total}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomLabel}>
              {plan.billingCycle === "weekly"
                ? "Per week"
                : "Per month"}
            </Text>

            <Text style={styles.bottomAmount}>
              ₹{pendingSubscriptionDraft.total}
            </Text>
          </View>

          <Pressable
            disabled={!canContinue}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,

              !canContinue &&
                styles.continueButtonDisabled,

              pressed &&
                canContinue &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.continueButtonText
              }
            >
              Continue to payment
            </Text>

            <Ionicons
              name="arrow-forward"
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  keyboardView: {
    flex: 1,
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
    paddingBottom: 150,
  },

  progressContainer: {
    marginVertical: 15,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  progressItem: {
    alignItems: "center",
  },

  progressComplete: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCurrent: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#245C42",
    backgroundColor: "#E4EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  progressPending: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "#E5E8E3",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCurrentText: {
    color: "#245C42",
    fontSize: 11,
    fontWeight: "900",
  },

  progressPendingText: {
    color: "#8A928D",
    fontSize: 11,
    fontWeight: "800",
  },

  progressLabel: {
    color: "#8A928D",
    fontSize: 9,
    marginTop: 5,
  },

  progressLabelActive: {
    color: "#245C42",
    fontSize: 9,
    fontWeight: "800",
    marginTop: 5,
  },

  progressLine: {
    flex: 1,
    height: 2,
    marginTop: 15,
    backgroundColor: "#E2E6E0",
  },

  progressLineActive: {
    flex: 1,
    height: 2,
    marginTop: 15,
    backgroundColor: "#245C42",
  },

  planCard: {
    padding: 15,
    borderRadius: 21,
    backgroundColor: "#E8F0EA",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  planIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#D6E6DB",
    alignItems: "center",
    justifyContent: "center",
  },

  planContent: {
    flex: 1,
    marginLeft: 11,
  },

  planName: {
    color: "#294534",
    fontSize: 12,
    fontWeight: "900",
  },

  planDetails: {
    color: "#637168",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  planPrice: {
    color: "#244332",
    fontSize: 16,
    fontWeight: "900",
  },

  section: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAE5",
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#1D2922",
    fontSize: 16,
    fontWeight: "800",
  },

  sectionDescription: {
    color: "#727B76",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
    marginBottom: 16,
  },

  pincodeRow: {
    flexDirection: "row",
    gap: 9,
  },

  pincodeInput: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 15,
    backgroundColor: "#F2F4EF",
    borderWidth: 1,
    borderColor: "#E2E5DF",
    color: "#1D2922",
    fontSize: 13,
    fontWeight: "600",
  },

  checkButton: {
    width: 96,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  checkButtonDisabled: {
    backgroundColor: "#91A69A",
  },

  checkButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  availableCard: {
    marginTop: 13,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#E8F3EA",
    flexDirection: "row",
    alignItems: "center",
  },

  unavailableCard: {
    marginTop: 13,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FAECEC",
    flexDirection: "row",
    alignItems: "center",
  },

  availableIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#32714F",
    alignItems: "center",
    justifyContent: "center",
  },

  unavailableIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#B45151",
    alignItems: "center",
    justifyContent: "center",
  },

  statusContent: {
    flex: 1,
    marginLeft: 11,
  },

  availableTitle: {
    color: "#285C42",
    fontSize: 11,
    fontWeight: "800",
  },

  unavailableTitle: {
    color: "#963F3F",
    fontSize: 11,
    fontWeight: "800",
  },

  statusDescription: {
    color: "#68736C",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  minimumOrderText: {
    color: "#486554",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 4,
  },

  minimumWarning: {
    marginTop: 11,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#FFF6DC",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  minimumWarningText: {
    flex: 1,
    color: "#7A601E",
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "600",
  },

  inputGroup: {
    marginBottom: 14,
  },

  inputLabel: {
    color: "#4E5A53",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 7,
  },

  input: {
    minHeight: 51,
    borderRadius: 16,
    paddingHorizontal: 15,
    backgroundColor: "#F2F4EF",
    borderWidth: 1,
    borderColor: "#E2E5DF",
    color: "#1D2922",
    fontSize: 13,
  },

  multilineInput: {
    minHeight: 82,
    paddingTop: 14,
  },

  summaryCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#E8F0EA",
    marginBottom: 15,
  },

  summaryTitle: {
    color: "#294534",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 16,
  },

  summaryRow: {
    marginBottom: 11,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  summaryLabel: {
    color: "#607067",
    fontSize: 11,
  },

  summaryValue: {
    color: "#294534",
    fontSize: 11,
    fontWeight: "700",
  },

  savingValue: {
    color: "#34714F",
    fontSize: 11,
    fontWeight: "800",
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#D3E0D6",
    marginVertical: 5,
  },

  totalLabel: {
    color: "#233C2E",
    fontSize: 13,
    fontWeight: "800",
  },

  totalValue: {
    color: "#233C2E",
    fontSize: 17,
    fontWeight: "900",
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E8E3",
    flexDirection: "row",
    alignItems: "center",
  },

  bottomTotal: {
    width: 90,
  },

  bottomLabel: {
    color: "#78817C",
    fontSize: 9,
  },

  bottomAmount: {
    color: "#1D2922",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  continueButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  continueButtonDisabled: {
    backgroundColor: "#AAB7AE",
  },

  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },

  emptyContainer: {
    flex: 1,
    paddingHorizontal: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  emptyTitle: {
    color: "#1C2922",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyDescription: {
    color: "#747E78",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 9,
  },

  returnButton: {
    minHeight: 51,
    paddingHorizontal: 27,
    borderRadius: 17,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 23,
  },

  returnButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});