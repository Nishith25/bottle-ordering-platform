// customer-app/src/app/(tabs)/_layout.tsx

import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

type TabIconName =
  | "home"
  | "home-outline"
  | "nutrition"
  | "nutrition-outline"
  | "calendar"
  | "calendar-outline"
  | "receipt"
  | "receipt-outline"
  | "person"
  | "person-outline";

function getTabIcon(
  routeName: string,
  focused: boolean
): TabIconName {
  switch (routeName) {
    case "index":
      return focused ? "home" : "home-outline";

    case "bottles":
      return focused ? "nutrition" : "nutrition-outline";

    case "plans":
      return focused ? "calendar" : "calendar-outline";

    case "orders":
      return focused ? "receipt" : "receipt-outline";

    case "account":
      return focused ? "person" : "person-outline";

    default:
      return "home-outline";
  }
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: "#245C42",
        tabBarInactiveTintColor: "#929A95",

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 2,
        },

        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons
            name={getTabIcon(route.name, focused)}
            size={size}
            color={color}
          />
        ),

        tabBarStyle: {
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 9,
          paddingBottom: Platform.OS === "ios" ? 23 : 9,
          paddingHorizontal: 8,
          borderTopWidth: 0,
          backgroundColor: "#FFFFFF",

          shadowColor: "#15251C",
          shadowOpacity: 0.1,
          shadowRadius: 18,
          shadowOffset: {
            width: 0,
            height: -5,
          },

          elevation: 15,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="bottles"
        options={{
          title: "Bottles",
        }}
      />

      <Tabs.Screen
        name="plans"
        options={{
          title: "Plans",
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
        }}
      />
    </Tabs>
  );
}