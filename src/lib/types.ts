/**
 * Raag — canonical domain models.
 *
 * These are the ONLY shapes the UI knows about. The data source (mock today,
 * real API tomorrow) must return exactly these. See docs/HANDOFF.md.
 */

export type ID = string;
export type ISODate = string; // "2026-11-12" or full ISO timestamp

export type Severity = "info" | "success" | "warning" | "critical";
export type MarkerStatus = "low" | "normal" | "high" | "critical";
export type Trend = "up" | "down" | "flat";

export interface UserProfile {
  id: ID;
  name: string;
  initials: string;
  email: string;
  age: number;
  /** Canonical, writable — `age` above is derived from this where available. */
  dateOfBirth?: ISODate;
  sex: string;
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
  timezone: string;
  units: "metric" | "imperial";
  plan: PlanTier;
  avatarUrl?: string | null;
  /** Set once the post-signup onboarding wizard has been completed. */
  onboardingCompleted?: boolean;
}

export type PlanTier = "free" | "pro" | "family" | "clinic";

export interface HealthScore {
  score: number; // 0-100
  delta: number;
  lastSync: string;
  pillars: { label: string; value: number; weight: number }[];
}

export interface Insight {
  id: ID;
  title: string;
  body: string;
  severity: Exclude<Severity, "critical"> | "critical";
  source?: string;
  createdAt?: ISODate;
  actionLabel?: string;
}

export interface SleepPoint {
  day: string;
  hours: number;
  deep: number;
}
export interface ActivityPoint {
  day: string;
  steps: number;
  cal: number;
}

export interface LabMarker {
  id?: ID;
  name: string;
  value: number;
  unit: string;
  range: string;
  status: MarkerStatus;
  delta: number;
  collectedAt?: ISODate;
  history?: { month: string; value: number }[];
}

export interface MedicalRecord {
  id: ID;
  type: string;
  title: string;
  provider: string;
  date: ISODate;
  tag: string;
  fileUrl?: string | null;
  sizeKb?: number;
  summary?: string;
  /** Document-parsing progress — see docs/raag-architecture "parse-record". */
  parseStatus?: "pending" | "processing" | "done" | "failed" | "skipped";
}

export interface WearableConnection {
  id?: ID;
  name: string;
  desc: string;
  connected: boolean;
  last: string;
  color: string;
}

export interface Medication {
  id: ID;
  name: string;
  dose: string;
  schedule: string;
  adherence: number;
  next: string;
  type: "Supplement" | "Prescription" | string;
  refillsLeft?: number;
  interactions?: string[];
}

export interface DoseLog {
  id: ID;
  medicationId: ID;
  takenAt: ISODate;
  skipped?: boolean;
}

export interface Goal {
  id: ID;
  title: string;
  progress: number;
  category: string;
  streak: number;
  target?: string;
  dueDate?: ISODate;
}

export interface FamilyMember {
  id?: ID;
  relation: string;
  conditions: string[];
  age: number;
}

export interface LifestyleProfile {
  alcohol?: string;
  smoking?: string;
  exercise?: string;
  diet?: string;
}

export interface ConsentSettings {
  shareDeidentified: boolean;
  aiUseFamilyHistory: boolean;
  shareWithPcp: boolean;
  pcpContact?: string;
}

export interface NotificationPreferences {
  medicationReminders: boolean;
  weeklyBrief: boolean;
  newLabResults: boolean;
  trendAlerts: boolean;
}

export interface RiskFactor {
  name: string;
  level: "Low" | "Moderate" | "Elevated" | "High" | string;
  pct: number;
  note: string;
  action: string;
}

/* ---------- v2 feature models ---------- */

export interface Appointment {
  id: ID;
  title: string;
  provider: string;
  specialty: string;
  start: ISODate;
  durationMin: number;
  location: string;
  mode: "in-person" | "video" | "phone";
  status: "upcoming" | "completed" | "cancelled";
  prepNotes?: string[];
}

export type VitalKind =
  "weight" | "bloodPressure" | "restingHr" | "spo2" | "temperature" | "glucose" | "mood";

export interface VitalEntry {
  id: ID;
  kind: VitalKind;
  value: number;
  secondary?: number; // diastolic for BP
  unit: string;
  recordedAt: ISODate;
  note?: string;
  source: "manual" | "device" | "clinic";
}

export interface SymptomEntry {
  id: ID;
  label: string;
  severity: number; // 1-10
  bodyArea: string;
  startedAt: ISODate;
  tags: string[];
  note?: string;
}

export interface NutritionEntry {
  id: ID;
  meal: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt: ISODate;
}

export interface NutritionTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

export interface TimelineEvent {
  id: ID;
  date: ISODate;
  kind: "lab" | "visit" | "med" | "vital" | "goal" | "device" | "note";
  title: string;
  detail: string;
  severity?: Severity;
}

export interface AppNotification {
  id: ID;
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
  kind: "reminder" | "result" | "insight" | "system";
}

export interface CareTeamMember {
  id: ID;
  name: string;
  role: string;
  org: string;
  phone: string;
  sharing: boolean;
}

export interface ReportRequest {
  scope: string[];
  from: ISODate;
  to: ISODate;
  format: "pdf" | "json" | "fhir";
}

export interface Citation {
  title: string;
  date: string;
  /** Row id the citation traces back to, for a future "jump to source". */
  sourceId?: string;
  /** Table the sourceId lives in, e.g. "lab_markers" or "source_documents". */
  sourceTable?: string;
}

export interface ChatMessage {
  id: ID;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  createdAt?: ISODate;
  pending?: boolean;
}

export type ShareScope = "summary" | "labs" | "medications" | "full";

export interface ShareLink {
  id: ID;
  token: string;
  label?: string;
  scope: ShareScope;
  expiresAt: ISODate;
  revokedAt?: ISODate;
  lastAccessedAt?: ISODate;
  accessCount: number;
  createdAt: ISODate;
}

export interface CreateShareLinkInput {
  label?: string;
  scope: ShareScope;
  expiresInDays: number;
}

/** The read-only view a share-link visitor sees — assembled server-side
 * by the get-shared-record Edge Function, never fetched through RaagApi
 * (the visitor has no session at all). See src/lib/share.ts. */
export interface SharedRecordView {
  subjectName: string;
  age: number | null;
  sex: string | null;
  bloodType: string | null;
  activeConditions: { name: string; status: string; diagnosed_at: string | null }[];
  currentMedications: {
    id: string;
    name: string;
    dose: string | null;
    schedule: string | null;
    type: string;
    active: boolean;
  }[];
  latestVitals: {
    kind: string;
    value: number;
    secondary: number | null;
    unit: string;
    recorded_at: string;
  }[];
  scope: ShareScope;
  generatedAt: ISODate;
  labMarkers?: {
    name: string;
    value: number;
    unit: string;
    range_low: number | null;
    range_high: number | null;
    collected_at: string;
  }[];
  doseLogs?: { medication_id: string; taken_at: string; skipped: boolean }[];
  symptoms?: { label: string; severity: number; body_area: string | null; started_at: string }[];
  familyHistory?: { relation: string; age: number | null; conditions: string[] | null }[];
}

/* ---------- household / family risk graph (V2) ---------- */

export interface HouseholdMember {
  id: ID; // health_subjects.id — same as the user id for kind="self"
  name: string;
  kind: "self" | "dependent";
  relation?: string;
  age?: number;
  /** Highest risk level across computeRiskFactors() for this subject —
   * "None" means either no elevated factors or not enough data yet, not
   * a diagnosis either way. */
  riskLevel: "None" | "Low" | "Moderate" | "Elevated" | "High";
  topRiskFactor?: string;
}

export interface AddDependentInput {
  name: string;
  dateOfBirth?: string;
  sex?: string;
  relation?: string;
}

export interface AccessGrant {
  id: ID;
  subjectId: ID;
  granteeUserId: string;
  granteeName: string;
  granteeEmail: string;
  scope: "full" | "summary" | "specific";
  grantedAt: ISODate;
  revokedAt?: ISODate;
}
