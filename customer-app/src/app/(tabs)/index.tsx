import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import {
  StatusBar,
} from "expo-status-bar";

import {
  useCallback,
  useState,
} from "react";

import {
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
  fetchUnreadNotificationCount,
} from "../../services/notificationsApi";

type Product = {
  id: string;
  name: string;
  description: string;
  backgroundColor: string;
  liquidColor: string;
  accentColor: string;
};

const PRODUCTS: Product[] = [
  {
    id: "coconut-chia-refresh",
    name: "Coconut Chia Refresh",
    description:
      "Light, refreshing and naturally hydrating",
    backgroundColor: "#EAF4ED",
    liquidColor: "#E5F2E8",
    accentColor: "#2F6B4F",
  },
  {
    id: "cane-chia-splash",
    name: "Cane Chia Splash",
    description:
      "Naturally sweet with a fresh chia twist",
    backgroundColor: "#F1F5DF",
    liquidColor: "#DDE7A8",
    accentColor: "#667B26",
  },
  {
    id: "watermelon-splash",
    name: "Watermelon Splash",
    description:
      "Cool, juicy and packed with fresh fruit",
    backgroundColor: "#FBE9E7",
    liquidColor: "#F18E86",
    accentColor: "#A93B3B",
  },
  {
    id: "pineapple-punch",
    name: "Pineapple Punch",
    description:
      "Bright, tropical and naturally refreshing",
    backgroundColor: "#FFF4D8",
    liquidColor: "#F4C85A",
    accentColor: "#946C08",
  },
];

function BottleIllustration({
  product,
}: {
  product: Product;
}) {
  return (
    <View
      style={styles.bottleWrapper}
    >
      <View
        style={styles.bottleCap}
      />

      <View
        style={styles.bottleNeck}
      />

      <View
        style={styles.bottleBody}
      >
        <View
          style={[
            styles.bottleLiquid,

            {
              backgroundColor:
                product.liquidColor,
            },
          ]}
        />

        <View
          style={styles.chiaRow}
        >
          <View
            style={styles.chiaSeed}
          />

          <View
            style={styles.chiaSeed}
          />

          <View
            style={styles.chiaSeed}
          />

          <View
            style={styles.chiaSeed}
          />
        </View>

        <View
          style={styles.bottleLabel}
        >
          <Text
            style={[
              styles.bottleLabelText,

              {
                color:
                  product.accentColor,
              },
            ]}
          >
            FRESH
          </Text>
        </View>
      </View>
    </View>
  );
}

function ProductCard({
  product,
}: {
  product: Product;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,

        {
          backgroundColor:
            product.backgroundColor,
        },

        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={
          styles.productImageArea
        }
      >
        <BottleIllustration
          product={product}
        />

        <View
          style={styles.sizeBadge}
        >
          <Text
            style={
              styles.sizeBadgeText
            }
          >
            300 ml
          </Text>
        </View>
      </View>

      <Text
        style={styles.productName}
        numberOfLines={2}
      >
        {product.name}
      </Text>

      <Text
        style={
          styles.productDescription
        }
        numberOfLines={2}
      >
        {product.description}
      </Text>

      <View
        style={styles.productAction}
      >
        <Text
          style={[
            styles.productActionText,

            {
              color:
                product.accentColor,
            },
          ]}
        >
          View bottle
        </Text>

        <View
          style={[
            styles.arrowButton,

            {
              backgroundColor:
                product.accentColor,
            },
          ]}
        >
          <Text
            style={styles.arrowText}
          >
            ›
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const {
    token,
    user,
    isAuthenticated,
  } = useAuth();

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!token) {
        setUnreadNotificationCount(
          0
        );

        return () => {
          active = false;
        };
      }

      void fetchUnreadNotificationCount(
        token
      )
        .then((count) => {
          if (active) {
            setUnreadNotificationCount(
              count
            );
          }
        })
        .catch(() => {
          if (active) {
            setUnreadNotificationCount(
              0
            );
          }
        });

      return () => {
        active = false;
      };
    }, [token])
  );

  const profileInitial =
    user?.fullName
      ?.trim()
      .charAt(0)
      .toUpperCase() || "N";

  const openNotifications =
    () => {
      router.push(
        isAuthenticated
          ? "/notifications"
          : "/login"
      );
    };

  const openAccount =
    () => {
      router.push(
        isAuthenticated
          ? "/(tabs)/account"
          : "/login"
      );
    };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View style={styles.header}>
          <Pressable
            style={
              styles.locationButton
            }
          >
            <View
              style={
                styles.locationIcon
              }
            >
              <Text
                style={
                  styles.locationIconText
                }
              >
                ⌖
              </Text>
            </View>

            <View>
              <Text
                style={
                  styles.locationLabel
                }
              >
                DELIVERING TO
              </Text>

              <Text
                style={
                  styles.locationText
                }
              >
                Select your location⌄
              </Text>
            </View>
          </Pressable>

          <View
            style={
              styles.headerActions
            }
          >
            <Pressable
              onPress={
                openNotifications
              }
              style={({ pressed }) => [
                styles.notificationButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name={
                  unreadNotificationCount >
                  0
                    ? "notifications"
                    : "notifications-outline"
                }
                size={20}
                color="#245C42"
              />

              {unreadNotificationCount >
              0 ? (
                <View
                  style={
                    styles.notificationBadge
                  }
                >
                  <Text
                    style={
                      styles.notificationBadgeText
                    }
                  >
                    {unreadNotificationCount >
                    99
                      ? "99+"
                      : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={
                openAccount
              }
              style={({ pressed }) => [
                styles.profileButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.profileText
                }
              >
                {profileInitial}
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={
            styles.welcomeSection
          }
        >
          <Text
            style={styles.eyebrow}
          >
            FRESHLY PREPARED
          </Text>

          <Text
            style={styles.mainTitle}
          >
            Fruit you can sip.
            {"\n"}

            <Text
              style={
                styles.mainTitleAccent
              }
            >
              Freshness you can bite.
            </Text>
          </Text>

          <Text
            style={
              styles.mainDescription
            }
          >
            Fresh fruit, chia seeds and
            refreshing liquids prepared
            in convenient 300 ml bottles.
          </Text>
        </View>

        <View
          style={styles.heroCard}
        >
          <View
            style={styles.heroContent}
          >
            <View
              style={styles.heroBadge}
            >
              <Text
                style={
                  styles.heroBadgeText
                }
              >
                MADE FRESH
              </Text>
            </View>

            <Text
              style={styles.heroTitle}
            >
              Fresh bottles, delivered
              to your doorstep.
            </Text>

            <Text
              style={
                styles.heroDescription
              }
            >
              Currently available only
              in selected delivery
              locations.
            </Text>

            <Pressable
              style={
                styles.deliveryButton
              }
            >
              <Text
                style={
                  styles.deliveryButtonText
                }
              >
                Check delivery
                availability
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.heroBottleArea
            }
          >
            <View
              style={
                styles.heroCircle
              }
            />

            <View
              style={
                styles.heroBottle
              }
            >
              <View
                style={
                  styles.heroBottleCap
                }
              />

              <View
                style={
                  styles.heroBottleNeck
                }
              />

              <View
                style={
                  styles.heroBottleBody
                }
              >
                <View
                  style={
                    styles.heroBottleLiquid
                  }
                />

                <View
                  style={
                    styles.heroBottleLabel
                  }
                >
                  <Text
                    style={
                      styles.heroBottleLabelText
                    }
                  >
                    300 ml
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View
          style={
            styles.sectionHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Choose your bottle
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Four refreshing choices
              prepared fresh
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                "/(tabs)/bottles"
              )
            }
          >
            <Text
              style={
                styles.viewAllText
              }
            >
              View all
            </Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.productsContainer
          }
        >
          {PRODUCTS.map(
            (product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            )
          )}
        </ScrollView>

        <View
          style={
            styles.subscriptionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Make freshness a routine
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            Choose a flexible plan and
            receive bottles regularly.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push(
              "/(tabs)/plans"
            )
          }
          style={({ pressed }) => [
            styles.planCard,

            pressed &&
              styles.pressed,
          ]}
        >
          <View
            style={styles.planTopRow}
          >
            <View
              style={styles.planIcon}
            >
              <Text
                style={
                  styles.planIconText
                }
              >
                7
              </Text>
            </View>

            <View
              style={
                styles.planHeading
              }
            >
              <Text
                style={
                  styles.planTitle
                }
              >
                Weekly Plan
              </Text>

              <Text
                style={
                  styles.planDescription
                }
              >
                Fresh bottles delivered
                every week
              </Text>
            </View>

            <Text
              style={
                styles.planArrow
              }
            >
              ›
            </Text>
          </View>

          <View
            style={
              styles.planFeatures
            }
          >
            <Text
              style={
                styles.planFeatureText
              }
            >
              ✓ Flexible bottle mix
            </Text>

            <Text
              style={
                styles.planFeatureText
              }
            >
              ✓ Select delivery days
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() =>
            router.push(
              "/(tabs)/plans"
            )
          }
          style={({ pressed }) => [
            styles.planCard,

            pressed &&
              styles.pressed,
          ]}
        >
          <View
            style={styles.planTopRow}
          >
            <View
              style={[
                styles.planIcon,
                styles.monthlyPlanIcon,
              ]}
            >
              <Text
                style={
                  styles.monthlyPlanIconText
                }
              >
                30
              </Text>
            </View>

            <View
              style={
                styles.planHeading
              }
            >
              <View
                style={
                  styles.popularRow
                }
              >
                <Text
                  style={
                    styles.planTitle
                  }
                >
                  Monthly Plan
                </Text>

                <View
                  style={
                    styles.popularBadge
                  }
                >
                  <Text
                    style={
                      styles.popularBadgeText
                    }
                  >
                    POPULAR
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.planDescription
                }
              >
                Convenient monthly
                bottle deliveries
              </Text>
            </View>

            <Text
              style={
                styles.planArrow
              }
            >
              ›
            </Text>
          </View>

          <View
            style={
              styles.planFeatures
            }
          >
            <Text
              style={
                styles.planFeatureText
              }
            >
              ✓ Better plan value
            </Text>

            <Text
              style={
                styles.planFeatureText
              }
            >
              ✓ Easy schedule management
            </Text>
          </View>
        </Pressable>

        <View
          style={
            styles.freshnessNotice
          }
        >
          <View
            style={
              styles.freshnessIcon
            }
          >
            <Text
              style={
                styles.freshnessIconText
              }
            >
              ✦
            </Text>
          </View>

          <View
            style={
              styles.freshnessContent
            }
          >
            <Text
              style={
                styles.freshnessTitle
              }
            >
              Prepared for freshness
            </Text>

            <Text
              style={
                styles.freshnessText
              }
            >
              Bottles are prepared
              carefully and stored under
              refrigeration before
              delivery.
            </Text>
          </View>
        </View>
      </ScrollView>
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

    scrollContent: {
      paddingBottom: 120,
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    locationButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    locationIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#E4EFE7",
    },

    locationIconText: {
      color: "#23563E",
      fontSize: 23,
      fontWeight: "700",
    },

    locationLabel: {
      color: "#888C87",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginBottom: 3,
    },

    locationText: {
      color: "#1E2923",
      fontSize: 14,
      fontWeight: "700",
    },

    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginLeft: 10,
    },

    notificationButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#DCE5DE",
      backgroundColor:
        "#FFFFFF",
    },

    notificationBadge: {
      position: "absolute",
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#D85353",
      borderWidth: 2,
      borderColor:
        "#F7F7F2",
    },

    notificationBadgeText: {
      color: "#FFFFFF",
      fontSize: 7,
      fontWeight: "900",
    },

    profileButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#1F513B",
    },

    profileText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },

    welcomeSection: {
      paddingHorizontal: 20,
      marginBottom: 22,
    },

    eyebrow: {
      color: "#4D765F",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.7,
      marginBottom: 10,
    },

    mainTitle: {
      color: "#17221C",
      fontSize: 34,
      lineHeight: 41,
      fontWeight: "800",
      letterSpacing: -1.2,
    },

    mainTitleAccent: {
      color: "#3B7858",
    },

    mainDescription: {
      color: "#6B746F",
      fontSize: 14,
      lineHeight: 21,
      marginTop: 12,
      maxWidth: 355,
    },

    heroCard: {
      marginHorizontal: 20,
      minHeight: 220,
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor:
        "#1E523A",
      flexDirection: "row",
    },

    heroContent: {
      width: "64%",
      padding: 22,
      zIndex: 2,
    },

    heroBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor:
        "rgba(255,255,255,0.14)",
      marginBottom: 13,
    },

    heroBadgeText: {
      color: "#DCEEE3",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.3,
    },

    heroTitle: {
      color: "#FFFFFF",
      fontSize: 20,
      lineHeight: 26,
      fontWeight: "800",
    },

    heroDescription: {
      color: "#C6DBCD",
      fontSize: 12,
      lineHeight: 17,
      marginTop: 8,
    },

    deliveryButton: {
      alignSelf: "flex-start",
      marginTop: 17,
      paddingHorizontal: 15,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
    },

    deliveryButtonText: {
      color: "#1F513B",
      fontSize: 11,
      fontWeight: "800",
    },

    heroBottleArea: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },

    heroCircle: {
      position: "absolute",
      width: 155,
      height: 155,
      borderRadius: 78,
      backgroundColor:
        "rgba(255,255,255,0.08)",
    },

    heroBottle: {
      alignItems: "center",

      transform: [
        {
          rotate: "6deg",
        },
      ],
    },

    heroBottleCap: {
      width: 31,
      height: 14,
      borderTopLeftRadius: 5,
      borderTopRightRadius: 5,
      backgroundColor:
        "#EDE9D8",
    },

    heroBottleNeck: {
      width: 25,
      height: 13,
      backgroundColor:
        "rgba(255,255,255,0.65)",
    },

    heroBottleBody: {
      width: 72,
      height: 142,
      borderRadius: 19,
      overflow: "hidden",
      borderWidth: 2,
      borderColor:
        "rgba(255,255,255,0.75)",
      backgroundColor:
        "rgba(255,255,255,0.28)",
      justifyContent:
        "flex-end",
    },

    heroBottleLiquid: {
      position: "absolute",
      bottom: 0,
      width: "100%",
      height: "77%",
      backgroundColor:
        "#E7D783",
    },

    heroBottleLabel: {
      alignSelf: "center",
      marginBottom: 42,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      backgroundColor:
        "rgba(255,255,255,0.88)",
    },

    heroBottleLabelText: {
      color: "#31553E",
      fontSize: 9,
      fontWeight: "800",
    },

    sectionHeader: {
      marginTop: 31,
      marginBottom: 15,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent:
        "space-between",
    },

    sectionTitle: {
      color: "#17221C",
      fontSize: 21,
      lineHeight: 27,
      fontWeight: "800",
      letterSpacing: -0.4,
    },

    sectionSubtitle: {
      color: "#7A827E",
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },

    viewAllText: {
      color: "#397456",
      fontSize: 12,
      fontWeight: "800",
    },

    productsContainer: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      gap: 13,
    },

    productCard: {
      width: 176,
      minHeight: 288,
      borderRadius: 24,
      padding: 14,

      ...Platform.select({
        ios: {
          shadowColor:
            "#18251E",

          shadowOpacity: 0.07,
          shadowRadius: 14,

          shadowOffset: {
            width: 0,
            height: 7,
          },
        },

        android: {
          elevation: 2,
        },
      }),
    },

    pressed: {
      opacity: 0.86,

      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    productImageArea: {
      height: 142,
      alignItems: "center",
      justifyContent:
        "center",
    },

    sizeBadge: {
      position: "absolute",
      right: 0,
      top: 0,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor:
        "rgba(255,255,255,0.78)",
    },

    sizeBadgeText: {
      color: "#4F5753",
      fontSize: 9,
      fontWeight: "700",
    },

    bottleWrapper: {
      alignItems: "center",
    },

    bottleCap: {
      width: 26,
      height: 11,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      backgroundColor:
        "#343B37",
    },

    bottleNeck: {
      width: 21,
      height: 10,
      backgroundColor:
        "rgba(255,255,255,0.8)",
    },

    bottleBody: {
      width: 61,
      height: 114,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 2,
      borderColor:
        "rgba(255,255,255,0.9)",
      backgroundColor:
        "rgba(255,255,255,0.42)",
      justifyContent:
        "center",
    },

    bottleLiquid: {
      position: "absolute",
      bottom: 0,
      width: "100%",
      height: "72%",
    },

    chiaRow: {
      position: "absolute",
      bottom: 14,
      left: 11,
      right: 11,
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    chiaSeed: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor:
        "#26302A",
      opacity: 0.6,
    },

    bottleLabel: {
      alignSelf: "center",
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor:
        "rgba(255,255,255,0.84)",
    },

    bottleLabelText: {
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 0.7,
    },

    productName: {
      color: "#17221C",
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "800",
      minHeight: 39,
      marginTop: 3,
    },

    productDescription: {
      color: "#6E7772",
      fontSize: 11,
      lineHeight: 16,
      minHeight: 34,
      marginTop: 4,
    },

    productAction: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    productActionText: {
      fontSize: 11,
      fontWeight: "800",
    },

    arrowButton: {
      width: 27,
      height: 27,
      borderRadius: 14,
      alignItems: "center",
      justifyContent:
        "center",
    },

    arrowText: {
      color: "#FFFFFF",
      fontSize: 22,
      lineHeight: 23,
      marginTop: -2,
    },

    subscriptionHeader: {
      paddingHorizontal: 20,
      marginTop: 27,
      marginBottom: 14,
    },

    planCard: {
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 17,
      borderWidth: 1,
      borderColor:
        "#E2E5DE",
      borderRadius: 21,
      backgroundColor:
        "#FFFFFF",
    },

    planTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    planIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#E4F0E7",
    },

    planIconText: {
      color: "#2E684B",
      fontSize: 17,
      fontWeight: "900",
    },

    monthlyPlanIcon: {
      backgroundColor:
        "#FEF0CF",
    },

    monthlyPlanIconText: {
      color: "#92660A",
      fontSize: 15,
      fontWeight: "900",
    },

    planHeading: {
      flex: 1,
      marginLeft: 13,
    },

    planTitle: {
      color: "#1E2923",
      fontSize: 15,
      fontWeight: "800",
    },

    planDescription: {
      color: "#7B837F",
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
    },

    planArrow: {
      color: "#426B55",
      fontSize: 28,
      marginLeft: 8,
    },

    planFeatures: {
      marginTop: 15,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor:
        "#EDF0EB",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 13,
    },

    planFeatureText: {
      color: "#526159",
      fontSize: 10,
      fontWeight: "600",
    },

    popularRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    popularBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor:
        "#F0E6BF",
    },

    popularBadgeText: {
      color: "#80600F",
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.6,
    },

    freshnessNotice: {
      marginHorizontal: 20,
      marginTop: 9,
      padding: 17,
      borderRadius: 20,
      backgroundColor:
        "#EAF1EC",
      flexDirection: "row",
    },

    freshnessIcon: {
      width: 37,
      height: 37,
      borderRadius: 19,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#D6E6DB",
    },

    freshnessIconText: {
      color: "#316849",
      fontSize: 17,
    },

    freshnessContent: {
      flex: 1,
      marginLeft: 12,
    },

    freshnessTitle: {
      color: "#263B30",
      fontSize: 13,
      fontWeight: "800",
    },

    freshnessText: {
      color: "#637068",
      fontSize: 10,
      lineHeight: 16,
      marginTop: 4,
    },
  });