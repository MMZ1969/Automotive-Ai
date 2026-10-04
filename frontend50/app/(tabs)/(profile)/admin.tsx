import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

const RESOLUTION_LABELS: Record<string, string> = {
  DISMISSED: "Dismissed",
  POST_REMOVED: "Post removed",
  POST_REMOVED_OWNER_BANNED: "Post removed + author banned",
  OWNER_BANNED: "Author banned",
  REPORTER_BANNED: "Dismissed + reporter banned",
};

function formatDuration(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr`;
  return `${Math.round(hrs / 24)} days`;
}

function timeAgo(iso: string) {
  return `${formatDuration(Date.now() - new Date(iso).getTime())} ago`;
}

function ActionButton({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone: "neutral" | "danger" | "solid";
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexGrow: 1,
        minWidth: "45%",
        padding: 12,
        borderRadius: 10,
        alignItems: "center",
        backgroundColor: tone === "solid" ? "#ef4444" : colors.card,
        borderWidth: tone === "solid" ? 0 : 1,
        borderColor: tone === "danger" ? "#ef444444" : colors.border,
      }}
    >
      <Text
        style={{
          fontWeight: "700",
          fontSize: 13,
          color: tone === "solid" ? "white" : tone === "danger" ? "#ef4444" : colors.text,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const { colors } = useTheme();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [view, setView] = useState<"verify" | "reports" | "users">(tab === "reports" ? "reports" : "verify");
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportFilter, setReportFilter] = useState<"open" | "resolved">("open");
  const [openReportCount, setOpenReportCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tapping a "post reported" notification deep-links here with ?tab=reports
  useEffect(() => {
    if (tab === "reports") setView("reports");
  }, [tab]);

  const fetchRequests = async () => {
    try {
      const res = await api.get("/api/users/verification-requests");
      setRequests(res.data);
    } catch (err) {
      console.error("FETCH REQUESTS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/api/users/admin/all");
      setUsers(res.data);
    } catch (err) {
      console.error("FETCH USERS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOpenCount = async () => {
    try {
      const res = await api.get("/api/admin/reports/open-count");
      setOpenReportCount(res.data.count);
    } catch (err) {
      console.error("FETCH OPEN REPORT COUNT ERROR:", err);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await api.get("/api/admin/reports", { params: { status: reportFilter } });
      setReports(res.data);
    } catch (err) {
      console.error("FETCH REPORTS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchData = async () => {
    fetchOpenCount();
    if (view === "verify") await fetchRequests();
    else if (view === "reports") await fetchReports();
    else await fetchUsers();
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchData(); }, [view, reportFilter]));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleVerify = async (userId: number, name: string, approved: boolean) => {
    Alert.alert(
      approved ? "✅ Approve Verification" : "❌ Deny Verification",
      approved
        ? `Grant ${name} the Verified Mechanic badge?`
        : `Deny ${name}'s verification request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: approved ? "Approve" : "Deny",
          style: approved ? "default" : "destructive",
          onPress: async () => {
            try {
              await api.post(`/api/users/${userId}/verify`, { approved });
              fetchRequests();
              Alert.alert(
                approved ? "✅ Verified!" : "❌ Denied",
                approved
                  ? `${name} is now a Verified Mechanic!`
                  : `${name}'s request has been denied.`
              );
            } catch (err) {
              Alert.alert("Error", "Could not process request. Try again.");
            }
          },
        },
      ]
    );
  };

  const handleResolveReport = (report: any, action: string, title: string, message: string, destructive = true) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: destructive ? "destructive" : "default",
        onPress: async () => {
          try {
            await api.post(`/api/admin/reports/${report.id}/resolve`, { action });
            fetchReports();
            fetchOpenCount();
          } catch (err: any) {
            console.error("RESOLVE REPORT ERROR:", err);
            Alert.alert("Error", err?.response?.data?.error || "Could not resolve report. Try again.");
          }
        },
      },
    ]);
  };

  const handleToggleBan = (target: any) => {
    const action = target.isBanned ? "Unban" : "Ban";
    Alert.alert(`${action} User`, `${action} ${target.name} (${target.email})?`, [
      { text: "Cancel", style: "cancel" },
      { text: action, style: "destructive", onPress: async () => {
        try {
          const res = await api.post(`/api/users/${target.id}/ban`);
          setUsers(prev => prev.map(u => u.id === target.id ? { ...u, isBanned: res.data.isBanned } : u));
        } catch (err) {
          console.error("BAN USER ERROR:", err);
          Alert.alert("Error", "Could not update ban status.");
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>🛡️ Admin Panel</Text>
        </View>

        {/* TAB TOGGLE */}
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 4 }}>
          <TouchableOpacity onPress={() => setView("verify")} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: view === "verify" ? colors.blue : "transparent" }}>
            <Text style={{ color: view === "verify" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 13 }}>
              ✅ Verify ({requests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView("reports")} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: view === "reports" ? colors.blue : "transparent" }}>
            <Text style={{ color: view === "reports" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 13 }}>
              🚨 Reports ({openReportCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView("users")} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: view === "users" ? colors.blue : "transparent" }}>
            <Text style={{ color: view === "users" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 13 }}>
              👥 Users
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VERIFICATION REQUESTS VIEW */}
      {view === "verify" && (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>All clear!</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No pending verification requests</Text>
            </View>
          }
          renderItem={({ item }) => {
            const details = item.verificationRequest ? JSON.parse(item.verificationRequest) : {};
            return (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 }}>
                {/* USER INFO */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, borderWidth: 2, borderColor: colors.blue, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                    {item.profilePhoto ? (
                      <Image source={{ uri: item.profilePhoto }} style={{ width: 48, height: 48 }} />
                    ) : (
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{item.name?.[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.email}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>⭐ {item.repPoints} rep</Text>
                  </View>
                </View>

                {/* VERIFICATION DETAILS */}
                <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>License / Cert</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.licenseNumber || "—"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Shop Name</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.shopName || "—"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Location</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.shopLocation || "—"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Experience</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.experience ? `${details.experience} years` : "—"}</Text>
                  </View>
                </View>

                {/* APPROVE / DENY BUTTONS */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleVerify(item.id, item.name, true)}
                    style={{ flex: 1, backgroundColor: colors.green, padding: 13, borderRadius: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>✅ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleVerify(item.id, item.name, false)}
                    style={{ flex: 1, backgroundColor: colors.card, padding: 13, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444444" }}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "700" }}>❌ Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* REPORTS VIEW */}
      {view === "reports" && (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {(["open", "resolved"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setReportFilter(f)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: reportFilter === f ? colors.blue : colors.card,
                  }}
                >
                  <Text style={{ color: reportFilter === f ? "white" : colors.textMuted, fontWeight: "700", fontSize: 13 }}>
                    {f === "open" ? `Open (${openReportCount})` : "Resolved"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>{reportFilter === "open" ? "✅" : "📂"}</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>
                {reportFilter === "open" ? "All clear!" : "Nothing resolved yet"}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                {reportFilter === "open" ? "No open reports" : "Handled reports will show up here"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOpen = item.status === "OPEN";
            const isJob = !!item.job;
            const owner = item.post?.user ?? item.job?.poster ?? null;
            const reporter = item.reporter;
            const reporterAgeMs = new Date(item.createdAt).getTime() - new Date(reporter.createdAt).getTime();
            const freshReporter = reporterAgeMs < 24 * 60 * 60 * 1000;
            const targetText = isJob
              ? `${item.job.title}${item.job.description ? `\n${item.job.description}` : ""}`
              : item.post?.content ?? item.targetSnapshot ?? "(content unavailable)";
            const targetRemoved = !isJob && !item.post;
            const ownerLabel = owner ? `${owner.name || "Unnamed"} (${owner.email})` : "unknown";
            const ownerProtected = !owner || owner.isAdmin || owner.isBanned;

            return (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 }}>
                {/* REASON + TIME */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <View style={{ backgroundColor: "#ef444422", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 12 }}>🚨 {item.reason}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{timeAgo(item.createdAt)}</Text>
                </View>

                {/* REPORTED CONTENT */}
                <TouchableOpacity
                  disabled={!item.post}
                  onPress={() => item.post && router.push(`/(tabs)/post/${item.post.id}`)}
                  style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>
                    {isJob ? "REPORTED JOB" : targetRemoved ? "REPORTED POST (REMOVED)" : "REPORTED POST — tap to open"}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={8}>{targetText}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                    by {ownerLabel}{owner?.isBanned ? "  🚫 banned" : ""}{owner?.isAdmin ? "  👑 admin" : ""}
                  </Text>
                </TouchableOpacity>

                {/* REPORTER */}
                <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>REPORTED BY</Text>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                    {reporter.name || "Unnamed"}{reporter.isBanned ? "  🚫 banned" : ""}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{reporter.email}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                    {reporter.emailVerified ? "✓ verified" : "✗ unverified"} · {reporter._count?.reports ?? 1} report{(reporter._count?.reports ?? 1) === 1 ? "" : "s"} filed
                  </Text>
                  {freshReporter && (
                    <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "600", marginTop: 6 }}>
                      ⚠️ Account was only {formatDuration(reporterAgeMs)} old when this was filed
                    </Text>
                  )}
                </View>

                {/* ACTIONS (open) or OUTCOME (resolved) */}
                {isOpen ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <ActionButton
                      label="Dismiss"
                      tone="neutral"
                      onPress={() => handleResolveReport(item, "DISMISS", "Dismiss report", "Mark this report as unfounded? The content stays up.", false)}
                    />
                    {!isJob && item.post && (
                      <ActionButton
                        label="Remove post"
                        tone="danger"
                        onPress={() => handleResolveReport(item, "REMOVE_CONTENT", "Remove post", "Permanently delete this post, its comments and likes? This closes every report on it and can't be undone.")}
                      />
                    )}
                    {!isJob && item.post && !ownerProtected && (
                      <ActionButton
                        label="Remove + ban author"
                        tone="solid"
                        onPress={() => handleResolveReport(item, "REMOVE_AND_BAN_OWNER", "Remove post and ban author", `Delete this post and ban ${ownerLabel}?`)}
                      />
                    )}
                    {isJob && !ownerProtected && (
                      <ActionButton
                        label="Ban poster"
                        tone="solid"
                        onPress={() => handleResolveReport(item, "BAN_OWNER", "Ban poster", `Ban ${ownerLabel}?`)}
                      />
                    )}
                    {!reporter.isBanned && (
                      <ActionButton
                        label="Ban reporter"
                        tone="danger"
                        onPress={() => handleResolveReport(item, "BAN_REPORTER", "Ban reporter", `Dismiss this report and ban ${reporter.name || reporter.email}? Use this for bots or people abusing the report button.`)}
                      />
                    )}
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>
                      ✓ {RESOLUTION_LABELS[item.resolution] || item.status}
                    </Text>
                    {item.resolvedAt && (
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{timeAgo(item.resolvedAt)}</Text>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* USERS VIEW */}
      {view === "users" && (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={{
              backgroundColor: colors.card, borderRadius: 14, borderWidth: 1,
              borderColor: item.isBanned ? "#ef4444" : colors.border,
              padding: 14, marginBottom: 10,
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{item.name || "Unnamed"}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{item.email}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.role}</Text>
                  {item.isVerified && <Text style={{ color: "#f59e0b", fontSize: 11, marginTop: 2 }}>🏁 Verified</Text>}
                  {item.isAdmin && <Text style={{ color: colors.blue, fontSize: 11, marginTop: 2 }}>👑 Admin</Text>}
                </View>
              </View>
              {item.isBanned && (
                <View style={{ backgroundColor: "#ef444422", borderRadius: 8, padding: 6, marginBottom: 8, alignItems: "center" }}>
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>🚫 BANNED</Text>
                </View>
              )}
              {!item.isAdmin && (
                <TouchableOpacity
                  onPress={() => handleToggleBan(item)}
                  style={{
                    backgroundColor: item.isBanned ? colors.green : "#ef4444",
                    padding: 10, borderRadius: 10, alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    {item.isBanned ? "✅ Unban User" : "🚫 Ban User"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}