// customer-app/src/app/(tabs)/bottles.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import BottleVisual from "../../components/BottleVisual";

import { useCart } from "../../context/CartContext";

import { useProducts } from "../../context/ProductContext";

import type {
  Product,
  ProductCategory,
} from "../../data/products";

type Filter =
  | "All"
  | ProductCategory;

const FILTERS: Filter[] = [
  "All",
  "Hydrating",
  "Fruity",
];

function ProductCard({
  product,
}: {
  product: Product;
}) {
  const {
    addItem,
    increaseItem,
    decreaseItem,
    getQuantity,
  } = useCart();

  const quantity =
    getQuantity(product.id);

  const outOfStock =
    product.stockQuantity <= 0;

  const lowStock =
    !outOfStock &&
    product.stockQuantity <=
      product.lowStockThreshold;

  const maximumQuantity =
    Math.min(
      product.stockQuantity,
      50
    );

  const quantityLimitReached =
    quantity >=
    maximumQuantity;

  return (
    <View
      style={[
        styles.productCard,

        {
          backgroundColor:
            product.cardColor,
        },

        outOfStock &&
          styles.outOfStockCard,
      ]}
    >
      <View style={styles.productTopRow}>
        <View style={styles.sizeBadge}>
          <Text style={styles.sizeBadgeText}>
            {product.sizeMl} ml
          </Text>
        </View>

        <View style={styles.topBadgeGroup}>
          {lowStock ? (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockBadgeText}>
                Only{" "}
                {product.stockQuantity} left
              </Text>
            </View>
          ) : null}

          {outOfStock ? (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockBadgeText}>
                Sold out
              </Text>
            </View>
          ) : null}

          {!outOfStock &&
          product.subscriptionEligible ? (
            <View style={styles.planBadge}>
              <Ionicons
                name="repeat"
                size={11}
                color="#42664F"
              />

              <Text style={styles.planBadgeText}>
                Plans
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.visualArea}>
        <View
          style={[
            styles.visualCircle,

            {
              backgroundColor:
                "rgba(255,255,255,0.48)",
            },
          ]}
        />

        <BottleVisual
          label={product.shortName}
          liquidColor={
            product.liquidColor
          }
          accentColor={
            product.accentColor
          }
        />

        {outOfStock ? (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutOverlayText}>
              OUT OF STOCK
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        numberOfLines={2}
        style={styles.productName}
      >
        {product.name}
      </Text>

      <Text
        numberOfLines={2}
        style={styles.productDescription}
      >
        {product.description}
      </Text>

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.price}>
            ₹{product.price}
          </Text>

          <Text style={styles.taxText}>
            {outOfStock
              ? "currently unavailable"
              : `${product.stockQuantity} available`}
          </Text>
        </View>

        {quantity === 0 ? (
          <Pressable
            disabled={outOfStock}
            onPress={() =>
              addItem(product)
            }
            style={({ pressed }) => [
              styles.addButton,

              {
                backgroundColor:
                  outOfStock
                    ? "#AEB6B1"
                    : product.accentColor,
              },

              pressed &&
                !outOfStock &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name={
                outOfStock
                  ? "close"
                  : "add"
              }
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
        ) : (
          <View style={styles.quantityControl}>
            <Pressable
              onPress={() =>
                decreaseItem(
                  product.id
                )
              }
              style={
                styles.quantityButton
              }
            >
              <Ionicons
                name="remove"
                size={15}
                color="#244E38"
              />
            </Pressable>

            <Text style={styles.quantityText}>
              {quantity}
            </Text>

            <Pressable
              disabled={
                quantityLimitReached
              }
              onPress={() =>
                increaseItem(
                  product.id
                )
              }
              style={[
                styles.quantityButton,

                quantityLimitReached &&
                  styles.quantityButtonDisabled,
              ]}
            >
              <Ionicons
                name="add"
                size={15}
                color={
                  quantityLimitReached
                    ? "#A5ADA8"
                    : "#244E38"
                }
              />
            </Pressable>
          </View>
        )}
      </View>

      {quantityLimitReached &&
      !outOfStock ? (
        <Text style={styles.stockLimitText}>
          Maximum available quantity selected
        </Text>
      ) : null}
    </View>
  );
}

export default function BottlesScreen() {
  const router = useRouter();

  const {
    itemCount,
    subtotal,
    syncProducts,
  } = useCart();

  const {
    products,
    loading,
    refreshing,
    error,
    refreshProducts,
  } = useProducts();

  const [
    selectedFilter,
    setSelectedFilter,
  ] = useState<Filter>("All");

  useEffect(() => {
    if (products.length > 0) {
      syncProducts(products);
    }
  }, [
    products,
    syncProducts,
  ]);

  const filteredProducts =
    useMemo(() => {
      const visibleProducts =
        products.filter(
          (product) =>
            product.available
        );

      if (
        selectedFilter ===
        "All"
      ) {
        return visibleProducts;
      }

      return visibleProducts.filter(
        (product) =>
          product.category ===
          selectedFilter
      );
    }, [
      products,
      selectedFilter,
    ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>
            FRESH SELECTION
          </Text>

          <Text style={styles.title}>
            Choose your bottle
          </Text>

          <Text style={styles.subtitle}>
            Freshly prepared 300 ml bottles
            with live stock availability.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push("/cart")
          }
          style={({ pressed }) => [
            styles.cartButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="bag-outline"
            size={22}
            color="#244E38"
          />

          {itemCount > 0 ? (
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>
                {itemCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active =
            selectedFilter ===
            filter;

          return (
            <Pressable
              key={filter}
              onPress={() =>
                setSelectedFilter(
                  filter
                )
              }
              style={[
                styles.filterButton,

                active &&
                  styles.filterButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,

                  active &&
                    styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator
            size="large"
            color="#245C42"
          />

          <Text style={styles.stateTitle}>
            Loading fresh bottles
          </Text>

          <Text style={styles.stateDescription}>
            Getting the latest products,
            prices and stock.
          </Text>
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <View style={styles.errorIcon}>
            <Ionicons
              name="cloud-offline-outline"
              size={30}
              color="#A84C4C"
            />
          </View>

          <Text style={styles.stateTitle}>
            Unable to load bottles
          </Text>

          <Text style={styles.stateDescription}>
            {error}
          </Text>

          <Pressable
            onPress={() => {
              void refreshProducts();
            }}
            style={({ pressed }) => [
              styles.retryButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="refresh"
              size={17}
              color="#FFFFFF"
            />

            <Text style={styles.retryButtonText}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={
            filteredProducts
          }
          numColumns={2}
          keyExtractor={(item) =>
            item.id
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
            />
          )}
          columnWrapperStyle={
            styles.productRow
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshing={
            refreshing
          }
          onRefresh={() => {
            void refreshProducts();
          }}
          contentContainerStyle={[
            styles.listContent,

            itemCount > 0 &&
              styles.listWithCartBar,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Ionicons
                name="nutrition-outline"
                size={35}
                color="#35694E"
              />

              <Text style={styles.stateTitle}>
                No bottles available
              </Text>

              <Text style={styles.stateDescription}>
                Available products will
                appear here.
              </Text>
            </View>
          }
          ListFooterComponent={
            filteredProducts.length >
            0 ? (
              <View style={styles.deliveryNotice}>
                <View style={styles.deliveryIcon}>
                  <Ionicons
                    name="cube-outline"
                    size={20}
                    color="#386E52"
                  />
                </View>

                <View style={styles.deliveryText}>
                  <Text style={styles.deliveryTitle}>
                    Live inventory protected
                  </Text>

                  <Text style={styles.deliveryDescription}>
                    Stock is checked again
                    securely when your order
                    is placed.
                  </Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {itemCount > 0 ? (
        <View style={styles.floatingCartWrapper}>
          <Pressable
            onPress={() =>
              router.push("/cart")
            }
            style={({ pressed }) => [
              styles.floatingCart,

              pressed &&
                styles.pressed,
            ]}
          >
            <View style={styles.floatingCartCount}>
              <Text style={styles.floatingCartCountText}>
                {itemCount}
              </Text>
            </View>

            <View style={styles.floatingCartText}>
              <Text style={styles.floatingCartTitle}>
                View your cart
              </Text>

              <Text style={styles.floatingCartSubtitle}>
                {itemCount}{" "}
                {itemCount === 1
                  ? "bottle"
                  : "bottles"}
              </Text>
            </View>

            <Text style={styles.floatingCartPrice}>
              ₹{subtotal}
            </Text>

            <Ionicons
              name="arrow-forward"
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      ) : null}
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
    paddingTop: 10,
    paddingBottom: 19,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  headerText: {
    flex: 1,
    paddingRight: 14,
  },

  eyebrow: {
    color: "#4D765F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 8,
  },

  title: {
    color: "#17221C",
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1,
  },

  subtitle: {
    color: "#717A75",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  cartButton: {
    width: 47,
    height: 47,
    borderRadius: 17,
    backgroundColor: "#E5EFE7",
    alignItems: "center",
    justifyContent: "center",
  },

  cartCount: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: "#1F513B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F7F7F2",
  },

  cartCountText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },

  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 17,
    flexDirection: "row",
    gap: 9,
  },

  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#EAEBE6",
  },

  filterButtonActive: {
    backgroundColor: "#245C42",
  },

  filterText: {
    color: "#68716C",
    fontSize: 11,
    fontWeight: "700",
  },

  filterTextActive: {
    color: "#FFFFFF",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  listWithCartBar: {
    paddingBottom: 200,
  },

  productRow: {
    gap: 12,
    marginBottom: 12,
  },

  productCard: {
    flex: 1,
    minHeight: 335,
    padding: 13,
    borderRadius: 24,
    overflow: "hidden",

    ...Platform.select({
      ios: {
        shadowColor: "#17221C",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: {
          width: 0,
          height: 6,
        },
      },

      android: {
        elevation: 2,
      },
    }),
  },

  outOfStockCard: {
    opacity: 0.78,
  },

  productTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 26,
  },

  topBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  sizeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.72)",
  },

  sizeBadgeText: {
    color: "#5A635E",
    fontSize: 8,
    fontWeight: "800",
  },

  planBadge: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.72)",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  planBadgeText: {
    color: "#42664F",
    fontSize: 8,
    fontWeight: "800",
  },

  lowStockBadge: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FFF2C9",
  },

  lowStockBadgeText: {
    color: "#826014",
    fontSize: 7,
    fontWeight: "900",
  },

  outOfStockBadge: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F8DDDD",
  },

  outOfStockBadgeText: {
    color: "#954949",
    fontSize: 7,
    fontWeight: "900",
  },

  visualArea: {
    height: 135,
    alignItems: "center",
    justifyContent: "center",
  },

  visualCircle: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 58,
  },

  soldOutOverlay: {
    position: "absolute",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(113,45,45,0.88)",
  },

  soldOutOverlayText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  productName: {
    color: "#17221C",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    minHeight: 36,
  },

  productDescription: {
    color: "#6D7671",
    fontSize: 10,
    lineHeight: 15,
    minHeight: 31,
    marginTop: 4,
  },

  priceRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  price: {
    color: "#17221C",
    fontSize: 17,
    fontWeight: "900",
  },

  taxText: {
    color: "#7C857F",
    fontSize: 8,
    marginTop: 1,
  },

  addButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityControl: {
    padding: 3,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.78)",
    flexDirection: "row",
    alignItems: "center",
  },

  quantityButton: {
    width: 27,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityButtonDisabled: {
    opacity: 0.5,
  },

  quantityText: {
    minWidth: 20,
    textAlign: "center",
    color: "#1E3D2D",
    fontSize: 12,
    fontWeight: "900",
  },

  stockLimitText: {
    color: "#8A681E",
    fontSize: 7,
    lineHeight: 10,
    fontWeight: "700",
    marginTop: 7,
  },

  deliveryNotice: {
    marginTop: 13,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#E8F0EA",
    flexDirection: "row",
    alignItems: "center",
  },

  deliveryIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#D8E7DC",
    alignItems: "center",
    justifyContent: "center",
  },

  deliveryText: {
    flex: 1,
    marginLeft: 12,
  },

  deliveryTitle: {
    color: "#294534",
    fontSize: 12,
    fontWeight: "800",
  },

  deliveryDescription: {
    color: "#657269",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  stateContainer: {
    flex: 1,
    paddingHorizontal: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyList: {
    minHeight: 360,
    paddingHorizontal: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  stateTitle: {
    color: "#1C2922",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },

  stateDescription: {
    color: "#747E78",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 7,
  },

  errorIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: "#FAECEC",
    alignItems: "center",
    justifyContent: "center",
  },

  retryButton: {
    minHeight: 47,
    paddingHorizontal: 19,
    borderRadius: 15,
    backgroundColor: "#245C42",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 18,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  floatingCartWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 91,
  },

  floatingCart: {
    minHeight: 64,
    paddingHorizontal: 14,
    borderRadius: 21,
    backgroundColor: "#1F513B",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#14271B",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 9,
    },
    elevation: 12,
  },

  floatingCartCount: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  floatingCartCountText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  floatingCartText: {
    flex: 1,
    marginLeft: 11,
  },

  floatingCartTitle: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  floatingCartSubtitle: {
    color: "#C9DDD0",
    fontSize: 9,
    marginTop: 2,
  },

  floatingCartPrice: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginRight: 9,
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