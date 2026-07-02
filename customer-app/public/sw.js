const SERVICE_WORKER_VERSION =
  "sipbite-pwa-v2";

self.addEventListener(
  "install",

  () => {
    self.skipWaiting();
  }
);

self.addEventListener(
  "activate",

  (event) => {
    event.waitUntil(
      self.clients.claim()
    );
  }
);

self.addEventListener(
  "message",

  (event) => {
    if (
      event.data?.type ===
      "SKIP_WAITING"
    ) {
      self.skipWaiting();
    }
  }
);

function cleanText(
  value,
  fallback = ""
) {
  const text =
    String(
      value ?? ""
    ).trim();

  return text || fallback;
}

function normalizeData(value) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return {
    ...value,
  };
}

self.addEventListener(
  "push",

  (event) => {
    let payload = {};

    if (event.data) {
      try {
        payload =
          event.data.json();
      } catch {
        payload = {
          title:
            "SipBite",

          body:
            event.data.text(),
        };
      }
    }

    const title =
      cleanText(
        payload.title,
        "SipBite"
      );

    const body =
      cleanText(
        payload.body,
        "You have a new SipBite update."
      );

    const data =
      normalizeData(
        payload.data
      );

    const route =
      cleanText(
        data.route ||
          data.url,
        "/notifications"
      );

    const notificationData = {
      ...data,

      route,
    };

    const tag =
      cleanText(
        payload.tag ||
          data.notificationId
      ) || undefined;

    event.waitUntil(
      Promise.all([
        self.registration
          .showNotification(
            title,

            {
              body,

              icon:
                cleanText(
                  payload.icon,
                  "/pwa-192.png"
                ),

              badge:
                cleanText(
                  payload.badge,
                  "/pwa-192.png"
                ),

              tag,

              renotify:
                Boolean(tag),

              data:
                notificationData,

              timestamp:
                Date.now(),
            }
          ),

        (
          "setAppBadge" in
          self.navigator
            ? self.navigator
                .setAppBadge(1)
                .catch(() => {})
            : Promise.resolve()
        ),
      ])
    );
  }
);

self.addEventListener(
  "notificationclick",

  (event) => {
    event.notification.close();

    const notificationData =
      normalizeData(
        event.notification
          .data
      );

    const requestedPath =
      cleanText(
        notificationData.url ||
          notificationData.route,
        "/notifications"
      );

    let targetUrl;

    try {
      targetUrl =
        new URL(
          requestedPath,
          self.location.origin
        );

      if (
        targetUrl.origin !==
        self.location.origin
      ) {
        targetUrl =
          new URL(
            "/notifications",
            self.location.origin
          );
      }
    } catch {
      targetUrl =
        new URL(
          "/notifications",
          self.location.origin
        );
    }

    event.waitUntil(
      (async () => {
        if (
          "clearAppBadge" in
          self.navigator
        ) {
          try {
            await self.navigator
              .clearAppBadge();
          } catch {
            // Badging is optional.
          }
        }

        const windowClients =
          await self.clients
            .matchAll({
              type: "window",

              includeUncontrolled:
                true,
            });

        for (
          const client of
          windowClients
        ) {
          const clientUrl =
            new URL(
              client.url
            );

          if (
            clientUrl.origin ===
            self.location.origin
          ) {
            if (
              "navigate" in
              client
            ) {
              await client.navigate(
                targetUrl.href
              );
            }

            await client.focus();

            return;
          }
        }

        await self.clients
          .openWindow(
            targetUrl.href
          );
      })()
    );
  }
);