// customer-app/src/app/_layout.tsx

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { CartProvider } from "../context/CartContext";
import { OrderProvider } from "../context/OrderContext";
import { SubscriptionProvider } from "../context/SubscriptionContext";

export default function RootLayout() {
  return (
    <CartProvider>
      <OrderProvider>
        <SubscriptionProvider>
          <StatusBar style="dark" />

          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: "#F7F7F2",
              },
            }}
          >
            <Stack.Screen name="(tabs)" />

            <Stack.Screen
              name="cart"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />

            <Stack.Screen
              name="checkout"
              options={{
                animation: "slide_from_right",
              }}
            />

            <Stack.Screen
              name="payment"
              options={{
                animation: "slide_from_right",
              }}
            />

            <Stack.Screen
              name="order-success"
              options={{
                animation: "fade",
                gestureEnabled: false,
              }}
            />

            <Stack.Screen
              name="plan-builder"
              options={{
                animation: "slide_from_right",
              }}
            />

            <Stack.Screen
              name="subscription-success"
              options={{
                animation: "fade",
                gestureEnabled: false,
              }}
            />
          </Stack>
        </SubscriptionProvider>
      </OrderProvider>
    </CartProvider>
  );
}