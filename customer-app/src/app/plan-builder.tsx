// customer-app/src/app/plan-builder.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BottleVisual from "../components/BottleVisual";
import { useSubscriptions } from "../context/SubscriptionContext";
import { PRODUCTS } from "../data/products";
import {
  getSubscriptionPlan,
  SUBSCRIPTION_PLANS,
} from "../data/subscriptionPlans";

const DELIVERY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DELIVERY_SLOTS = [
  "8:00 AM – 10:00 AM",
  "10:00 AM – 12:00 PM",
  "4:00 PM – 6:00 PM",
  "6:00 PM – 8:00 PM",
];

function createDefaultQuantities(
  bottleCount: number
) {
  const eligibleProducts = PRODUCTS.filter(
    (product) =>
      product.subscriptionEligible &&
      product.available
  );

  const baseQuantity = Math.floor(
    bottleCount / eligibleProducts.length
  );

  const remainder =
    bottleCount % eligibleProducts.length;

  return eligibleProducts.reduce<
    Record<string, number>
  >((result, product, index) => {
    result[product.id] =
      baseQuantity +
      (index < remainder ? 1 : 0);

    return result;
  }, {});
}

export default function PlanBuilderScreen() {
  const router = useRouter();

  const { planId } =
    useLocalSearchParams<{
      planId?: string;
    }>();

  const plan =
    getSubscriptionPlan(planId ?? "") ??
    SUBSCRIPTION_PLANS[0];

  const eligibleProducts = useMemo(
    () =>
      PRODUCTS.filter(
        (product) =>
          product.subscriptionEligible &&
          product.available
      ),
    []
  );

  const [quantities, setQuantities] = useState<
    Record<string, number>
  >(() =>
    createDefaultQuantities(plan.bottleCount)
  );

  const [preferredDay, setPreferredDay] =
    useState("Monday");

  const [preferredSlot, setPreferredSlot] =
    useState(DELIVERY_SLOTS[0]);

  const { setPendingSubscriptionDraft } =
    useSubscriptions();

  const selectedBottleCount = useMemo(
    () =>
      Object.values(quantities).reduce(
        (total, quantity) =>
          total + quantity,
        0
      ),
    [quantities]
  );

  const originalTotal = useMemo(
    () =>
      eligibleProducts.reduce(
        (total, product) =>
          total +
          product.price *
            (quantities[product.id] ?? 0),
        0
      ),
    [eligibleProducts, quantities]
  );

  const discountedTotal = Math.round(
    originalTotal *
      (1 - plan.discountPercent / 100)
  );

  const savings =
    originalTotal - discountedTotal;

  const canContinue =
    selectedBottleCount ===
      plan.bottleCount &&
    preferredDay.length > 0 &&
    preferredSlot.length > 0;

  const increaseQuantity = (
    productId: string
  ) => {
    if (
      selectedBottleCount >=
      plan.bottleCount
    ) {
      return;
    }

    setQuantities((current) => ({
      ...current,
      [productId]:
        (current[productId] ?? 0) + 1,
    }));
  };

  const decreaseQuantity = (
    productId: string
  ) => {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(
        0,
        (current[productId] ?? 0) - 1
      ),
    }));
  };

  const handleContinue = () => {
    if (!canContinue) {
      Alert.alert(
        "Complete your bottle mix",
        `Select exactly ${plan.bottleCount} bottles.`
      );

      return;
    }

    setPendingSubscriptionDraft({
      planId: plan.id,
      quantities,
      preferredDay,
      preferredSlot,
      originalTotal,
      total: discountedTotal,
      savings,
    });

    router.push("/subscription-checkout");
  };

  const bottlesRemaining =
    plan.bottleCount -
    selectedBottleCount;

  return (
    <SafeAreaView style={styles.safeArea}>
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
            Build your plan
          </Text>

          <Text style={styles.headerSubtitle}>
            {plan.name}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={[
            styles.planSummary,
            {
              backgroundColor:
                plan.lightColor,
            },
          ]}
        >
          <View
            style={[
              styles.planSummaryIcon,
              {
                backgroundColor:
                  plan.accentColor,
              },
            ]}
          >
            <Ionicons
              name="repeat-outline"
              size={25}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.planSummaryText}>
            <Text style={styles.planSummaryName}>
              {plan.name}
            </Text>

            <Text
              style={
                styles.planSummaryDescription
              }
            >
              {plan.description}
            </Text>
          </View>

          <View
            style={[
              styles.discountBadge,
              {
                backgroundColor:
                  plan.accentColor,
              },
            ]}
          >
            <Text
              style={styles.discountBadgeText}
            >
              {plan.discountPercent}% OFF
            </Text>
          </View>
        </View>

        <View style={styles.selectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Choose your bottle mix
            </Text>

            <Text
              style={styles.sectionDescription}
            >
              Select exactly{" "}
              {plan.bottleCount} bottles.
            </Text>
          </View>

          <View
            style={[
              styles.selectionCount,
              selectedBottleCount ===
                plan.bottleCount &&
                styles.selectionCountComplete,
            ]}
          >
            <Text
              style={[
                styles.selectionCountText,
                selectedBottleCount ===
                  plan.bottleCount &&
                  styles.selectionCountTextComplete,
              ]}
            >
              {selectedBottleCount}/
              {plan.bottleCount}
            </Text>
          </View>
        </View>

        {bottlesRemaining > 0 ? (
          <View
            style={styles.remainingNotice}
          >
            <Ionicons
              name="information-circle-outline"
              size={17}
              color="#896917"
            />

            <Text
              style={
                styles.remainingNoticeText
              }
            >
              Select {bottlesRemaining} more{" "}
              {bottlesRemaining === 1
                ? "bottle"
                : "bottles"}
              .
            </Text>
          </View>
        ) : (
          <View
            style={styles.completeNotice}
          >
            <Ionicons
              name="checkmark-circle"
              size={17}
              color="#34714F"
            />

            <Text
              style={
                styles.completeNoticeText
              }
            >
              Your bottle mix is complete.
            </Text>
          </View>
        )}

        <View style={styles.productList}>
          {eligibleProducts.map(
            (product) => {
              const quantity =
                quantities[product.id] ?? 0;

              return (
                <View
                  key={product.id}
                  style={styles.productCard}
                >
                  <View
                    style={[
                      styles.productVisual,
                      {
                        backgroundColor:
                          product.cardColor,
                      },
                    ]}
                  >
                    <BottleVisual
                      label={product.shortName}
                      liquidColor={
                        product.liquidColor
                      }
                      accentColor={
                        product.accentColor
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.productInformation
                    }
                  >
                    <Text
                      style={styles.productName}
                    >
                      {product.name}
                    </Text>

                    <Text
                      style={
                        styles.productDetails
                      }
                    >
                      {product.sizeMl} ml · ₹
                      {product.price}
                    </Text>

                    <Text
                      numberOfLines={2}
                      style={
                        styles.productDescription
                      }
                    >
                      {product.description}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.quantityControl
                    }
                  >
                    <Pressable
                      onPress={() =>
                        decreaseQuantity(
                          product.id
                        )
                      }
                      disabled={quantity === 0}
                      style={[
                        styles.quantityButton,
                        quantity === 0 &&
                          styles.quantityButtonDisabled,
                      ]}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={
                          quantity === 0
                            ? "#A7AFAA"
                            : "#28563E"
                        }
                      />
                    </Pressable>

                    <Text
                      style={styles.quantityText}
                    >
                      {quantity}
                    </Text>

                    <Pressable
                      onPress={() =>
                        increaseQuantity(
                          product.id
                        )
                      }
                      disabled={
                        selectedBottleCount >=
                        plan.bottleCount
                      }
                      style={[
                        styles.quantityButton,
                        selectedBottleCount >=
                          plan.bottleCount &&
                          styles.quantityButtonDisabled,
                      ]}
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={
                          selectedBottleCount >=
                          plan.bottleCount
                            ? "#A7AFAA"
                            : "#28563E"
                        }
                      />
                    </Pressable>
                  </View>
                </View>
              );
            }
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Preferred delivery day
          </Text>

          <Text
            style={styles.sectionDescription}
          >
            Your recurring deliveries will
            normally arrive on this weekday.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.dayRow
            }
          >
            {DELIVERY_DAYS.map((day) => {
              const selected =
                preferredDay === day;

              return (
                <Pressable
                  key={day}
                  onPress={() =>
                    setPreferredDay(day)
                  }
                  style={[
                    styles.dayButton,
                    selected &&
                      styles.dayButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      selected &&
                        styles.dayButtonTextSelected,
                    ]}
                  >
                    {day.slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            Preferred delivery slot
          </Text>

          <Text
            style={styles.sectionDescription}
          >
            Select your preferred time for
            recurring deliveries.
          </Text>

          <View style={styles.slotList}>
            {DELIVERY_SLOTS.map((slot) => {
              const selected =
                preferredSlot === slot;

              return (
                <Pressable
                  key={slot}
                  onPress={() =>
                    setPreferredSlot(slot)
                  }
                  style={[
                    styles.slotButton,
                    selected &&
                      styles.slotButtonSelected,
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
                      style={styles.slotCheck}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.priceCard}>
          <Text
            style={styles.priceCardTitle}
          >
            Plan summary
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              Bottle total
            </Text>

            <Text style={styles.priceValue}>
              ₹{originalTotal}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              Plan saving (
              {plan.discountPercent}%)
            </Text>

            <Text
              style={styles.savingPrice}
            >
              − ₹{savings}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              Recurring delivery
            </Text>

            <Text
              style={styles.savingPrice}
            >
              Free
            </Text>
          </View>

          <View style={styles.priceDivider} />

          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>
              {plan.billingCycle ===
              "weekly"
                ? "Weekly total"
                : "Monthly total"}
            </Text>

            <Text style={styles.totalValue}>
              ₹{discountedTotal}
            </Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={19}
            color="#35694E"
          />

          <Text
            style={styles.disclaimerText}
          >
            You will enter your address and
            verify delivery availability on
            the next screen.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomPrice}>
          <Text
            style={styles.bottomPriceLabel}
          >
            {plan.billingCycle === "weekly"
              ? "Per week"
              : "Per month"}
          </Text>

          <Text
            style={styles.bottomPriceValue}
          >
            ₹{discountedTotal}
          </Text>
        </View>

        <Pressable
          disabled={!canContinue}
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.createButton,
            !canContinue &&
              styles.createButtonDisabled,
            pressed &&
              canContinue &&
              styles.pressed,
          ]}
        >
          <Text
            style={styles.createButtonText}
          >
            Continue
          </Text>

          <Ionicons
            name="arrow-forward"
            size={18}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </SafeAreaView>
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
    paddingBottom: 155,
  },

  planSummary: {
    padding: 17,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  planSummaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  planSummaryText: {
    flex: 1,
    marginLeft: 12,
  },

  planSummaryName: {
    color: "#1D2922",
    fontSize: 14,
    fontWeight: "900",
  },

  planSummaryDescription: {
    color: "#68736D",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },

  discountBadgeText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "900",
  },

  selectionHeader: {
    marginTop: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionTitle: {
    color: "#1D2922",
    fontSize: 16,
    fontWeight: "900",
  },

  sectionDescription: {
    color: "#727B76",
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },

  selectionCount: {
    minWidth: 57,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#F3EBD0",
    alignItems: "center",
  },

  selectionCountComplete: {
    backgroundColor: "#E3F0E7",
  },

  selectionCountText: {
    color: "#896917",
    fontSize: 11,
    fontWeight: "900",
  },

  selectionCountTextComplete: {
    color: "#34714F",
  },

  remainingNotice: {
    marginTop: 12,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#FFF5D9",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  remainingNoticeText: {
    color: "#806419",
    fontSize: 9,
    fontWeight: "700",
  },

  completeNotice: {
    marginTop: 12,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#E7F2EA",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  completeNoticeText: {
    color: "#34714F",
    fontSize: 9,
    fontWeight: "700",
  },

  productList: {
    marginTop: 13,
    gap: 11,
  },

  productCard: {
    padding: 12,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9E3",
    flexDirection: "row",
    alignItems: "center",
  },

  productVisual: {
    width: 78,
    height: 103,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ scale: 0.82 }],
  },

  productInformation: {
    flex: 1,
    marginLeft: 6,
  },

  productName: {
    color: "#1D2922",
    fontSize: 12,
    fontWeight: "900",
  },

  productDetails: {
    color: "#557064",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },

  productDescription: {
    color: "#7A837E",
    fontSize: 8,
    lineHeight: 12,
    marginTop: 5,
  },

  quantityControl: {
    padding: 3,
    borderRadius: 14,
    backgroundColor: "#E8F0EA",
    flexDirection: "row",
    alignItems: "center",
  },

  quantityButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityButtonDisabled: {
    opacity: 0.45,
  },

  quantityText: {
    minWidth: 23,
    textAlign: "center",
    color: "#244C36",
    fontSize: 12,
    fontWeight: "900",
  },

  sectionCard: {
    marginTop: 14,
    padding: 17,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E9E3",
  },

  dayRow: {
    marginTop: 15,
    gap: 8,
  },

  dayButton: {
    width: 55,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#F0F3EE",
    borderWidth: 1,
    borderColor: "#E1E5DF",
    alignItems: "center",
    justifyContent: "center",
  },

  dayButtonSelected: {
    backgroundColor: "#245C42",
    borderColor: "#245C42",
  },

  dayButtonText: {
    color: "#5E6B64",
    fontSize: 10,
    fontWeight: "800",
  },

  dayButtonTextSelected: {
    color: "#FFFFFF",
  },

  slotList: {
    marginTop: 15,
    gap: 9,
  },

  slotButton: {
    minHeight: 49,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#F0F3EE",
    borderWidth: 1,
    borderColor: "#E1E5DF",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  slotButtonSelected: {
    backgroundColor: "#245C42",
    borderColor: "#245C42",
  },

  slotText: {
    color: "#4E5E55",
    fontSize: 10,
    fontWeight: "700",
  },

  slotTextSelected: {
    color: "#FFFFFF",
  },

  slotCheck: {
    marginLeft: "auto",
  },

  priceCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: 23,
    backgroundColor: "#E8F0EA",
  },

  priceCardTitle: {
    color: "#294534",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 16,
  },

  priceRow: {
    marginBottom: 11,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  priceLabel: {
    color: "#607067",
    fontSize: 10,
  },

  priceValue: {
    color: "#294534",
    fontSize: 10,
    fontWeight: "700",
  },

  savingPrice: {
    color: "#34714F",
    fontSize: 10,
    fontWeight: "800",
  },

  priceDivider: {
    height: 1,
    backgroundColor: "#D3E0D6",
    marginVertical: 6,
  },

  totalLabel: {
    color: "#233C2E",
    fontSize: 13,
    fontWeight: "900",
  },

  totalValue: {
    color: "#233C2E",
    fontSize: 18,
    fontWeight: "900",
  },

  disclaimer: {
    marginTop: 13,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#EAF1EC",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  disclaimerText: {
    flex: 1,
    color: "#5E6F65",
    fontSize: 9,
    lineHeight: 14,
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

  bottomPrice: {
    width: 93,
  },

  bottomPriceLabel: {
    color: "#78817C",
    fontSize: 9,
  },

  bottomPriceValue: {
    color: "#1D2922",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  createButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  createButtonDisabled: {
    backgroundColor: "#AAB7AE",
  },

  createButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});