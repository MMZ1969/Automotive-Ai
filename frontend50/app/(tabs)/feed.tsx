import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Feed() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [repPoints, setRepPoints] = useState(0);
  const [activeTab, setActiveTab] = useState<"forYou" | "following">("forYou");
  const [postFilter, setPostFilter] = useState<"ALL" | "VANITY" | "QUESTION" | "SERVICE">("ALL");
  const [menuPost, setMenuPost] = useState<any>(null);

  const fetchPosts = async (tab = activeTab, filter = postFilter) => {
    try {
      const [postsRes, followRes, meRes] = await Promise.all([
        tab === "forYou"
          ? api.get("/api/posts", { params: { type: filter } })
          : api.get("/api/posts/following", { params: { type: filter } }),
        api.get(`/api/users/${user?.id}/follow-status`),
        api.get("/api/users/me"),
      ]);

      const postsWithFollow = await Promise.all(
        postsRes.data.map(async (post: any) => {
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
      setFollowerCount(followRes.data.followerCount || 0);
      setFollowingCount(followRes.data.followingCount || 0);
      setRepPoints(meRes.data.repPoints || 0);
    } catch (err) {
      console.error("FEED ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPosts(activeTab, postFilter);
    }, [activeTab, postFilter])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts(activeTab, postFilter);
  };

  const handleTabChange = (tab: "forYou" | "following") => {
    setActiveTab(tab);
    setLoading(true);
    fetchPosts(tab, postFilter);
  };

  const handleFilterChange = (filter: "ALL" | "VANITY" | "QUESTION" | "SERVICE") => {
    setPostFilter(filter);
    setLoading(true);
    fetchPosts(activeTab, filter);
  };

  const handleLike = async (postId: number) => {
    try {
      await api.post(`/api/posts/${postId}/like`);
      fetchPosts(activeTab, postFilter);
    } catch (err) {
      console.error("LIKE ERROR:", err);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/api/users/${userId}/follow`);
      fetchPosts(activeTab, postFilter);
    } catch (err) {
      console.error("FOLLOW ERROR:", err);
    }
  };

  const handleDeletePost = async (postId: number) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/posts/${postId}`);
            setMenuPost(null);
            fetchPosts(activeTab, postFilter);
          } catch (err) {
            console.error("DELETE ERROR:", err);
          }
        },
      },
    ]);
  };

  const handleReportPost = async (postId: number) => {
    Alert.alert(
      "Report Post",
      "Why are you reporting this post?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Spam", onPress: async () => await submitReport(postId, "Spam") },
        { text: "Inappropriate", onPress: async () => await submitReport(postId, "Inappropriate content") },
        { text: "Abusive", onPress: async () => await submitReport(postId, "Abusive behavior") },
      ]
    );
  };

  const submitReport = async (postId: number, reason: string) => {
    try {
      await api.post(`/api/posts/${postId}/report`, { reason });
      setMenuPost(null);
      Alert.alert("✅ Reported", "Thank you. We'll review this post within 24 hours.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        Alert.alert("Already Reported", "You've already reported this post.");
      } else {
        Alert.alert("Error", "Could not submit report. Try again.");
      }
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>

      {/* POST MENU MODAL */}
      <Modal
        visible={!!menuPost}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPost(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}
          onPress={() => setMenuPost(null)}
        >
          <View style={{
            backgroundColor: "#11131a",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            gap: 12,
          }}>
            {menuPost?.userId === user?.id ? (
              <TouchableOpacity
                onPress={() => handleDeletePost(menuPost.id)}
                style={{
                  backgroundColor: "#b91c1c",
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                  🗑️ Delete Post
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleReportPost(menuPost.id)}
                style={{
                  backgroundColor: "#1f2937",
                  padding: 16,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#ef4444",
                }}
              >
                <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 16 }}>
                  🚩 Report Post
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setMenuPost(null)}
              style={{
                backgroundColor: "#252838",
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: "#9ca3af", fontSize: 13 }}>Welcome back 👋</Text>
            <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginTop: 2 }}>
              {user?.name || "Driver"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/search")}
            style={{
              backgroundColor: "#11131a",
              borderWidth: 1,
              borderColor: "#252838",
              borderRadius: 12,
              padding: 10,
            }}
          >
            <Text style={{ fontSize: 20 }}>🔍</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={statPill}>
            <Text style={{ color: "#9ca3af", fontSize: 11 }}>Rep</Text>
            <Text style={{ color: "white", fontWeight: "700" }}>{repPoints}</Text>
          </View>
          <View style={statPill}>
            <Text style={{ color: "#9ca3af", fontSize: 11 }}>Followers</Text>
            <Text style={{ color: "white", fontWeight: "700" }}>{followerCount}</Text>
          </View>
          <View style={statPill}>
            <Text style={{ color: "#9ca3af", fontSize: 11 }}>Following</Text>
            <Text style={{ color: "white", fontWeight: "700" }}>{followingCount}</Text>
          </View>
        </View>

        {/* FOR YOU / FOLLOWING TABS */}
        <View style={{
          flexDirection: "row",
          marginTop: 16,
          backgroundColor: "#11131a",
          borderRadius: 12,
          padding: 4,
        }}>
          <TouchableOpacity
            onPress={() => handleTabChange("forYou")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: activeTab === "forYou" ? "#345bff" : "transparent",
            }}
          >
            <Text style={{
              color: activeTab === "forYou" ? "white" : "#6b7280",
              fontWeight: "700",
              fontSize: 14,
            }}>For You</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleTabChange("following")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: activeTab === "following" ? "#345bff" : "transparent",
            }}
          >
            <Text style={{
              color: activeTab === "following" ? "white" : "#6b7280",
              fontWeight: "700",
              fontSize: 14,
            }}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* POST TYPE FILTER */}
        <View style={{
          flexDirection: "row",
          marginTop: 10,
          gap: 8,
        }}>
          {[
            { label: "All", value: "ALL" },
            { label: "🚗 Vanity", value: "VANITY" },
            { label: "🔧 Questions", value: "QUESTION" },
            { label: "🏁 Services", value: "SERVICE" },
          ].map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => handleFilterChange(f.value as "ALL" | "VANITY" | "QUESTION")}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: postFilter === f.value ? "#1e2a4a" : "#11131a",
                borderWidth: 1,
                borderColor: postFilter === f.value ? "#345bff" : "#252838",
              }}
            >
              <Text style={{
                color: postFilter === f.value ? "#345bff" : "#6b7280",
                fontSize: 13,
                fontWeight: "600",
              }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🔧</Text>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 16 }}>
              No posts yet
            </Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
              {activeTab === "following"
                ? "Follow some people to see their posts here!"
                : "Be the first to share a build or ask a question!"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: "#11131a",
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#252838",
            padding: 16,
          }}>
            {/* POST TYPE BADGE */}
          <View style={{
            alignSelf: "flex-start",
            backgroundColor: item.postType === "QUESTION" ? "#1e3a8a" : item.postType === "SERVICE" ? "#78350f" : "#064e3b",
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 10,
            marginBottom: 10,
       }}>
            <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
             {item.postType === "QUESTION" ? "🔧 Question" : item.postType === "SERVICE" ? "🏁 Service" : "🚗 Vanity"}
            </Text>
          </View>

            {/* POST HEADER */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/user/${item.user?.id}`)}
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#1f2937",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: item.user?.role === "MECHANIC" ? "#345bff" : "#10b981",
                  overflow: "hidden",
                  marginRight: 12,
                }}>
                  {item.user?.profilePhoto ? (
                    <Image
                      source={{ uri: item.user.profilePhoto }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
                      {item.user?.name?.[0]?.toUpperCase() || "?"}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                    {item.user?.name || "Anonymous"}
                  </Text>
                  <View style={{
                    backgroundColor: item.user?.role === "MECHANIC" ? "#1e3a8a" : "#064e3b",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    alignSelf: "flex-start",
                    marginTop: 3,
                  }}>
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
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}>
              {item.user?.id !== user?.id ? (
                <TouchableOpacity
                  onPress={() => handleFollow(item.user?.id)}
                  style={{
                    backgroundColor: item.isFollowing ? "#1f2937" : "#345bff",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: item.isFollowing ? "#252838" : "#345bff",
                  }}
                >
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
                    {item.isFollowing ? "Following" : "Follow"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <Text style={{ color: "#6b7280", fontSize: 12 }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>

            {/* SERVICE DETAILS */}
{item.postType === "SERVICE" && (item.serviceLocation || item.servicePrice) && (
  <View style={{
    backgroundColor: "#1a1200",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f59e0b33",
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  }}>
    {item.serviceLocation && (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 14 }}>📍</Text>
        <Text style={{ color: "#fcd34d", fontSize: 13, fontWeight: "600" }}>
          {item.serviceLocation}
        </Text>
      </View>
    )}
    {item.servicePrice && (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 14 }}>💰</Text>
        <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "700" }}>
          {item.servicePrice}
        </Text>
      </View>
    )}
  </View>
)}
            {/* POST CONTENT + IMAGE */}
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/post/${item.id}`)}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#e5e7eb", fontSize: 15, lineHeight: 22 }}>
                {item.content}
              </Text>
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: "100%", height: 200, borderRadius: 12, marginTop: 12 }}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>

            {/* ACTIONS */}
            <View style={{
              flexDirection: "row",
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: "#252838",
              gap: 20,
            }}>
              <TouchableOpacity
                onPress={() => handleLike(item.id)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={{ fontSize: 18 }}>
                  {item.likes?.some((l: any) => l.userId === user?.id) ? "❤️" : "🤍"}
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 14 }}>
                  {item.likes?.length || 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/post/${item.id}`)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={{ fontSize: 18 }}>💬</Text>
                <Text style={{ color: "#9ca3af", fontSize: 14 }}>
                  {item.comments?.length || 0}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* FLOATING POST BUTTON */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/create")}
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          backgroundColor: "#345bff",
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#345bff",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text style={{ color: "white", fontSize: 28, fontWeight: "300", marginTop: -2 }}>➕</Text>
      </TouchableOpacity>

    </View>
  );
}

const statPill = {
  backgroundColor: "#11131a",
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "#252838",
  alignItems: "center" as const,
};