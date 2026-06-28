// customer-app/src/app/_layout.tsx

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { CartProvider } from "../context/CartContext";

export default function RootLayout() {
  return (
    <CartProvider>
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
      </Stack>
    </CartProvider>
  );
}