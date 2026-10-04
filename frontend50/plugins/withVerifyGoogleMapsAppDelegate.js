const { withAppDelegate } = require("expo/config-plugins");

/**
 * DIAGNOSTIC PLUGIN — temporary.
 *
 * Expo's built-in Google Maps config plugin (triggered by ios.config.googleMapsApiKey
 * in app.config.js) is supposed to do two things natively on iOS:
 *
 *   1. Patch the Podfile so CocoaPods links the GoogleMaps / Google-Maps-iOS-Utils
 *      SDKs (confirmed working — see withFixGoogleMapsPod.js).
 *   2. Insert `GMSServices.provideAPIKey("...")` into AppDelegate.swift, right next
 *      to `super.application(_:didFinishLaunchingWithOptions:)`, via a regex anchor
 *      match. This is what actually *activates* the Google Maps SDK at runtime —
 *      without it, GoogleMaps is linked and compiled in, but never authenticated,
 *      so MapView renders as a plain black view with zero tiles/branding and no
 *      error of any kind (exactly our symptom).
 *
 * React Native 0.86 (shipped with Expo SDK 57) changed AppDelegate's generated
 * structure for bridgeless-mode support. If that changed the shape of the
 * `didFinishLaunchingWithOptions` method, Expo's regex anchor can silently fail
 * to match — no error, no warning, it just doesn't insert the line.
 *
 * This plugin runs last and throws unconditionally, dumping the final
 * AppDelegate.swift contents into the (otherwise-collapsed) EAS build log so we
 * can see directly whether GMSServices.provideAPIKey is present, and if not, what
 * the actual method signature looks like so we can hand-write a working anchor.
 *
 * REMOVE after diagnosis — this always fails the build on purpose.
 */
function withVerifyGoogleMapsAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    const contents = config.modResults.contents;
    const found = contents.includes("GMSServices.provideAPIKey");
    throw new Error(
      `[withVerifyGoogleMapsAppDelegate] GMSServices.provideAPIKey ${found ? "FOUND" : "NOT FOUND"} in AppDelegate.\n` +
      `----- AppDelegate.swift contents -----\n${contents}\n----- end AppDelegate.swift -----`
    );
  });
}

module.exports = withVerifyGoogleMapsAppDelegate;
