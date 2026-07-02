export type WebPushPlatform =
  | "ios"
  | "android"
  | "macos"
  | "windows"
  | "linux"
  | "other";

export type WebPushSubscriptionPayload = {
  endpoint: string;

  expirationTime:
    number | null;

  keys: {
    p256dh: string;

    auth: string;
  };
};

export type WebPushSupport = {
  supported: boolean;

  isIos: boolean;

  isStandalone: boolean;

  reason:
    | "supported"
    | "not_browser"
    | "not_installed"
    | "missing_apis";
};

export type WebPushRegistrationErrorCode =
  | "unsupported_platform"
  | "not_installed"
  | "permission_denied"
  | "service_worker_failed"
  | "subscription_failed";

export class WebPushRegistrationError
  extends Error {
  code:
    WebPushRegistrationErrorCode;

  constructor(
    code:
      WebPushRegistrationErrorCode,

    message: string
  ) {
    super(message);

    this.name =
      "WebPushRegistrationError";

    this.code =
      code;
  }
}

type NavigatorWithStandalone =
  Navigator & {
    standalone?: boolean;
  };

function isBrowserEnvironment() {
  return (
    typeof window !==
      "undefined" &&
    typeof navigator !==
      "undefined"
  );
}

function detectIos() {
  if (
    !isBrowserEnvironment()
  ) {
    return false;
  }

  const userAgent =
    navigator.userAgent ||
    "";

  const navigatorPlatform =
    navigator.platform ||
    "";

  return (
    /iPad|iPhone|iPod/i.test(
      userAgent
    ) ||
    (
      navigatorPlatform ===
        "MacIntel" &&
      navigator.maxTouchPoints >
        1
    )
  );
}

function detectStandalone() {
  if (
    !isBrowserEnvironment()
  ) {
    return false;
  }

  const navigatorWithStandalone =
    navigator as
      NavigatorWithStandalone;

  return Boolean(
    window.matchMedia?.(
      "(display-mode: standalone)"
    ).matches ||
      navigatorWithStandalone
        .standalone
  );
}

export function getWebPushSupport():
  WebPushSupport {
  if (
    !isBrowserEnvironment()
  ) {
    return {
      supported: false,

      isIos: false,

      isStandalone:
        false,

      reason:
        "not_browser",
    };
  }

  const isIos =
    detectIos();

  const isStandalone =
    detectStandalone();

  if (
    isIos &&
    !isStandalone
  ) {
    return {
      supported: false,

      isIos,

      isStandalone,

      reason:
        "not_installed",
    };
  }

  const supported =
    Boolean(
      "serviceWorker" in
        navigator &&
      "PushManager" in
        window &&
      "Notification" in
        window
    );

  return {
    supported,

    isIos,

    isStandalone,

    reason:
      supported
        ? "supported"
        : "missing_apis",
  };
}

export function getWebPushPlatform():
  WebPushPlatform {
  if (
    !isBrowserEnvironment()
  ) {
    return "other";
  }

  const userAgent =
    navigator.userAgent
      .toLowerCase();

  if (detectIos()) {
    return "ios";
  }

  if (
    userAgent.includes(
      "android"
    )
  ) {
    return "android";
  }

  if (
    userAgent.includes(
      "mac os"
    )
  ) {
    return "macos";
  }

  if (
    userAgent.includes(
      "windows"
    )
  ) {
    return "windows";
  }

  if (
    userAgent.includes(
      "linux"
    )
  ) {
    return "linux";
  }

  return "other";
}

export function getWebPushDeviceName() {
  if (
    !isBrowserEnvironment()
  ) {
    return "Web app";
  }

  const platform =
    getWebPushPlatform();

  if (
    platform === "ios"
  ) {
    return "SipBite iPhone Home Screen app";
  }

  if (
    platform ===
    "android"
  ) {
    return "SipBite Android web app";
  }

  if (
    platform ===
    "macos"
  ) {
    return "SipBite Mac web app";
  }

  if (
    platform ===
    "windows"
  ) {
    return "SipBite Windows web app";
  }

  return "SipBite web app";
}

export function getWebPushUserAgent() {
  return isBrowserEnvironment()
    ? navigator.userAgent
    : "";
}

export function getCurrentWebNotificationPermission():
  | "default"
  | "denied"
  | "granted"
  | "unsupported" {
  const support =
    getWebPushSupport();

  if (!support.supported) {
    return "unsupported";
  }

  return Notification.permission;
}

export async function requestWebPushPermission():
  Promise<void> {
  const support =
    getWebPushSupport();

  if (!support.supported) {
    throw new WebPushRegistrationError(
      support.reason ===
      "not_installed"
        ? "not_installed"
        : "unsupported_platform",

      support.reason ===
      "not_installed"
        ? "Add SipBite to your iPhone Home Screen before enabling notifications."
        : "This browser does not support Web Push notifications."
    );
  }

  if (
    Notification.permission ===
    "denied"
  ) {
    throw new WebPushRegistrationError(
      "permission_denied",

      "Notification permission is blocked for SipBite. Enable it from your device notification settings."
    );
  }

  if (
    Notification.permission ===
    "default"
  ) {
    const permission =
      await Notification
        .requestPermission();

    if (
      permission !==
      "granted"
    ) {
      throw new WebPushRegistrationError(
        "permission_denied",

        "Notification permission was not granted."
      );
    }
  }
}

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (
        4 -
        (
          base64String.length %
          4
        )
      ) % 4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  const rawData =
    window.atob(
      base64
    );

  const outputArray =
    new Uint8Array(
      rawData.length
    );

  for (
    let index = 0;
    index <
    rawData.length;
    index += 1
  ) {
    outputArray[index] =
      rawData.charCodeAt(
        index
      );
  }

  return outputArray;
}

async function getServiceWorkerRegistration() {
  const support =
    getWebPushSupport();

  if (!support.supported) {
    throw new WebPushRegistrationError(
      support.reason ===
      "not_installed"
        ? "not_installed"
        : "unsupported_platform",

      support.reason ===
      "not_installed"
        ? "Add SipBite to your iPhone Home Screen before enabling notifications."
        : "This browser does not support Web Push notifications."
    );
  }

  try {
    const existingRegistration =
      await navigator
        .serviceWorker
        .getRegistration("/");

    if (
      existingRegistration
    ) {
      return existingRegistration;
    }

    await navigator
      .serviceWorker
      .register(
        "/sw.js",

        {
          scope: "/",
        }
      );

    return await navigator
      .serviceWorker.ready;
  } catch {
    throw new WebPushRegistrationError(
      "service_worker_failed",

      "SipBite could not start its notification service. Close and reopen the Home Screen app, then try again."
    );
  }
}

function toSubscriptionPayload(
  subscription:
    PushSubscription
): WebPushSubscriptionPayload {
  const json =
    subscription.toJSON();

  const p256dh =
    String(
      json.keys?.p256dh ||
      ""
    ).trim();

  const auth =
    String(
      json.keys?.auth ||
      ""
    ).trim();

  if (
    !json.endpoint ||
    !p256dh ||
    !auth
  ) {
    throw new WebPushRegistrationError(
      "subscription_failed",

      "The browser returned an incomplete notification subscription."
    );
  }

  return {
    endpoint:
      json.endpoint,

    expirationTime:
      json.expirationTime ??
      null,

    keys: {
      p256dh,

      auth,
    },
  };
}

export async function getExistingWebPushSubscription():
  Promise<
    WebPushSubscriptionPayload |
    null
  > {
  const support =
    getWebPushSupport();

  if (!support.supported) {
    return null;
  }

  const registration =
    await getServiceWorkerRegistration();

  const subscription =
    await registration
      .pushManager
      .getSubscription();

  return subscription
    ? toSubscriptionPayload(
        subscription
      )
    : null;
}

export async function registerForWebPushNotifications(
  publicKey: string
): Promise<
  WebPushSubscriptionPayload
> {
  const cleanPublicKey =
    publicKey.trim();

  if (!cleanPublicKey) {
    throw new WebPushRegistrationError(
      "subscription_failed",

      "SipBite Web Push is not configured yet."
    );
  }

  await requestWebPushPermission();

  const registration =
    await getServiceWorkerRegistration();

  const existingSubscription =
    await registration
      .pushManager
      .getSubscription();

  if (
    existingSubscription
  ) {
    return toSubscriptionPayload(
      existingSubscription
    );
  }

  try {
    const subscription =
      await registration
        .pushManager
        .subscribe({
          userVisibleOnly:
            true,

          applicationServerKey:
            urlBase64ToUint8Array(
              cleanPublicKey
            ) as BufferSource,
        });

    return toSubscriptionPayload(
      subscription
    );
  } catch (error) {
    throw new WebPushRegistrationError(
      "subscription_failed",

      error instanceof Error &&
      error.message
        ? error.message
        : "SipBite could not create a Web Push subscription."
    );
  }
}

export async function unsubscribeFromWebPushNotifications():
  Promise<{
    endpoint:
      string | null;

    unsubscribed:
      boolean;
  }> {
  const support =
    getWebPushSupport();

  if (!support.supported) {
    return {
      endpoint: null,

      unsubscribed:
        false,
    };
  }

  const registration =
    await getServiceWorkerRegistration();

  const subscription =
    await registration
      .pushManager
      .getSubscription();

  if (!subscription) {
    return {
      endpoint: null,

      unsubscribed:
        false,
    };
  }

  const endpoint =
    subscription.endpoint;

  const unsubscribed =
    await subscription
      .unsubscribe();

  return {
    endpoint,

    unsubscribed,
  };
}