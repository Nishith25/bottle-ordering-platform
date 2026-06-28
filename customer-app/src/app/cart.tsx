// customer-app/src/app/cart.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BottleVisual from "../components/BottleVisual";
import { useCart } from "../context/CartContext";

export default function CartScreen() {
  const router = useRouter();

  const {
    items,
    itemCount,
    subtotal,
    increaseItem,
    decreaseItem,
    removeItem,
  } = useCart();

  const deliveryFee =
    subtotal === 0 || subtotal >= 399 ? 0 : 39;

  const total = subtotal + deliveryFee;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Ionicons
            name="close"
            size={23}
            color="#203128"
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Your cart</Text>

          <Text style={styles.subtitle}>
            {itemCount}{" "}
            {itemCount === 1 ? "bottle" : "bottles"}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {items.length === 0 ? (
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
            Add some fresh bottles before continuing.
          </Text>

          <Pressable
            onPress={() => router.back()}
            style={styles.browseButton}
          >
            <Text style={styles.browseButtonText}>
              Browse bottles
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.notice}>
              <Ionicons
                name="snow-outline"
                size={20}
                color="#35694E"
              />

              <Text style={styles.noticeText}>
                Refrigerate the bottles after delivery.
              </Text>
            </View>

            <View style={styles.itemsContainer}>
              {items.map(({ product, quantity }) => (
                <View
                  key={product.id}
                  style={styles.cartItem}
                >
                  <View
                    style={[
                      styles.productVisual,
                      {
                        backgroundColor: product.cardColor,
                      },
                    ]}
                  >
                    <BottleVisual
                      label={product.shortName}
                      liquidColor={product.liquidColor}
                      accentColor={product.accentColor}
                    />
                  </View>

                  <View style={styles.productDetails}>
                    <Text
                      style={styles.productName}
                      numberOfLines={2}
                    >
                      {product.name}
                    </Text>

                    <Text style={styles.productSize}>
                      {product.sizeMl} ml bottle
                    </Text>

                    <Text style={styles.productPrice}>
                      ₹{product.price * quantity}
                    </Text>

                    <View style={styles.itemActions}>
                      <View style={styles.quantityControl}>
                        <Pressable
                          onPress={() =>
                            decreaseItem(product.id)
                          }
                          style={styles.quantityButton}
                        >
                          <Ionicons
                            name="remove"
                            size={16}
                            color="#28563E"
                          />
                        </Pressable>

                        <Text style={styles.quantityText}>
                          {quantity}
                        </Text>

                        <Pressable
                          onPress={() =>
                            increaseItem(product.id)
                          }
                          style={styles.quantityButton}
                        >
                          <Ionicons
                            name="add"
                            size={16}
                            color="#28563E"
                          />
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() =>
                          removeItem(product.id)
                        }
                        style={styles.removeButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#A84C4C"
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                Order summary
              </Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Bottle subtotal
                </Text>

                <Text style={styles.summaryValue}>
                  ₹{subtotal}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Delivery
                </Text>

                <Text style={styles.summaryValue}>
                  {deliveryFee === 0
                    ? "Free"
                    : `₹${deliveryFee}`}
                </Text>
              </View>

              <View style={styles.divider} />

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

          <View style={styles.checkoutBar}>
            <View>
              <Text style={styles.checkoutLabel}>
                Total
              </Text>

              <Text style={styles.checkoutTotal}>
                ₹{total}
              </Text>
            </View>

            <Pressable style={styles.continueButton}>
              <Text style={styles.continueButtonText}>
                Continue
              </Text>

              <Ionicons
                name="arrow-forward"
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </>
      )}
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

  closeButton: {
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

  title: {
    color: "#19251E",
    fontSize: 18,
    fontWeight: "800",
  },

  subtitle: {
    color: "#77807B",
    fontSize: 10,
    marginTop: 3,
  },

  headerSpacer: {
    width: 44,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },

  notice: {
    padding: 14,
    marginVertical: 10,
    borderRadius: 17,
    backgroundColor: "#E5EFE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  noticeText: {
    color: "#4C6456",
    fontSize: 11,
    fontWeight: "600",
  },

  itemsContainer: {
    gap: 12,
  },

  cartItem: {
    padding: 13,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAE5",
    flexDirection: "row",
  },

  productVisual: {
    width: 104,
    minHeight: 135,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  productDetails: {
    flex: 1,
    marginLeft: 14,
  },

  productName: {
    color: "#1C2922",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },

  productSize: {
    color: "#7B847F",
    fontSize: 10,
    marginTop: 4,
  },

  productPrice: {
    color: "#1C2922",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },

  itemActions: {
    flex: 1,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  quantityControl: {
    padding: 3,
    borderRadius: 14,
    backgroundColor: "#E8F0EA",
    flexDirection: "row",
    alignItems: "center",
  },

  quantityButton: {
    width: 31,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityText: {
    minWidth: 23,
    textAlign: "center",
    color: "#244C36",
    fontSize: 12,
    fontWeight: "900",
  },

  removeButton: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#FAECEC",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAE5",
  },

  summaryTitle: {
    color: "#1C2922",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 17,
  },

  summaryRow: {
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  summaryLabel: {
    color: "#69736D",
    fontSize: 12,
  },

  summaryValue: {
    color: "#26352D",
    fontSize: 12,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    marginVertical: 7,
    backgroundColor: "#ECEEEA",
  },

  totalLabel: {
    color: "#1D2B23",
    fontSize: 14,
    fontWeight: "800",
  },

  totalValue: {
    color: "#1D2B23",
    fontSize: 18,
    fontWeight: "900",
  },

  checkoutBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 13,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E6E9E4",
    flexDirection: "row",
    alignItems: "center",
  },

  checkoutLabel: {
    color: "#7A837E",
    fontSize: 9,
  },

  checkoutTotal: {
    width: 90,
    color: "#1D2B23",
    fontSize: 19,
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
    gap: 9,
  },

  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
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