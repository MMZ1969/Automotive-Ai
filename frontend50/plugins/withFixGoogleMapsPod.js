const { withPodfile } = require("expo/config-plugins");

/**
 * Two problems, one fix, both in the Podfile line Expo's built-in Google Maps
 * config plugin injects (triggered automatically by ios.config.googleMapsApiKey
 * in app.config.js):
 *
 *   pod 'react-native-google-maps', path: ...
 *
 * 1. Stale pod name. Current react-native-maps versions publish their podspec
 *    as `react-native-maps` (s.name = "react-native-maps"), not
 *    `react-native-google-maps`, so CocoaPods fails outright with:
 *
 *      [!] No podspec found for `react-native-google-maps` in
 *      `node_modules/react-native-maps`
 *
 * 2. Missing subspec. react-native-maps.podspec declares:
 *
 *      s.default_subspec = 'Maps'
 *
 *    ...and only the 'Google' subspec pulls in the actual GoogleMaps /
 *    Google-Maps-iOS-Utils native SDKs and defines HAVE_GOOGLE_MAPS=1, which
 *    is what makes the PROVIDER_GOOGLE code path exist at all on iOS. Neither
 *    React Native's own autolinking nor Expo's injected line ever requests
 *    `:subspecs => ['Google']`, so without this fix the Google rendering path
 *    is never compiled in — MapView renders as a blank view (no crash, no
 *    JS error) whenever provider={PROVIDER_GOOGLE} is used on iOS.
 *
 * react-native-maps already autolinks itself correctly via React Native's
 * standard autolinking (confirmed in build logs), so this injected pod line
 * is redundant for basic linking — we just correct its name and add the
 * subspec CocoaPods needs. Runs as a project-level config plugin (registered
 * last in app.config.js's `plugins` array) so it patches the Podfile content
 * after Expo's own mod has already written it.
 *
 * Safe to remove once @expo/config-plugins ships a fix upstream for both the
 * react-native-maps pod rename and the missing Google subspec.
 */
function withFixGoogleMapsPod(config) {
  return withPodfile(config, (config) => {
    const before = config.modResults.contents;
    const matchCount = (before.match(/pod 'react-native-google-maps', path:/g) || []).length;
    const after = before.replace(
      /pod 'react-native-google-maps', path:/g,
      "pod 'react-native-maps', :subspecs => ['Google'], path:"
    );
    console.log(
      `[withFixGoogleMapsPod] regex matched ${matchCount} occurrence(s) in Podfile.`
    );
    if (matchCount === 0) {
      const hasPlainMapsLine = /pod 'react-native-maps'/.test(before);
      console.log(
        `[withFixGoogleMapsPod] WARNING: no match — Google subspec was NOT injected. ` +
        `Plain 'react-native-maps' pod line present: ${hasPlainMapsLine}.`
      );
      // Dump every line mentioning react-native-maps so we can see the exact
      // text Expo's config-plugins actually generated this time.
      const relevantLines = before
        .split("\n")
        .filter((line) => line.includes("react-native-maps") || line.includes("react-native-google-maps"));
      console.log(
        `[withFixGoogleMapsPod] Podfile lines mentioning react-native-maps:\n${relevantLines.join("\n")}`
      );
    } else {
      console.log(`[withFixGoogleMapsPod] Patched line now reads: pod 'react-native-maps', :subspecs => ['Google'], path: ...`);
    }
    config.modResults.contents = after;
    return config;
  });
}

module.exports = withFixGoogleMapsPod;
