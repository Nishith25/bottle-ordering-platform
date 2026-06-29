import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  useAuth,
} from "../context/AuthContext";

import {
  useSubscriptions,
} from "../context/SubscriptionContext";

import {
  fetchCustomerSubscriptionDeliveries,
  fetchCustomerSubscriptionDetails,
  type DetailedCustomerSubscription,
  type SubscriptionDeliveryHistoryOrder,
  type SubscriptionDeliveryPagination,
} from "../services/subscriptionDetailsApi";

function getParam(
  value:
    | string
    | string[]
    | undefined
) {
  if (
    Array.isArray(value)
  ) {
    return value[0] || "";
  }

  return value || "";
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value || 0)
  );
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "Unavailable";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unavailable";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatStatus(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function confirmAction({
  title,
  message,
  confirmText,
  destructive = false,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmText: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined"
  ) {
    const confirmed =
      window.confirm(
        `${title}\n\n${message}`
      );

    if (confirmed) {
      onConfirm();
    }

    return;
  }

  Alert.alert(
    title,
    message,
    [
      {
        text: "Go back",
        style: "cancel",
      },

      {
        text: confirmText,

        style:
          destructive
            ? "destructive"
            : "default",

        onPress:
          onConfirm,
      },
    ]
  );
}

export default function SubscriptionDetailsScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      subscriptionId?:
        | string
        | string[];
    }>();

  const subscriptionId =
    getParam(
      params.subscriptionId
    );

  const {
    token,
    isAuthenticated,
  } = useAuth();

  const {
    pauseSubscription,
    resumeSubscription,
    skipNextDelivery,
    cancelSubscription,
    refreshSubscriptions,
  } = useSubscriptions();

  const [
    subscription,
    setSubscription,
  ] =
    useState<DetailedCustomerSubscription | null>(
      null
    );

  const [
    latestDeliveryOrder,
    setLatestDeliveryOrder,
  ] =
    useState<SubscriptionDeliveryHistoryOrder | null>(
      null
    );

  const [
    deliveries,
    setDeliveries,
  ] =
    useState<
      SubscriptionDeliveryHistoryOrder[]
    >([]);

  const [
    pagination,
    setPagination,
  ] =
    useState<SubscriptionDeliveryPagination | null>(
      null
    );

  const [
    generatedDeliveryCount,
    setGeneratedDeliveryCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState<
      | "pause"
      | "resume"
      | "skip"
      | "cancel"
      | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const loadSubscription =
    useCallback(
      async (
        showMainLoader = false
      ) => {
        if (
          !token ||
          !subscriptionId
        ) {
          setLoading(false);
          return;
        }

        if (showMainLoader) {
          setLoading(true);
        }

        setError(null);

        try {
          const [
            detailsResult,
            deliveriesResult,
          ] = await Promise.all([
            fetchCustomerSubscriptionDetails(
              token,
              subscriptionId
            ),

            fetchCustomerSubscriptionDeliveries(
              token,
              subscriptionId,
              1,
              10
            ),
          ]);

          setSubscription(
            detailsResult.subscription
          );

          setLatestDeliveryOrder(
            detailsResult.latestDeliveryOrder
          );

          setGeneratedDeliveryCount(
            detailsResult.generatedDeliveryCount
          );

          setDeliveries(
            deliveriesResult.deliveries
          );

          setPagination(
            deliveriesResult.pagination
          );
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load subscription details."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        token,
        subscriptionId,
      ]
    );

  useEffect(() => {
    void loadSubscription(true);
  }, [loadSubscription]);

  const refreshDetails =
    async () => {
      setRefreshing(true);

      await loadSubscription(
        false
      );
    };

  const loadMoreDeliveries =
    async () => {
      if (
        !token ||
        !subscriptionId ||
        !pagination?.hasNextPage ||
        loadingMore
      ) {
        return;
      }

      setLoadingMore(true);
      setError(null);

      try {
        const result =
          await fetchCustomerSubscriptionDeliveries(
            token,
            subscriptionId,
            pagination.page + 1,
            pagination.limit
          );

        setDeliveries(
          (currentDeliveries) => {
            const existingIds =
              new Set(
                currentDeliveries.map(
                  (delivery) =>
                    delivery._id
                )
              );

            const additionalDeliveries =
              result.deliveries.filter(
                (delivery) =>
                  !existingIds.has(
                    delivery._id
                  )
              );

            return [
              ...currentDeliveries,
              ...additionalDeliveries,
            ];
          }
        );

        setPagination(
          result.pagination
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load more deliveries."
        );
      } finally {
        setLoadingMore(false);
      }
    };

  const completeAction =
    async (
      action:
        | "pause"
        | "resume"
        | "skip"
        | "cancel"
    ) => {
      if (!subscription) {
        return;
      }

      setActionLoading(
        action
      );

      setError(null);

      try {
        let success = false;

        if (
          action === "pause"
        ) {
          success =
            await pauseSubscription(
              subscription._id
            );
        }

        if (
          action === "resume"
        ) {
          success =
            await resumeSubscription(
              subscription._id
            );
        }

        if (
          action === "skip"
        ) {
          success =
            await skipNextDelivery(
              subscription._id
            );
        }

        if (
          action === "cancel"
        ) {
          success =
            await cancelSubscription(
              subscription._id,
              "Cancelled by customer"
            );
        }

        if (success) {
          await Promise.all([
            refreshSubscriptions(),
            loadSubscription(false),
          ]);
        }
      } finally {
        setActionLoading(
          null
        );
      }
    };

  if (
    !isAuthenticated
  ) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centerState}
        >
          <Ionicons
            name="person-outline"
            size={36}
            color="#35694E"
          />

          <Text
            style={styles.stateTitle}
          >
            Log in to view this
            subscription
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                "/login"
              )
            }
            style={
              styles.primaryButton
            }
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

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centerState}
        >
          <ActivityIndicator
            color="#245C42"
          />

          <Text
            style={styles.loadingText}
          >
            Loading subscription details
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (
    !subscription
  ) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.centerState}
        >
          <Ionicons
            name="alert-circle-outline"
            size={38}
            color="#A34848"
          />

          <Text
            style={styles.stateTitle}
          >
            Subscription unavailable
          </Text>

          <Text
            style={styles.stateText}
          >
            {error ||
              "This subscription could not be found."}
          </Text>

          <Pressable
            onPress={() =>
              router.back()
            }
            style={
              styles.primaryButton
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isActive =
    subscription.status ===
    "active";

  const isPaused =
    subscription.status ===
    "paused";

  const canManage =
    isActive || isPaused;

  const processing =
    actionLoading !== null;

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.header}
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#24362C"
          />
        </Pressable>

        <View
          style={styles.headerText}
        >
          <Text
            style={styles.headerTitle}
          >
            Subscription details
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            {
              subscription.subscriptionNumber
            }
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() => {
              void refreshDetails();
            }}
            tintColor="#245C42"
          />
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {error ? (
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
              {error}
            </Text>
          </View>
        ) : null}

        <View
          style={styles.heroCard}
        >
          <View
            style={styles.heroTop}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.subscriptionNumber
                }
              >
                {
                  subscription.subscriptionNumber
                }
              </Text>

              <Text
                style={
                  styles.planName
                }
              >
                {
                  subscription.planName
                }
              </Text>

              <Text
                style={
                  styles.billingCycle
                }
              >
                {formatStatus(
                  subscription.billingCycle
                )}{" "}
                subscription
              </Text>
            </View>

            <StatusBadge
              status={
                subscription.status
              }
            />
          </View>

          <View
            style={styles.heroStats}
          >
            <HeroStat
              label="Bottles"
              value={String(
                subscription.bottleCount
              )}
            />

            <HeroStat
              label="Deliveries"
              value={String(
                generatedDeliveryCount
              )}
            />

            <HeroStat
              label="Per cycle"
              value={formatCurrency(
                subscription.totalPerCycle
              )}
            />
          </View>
        </View>

        {subscription.lastDeliveryGenerationError ? (
          <View
            style={styles.failureCard}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color="#9A4A4A"
            />

            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.failureTitle
                }
              >
                Previous delivery generation
                failed
              </Text>

              <Text
                style={
                  styles.failureText
                }
              >
                {
                  subscription.lastDeliveryGenerationError
                }
              </Text>

              <Text
                style={
                  styles.failureDate
                }
              >
                {formatDate(
                  subscription.lastDeliveryGenerationFailedAt
                )}
              </Text>
            </View>
          </View>
        ) : null}

        {isActive ||
        isPaused ? (
          <SectionCard
            title="Next cycle"
            icon="calendar-outline"
          >
            <InformationRow
              label="Next billing"
              value={formatDate(
                subscription.nextBillingAt
              )}
            />

            <InformationRow
              label="Preferred day"
              value={
                subscription.preferredDay
              }
            />

            <InformationRow
              label="Delivery slot"
              value={
                subscription.preferredSlot
              }
            />

            <InformationRow
              label="Cycle amount"
              value={formatCurrency(
                subscription.totalPerCycle
              )}
              last
            />
          </SectionCard>
        ) : null}

        <SectionCard
          title="Selected bottles"
          icon="nutrition-outline"
        >
          {subscription.items.map(
            (item, index) => (
              <View
                key={`${item.productId}-${index}`}
                style={[
                  styles.bottleRow,

                  index ===
                    subscription.items.length -
                      1 &&
                    styles.lastRow,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      styles.bottleName
                    }
                  >
                    {item.quantity} ×{" "}
                    {item.name}
                  </Text>

                  <Text
                    style={
                      styles.bottleMeta
                    }
                  >
                    {item.sizeMl} ml ·{" "}
                    {formatCurrency(
                      item.price
                    )}{" "}
                    each
                  </Text>
                </View>

                <Text
                  style={
                    styles.bottleTotal
                  }
                >
                  {formatCurrency(
                    item.lineTotal
                  )}
                </Text>
              </View>
            )
          )}
        </SectionCard>

        <SectionCard
          title="Delivery address"
          icon="location-outline"
        >
          <Text
            style={styles.addressName}
          >
            {
              subscription.deliveryAddress
                .fullName
            }
          </Text>

          <Text
            style={
              styles.addressPhone
            }
          >
            +91{" "}
            {
              subscription.deliveryAddress
                .phone
            }
          </Text>

          <Text
            style={styles.addressText}
          >
            {
              subscription.deliveryAddress
                .houseDetails
            }
            ,{" "}
            {
              subscription.deliveryAddress
                .areaDetails
            }
            {subscription.deliveryAddress
              .landmark
              ? `, near ${subscription.deliveryAddress.landmark}`
              : ""}
            ,{" "}
            {
              subscription.deliveryAddress
                .area
            }
            ,{" "}
            {
              subscription.deliveryAddress
                .city
            }{" "}
            –{" "}
            {
              subscription.deliveryAddress
                .pincode
            }
          </Text>
        </SectionCard>

        <SectionCard
          title="Payment and savings"
          icon="wallet-outline"
        >
          <InformationRow
            label="Original value"
            value={formatCurrency(
              subscription.originalTotal
            )}
          />

          <InformationRow
            label={`Plan saving (${subscription.discountPercent}%)`}
            value={`−${formatCurrency(
              subscription.savings
            )}`}
          />

          <InformationRow
            label="Coupon saving"
            value={`−${formatCurrency(
              subscription.couponDiscount ||
                0
            )}`}
          />

          <InformationRow
            label="Payment mandate"
            value={formatStatus(
              subscription.paymentStatus
            )}
          />

          <InformationRow
            label="Current cycle total"
            value={formatCurrency(
              subscription.totalPerCycle
            )}
            last
          />
        </SectionCard>

        {canManage ? (
          <SectionCard
            title="Manage subscription"
            icon="settings-outline"
          >
            <Pressable
              disabled={processing}
              onPress={() =>
                router.push({
                  pathname:
                    "/edit-subscription",

                  params: {
                    subscriptionId:
                      subscription._id,
                  },
                })
              }
              style={[
                styles.actionButton,
                styles.editButton,

                processing &&
                  styles.disabledButton,
              ]}
            >
              <Ionicons
                name="create-outline"
                size={17}
                color="#245C42"
              />

              <Text
                style={
                  styles.editButtonText
                }
              >
                Edit bottles, schedule or
                address
              </Text>
            </Pressable>

            {isActive ? (
              <>
                <Pressable
                  disabled={processing}
                  onPress={() =>
                    confirmAction({
                      title:
                        "Skip next delivery",

                      message:
                        "The next subscription cycle will be skipped. Your subscription will remain active.",

                      confirmText:
                        "Skip delivery",

                      onConfirm: () => {
                        void completeAction(
                          "skip"
                        );
                      },
                    })
                  }
                  style={[
                    styles.actionButton,
                    styles.skipButton,

                    processing &&
                      styles.disabledButton,
                  ]}
                >
                  <Ionicons
                    name="play-skip-forward-outline"
                    size={17}
                    color="#35694E"
                  />

                  <Text
                    style={
                      styles.skipButtonText
                    }
                  >
                    {actionLoading ===
                    "skip"
                      ? "Skipping delivery..."
                      : "Skip next delivery"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={processing}
                  onPress={() =>
                    confirmAction({
                      title:
                        "Pause subscription",

                      message:
                        "Automatic recurring deliveries will stop until you resume the subscription.",

                      confirmText:
                        "Pause subscription",

                      onConfirm: () => {
                        void completeAction(
                          "pause"
                        );
                      },
                    })
                  }
                  style={[
                    styles.actionButton,
                    styles.pauseButton,

                    processing &&
                      styles.disabledButton,
                  ]}
                >
                  <Ionicons
                    name="pause-outline"
                    size={17}
                    color="#89621E"
                  />

                  <Text
                    style={
                      styles.pauseButtonText
                    }
                  >
                    {actionLoading ===
                    "pause"
                      ? "Pausing..."
                      : "Pause subscription"}
                  </Text>
                </Pressable>
              </>
            ) : null}

            {isPaused ? (
              <Pressable
                disabled={processing}
                onPress={() =>
                  confirmAction({
                    title:
                      "Resume subscription",

                    message:
                      "Automatic recurring deliveries will become active again.",

                    confirmText:
                      "Resume subscription",

                    onConfirm: () => {
                      void completeAction(
                        "resume"
                      );
                    },
                  })
                }
                style={[
                  styles.actionButton,
                  styles.resumeButton,

                  processing &&
                    styles.disabledButton,
                ]}
              >
                <Ionicons
                  name="play-outline"
                  size={17}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.resumeButtonText
                  }
                >
                  {actionLoading ===
                  "resume"
                    ? "Resuming..."
                    : "Resume subscription"}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={processing}
              onPress={() =>
                confirmAction({
                  title:
                    "Cancel subscription",

                  message:
                    "All future recurring deliveries will stop permanently. This cannot be reversed.",

                  confirmText:
                    "Cancel subscription",

                  destructive: true,

                  onConfirm: () => {
                    void completeAction(
                      "cancel"
                    );
                  },
                })
              }
              style={[
                styles.actionButton,
                styles.cancelButton,

                processing &&
                  styles.disabledButton,
              ]}
            >
              <Ionicons
                name="close-circle-outline"
                size={17}
                color="#9A4848"
              />

              <Text
                style={
                  styles.cancelButtonText
                }
              >
                {actionLoading ===
                "cancel"
                  ? "Cancelling..."
                  : "Cancel subscription"}
              </Text>
            </Pressable>
          </SectionCard>
        ) : null}

        <View
          style={styles.historyHeading}
        >
          <View>
            <Text
              style={
                styles.historyTitle
              }
            >
              Delivery history
            </Text>

            <Text
              style={
                styles.historySubtitle
              }
            >
              {pagination?.total ||
                generatedDeliveryCount}{" "}
              generated recurring orders
            </Text>
          </View>

          <Ionicons
            name="receipt-outline"
            size={23}
            color="#35694E"
          />
        </View>

        {latestDeliveryOrder ? (
          <View
            style={
              styles.latestDeliveryBanner
            }
          >
            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.latestLabel
                }
              >
                LATEST DELIVERY
              </Text>

              <Text
                style={
                  styles.latestNumber
                }
              >
                {
                  latestDeliveryOrder.orderNumber
                }
              </Text>
            </View>

            <StatusBadge
              status={
                latestDeliveryOrder.orderStatus
              }
            />
          </View>
        ) : null}

        {deliveries.length ===
        0 ? (
          <View
            style={styles.emptyHistory}
          >
            <Ionicons
              name="cube-outline"
              size={34}
              color="#6D8375"
            />

            <Text
              style={
                styles.emptyHistoryTitle
              }
            >
              No recurring deliveries yet
            </Text>

            <Text
              style={
                styles.emptyHistoryText
              }
            >
              A delivery order will appear
              here when the next subscription
              cycle is generated.
            </Text>
          </View>
        ) : (
          deliveries.map(
            (delivery) => (
              <DeliveryHistoryCard
                key={
                  delivery._id
                }
                delivery={
                  delivery
                }
                onOpen={() =>
                  router.push({
                    pathname:
                      "/delivery-order",

                    params: {
                      orderId:
                        delivery._id,
                    },
                  })
                }
              />
            )
          )
        )}

        {pagination?.hasNextPage ? (
          <Pressable
            disabled={loadingMore}
            onPress={() => {
              void loadMoreDeliveries();
            }}
            style={[
              styles.loadMoreButton,

              loadingMore &&
                styles.disabledButton,
            ]}
          >
            {loadingMore ? (
              <ActivityIndicator
                color="#245C42"
              />
            ) : (
              <Text
                style={
                  styles.loadMoreText
                }
              >
                Load more deliveries
              </Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toLowerCase();

  const isPositive =
    [
      "active",
      "delivered",
      "paid",
    ].includes(
      normalizedStatus
    );

  const isWarning =
    [
      "paused",
      "pending",
      "placed",
      "confirmed",
      "preparing",
      "assigned",
      "picked_up",
      "out_for_delivery",
      "unassigned",
    ].includes(
      normalizedStatus
    );

  return (
    <View
      style={[
        styles.statusBadge,

        isPositive &&
          styles.positiveBadge,

        isWarning &&
          styles.warningBadge,

        !isPositive &&
          !isWarning &&
          styles.negativeBadge,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,

          isPositive &&
            styles.positiveBadgeText,

          isWarning &&
            styles.warningBadgeText,

          !isPositive &&
            !isWarning &&
            styles.negativeBadgeText,
        ]}
      >
        {formatStatus(status)}
      </Text>
    </View>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={styles.heroStat}
    >
      <Text
        style={
          styles.heroStatValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.heroStatLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon:
    | "calendar-outline"
    | "nutrition-outline"
    | "location-outline"
    | "wallet-outline"
    | "settings-outline";

  children:
    React.ReactNode;
}) {
  return (
    <View
      style={styles.sectionCard}
    >
      <View
        style={
          styles.sectionHeading
        }
      >
        <View
          style={styles.sectionIcon}
        >
          <Ionicons
            name={icon}
            size={19}
            color="#35694E"
          />
        </View>

        <Text
          style={styles.sectionTitle}
        >
          {title}
        </Text>
      </View>

      {children}
    </View>
  );
}

function InformationRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.informationRow,

        last &&
          styles.lastRow,
      ]}
    >
      <Text
        style={
          styles.informationLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.informationValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

function DeliveryHistoryCard({
  delivery,
  onOpen,
}: {
  delivery:
    SubscriptionDeliveryHistoryOrder;

  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.deliveryCard,

        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={styles.deliveryTop}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={
              styles.deliveryNumber
            }
          >
            {delivery.orderNumber}
          </Text>

          <Text
            style={
              styles.deliveryDate
            }
          >
            Billing cycle:{" "}
            {formatDate(
              delivery.subscriptionBillingAt ||
                delivery.createdAt
            )}
          </Text>
        </View>

        <StatusBadge
          status={
            delivery.orderStatus
          }
        />
      </View>

      <View
        style={styles.deliveryInfo}
      >
        <View>
          <Text
            style={
              styles.deliveryInfoLabel
            }
          >
            Scheduled delivery
          </Text>

          <Text
            style={
              styles.deliveryInfoValue
            }
          >
            {delivery.deliverySchedule
              ?.deliveryDateLabel ||
              "Date unavailable"}
          </Text>

          <Text
            style={
              styles.deliveryInfoSmall
            }
          >
            {delivery.deliverySchedule
              ?.deliverySlot ||
              "Slot unavailable"}
          </Text>
        </View>

        <View
          style={
            styles.deliveryAmount
          }
        >
          <Text
            style={
              styles.deliveryInfoLabel
            }
          >
            Total
          </Text>

          <Text
            style={
              styles.deliveryTotal
            }
          >
            {formatCurrency(
              delivery.total
            )}
          </Text>
        </View>
      </View>

      <View
        style={styles.deliveryFooter}
      >
        <View
          style={
            styles.deliveryStatusRow
          }
        >
          <Ionicons
            name="bicycle-outline"
            size={15}
            color="#647269"
          />

          <Text
            style={
              styles.deliveryStatusText
            }
          >
            {formatStatus(
              delivery.deliveryStatus
            )}
          </Text>
        </View>

        <View
          style={
            styles.openOrderRow
          }
        >
          <Text
            style={
              styles.openOrderText
            }
          >
            View order
          </Text>

          <Ionicons
            name="chevron-forward"
            size={16}
            color="#245C42"
          />
        </View>
      </View>
    </Pressable>
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
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        "#E3E7E1",
      flexDirection: "row",
      alignItems: "center",
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        "#DEE5DF",
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
    },

    headerText: {
      marginLeft: 12,
    },

    headerTitle: {
      color: "#1D2922",
      fontSize: 18,
      fontWeight: "900",
    },

    headerSubtitle: {
      color: "#758079",
      fontSize: 9,
      marginTop: 3,
    },

    scrollContent: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      padding: 20,
      paddingBottom: 100,
    },

    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      padding: 25,
    },

    stateTitle: {
      color: "#1D2922",
      fontSize: 17,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 13,
    },

    stateText: {
      color: "#6F7B74",
      fontSize: 10,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 7,
    },

    loadingText: {
      color: "#68746D",
      fontSize: 10,
      marginTop: 12,
    },

    primaryButton: {
      minHeight: 46,
      marginTop: 18,
      paddingHorizontal: 25,
      borderRadius: 15,
      backgroundColor:
        "#245C42",
      alignItems: "center",
      justifyContent:
        "center",
    },

    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    errorCard: {
      padding: 13,
      borderRadius: 16,
      backgroundColor:
        "#FAECEC",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginBottom: 14,
    },

    errorText: {
      flex: 1,
      color: "#934545",
      fontSize: 10,
      lineHeight: 15,
    },

    heroCard: {
      padding: 19,
      borderRadius: 25,
      backgroundColor:
        "#245C42",
    },

    heroTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },

    subscriptionNumber: {
      color: "#C7DDD0",
      fontSize: 9,
      fontWeight: "800",
    },

    planName: {
      color: "#FFFFFF",
      fontSize: 22,
      fontWeight: "900",
      marginTop: 5,
    },

    billingCycle: {
      color: "#D6E5DB",
      fontSize: 10,
      marginTop: 6,
      textTransform:
        "capitalize",
    },

    heroStats: {
      marginTop: 19,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor:
        "rgba(255,255,255,0.18)",
      flexDirection: "row",
    },

    heroStat: {
      flex: 1,
      alignItems: "center",
    },

    heroStatValue: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "900",
    },

    heroStatLabel: {
      color: "#C8DACE",
      fontSize: 8,
      marginTop: 4,
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 11,
      alignSelf:
        "flex-start",
    },

    positiveBadge: {
      backgroundColor:
        "#E5F1E7",
    },

    warningBadge: {
      backgroundColor:
        "#FFF0D1",
    },

    negativeBadge: {
      backgroundColor:
        "#FAECEC",
    },

    statusBadgeText: {
      fontSize: 8,
      fontWeight: "900",
    },

    positiveBadgeText: {
      color: "#2E714A",
    },

    warningBadgeText: {
      color: "#89621E",
    },

    negativeBadgeText: {
      color: "#A34848",
    },

    failureCard: {
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        "#FAEAEA",
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },

    failureTitle: {
      color: "#8F4545",
      fontSize: 11,
      fontWeight: "900",
    },

    failureText: {
      color: "#995656",
      fontSize: 9,
      lineHeight: 14,
      marginTop: 4,
    },

    failureDate: {
      color: "#A56A6A",
      fontSize: 8,
      marginTop: 6,
    },

    sectionCard: {
      padding: 17,
      borderRadius: 22,
      borderWidth: 1,
      borderColor:
        "#E1E6E0",
      backgroundColor:
        "#FFFFFF",
      marginTop: 14,
    },

    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },

    sectionIcon: {
      width: 37,
      height: 37,
      borderRadius: 12,
      backgroundColor:
        "#E8F0EA",
      alignItems: "center",
      justifyContent:
        "center",
    },

    sectionTitle: {
      color: "#203128",
      fontSize: 14,
      fontWeight: "900",
    },

    informationRow: {
      minHeight: 43,
      borderBottomWidth: 1,
      borderBottomColor:
        "#EDF0EC",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 14,
    },

    lastRow: {
      borderBottomWidth: 0,
    },

    informationLabel: {
      flex: 1,
      color: "#6B786F",
      fontSize: 9,
    },

    informationValue: {
      maxWidth: "58%",
      color: "#293A31",
      fontSize: 9,
      fontWeight: "800",
      textAlign: "right",
    },

    bottleRow: {
      minHeight: 55,
      borderBottomWidth: 1,
      borderBottomColor:
        "#EDF0EC",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    bottleName: {
      color: "#293A31",
      fontSize: 10,
      fontWeight: "800",
    },

    bottleMeta: {
      color: "#77837C",
      fontSize: 8,
      marginTop: 4,
    },

    bottleTotal: {
      color: "#245C42",
      fontSize: 10,
      fontWeight: "900",
    },

    addressName: {
      color: "#293A31",
      fontSize: 12,
      fontWeight: "900",
    },

    addressPhone: {
      color: "#5D6A62",
      fontSize: 9,
      marginTop: 5,
    },

    addressText: {
      color: "#6B776F",
      fontSize: 9,
      lineHeight: 15,
      marginTop: 8,
    },

    actionButton: {
      minHeight: 45,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      marginTop: 8,
    },

    editButton: {
      borderWidth: 1,
      borderColor:
        "#BCD3C4",
      backgroundColor:
        "#EFF5F0",
    },

    editButtonText: {
      color: "#245C42",
      fontSize: 9,
      fontWeight: "900",
    },

    skipButton: {
      backgroundColor:
        "#E7F0E9",
    },

    skipButtonText: {
      color: "#35694E",
      fontSize: 9,
      fontWeight: "900",
    },

    pauseButton: {
      backgroundColor:
        "#FFF2D9",
    },

    pauseButtonText: {
      color: "#89621E",
      fontSize: 9,
      fontWeight: "900",
    },

    resumeButton: {
      backgroundColor:
        "#245C42",
    },

    resumeButtonText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
    },

    cancelButton: {
      backgroundColor:
        "#FAECEC",
    },

    cancelButtonText: {
      color: "#9A4848",
      fontSize: 9,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.5,
    },

    historyHeading: {
      marginTop: 26,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    historyTitle: {
      color: "#1D2922",
      fontSize: 17,
      fontWeight: "900",
    },

    historySubtitle: {
      color: "#748078",
      fontSize: 9,
      marginTop: 4,
    },

    latestDeliveryBanner: {
      padding: 14,
      borderRadius: 18,
      backgroundColor:
        "#E9F1EB",
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 11,
    },

    latestLabel: {
      color: "#567062",
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    latestNumber: {
      color: "#264234",
      fontSize: 12,
      fontWeight: "900",
      marginTop: 5,
    },

    emptyHistory: {
      padding: 27,
      borderRadius: 22,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor:
        "#D7DFD8",
      alignItems: "center",
    },

    emptyHistoryTitle: {
      color: "#26372E",
      fontSize: 13,
      fontWeight: "900",
      marginTop: 11,
    },

    emptyHistoryText: {
      color: "#748078",
      fontSize: 9,
      lineHeight: 15,
      textAlign: "center",
      marginTop: 6,
    },

    deliveryCard: {
      padding: 16,
      borderRadius: 21,
      borderWidth: 1,
      borderColor:
        "#E1E6E0",
      backgroundColor:
        "#FFFFFF",
      marginBottom: 11,
    },

    deliveryTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },

    deliveryNumber: {
      color: "#26372E",
      fontSize: 12,
      fontWeight: "900",
    },

    deliveryDate: {
      color: "#78847D",
      fontSize: 8,
      marginTop: 5,
    },

    deliveryInfo: {
      paddingVertical: 13,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor:
        "#EDF0EC",
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginTop: 13,
    },

    deliveryInfoLabel: {
      color: "#7B867F",
      fontSize: 7,
      fontWeight: "800",
      textTransform:
        "uppercase",
    },

    deliveryInfoValue: {
      color: "#314239",
      fontSize: 9,
      fontWeight: "800",
      marginTop: 5,
    },

    deliveryInfoSmall: {
      color: "#78847D",
      fontSize: 8,
      marginTop: 4,
    },

    deliveryAmount: {
      alignItems: "flex-end",
    },

    deliveryTotal: {
      color: "#245C42",
      fontSize: 14,
      fontWeight: "900",
      marginTop: 5,
    },

    deliveryFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginTop: 12,
    },

    deliveryStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    deliveryStatusText: {
      color: "#647269",
      fontSize: 8,
      fontWeight: "800",
    },

    openOrderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },

    openOrderText: {
      color: "#245C42",
      fontSize: 8,
      fontWeight: "900",
    },

    loadMoreButton: {
      minHeight: 47,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        "#BFD1C4",
      backgroundColor:
        "#EDF4EF",
      alignItems: "center",
      justifyContent:
        "center",
      marginTop: 4,
    },

    loadMoreText: {
      color: "#245C42",
      fontSize: 10,
      fontWeight: "900",
    },

    pressed: {
      opacity: 0.82,

      transform: [
        {
          scale: 0.99,
        },
      ],
    },
  });