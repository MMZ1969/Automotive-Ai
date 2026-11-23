const { withAndroidManifest } = require("expo/config-plugins");

/**
 * orientation: "portrait" makes Android's build add
 *
 *   <uses-feature android:name="android.hardware.screen.portrait" />
 *
 * which defaults to required="true". Play then hides the app from devices that
 * can't run in portrait (some Chromebooks, desktop/XR, fixed-landscape tablets)
 * and flags it on every release ("Required hardware feature declarations are
 * restricting your app's availability", first seen on 1.0.30).
 *
 * This marks the feature required="false". The app stays locked to portrait;
 * Play just stops filtering devices on it. tools:replace wins over any merged
 * library manifest that declares the same feature as required.
 */
const FEATURE = "android.hardware.screen.portrait";

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";

    const features = (manifest["uses-feature"] = manifest["uses-feature"] || []);
    let entry = features.find((f) => f.$ && f.$["android:name"] === FEATURE);
    if (!entry) {
      entry = { $: { "android:name": FEATURE } };
      features.push(entry);
    }
    entry.$["android:required"] = "false";
    entry.$["tools:replace"] = "android:required";
    return cfg;
  });
};
