import {
  ScrollViewStyleReset,
} from "expo-router/html";

import type {
  PropsWithChildren,
} from "react";

const serviceWorkerRegistration = `
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/"
        })
        .then(function (registration) {
          console.log(
            "SipBite service worker registered:",
            registration.scope
          );
        })
        .catch(function (error) {
          console.error(
            "SipBite service worker registration failed:",
            error
          );
        });
    });
  }
`;

const globalWebStyles = `
  html,
  body,
  #root {
    min-height: 100%;
    background: #F7F7F2;
  }

  html {
    color-scheme: light;
  }

  body {
    margin: 0;
    background: #F7F7F2;
    overscroll-behavior-y: none;
    -webkit-tap-highlight-color: transparent;
  }

  * {
    box-sizing: border-box;
  }
`;

export default function Root({
  children,
}: PropsWithChildren) {
  return (
    <html lang="en-IN">
      <head>
        <meta charSet="utf-8" />

        <meta
          httpEquiv="X-UA-Compatible"
          content="IE=edge"
        />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1"
        />

        <title>SipBite</title>

        <meta
          name="description"
          content="Order fresh fruit and chia bottles and manage recurring SipBite plans."
        />

        <meta
          name="application-name"
          content="SipBite"
        />

        <meta
          name="theme-color"
          content="#245C42"
        />

        <meta
          name="mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-title"
          content="SipBite"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />

        <meta
          name="format-detection"
          content="telephone=no"
        />

        <link
          rel="manifest"
          href="/manifest.json"
        />

        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />

        <link
          rel="icon"
          type="image/png"
          href="/favicon.png"
        />

        <script
          dangerouslySetInnerHTML={{
            __html:
              serviceWorkerRegistration,
          }}
        />

        <style
          dangerouslySetInnerHTML={{
            __html:
              globalWebStyles,
          }}
        />

        <ScrollViewStyleReset />
      </head>

      <body>
        {children}
      </body>
    </html>
  );
}