import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import { useCart } from "../context/CartContext";
import { useOrders } from "../context/OrderContext";
import { useServiceablePincode } from "../hooks/useServiceablePincode";
import {
  validateCoupon,
  type CouponQuote,
} from "../services/api";

type DeliveryDay = {
  id: string;
  day: string;
  date: string;
  fullDate: string;
};

type FormInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  maxLength?: number;
  multiline?: boolean;
};

const DELIVERY_SLOTS = [
  "8:00 AM – 10:00 AM",
  "10:00 AM – 12:00 PM",
  "4:00 PM – 6:00 PM",
  "6:00 PM – 8:00 PM",
];

function createDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDeliveryDays(): DeliveryDay[] {
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);

    return {
      id: createDateId(date),
      day: date.toLocaleDateString("en-IN", { weekday: "short" }),
      date: date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      fullDate: date.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    };
  });
}

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
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0A7A3"
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
      />
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, itemCount, subtotal } = useCart();
  const { setPendingCheckout } = useOrders();

  const {
    checking: checkingPincode,
    checked: pincodeChecked,
    location: serviceableLocation,
    message: pincodeMessage,
    requestError: pincodeRequestError,
    checkPincode,
    resetPincodeCheck,
  } = useServiceablePincode();

  const deliveryDays = useMemo(() => createDeliveryDays(), []);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pincode, setPincode] = useState("");
  const [houseDetails, setHouseDetails] = useState("");
  const [areaDetails, setAreaDetails] = useState("");
  const [landmark, setLandmark] = useState("");
  const [selectedDate, setSelectedDate] =
    useState<DeliveryDay | null>(null);
  const [selectedSlot, setSelectedSlot] =
    useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] =
    useState<CouponQuote | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(
    null
  );

  const deliveryFee =
    subtotal >= 399
      ? 0
      : serviceableLocation?.deliveryFee ?? 0;

  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const amountBeforeDiscount = subtotal + deliveryFee;
  const total = Math.max(
    0,
    subtotal - couponDiscount + deliveryFee
  );

  useEffect(() => {
    if (
      appliedCoupon &&
      appliedCoupon.eligibleAmount !== subtotal
    ) {
      setAppliedCoupon(null);
      setCouponError(
        "Your cart changed. Apply the coupon again to refresh the discount."
      );
    }
  }, [subtotal, appliedCoupon]);

  const cleanPhone = phone.replace(/\D/g, "");
  const phoneIsValid = cleanPhone.length === 10;

  const addressIsComplete =
    fullName.trim().length >= 2 &&
    phoneIsValid &&
    houseDetails.trim().length >= 3 &&
    areaDetails.trim().length >= 3;

  const meetsMinimumOrder =
    serviceableLocation !== null &&
    subtotal >= serviceableLocation.minimumOrder;

  const canContinue =
    items.length > 0 &&
    serviceableLocation !== null &&
    addressIsComplete &&
    selectedDate !== null &&
    selectedSlot !== null &&
    meetsMinimumOrder &&
    !checkingPincode &&
    !applyingCoupon;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/cart");
  };

  const handlePincodeChange = (value: string) => {
    setPincode(value.replace(/\D/g, ""));
    resetPincodeCheck();
  };

  const handleCheckPincode = async () => {
    if (pincode.length !== 6) {
      Alert.alert(
        "Enter a valid pincode",
        "Please enter a six-digit delivery pincode."
      );
      return;
    }

    await checkPincode(pincode);
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();

    if (!code) {
      setCouponError("Enter a coupon code.");
      return;
    }

    if (subtotal <= 0) {
      setCouponError("Add bottles before applying a coupon.");
      return;
    }

    setApplyingCoupon(true);
    setCouponError(null);

    try {
      const quote = await validateCoupon({
        code,
        context: "order",
        eligibleAmount: subtotal,
      });

      setAppliedCoupon(quote);
      setCouponInput(quote.code);
    } catch (requestError) {
      setAppliedCoupon(null);
      setCouponError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to apply this coupon."
      );
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  const handleContinue = () => {
    if (
      !canContinue ||
      !serviceableLocation ||
      !selectedDate ||
      !selectedSlot
    ) {
      Alert.alert(
        "Complete your delivery details",
        "Enter a valid address, check your pincode and select a delivery date and slot."
      );
      return;
    }

    setPendingCheckout({
      fullName: fullName.trim(),
      phone: cleanPhone,
      pincode,
      houseDetails: houseDetails.trim(),
      areaDetails: areaDetails.trim(),
      landmark: landmark.trim(),
      area: serviceableLocation.area,
      city: serviceableLocation.city,
      deliveryDateId: selectedDate.id,
      deliveryDateLabel: selectedDate.fullDate,
      deliverySlot: selectedSlot,
      deliveryFee,
      subtotal,
      amountBeforeDiscount,
      couponCode: appliedCoupon?.code ?? "",
      couponDiscount,
      total,
    });

    router.push("/payment");
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="bag-outline"
              size={38}
              color="#35694E"
            />
          </View>

          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyDescription}>
            Add bottles before entering delivery details.
          </Text>

          <Pressable
            onPress={() => router.replace("/(tabs)/bottles")}
            style={({ pressed }) => [
              styles.browseButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.browseButtonText}>
              Browse bottles
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            <Text style={styles.headerTitle}>Delivery details</Text>
            <Text style={styles.headerSubtitle}>
              Address, offer and delivery schedule
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.progressContainer}>
            <ProgressStep complete label="Cart" value="✓" />
            <View style={styles.progressLineActive} />
            <ProgressStep active label="Delivery" value="2" />
            <View style={styles.progressLine} />
            <ProgressStep label="Payment" value="3" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Check delivery availability
            </Text>
            <Text style={styles.sectionDescription}>
              Orders are currently accepted only in selected locations.
            </Text>

            <View style={styles.pincodeRow}>
              <TextInput
                value={pincode}
                onChangeText={handlePincodeChange}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor="#A0A7A3"
                keyboardType="number-pad"
                maxLength={6}
                editable={!checkingPincode}
                style={styles.pincodeInput}
              />

              <Pressable
                disabled={checkingPincode}
                onPress={() => void handleCheckPincode()}
                style={({ pressed }) => [
                  styles.checkButton,
                  checkingPincode && styles.checkButtonDisabled,
                  pressed &&
                    !checkingPincode &&
                    styles.pressed,
                ]}
              >
                <Text style={styles.checkButtonText}>
                  {checkingPincode ? "Checking..." : "Check"}
                </Text>
              </Pressable>
            </View>

            {pincodeChecked && serviceableLocation ? (
              <View style={styles.availableCard}>
                <View style={styles.statusIconAvailable}>
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.statusTextContainer}>
                  <Text style={styles.availableTitle}>
                    Delivery available
                  </Text>
                  <Text style={styles.statusDescription}>
                    {serviceableLocation.area},{" "}
                    {serviceableLocation.city}
                  </Text>
                  <Text style={styles.minimumOrderText}>
                    Minimum order ₹
                    {serviceableLocation.minimumOrder}
                  </Text>
                </View>
              </View>
            ) : null}

            {pincodeChecked && !serviceableLocation ? (
              <View style={styles.unavailableCard}>
                <View style={styles.statusIconUnavailable}>
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

                <View style={styles.statusTextContainer}>
                  <Text style={styles.unavailableTitle}>
                    {pincodeRequestError
                      ? "Unable to check pincode"
                      : "Delivery not available"}
                  </Text>
                  <Text style={styles.statusDescription}>
                    {pincodeMessage ??
                      "We are not serving this pincode yet."}
                  </Text>
                </View>
              </View>
            ) : null}

            {serviceableLocation && !meetsMinimumOrder ? (
              <View style={styles.minimumWarning}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#8A6815"
                />
                <Text style={styles.minimumWarningText}>
                  Add ₹
                  {Math.max(
                    0,
                    serviceableLocation.minimumOrder - subtotal
                  )}{" "}
                  more to meet the minimum order.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery address</Text>
            <Text style={styles.sectionDescription}>
              Enter the address where the bottles should be delivered.
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
                setPhone(value.replace(/\D/g, ""))
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select delivery day</Text>
            <Text style={styles.sectionDescription}>
              Choose one of the available delivery dates.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateRow}
            >
              {deliveryDays.map((deliveryDay) => {
                const selected = selectedDate?.id === deliveryDay.id;

                return (
                  <Pressable
                    key={deliveryDay.id}
                    onPress={() => setSelectedDate(deliveryDay)}
                    style={({ pressed }) => [
                      styles.dateCard,
                      selected && styles.dateCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateDay,
                        selected && styles.dateTextSelected,
                      ]}
                    >
                      {deliveryDay.day}
                    </Text>
                    <Text
                      style={[
                        styles.dateValue,
                        selected && styles.dateTextSelected,
                      ]}
                    >
                      {deliveryDay.date}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select delivery slot</Text>
            <Text style={styles.sectionDescription}>
              Select your preferred delivery time.
            </Text>

            <View style={styles.slotContainer}>
              {DELIVERY_SLOTS.map((slot) => {
                const selected = selectedSlot === slot;

                return (
                  <Pressable
                    key={slot}
                    onPress={() => setSelectedSlot(slot)}
                    style={({ pressed }) => [
                      styles.slotButton,
                      selected && styles.slotButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color={selected ? "#FFFFFF" : "#42614F"}
                    />
                    <Text
                      style={[
                        styles.slotText,
                        selected && styles.slotTextSelected,
                      ]}
                    >
                      {slot}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#FFFFFF"
                        style={styles.slotCheckIcon}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coupon code</Text>
            <Text style={styles.sectionDescription}>
              Coupon discounts apply to the bottle subtotal. The backend
              checks the code again before the order is created.
            </Text>

            {appliedCoupon ? (
              <View style={styles.appliedCouponCard}>
                <View style={styles.couponIcon}>
                  <Ionicons
                    name="pricetag-outline"
                    size={19}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.couponContent}>
                  <Text style={styles.couponCode}>
                    {appliedCoupon.code}
                  </Text>
                  <Text style={styles.couponDescription}>
                    You save ₹{appliedCoupon.discountAmount}
                  </Text>
                </View>

                <Pressable onPress={removeCoupon}>
                  <Text style={styles.removeCouponText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.couponRow}>
                <TextInput
                  value={couponInput}
                  onChangeText={(value) => {
                    setCouponInput(value.toUpperCase());
                    setCouponError(null);
                  }}
                  autoCapitalize="characters"
                  placeholder="Enter promo code"
                  placeholderTextColor="#A0A7A3"
                  editable={!applyingCoupon}
                  style={styles.couponInput}
                />

                <Pressable
                  disabled={applyingCoupon}
                  onPress={() => void handleApplyCoupon()}
                  style={({ pressed }) => [
                    styles.applyCouponButton,
                    applyingCoupon && styles.checkButtonDisabled,
                    pressed && !applyingCoupon && styles.pressed,
                  ]}
                >
                  <Text style={styles.applyCouponText}>
                    {applyingCoupon ? "Applying..." : "Apply"}
                  </Text>
                </Pressable>
              </View>
            )}

            {couponError ? (
              <Text style={styles.couponError}>{couponError}</Text>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order summary</Text>

            <SummaryRow
              label={`${itemCount} ${
                itemCount === 1 ? "bottle" : "bottles"
              }`}
              value={`₹${subtotal}`}
            />

            <SummaryRow
              label="Delivery fee"
              value={deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}
            />

            {couponDiscount > 0 ? (
              <SummaryRow
                label={`Coupon (${appliedCoupon?.code})`}
                value={`− ₹${couponDiscount}`}
                saving
              />
            ) : null}

            <View style={styles.summaryDivider} />

            <SummaryRow label="Total" value={`₹${total}`} total />
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>Total</Text>
            <Text style={styles.bottomTotalValue}>₹{total}</Text>
          </View>

          <Pressable
            disabled={!canContinue}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              !canContinue && styles.continueButtonDisabled,
              pressed && canContinue && styles.pressed,
            ]}
          >
            <Text style={styles.continueButtonText}>
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

function ProgressStep({
  label,
  value,
  active = false,
  complete = false,
}: {
  label: string;
  value: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <View style={styles.progressItem}>
      <View
        style={[
          styles.progressCircle,
          complete && styles.progressCircleComplete,
          active && styles.progressCircleActive,
        ]}
      >
        <Text
          style={[
            styles.progressNumber,
            (active || complete) && styles.progressNumberActive,
          ]}
        >
          {value}
        </Text>
      </View>
      <Text
        style={[
          styles.progressLabel,
          active && styles.progressLabelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  saving = false,
  total = false,
}: {
  label: string;
  value: string;
  saving?: boolean;
  total?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={total ? styles.totalLabel : styles.summaryLabel}>
        {label}
      </Text>
      <Text
        style={[
          total ? styles.totalValue : styles.summaryValue,
          saving && styles.savingValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F7F2" },
  keyboardView: { flex: 1 },
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
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#19251E", fontSize: 17, fontWeight: "800" },
  headerSubtitle: { color: "#77807B", fontSize: 9, marginTop: 3 },
  headerSpacer: { width: 44 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 150 },
  progressContainer: {
    marginTop: 10,
    marginBottom: 22,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  progressItem: { alignItems: "center" },
  progressCircle: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "#E5E8E3",
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleComplete: { backgroundColor: "#245C42" },
  progressCircleActive: {
    borderWidth: 2,
    borderColor: "#245C42",
    backgroundColor: "#E4EFE7",
  },
  progressNumber: { color: "#8A928D", fontSize: 11, fontWeight: "800" },
  progressNumberActive: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  progressLabel: { color: "#8A928D", fontSize: 9, marginTop: 5 },
  progressLabelActive: { color: "#245C42", fontWeight: "800" },
  progressLine: { flex: 1, height: 2, marginTop: 15, backgroundColor: "#E2E6E0" },
  progressLineActive: { flex: 1, height: 2, marginTop: 15, backgroundColor: "#245C42" },
  section: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EAE5",
    marginBottom: 14,
  },
  sectionTitle: { color: "#1D2922", fontSize: 16, fontWeight: "800" },
  sectionDescription: { color: "#727B76", fontSize: 10, lineHeight: 16, marginTop: 5, marginBottom: 16 },
  pincodeRow: { flexDirection: "row", gap: 9 },
  pincodeInput: { flex: 1, height: 52, borderRadius: 16, paddingHorizontal: 15, backgroundColor: "#F2F4EF", borderWidth: 1, borderColor: "#E2E5DF", color: "#1D2922", fontSize: 13, fontWeight: "600" },
  checkButton: { width: 96, height: 52, borderRadius: 16, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center" },
  checkButtonDisabled: { backgroundColor: "#91A69A" },
  checkButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  availableCard: { marginTop: 13, padding: 13, borderRadius: 16, backgroundColor: "#E8F3EA", flexDirection: "row", alignItems: "center" },
  unavailableCard: { marginTop: 13, padding: 13, borderRadius: 16, backgroundColor: "#FAECEC", flexDirection: "row", alignItems: "center" },
  statusIconAvailable: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#32714F", alignItems: "center", justifyContent: "center" },
  statusIconUnavailable: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#B45151", alignItems: "center", justifyContent: "center" },
  statusTextContainer: { flex: 1, marginLeft: 11 },
  availableTitle: { color: "#285C42", fontSize: 11, fontWeight: "800" },
  unavailableTitle: { color: "#963F3F", fontSize: 11, fontWeight: "800" },
  statusDescription: { color: "#68736C", fontSize: 9, lineHeight: 14, marginTop: 3 },
  minimumOrderText: { color: "#486554", fontSize: 8, fontWeight: "700", marginTop: 4 },
  minimumWarning: { marginTop: 11, padding: 11, borderRadius: 14, backgroundColor: "#FFF6DC", flexDirection: "row", alignItems: "center", gap: 8 },
  minimumWarningText: { flex: 1, color: "#7A601E", fontSize: 9, lineHeight: 14, fontWeight: "600" },
  inputGroup: { marginBottom: 14 },
  inputLabel: { color: "#4E5A53", fontSize: 10, fontWeight: "700", marginBottom: 7 },
  input: { minHeight: 51, borderRadius: 16, paddingHorizontal: 15, backgroundColor: "#F2F4EF", borderWidth: 1, borderColor: "#E2E5DF", color: "#1D2922", fontSize: 13 },
  multilineInput: { minHeight: 82, paddingTop: 14 },
  dateRow: { gap: 9 },
  dateCard: { width: 76, height: 74, borderRadius: 17, backgroundColor: "#F0F3EE", borderWidth: 1, borderColor: "#E1E5DF", alignItems: "center", justifyContent: "center" },
  dateCardSelected: { backgroundColor: "#245C42", borderColor: "#245C42" },
  dateDay: { color: "#69736D", fontSize: 10, fontWeight: "700" },
  dateValue: { color: "#26352D", fontSize: 12, fontWeight: "900", marginTop: 6 },
  dateTextSelected: { color: "#FFFFFF" },
  slotContainer: { gap: 9 },
  slotButton: { minHeight: 49, borderRadius: 15, paddingHorizontal: 14, backgroundColor: "#F0F3EE", borderWidth: 1, borderColor: "#E1E5DF", flexDirection: "row", alignItems: "center", gap: 10 },
  slotButtonSelected: { backgroundColor: "#245C42", borderColor: "#245C42" },
  slotText: { color: "#4E5E55", fontSize: 11, fontWeight: "700" },
  slotTextSelected: { color: "#FFFFFF" },
  slotCheckIcon: { marginLeft: "auto" },
  couponRow: { flexDirection: "row", gap: 9 },
  couponInput: { flex: 1, minHeight: 51, borderRadius: 16, paddingHorizontal: 15, backgroundColor: "#F2F4EF", borderWidth: 1, borderColor: "#E2E5DF", color: "#1D2922", fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  applyCouponButton: { width: 94, minHeight: 51, borderRadius: 16, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center" },
  applyCouponText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  appliedCouponCard: { padding: 13, borderRadius: 17, backgroundColor: "#E7F2E9", flexDirection: "row", alignItems: "center" },
  couponIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#34714F", alignItems: "center", justifyContent: "center" },
  couponContent: { flex: 1, marginLeft: 11 },
  couponCode: { color: "#285C42", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  couponDescription: { color: "#5D7264", fontSize: 9, marginTop: 3 },
  removeCouponText: { color: "#9A4646", fontSize: 9, fontWeight: "800" },
  couponError: { color: "#A34848", fontSize: 9, lineHeight: 14, marginTop: 10 },
  summaryCard: { padding: 18, borderRadius: 24, backgroundColor: "#E8F0EA", marginBottom: 15 },
  summaryTitle: { color: "#294534", fontSize: 14, fontWeight: "800", marginBottom: 16 },
  summaryRow: { marginBottom: 11, flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { color: "#607067", fontSize: 11 },
  summaryValue: { color: "#294534", fontSize: 11, fontWeight: "700" },
  savingValue: { color: "#34714F" },
  summaryDivider: { height: 1, backgroundColor: "#D3E0D6", marginVertical: 5 },
  totalLabel: { color: "#233C2E", fontSize: 13, fontWeight: "800" },
  totalValue: { color: "#233C2E", fontSize: 17, fontWeight: "900" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 13, paddingBottom: 24, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E8E3", flexDirection: "row", alignItems: "center" },
  bottomTotal: { width: 85 },
  bottomTotalLabel: { color: "#78817C", fontSize: 9 },
  bottomTotalValue: { color: "#1D2922", fontSize: 18, fontWeight: "900", marginTop: 2 },
  continueButton: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: "#245C42", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  continueButtonDisabled: { backgroundColor: "#AAB7AE" },
  continueButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  emptyContainer: { flex: 1, paddingHorizontal: 35, alignItems: "center", justifyContent: "center" },
  emptyIcon: { width: 84, height: 84, borderRadius: 28, backgroundColor: "#E5EFE7", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  emptyTitle: { color: "#1C2922", fontSize: 22, fontWeight: "800" },
  emptyDescription: { color: "#747E78", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 9 },
  browseButton: { minHeight: 51, paddingHorizontal: 27, borderRadius: 17, backgroundColor: "#245C42", alignItems: "center", justifyContent: "center", marginTop: 23 },
  browseButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
});
