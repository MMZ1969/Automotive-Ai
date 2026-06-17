import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

const logo = require("../../assets/autoai_icon_1024_tm.png");

const MAIN_TABS = ["forYou", "following"] as const;
type MainTab = typeof MAIN_TABS[number];

const FILTERS = [
  { key: "ALL",          label: "All Posts",   icon: "🌐" },
  { key: "VANITY",       label: "Vanity",       icon: "🚗" },
  { key: "QUESTION",     label: "Q&A",          icon: "🔧" },
  { key: "SERVICE",      label: "Service",      icon: "🏁" },
  { key: "BEFORE_AFTER", label: "Before/After", icon: "📸" },
  { key: "CAR_SHOW",     label: "Car Shows",    icon: "🎪" },
  { key: "NEAR_ME",      label: "Near Me",      icon: "📍" },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

function HashtagText({ text, colors, onHashtagPress }: { text: string; colors: any; onHashtagPress: (tag: string) => void }) {
  const parts = text.split(/(#\w+)/g);
  return (
    <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <Text key={i} style={{ color: colors.blue, fontWeight: "600" }} onPress={() => onHashtagPress(part)}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

export default function Feed() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const { hashtag } = useLocalSearchParams<{ hashtag?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("forYou");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [menuPost, setMenuPost] = useState<any>(null);

  const fetchPosts = async (tab: MainTab = activeTab, filter: FilterKey = activeFilter) => {
    if (filter === "NEAR_ME") {
      router.push("/(tabs)/near-me");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const endpoint = tab === "following" ? "/api/posts/following" : "/api/posts";
      const params: any = filter === "ALL" ? {} : { type: filter };
      if (hashtag) params.search = hashtag;
      const res = await api.get(endpoint, { params });
      const postsWithFollow = await Promise.all(
        res.data.map(async (post: any) => {
          if (post.user?.id === user?.id) return { ...post, isFollowing: false };
          try {
            const fr = await api.get(`/api/users/${post.user?.id}/follow-status`);
            return { ...post, isFollowing: fr.data.following };
          } catch { return { ...post, isFollowing: false }; }
        })
      );
      setPosts(postsWithFollow);
    } catch (err) {
      console.error("FEED ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchPosts(activeTab, activeFilter);
    api.get("/api/users/suggestions").then(res => setSuggestions(res.data)).catch(() => {});
  }, [activeTab, activeFilter]));
  const onRefresh = () => { setRefreshing(true); fetchPosts(activeTab, activeFilter); };

  const handleTabChange = (tab: MainTab) => {
    setActiveTab(tab);
    setActiveFilter("ALL");
    setLoading(true);
    fetchPosts(tab, "ALL");
  };

  const handleFilterSelect = (filter: FilterKey) => {
    setFilterModalVisible(false);
    if (filter === "NEAR_ME") { router.push("/(tabs)/near-me"); return; }
    if (filter === "CAR_SHOW") { router.push("/(tabs)/car-show"); return; }
    setActiveFilter(filter);
    setLoading(true);
    fetchPosts(activeTab, filter);
  };

  const handleLike = async (postId: number) => {
    try { await api.post(`/api/posts/${postId}/like`); fetchPosts(activeTab, activeFilter); }
    catch (err) { console.error("LIKE ERROR:", err); }
  };

  const handleFollow = async (userId: number) => {
    try { await api.post(`/api/users/${userId}/follow`); fetchPosts(activeTab, activeFilter); }
    catch (err) { console.error("FOLLOW ERROR:", err); }
  };

  const handleDeletePost = async (postId: number) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.delete(`/api/posts/${postId}`); setMenuPost(null); fetchPosts(activeTab, activeFilter); }
        catch (err) { console.error("DELETE ERROR:", err); }
      }},
    ]);
  };

  const handleReportPost = async (postId: number) => {
    Alert.alert("Report Post", "Why are you reporting this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Spam", onPress: () => submitReport(postId, "Spam") },
      { text: "Inappropriate", onPress: () => submitReport(postId, "Inappropriate content") },
      { text: "Abusive", onPress: () => submitReport(postId, "Abusive behavior") },
    ]);
  };

  const handlePinPost = async (postId: number) => {
    try { await api.post(`/api/posts/${postId}/pin`); setMenuPost(null); fetchPosts(activeTab, activeFilter); }
    catch (err) { Alert.alert("Error", "Could not pin post. Try again."); }
  };

  const submitReport = async (postId: number, reason: string) => {
    try {
      await api.post(`/api/posts/${postId}/report`, { reason });
      setMenuPost(null);
      Alert.alert("✅ Reported", "Thank you. We'll review this post within 24 hours.");
    } catch (err: any) {
      Alert.alert(
        err?.response?.status === 400 ? "Already Reported" : "Error",
        err?.response?.status === 400 ? "You've already reported this post." : "Could not submit report. Try again."
      );
    }
  };

  const filterActive = activeFilter !== "ALL";
  const wheelColor = filterActive ? "white" : colors.textMuted;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* POST MENU MODAL */}
      <Modal visible={!!menuPost} transparent animationType="fade" onRequestClose={() => setMenuPost(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }} onPress={() => setMenuPost(null)}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
            {user?.id === 1 && (
              <TouchableOpacity onPress={() => handlePinPost(menuPost?.id)} style={{ backgroundColor: colors.background, padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: colors.blue }}>
                <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 16 }}>{menuPost?.pinned ? "📌 Unpin Post" : "📌 Pin Post"}</Text>
              </TouchableOpacity>
            )}
            {menuPost?.userId === user?.id ? (
              <TouchableOpacity onPress={() => handleDeletePost(menuPost.id)} style={{ backgroundColor: "#b91c1c", padding: 16, borderRadius: 12, alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>🗑️ Delete Post</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => handleReportPost(menuPost.id)} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#ef4444" }}>
                <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 16 }}>🚩 Report Post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMenuPost(null)} style={{ backgroundColor: colors.border, padding: 16, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FILTER BOTTOM SHEET */}
      <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000088" }} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 }}>
          <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 16 }}>Filter Posts</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => handleFilterSelect(f.key)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 8,
                    paddingHorizontal: 16, paddingVertical: 14,
                    borderRadius: 14, borderWidth: 1.5,
                    backgroundColor: isActive ? colors.blue : colors.background,
                    borderColor: isActive ? colors.blue : colors.border,
                    width: "47%",
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                  <Text style={{ color: isActive ? "white" : colors.text, fontWeight: isActive ? "700" : "500", fontSize: 14 }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Image source={logo} style={{ width: 40, height: 40, borderRadius: 10 }} resizeMode="contain" />
            <View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900", letterSpacing: 0.5 }}>AutoAI</Text>
              <Text style={{ color: colors.blue, fontSize: 10, fontWeight: "600", letterSpacing: 1.5 }}>AUTOMOTIVE INTELLIGENCE</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/search")} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10 }}>
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* FOR YOU — STEERING WHEEL — FOLLOWING */}
        <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border }}>

          {/* FOR YOU */}
          <TouchableOpacity
            onPress={() => handleTabChange("forYou")}
            style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: activeTab === "forYou" ? colors.blue : "transparent" }}
          >
            <Text style={{ color: activeTab === "forYou" ? colors.text : colors.textMuted, fontSize: 14, fontWeight: activeTab === "forYou" ? "700" : "400" }}>
              For You
            </Text>
          </TouchableOpacity>

          {/* STEERING WHEEL CENTER */}
<TouchableOpacity
  onPress={() => setFilterModalVisible(true)}
  style={{
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    paddingHorizontal: 8,
  }}
>
  <View style={{
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: filterActive ? colors.blue : colors.card,
    borderWidth: 1.5,
    borderColor: filterActive ? colors.blue : colors.border,
    justifyContent: "center", alignItems: "center",
  }}>
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {/* Outer ring */}
      <Circle cx="12" cy="12" r="10" stroke={wheelColor} strokeWidth="1.8" fill="none" />
      {/* Inner hub */}
      <Circle cx="12" cy="12" r="2.8" stroke={wheelColor} strokeWidth="1.8" fill="none" />
      {/* 3 spokes only - top, bottom-left, bottom-right */}
      <Line x1="12" y1="2" x2="12" y2="9.2" stroke={wheelColor} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="3.68" y1="17" x2="9.74" y2="13.5" stroke={wheelColor} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="20.32" y1="17" x2="14.26" y2="13.5" stroke={wheelColor} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  </View>
  <Text style={{ color: filterActive ? colors.blue : colors.textMuted, fontSize: 9, fontWeight: "600", marginTop: 2, letterSpacing: 0.5 }}>
    {filterActive ? "ON" : "FILTER"}
  </Text>
</TouchableOpacity>

          {/* FOLLOWING */}
          <TouchableOpacity
            onPress={() => handleTabChange("following")}
            style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: activeTab === "following" ? colors.blue : "transparent" }}
          >
            <Text style={{ color: activeTab === "following" ? colors.text : colors.textMuted, fontSize: 14, fontWeight: activeTab === "following" ? "700" : "400" }}>
              Following
            </Text>
          </TouchableOpacity>

        </View>
      </View>

      {/* POSTS LIST */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        ListHeaderComponent={(
          <View>
            {hashtag && (
              <View style={{ backgroundColor: colors.blue + "22", borderBottomWidth: 1, borderBottomColor: colors.blue + "44", padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 15 }}>{hashtag}</Text>
                <TouchableOpacity onPress={() => router.replace("/(tabs)/feed")}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>✕ Clear</Text>
                </TouchableOpacity>
              </View>
            )}
            {!hashtag && suggestions.length > 0 && (
              <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1, paddingHorizontal: 16, marginBottom: 10 }}>
                  PEOPLE YOU MAY KNOW
                </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {suggestions.map((s: any) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => router.push(`/(tabs)/user/${s.id}`)}
                  style={{ alignItems: "center", width: 72 }}
                >
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: s.role === "MECHANIC" ? colors.blue : colors.green, marginBottom: 6 }}>
                    {s.profilePhoto ? (
                      <Image source={{ uri: s.profilePhoto }} style={{ width: 52, height: 52 }} />
                    ) : (
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{s.name?.[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>{s.name}</Text>
                  <Text style={{ color: s.role === "MECHANIC" ? colors.blue : colors.green, fontSize: 10, marginTop: 1 }}>
                    {s.role === "MECHANIC" ? "🔧 Mechanic" : "🚗 DIYer"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🔧</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>No posts yet</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
              {activeTab === "following" ? "Follow some people to see their posts here!" : "Be the first to share a build or ask a question!"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: colors.card, marginHorizontal: 16, marginTop: 16,
            borderRadius: 16, borderWidth: 1,
            borderColor: item.pinned ? colors.blue : colors.border, padding: 16,
          }}>
            {item.pinned && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Text style={{ fontSize: 13 }}>📌</Text>
                <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>PINNED POST</Text>
              </View>
            )}

            <View style={{
              alignSelf: "flex-start",
              backgroundColor: item.postType === "QUESTION" ? "#1e3a8a" : item.postType === "SERVICE" ? "#78350f" : item.postType === "BEFORE_AFTER" ? "#991b1b" : "#5b21b6",
              paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 10,
            }}>
              <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
                {item.postType === "QUESTION" ? "🔧 Question" : item.postType === "SERVICE" ? "🏁 Service" : item.postType === "BEFORE_AFTER" ? "📸 Before/After" : "🚗 Vanity"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${item.user?.id}`)} style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border,
                  justifyContent: "center", alignItems: "center", borderWidth: 2,
                  borderColor: item.user?.role === "MECHANIC" ? colors.blue : colors.green,
                  overflow: "hidden", marginRight: 12,
                }}>
                  {item.user?.profilePhoto ? (
                    <Image source={{ uri: item.user.profilePhoto }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>{item.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                  )}
                </View>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{item.user?.name || "Anonymous"}</Text>
                  {item.user?.role === "MECHANIC" && item.user?.isVerified ? (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "#60a5fa", shadowColor: colors.blue, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4, backgroundColor: "#1e3a8a" }}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>🏁 Verified Mechanic</Text>
                    </View>
                  ) : (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: item.user?.role === "MECHANIC" ? "#1e3a8a" : "#064e3b", borderWidth: 1, borderColor: item.user?.role === "MECHANIC" ? colors.blue : colors.green }}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
                        {item.user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMenuPost(item)} style={{ padding: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 20 }}>⋯</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              {item.user?.id !== user?.id ? (
                <TouchableOpacity
                  onPress={() => handleFollow(item.user?.id)}
                  style={{ backgroundColor: item.isFollowing ? colors.card : colors.blue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: item.isFollowing ? colors.border : colors.blue }}
                >
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{item.isFollowing ? "Following" : "Follow"}</Text>
                </TouchableOpacity>
              ) : <View />}
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>

            {item.postType === "SERVICE" && (item.serviceLocation || item.servicePrice) && (
              <View style={{ backgroundColor: "#1a1200", borderRadius: 10, borderWidth: 1, borderColor: "#f59e0b33", padding: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                {item.serviceLocation && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>📍</Text>
                    <Text style={{ color: "#fcd34d", fontSize: 13, fontWeight: "600" }}>{item.serviceLocation}</Text>
                  </View>
                )}
                {item.servicePrice && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>💰</Text>
                    <Text style={{ color: colors.green, fontSize: 13, fontWeight: "700" }}>{item.servicePrice}</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity onPress={() => router.push(`/(tabs)/post/${item.id}`)} activeOpacity={0.8}>
              <HashtagText
                text={item.content}
                colors={colors}
                onHashtagPress={(tag) => router.push({ pathname: "/(tabs)/feed", params: { hashtag: tag } })}
              />
              {item.imageUrls?.length > 1 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 12 }}>
                  {item.imageUrls.map((url: string, index: number) => (
                    <Image
                      key={index}
                      source={{ uri: url }}
                      style={{
                        width: item.imageUrls.length === 2 ? "49%" : item.imageUrls.length === 3 && index === 0 ? "100%" : "49%",
                        height: item.imageUrls.length === 2 ? 160 : item.imageUrls.length === 3 && index === 0 ? 200 : 160,
                        borderRadius: 10,
                      }}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              ) : item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 200, borderRadius: 12, marginTop: 12 }} resizeMode="cover" />
              ) : null}
              {item.postType === "BEFORE_AFTER" && item.beforeImageUrl && item.afterImageUrl && (
                <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
                  <View style={{ flex: 1, borderRadius: 10, overflow: "hidden" }}>
                    <Image source={{ uri: item.beforeImageUrl }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(220,38,38,0.7)", padding: 5, alignItems: "center" }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>BEFORE</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, borderRadius: 10, overflow: "hidden" }}>
                    <Image source={{ uri: item.afterImageUrl }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(16,185,129,0.7)", padding: 5, alignItems: "center" }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>AFTER</Text>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: "row", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 20 }}>
              <TouchableOpacity onPress={() => handleLike(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 18 }}>{item.likes?.some((l: any) => l.userId === user?.id) ? "❤️" : "🤍"}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{item.likes?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/(tabs)/post/${item.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 18 }}>💬</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{item.comments?.length || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* FLOATING POST BUTTON */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/create")}
        style={{ position: "absolute", bottom: 24, right: 24, backgroundColor: colors.blue, width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 8 }}
      >
        <Text style={{ color: "white", fontSize: 28, fontWeight: "300", marginTop: -2 }}>➕</Text>
      </TouchableOpacity>

    </View>
  );
}