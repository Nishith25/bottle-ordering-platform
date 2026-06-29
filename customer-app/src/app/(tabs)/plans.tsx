import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useRouter,
} from "expo-router";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
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
} from "../../context/AuthContext";

import {
  useSubscriptions,
} from "../../context/SubscriptionContext";

import type {
  CustomerSubscription,
  SubscriptionPlan,
} from "../../services/api";

function confirmSubscriptionAction({
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

function formatDate(
  value: string
) {
  const parsedDate =
    new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "Unavailable";
  }

  return parsedDate.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

export default function PlansScreen() {
  const router =
    useRouter();

  const {
    isAuthenticated,
  } = useAuth();

  const {
    plans,
    subscriptions,
    loadingPlans,
    loadingSubscriptions,
    cancellingSubscriptionId,
    pausingSubscriptionId,
    resumingSubscriptionId,
    skippingSubscriptionId,
    error,
    refreshPlans,
    refreshSubscriptions,
    pauseSubscription,
    resumeSubscription,
    skipNextDelivery,
    cancelSubscription,
  } = useSubscriptions();

  const requestPause = (
    subscription:
      CustomerSubscription
  ) => {
    confirmSubscriptionAction({
      title:
        "Pause subscription",

      message:
        "Recurring delivery orders will stop until you resume the subscription.",

      confirmText:
        "Pause subscription",

      onConfirm: () => {
        void pauseSubscription(
          subscription._id
        );
      },
    });
  };

  const requestResume = (
    subscription:
      CustomerSubscription
  ) => {
    confirmSubscriptionAction({
      title:
        "Resume subscription",

      message:
        "Recurring delivery orders will become active again using your saved bottle selection and address.",

      confirmText:
        "Resume subscription",

      onConfirm: () => {
        void resumeSubscription(
          subscription._id
        );
      },
    });
  };

  const requestSkipNext = (
    subscription:
      CustomerSubscription
  ) => {
    confirmSubscriptionAction({
      title:
        "Skip next delivery",

      message:
        `The delivery scheduled around ${formatDate(
          subscription.nextBillingAt
        )} will be skipped. Your subscription will remain active.`,

      confirmText:
        "Skip delivery",

      onConfirm: () => {
        void skipNextDelivery(
          subscription._id
        );
      },
    });
  };

  const requestCancellation = (
    subscription:
      CustomerSubscription
  ) => {
    confirmSubscriptionAction({
      title:
        "Cancel subscription",

      message:
        "Future recurring deliveries will stop permanently. A cancelled subscription cannot be resumed.",

      confirmText:
        "Cancel subscription",

      destructive: true,

      onConfirm: () => {
        void cancelSubscription(
          subscription._id,
          "Cancelled by customer"
        );
      },
    });
  };

  const openSubscriptionDetails = (
    subscription:
      CustomerSubscription
  ) => {
    router.push({
      pathname:
        "/subscription-details",

      params: {
        subscriptionId:
          subscription._id,
      },
    });
  };

  const openSubscriptionPayment = (
    subscription:
      CustomerSubscription
  ) => {
    router.push({
      pathname:
        "/subscription-payment",

      params: {
        subscriptionId:
          subscription._id,
      },
    });
  };

  const openEditSubscription = (
    subscription:
      CustomerSubscription
  ) => {
    router.push({
      pathname:
        "/edit-subscription",

      params: {
        subscriptionId:
          subscription._id,
      },
    });
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <Text
          style={styles.eyebrow}
        >
          RECURRING DELIVERY
        </Text>

        <Text
          style={styles.title}
        >
          Freshness on repeat
        </Text>

        <Text
          style={styles.subtitle}
        >
          Build a weekly or monthly
          bottle plan, manage upcoming
          deliveries and save on every
          recurring cycle.
        </Text>

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
          style={
            styles.sectionHeading
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Choose a plan
          </Text>

          <Pressable
            onPress={() => {
              void refreshPlans();
            }}
            style={({ pressed }) => [
              styles.refreshButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="refresh"
              size={19}
              color="#35694E"
            />
          </Pressable>
        </View>

        {loadingPlans &&
        plans.length === 0 ? (
          <View
            style={
              styles.loadingCard
            }
          >
            <ActivityIndicator
              color="#245C42"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading plans
            </Text>
          </View>
        ) : plans.length ===
          0 ? (
          <View
            style={styles.emptyCard}
          >
            <Ionicons
              name="calendar-outline"
              size={31}
              color="#35694E"
            />

            <Text
              style={
                styles.emptyTitle
              }
            >
              No plans available
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Subscription plans will
              appear here when available.
            </Text>
          </View>
        ) : (
          plans.map(
            (plan) => (
              <PlanCard
                key={plan._id}
                plan={plan}
                onChoose={() =>
                  router.push({
                    pathname:
                      "/plan-builder",

                    params: {
                      planId:
                        plan.planId,
                    },
                  })
                }
              />
            )
          )
        )}

        <View
          style={
            styles.sectionHeading
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Your subscriptions
          </Text>

          {isAuthenticated ? (
            <Pressable
              onPress={() => {
                void refreshSubscriptions();
              }}
              style={({ pressed }) => [
                styles.refreshButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="refresh"
                size={19}
                color="#35694E"
              />
            </Pressable>
          ) : null}
        </View>

        {!isAuthenticated ? (
          <View
            style={styles.guestCard}
          >
            <Ionicons
              name="person-outline"
              size={30}
              color="#35694E"
            />

            <Text
              style={
                styles.guestTitle
              }
            >
              Log in to view your plans
            </Text>

            <Text
              style={
                styles.guestDescription
              }
            >
              Active, paused and
              cancelled subscriptions
              will appear here.
            </Text>

            <Pressable
              onPress={() =>
                router.push(
                  "/login"
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
                Log in
              </Text>
            </Pressable>
          </View>
        ) : loadingSubscriptions &&
          subscriptions.length ===
            0 ? (
          <View
            style={
              styles.loadingCard
            }
          >
            <ActivityIndicator
              color="#245C42"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading subscriptions
            </Text>
          </View>
        ) : subscriptions.length ===
          0 ? (
          <View
            style={styles.emptyCard}
          >
            <Ionicons
              name="repeat-outline"
              size={31}
              color="#35694E"
            />

            <Text
              style={
                styles.emptyTitle
              }
            >
              No subscriptions yet
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Choose a plan above to
              start recurring deliveries.
            </Text>
          </View>
        ) : (
          subscriptions.map(
            (subscription) => (
              <SubscriptionCard
                key={
                  subscription._id
                }
                subscription={
                  subscription
                }
                cancelling={
                  cancellingSubscriptionId ===
                  subscription._id
                }
                pausing={
                  pausingSubscriptionId ===
                  subscription._id
                }
                resuming={
                  resumingSubscriptionId ===
                  subscription._id
                }
                skipping={
                  skippingSubscriptionId ===
                  subscription._id
                }
                onViewDetails={() =>
                  openSubscriptionDetails(
                    subscription
                  )
                }
                onManagePayment={() =>
                  openSubscriptionPayment(
                    subscription
                  )
                }
                onEdit={() =>
                  openEditSubscription(
                    subscription
                  )
                }
                onPause={() =>
                  requestPause(
                    subscription
                  )
                }
                onResume={() =>
                  requestResume(
                    subscription
                  )
                }
                onSkip={() =>
                  requestSkipNext(
                    subscription
                  )
                }
                onCancel={() =>
                  requestCancellation(
                    subscription
                  )
                }
              />
            )
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  plan,
  onChoose,
}: {
  plan: SubscriptionPlan;
  onChoose: () => void;
}) {
  return (
    <View
      style={styles.planCard}
    >
      <View
        style={styles.planTopRow}
      >
        <View
          style={styles.planIcon}
        >
          <Ionicons
            name={
              plan.billingCycle ===
              "weekly"
                ? "calendar-outline"
                : "calendar-number-outline"
            }
            size={23}
            color="#35694E"
          />
        </View>

        {plan.badge ? (
          <View
            style={styles.badge}
          >
            <Text
              style={
                styles.badgeText
              }
            >
              {plan.badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={styles.planName}
      >
        {plan.name}
      </Text>

      <Text
        style={
          styles.planDescription
        }
      >
        {plan.description}
      </Text>

      <View
        style={styles.statRow}
      >
        <PlanStat
          value={`${plan.bottleCount}`}
          label="Bottles"
        />

        <PlanStat
          value={`${plan.deliveriesPerCycle}`}
          label="Deliveries"
        />

        <PlanStat
          value={`${plan.discountPercent}%`}
          label="Saving"
        />
      </View>

      <View
        style={styles.features}
      >
        {plan.features.map(
          (feature) => (
            <View
              key={feature}
              style={
                styles.featureRow
              }
            >
              <Ionicons
                name="checkmark-circle"
                size={17}
                color="#397454"
              />

              <Text
                style={
                  styles.featureText
                }
              >
                {feature}
              </Text>
            </View>
          )
        )}
      </View>

      <Pressable
        onPress={onChoose}
        style={({ pressed }) => [
          styles.chooseButton,

          pressed &&
            styles.pressed,
        ]}
      >
        <Text
          style={
            styles.chooseButtonText
          }
        >
          Build this plan
        </Text>

        <Ionicons
          name="arrow-forward"
          size={18}
          color="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

function PlanStat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View
      style={styles.statItem}
    >
      <Text
        style={styles.statValue}
      >
        {value}
      </Text>

      <Text
        style={styles.statLabel}
      >
        {label}
      </Text>
    </View>
  );
}

function SubscriptionCard({
  subscription,
  cancelling,
  pausing,
  resuming,
  skipping,
  onViewDetails,
  onManagePayment,
  onEdit,
  onPause,
  onResume,
  onSkip,
  onCancel,
}: {
  subscription:
    CustomerSubscription;

  cancelling: boolean;
  pausing: boolean;
  resuming: boolean;
  skipping: boolean;

  onViewDetails: () => void;
  onManagePayment: () => void;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const isActive =
    subscription.status ===
    "active";

  const isPaused =
    subscription.status ===
    "paused";

  const canManage =
    isActive || isPaused;

  const processing =
    cancelling ||
    pausing ||
    resuming ||
    skipping;

  return (
    <View
      style={
        styles.subscriptionCard
      }
    >
      <View
        style={
          styles.subscriptionTopRow
        }
      >
        <View
          style={styles.subscriptionTitleArea}
        >
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
              styles.subscriptionName
            }
          >
            {subscription.planName}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,

            isPaused &&
              styles.pausedStatusBadge,

            !isActive &&
              !isPaused &&
              styles.inactiveStatusBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,

              isPaused &&
                styles.pausedStatusText,

              !isActive &&
                !isPaused &&
                styles.inactiveStatusText,
            ]}
          >
            {subscription.status}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.subscriptionInfo
        }
      >
        <View
          style={
            styles.subscriptionInfoRow
          }
        >
          <Ionicons
            name="nutrition-outline"
            size={15}
            color="#607068"
          />

          <Text
            style={
              styles.subscriptionDetail
            }
          >
            {
              subscription.bottleCount
            }{" "}
            bottles
          </Text>
        </View>

        <View
          style={
            styles.subscriptionInfoRow
          }
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color="#607068"
          />

          <Text
            style={
              styles.subscriptionDetail
            }
          >
            {
              subscription.preferredDay
            }
          </Text>
        </View>

        <View
          style={
            styles.subscriptionInfoRow
          }
        >
          <Ionicons
            name="time-outline"
            size={15}
            color="#607068"
          />

          <Text
            style={
              styles.subscriptionDetail
            }
          >
            {
              subscription.preferredSlot
            }
          </Text>
        </View>

        <View
          style={
            styles.subscriptionInfoRow
          }
        >
          <Ionicons
            name="card-outline"
            size={15}
            color="#607068"
          />

          <Text
            style={
              styles.subscriptionDetail
            }
          >
            Next billing:{" "}
            {formatDate(
              subscription.nextBillingAt
            )}
          </Text>
        </View>
      </View>

      {isPaused ? (
        <View
          style={
            styles.pausedNotice
          }
        >
          <Ionicons
            name="pause-circle-outline"
            size={18}
            color="#88631D"
          />

          <Text
            style={
              styles.pausedNoticeText
            }
          >
            Recurring deliveries are
            paused. No automatic order
            will be generated.
          </Text>
        </View>
      ) : null}

      {!isActive &&
      !isPaused ? (
        <View
          style={
            styles.inactiveNotice
          }
        >
          <Ionicons
            name={
              subscription.status ===
              "cancelled"
                ? "close-circle-outline"
                : "time-outline"
            }
            size={18}
            color="#984949"
          />

          <Text
            style={
              styles.inactiveNoticeText
            }
          >
            {subscription.status ===
            "cancelled"
              ? "This subscription has been cancelled. Previous delivery history remains available."
              : "This subscription has expired. Previous delivery history remains available."}
          </Text>
        </View>
      ) : null}

      <View
        style={
          styles.subscriptionTotal
        }
      >
        <View>
          <Text
            style={styles.totalLabel}
          >
            Per{" "}
            {subscription.billingCycle ===
            "weekly"
              ? "week"
              : "month"}
          </Text>

          <Text
            style={
              styles.totalCaption
            }
          >
            Includes plan savings
          </Text>
        </View>

        <Text
          style={styles.totalValue}
        >
          ₹
          {
            subscription.totalPerCycle
          }
        </Text>
      </View>

      <Pressable
        disabled={processing}
        onPress={onViewDetails}
        style={({ pressed }) => [
          styles.detailsButton,

          processing &&
            styles.disabledButton,

          pressed &&
            !processing &&
            styles.pressed,
        ]}
      >
        <View
          style={
            styles.detailsButtonLeft
          }
        >
          <Ionicons
            name="document-text-outline"
            size={17}
            color="#245C42"
          />

          <Text
            style={
              styles.detailsButtonText
            }
          >
            View subscription details
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={17}
          color="#245C42"
        />
      </Pressable>

      {canManage ? (
        <Pressable
          disabled={processing}
          onPress={
            onManagePayment
          }
          style={({ pressed }) => [
            styles.paymentButton,

            processing &&
              styles.disabledButton,

            pressed &&
              !processing &&
              styles.pressed,
          ]}
        >
          <View
            style={
              styles.detailsButtonLeft
            }
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.paymentButtonText
              }
            >
              Manage recurring payment
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={17}
            color="#FFFFFF"
          />
        </Pressable>
      ) : null}

      {canManage ? (
        <Pressable
          disabled={processing}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.editButton,

            processing &&
              styles.disabledButton,

            pressed &&
              !processing &&
              styles.pressed,
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
      ) : null}

      {isActive ? (
        <View
          style={
            styles.managementActions
          }
        >
          <Pressable
            disabled={processing}
            onPress={onSkip}
            style={({ pressed }) => [
              styles.managementButton,
              styles.skipButton,

              processing &&
                styles.disabledButton,

              pressed &&
                !processing &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="play-skip-forward-outline"
              size={16}
              color="#35694E"
            />

            <Text
              style={
                styles.skipButtonText
              }
            >
              {skipping
                ? "Skipping..."
                : "Skip next delivery"}
            </Text>
          </Pressable>

          <Pressable
            disabled={processing}
            onPress={onPause}
            style={({ pressed }) => [
              styles.managementButton,
              styles.pauseButton,

              processing &&
                styles.disabledButton,

              pressed &&
                !processing &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="pause-outline"
              size={16}
              color="#88631D"
            />

            <Text
              style={
                styles.pauseButtonText
              }
            >
              {pausing
                ? "Pausing..."
                : "Pause"}
            </Text>
          </Pressable>

          <Pressable
            disabled={processing}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,

              processing &&
                styles.disabledButton,

              pressed &&
                !processing &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={16}
              color="#994646"
            />

            <Text
              style={
                styles.cancelButtonText
              }
            >
              {cancelling
                ? "Cancelling..."
                : "Cancel subscription"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isPaused ? (
        <View
          style={
            styles.managementActions
          }
        >
          <Pressable
            disabled={processing}
            onPress={onResume}
            style={({ pressed }) => [
              styles.resumeButton,

              processing &&
                styles.disabledButton,

              pressed &&
                !processing &&
                styles.pressed,
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
              {resuming
                ? "Resuming..."
                : "Resume subscription"}
            </Text>
          </Pressable>

          <Pressable
            disabled={processing}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cancelButton,

              processing &&
                styles.disabledButton,

              pressed &&
                !processing &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={16}
              color="#994646"
            />

            <Text
              style={
                styles.cancelButtonText
              }
            >
              {cancelling
                ? "Cancelling..."
                : "Cancel subscription"}
            </Text>
          </Pressable>
        </View>
      ) : null}
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

    scrollContent: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 130,
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

    errorCard: {
      padding: 13,
      borderRadius: 16,
      backgroundColor:
        "#FAECEC",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginTop: 16,
    },

    errorText: {
      flex: 1,
      color: "#934545",
      fontSize: 10,
      lineHeight: 15,
    },

    sectionHeading: {
      marginTop: 25,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    sectionTitle: {
      color: "#1D2922",
      fontSize: 16,
      fontWeight: "900",
    },

    refreshButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor:
        "#E8F0EA",
      alignItems: "center",
      justifyContent:
        "center",
    },

    planCard: {
      padding: 19,
      borderRadius: 25,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E4E8E2",
      marginBottom: 13,
    },

    planTopRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    planIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor:
        "#E5EFE7",
      alignItems: "center",
      justifyContent:
        "center",
    },

    badge: {
      alignSelf:
        "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 11,
      backgroundColor:
        "#E8F0EA",
    },

    badgeText: {
      color: "#35694E",
      fontSize: 8,
      fontWeight: "900",
    },

    planName: {
      color: "#203128",
      fontSize: 18,
      fontWeight: "900",
      marginTop: 16,
    },

    planDescription: {
      color: "#707B74",
      fontSize: 10,
      lineHeight: 16,
      marginTop: 6,
    },

    statRow: {
      paddingVertical: 15,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor:
        "#E8EBE7",
      flexDirection: "row",
      marginTop: 15,
    },

    statItem: {
      flex: 1,
      alignItems: "center",
    },

    statValue: {
      color: "#244A35",
      fontSize: 17,
      fontWeight: "900",
    },

    statLabel: {
      color: "#7A847E",
      fontSize: 8,
      marginTop: 4,
    },

    features: {
      gap: 9,
      marginTop: 15,
    },

    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    featureText: {
      flex: 1,
      color: "#536159",
      fontSize: 10,
    },

    chooseButton: {
      minHeight: 51,
      borderRadius: 17,
      backgroundColor:
        "#245C42",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
      marginTop: 18,
    },

    chooseButtonText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },

    loadingCard: {
      minHeight: 120,
      borderRadius: 22,
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#E4E8E2",
    },

    loadingText: {
      color: "#657269",
      fontSize: 10,
      marginTop: 10,
    },

    guestCard: {
      padding: 22,
      borderRadius: 24,
      backgroundColor:
        "#E8F0EA",
      alignItems: "center",
    },

    guestTitle: {
      color: "#223229",
      fontSize: 15,
      fontWeight: "900",
      marginTop: 12,
    },

    guestDescription: {
      color: "#68746D",
      fontSize: 10,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 6,
    },

    loginButton: {
      minHeight: 45,
      paddingHorizontal: 28,
      borderRadius: 15,
      backgroundColor:
        "#245C42",
      alignItems: "center",
      justifyContent:
        "center",
      marginTop: 16,
    },

    loginButtonText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "800",
    },

    emptyCard: {
      padding: 25,
      borderRadius: 24,
      backgroundColor:
        "#E8F0EA",
      alignItems: "center",
    },

    emptyTitle: {
      color: "#223229",
      fontSize: 15,
      fontWeight: "900",
      marginTop: 11,
    },

    emptyDescription: {
      color: "#68746D",
      fontSize: 10,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 6,
    },

    subscriptionCard: {
      padding: 17,
      borderRadius: 23,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E5E8E3",
      marginBottom: 12,
    },

    subscriptionTopRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      gap: 12,
    },

    subscriptionTitleArea: {
      flex: 1,
    },

    subscriptionNumber: {
      color: "#728078",
      fontSize: 8,
    },

    subscriptionName: {
      color: "#203128",
      fontSize: 14,
      fontWeight: "900",
      marginTop: 4,
    },

    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor:
        "#E5F1E7",
      alignSelf:
        "flex-start",
    },

    pausedStatusBadge: {
      backgroundColor:
        "#FFF0D1",
    },

    inactiveStatusBadge: {
      backgroundColor:
        "#FAECEC",
    },

    statusText: {
      color: "#2E714A",
      fontSize: 8,
      fontWeight: "900",
      textTransform:
        "capitalize",
    },

    pausedStatusText: {
      color: "#88631D",
    },

    inactiveStatusText: {
      color: "#A34848",
    },

    subscriptionInfo: {
      gap: 8,
      marginTop: 14,
    },

    subscriptionInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    subscriptionDetail: {
      flex: 1,
      color: "#68746D",
      fontSize: 9,
    },

    pausedNotice: {
      marginTop: 13,
      padding: 12,
      borderRadius: 14,
      backgroundColor:
        "#FFF5DF",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    pausedNoticeText: {
      flex: 1,
      color: "#7A5D24",
      fontSize: 9,
      lineHeight: 14,
    },

    inactiveNotice: {
      marginTop: 13,
      padding: 12,
      borderRadius: 14,
      backgroundColor:
        "#FAECEC",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    inactiveNoticeText: {
      flex: 1,
      color: "#8D4C4C",
      fontSize: 9,
      lineHeight: 14,
    },

    subscriptionTotal: {
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor:
        "#E8EBE7",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginTop: 14,
    },

    totalLabel: {
      color: "#657269",
      fontSize: 10,
      fontWeight: "800",
    },

    totalCaption: {
      color: "#8A948E",
      fontSize: 8,
      marginTop: 3,
    },

    totalValue: {
      color: "#203128",
      fontSize: 16,
      fontWeight: "900",
    },

    detailsButton: {
      minHeight: 46,
      marginTop: 14,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        "#CAD9CE",
      backgroundColor:
        "#F4F8F4",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    detailsButtonLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    detailsButtonText: {
      color: "#245C42",
      fontSize: 9,
      fontWeight: "900",
    },

    paymentButton: {
      minHeight: 47,
      marginTop: 9,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor:
        "#245C42",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    paymentButtonText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
    },

    editButton: {
      minHeight: 44,
      marginTop: 9,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        "#BCD3C4",
      backgroundColor:
        "#EFF5F0",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      paddingHorizontal: 12,
    },

    editButtonText: {
      color: "#245C42",
      fontSize: 9,
      fontWeight: "900",
      textAlign: "center",
    },

    managementActions: {
      marginTop: 9,
      gap: 9,
    },

    managementButton: {
      minHeight: 43,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
    },

    skipButton: {
      backgroundColor:
        "#E7F0E9",
    },

    skipButtonText: {
      color: "#35694E",
      fontSize: 10,
      fontWeight: "800",
    },

    pauseButton: {
      backgroundColor:
        "#FFF2D9",
    },

    pauseButtonText: {
      color: "#88631D",
      fontSize: 10,
      fontWeight: "800",
    },

    resumeButton: {
      minHeight: 45,
      borderRadius: 14,
      backgroundColor:
        "#245C42",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
    },

    resumeButtonText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    cancelButton: {
      minHeight: 42,
      borderRadius: 14,
      backgroundColor:
        "#FAECEC",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
    },

    cancelButtonText: {
      color: "#994646",
      fontSize: 10,
      fontWeight: "800",
    },

    disabledButton: {
      opacity: 0.55,
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