import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { getBadge } from "@utils/badges";
import { useFocusEffect, useRouter } from "expo-router";
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
  View,
} from "react-native";

const logo = require("../../assets/autoai_icon_1024_tm.png");

// ─── TAB DEFINITIONS ─────────────────────────────────────────────────────────
const TABS = [
  { key: "forYou",    label: "For You",   feed: "forYou",     filter: "ALL" },
  { key: "following", label: "Following", feed: "following",  filter: "ALL" },
  { key: "vanity",    label: "Vanity",    feed: "forYou",     filter: "VANITY" },
  { key: "qa",        label: "Q&A",       feed: "forYou",     filter: "QUESTION" },
  { key: "service",   label: "Service",   feed: "forYou",     filter: "SERVICE" },
  { key: "beforeAfter", label: "Before/After", feed: "forYou", filter: "BEFORE_AFTER" },
  { key: "nearMe",    label: "📍 Near Me", feed: "nearMe",    filter: "ALL" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function Feed() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("forYou");
  const [menuPost, setMenuPost] = useState<any>(null);

  // ─── FETCH ──────────────────────────────────────────────────────────────────

  const fetchPosts = async (tabKey: TabKey = activeTab) => {
    const tab = TABS.find(t => t.key === tabKey)!;

    // Near Me is handled separately — no fetch needed
    if (tab.feed === "nearMe") {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const endpoint = tab.feed === "following"
        ? "/api/posts/following"
        : "/api/posts";

      const res = await api.get(endpoint, {
        params: { type: tab.filter },
      });

      const postsWithFollow = await Promise.all(
        res.data.map(async (post: any) => {
          if (post.user?.id === user?.id) return { ...post, isFollowing: false };
          try {
            const fr = await api.get(`/api/users/${post.user?.id}/follow-status`);
            return { ...post, isFollowing: fr.data.following };
          } catch {
            return { ...post, isFollowing: false };
          }
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

  useFocusEffect(useCallback(() => { fetchPosts(activeTab); }, [activeTab]));

  const onRefresh = () => { setRefreshing(true); fetchPosts(activeTab); };

  const handleTabChange = (tabKey: TabKey) => {
    if (tabKey === "nearMe") {
      router.push("/(tabs)/near-me");
      return;
    }
    setActiveTab(tabKey);
    setLoading(true);
    fetchPosts(tabKey);
  };

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  const handleLike = async (postId: number) => {
    try {
      await api.post(`/api/posts/${postId}/like`);
      fetchPosts(activeTab);
    } catch (err) {
      console.error("LIKE ERROR:", err);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/api/users/${userId}/follow`);
      fetchPosts(activeTab);
    } catch (err) {
      console.error("FOLLOW ERROR:", err);
    }
  };

  const handleDeletePost = async (postId: number) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/posts/${postId}`);
            setMenuPost(null);
            fetchPosts(activeTab);
          } catch (err) {
            console.error("DELETE ERROR:", err);
          }
        },
      },
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
    try {
      await api.post(`/api/posts/${postId}/pin`);
      setMenuPost(null);
      fetchPosts(activeTab);
    } catch (err) {
      Alert.alert("Error", "Could not pin post. Try again.");
    }
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

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>

      {/* ── POST MENU MODAL ── */}
      <Modal visible={!!menuPost} transparent animationType="fade" onRequestClose={() => setMenuPost(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }} onPress={() => setMenuPost(null)}>
          <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
            {user?.id === 1 && (
              <TouchableOpacity onPress={() => handlePinPost(menuPost?.id)} style={{ backgroundColor: "#1a1a2e", padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#345bff" }}>
                <Text style={{ color: "#345bff", fontWeight: "700", fontSize: 16 }}>{menuPost?.pinned ? "📌 Unpin Post" : "📌 Pin Post"}</Text>
              </TouchableOpacity>
            )}
            {menuPost?.userId === user?.id ? (
              <TouchableOpacity onPress={() => handleDeletePost(menuPost.id)} style={{ backgroundColor: "#b91c1c", padding: 16, borderRadius: 12, alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>🗑️ Delete Post</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => handleReportPost(menuPost.id)} style={{ backgroundColor: "#1f2937", padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#ef4444" }}>
                <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 16 }}>🚩 Report Post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setMenuPost(null)} style={{ backgroundColor: "#252838", padding: 16, borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── HEADER ── */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: "#252838" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
  <Image source={logo} style={{ width: 40, height: 40, borderRadius: 10 }} resizeMode="contain" />
  <View>
    <Text style={{ color: "white", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 }}>AutoAI</Text>
    <Text style={{ color: "#345bff", fontSize: 10, fontWeight: "600", letterSpacing: 1.5 }}>AUTOMOTIVE INTELLIGENCE</Text>
  </View>
</View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/search")}
            style={{ backgroundColor: "#11131a", borderWidth: 1, borderColor: "#252838", borderRadius: 12, padding: 10 }}
          >
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        {/* ── ROW 1: FOR YOU / FOLLOWING ── */}
<View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#252838" }}>
  {(["forYou", "following"] as const).map((key) => {
    const isActive = activeTab === key;
    return (
      <TouchableOpacity
        key={key}
        onPress={() => handleTabChange(key)}
        style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: isActive ? "#345bff" : "transparent" }}
      >
        <Text style={{ color: isActive ? "white" : "#6b7280", fontSize: 14, fontWeight: isActive ? "700" : "400" }}>
          {key === "forYou" ? "For You" : "Following"}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>

        {/* ── ROW 2: POST TYPE FILTERS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
          {(["vanity", "qa", "service", "beforeAfter", "nearMe"] as const).map((key) => {
            const labels: Record<string, string> = { vanity: "Vanity", qa: "Q&A", service: "Service", beforeAfter: "Before/After",  nearMe: "Near Me" };
            const isActive = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleTabChange(key)}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: isActive ? "#345bff" : "transparent" }}
              >
                <Text style={{ color: isActive ? "white" : "#6b7280", fontSize: 14, fontWeight: isActive ? "700" : "400" }}>
                  {labels[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── POSTS LIST ── */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🔧</Text>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 16 }}>No posts yet</Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
              {activeTab === "following" ? "Follow some people to see their posts here!" : "Be the first to share a build or ask a question!"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: "#11131a", marginHorizontal: 16, marginTop: 16,
            borderRadius: 16, borderWidth: 1,
            borderColor: item.pinned ? "#345bff" : "#252838", padding: 16,
          }}>
            {/* PINNED BADGE */}
            {item.pinned && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Text style={{ fontSize: 13 }}>📌</Text>
                <Text style={{ color: "#345bff", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>PINNED POST</Text>
              </View>
            )}

            {/* POST TYPE BADGE */}
            <View style={{
              alignSelf: "flex-start",
              backgroundColor: item.postType === "QUESTION" ? "#1e3a8a" : item.postType === "SERVICE" ? "#78350f" : item.postType === "BEFORE_AFTER" ? "#0f766e" : "#5b21b6",
              paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 10,
            }}>
              <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
                {item.postType === "QUESTION" ? "🔧 Question" : item.postType === "SERVICE" ? "🏁 Service" : item.postType === "BEFORE_AFTER" ? "📸 Before/After" : "🚗 Vanity"}
              </Text>
            </View>


            {/* POST HEADER */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${item.user?.id}`)} style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22, backgroundColor: "#1f2937",
                  justifyContent: "center", alignItems: "center", borderWidth: 2,
                  borderColor: item.user?.role === "MECHANIC" ? "#345bff" : "#10b981",
                  overflow: "hidden", marginRight: 12,
                }}>
                  {item.user?.profilePhoto ? (
                    <Image source={{ uri: item.user.profilePhoto }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>{item.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>{item.user?.name || "Anonymous"}</Text>
                    <View style={{ backgroundColor: getBadge(item.user?.repPoints || 0).color + "22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: getBadge(item.user?.repPoints || 0).color }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: getBadge(item.user?.repPoints || 0).color }}>
                        {getBadge(item.user?.repPoints || 0).emoji} {getBadge(item.user?.repPoints || 0).label}
                      </Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: item.user?.role === "MECHANIC" ? "#1e3a8a" : "#064e3b", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start", marginTop: 3 }}>
                    <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
                      {item.user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMenuPost(item)} style={{ padding: 8 }}>
                <Text style={{ color: "#9ca3af", fontSize: 20 }}>⋯</Text>
              </TouchableOpacity>
            </View>

            {/* FOLLOW BUTTON + DATE */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              {item.user?.id !== user?.id ? (
                <TouchableOpacity
                  onPress={() => handleFollow(item.user?.id)}
                  style={{ backgroundColor: item.isFollowing ? "#1f2937" : "#345bff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: item.isFollowing ? "#252838" : "#345bff" }}
                >
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{item.isFollowing ? "Following" : "Follow"}</Text>
                </TouchableOpacity>
              ) : <View />}
              <Text style={{ color: "#6b7280", fontSize: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>

            {/* SERVICE DETAILS */}
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
                    <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "700" }}>{item.servicePrice}</Text>
                  </View>
                )}
              </View>
            )}

            {/* POST CONTENT + IMAGE */}
              <TouchableOpacity onPress={() => router.push(`/(tabs)/post/${item.id}`)} activeOpacity={0.8}>
                <Text style={{ color: "#e5e7eb", fontSize: 15, lineHeight: 22 }}>{item.content}</Text>
                {item.imageUrl && (
                  <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 200, borderRadius: 12, marginTop: 12 }} resizeMode="cover" />
                )}
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

            {/* ACTIONS */}
            <View style={{ flexDirection: "row", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#252838", gap: 20 }}>
              <TouchableOpacity onPress={() => handleLike(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 18 }}>{item.likes?.some((l: any) => l.userId === user?.id) ? "❤️" : "🤍"}</Text>
                <Text style={{ color: "#9ca3af", fontSize: 14 }}>{item.likes?.length || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/(tabs)/post/${item.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 18 }}>💬</Text>
                <Text style={{ color: "#9ca3af", fontSize: 14 }}>{item.comments?.length || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ── FLOATING POST BUTTON ── */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/create")}
        style={{ position: "absolute", bottom: 24, right: 24, backgroundColor: "#345bff", width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 8 }}
      >
        <Text style={{ color: "white", fontSize: 28, fontWeight: "300", marginTop: -2 }}>➕</Text>
      </TouchableOpacity>

    </View>
  );
}
