import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
  const [postCount, setPostCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [repPoints, setRepPoints] = useState(0);
  const [activeTab, setActiveTab] = useState<"forYou" | "following">("forYou");

  const fetchPosts = async (tab = activeTab) => {
    try {
      const [postsRes, followRes, meRes] = await Promise.all([
  tab === "forYou"
    ? api.get("/api/posts")
    : api.get("/api/posts/following"),
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
      const allPostsRes = await api.get("/api/posts");
      const myPosts = allPostsRes.data.filter((p: any) => p.userId === user?.id);
      setPostCount(myPosts.length);
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
      fetchPosts(activeTab);
    }, [activeTab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts(activeTab);
  };

  const handleTabChange = (tab: "forYou" | "following") => {
    setActiveTab(tab);
    setLoading(true);
    fetchPosts(tab);
  };

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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>

      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
      }}>
        <Text style={{ color: "#9ca3af", fontSize: 13 }}>Welcome back 👋</Text>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginTop: 2 }}>
          {user?.name || "Driver"}
        </Text>
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

        {/* FEED TABS */}
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
            }}>
              For You
            </Text>
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
            }}>
              Following
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#345bff"
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🔧</Text>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 16 }}>
              {activeTab === "following" ? "No posts yet" : "No posts yet"}
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
            {/* POST HEADER */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
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

              {/* FOLLOW BUTTON */}
              {item.user?.id !== user?.id && (
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
              )}

              <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: 8 }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>

            {/* POST CONTENT */}
            <Text style={{ color: "#e5e7eb", fontSize: 15, lineHeight: 22 }}>
              {item.content}
            </Text>

            {/* POST IMAGE */}
            {item.imageUrl && (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: "100%", height: 200, borderRadius: 12, marginTop: 12 }}
                resizeMode="cover"
              />
            )}

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