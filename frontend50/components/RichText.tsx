import { Linking, Text } from "react-native";

type RichTextProps = {
  text: string;
  colors: any;
  // Style for the wrapping text block (font size, color, line height, margins, etc.)
  baseStyle?: any;
  // If provided, #hashtags become tappable and call this with the tag (e.g. "#brakes").
  // If omitted, hashtags still render highlighted but aren't tappable.
  onHashtagPress?: (tag: string) => void;
};

/**
 * Renders post/comment text with:
 *   - tappable URLs  (https://, http://, or www.)  → opens in browser / app
 *   - tappable #hashtags → calls onHashtagPress(tag)
 *   - everything else as normal text
 *
 * Used in both the feed and the post-detail screen so behavior stays identical.
 */
export default function RichText({ text, colors, baseStyle, onHashtagPress }: RichTextProps) {
  if (!text) return null;

  // Split while KEEPING the matches: links and hashtags become their own pieces.
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+|#\w+)/g);

  const openLink = (raw: string) => {
    // www. links need a scheme prepended or they won't open
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (!part) return null;

        // ── URL ──
        if (/^https?:\/\//.test(part) || /^www\./.test(part)) {
          return (
            <Text
              key={i}
              style={{ color: colors.blue, textDecorationLine: "underline" }}
              onPress={() => openLink(part)}
            >
              {part}
            </Text>
          );
        }

        // ── Hashtag ──
        if (part.startsWith("#")) {
          return (
            <Text
              key={i}
              style={{ color: colors.blue, fontWeight: "600" }}
              onPress={onHashtagPress ? () => onHashtagPress(part) : undefined}
            >
              {part}
            </Text>
          );
        }

        // ── Plain text ──
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}
