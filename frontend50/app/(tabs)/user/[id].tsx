import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { getBadge } from "@utils/badges";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, RefreshControl, Text, TouchableOpacity, View,
} from "react-native";

export default function UserProfile() {
  const { id } = useLocalSearchParams();
  const { user: me } = useAuth();
  const { colors } = useTheme();
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
      if (userRes.data.role === "MECHANIC") {
        const statsRes = await api.get(`/api/users/${id}/mechanic-stats`);
        setMechanicStats(statsRes.data);
      }
    } catch (err) { console.error("FETCH PROFILE ERROR:", err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchProfile(); }, [id]));
  const onRefresh = () => { setRefreshing(true); fetchProfile(); };

  const handleFollow = async () => {
    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);
    setProfile((prev: any) => ({ ...prev, _count: { ...prev._count, followers: newFollowing ? (prev._count?.followers || 0) + 1 : Math.max((prev._count?.followers || 0) - 1, 0) } }));
    try {
      setFollowLoading(true);
      await api.post(`/api/users/${id}/follow`);
    } catch (err) {
      setIsFollowing(!newFollowing);
      setProfile((prev: any) => ({ ...prev, _count: { ...prev._count, followers: newFollowing ? Math.max((prev._count?.followers || 0) - 1, 0) : (prev._count?.followers || 0) + 1 } }));
    } finally { setFollowLoading(false); }
  };

  const handleBlock = async () => {
    Alert.alert(
      isBlocked ? "Unblock User" : "Block User",
      isBlocked ? `Unblock ${profile?.name}?` : `Block ${profile?.name}? They won't see your content.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: isBlocked ? "Unblock" : "Block", style: "destructive", onPress: async () => {
          try {
            setBlockLoading(true);
            const res = await api.post(`/api/users/${id}/block`);
            setIsBlocked(res.data.blocked);
            Alert.alert(res.data.blocked ? "✅ Blocked" : "✅ Unblocked", `${profile?.name} has been ${res.data.blocked ? "blocked" : "unblocked"}.`);
          } catch { Alert.alert("Error", "Could not block user. Try again."); }
          finally { setBlockLoading(false); }
        }},
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  const isMechanic = profile?.role === "MECHANIC";
  const isMe = me?.id === Number(id);

  const statPill = { backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center" as const };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        ListHeaderComponent={
          <View>
            <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 }}>
              <TouchableOpacity onPress={() => router.push("/(tabs)/feed")}>
                <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: "center", paddingHorizontal: 20, paddingBottom: 24 }}>
              <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.card, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: isMechanic ? colors.blue : colors.green, overflow: "hidden", marginBottom: 12 }}>
                {profile?.profilePhoto ? (
                  <Image source={{ uri: profile.profilePhoto }} style={{ width: 90, height: 90 }} />
                ) : (
                  <Text style={{ fontSize: 36 }}>{profile?.name?.[0]?.toUpperCase() || "?"}</Text>
                )}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>{profile?.name || "Anonymous"}</Text>
                {profile?.isVerified && (
                  <View style={{ backgroundColor: "#1e3a8a", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.blue }}>
                    <Text style={{ color: colors.blue, fontSize: 11, fontWeight: "700" }}>✅ Verified</Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 8, backgroundColor: isMechanic ? colors.blue : colors.green, paddingVertical: 4, paddingHorizontal: 14, borderRadius: 20 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>{isMechanic ? "🏁 MECHANIC" : "🔧 DIYER"}</Text>
              </View>

              <View style={{ marginTop: 8, backgroundColor: getBadge(profile?.repPoints || 0).color + "22", paddingVertical: 4, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: getBadge(profile?.repPoints || 0).color }}>
                <Text style={{ fontWeight: "700", fontSize: 13, color: getBadge(profile?.repPoints || 0).color }}>
                  {getBadge(profile?.repPoints || 0).emoji} {getBadge(profile?.repPoints || 0).label}
                </Text>
              </View>

              {isMechanic && mechanicStats && (
                <View style={{ marginTop: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.blue + "33", padding: 16, width: "100%", flexDirection: "row", justifyContent: "space-around" }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "#facc15", fontSize: 22, fontWeight: "900" }}>{mechanicStats.avgRating ? `⭐ ${mechanicStats.avgRating}` : "—"}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{mechanicStats.totalReviews} Reviews</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.border }} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: colors.green, fontSize: 22, fontWeight: "900" }}>✅ {mechanicStats.completedJobs}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>Jobs Done</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.border }} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: colors.blue, fontSize: 22, fontWeight: "900" }}>{mechanicStats.winRate}%</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>Win Rate</Text>
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 16, marginTop: 20 }}>
                <TouchableOpacity style={statPill} onPress={() => router.push({ pathname: "/(tabs)/followers", params: { id, type: "followers" } })}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{profile?._count?.followers || 0}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity style={statPill} onPress={() => router.push({ pathname: "/(tabs)/followers", params: { id, type: "following" } })}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{profile?._count?.following || 0}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Following</Text>
                </TouchableOpacity>
                <View style={statPill}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{profile?._count?.posts || 0}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Posts</Text>
                </View>
                <View style={statPill}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{profile?.repPoints || 0}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Rep</Text>
                </View>
              </View>

              {!isMe && (
                <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                  <TouchableOpacity onPress={handleFollow} disabled={followLoading} style={{ flex: 1, backgroundColor: isFollowing ? colors.card : colors.blue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, borderWidth: 1, borderColor: isFollowing ? colors.border : colors.blue, alignItems: "center" }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>{followLoading ? "..." : isFollowing ? "Following" : "Follow"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        const res = await api.post("/api/messages/conversations", { otherUserId: Number(id) });
                        router.push(`/(tabs)/chat/${res.data.id}`);
                      } catch { Alert.alert("Error", "Could not start conversation."); }
                    }}
                    style={{ backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.blue + "44", alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 18 }}>💬</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleBlock} disabled={blockLoading} style={{ backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: "#ef444444", alignItems: "center" }}>
                    <Text style={{ fontSize: 18 }}>{blockLoading ? "..." : "🚫"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Posts</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ fontSize: 36 }}>🔧</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No posts yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(tabs)/post/${item.id}`)}
            style={{ backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10 }} resizeMode="cover" />}
            <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{item.content}</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>❤️ {item.likes?.length || 0}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>💬 {item.comments?.length || 0}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
