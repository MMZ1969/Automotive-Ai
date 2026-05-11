import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function Jobs() {
  const { user, isMechanic } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const [bidMessage, setBidMessage] = useState("");
  const [bidPrice, setBidPrice] = useState("");
  const [bidding, setBidding] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = isMechanic
        ? await api.get("/api/jobs")
        : await api.get("/api/jobs/mine");
      setJobs(res.data);
    } catch (err) {
      console.error("FETCH JOBS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleCreateJob = async () => {
    if (!title.trim() || !description.trim() || !vehicle.trim()) {
      Alert.alert("Missing fields", "Title, description and vehicle are required.");
      return;
    }
    try {
      setCreating(true);
      await api.post("/api/jobs", { title, description, vehicle, budget, location });
      setShowCreateModal(false);
      setTitle(""); setDescription(""); setVehicle(""); setBudget(""); setLocation("");
      fetchJobs();
      Alert.alert("✅ Job Posted!", "Mechanics can now bid on your job.");
    } catch (err) {
      console.error("CREATE JOB ERROR:", err);
      Alert.alert("Error", "Could not post job. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!bidMessage.trim() || !bidPrice.trim()) {
      Alert.alert("Missing fields", "Message and price are required.");
      return;
    }
    try {
      setBidding(true);
      await api.post(`/api/jobs/${selectedJob.id}/bid`, {
        message: bidMessage,
        price: Number(bidPrice),
      });
      setShowBidModal(false);
      setBidMessage(""); setBidPrice("");
      fetchJobs();
      Alert.alert("✅ Bid Placed!", "The DIYer will be notified of your bid.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        Alert.alert("Already Bid", "You already placed a bid on this job.");
      } else {
        Alert.alert("Error", "Could not place bid. Try again.");
      }
    } finally {
      setBidding(false);
    }
  };

  const handleAcceptBid = async (jobId: number, bidId: number) => {
    Alert.alert("Accept Bid", "Are you sure you want to accept this bid?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept",
        onPress: async () => {
          try {
            await api.post(`/api/jobs/${jobId}/bids/${bidId}/accept`);
            fetchJobs();
            Alert.alert("🎉 Bid Accepted!", "The mechanic has been notified.");
          } catch (err) {
            Alert.alert("Error", "Could not accept bid. Try again.");
          }
        },
      },
    ]);
  };

  const handleDeleteJob = async (jobId: number) => {
    Alert.alert("Delete Job", "Are you sure you want to delete this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/jobs/${jobId}`);
            fetchJobs();
          } catch (err) {
            Alert.alert("Error", "Could not delete job. Try again.");
          }
        },
      },
    ]);
  };

  const handleCompleteJob = async (job: any) => {
    Alert.alert("Complete Job", "Mark this job as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          try {
            await api.post(`/api/jobs/${job.id}/complete`);
            fetchJobs();
            setSelectedJob(job);
            setShowReviewModal(true);
          } catch (err) {
            Alert.alert("Error", "Could not complete job. Try again.");
          }
        },
      },
    ]);
  };

  const handleSubmitReview = async () => {
    if (!selectedJob) return;
    const acceptedBid = selectedJob.bids?.find((b: any) => b.status === "ACCEPTED");
    if (!acceptedBid) return;
    try {
      setSubmittingReview(true);
      await api.post("/api/reviews", {
        jobId: selectedJob.id,
        mechanicId: acceptedBid.mechanic.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      setShowReviewModal(false);
      setReviewComment("");
      setReviewRating(5);
      Alert.alert("⭐ Review Submitted!", "Thanks for rating your mechanic.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        Alert.alert("Already Reviewed", "You already reviewed this job.");
        setShowReviewModal(false);
      } else {
        Alert.alert("Error", "Could not submit review. Try again.");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "OPEN": return "#10b981";
      case "IN_PROGRESS": return "#f59e0b";
      case "COMPLETED": return "#345bff";
      default: return "#6b7280";
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

      {/* CREATE JOB MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 20 }}>💼 Post a Job</Text>
              <TextInput placeholder="Job title (e.g. Brake pad replacement)" placeholderTextColor="#4b5563" value={title} onChangeText={setTitle} style={inputStyle} />
              <TextInput placeholder="Describe the problem in detail..." placeholderTextColor="#4b5563" value={description} onChangeText={setDescription} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
              <TextInput placeholder="Vehicle (e.g. 2019 Honda Civic)" placeholderTextColor="#4b5563" value={vehicle} onChangeText={setVehicle} style={inputStyle} />
              <TextInput placeholder="Budget (optional, e.g. 200)" placeholderTextColor="#4b5563" value={budget} onChangeText={setBudget} keyboardType="numeric" style={inputStyle} />
              <TextInput placeholder="Location (optional, e.g. Newark, NJ)" placeholderTextColor="#4b5563" value={location} onChangeText={setLocation} style={inputStyle} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{ flex: 1, backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateJob} disabled={creating} style={{ flex: 1, backgroundColor: "#345bff", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{creating ? "Posting..." : "Post Job"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* BID MODAL */}
      <Modal visible={showBidModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 4 }}>🔧 Place a Bid</Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>{selectedJob?.title}</Text>
              <TextInput placeholder="Your message to the DIYer..." placeholderTextColor="#4b5563" value={bidMessage} onChangeText={setBidMessage} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
              <TextInput placeholder="Your price ($)" placeholderTextColor="#4b5563" value={bidPrice} onChangeText={setBidPrice} keyboardType="numeric" style={inputStyle} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowBidModal(false)} style={{ flex: 1, backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePlaceBid} disabled={bidding} style={{ flex: 1, backgroundColor: "#345bff", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{bidding ? "Placing..." : "Place Bid"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* REVIEW MODAL */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 4 }}>⭐ Rate Your Mechanic</Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>How was the service for: {selectedJob?.title}?</Text>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Text style={{ fontSize: 36 }}>{star <= reviewRating ? "⭐" : "☆"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                placeholder="Leave a comment (optional)..."
                placeholderTextColor="#4b5563"
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowReviewModal(false)} style={{ flex: 1, backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmitReview} disabled={submittingReview} style={{ flex: 1, backgroundColor: "#345bff", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{submittingReview ? "Submitting..." : "Submit Review"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      {/* STATUS UPDATE MODAL */}
<Modal visible={showStatusModal} animationType="slide" transparent>
  <TouchableOpacity
    style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}
    onPress={() => setShowStatusModal(false)}
  >
    <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
      <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 4 }}>📢 Send Update</Text>
      <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>{selectedJob?.title}</Text>
      {[
        "🚗 Your vehicle is ready for pickup!",
        "🔧 Work is in progress on your vehicle",
        "🔍 Still diagnosing the issue",
        "💰 Estimate is ready — please call us",
        "⏳ Waiting on parts to arrive",
        "✅ Job is complete!",
      ].map((msg) => (
        <TouchableOpacity
          key={msg}
          onPress={async () => {
            try {
              await api.post(`/api/jobs/${selectedJob.id}/status-update`, { message: msg });
              setShowStatusModal(false);
              Alert.alert("✅ Sent!", "Customer has been notified.");
            } catch (err) {
              Alert.alert("Error", "Could not send update. Try again.");
            }
          }}
          style={{
            backgroundColor: "#11131a",
            borderWidth: 1,
            borderColor: "#252838",
            padding: 14,
            borderRadius: 12,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: "white", fontSize: 15 }}>{msg}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        onPress={() => setShowStatusModal(false)}
        style={{ backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4, marginBottom: 20 }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
      </Modal>

      {/* HEADER */}
      <View style={{
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: "#252838",
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>
            {isMechanic ? "🔧 Open Jobs" : "💼 My Jobs"}
          </Text>
        </View>
        {!isMechanic && (
          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={{ backgroundColor: "#345bff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
            <Text style={{ color: "white", fontWeight: "700" }}>+ Post Job</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>💼</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginTop: 16 }}>
              {isMechanic ? "No open jobs yet" : "No jobs posted yet"}
            </Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center" }}>
              {isMechanic ? "Check back soon — DIYers will post jobs here" : "Post a job and mechanics will bid on it!"}
            </Text>
            {!isMechanic && (
              <TouchableOpacity onPress={() => setShowCreateModal(true)} style={{ backgroundColor: "#345bff", padding: 14, borderRadius: 12, marginTop: 20, paddingHorizontal: 30 }}>
                <Text style={{ color: "white", fontWeight: "700" }}>Post Your First Job</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: "#11131a", borderRadius: 16, borderWidth: 1, borderColor: "#252838", padding: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <Text style={{ color: "white", fontSize: 17, fontWeight: "700", flex: 1 }}>{item.title}</Text>
              <View style={{ backgroundColor: statusColor(item.status) + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: statusColor(item.status), marginLeft: 8 }}>
                <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: "700" }}>{item.status}</Text>
              </View>
            </View>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>🚗 {item.vehicle}</Text>
            <Text style={{ color: "#e5e7eb", fontSize: 14, lineHeight: 20, marginBottom: 8 }}>{item.description}</Text>
            <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
              {item.budget && <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "700" }}>💰 Budget: ${item.budget}</Text>}
              {item.location && <Text style={{ color: "#9ca3af", fontSize: 13 }}>📍 {item.location}</Text>}
            </View>
            {isMechanic && item.poster && (
              <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>Posted by {item.poster.name || "Anonymous"}</Text>
            )}
            {item.bids?.length > 0 && (
              <View style={{ backgroundColor: "#050509", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
                  {item.bids.length} Bid{item.bids.length !== 1 ? "s" : ""}
                </Text>
                {item.bids.map((bid: any) => (
                  <View key={bid.id} style={{ borderTopWidth: 1, borderTopColor: "#252838", paddingTop: 8, marginTop: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: "white", fontWeight: "700" }}>{bid.mechanic?.name || "Mechanic"}</Text>
                      <Text style={{ color: "#10b981", fontWeight: "700" }}>${bid.price}</Text>
                    </View>
                    <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>{bid.message}</Text>
                    {!isMechanic && item.status === "OPEN" && (
                      <TouchableOpacity onPress={() => handleAcceptBid(item.id, bid.id)} style={{ backgroundColor: "#10b981", padding: 8, borderRadius: 8, alignItems: "center", marginTop: 8 }}>
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>✅ Accept This Bid</Text>
                      </TouchableOpacity>
                    )}
                    {bid.status === "ACCEPTED" && (
                      <View style={{ backgroundColor: "#10b98122", padding: 6, borderRadius: 8, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#10b981" }}>
                        <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 12 }}>✅ ACCEPTED</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {isMechanic && item.status === "OPEN" && (
                <TouchableOpacity onPress={() => { setSelectedJob(item); setShowBidModal(true); }} style={{ flex: 1, backgroundColor: "#345bff", padding: 12, borderRadius: 10, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>🔧 Place Bid</Text>
                </TouchableOpacity>
              )}
              {isMechanic && item.status === "IN_PROGRESS" && (
                <TouchableOpacity
                  onPress={() => { setSelectedJob(item); setShowStatusModal(true); }}
                  style={{ flex: 1, backgroundColor: "#f59e0b", padding: 12, borderRadius: 10, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>📢 Send Update</Text>
                </TouchableOpacity>
              )}
              {!isMechanic && item.status === "IN_PROGRESS" && (
                <TouchableOpacity onPress={() => handleCompleteJob(item)} style={{ flex: 1, backgroundColor: "#10b981", padding: 12, borderRadius: 10, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>🏁 Mark Complete</Text>
                </TouchableOpacity>
              )}
              {!isMechanic && item.status === "OPEN" && (
                <TouchableOpacity onPress={() => handleDeleteJob(item.id)} style={{ backgroundColor: "#1a0a0a", padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444444" }}>
                  <Text style={{ color: "#ef4444", fontWeight: "700" }}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const inputStyle = {
  backgroundColor: "#050509",
  color: "white" as const,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 10,
  fontSize: 15,
};