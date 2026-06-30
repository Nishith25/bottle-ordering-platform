import { useCallback, useEffect, useRef } from "react";

import {
  Href,
  useRootNavigationState,
  useRouter,
} from "expo-router";

import * as Notifications from "expo-notifications";

type NotificationData = Record<
  string,
  unknown
>;

const ALLOWED_NOTIFICATION_ROUTES =
  new Set([
    "/notifications",
    "/orders",
    "/plans",
    "/subscription-details",
    "/delivery-order",
    "/payment-result",
  ]);

function cleanText(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeNotificationData(
  value: unknown
): NotificationData {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as NotificationData;
}

function createResponseKey(
  response:
    Notifications.NotificationResponse
) {
  const request =
    response.notification.request;

  const notificationId =
    cleanText(
      request.identifier
    );

  const actionIdentifier =
    cleanText(
      response.actionIdentifier
    );

  const receivedAt =
    cleanText(
      response.notification.date
    );

  return [
    notificationId,
    actionIdentifier,
    receivedAt,
  ].join(":");
}

function resolveNotificationRoute(
  data: NotificationData
) {
  const explicitRoute =
    cleanText(data.route);

  if (
    ALLOWED_NOTIFICATION_ROUTES.has(
      explicitRoute
    )
  ) {
    return explicitRoute;
  }

  const type =
    cleanText(
      data.type
    ).toLowerCase();

  const action =
    cleanText(
      data.action
    ).toLowerCase();

  const combined =
    `${type} ${action}`;

  const orderId =
    cleanText(
      data.orderId
    );

  const subscriptionId =
    cleanText(
      data.subscriptionId
    );

  if (
    subscriptionId ||
    combined.includes(
      "subscription"
    ) ||
    combined.includes(
      "billing"
    ) ||
    combined.includes(
      "mandate"
    ) ||
    combined.includes(
      "recurring"
    )
  ) {
    return subscriptionId
      ? "/subscription-details"
      : "/plans";
  }

  if (
    orderId &&
    (
      combined.includes(
        "delivery"
      ) ||
      combined.includes(
        "picked_up"
      ) ||
      combined.includes(
        "picked up"
      ) ||
      combined.includes(
        "out_for_delivery"
      ) ||
      combined.includes(
        "out for delivery"
      )
    )
  ) {
    return "/delivery-order";
  }

  if (
    orderId ||
    combined.includes(
      "order"
    ) ||
    combined.includes(
      "refund"
    ) ||
    combined.includes(
      "payment"
    ) ||
    combined.includes(
      "review"
    )
  ) {
    return "/orders";
  }

  return "/notifications";
}

function buildNotificationHref(
  data: NotificationData
): Href {
  const pathname =
    resolveNotificationRoute(
      data
    );

  const params: Record<
    string,
    string
  > = {};

  const orderId =
    cleanText(
      data.orderId
    );

  const subscriptionId =
    cleanText(
      data.subscriptionId
    );

  const notificationId =
    cleanText(
      data.notificationId
    );

  const orderNumber =
    cleanText(
      data.orderNumber
    );

  const subscriptionNumber =
    cleanText(
      data.subscriptionNumber
    );

  const type =
    cleanText(
      data.type
    );

  const action =
    cleanText(
      data.action
    );

  if (orderId) {
    params.orderId =
      orderId;
  }

  if (subscriptionId) {
    params.subscriptionId =
      subscriptionId;
  }

  if (notificationId) {
    params.notificationId =
      notificationId;
  }

  if (orderNumber) {
    params.orderNumber =
      orderNumber;
  }

  if (subscriptionNumber) {
    params.subscriptionNumber =
      subscriptionNumber;
  }

  if (type) {
    params.notificationType =
      type;
  }

  if (action) {
    params.notificationAction =
      action;
  }

  if (
    Object.keys(params)
      .length === 0
  ) {
    return pathname as Href;
  }

  /*
   * Expo Router supports navigation
   * objects containing pathname and
   * serializable URL parameters.
   */
  return {
    pathname,
    params,
  } as Href;
}

export function useNotificationNavigation() {
  const router =
    useRouter();

  const rootNavigationState =
    useRootNavigationState();

  const navigationReady =
    Boolean(
      rootNavigationState?.key
    );

  const handledResponseKeysRef =
    useRef<Set<string>>(
      new Set()
    );

  const pendingResponseRef =
    useRef<
      Notifications.NotificationResponse |
        null
    >(null);

  const navigateFromResponse =
    useCallback(
      (
        response:
          Notifications.NotificationResponse
      ) => {
        if (
          response.actionIdentifier !==
          Notifications.DEFAULT_ACTION_IDENTIFIER
        ) {
          return;
        }

        const responseKey =
          createResponseKey(
            response
          );

        if (
          handledResponseKeysRef.current.has(
            responseKey
          )
        ) {
          return;
        }

        if (!navigationReady) {
          pendingResponseRef.current =
            response;

          return;
        }

        handledResponseKeysRef.current.add(
          responseKey
        );

        const data =
          normalizeNotificationData(
            response.notification
              .request.content.data
          );

        const href =
          buildNotificationHref(
            data
          );

        router.push(href);

        /*
         * Prevent the same notification
         * response from navigating again
         * during a future render.
         */
        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          // Navigation already succeeded.
        }
      },
      [
        navigationReady,
        router,
      ]
    );

  /*
   * Process a tap that occurred while
   * the application was already open or
   * running in the background.
   */
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (
          response
        ) => {
          navigateFromResponse(
            response
          );
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    navigateFromResponse,
  ]);

  /*
   * Process a tap that launched the app
   * from a fully closed state.
   */
  useEffect(() => {
    let active = true;

    async function processInitialResponse() {
      try {
        const response =
          await Notifications.getLastNotificationResponseAsync();

        if (
          active &&
          response
        ) {
          navigateFromResponse(
            response
          );
        }
      } catch (error) {
        console.warn(
          "Unable to process initial notification response:",
          error instanceof Error
            ? error.message
            : "Unknown notification navigation error."
        );
      }
    }

    void processInitialResponse();

    return () => {
      active = false;
    };
  }, [
    navigateFromResponse,
  ]);

  /*
   * If the notification arrived before
   * Expo Router mounted, process it as
   * soon as navigation becomes ready.
   */
  useEffect(() => {
    if (
      !navigationReady ||
      !pendingResponseRef.current
    ) {
      return;
    }

    const pendingResponse =
      pendingResponseRef.current;

    pendingResponseRef.current =
      null;

    navigateFromResponse(
      pendingResponse
    );
  }, [
    navigationReady,
    navigateFromResponse,
  ]);
}