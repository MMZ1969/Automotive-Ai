import { useState } from "react";
import { Dimensions, FlatList, Image, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

const { width, height } = Dimensions.get("window");

type ImageLightboxProps = {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
};

/**
 * Fullscreen photo viewer — tap an image anywhere in the app to open it
 * here. Pinch-to-zoom uses ScrollView's built-in minimumZoomScale /
 * maximumZoomScale (no extra library needed). Swipe left/right between
 * photos when a post has more than one.
 */
export default function ImageLightbox({ visible, images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  if (!images || images.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "black" }}>
        <FlatList
          data={images}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setActiveIndex(index);
          }}
          renderItem={({ item }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: item }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
            </ScrollView>
          )}
        />

        {/* CLOSE BUTTON */}
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: "absolute", top: 56, right: 20,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center", alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>✕</Text>
        </TouchableOpacity>

        {/* PAGE COUNTER — only shown when there's more than one photo */}
        {images.length > 1 && (
          <View style={{
            position: "absolute", top: 56, alignSelf: "center",
            backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
          }}>
            <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>
              {activeIndex + 1} / {images.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
