/**
 * TanStack Query layer. Components use these hooks — never `api` directly —
 * so caching, invalidation, loading and error states are consistent app-wide.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";
import type {
  AddDependentInput,
  Appointment,
  ConsentSettings,
  CreateShareLinkInput,
  FamilyMember,
  Goal,
  ID,
  LifestyleProfile,
  Medication,
  NotificationPreferences,
  NutritionEntry,
  ReportRequest,
  SymptomEntry,
  UserProfile,
  VitalEntry,
  VitalKind,
} from "./types";

export const qk = {
  profile: ["profile"] as const,
  healthScore: ["health-score"] as const,
  insights: ["insights"] as const,
  sleep: (r: string) => ["sleep", r] as const,
  activity: (r: string) => ["activity", r] as const,
  labMarkers: ["lab-markers"] as const,
  labTrend: (m: string) => ["lab-trend", m] as const,
  records: ["records"] as const,
  wearables: ["wearables"] as const,
  medications: ["medications"] as const,
  goals: ["goals"] as const,
  family: ["family"] as const,
  risks: ["risks"] as const,
  appointments: ["appointments"] as const,
  vitals: (k?: string) => ["vitals", k ?? "all"] as const,
  symptoms: ["symptoms"] as const,
  nutrition: ["nutrition"] as const,
  timeline: ["timeline"] as const,
  notifications: ["notifications"] as const,
  careTeam: ["care-team"] as const,
  chat: ["chat"] as const,
  lifestyle: ["lifestyle"] as const,
  consent: ["consent"] as const,
  notificationPrefs: ["notification-preferences"] as const,
  shareLinks: ["share-links"] as const,
  household: ["household"] as const,
  accessGrants: (subjectId: string) => ["access-grants", subjectId] as const,
};

/* ---------- queryOptions (usable in route loaders for prefetch) ---------- */
export const profileQuery = queryOptions({ queryKey: qk.profile, queryFn: () => api.getProfile() });
export const healthScoreQuery = queryOptions({
  queryKey: qk.healthScore,
  queryFn: () => api.getHealthScore(),
});
export const insightsQuery = queryOptions({
  queryKey: qk.insights,
  queryFn: () => api.getInsights(),
});
export const labMarkersQuery = queryOptions({
  queryKey: qk.labMarkers,
  queryFn: () => api.getLabMarkers(),
});
export const recordsQuery = queryOptions({ queryKey: qk.records, queryFn: () => api.getRecords() });
export const medicationsQuery = queryOptions({
  queryKey: qk.medications,
  queryFn: () => api.getMedications(),
});
export const goalsQuery = queryOptions({ queryKey: qk.goals, queryFn: () => api.getGoals() });
export const appointmentsQuery = queryOptions({
  queryKey: qk.appointments,
  queryFn: () => api.getAppointments(),
});
export const symptomsQuery = queryOptions({
  queryKey: qk.symptoms,
  queryFn: () => api.getSymptoms(),
});
export const nutritionQuery = queryOptions({
  queryKey: qk.nutrition,
  queryFn: () => api.getNutrition(),
});
export const timelineQuery = queryOptions({
  queryKey: qk.timeline,
  queryFn: () => api.getTimeline(),
});
export const notificationsQuery = queryOptions({
  queryKey: qk.notifications,
  queryFn: () => api.getNotifications(),
});
export const careTeamQuery = queryOptions({
  queryKey: qk.careTeam,
  queryFn: () => api.getCareTeam(),
});
export const wearablesQuery = queryOptions({
  queryKey: qk.wearables,
  queryFn: () => api.getWearables(),
});
export const familyQuery = queryOptions({
  queryKey: qk.family,
  queryFn: () => api.getFamilyHistory(),
});
export const risksQuery = queryOptions({ queryKey: qk.risks, queryFn: () => api.getRisks() });
export const householdQuery = queryOptions({
  queryKey: qk.household,
  queryFn: () => api.getHouseholdMembers(),
});
export const chatQuery = queryOptions({ queryKey: qk.chat, queryFn: () => api.getChatHistory() });
export const lifestyleQuery = queryOptions({
  queryKey: qk.lifestyle,
  queryFn: () => api.getLifestyleProfile(),
});
export const consentQuery = queryOptions({
  queryKey: qk.consent,
  queryFn: () => api.getConsentSettings(),
});
export const notificationPrefsQuery = queryOptions({
  queryKey: qk.notificationPrefs,
  queryFn: () => api.getNotificationPreferences(),
});
export const shareLinksQuery = queryOptions({
  queryKey: qk.shareLinks,
  queryFn: () => api.getShareLinks(),
});

/* ---------- read hooks ---------- */
export const useProfile = () => useQuery(profileQuery);
export const useHealthScore = () => useQuery(healthScoreQuery);
export const useInsights = () => useQuery(insightsQuery);
export function useDismissInsight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: ID) => api.dismissInsight(id),
    onSuccess: () => invalidate(qk.insights),
  });
}
export const useSleep = (range: "7d" | "30d" | "90d" = "7d") =>
  useQuery({ queryKey: qk.sleep(range), queryFn: () => api.getSleep(range) });
export const useActivity = (range: "7d" | "30d" | "90d" = "7d") =>
  useQuery({ queryKey: qk.activity(range), queryFn: () => api.getActivity(range) });
export const useLabMarkers = () => useQuery(labMarkersQuery);
export const useLabTrend = (marker: string) =>
  useQuery({
    queryKey: qk.labTrend(marker),
    queryFn: () => api.getLabTrend(marker),
    enabled: !!marker,
  });
export const useRecords = () => useQuery(recordsQuery);
export const useWearables = () => useQuery(wearablesQuery);
export const useMedications = () => useQuery(medicationsQuery);
export const useGoals = () => useQuery(goalsQuery);
export const useFamilyHistory = () => useQuery(familyQuery);
export const useRisks = () => useQuery(risksQuery);
export const useHouseholdMembers = () => useQuery(householdQuery);
export const useAccessGrants = (subjectId: string) =>
  useQuery({
    queryKey: qk.accessGrants(subjectId),
    queryFn: () => api.getAccessGrants(subjectId),
    enabled: !!subjectId,
  });
export const useAppointments = () => useQuery(appointmentsQuery);
export const useVitals = (kind?: VitalKind) =>
  useQuery({ queryKey: qk.vitals(kind), queryFn: () => api.getVitals(kind) });
export const useSymptoms = () => useQuery(symptomsQuery);
export const useNutrition = () => useQuery(nutritionQuery);
export const useTimeline = () => useQuery(timelineQuery);
export const useNotifications = () => useQuery(notificationsQuery);
export const useCareTeam = () => useQuery(careTeamQuery);
export const useChatHistory = () => useQuery(chatQuery);
export const useLifestyleProfile = () => useQuery(lifestyleQuery);
export const useConsentSettings = () => useQuery(consentQuery);
export const useNotificationPreferences = () => useQuery(notificationPrefsQuery);
export const useShareLinks = () => useQuery(shareLinksQuery);

/* ---------- mutations ---------- */
function useInvalidate() {
  const qc = useQueryClient();
  return (key: readonly unknown[]) => qc.invalidateQueries({ queryKey: key });
}

export function useUpdateProfile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: Partial<UserProfile>) => api.updateProfile(patch),
    onSuccess: () => {
      invalidate(qk.profile);
      toast.success("Profile updated");
    },
    onError: () => toast.error("Couldn't save your profile"),
  });
}

export function useUploadRecord() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (file: File) => api.uploadRecord(file),
    onSuccess: (rec) => {
      invalidate(qk.records);
      toast.success(`${rec.title} uploaded`, { description: "AI parsing started." });
    },
    onError: () => toast.error("Upload failed"),
  });
}

export function useDeleteRecord() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: ID) => api.deleteRecord(id),
    onSuccess: () => {
      invalidate(qk.records);
      toast.success("Record deleted");
    },
  });
}

export function useToggleWearable() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ name, connect }: { name: string; connect: boolean }) =>
      api.toggleWearable(name, connect),
    onSuccess: (w) => {
      invalidate(qk.wearables);
      toast.success(w.connected ? `${w.name} connected` : `${w.name} disconnected`);
    },
    onError: () => toast.error("Device sync failed"),
  });
}

export function useLogDose() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, taken }: { id: ID; taken: boolean }) => api.logDose(id, taken),
    onSuccess: (m, vars) => {
      invalidate(qk.medications);
      toast.success(vars.taken ? `${m.name} logged` : `${m.name} skipped`);
    },
  });
}

export function useAddMedication() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<Medication, "id" | "adherence">) => api.addMedication(input),
    onSuccess: () => {
      invalidate(qk.medications);
      toast.success("Medication added");
    },
  });
}

export function useAddGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<Goal, "id" | "progress" | "streak">) => api.addGoal(input),
    onSuccess: () => {
      invalidate(qk.goals);
      toast.success("Goal created");
    },
  });
}

export function useUpdateGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: ID; patch: Partial<Goal> }) => api.updateGoal(id, patch),
    onSuccess: () => invalidate(qk.goals),
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: ID) => api.deleteGoal(id),
    onSuccess: () => {
      invalidate(qk.goals);
      toast.success("Goal removed");
    },
  });
}

export function useAddAppointment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<Appointment, "id" | "status">) => api.addAppointment(input),
    onSuccess: () => {
      invalidate(qk.appointments);
      toast.success("Appointment scheduled");
    },
  });
}

export function useCancelAppointment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: ID) => api.cancelAppointment(id),
    onSuccess: () => {
      invalidate(qk.appointments);
      toast.success("Appointment cancelled");
    },
  });
}

export function useAddVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<VitalEntry, "id" | "source"> & { source?: VitalEntry["source"] }) =>
      api.addVital(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vitals"] });
      toast.success("Reading saved");
    },
    onError: () => toast.error("Couldn't save that reading"),
  });
}

export function useAddSymptom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<SymptomEntry, "id">) => api.addSymptom(input),
    onSuccess: () => {
      invalidate(qk.symptoms);
      toast.success("Symptom logged");
    },
  });
}

export function useDeleteSymptom() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: ID) => api.deleteSymptom(id),
    onSuccess: () => invalidate(qk.symptoms),
  });
}

export function useAddNutrition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<NutritionEntry, "id">) => api.addNutrition(input),
    onSuccess: () => {
      invalidate(qk.nutrition);
      toast.success("Meal logged");
    },
  });
}

export function useAddWater() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (ml: number) => api.addWater(ml),
    onSuccess: () => invalidate(qk.nutrition),
  });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: ID) => api.markNotificationRead(id),
    onSuccess: () => invalidate(qk.notifications),
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      invalidate(qk.notifications);
      toast.success("All caught up");
    },
  });
}

export function useSetCareSharing() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, sharing }: { id: ID; sharing: boolean }) => api.setCareSharing(id, sharing),
    onSuccess: (c) => {
      invalidate(qk.careTeam);
      toast.success(c.sharing ? `Sharing enabled for ${c.name}` : `Sharing paused for ${c.name}`);
    },
  });
}

export function useRequestReport() {
  return useMutation({
    mutationFn: (req: ReportRequest) => api.requestReport(req),
    onSuccess: () =>
      toast.success("Report queued", { description: "We'll email you the download link." }),
    onError: () => toast.error("Report request failed"),
  });
}

export function useAddFamilyMember() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: FamilyMember) => api.addFamilyMember(input),
    onSuccess: () => invalidate(qk.family),
  });
}

export function useUpdateLifestyleProfile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: LifestyleProfile) => api.updateLifestyleProfile(patch),
    onSuccess: () => invalidate(qk.lifestyle),
  });
}

export function useUpdateConsentSettings() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: Partial<ConsentSettings>) => api.updateConsentSettings(patch),
    onSuccess: () => {
      invalidate(qk.consent);
      toast.success("Privacy settings updated");
    },
    onError: () => toast.error("Couldn't save that setting"),
  });
}

export function useUpdateNotificationPreferences() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      api.updateNotificationPreferences(patch),
    onSuccess: () => invalidate(qk.notificationPrefs),
    onError: () => toast.error("Couldn't save that setting"),
  });
}

export function useExportAllData() {
  return useMutation({
    mutationFn: () => api.exportAllData(),
    onError: () => toast.error("Export failed"),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api.deleteAccount(),
    onError: () => toast.error("Couldn't delete your account — try again or contact support"),
  });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ content, onDelta }: { content: string; onDelta?: (delta: string) => void }) =>
      api.sendChatMessage(content, onDelta),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.chat }),
    onError: () => toast.error("The assistant is unavailable right now"),
  });
}

export function useCreateShareLink() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateShareLinkInput) => api.createShareLink(input),
    onSuccess: () => {
      invalidate(qk.shareLinks);
      toast.success("Share link created");
    },
    onError: () => toast.error("Couldn't create the share link"),
  });
}

export function useRevokeShareLink() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: ID) => api.revokeShareLink(id),
    onSuccess: () => {
      invalidate(qk.shareLinks);
      toast.success("Link revoked");
    },
    onError: () => toast.error("Couldn't revoke the link"),
  });
}

export function useAddDependent() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: AddDependentInput) => api.addDependent(input),
    onSuccess: (m) => {
      invalidate(qk.household);
      toast.success(`${m.name} added to your household`);
    },
    onError: () => toast.error("Couldn't add that dependent"),
  });
}

export function useGrantAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { subjectId: ID; granteeEmail: string; scope: "summary" | "full" }) =>
      api.grantAccess(input),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: qk.accessGrants(g.subjectId) });
      toast.success(`Access granted to ${g.granteeEmail}`);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Couldn't grant access"),
  });
}

export function useRevokeAccessGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: ID; subjectId: ID }) => api.revokeAccessGrant(id),
    onSuccess: (_, { subjectId }) => {
      qc.invalidateQueries({ queryKey: qk.accessGrants(subjectId) });
      toast.success("Access revoked");
    },
    onError: () => toast.error("Couldn't revoke access"),
  });
}
