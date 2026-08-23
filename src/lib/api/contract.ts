/**
 * The single service contract the whole UI depends on.
 *
 * To make Raag functional, implement this interface against a real
 * backend (see src/lib/api/http.ts) and flip the adapter in ./index.ts.
 * No component imports mock data directly.
 */
import type {
  AccessGrant,
  ActivityPoint,
  AddDependentInput,
  Appointment,
  AppNotification,
  CareTeamMember,
  ChatMessage,
  ConsentSettings,
  CreateShareLinkInput,
  FamilyMember,
  Goal,
  HealthScore,
  HouseholdMember,
  ID,
  Insight,
  LabMarker,
  LifestyleProfile,
  MedicalRecord,
  Medication,
  NotificationPreferences,
  NutritionEntry,
  NutritionTargets,
  ReportRequest,
  RiskFactor,
  ShareLink,
  SleepPoint,
  SymptomEntry,
  TimelineEvent,
  UserProfile,
  VitalEntry,
  VitalKind,
  WearableConnection,
} from "../types";

export interface RaagApi {
  /* profile + overview */
  getProfile(): Promise<UserProfile>;
  updateProfile(patch: Partial<UserProfile>): Promise<UserProfile>;
  getHealthScore(): Promise<HealthScore>;
  getInsights(): Promise<Insight[]>;
  dismissInsight(id: ID): Promise<void>;
  getSleep(range?: "7d" | "30d" | "90d"): Promise<SleepPoint[]>;
  getActivity(range?: "7d" | "30d" | "90d"): Promise<ActivityPoint[]>;

  /* labs + records */
  getLabMarkers(): Promise<LabMarker[]>;
  getLabTrend(marker: string): Promise<{ month: string; value: number }[]>;
  getRecords(): Promise<MedicalRecord[]>;
  uploadRecord(file: File): Promise<MedicalRecord>;
  deleteRecord(id: ID): Promise<void>;

  /* devices */
  getWearables(): Promise<WearableConnection[]>;
  toggleWearable(name: string, connect: boolean): Promise<WearableConnection>;

  /* medications */
  getMedications(): Promise<Medication[]>;
  logDose(medicationId: ID, taken: boolean): Promise<Medication>;
  addMedication(input: Omit<Medication, "id" | "adherence">): Promise<Medication>;

  /* goals */
  getGoals(): Promise<Goal[]>;
  addGoal(input: Omit<Goal, "id" | "progress" | "streak">): Promise<Goal>;
  updateGoal(id: ID, patch: Partial<Goal>): Promise<Goal>;
  deleteGoal(id: ID): Promise<void>;

  /* family + risk */
  getFamilyHistory(): Promise<FamilyMember[]>;
  addFamilyMember(input: FamilyMember): Promise<FamilyMember>;
  getRisks(): Promise<RiskFactor[]>;

  /* household / family risk graph — dependents you manage + who has
     access to whom, built on the access_grants permission system */
  getHouseholdMembers(): Promise<HouseholdMember[]>;
  addDependent(input: AddDependentInput): Promise<HouseholdMember>;
  getAccessGrants(subjectId: ID): Promise<AccessGrant[]>;
  grantAccess(input: {
    subjectId: ID;
    granteeEmail: string;
    scope: "summary" | "full";
  }): Promise<AccessGrant>;
  revokeAccessGrant(id: ID): Promise<void>;

  getLifestyleProfile(): Promise<LifestyleProfile>;
  updateLifestyleProfile(patch: LifestyleProfile): Promise<LifestyleProfile>;

  /* v2 surfaces */
  getAppointments(): Promise<Appointment[]>;
  addAppointment(input: Omit<Appointment, "id" | "status">): Promise<Appointment>;
  cancelAppointment(id: ID): Promise<void>;

  getVitals(kind?: VitalKind): Promise<VitalEntry[]>;
  addVital(
    input: Omit<VitalEntry, "id" | "source"> & { source?: VitalEntry["source"] },
  ): Promise<VitalEntry>;

  getSymptoms(): Promise<SymptomEntry[]>;
  addSymptom(input: Omit<SymptomEntry, "id">): Promise<SymptomEntry>;
  deleteSymptom(id: ID): Promise<void>;

  getNutrition(
    date?: string,
  ): Promise<{ entries: NutritionEntry[]; targets: NutritionTargets; waterMl: number }>;
  addNutrition(input: Omit<NutritionEntry, "id">): Promise<NutritionEntry>;
  addWater(ml: number): Promise<number>;

  getTimeline(): Promise<TimelineEvent[]>;

  getNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: ID): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  getCareTeam(): Promise<CareTeamMember[]>;
  setCareSharing(id: ID, sharing: boolean): Promise<CareTeamMember>;

  requestReport(req: ReportRequest): Promise<{ id: ID; status: "queued" }>;

  /* share links (owner-side management; the public viewer side never goes
     through this contract — no session exists for it, see src/lib/share.ts) */
  getShareLinks(): Promise<ShareLink[]>;
  createShareLink(input: CreateShareLinkInput): Promise<ShareLink>;
  revokeShareLink(id: ID): Promise<void>;

  /* account */
  getConsentSettings(): Promise<ConsentSettings>;
  updateConsentSettings(patch: Partial<ConsentSettings>): Promise<ConsentSettings>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  updateNotificationPreferences(
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences>;
  /** Everything Raag has stored about the account, as one JSON-serializable object. */
  exportAllData(): Promise<Record<string, unknown>>;
  /** Permanently deletes the account and everything under it. Irreversible. */
  deleteAccount(): Promise<void>;

  /* AI assistant */
  getChatHistory(): Promise<ChatMessage[]>;
  /**
   * Streams the reply token-by-token via onDelta (if provided), resolving
   * with the final saved ChatMessage once the stream completes. onDelta is
   * optional so callers that just want the final message can omit it.
   */
  sendChatMessage(content: string, onDelta?: (delta: string) => void): Promise<ChatMessage>;
}
