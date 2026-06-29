import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import {
  useCallback,
  useState,
} from "react";

import {
  FlatList,
  Pressable,
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
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type CustomerNotification,
  type NotificationType,
} from "../services/notificationsApi";

type IconName =
  keyof typeof Ionicons.glyphMap;

function getNotificationIcon(
  type: NotificationType
): IconName {
  switch (type) {
    case "order_placed":
      return "bag-check-outline";

    case "order_confirmed":
      return "checkmark-circle-outline";

    case "order_preparing":
      return "restaurant-outline";

    case "delivery_assigned":
      return "person-add-outline";

    case "order_picked_up":
      return "cube-outline";

    case "order_out_for_delivery":
      return "bicycle-outline";

    case "order_delivered":
      return "home-outline";

    case "order_cancelled":
      return "close-circle-outline";

    case "refund_pending":
      return "time-outline";

    case "refund_processed":
      return "wallet-outline";

    case "refund_failed":
      return "alert-circle-outline";

    case "review_submitted":
      return "star-outline";

    case "subscription_created":
      return "calendar-outline";

    case "subscription_cancelled":
      return "calendar-clear-outline";

    default:
      return "notifications-outline";
  }
}

function getIconBackground(
  type: NotificationType
) {
  if (
    type ===
      "order_cancelled" ||
    type ===
      "refund_failed"
  ) {
    return "#FAEAEA";
  }

  if (
    type ===
      "refund_pending"
  ) {
    return "#FFF3D5";
  }

  if (
    type ===
      "review_submitted"
  ) {
    return "#FFF5D9";
  }

  return "#E6F0E8";
}

function getIconColor(
  type: NotificationType
) {
  if (
    type ===
      "order_cancelled" ||
    type ===
      "refund_failed"
  ) {
    return "#A34848";
  }

  if (
    type ===
      "refund_pending" ||
    type ===
      "review_submitted"
  ) {
    return "#956C14";
  }

  return "#2F6A4B";
}

function formatDate(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
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

export default function NotificationsScreen() {
  const router = useRouter();

  const {
    token,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const [
    notifications,
    setNotifications,
  ] = useState<
    CustomerNotification[]
  >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    markingAll,
    setMarkingAll,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const loadNotifications =
    useCallback(async () => {
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchNotifications(
            token
          );

        setNotifications(
          result.notifications
        );

        setUnreadCount(
          result.unreadCount
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load notifications."
        );
      } finally {
        setLoading(false);
      }
    }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );

  const openNotification =
    async (
      notification:
        CustomerNotification
    ) => {
      let latestNotification =
        notification;

      if (
        token &&
        !notification.readAt
      ) {
        try {
          latestNotification =
            await markNotificationRead(
              token,
              notification._id
            );

          setNotifications(
            (
              currentNotifications
            ) =>
              currentNotifications.map(
                (
                  currentNotification
                ) =>
                  currentNotification._id ===
                  latestNotification._id
                    ? latestNotification
                    : currentNotification
              )
          );

          setUnreadCount(
            (currentCount) =>
              Math.max(
                currentCount - 1,
                0
              )
          );
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to update the notification."
          );
        }
      }

      const orderId =
        latestNotification.order;

      if (
        latestNotification.action ===
          "delivery_tracking" &&
        orderId
      ) {
        router.push({
          pathname:
            "/delivery-order",

          params: {
            orderId,
          },
        });

        return;
      }

      if (
        latestNotification.action ===
        "orders"
      ) {
        router.push(
          "/(tabs)/orders"
        );

        return;
      }

      if (
        latestNotification.action ===
        "subscriptions"
      ) {
        router.push(
          "/(tabs)/plans"
        );
      }
    };

  const markEverythingRead =
    async () => {
      if (
        !token ||
        unreadCount === 0 ||
        markingAll
      ) {
        return;
      }

      setMarkingAll(true);
      setError(null);

      try {
        const result =
          await markAllNotificationsRead(
            token
          );

        setNotifications(
          (
            currentNotifications
          ) =>
            currentNotifications.map(
              (notification) => ({
                ...notification,

                readAt:
                  notification.readAt ||
                  result.readAt,
              })
            )
        );

        setUnreadCount(0);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to mark notifications as read."
        );
      } finally {
        setMarkingAll(false);
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
            Loading notifications
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
          style={styles.pageHeader}
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            style={
              styles.backButton
            }
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color="#26372E"
            />
          </Pressable>

          <Text
            style={styles.headerTitle}
          >
            Notifications
          </Text>
        </View>

        <View
          style={styles.centerState}
        >
          <View
            style={styles.stateIcon}
          >
            <Ionicons
              name="notifications-outline"
              size={35}
              color="#35694E"
            />
          </View>

          <Text
            style={styles.stateTitle}
          >
            Log in to view updates
          </Text>

          <Text
            style={
              styles.stateDescription
            }
          >
            Order, delivery and refund
            updates will appear here.
          </Text>

          <Pressable
            onPress={() =>
              router.push("/login")
            }
            style={
              styles.loginButton
            }
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
      <View
        style={styles.pageHeader}
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={({ pressed }) => [
            styles.backButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#26372E"
          />
        </Pressable>

        <View
          style={styles.headerText}
        >
          <Text
            style={styles.headerTitle}
          >
            Notifications
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            {unreadCount > 0
              ? `${unreadCount} unread update${
                  unreadCount === 1
                    ? ""
                    : "s"
                }`
              : "You are all caught up"}
          </Text>
        </View>

        <Pressable
          disabled={
            unreadCount === 0 ||
            markingAll
          }
          onPress={() => {
            void markEverythingRead();
          }}
          style={({ pressed }) => [
            styles.markAllButton,

            (
              unreadCount === 0 ||
              markingAll
            ) &&
              styles.disabledButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Text
            style={
              styles.markAllText
            }
          >
            {markingAll
              ? "Updating"
              : "Read all"}
          </Text>
        </Pressable>
      </View>

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

      <FlatList
        data={notifications}
        keyExtractor={(
          notification
        ) => notification._id}
        refreshing={loading}
        onRefresh={() => {
          void loadNotifications();
        }}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          notifications.length === 0
            ? styles.emptyContent
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
                name="notifications-off-outline"
                size={35}
                color="#35694E"
              />
            </View>

            <Text
              style={styles.stateTitle}
            >
              No notifications yet
            </Text>

            <Text
              style={
                styles.stateDescription
              }
            >
              New order and delivery
              updates will appear here.
            </Text>
          </View>
        }
        renderItem={({
          item,
        }) => {
          const isUnread =
            !item.readAt;

          return (
            <Pressable
              onPress={() => {
                void openNotification(
                  item
                );
              }}
              style={({ pressed }) => [
                styles.notificationCard,

                isUnread &&
                  styles.unreadCard,

                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.notificationIcon,

                  {
                    backgroundColor:
                      getIconBackground(
                        item.type
                      ),
                  },
                ]}
              >
                <Ionicons
                  name={getNotificationIcon(
                    item.type
                  )}
                  size={22}
                  color={getIconColor(
                    item.type
                  )}
                />
              </View>

              <View
                style={
                  styles.notificationContent
                }
              >
                <View
                  style={
                    styles.notificationTop
                  }
                >
                  <Text
                    style={
                      styles.notificationTitle
                    }
                  >
                    {item.title}
                  </Text>

                  {isUnread ? (
                    <View
                      style={
                        styles.unreadDot
                      }
                    />
                  ) : null}
                </View>

                <Text
                  style={
                    styles.notificationMessage
                  }
                >
                  {item.message}
                </Text>

                <Text
                  style={
                    styles.notificationDate
                  }
                >
                  {formatDate(
                    item.createdAt
                  )}
                </Text>
              </View>

              {item.action !==
              "none" ? (
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color="#87928B"
                />
              ) : null}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F7F7F2",
    },

    pageHeader: {
      minHeight: 72,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor:
        "#E4E8E2",
      backgroundColor:
        "#F7F7F2",
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E1E6E0",
    },

    headerText: {
      flex: 1,
      marginLeft: 12,
    },

    headerTitle: {
      color: "#1D2922",
      fontSize: 19,
      fontWeight: "900",
    },

    headerSubtitle: {
      color: "#7A847E",
      fontSize: 9,
      marginTop: 3,
    },

    markAllButton: {
      minHeight: 38,
      paddingHorizontal: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#E5EFE7",
    },

    markAllText: {
      color: "#35694E",
      fontSize: 9,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.45,
    },

    listContent: {
      padding: 18,
      paddingBottom: 45,
    },

    emptyContent: {
      flexGrow: 1,
    },

    notificationCard: {
      minHeight: 102,
      padding: 14,
      marginBottom: 11,
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        "#E2E7E1",
      backgroundColor:
        "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
    },

    unreadCard: {
      borderColor:
        "#C9DDCF",
      backgroundColor:
        "#F1F7F2",
    },

    notificationIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent:
        "center",
    },

    notificationContent: {
      flex: 1,
      marginHorizontal: 12,
    },

    notificationTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    notificationTitle: {
      flex: 1,
      color: "#26372E",
      fontSize: 11,
      fontWeight: "900",
    },

    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 8,
      backgroundColor:
        "#2F7651",
    },

    notificationMessage: {
      color: "#647169",
      fontSize: 9,
      lineHeight: 15,
      marginTop: 5,
    },

    notificationDate: {
      color: "#8A948E",
      fontSize: 7,
      marginTop: 7,
    },

    errorCard: {
      marginHorizontal: 18,
      marginTop: 12,
      padding: 12,
      borderRadius: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor:
        "#FAECEC",
    },

    errorText: {
      flex: 1,
      color: "#934545",
      fontSize: 9,
      lineHeight: 14,
    },

    centerState: {
      flex: 1,
      paddingHorizontal: 35,
      alignItems: "center",
      justifyContent:
        "center",
    },

    stateIcon: {
      width: 78,
      height: 78,
      borderRadius: 26,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#E5EFE7",
    },

    stateTitle: {
      color: "#1D2922",
      fontSize: 18,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 18,
    },

    stateDescription: {
      color: "#727D76",
      fontSize: 10,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 8,
    },

    loginButton: {
      minHeight: 48,
      paddingHorizontal: 27,
      borderRadius: 15,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#245C42",
      marginTop: 19,
    },

    loginButtonText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "900",
    },

    pressed: {
      opacity: 0.84,

      transform: [
        {
          scale: 0.985,
        },
      ],
    },
  });