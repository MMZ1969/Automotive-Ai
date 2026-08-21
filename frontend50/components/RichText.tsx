import { Image, Linking, Text, TouchableOpacity, View } from "react-native";

type RichTextProps = {
  text: string;
  colors: any;
  // Style for the wrapping text block (font size, color, line height, margins, etc.)
  baseStyle?: any;
  // If provided, #hashtags become tappable and call this with the tag (e.g. "#brakes").
  // If omitted, hashtags still render highlighted but aren't tappable.
  onHashtagPress?: (tag: string) => void;
};

// Matches youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID,
// and m.youtube.com variants — captures the 11-char video ID.
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function getYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

function YouTubePreviewCard({ videoId, colors }: { videoId: string; colors: any }) {
  // Public thumbnail URL — no API key needed, works for any public video.
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const openVideo = () => {
    Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`).catch(() => {});
  };

  return (
    <TouchableOpacity
      onPress={openVideo}
      activeOpacity={0.85}
      style={{
        marginTop: 8, marginBottom: 4, borderRadius: 12, overflow: "hidden",
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
      }}
    >
      <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}>
        <Image source={{ uri: thumbnailUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: "center", alignItems: "center",
        }}>
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center", alignItems: "center",
          }}>
            <Text style={{ color: "white", fontSize: 22, marginLeft: 3 }}>▶</Text>
          </View>
        </View>
        <View style={{
          position: "absolute", bottom: 8, left: 8,
          backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
        }}>
          <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>▶ YouTube</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Renders post/comment text with:
 *   - tappable URLs  (https://, http://, or www.)  → opens in browser / app
 *   - YouTube links specifically → rendered as a thumbnail preview card
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

  // Collect YouTube preview cards separately so they render below the
  // text block rather than inline mid-sentence — a thumbnail card
  // doesn't read well sandwiched between words.
  const youtubeCards: string[] = [];

  const textNode = (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (!part) return null;

        // ── URL ──
        if (/^https?:\/\//.test(part) || /^www\./.test(part)) {
          const youtubeId = getYouTubeId(part);
          if (youtubeId) {
            if (!youtubeCards.includes(youtubeId)) youtubeCards.push(youtubeId);
            // Still show the raw link inline as tappable text too, since
            // removing it entirely would look like the link vanished —
            // the preview card below is the primary affordance.
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

  if (youtubeCards.length === 0) return textNode;

  return (
    <View>
      {textNode}
      {youtubeCards.map((videoId) => (
        <YouTubePreviewCard key={videoId} videoId={videoId} colors={colors} />
      ))}
    </View>
  );
}
