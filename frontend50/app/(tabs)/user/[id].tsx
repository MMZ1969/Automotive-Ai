import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { getBadge } from "@utils/badges";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function UserProfile() {
  const { id } = useLocalSearchParams();
  const { user: me } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [mechanicStats, setMechanicStats] = useState<any>(null);

  const fetchProfile = async () => {
    try {
      const [userRes, postsRes, followRes] = await Promise.all([
        api.get(`/api/users/${id}/profile`),
        api.get(`/api/posts?userId=${id}`),
        api.get(`/api/users/${id}/follow-status`),
      ]);
      setProfile(userRes.data);
      setPosts(postsRes.data.filter((p: any) => p.userId === Number(id)));
      setIsFollowing(followRes.data.following);

      // Fetch mechanic stats if this is a mechanic
      if (userRes.data.role === "MECHANIC") {
        const statsRes = await api.get(`/api/users/${id}/mechanic-stats`);
        setMechanicStats(statsRes.data);
      }
    } catch (err) {
      console.error("FETCH PROFILE ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleFollow = async () => {
    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);
    setProfile((prev: any) => ({
      ...prev,
      _count: {
        ...prev._count,
        followers: newFollowing
          ? (prev._count?.followers || 0) + 1
          : Math.max((prev._count?.followers || 0) - 1, 0),
      },
    }));

    try {
      setFollowLoading(true);
      await api.post(`/api/users/${id}/follow`);
    } catch (err) {
      console.error("FOLLOW ERROR:", err);
      setIsFollowing(!newFollowing);
      setProfile((prev: any) => ({
        ...prev,
        _count: {
          ...prev._count,
          followers: newFollowing
            ? Math.max((prev._count?.followers || 0) - 1, 0)
            : (prev._count?.followers || 0) + 1,
        },
      }));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlock = async () => {
    Alert.alert(
      isBlocked ? "Unblock User" : "Block User",
      isBlocked
        ? `Are you sure you want to unblock ${profile?.name}?`
        : `Are you sure you want to block ${profile?.name}? They won't be able to see your content and you won't see theirs.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isBlocked ? "Unblock" : "Block",
          style: "destructive",
          onPress: async () => {
            try {
              setBlockLoading(true);
              const res = await api.post(`/api/users/${id}/block`);
              setIsBlocked(res.data.blocked);
              if (res.data.blocked) {
                Alert.alert("✅ Blocked", `${profile?.name} has been blocked.`);
              } else {
                Alert.alert("✅ Unblocked", `${profile?.name} has been unblocked.`);
              }
            } catch (err) {
              console.error("BLOCK ERROR:", err);
              Alert.alert("Error", "Could not block user. Try again.");
            } finally {
              setBlockLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  const isMechanic = profile?.role === "MECHANIC";
  const isMe = me?.id === Number(id);

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />}
        ListHeaderComponent={
          <View>
            {/* BACK BUTTON */}
            <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 }}>
              <TouchableOpacity onPress={() => router.push("/(tabs)/feed")}>
                <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
              </TouchableOpacity>
            </View>

            {/* PROFILE HEADER */}
            <View style={{ alignItems: "center", paddingHorizontal: 20, paddingBottom: 24 }}>
              {/* AVATAR */}
              <View style={{
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: "#11131a",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 3,
                borderColor: isMechanic ? "#345bff" : "#10b981",
                overflow: "hidden",
                marginBottom: 12,
              }}>
                {profile?.profilePhoto ? (
                  <Image source={{ uri: profile.profilePhoto }} style={{ width: 90, height: 90 }} />
                ) : (
                  <Text style={{ fontSize: 36 }}>
                    {profile?.name?.[0]?.toUpperCase() || "?"}
                  </Text>
                )}
              </View>

              {/* NAME */}
              <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>
                {profile?.name || "Anonymous"}
              </Text>

              {/* ROLE BADGE */}
                <View style={{
                  marginTop: 8,
                  backgroundColor: isMechanic ? "#345bff" : "#10b981",
                  paddingVertical: 4,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
                    {isMechanic ? "🏁 MECHANIC" : "🔧 DIYER"}
                  </Text>
                </View>

                {/* REP BADGE */}
                <View style={{
                  marginTop: 8,
                  backgroundColor: getBadge(profile?.repPoints || 0).color + "22",
                  paddingVertical: 4,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: getBadge(profile?.repPoints || 0).color,
                }}>
                  <Text style={{ fontWeight: "700", fontSize: 13, color: getBadge(profile?.repPoints || 0).color }}>
                    {getBadge(profile?.repPoints || 0).emoji} {getBadge(profile?.repPoints || 0).label}
                  </Text>
                </View>

              {/* MECHANIC STATS CARD */}
              {isMechanic && mechanicStats && (
                <View style={{
                  marginTop: 16,
                  backgroundColor: "#0d1117",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#345bff33",
                  padding: 16,
                  width: "100%",
                  flexDirection: "row",
                  justifyContent: "space-around",
                }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "#facc15", fontSize: 22, fontWeight: "900" }}>
                      {mechanicStats.avgRating ? `⭐ ${mechanicStats.avgRating}` : "—"}
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>
                      {mechanicStats.totalReviews} Reviews
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: "#252838" }} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "#10b981", fontSize: 22, fontWeight: "900" }}>
                      ✅ {mechanicStats.completedJobs}
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>
                      Jobs Done
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: "#252838" }} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "#345bff", fontSize: 22, fontWeight: "900" }}>
                      {mechanicStats.winRate}%
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>
                      Win Rate
                    </Text>
                  </View>
                </View>
              )}

              {/* STATS ROW */}
              <View style={{ flexDirection: "row", gap: 16, marginTop: 20 }}>
                <TouchableOpacity
                  style={statPill}
                  onPress={() => router.push({ pathname: "/(tabs)/followers", params: { id, type: "followers" } })}
                >
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
                    {profile?._count?.followers || 0}
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={statPill}
                  onPress={() => router.push({ pathname: "/(tabs)/followers", params: { id, type: "following" } })}
                >
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
                    {profile?._count?.following || 0}
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>Following</Text>
                </TouchableOpacity>
                <View style={statPill}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
                    {profile?._count?.posts || 0}
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>Posts</Text>
                </View>
                <View style={statPill}>
                  <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>
                    {profile?.repPoints || 0}
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11 }}>Rep</Text>
                </View>
              </View>

              {/* FOLLOW + BLOCK BUTTONS */}
              {!isMe && (
                <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={handleFollow}
                    disabled={followLoading}
                    style={{
                      flex: 1,
                      backgroundColor: isFollowing ? "#1f2937" : "#345bff",
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: isFollowing ? "#252838" : "#345bff",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                      {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleBlock}
                    disabled={blockLoading}
                    style={{
                      backgroundColor: "#1f2937",
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: "#ef444444",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>
                      {blockLoading ? "..." : isBlocked ? "🚫" : "🚫"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* POSTS HEADER */}
            <View style={{
              borderTopWidth: 1,
              borderTopColor: "#252838",
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                Posts
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ fontSize: 36 }}>🔧</Text>
            <Text style={{ color: "#9ca3af", marginTop: 12 }}>No posts yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/post/${item.id}`)}
            style={{
              backgroundColor: "#11131a",
              marginHorizontal: 16,
              marginBottom: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 14,
            }}
          >
            {item.imageUrl && (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10 }}
                resizeMode="cover"
              />
            )}
            <Text style={{ color: "#e5e7eb", fontSize: 15, lineHeight: 22 }}>
              {item.content}
            </Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
              <Text style={{ color: "#6b7280", fontSize: 13 }}>
                ❤️ {item.likes?.length || 0}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 13 }}>
                💬 {item.comments?.length || 0}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const statPill = {
  backgroundColor: "#11131a",
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#252838",
  alignItems: "center" as const,
};