// customer-app/src/app/checkout.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import {
  getServiceableLocation,
  type ServiceableLocation,
} from "../data/serviceableLocations";

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

      day: date.toLocaleDateString("en-IN", {
        weekday: "short",
      }),

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

  const deliveryDays = useMemo(
    () => createDeliveryDays(),
    []
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pincode, setPincode] = useState("");
  const [houseDetails, setHouseDetails] = useState("");
  const [areaDetails, setAreaDetails] = useState("");
  const [landmark, setLandmark] = useState("");

  const [pincodeChecked, setPincodeChecked] =
    useState(false);

  const [
    serviceableLocation,
    setServiceableLocation,
  ] = useState<ServiceableLocation | null>(null);

  const [selectedDate, setSelectedDate] =
    useState<DeliveryDay | null>(null);

  const [selectedSlot, setSelectedSlot] =
    useState<string | null>(null);

  const deliveryFee =
    subtotal >= 399
      ? 0
      : serviceableLocation?.deliveryFee ?? 0;

  const total = subtotal + deliveryFee;

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
    meetsMinimumOrder;

  const handlePincodeChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");

    setPincode(digitsOnly);
    setPincodeChecked(false);
    setServiceableLocation(null);
  };

  const handleCheckPincode = () => {
    if (pincode.length !== 6) {
      Alert.alert(
        "Enter a valid pincode",
        "Please enter a six-digit delivery pincode."
      );

      return;
    }

    const location = getServiceableLocation(pincode);

    setPincodeChecked(true);
    setServiceableLocation(location);
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

          <Text style={styles.emptyTitle}>
            Your cart is empty
          </Text>

          <Text style={styles.emptyDescription}>
            Add bottles before entering delivery details.
          </Text>

          <Pressable
            onPress={() =>
              router.replace("/(tabs)/bottles")
            }
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
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
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
              Delivery details
            </Text>

            <Text style={styles.headerSubtitle}>
              Address and delivery schedule
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
            <View style={styles.progressItem}>
              <View
                style={[
                  styles.progressCircle,
                  styles.progressCircleComplete,
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={15}
                  color="#FFFFFF"
                />
              </View>

              <Text style={styles.progressLabel}>
                Cart
              </Text>
            </View>

            <View style={styles.progressLineActive} />

            <View style={styles.progressItem}>
              <View
                style={[
                  styles.progressCircle,
                  styles.progressCircleActive,
                ]}
              >
                <Text style={styles.progressNumberActive}>
                  2
                </Text>
              </View>

              <Text style={styles.progressLabelActive}>
                Delivery
              </Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressItem}>
              <View style={styles.progressCircle}>
                <Text style={styles.progressNumber}>
                  3
                </Text>
              </View>

              <Text style={styles.progressLabel}>
                Payment
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Check delivery availability
            </Text>

            <Text style={styles.sectionDescription}>
              Orders are currently accepted only in selected
              locations.
            </Text>

            <View style={styles.pincodeRow}>
              <TextInput
                value={pincode}
                onChangeText={handlePincodeChange}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor="#A0A7A3"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.pincodeInput}
              />

              <Pressable
                onPress={handleCheckPincode}
                style={({ pressed }) => [
                  styles.checkButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.checkButtonText}>
                  Check
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
                    name="close"
                    size={18}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.statusTextContainer}>
                  <Text style={styles.unavailableTitle}>
                    Delivery not available
                  </Text>

                  <Text style={styles.statusDescription}>
                    We are not serving this pincode yet.
                  </Text>
                </View>
              </View>
            ) : null}

            {serviceableLocation &&
            !meetsMinimumOrder ? (
              <View style={styles.minimumWarning}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#8A6815"
                />

                <Text style={styles.minimumWarningText}>
                  Add ₹
                  {serviceableLocation.minimumOrder -
                    subtotal}{" "}
                  more to meet the minimum order.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Delivery address
            </Text>

            <Text style={styles.sectionDescription}>
              Enter the address where the bottles should be
              delivered.
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
            <Text style={styles.sectionTitle}>
              Select delivery day
            </Text>

            <Text style={styles.sectionDescription}>
              Choose one of the available delivery dates.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateRow}
            >
              {deliveryDays.map((deliveryDay) => {
                const selected =
                  selectedDate?.id === deliveryDay.id;

                return (
                  <Pressable
                    key={deliveryDay.id}
                    onPress={() =>
                      setSelectedDate(deliveryDay)
                    }
                    style={({ pressed }) => [
                      styles.dateCard,
                      selected &&
                        styles.dateCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateDay,
                        selected &&
                          styles.dateTextSelected,
                      ]}
                    >
                      {deliveryDay.day}
                    </Text>

                    <Text
                      style={[
                        styles.dateValue,
                        selected &&
                          styles.dateTextSelected,
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
            <Text style={styles.sectionTitle}>
              Select delivery slot
            </Text>

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
                      selected &&
                        styles.slotButtonSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color={
                        selected
                          ? "#FFFFFF"
                          : "#42614F"
                      }
                    />

                    <Text
                      style={[
                        styles.slotText,
                        selected &&
                          styles.slotTextSelected,
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

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              Order summary
            </Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {itemCount}{" "}
                {itemCount === 1
                  ? "bottle"
                  : "bottles"}
              </Text>

              <Text style={styles.summaryValue}>
                ₹{subtotal}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Delivery fee
              </Text>

              <Text style={styles.summaryValue}>
                {deliveryFee === 0
                  ? "Free"
                  : `₹${deliveryFee}`}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>
                Total
              </Text>

              <Text style={styles.totalValue}>
                ₹{total}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>
              Total
            </Text>

            <Text style={styles.bottomTotalValue}>
              ₹{total}
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
    marginTop: 10,
    marginBottom: 22,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  progressItem: {
    alignItems: "center",
  },

  progressCircle: {
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "#E5E8E3",
    alignItems: "center",
    justifyContent: "center",
  },

  progressCircleComplete: {
    backgroundColor: "#245C42",
  },

  progressCircleActive: {
    borderWidth: 2,
    borderColor: "#245C42",
    backgroundColor: "#E4EFE7",
  },

  progressNumber: {
    color: "#8A928D",
    fontSize: 11,
    fontWeight: "800",
  },

  progressNumberActive: {
    color: "#245C42",
    fontSize: 11,
    fontWeight: "900",
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
    width: 84,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
  },

  checkButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
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

  statusIconAvailable: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#32714F",
    alignItems: "center",
    justifyContent: "center",
  },

  statusIconUnavailable: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#B45151",
    alignItems: "center",
    justifyContent: "center",
  },

  statusTextContainer: {
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

  dateRow: {
    gap: 9,
  },

  dateCard: {
    width: 76,
    height: 74,
    borderRadius: 17,
    backgroundColor: "#F0F3EE",
    borderWidth: 1,
    borderColor: "#E1E5DF",
    alignItems: "center",
    justifyContent: "center",
  },

  dateCardSelected: {
    backgroundColor: "#245C42",
    borderColor: "#245C42",
  },

  dateDay: {
    color: "#69736D",
    fontSize: 10,
    fontWeight: "700",
  },

  dateValue: {
    color: "#26352D",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
  },

  dateTextSelected: {
    color: "#FFFFFF",
  },

  slotContainer: {
    gap: 9,
  },

  slotButton: {
    minHeight: 49,
    borderRadius: 15,
    paddingHorizontal: 14,
    backgroundColor: "#F0F3EE",
    borderWidth: 1,
    borderColor: "#E1E5DF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  slotButtonSelected: {
    backgroundColor: "#245C42",
    borderColor: "#245C42",
  },

  slotText: {
    color: "#4E5E55",
    fontSize: 11,
    fontWeight: "700",
  },

  slotTextSelected: {
    color: "#FFFFFF",
  },

  slotCheckIcon: {
    marginLeft: "auto",
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
    fontWeight: "800",
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
    width: 85,
  },

  bottomTotalLabel: {
    color: "#78817C",
    fontSize: 9,
  },

  bottomTotalValue: {
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
    fontSize: 22,
    fontWeight: "800",
  },

  emptyDescription: {
    color: "#747E78",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 9,
  },

  browseButton: {
    minHeight: 51,
    paddingHorizontal: 27,
    borderRadius: 17,
    backgroundColor: "#245C42",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 23,
  },

  browseButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});