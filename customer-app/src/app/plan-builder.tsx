// customer-app/src/app/plan-builder.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BottleVisual from "../components/BottleVisual";
import { useProducts } from "../context/ProductContext";
import { useSubscriptions } from "../context/SubscriptionContext";

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

export default function PlanBuilderScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    planId?: string | string[];
  }>();

  const planId = Array.isArray(
    params.planId
  )
    ? params.planId[0]
    : params.planId;

  const {
    products,
    loading: loadingProducts,
  } = useProducts();

  const {
    loadingPlans,
    getPlanById,
    setPendingSubscriptionDraft,
  } = useSubscriptions();

  const plan = planId
    ? getPlanById(planId)
    : undefined;

  const [
    quantities,
    setQuantities,
  ] = useState<Record<string, number>>(
    {}
  );

  const [
    preferredDay,
    setPreferredDay,
  ] = useState("Monday");

  const [
    preferredSlot,
    setPreferredSlot,
  ] = useState(DELIVERY_SLOTS[0]);

  const eligibleProducts =
    useMemo(
      () =>
        products.filter(
          (product) =>
            product.available &&
            product.subscriptionEligible
        ),
      [products]
    );

  const selectedCount = Object.values(
    quantities
  ).reduce(
    (sum, quantity) =>
      sum + quantity,
    0
  );

  const originalTotal =
    eligibleProducts.reduce(
      (sum, product) =>
        sum +
        product.price *
          (quantities[product.id] ?? 0),
      0
    );

  const savings = plan
    ? Math.round(
        originalTotal *
          (plan.discountPercent / 100)
      )
    : 0;

  const total =
    originalTotal - savings;

  const updateQuantity = (
    productId: string,
    change: number
  ) => {
    if (!plan) {
      return;
    }

    setQuantities(
      (currentQuantities) => {
        const current =
          currentQuantities[productId] ??
          0;

        const next = Math.max(
          0,
          current + change
        );

        if (
          change > 0 &&
          selectedCount >=
            plan.bottleCount
        ) {
          return currentQuantities;
        }

        return {
          ...currentQuantities,
          [productId]: next,
        };
      }
    );
  };

  const handleContinue = () => {
    if (
      !plan ||
      selectedCount !==
        plan.bottleCount
    ) {
      return;
    }

    const selectedItems =
      eligibleProducts
        .filter(
          (product) =>
            (quantities[product.id] ??
              0) > 0
        )
        .map((product) => ({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity:
            quantities[product.id] ??
            0,
        }));

    setPendingSubscriptionDraft({
      planId: plan.planId,
      items: selectedItems,
      preferredDay,
      preferredSlot,
      originalTotal,
      savings,
      total,
    });

    router.push(
      "/subscription-checkout"
    );
  };

  if (
    loadingPlans ||
    loadingProducts
  ) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator
            size="large"
            color="#245C42"
          />

          <Text style={styles.loadingText}>
            Loading plan builder
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Ionicons
            name="calendar-outline"
            size={40}
            color="#35694E"
          />

          <Text style={styles.errorTitle}>
            Plan unavailable
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/(tabs)/plans"
              )
            }
            style={styles.returnButton}
          >
            <Text
              style={styles.returnButtonText}
            >
              Return to plans
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const remaining =
    plan.bottleCount -
    selectedCount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
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

          <Text
            style={styles.headerSubtitle}
          >
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
        <View style={styles.summaryBanner}>
          <Text
            style={styles.summaryBannerTitle}
          >
            Select exactly{" "}
            {plan.bottleCount} bottles
          </Text>

          <Text
            style={
              styles.summaryBannerText
            }
          >
            {remaining > 0
              ? `${remaining} bottles remaining`
              : "Bottle selection complete"}
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    (selectedCount /
                      plan.bottleCount) *
                      100
                  )}%`,
                },
              ]}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Choose bottles
        </Text>

        <View style={styles.productsGrid}>
          {eligibleProducts.map(
            (product) => {
              const quantity =
                quantities[product.id] ??
                0;

              return (
                <View
                  key={product.id}
                  style={[
                    styles.productCard,
                    {
                      backgroundColor:
                        product.cardColor,
                    },
                  ]}
                >
                  <BottleVisual
                    label={
                      product.shortName
                    }
                    liquidColor={
                      product.liquidColor
                    }
                    accentColor={
                      product.accentColor
                    }
                  />

                  <Text
                    numberOfLines={2}
                    style={styles.productName}
                  >
                    {product.name}
                  </Text>

                  <Text
                    style={
                      styles.productPrice
                    }
                  >
                    ₹{product.price}
                  </Text>

                  <View
                    style={
                      styles.quantityControl
                    }
                  >
                    <Pressable
                      onPress={() =>
                        updateQuantity(
                          product.id,
                          -1
                        )
                      }
                      style={
                        styles.quantityButton
                      }
                    >
                      <Ionicons
                        name="remove"
                        size={15}
                        color="#245C42"
                      />
                    </Pressable>

                    <Text
                      style={
                        styles.quantityText
                      }
                    >
                      {quantity}
                    </Text>

                    <Pressable
                      onPress={() =>
                        updateQuantity(
                          product.id,
                          1
                        )
                      }
                      style={
                        styles.quantityButton
                      }
                    >
                      <Ionicons
                        name="add"
                        size={15}
                        color="#245C42"
                      />
                    </Pressable>
                  </View>
                </View>
              );
            }
          )}
        </View>

        <Text style={styles.sectionTitle}>
          Preferred delivery day
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.optionRow
          }
        >
          {DELIVERY_DAYS.map((day) => (
            <Pressable
              key={day}
              onPress={() =>
                setPreferredDay(day)
              }
              style={[
                styles.optionChip,
                preferredDay === day &&
                  styles.optionChipActive,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  preferredDay === day &&
                    styles.optionTextActive,
                ]}
              >
                {day}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>
          Preferred delivery slot
        </Text>

        <View style={styles.slotContainer}>
          {DELIVERY_SLOTS.map((slot) => (
            <Pressable
              key={slot}
              onPress={() =>
                setPreferredSlot(slot)
              }
              style={[
                styles.slotButton,
                preferredSlot === slot &&
                  styles.slotButtonActive,
              ]}
            >
              <Ionicons
                name="time-outline"
                size={17}
                color={
                  preferredSlot === slot
                    ? "#FFFFFF"
                    : "#35694E"
                }
              />

              <Text
                style={[
                  styles.slotText,
                  preferredSlot === slot &&
                    styles.slotTextActive,
                ]}
              >
                {slot}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.priceCard}>
          <PriceRow
            label="Bottle total"
            value={`₹${originalTotal}`}
          />

          <PriceRow
            label={`Plan saving (${plan.discountPercent}%)`}
            value={`− ₹${savings}`}
            saving
          />

          <View style={styles.divider} />

          <PriceRow
            label={
              plan.billingCycle ===
              "weekly"
                ? "Weekly total"
                : "Monthly total"
            }
            value={`₹${total}`}
            total
          />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>
            Selected
          </Text>

          <Text style={styles.bottomValue}>
            {selectedCount}/
            {plan.bottleCount}
          </Text>
        </View>

        <Pressable
          disabled={
            selectedCount !==
            plan.bottleCount
          }
          onPress={handleContinue}
          style={[
            styles.continueButton,
            selectedCount !==
              plan.bottleCount &&
              styles.continueDisabled,
          ]}
        >
          <Text
            style={styles.continueText}
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

function PriceRow({
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
    <View style={styles.priceRow}>
      <Text
        style={[
          styles.priceLabel,
          total && styles.totalLabel,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.priceValue,
          saving && styles.savingValue,
          total && styles.totalValue,
        ]}
      >
        {value}
      </Text>
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
    paddingBottom: 145,
  },

  summaryBanner: {
    padding: 17,
    borderRadius: 22,
    backgroundColor: "#E8F0EA",
    marginTop: 10,
  },

  summaryBannerTitle: {
    color: "#284633",
    fontSize: 14,
    fontWeight: "900",
  },

  summaryBannerText: {
    color: "#657269",
    fontSize: 9,
    marginTop: 5,
  },

  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D0DED3",
    overflow: "hidden",
    marginTop: 13,
  },

  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#245C42",
  },

  sectionTitle: {
    color: "#1D2922",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 22,
    marginBottom: 12,
  },

  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 11,
  },

  productCard: {
    width: "48%",
    minHeight: 245,
    padding: 13,
    borderRadius: 22,
    alignItems: "center",
  },

  productName: {
    color: "#203128",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
    minHeight: 32,
    marginTop: 8,
  },

  productPrice: {
    color: "#536159",
    fontSize: 10,
    marginTop: 4,
  },

  quantityControl: {
    padding: 3,
    borderRadius: 13,
    backgroundColor:
      "rgba(255,255,255,0.75)",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 11,
  },

  quantityButton: {
    width: 31,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityText: {
    minWidth: 25,
    textAlign: "center",
    color: "#203128",
    fontSize: 12,
    fontWeight: "900",
  },

  optionRow: {
    gap: 8,
  },

  optionChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#E9ECE7",
  },

  optionChipActive: {
    backgroundColor: "#245C42",
  },

  optionText: {
    color: "#657269",
    fontSize: 10,
    fontWeight: "700",
  },

  optionTextActive: {
    color: "#FFFFFF",
  },

  slotContainer: {
    gap: 9,
  },

  slotButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E5DF",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  slotButtonActive: {
    backgroundColor: "#245C42",
    borderColor: "#245C42",
  },

  slotText: {
    color: "#536159",
    fontSize: 10,
    fontWeight: "700",
  },

  slotTextActive: {
    color: "#FFFFFF",
  },

  priceCard: {
    padding: 18,
    borderRadius: 23,
    backgroundColor: "#E8F0EA",
    marginTop: 20,
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  priceLabel: {
    color: "#607067",
    fontSize: 10,
  },

  priceValue: {
    color: "#294534",
    fontSize: 11,
    fontWeight: "700",
  },

  savingValue: {
    color: "#34714F",
  },

  divider: {
    height: 1,
    backgroundColor: "#D3E0D6",
    marginBottom: 11,
  },

  totalLabel: {
    color: "#233C2E",
    fontSize: 12,
    fontWeight: "900",
  },

  totalValue: {
    color: "#233C2E",
    fontSize: 16,
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

  bottomLabel: {
    color: "#78817C",
    fontSize: 9,
  },

  bottomValue: {
    color: "#1D2922",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },

  continueButton: {
    flex: 1,
    minHeight: 53,
    borderRadius: 18,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginLeft: 25,
  },

  continueDisabled: {
    backgroundColor: "#AAB7AE",
  },

  continueText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },

  centerState: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#657269",
    fontSize: 11,
    marginTop: 12,
  },

  errorTitle: {
    color: "#203128",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 15,
  },

  returnButton: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#245C42",
    justifyContent: "center",
    marginTop: 18,
  },

  returnButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
});