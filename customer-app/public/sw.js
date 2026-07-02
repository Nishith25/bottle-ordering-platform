const SERVICE_WORKER_VERSION =
  "sipbite-pwa-v1";

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

/*
 * Web Push will be connected to the
 * backend in the next phase.
 *
 * Keeping the push handler here now means
 * the installed PWA is already prepared
 * to display standards-based web pushes.
 */
self.addEventListener(
  "push",
  (event) => {
    if (!event.data) {
      return;
    }

    let payload = {};

    try {
      payload =
        event.data.json();
    } catch {
      payload = {
        title: "SipBite",
        body: event.data.text(),
      };
    }

    const title =
      String(
        payload.title ||
          "SipBite"
      ).trim();

    const body =
      String(
        payload.body ||
          "You have a new SipBite update."
      ).trim();

    const data =
      payload.data &&
      typeof payload.data ===
        "object"
        ? payload.data
        : {};

    event.waitUntil(
      self.registration.showNotification(
        title,
        {
          body,
          icon: "/pwa-192.png",
          badge: "/pwa-192.png",
          tag:
            String(
              payload.tag ||
                data.notificationId ||
                ""
            ) || undefined,
          renotify: false,
          data,
        }
      )
    );
  }
);

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const notificationData =
      event.notification.data &&
      typeof event.notification
        .data === "object"
        ? event.notification.data
        : {};

    const requestedPath =
      String(
        notificationData.url ||
          notificationData.route ||
          "/notifications"
      ).trim();

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
        const windowClients =
          await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });

        for (
          const client of
          windowClients
        ) {
          const clientUrl =
            new URL(client.url);

          if (
            clientUrl.origin ===
            self.location.origin
          ) {
            if (
              "navigate" in client
            ) {
              await client.navigate(
                targetUrl.href
              );
            }

            await client.focus();

            return;
          }
        }

        await self.clients.openWindow(
          targetUrl.href
        );
      })()
    );
  }
);