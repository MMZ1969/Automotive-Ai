import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useFocusEffect } from "expo-router";
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
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = async () => {
    try {
      const res = await api.get("/api/posts");
      setPosts(res.data);
    } catch (err) {
      console.error("FEED ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const handleLike = async (postId: number) => {
    try {
      await api.post(`/api/posts/${postId}/like`);
      fetchPosts();
    } catch (err) {
      console.error("LIKE ERROR:", err);
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
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
      }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>
          🚗 AutoFeed
        </Text>
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
              No posts yet
            </Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
              Be the first to share a build or ask a question!
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

              <Text style={{ color: "#6b7280", fontSize: 12 }}>
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

              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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