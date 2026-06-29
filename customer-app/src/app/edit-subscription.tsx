import Ionicons from "@expo/vector-icons/Ionicons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
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
} from "../context/AuthContext";

import {
  useSubscriptions,
} from "../context/SubscriptionContext";

import {
  fetchSubscriptionEditOptions,
  updateCustomerSubscription,
  type SubscriptionEditOptions,
  type SubscriptionEditProduct,
} from "../services/subscriptionManagementApi";

const DELIVERY_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DELIVERY_SLOTS = [
  "08:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 02:00 PM",
  "04:00 PM - 06:00 PM",
  "06:00 PM - 08:00 PM",
];

type AddressForm = {
  fullName: string;
  phone: string;
  pincode: string;
  houseDetails: string;
  areaDetails: string;
  landmark: string;
};

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
  ).format(value);
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

function showMessage(
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

export default function EditSubscriptionScreen() {
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
    refreshSubscriptions,
  } = useSubscriptions();

  const [
    options,
    setOptions,
  ] =
    useState<SubscriptionEditOptions | null>(
      null
    );

  const [
    quantities,
    setQuantities,
  ] = useState<
    Record<string, number>
  >({});

  const [
    preferredDay,
    setPreferredDay,
  ] = useState("");

  const [
    preferredSlot,
    setPreferredSlot,
  ] = useState("");

  const [
    address,
    setAddress,
  ] = useState<AddressForm>({
    fullName: "",
    phone: "",
    pincode: "",
    houseDetails: "",
    areaDetails: "",
    landmark: "",
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (
        !token ||
        !subscriptionId
      ) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await fetchSubscriptionEditOptions(
            token,
            subscriptionId
          );

        if (!active) {
          return;
        }

        setOptions(result);

        const initialQuantities:
          Record<string, number> =
          {};

        for (
          const item of
          result.subscription.items
        ) {
          initialQuantities[
            item.productId
          ] =
            item.quantity;
        }

        setQuantities(
          initialQuantities
        );

        setPreferredDay(
          result.subscription
            .preferredDay
        );

        setPreferredSlot(
          result.subscription
            .preferredSlot
        );

        setAddress({
          fullName:
            result.subscription
              .deliveryAddress
              .fullName,

          phone:
            result.subscription
              .deliveryAddress
              .phone,

          pincode:
            result.subscription
              .deliveryAddress
              .pincode,

          houseDetails:
            result.subscription
              .deliveryAddress
              .houseDetails,

          areaDetails:
            result.subscription
              .deliveryAddress
              .areaDetails,

          landmark:
            result.subscription
              .deliveryAddress
              .landmark || "",
        });
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load subscription details."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    token,
    subscriptionId,
  ]);

  const selectedBottleCount =
    useMemo(
      () =>
        Object.values(
          quantities
        ).reduce(
          (
            total,
            quantity
          ) =>
            total + quantity,
          0
        ),
      [quantities]
    );

  const estimatedOriginalTotal =
    useMemo(() => {
      if (!options) {
        return 0;
      }

      return options.products.reduce(
        (
          total,
          product
        ) =>
          total +
          product.price *
            (
              quantities[
                product.productId
              ] || 0
            ),
        0
      );
    }, [
      options,
      quantities,
    ]);

  const estimatedPlanSavings =
    useMemo(() => {
      if (!options) {
        return 0;
      }

      return (
        estimatedOriginalTotal *
        (
          options.subscription
            .discountPercent /
          100
        )
      );
    }, [
      options,
      estimatedOriginalTotal,
    ]);

  const estimatedCycleTotal =
    Math.max(
      0,
      estimatedOriginalTotal -
        estimatedPlanSavings
    );

  const requiredBottleCount =
    options?.subscription
      .bottleCount || 0;

  const updateAddress = (
    field: keyof AddressForm,
    value: string
  ) => {
    setAddress(
      (currentAddress) => ({
        ...currentAddress,
        [field]: value,
      })
    );
  };

  const changeQuantity = (
    product:
      SubscriptionEditProduct,
    difference: number
  ) => {
    setQuantities(
      (currentQuantities) => {
        const currentQuantity =
          currentQuantities[
            product.productId
          ] || 0;

        if (
          difference > 0 &&
          (
            !product.available ||
            !product.subscriptionEligible ||
            selectedBottleCount >=
              requiredBottleCount
          )
        ) {
          return currentQuantities;
        }

        const nextQuantity =
          Math.max(
            0,
            currentQuantity +
              difference
          );

        return {
          ...currentQuantities,
          [product.productId]:
            nextQuantity,
        };
      }
    );
  };

  const saveChanges =
    async () => {
      if (
        !token ||
        !options ||
        !subscriptionId
      ) {
        return;
      }

      if (
        selectedBottleCount !==
        requiredBottleCount
      ) {
        setError(
          `Select exactly ${requiredBottleCount} bottles.`
        );

        return;
      }

      if (
        !preferredDay ||
        !preferredSlot
      ) {
        setError(
          "Select a delivery day and time slot."
        );

        return;
      }

      if (
        !address.fullName.trim() ||
        !address.phone.trim() ||
        !address.pincode.trim() ||
        !address.houseDetails.trim() ||
        !address.areaDetails.trim()
      ) {
        setError(
          "Complete all required delivery-address fields."
        );

        return;
      }

      setSaving(true);
      setError(null);

      try {
        await updateCustomerSubscription(
          token,
          subscriptionId,
          {
            items:
              Object.entries(
                quantities
              )
                .filter(
                  (
                    [
                      ,
                      quantity,
                    ]
                  ) =>
                    quantity > 0
                )
                .map(
                  (
                    [
                      productId,
                      quantity,
                    ]
                  ) => ({
                    productId,
                    quantity,
                  })
                ),

            preferredDay,
            preferredSlot,

            deliveryAddress: {
              fullName:
                address.fullName.trim(),

              phone:
                address.phone.trim(),

              pincode:
                address.pincode.trim(),

              houseDetails:
                address.houseDetails.trim(),

              areaDetails:
                address.areaDetails.trim(),

              landmark:
                address.landmark.trim(),
            },
          }
        );

        await refreshSubscriptions();

        showMessage(
          "Subscription updated",
          "Your new bottle selection, delivery schedule and address will apply to future recurring orders."
        );

        router.back();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update your subscription."
        );
      } finally {
        setSaving(false);
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
          <Text
            style={styles.stateTitle}
          >
            Log in to edit your
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
            Loading subscription
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            Edit subscription
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Future deliveries only
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
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
              size={19}
              color="#A34848"
            />

            <Text
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {options ? (
          <>
            <View
              style={[
                styles.editNotice,

                !options.canEdit &&
                  styles.lockedNotice,
              ]}
            >
              <Ionicons
                name={
                  options.canEdit
                    ? "information-circle-outline"
                    : "lock-closed-outline"
                }
                size={20}
                color={
                  options.canEdit
                    ? "#35694E"
                    : "#995050"
                }
              />

              <View style={{ flex: 1 }}>
                <Text
                  style={
                    styles.noticeTitle
                  }
                >
                  {options.canEdit
                    ? options.subscription
                        .status ===
                      "paused"
                      ? "Paused subscription"
                      : "Editing available"
                    : "Editing locked"}
                </Text>

                <Text
                  style={
                    styles.noticeText
                  }
                >
                  {
                    options.editMessage
                  }
                </Text>

                {options.editDeadline ? (
                  <Text
                    style={
                      styles.deadlineText
                    }
                  >
                    Edit deadline:{" "}
                    {formatDate(
                      options.editDeadline
                    )}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Choose bottles
            </Text>

            <Text
              style={
                styles.sectionDescription
              }
            >
              Selected{" "}
              {selectedBottleCount} of{" "}
              {requiredBottleCount} bottles
            </Text>

            <View
              style={
                styles.selectionProgress
              }
            >
              <View
                style={[
                  styles.selectionProgressFill,

                  {
                    width: `${Math.min(
                      100,
                      (
                        selectedBottleCount /
                        Math.max(
                          requiredBottleCount,
                          1
                        )
                      ) *
                        100
                    )}%`,
                  },
                ]}
              />
            </View>

            <View
              style={
                styles.productList
              }
            >
              {options.products.map(
                (product) => {
                  const quantity =
                    quantities[
                      product.productId
                    ] || 0;

                  const unavailable =
                    !product.available ||
                    !product.subscriptionEligible;

                  return (
                    <View
                      key={
                        product.productId
                      }
                      style={[
                        styles.productCard,

                        unavailable &&
                          styles.unavailableCard,
                      ]}
                    >
                      <View
                        style={
                          styles.productInformation
                        }
                      >
                        <Text
                          style={
                            styles.productName
                          }
                        >
                          {product.name}
                        </Text>

                        <Text
                          style={
                            styles.productMeta
                          }
                        >
                          {product.sizeMl} ml ·{" "}
                          {formatCurrency(
                            product.price
                          )}
                        </Text>

                        {unavailable ? (
                          <Text
                            style={
                              styles.unavailableText
                            }
                          >
                            Currently unavailable
                          </Text>
                        ) : null}
                      </View>

                      <View
                        style={
                          styles.quantityControl
                        }
                      >
                        <Pressable
                          disabled={
                            quantity === 0 ||
                            !options.canEdit
                          }
                          onPress={() =>
                            changeQuantity(
                              product,
                              -1
                            )
                          }
                          style={
                            styles.quantityButton
                          }
                        >
                          <Text
                            style={
                              styles.quantityButtonText
                            }
                          >
                            −
                          </Text>
                        </Pressable>

                        <Text
                          style={
                            styles.quantityText
                          }
                        >
                          {quantity}
                        </Text>

                        <Pressable
                          disabled={
                            unavailable ||
                            !options.canEdit ||
                            selectedBottleCount >=
                              requiredBottleCount
                          }
                          onPress={() =>
                            changeQuantity(
                              product,
                              1
                            )
                          }
                          style={
                            styles.quantityButton
                          }
                        >
                          <Text
                            style={
                              styles.quantityButtonText
                            }
                          >
                            +
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                }
              )}
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Delivery day
            </Text>

            <View
              style={styles.chipGrid}
            >
              {DELIVERY_DAYS.map(
                (day) => (
                  <Pressable
                    key={day}
                    disabled={
                      !options.canEdit
                    }
                    onPress={() =>
                      setPreferredDay(
                        day
                      )
                    }
                    style={[
                      styles.choiceChip,

                      preferredDay ===
                        day &&
                        styles.activeChoiceChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,

                        preferredDay ===
                          day &&
                          styles.activeChoiceChipText,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Delivery time
            </Text>

            <View
              style={styles.slotList}
            >
              {[
                preferredSlot,
                ...DELIVERY_SLOTS,
              ]
                .filter(
                  (
                    value,
                    index,
                    values
                  ) =>
                    value &&
                    values.indexOf(
                      value
                    ) === index
                )
                .map((slot) => (
                  <Pressable
                    key={slot}
                    disabled={
                      !options.canEdit
                    }
                    onPress={() =>
                      setPreferredSlot(
                        slot
                      )
                    }
                    style={[
                      styles.slotButton,

                      preferredSlot ===
                        slot &&
                        styles.activeSlotButton,
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color={
                        preferredSlot ===
                        slot
                          ? "#FFFFFF"
                          : "#35694E"
                      }
                    />

                    <Text
                      style={[
                        styles.slotText,

                        preferredSlot ===
                          slot &&
                          styles.activeSlotText,
                      ]}
                    >
                      {slot}
                    </Text>
                  </Pressable>
                ))}
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Delivery address
            </Text>

            <View
              style={styles.formCard}
            >
              <FormInput
                label="Full name"
                value={
                  address.fullName
                }
                onChangeText={(
                  value
                ) =>
                  updateAddress(
                    "fullName",
                    value
                  )
                }
                editable={
                  options.canEdit
                }
              />

              <FormInput
                label="Phone number"
                value={address.phone}
                keyboardType="phone-pad"
                onChangeText={(
                  value
                ) =>
                  updateAddress(
                    "phone",
                    value
                  )
                }
                editable={
                  options.canEdit
                }
              />

              <FormInput
                label="Pincode"
                value={
                  address.pincode
                }
                keyboardType="number-pad"
                onChangeText={(
                  value
                ) =>
                  updateAddress(
                    "pincode",
                    value
                  )
                }
                editable={
                  options.canEdit
                }
              />

              <FormInput
                label="House, flat or building"
                value={
                  address.houseDetails
                }
                onChangeText={(
                  value
                ) =>
                  updateAddress(
                    "houseDetails",
                    value
                  )
                }
                editable={
                  options.canEdit
                }
              />

              <FormInput
                label="Area and street"
                value={
                  address.areaDetails
                }
                onChangeText={(
                  value
                ) =>
                  updateAddress(
                    "areaDetails",
                    value
                  )
                }
                editable={
                  options.canEdit
                }
              />

              <FormInput
                label="Landmark (optional)"
                value={
                  address.landmark
                }
                onChangeText={(
                  value
                ) =>
                  updateAddress(
                    "landmark",
                    value
                  )
                }
                editable={
                  options.canEdit
                }
              />
            </View>

            <View
              style={styles.priceCard}
            >
              <PriceRow
                label="Current bottle prices"
                value={formatCurrency(
                  estimatedOriginalTotal
                )}
              />

              <PriceRow
                label={`Plan saving (${options.subscription.discountPercent}%)`}
                value={`−${formatCurrency(
                  estimatedPlanSavings
                )}`}
              />

              <View
                style={styles.totalRow}
              >
                <Text
                  style={
                    styles.totalLabel
                  }
                >
                  Estimated cycle total
                </Text>

                <Text
                  style={
                    styles.totalValue
                  }
                >
                  {formatCurrency(
                    estimatedCycleTotal
                  )}
                </Text>
              </View>

              <Text
                style={
                  styles.priceNotice
                }
              >
                The backend will validate
                current prices, serviceability
                and any existing coupon before
                saving.
              </Text>
            </View>

            <Pressable
              disabled={
                !options.canEdit ||
                saving ||
                selectedBottleCount !==
                  requiredBottleCount
              }
              onPress={() => {
                void saveChanges();
              }}
              style={[
                styles.saveButton,

                (
                  !options.canEdit ||
                  saving ||
                  selectedBottleCount !==
                    requiredBottleCount
                ) &&
                  styles.disabledButton,
              ]}
            >
              {saving ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Text
                    style={
                      styles.saveButtonText
                    }
                  >
                    Save subscription changes
                  </Text>

                  <Ionicons
                    name="checkmark"
                    size={19}
                    color="#FFFFFF"
                  />
                </>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  editable,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (
    value: string
  ) => void;
  editable: boolean;
  keyboardType?:
    | "default"
    | "phone-pad"
    | "number-pad";
}) {
  return (
    <View
      style={styles.inputGroup}
    >
      <Text
        style={styles.inputLabel}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        editable={editable}
        keyboardType={
          keyboardType
        }
        onChangeText={
          onChangeText
        }
        placeholder={label}
        placeholderTextColor="#9AA39D"
        style={[
          styles.input,

          !editable &&
            styles.disabledInput,
        ]}
      />
    </View>
  );
}

function PriceRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={styles.priceRow}
    >
      <Text
        style={styles.priceLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.priceValue}
      >
        {value}
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
      paddingBottom: 70,
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
      marginBottom: 15,
    },

    errorText: {
      flex: 1,
      color: "#934545",
      fontSize: 10,
      lineHeight: 15,
    },

    editNotice: {
      padding: 15,
      borderRadius: 19,
      backgroundColor:
        "#E8F1EA",
      flexDirection: "row",
      gap: 10,
    },

    lockedNotice: {
      backgroundColor:
        "#FAECEC",
    },

    noticeTitle: {
      color: "#263B30",
      fontSize: 12,
      fontWeight: "900",
    },

    noticeText: {
      color: "#66736B",
      fontSize: 9,
      lineHeight: 15,
      marginTop: 4,
    },

    deadlineText: {
      color: "#596A60",
      fontSize: 8,
      fontWeight: "800",
      marginTop: 6,
    },

    sectionTitle: {
      color: "#1D2922",
      fontSize: 16,
      fontWeight: "900",
      marginTop: 25,
    },

    sectionDescription: {
      color: "#748078",
      fontSize: 10,
      marginTop: 5,
    },

    selectionProgress: {
      height: 7,
      borderRadius: 4,
      backgroundColor:
        "#E1E7E2",
      overflow: "hidden",
      marginTop: 12,
    },

    selectionProgressFill: {
      height: "100%",
      borderRadius: 4,
      backgroundColor:
        "#2F7651",
    },

    productList: {
      gap: 10,
      marginTop: 13,
    },

    productCard: {
      padding: 15,
      borderRadius: 19,
      borderWidth: 1,
      borderColor:
        "#E1E6E0",
      backgroundColor:
        "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
    },

    unavailableCard: {
      backgroundColor:
        "#F4F4F1",
    },

    productInformation: {
      flex: 1,
    },

    productName: {
      color: "#203128",
      fontSize: 12,
      fontWeight: "900",
    },

    productMeta: {
      color: "#748078",
      fontSize: 9,
      marginTop: 5,
    },

    unavailableText: {
      color: "#A34D4D",
      fontSize: 8,
      fontWeight: "800",
      marginTop: 5,
    },

    quantityControl: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    quantityButton: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor:
        "#E6EFE8",
      alignItems: "center",
      justifyContent:
        "center",
    },

    quantityButtonText: {
      color: "#245C42",
      fontSize: 20,
      fontWeight: "800",
    },

    quantityText: {
      minWidth: 20,
      color: "#203128",
      fontSize: 14,
      fontWeight: "900",
      textAlign: "center",
    },

    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },

    choiceChip: {
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        "#DDE4DE",
      backgroundColor:
        "#FFFFFF",
    },

    activeChoiceChip: {
      borderColor:
        "#245C42",
      backgroundColor:
        "#245C42",
    },

    choiceChipText: {
      color: "#536159",
      fontSize: 9,
      fontWeight: "800",
    },

    activeChoiceChipText: {
      color: "#FFFFFF",
    },

    slotList: {
      gap: 9,
      marginTop: 12,
    },

    slotButton: {
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        "#DEE5DF",
      backgroundColor:
        "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },

    activeSlotButton: {
      borderColor:
        "#245C42",
      backgroundColor:
        "#245C42",
    },

    slotText: {
      color: "#536159",
      fontSize: 10,
      fontWeight: "800",
    },

    activeSlotText: {
      color: "#FFFFFF",
    },

    formCard: {
      padding: 16,
      borderRadius: 21,
      borderWidth: 1,
      borderColor:
        "#E1E6E0",
      backgroundColor:
        "#FFFFFF",
      gap: 14,
      marginTop: 12,
    },

    inputGroup: {
      gap: 6,
    },

    inputLabel: {
      color: "#536159",
      fontSize: 9,
      fontWeight: "800",
    },

    input: {
      minHeight: 47,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        "#DDE4DE",
      backgroundColor:
        "#FAFBF9",
      color: "#203128",
      fontSize: 11,
    },

    disabledInput: {
      opacity: 0.6,
    },

    priceCard: {
      padding: 17,
      borderRadius: 21,
      backgroundColor:
        "#E9F1EB",
      marginTop: 22,
    },

    priceRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      paddingVertical: 6,
    },

    priceLabel: {
      color: "#607068",
      fontSize: 10,
    },

    priceValue: {
      color: "#2C4437",
      fontSize: 10,
      fontWeight: "800",
    },

    totalRow: {
      marginTop: 8,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor:
        "#D1DDD4",
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    totalLabel: {
      color: "#203128",
      fontSize: 11,
      fontWeight: "900",
    },

    totalValue: {
      color: "#245C42",
      fontSize: 17,
      fontWeight: "900",
    },

    priceNotice: {
      color: "#6A786F",
      fontSize: 8,
      lineHeight: 13,
      marginTop: 10,
    },

    saveButton: {
      minHeight: 53,
      marginTop: 17,
      borderRadius: 17,
      backgroundColor:
        "#245C42",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    saveButtonText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.5,
    },
  });