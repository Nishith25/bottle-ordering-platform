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
  useOrders,
} from "../../context/OrderContext";

import {
  createOrderReview,
  fetchMyOrderReviews,
} from "../../services/api";

import type {
  CreateOrderReviewInput,
  CustomerOrder,
  DeliveryStatus,
  OrderReview,
  OrderStatus,
} from "../../services/api";

type RefundStatus =
  | "not_required"
  | "pending"
  | "processed"
  | "failed";

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

export default function OrdersScreen() {
  const router = useRouter();

  const {
    token,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const {
    orders,
    loadingOrders,
    cancellingOrderId,
    error,
    refreshOrders,
    cancelOrder,
  } = useOrders();

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
    reviewError,
    setReviewError,
  ] = useState<string | null>(
    null
  );

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
        data={
          orders as RefundAwareOrder[]
        }
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
          orders.length === 0
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
              No orders yet
            </Text>

            <Text
              style={
                styles.stateDescription
              }
            >
              Your first bottle order
              will appear here.
            </Text>

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
      paddingBottom: 18,
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