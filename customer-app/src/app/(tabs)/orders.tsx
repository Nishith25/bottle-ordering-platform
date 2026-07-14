import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  useCart,
} from "../../context/CartContext";

import {
  useOrders,
} from "../../context/OrderContext";

import {
  useProducts,
} from "../../context/ProductContext";

import {
  createOrderReview,
  fetchMyOrderReviews,
} from "../../services/api";

import {
  createCustomerInvoicePrintLink,
} from "../../services/customerInvoicesApi";

import type {
  CreateOrderReviewInput,
  CustomerOrder,
  DeliveryStatus,
  OrderReview,
  OrderStatus,
} from "../../services/api";

import type {
  Product,
} from "../../data/products";

type RefundStatus =
  | "not_required"
  | "pending"
  | "processed"
  | "failed";

type OrderFilter =
  | "all"
  | "active"
  | "delivered"
  | "cancelled";

type RefundAwareOrder =
  CustomerOrder & {
    paymentGateway?:
      | ""
      | "razorpay";

    refundStatus?:
      RefundStatus;

    refundId?: string;
    refundAmount?: number;

    refundRequestedAt?:
      | string
      | null;

    refundProcessedAt?:
      | string
      | null;

    refundFailureReason?:
      string;
  };

const STATUS_LABELS: Record<
  OrderStatus,
  string
> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery:
    "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DELIVERY_STATUS_LABELS: Record<
  DeliveryStatus,
  string
> = {
  unassigned:
    "Waiting for delivery partner",

  assigned:
    "Delivery partner assigned",

  picked_up:
    "Order picked up",

  out_for_delivery:
    "Out for delivery",

  delivered:
    "Delivered",

  cancelled:
    "Delivery cancelled",
};

const ORDER_FILTERS: Array<{
  key: OrderFilter;
  label: string;
}> = [
  {
    key: "all",
    label: "All",
  },
  {
    key: "active",
    label: "Active",
  },
  {
    key: "delivered",
    label: "Delivered",
  },
  {
    key: "cancelled",
    label: "Cancelled",
  },
];

function normalizeText(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getRefundStatus(
  order: RefundAwareOrder
): RefundStatus {
  return (
    order.refundStatus ??
    "not_required"
  );
}

function formatRefundDate(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  return new Date(
    value
  ).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function shouldShowDeliveryTracking(
  order: RefundAwareOrder
) {
  if (
    order.orderStatus ===
      "cancelled" ||
    order.orderStatus ===
      "delivered"
  ) {
    return false;
  }

  return (
    order.deliveryStatus ===
      "assigned" ||
    order.deliveryStatus ===
      "picked_up" ||
    order.deliveryStatus ===
      "out_for_delivery" ||
    order.orderStatus ===
      "out_for_delivery"
  );
}

function getTrackingButtonLabel(
  order: RefundAwareOrder
) {
  if (
    order.deliveryStatus ===
      "out_for_delivery" ||
    order.orderStatus ===
      "out_for_delivery"
  ) {
    return "Track delivery & view OTP";
  }

  if (
    order.deliveryStatus ===
    "picked_up"
  ) {
    return "Track picked-up order";
  }

  return "Track delivery";
}

function filterOrder(
  order: RefundAwareOrder,
  filter: OrderFilter
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "delivered") {
    return (
      order.orderStatus ===
      "delivered"
    );
  }

  if (filter === "cancelled") {
    return (
      order.orderStatus ===
      "cancelled"
    );
  }

  return [
    "placed",
    "confirmed",
    "preparing",
    "out_for_delivery",
  ].includes(order.orderStatus);
}

function getEmptyFilterTitle(
  filter: OrderFilter
) {
  if (filter === "active") {
    return "No active orders";
  }

  if (filter === "delivered") {
    return "No delivered orders";
  }

  if (filter === "cancelled") {
    return "No cancelled orders";
  }

  return "No orders yet";
}

function getEmptyFilterDescription(
  filter: OrderFilter
) {
  if (filter === "active") {
    return "Placed, confirmed and out-for-delivery orders will appear here.";
  }

  if (filter === "delivered") {
    return "Completed orders will appear here.";
  }

  if (filter === "cancelled") {
    return "Cancelled and refunded orders will appear here.";
  }

  return "Your first bottle order will appear here.";
}

function findMatchingProduct(
  products: Product[],
  orderItem: RefundAwareOrder["items"][number]
) {
  const orderProductId =
    normalizeText(
      orderItem.productId
    );

  const orderName =
    normalizeText(
      orderItem.name
    );

  return products.find(
    (product) => {
      const productIds = [
        product.id,
        product.databaseId,
        product.name,
        product.shortName,
      ].map(normalizeText);

      return (
        productIds.includes(
          orderProductId
        ) ||
        (
          orderName.length >
            0 &&
          productIds.includes(
            orderName
          )
        )
      );
    }
  );
}

function showSimpleAlert(
  title: string,
  message: string
) {
  if (
    Platform.OS === "web" &&
    typeof window !==
      "undefined"
  ) {
    window.alert(
      `${title}\n\n${message}`
    );

    return;
  }

  Alert.alert(
    title,
    message
  );
}

export default function OrdersScreen() {
  const router = useRouter();

  const {
    token,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const {
    addItems,
  } = useCart();

  const {
    products,
    refreshProducts,
  } = useProducts();

  const {
    orders,
    loadingOrders,
    cancellingOrderId,
    error,
    refreshOrders,
    cancelOrder,
  } = useOrders();

  const [
    orderFilter,
    setOrderFilter,
  ] =
    useState<OrderFilter>(
      "all"
    );

  const [
    reviews,
    setReviews,
  ] = useState<OrderReview[]>(
    []
  );

  const [
    loadingReviews,
    setLoadingReviews,
  ] = useState(false);

  const [
    submittingReviewOrderId,
    setSubmittingReviewOrderId,
  ] = useState<string | null>(
    null
  );

  const [
    reorderingOrderId,
    setReorderingOrderId,
  ] = useState<string | null>(
    null
  );

  const [
    invoiceOrderId,
    setInvoiceOrderId,
  ] = useState<string | null>(
    null
  );

  const [
    reviewError,
    setReviewError,
  ] = useState<string | null>(
    null
  );

  const filteredOrders =
    useMemo(
      () =>
        (
          orders as RefundAwareOrder[]
        ).filter((order) =>
          filterOrder(
            order,
            orderFilter
          )
        ),
      [
        orders,
        orderFilter,
      ]
    );

  const filterCounts =
    useMemo(() => {
      const allOrders =
        orders as RefundAwareOrder[];

      return {
        all:
          allOrders.length,

        active:
          allOrders.filter(
            (order) =>
              filterOrder(
                order,
                "active"
              )
          ).length,

        delivered:
          allOrders.filter(
            (order) =>
              filterOrder(
                order,
                "delivered"
              )
          ).length,

        cancelled:
          allOrders.filter(
            (order) =>
              filterOrder(
                order,
                "cancelled"
              )
          ).length,
      };
    }, [
      orders,
    ]);

  const reviewsByOrderId =
    useMemo(() => {
      const result =
        new Map<
          string,
          OrderReview
        >();

      for (const review of reviews) {
        result.set(
          String(review.order),
          review
        );
      }

      return result;
    }, [reviews]);

  const loadReviews =
    useCallback(async () => {
      if (!token) {
        setReviews([]);
        return;
      }

      setLoadingReviews(true);
      setReviewError(null);

      try {
        const latestReviews =
          await fetchMyOrderReviews(
            token
          );

        setReviews(
          latestReviews
        );
      } catch (requestError) {
        setReviewError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your reviews."
        );
      } finally {
        setLoadingReviews(false);
      }
    }, [token]);

  useEffect(() => {
    if (
      isAuthenticated &&
      token
    ) {
      void loadReviews();
      return;
    }

    setReviews([]);
  }, [
    isAuthenticated,
    token,
    loadReviews,
  ]);

  const refreshEverything =
    async () => {
      await Promise.all([
        refreshOrders(),
        loadReviews(),
      ]);
    };

  const openDeliveryTracking = (
    order: RefundAwareOrder
  ) => {
    router.push({
      pathname:
        "/delivery-order",

      params: {
        orderId:
          order._id,
      },
    });
  };

  const handleOpenInvoice =
    async (
      order: RefundAwareOrder
    ) => {
      if (
        !token ||
        invoiceOrderId
      ) {
        return;
      }

      setInvoiceOrderId(
        order._id
      );

      try {
        const invoiceUrl =
          await createCustomerInvoicePrintLink(
            token,
            order.orderNumber ||
              order._id
          );

        const supported =
          await Linking.canOpenURL(
            invoiceUrl
          );

        if (!supported) {
          throw new Error(
            "Unable to open invoice link on this device."
          );
        }

        await Linking.openURL(
          invoiceUrl
        );
      } catch (requestError) {
        showSimpleAlert(
          "Unable to open invoice",
          requestError instanceof Error
            ? requestError.message
            : "Please try again."
        );
      } finally {
        setInvoiceOrderId(
          null
        );
      }
    };

  const handleReorder =
    async (
      order: RefundAwareOrder
    ) => {
      if (
        reorderingOrderId
      ) {
        return;
      }

      setReorderingOrderId(
        order._id
      );

      try {
        await refreshProducts({
          force: true,
          showIndicator: true,
        });

        if (
          products.length ===
          0
        ) {
          showSimpleAlert(
            "Unable to reorder",
            "Live product list is still loading. Please try again in a few seconds."
          );

          return;
        }

        const entries =
          order.items
            .map(
              (orderItem) => {
                const product =
                  findMatchingProduct(
                    products,
                    orderItem
                  );

                if (!product) {
                  return null;
                }

                return {
                  product,

                  quantity:
                    Number(
                      orderItem.quantity ||
                        0
                    ),
                };
              }
            )
            .filter(
              (
                entry
              ): entry is {
                product: Product;
                quantity: number;
              } =>
                Boolean(entry)
            );

        const missingItems =
          order.items.filter(
            (orderItem) =>
              !findMatchingProduct(
                products,
                orderItem
              )
          );

        const result =
          addItems(entries);

        const skippedCount =
          result.skippedItems.length +
          missingItems.length;

        if (
          result.addedQuantity <=
          0
        ) {
          showSimpleAlert(
            "Could not add items",
            "None of the previous order items are currently available in live stock."
          );

          return;
        }

        const messageParts = [
          `${result.addedQuantity} bottle${result.addedQuantity === 1 ? "" : "s"} added to your cart.`,
        ];

        if (
          result.adjustedItems.length >
          0
        ) {
          messageParts.push(
            `${result.adjustedItems.length} item${result.adjustedItems.length === 1 ? "" : "s"} adjusted based on live stock.`
          );
        }

        if (
          skippedCount > 0
        ) {
          messageParts.push(
            `${skippedCount} item${skippedCount === 1 ? "" : "s"} skipped because unavailable or out of stock.`
          );
        }

        showSimpleAlert(
          "Order added to cart",
          messageParts.join("\n")
        );

        router.push("/cart");
      } finally {
        setReorderingOrderId(
          null
        );
      }
    };

  const requestCancellation = (
    order: RefundAwareOrder
  ) => {
    const performCancellation =
      async () => {
        await cancelOrder(
          order._id,
          "Cancelled by customer"
        );
      };

    const refundMessage =
      order.paymentMethod ===
        "online" &&
      order.paymentStatus ===
        "paid"
        ? " A full Razorpay refund will be requested after cancellation."
        : "";

    if (
      Platform.OS === "web" &&
      typeof window !==
        "undefined"
    ) {
      const confirmed =
        window.confirm(
          `Cancel order ${order.orderNumber}?${refundMessage}`
        );

      if (confirmed) {
        void performCancellation();
      }

      return;
    }

    Alert.alert(
      "Cancel order",

      `Are you sure you want to cancel ${order.orderNumber}?${refundMessage}`,

      [
        {
          text: "Keep order",
          style: "cancel",
        },

        {
          text: "Cancel order",
          style:
            "destructive",

          onPress: () => {
            void performCancellation();
          },
        },
      ]
    );
  };

  const submitReview =
    async (
      orderId: string,
      input:
        CreateOrderReviewInput
    ) => {
      if (
        !token ||
        submittingReviewOrderId
      ) {
        return false;
      }

      setSubmittingReviewOrderId(
        orderId
      );

      setReviewError(null);

      try {
        const review =
          await createOrderReview(
            token,
            orderId,
            input
          );

        setReviews(
          (currentReviews) => [
            review,

            ...currentReviews.filter(
              (currentReview) =>
                String(
                  currentReview.order
                ) !== orderId
            ),
          ]
        );

        return true;
      } catch (requestError) {
        setReviewError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to submit your review."
        );

        return false;
      } finally {
        setSubmittingReviewOrderId(
          null
        );
      }
    };

  if (authLoading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centerState}
        >
          <Text
            style={styles.stateTitle}
          >
            Loading your account
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
          <View
            style={styles.stateIcon}
          >
            <Ionicons
              name="receipt-outline"
              size={37}
              color="#35694E"
            />
          </View>

          <Text
            style={styles.stateTitle}
          >
            Log in to view orders
          </Text>

          <Text
            style={
              styles.stateDescription
            }
          >
            Your completed orders will
            appear here after you log in.
          </Text>

          <Pressable
            onPress={() =>
              router.push("/login")
            }
            style={({ pressed }) => [
              styles.loginButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.loginButtonText
              }
            >
              Log in
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          ORDER HISTORY
        </Text>

        <Text style={styles.title}>
          Your orders
        </Text>

        <Text style={styles.subtitle}>
          Track current deliveries,
          review completed orders,
          refunds and previous bottle
          purchases.
        </Text>
      </View>

      <View style={styles.filterContainer}>
        {ORDER_FILTERS.map(
          (filter) => {
            const active =
              orderFilter ===
              filter.key;

            return (
              <Pressable
                key={filter.key}
                onPress={() =>
                  setOrderFilter(
                    filter.key
                  )
                }
                style={({ pressed }) => [
                  styles.filterChip,

                  active &&
                    styles.filterChipActive,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,

                    active &&
                      styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>

                <Text
                  style={[
                    styles.filterCount,

                    active &&
                      styles.filterCountActive,
                  ]}
                >
                  {
                    filterCounts[
                      filter.key
                    ]
                  }
                </Text>
              </Pressable>
            );
          }
        )}
      </View>

      {error || reviewError ? (
        <View
          style={styles.errorCard}
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color="#A34848"
          />

          <Text
            style={styles.errorText}
          >
            {reviewError || error}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={filteredOrders}
        keyExtractor={(order) =>
          order._id
        }
        refreshing={
          loadingOrders ||
          loadingReviews
        }
        onRefresh={() => {
          void refreshEverything();
        }}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          filteredOrders.length ===
          0
            ? styles.emptyListContent
            : styles.listContent
        }
        ListEmptyComponent={
          <View
            style={styles.centerState}
          >
            <View
              style={styles.stateIcon}
            >
              <Ionicons
                name="bag-handle-outline"
                size={37}
                color="#35694E"
              />
            </View>

            <Text
              style={styles.stateTitle}
            >
              {getEmptyFilterTitle(
                orderFilter
              )}
            </Text>

            <Text
              style={
                styles.stateDescription
              }
            >
              {getEmptyFilterDescription(
                orderFilter
              )}
            </Text>

            {orderFilter ===
            "all" ? (
              <Pressable
                onPress={() =>
                  router.push(
                    "/(tabs)/bottles"
                  )
                }
                style={({ pressed }) => [
                  styles.loginButton,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.loginButtonText
                  }
                >
                  Browse bottles
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const canCancel = [
            "placed",
            "confirmed",
          ].includes(
            item.orderStatus
          );

          const refundStatus =
            getRefundStatus(item);

          const showDeliveryTracking =
            shouldShowDeliveryTracking(
              item
            );

          const review =
            reviewsByOrderId.get(
              item._id
            );

          const isReordering =
            reorderingOrderId ===
            item._id;

          const isOpeningInvoice =
            invoiceOrderId ===
            item._id;

          return (
            <View
              style={styles.orderCard}
            >
              <View
                style={
                  styles.orderTopRow
                }
              >
                <View>
                  <Text
                    style={
                      styles.orderNumber
                    }
                  >
                    {item.orderNumber}
                  </Text>

                  <Text
                    style={
                      styles.orderDate
                    }
                  >
                    {new Date(
                      item.createdAt
                    ).toLocaleDateString(
                      "en-IN",

                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }
                    )}
                  </Text>
                </View>

                <StatusBadge
                  status={
                    item.orderStatus
                  }
                />
              </View>

              <View
                style={
                  styles.itemsContainer
                }
              >
                {item.items.map(
                  (orderItem) => (
                    <View
                      key={
                        orderItem.productId
                      }
                      style={
                        styles.itemRow
                      }
                    >
                      <View
                        style={
                          styles.itemQuantity
                        }
                      >
                        <Text
                          style={
                            styles.itemQuantityText
                          }
                        >
                          {
                            orderItem.quantity
                          }
                          ×
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.itemName
                        }
                      >
                        {orderItem.name}
                      </Text>

                      <Text
                        style={
                          styles.itemPrice
                        }
                      >
                        ₹
                        {
                          orderItem.lineTotal
                        }
                      </Text>
                    </View>
                  )
                )}
              </View>

              <View
                style={
                  styles.orderInformation
                }
              >
                <InformationRow
                  icon="calendar-outline"
                  text={
                    item
                      .deliverySchedule
                      .deliveryDateLabel
                  }
                />

                <InformationRow
                  icon="time-outline"
                  text={
                    item
                      .deliverySchedule
                      .deliverySlot
                  }
                />

                <InformationRow
                  icon="location-outline"
                  text={`${item.deliveryAddress.area}, ${item.deliveryAddress.city}`}
                />

                <InformationRow
                  icon="card-outline"
                  text={
                    item.paymentMethod ===
                    "cod"
                      ? "Cash on delivery"
                      : `Online payment · ${item.paymentStatus}`
                  }
                />

                {item.deliveryStatus &&
                item.deliveryStatus !==
                  "unassigned" ? (
                  <InformationRow
                    icon="bicycle-outline"
                    text={
                      DELIVERY_STATUS_LABELS[
                        item.deliveryStatus
                      ]
                    }
                  />
                ) : null}

                {item
                  .deliveryPartnerSnapshot
                  ?.fullName ? (
                  <InformationRow
                    icon="person-outline"
                    text={`Delivery partner: ${item.deliveryPartnerSnapshot.fullName}`}
                  />
                ) : null}
              </View>

              {item.orderStatus ===
                "cancelled" &&
              item.paymentMethod ===
                "online" ? (
                <RefundNotice
                  order={item}
                  status={
                    refundStatus
                  }
                />
              ) : null}

              <View
                style={styles.totalRow}
              >
                <Text
                  style={
                    styles.totalLabel
                  }
                >
                  Order total
                </Text>

                <Text
                  style={
                    styles.totalValue
                  }
                >
                  ₹{item.total}
                </Text>
              </View>

              <View
                style={
                  styles.orderActionsRow
                }
              >
                <Pressable
                  disabled={
                    isReordering
                  }
                  onPress={() => {
                    void handleReorder(
                      item
                    );
                  }}
                  style={({
                    pressed,
                  }) => [
                    styles.reorderButton,

                    isReordering &&
                      styles.reorderButtonDisabled,

                    pressed &&
                      !isReordering &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="repeat-outline"
                    size={17}
                    color="#245C42"
                  />

                  <Text
                    style={
                      styles.reorderButtonText
                    }
                  >
                    {isReordering
                      ? "Adding..."
                      : "Order again"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    isOpeningInvoice
                  }
                  onPress={() => {
                    void handleOpenInvoice(
                      item
                    );
                  }}
                  style={({
                    pressed,
                  }) => [
                    styles.invoiceButton,

                    isOpeningInvoice &&
                      styles.reorderButtonDisabled,

                    pressed &&
                      !isOpeningInvoice &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={17}
                    color="#245C42"
                  />

                  <Text
                    style={
                      styles.invoiceButtonText
                    }
                  >
                    {isOpeningInvoice
                      ? "Opening..."
                      : "Invoice"}
                  </Text>
                </Pressable>
              </View>

              {showDeliveryTracking ? (
                <Pressable
                  onPress={() =>
                    openDeliveryTracking(
                      item
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.trackingButton,

                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={
                      styles.trackingIcon
                    }
                  >
                    <Ionicons
                      name="navigate-outline"
                      size={19}
                      color="#FFFFFF"
                    />
                  </View>

                  <View
                    style={
                      styles.trackingContent
                    }
                  >
                    <Text
                      style={
                        styles.trackingButtonText
                      }
                    >
                      {getTrackingButtonLabel(
                        item
                      )}
                    </Text>

                    <Text
                      style={
                        styles.trackingDescription
                      }
                    >
                      View delivery status
                      and customer verification
                      code
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#FFFFFF"
                  />
                </Pressable>
              ) : null}

              {item.orderStatus ===
              "delivered" ? (
                review ? (
                  <SubmittedReview
                    review={review}
                  />
                ) : (
                  <ReviewForm
                    order={item}
                    submitting={
                      submittingReviewOrderId ===
                      item._id
                    }
                    onSubmit={(
                      input
                    ) =>
                      submitReview(
                        item._id,
                        input
                      )
                    }
                  />
                )
              ) : null}

              {canCancel ? (
                <Pressable
                  disabled={
                    cancellingOrderId ===
                    item._id
                  }
                  onPress={() =>
                    requestCancellation(
                      item
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.cancelButton,

                    cancellingOrderId ===
                      item._id &&
                      styles.cancelDisabled,

                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    {cancellingOrderId ===
                    item._id
                      ? "Cancelling..."
                      : item.paymentMethod ===
                            "online" &&
                          item.paymentStatus ===
                            "paid"
                        ? "Cancel and request refund"
                        : "Cancel order"}
                  </Text>
                </Pressable>
              ) : null}

              {item.orderStatus ===
                "cancelled" &&
              item.cancellationReason ? (
                <Text
                  style={
                    styles.cancellationText
                  }
                >
                  {
                    item.cancellationReason
                  }
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function ReviewForm({
  order,
  submitting,
  onSubmit,
}: {
  order: RefundAwareOrder;
  submitting: boolean;

  onSubmit: (
    input:
      CreateOrderReviewInput
  ) => Promise<boolean>;
}) {
  const [
    orderRating,
    setOrderRating,
  ] = useState(0);

  const [
    deliveryRating,
    setDeliveryRating,
  ] = useState(0);

  const [
    comment,
    setComment,
  ] = useState("");

  const canSubmit =
    orderRating > 0 &&
    deliveryRating > 0 &&
    !submitting;

  const handleSubmit =
    async () => {
      if (!canSubmit) {
        return;
      }

      const successful =
        await onSubmit({
          orderRating,
          deliveryRating,
          comment:
            comment.trim(),
        });

      if (successful) {
        setComment("");
      }
    };

  return (
    <View
      style={styles.reviewForm}
    >
      <View
        style={styles.reviewHeading}
      >
        <View
          style={
            styles.reviewHeadingIcon
          }
        >
          <Ionicons
            name="star-outline"
            size={21}
            color="#245C42"
          />
        </View>

        <View
          style={
            styles.reviewHeadingContent
          }
        >
          <Text
            style={styles.reviewTitle}
          >
            Rate your order
          </Text>

          <Text
            style={
              styles.reviewSubtitle
            }
          >
            Share feedback about the
            bottles and delivery service.
          </Text>
        </View>
      </View>

      <RatingInput
        label="Bottle order"
        value={orderRating}
        onChange={
          setOrderRating
        }
      />

      <RatingInput
        label={
          order
            .deliveryPartnerSnapshot
            ?.fullName
            ? `Delivery by ${order.deliveryPartnerSnapshot.fullName}`
            : "Delivery service"
        }
        value={deliveryRating}
        onChange={
          setDeliveryRating
        }
      />

      <TextInput
        value={comment}
        onChangeText={
          setComment
        }
        placeholder="Add an optional comment"
        placeholderTextColor="#98A29C"
        multiline
        maxLength={500}
        textAlignVertical="top"
        style={
          styles.reviewCommentInput
        }
      />

      <View
        style={
          styles.reviewFooter
        }
      >
        <Text
          style={
            styles.commentCount
          }
        >
          {comment.length}/500
        </Text>

        <Pressable
          disabled={!canSubmit}
          onPress={() => {
            void handleSubmit();
          }}
          style={[
            styles.reviewSubmitButton,

            !canSubmit &&
              styles.reviewSubmitDisabled,
          ]}
        >
          <Text
            style={
              styles.reviewSubmitText
            }
          >
            {submitting
              ? "Submitting..."
              : "Submit review"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    rating: number
  ) => void;
}) {
  return (
    <View
      style={styles.ratingRow}
    >
      <Text
        style={styles.ratingLabel}
      >
        {label}
      </Text>

      <View
        style={
          styles.ratingStars
        }
      >
        {[1, 2, 3, 4, 5].map(
          (rating) => (
            <Pressable
              key={rating}
              onPress={() =>
                onChange(rating)
              }
              hitSlop={6}
            >
              <Ionicons
                name={
                  rating <= value
                    ? "star"
                    : "star-outline"
                }
                size={25}
                color={
                  rating <= value
                    ? "#E4A72A"
                    : "#AAB4AE"
                }
              />
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

function SubmittedReview({
  review,
}: {
  review: OrderReview;
}) {
  return (
    <View
      style={
        styles.submittedReview
      }
    >
      <View
        style={
          styles.submittedReviewTop
        }
      >
        <View>
          <Text
            style={
              styles.submittedReviewTitle
            }
          >
            Your review
          </Text>

          <Text
            style={
              styles.submittedReviewDate
            }
          >
            Submitted{" "}
            {new Date(
              review.submittedAt ||
                review.createdAt
            ).toLocaleDateString(
              "en-IN",
              {
                day: "numeric",
                month: "short",
                year: "numeric",
              }
            )}
          </Text>
        </View>

        <Ionicons
          name="checkmark-circle"
          size={23}
          color="#2D714D"
        />
      </View>

      <ReadOnlyRating
        label="Bottle order"
        value={
          review.orderRating
        }
      />

      <ReadOnlyRating
        label="Delivery service"
        value={
          review.deliveryRating
        }
      />

      {review.comment ? (
        <Text
          style={
            styles.submittedComment
          }
        >
          “{review.comment}”
        </Text>
      ) : null}
    </View>
  );
}

function ReadOnlyRating({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View
      style={
        styles.readOnlyRating
      }
    >
      <Text
        style={
          styles.readOnlyLabel
        }
      >
        {label}
      </Text>

      <View
        style={
          styles.readOnlyStars
        }
      >
        {[1, 2, 3, 4, 5].map(
          (rating) => (
            <Ionicons
              key={rating}
              name={
                rating <= value
                  ? "star"
                  : "star-outline"
              }
              size={16}
              color={
                rating <= value
                  ? "#E4A72A"
                  : "#AAB4AE"
              }
            />
          )
        )}
      </View>
    </View>
  );
}

function RefundNotice({
  order,
  status,
}: {
  order: RefundAwareOrder;
  status: RefundStatus;
}) {
  if (
    status ===
    "not_required"
  ) {
    return null;
  }

  const amount =
    order.refundAmount ??
    order.total;

  const config = {
    pending: {
      icon:
        "time-outline" as const,

      title:
        "Refund processing",

      description:
        `A refund of ₹${amount} has been requested through Razorpay.`,

      container:
        styles.refundPending,

      iconColor:
        "#86651B",
    },

    processed: {
      icon:
        "checkmark-circle-outline" as const,

      title:
        "Refund completed",

      description:
        `₹${amount} was refunded${
          order.refundProcessedAt
            ? ` on ${formatRefundDate(
                order.refundProcessedAt
              )}`
            : ""
        }.`,

      container:
        styles.refundProcessed,

      iconColor:
        "#2D714D",
    },

    failed: {
      icon:
        "alert-circle-outline" as const,

      title:
        "Refund needs attention",

      description:
        order.refundFailureReason ||
        "The automatic refund could not be completed. The support team can retry it.",

      container:
        styles.refundFailed,

      iconColor:
        "#9B4949",
    },
  }[status];

  return (
    <View
      style={[
        styles.refundNotice,
        config.container,
      ]}
    >
      <Ionicons
        name={config.icon}
        size={20}
        color={
          config.iconColor
        }
      />

      <View
        style={
          styles.refundContent
        }
      >
        <Text
          style={
            styles.refundTitle
          }
        >
          {config.title}
        </Text>

        <Text
          style={
            styles.refundDescription
          }
        >
          {config.description}
        </Text>

        {order.refundId ? (
          <Text
            style={styles.refundId}
          >
            Refund ID:{" "}
            {order.refundId}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  return (
    <View
      style={[
        styles.statusBadge,

        status === "cancelled" &&
          styles.cancelledBadge,

        status === "delivered" &&
          styles.deliveredBadge,
      ]}
    >
      <Text
        style={[
          styles.statusText,

          status === "cancelled" &&
            styles.cancelledStatusText,

          status === "delivered" &&
            styles.deliveredStatusText,
        ]}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

function InformationRow({
  icon,
  text,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;

  text: string;
}) {
  return (
    <View
      style={
        styles.informationRow
      }
    >
      <Ionicons
        name={icon}
        size={16}
        color="#557064"
      />

      <Text
        style={
          styles.informationText
        }
      >
        {text}
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
      paddingHorizontal: 20,
      paddingTop: 13,
      paddingBottom: 14,
    },

    eyebrow: {
      color: "#4D765F",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.6,
    },

    title: {
      color: "#17221C",
      fontSize: 31,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 8,
    },

    subtitle: {
      color: "#717A75",
      fontSize: 12,
      lineHeight: 19,
      marginTop: 7,
    },

    filterContainer: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    filterChip: {
      minHeight: 38,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E7E2",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    filterChipActive: {
      backgroundColor:
        "#245C42",
      borderColor:
        "#245C42",
    },

    filterText: {
      color: "#5F6F66",
      fontSize: 10,
      fontWeight: "900",
    },

    filterTextActive: {
      color: "#FFFFFF",
    },

    filterCount: {
      minWidth: 20,
      overflow: "hidden",
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor:
        "#E8F0EA",
      color: "#245C42",
      fontSize: 9,
      fontWeight: "900",
      textAlign: "center",
    },

    filterCountActive: {
      backgroundColor:
        "rgba(255,255,255,0.18)",
      color: "#FFFFFF",
    },

    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 120,
    },

    emptyListContent: {
      flexGrow: 1,
    },

    orderCard: {
      padding: 17,
      borderRadius: 24,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E5E8E3",
      marginBottom: 13,
    },

    orderTopRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
    },

    orderNumber: {
      color: "#223229",
      fontSize: 13,
      fontWeight: "900",
    },

    orderDate: {
      color: "#7A847E",
      fontSize: 9,
      marginTop: 4,
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 11,
      backgroundColor:
        "#E4EFE7",
    },

    cancelledBadge: {
      backgroundColor:
        "#FAECEC",
    },

    deliveredBadge: {
      backgroundColor:
        "#E4F1E7",
    },

    statusText: {
      color: "#35694E",
      fontSize: 8,
      fontWeight: "900",
    },

    cancelledStatusText: {
      color: "#A34848",
    },

    deliveredStatusText: {
      color: "#287247",
    },

    itemsContainer: {
      paddingVertical: 13,
      marginTop: 11,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor:
        "#E8EBE7",
    },

    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },

    itemQuantity: {
      width: 28,
    },

    itemQuantityText: {
      color: "#35694E",
      fontSize: 10,
      fontWeight: "800",
    },

    itemName: {
      flex: 1,
      color: "#405047",
      fontSize: 10,
    },

    itemPrice: {
      color: "#26372E",
      fontSize: 10,
      fontWeight: "800",
    },

    orderInformation: {
      paddingVertical: 13,
      gap: 8,
    },

    informationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    informationText: {
      flex: 1,
      color: "#66736B",
      fontSize: 9,
      lineHeight: 14,
    },

    refundNotice: {
      padding: 13,
      borderRadius: 17,
      flexDirection: "row",
      alignItems:
        "flex-start",
      gap: 10,
      marginBottom: 13,
    },

    refundPending: {
      backgroundColor:
        "#FFF5D8",
    },

    refundProcessed: {
      backgroundColor:
        "#E7F3EA",
    },

    refundFailed: {
      backgroundColor:
        "#FAEAEA",
    },

    refundContent: {
      flex: 1,
    },

    refundTitle: {
      color: "#2D3B33",
      fontSize: 10,
      fontWeight: "900",
    },

    refundDescription: {
      color: "#66736B",
      fontSize: 9,
      lineHeight: 14,
      marginTop: 4,
    },

    refundId: {
      color: "#718078",
      fontSize: 8,
      marginTop: 5,
    },

    totalRow: {
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor:
        "#E8EBE7",
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    totalLabel: {
      color: "#536159",
      fontSize: 11,
      fontWeight: "700",
    },

    totalValue: {
      color: "#203128",
      fontSize: 16,
      fontWeight: "900",
    },

    orderActionsRow: {
      marginTop: 13,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 10,
    },

    reorderButton: {
      minHeight: 43,
      paddingHorizontal: 15,
      borderRadius: 14,
      backgroundColor:
        "#E5EFE7",
      borderWidth: 1,
      borderColor:
        "#D5E5DA",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    invoiceButton: {
      minHeight: 43,
      paddingHorizontal: 15,
      borderRadius: 14,
      backgroundColor:
        "#F2F7F3",
      borderWidth: 1,
      borderColor:
        "#D5E5DA",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    reorderButtonDisabled: {
      opacity: 0.6,
    },

    reorderButtonText: {
      color: "#245C42",
      fontSize: 10,
      fontWeight: "900",
    },

    invoiceButtonText: {
      color: "#245C42",
      fontSize: 10,
      fontWeight: "900",
    },

    trackingButton: {
      minHeight: 63,
      paddingHorizontal: 13,
      borderRadius: 17,
      backgroundColor:
        "#245C42",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
    },

    trackingIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor:
        "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    trackingContent: {
      flex: 1,
      marginHorizontal: 11,
    },

    trackingButtonText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },

    trackingDescription: {
      color: "#DCEADF",
      fontSize: 8,
      lineHeight: 13,
      marginTop: 3,
    },

    reviewForm: {
      padding: 15,
      borderRadius: 19,
      backgroundColor:
        "#F1F6F2",
      borderWidth: 1,
      borderColor:
        "#D7E5DA",
      marginTop: 14,
    },

    reviewHeading: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },

    reviewHeadingIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
    },

    reviewHeadingContent: {
      flex: 1,
      marginLeft: 11,
    },

    reviewTitle: {
      color: "#244332",
      fontSize: 12,
      fontWeight: "900",
    },

    reviewSubtitle: {
      color: "#6E7A73",
      fontSize: 8,
      lineHeight: 13,
      marginTop: 3,
    },

    ratingRow: {
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor:
        "#DEE8E0",
    },

    ratingLabel: {
      color: "#4C5D53",
      fontSize: 9,
      fontWeight: "800",
      marginBottom: 8,
    },

    ratingStars: {
      flexDirection: "row",
      gap: 8,
    },

    reviewCommentInput: {
      minHeight: 82,
      paddingHorizontal: 13,
      paddingTop: 12,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#DCE5DE",
      color: "#27362E",
      fontSize: 10,
      lineHeight: 16,
      marginTop: 8,
    },

    reviewFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginTop: 11,
    },

    commentCount: {
      color: "#869189",
      fontSize: 8,
    },

    reviewSubmitButton: {
      minHeight: 41,
      paddingHorizontal: 18,
      borderRadius: 13,
      backgroundColor:
        "#245C42",
      alignItems: "center",
      justifyContent:
        "center",
    },

    reviewSubmitDisabled: {
      backgroundColor:
        "#A8B6AC",
    },

    reviewSubmitText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
    },

    submittedReview: {
      padding: 15,
      borderRadius: 18,
      backgroundColor:
        "#EAF4EC",
      borderWidth: 1,
      borderColor:
        "#D1E4D6",
      marginTop: 14,
    },

    submittedReviewTop: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
      marginBottom: 10,
    },

    submittedReviewTitle: {
      color: "#27553B",
      fontSize: 11,
      fontWeight: "900",
    },

    submittedReviewDate: {
      color: "#708078",
      fontSize: 8,
      marginTop: 3,
    },

    readOnlyRating: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      paddingVertical: 6,
    },

    readOnlyLabel: {
      color: "#526159",
      fontSize: 9,
      fontWeight: "700",
    },

    readOnlyStars: {
      flexDirection: "row",
      gap: 3,
    },

    submittedComment: {
      padding: 11,
      borderRadius: 13,
      backgroundColor:
        "#FFFFFF",
      color: "#536159",
      fontSize: 9,
      lineHeight: 15,
      marginTop: 8,
    },

    cancelButton: {
      minHeight: 43,
      borderRadius: 14,
      backgroundColor:
        "#FAECEC",
      alignItems: "center",
      justifyContent:
        "center",
      marginTop: 14,
    },

    cancelDisabled: {
      opacity: 0.55,
    },

    cancelButtonText: {
      color: "#9A4646",
      fontSize: 10,
      fontWeight: "800",
    },

    cancellationText: {
      color: "#9A5555",
      fontSize: 9,
      lineHeight: 14,
      textAlign: "center",
      marginTop: 12,
    },

    errorCard: {
      marginHorizontal: 20,
      padding: 12,
      borderRadius: 15,
      backgroundColor:
        "#FAECEC",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },

    errorText: {
      flex: 1,
      color: "#934545",
      fontSize: 9,
      lineHeight: 14,
    },

    centerState: {
      flex: 1,
      paddingHorizontal: 34,
      alignItems: "center",
      justifyContent:
        "center",
    },

    stateIcon: {
      width: 82,
      height: 82,
      borderRadius: 27,
      backgroundColor:
        "#E5EFE7",
      alignItems: "center",
      justifyContent:
        "center",
    },

    stateTitle: {
      color: "#1D2922",
      fontSize: 19,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 19,
    },

    stateDescription: {
      color: "#727D76",
      fontSize: 11,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 8,
    },

    loginButton: {
      minHeight: 49,
      paddingHorizontal: 28,
      borderRadius: 16,
      backgroundColor:
        "#245C42",
      alignItems: "center",
      justifyContent:
        "center",
      marginTop: 20,
    },

    loginButtonText: {
      color: "#FFFFFF",
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