const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'dualcrit.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * One request helper for the whole app, so every call handles errors the same
 * way. The previous project had twenty methods, half returning `{ success }`
 * and half throwing, and call sites had to know which.
 */
async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = tokenStore.get();

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
      }
    } catch {
      // response had no JSON body; keep the default message
    }
    throw new ApiError(response.status, message);
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export interface Student {
  id: string;
  studentId: string;
  fullName: string;
}

export type ActivityType = 'interview' | 'pov_hmw';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  interview: 'Interview',
  pov_hmw: 'POV & HMW',
};

export interface Activity {
  id: string;
  code: string;
  name: string;
  type: ActivityType;
  status: string;
  updatedAt: string;
  currentStep: string | null;
  startedAt: string | null;
  selectedScenarioTag: string | null;
  selectedQuestionContent: string | null;
  selectedPovContent: string | null;
  selectedHmwContents: string[] | null;
  /** True once the host has recorded the team's needs and insights. */
  needsInsightsSet: boolean;
  isHost: boolean;
  members: string[];
}

/** Anonymous by design — the server sends no author for a contribution. */
export interface Contribution {
  id: string;
  type: string;
  content: { question?: string; statement?: string };
  orderIndex: number;
  isSelected: boolean;
  isMine: boolean;
}

export interface VotingState {
  activityId: string;
  type: string;
  roundId: string;
  status: 'active' | 'completed' | 'cancelled';
  maxSelections: number;
  tally: Record<string, number>;
  votedCount: number;
  memberCount: number;
  isComplete: boolean;
  winners: string[];
}

export interface Criterion {
  standard: string;
  score: number;
  response: string;
  /** One concrete action, or "" when the entry is already fully met. */
  nextStep?: string;
}

export interface StoredEvaluation {
  id: string;
  scope: 'team' | 'user';
  evaluationType: string;
  model: string | null;
  createdAt: string;
  feedback: {
    /** Question feedback: one entry per rubric violation, or a single "None". */
    feedback?: { mistake: string; explanation: string; nextStep?: string }[];
    /** Interview feedback: the five rubric scores. */
    criteria?: Criterion[];
  };
}

/** The team's shared research, recorded once by the host. */
export interface PovHmwData {
  needs: string[];
  insights: string[];
  /** False until the host has recorded them, which gates the POV step. */
  isSet: boolean;
}

/** One rubric line. POV and HMW share the shape, so one renderer serves both. */
export interface RubricCriterion {
  standard: string;
  reason: string;
  score: number;
  /** One concrete action, or "" when the entry is already fully met. */
  nextStep?: string;
}

/** A statement or question with its rubric scores. */
export interface ScoredItem {
  text: string;
  isSelected: boolean;
  criteria: RubricCriterion[];
}

export interface ScoredSet {
  items: ScoredItem[];
}

/**
 * A scored entry with authorship attached.
 *
 * The stored evaluations carry none — that is what keeps voting anonymous — so
 * the server works this out per reader when it assembles the summary.
 */
export interface SummaryScoredItem extends ScoredItem {
  isMine: boolean;
}

/** The POV & HMW equivalent of SessionSummary. */
export interface PovHmwSummary {
  activityName: string;
  needs: string[];
  insights: string[];
  myPov: string | null;
  teamPov: string | null;
  povFeedback: SummaryScoredItem[];
  myHmw: string[];
  teamHmw: string[];
  /** The team's chosen questions and the student's own, merged into one set. */
  hmwFeedback: SummaryScoredItem[];
  summaryText: string;
  /** False when the summary could be shown but not stored. */
  saved: boolean;
}

export interface InterviewMessage {
  role: 'student' | 'persona';
  text: string;
  at: string;
}

export interface InterviewState {
  attempt: number;
  messages: InterviewMessage[];
  openingQuestion: string | null;
  scenarioTag: string | null;
  completed: boolean;
  /** Follow-ups still available after the opening question. */
  followUpsLeft: number;
}

export interface TeamTranscripts {
  ready: boolean;
  completed: number;
  total: number;
  transcripts: {
    studentUuid: string;
    authorName: string;
    isMine: boolean;
    messages: InterviewMessage[];
  }[];
}

export interface SessionSummary {
  activityName: string;
  scenarioTag: string | null;
  myQuestion: string | null;
  teamQuestion: string | null;
  questionFeedback: {
    mistake: string;
    explanation: string;
    nextStep?: string;
  }[];
  transcript: { role: 'student' | 'persona'; text: string }[];
  criteria: Criterion[];
  questionCount: number;
  summaryText: string;
  /** False when the summary could be shown but not stored. */
  saved: boolean;
}

export const api = {
  signIn: (studentId: string, fullName: string) =>
    request<{ token: string; student: Student }>('/auth/sign-in', {
      method: 'POST',
      body: { studentId, fullName },
    }),

  me: () => request<{ student: Student }>('/auth/me'),

  listActivities: () => request<Activity[]>('/activities'),

  createActivity: (name: string, type: ActivityType) =>
    request<Activity>('/activities', { method: 'POST', body: { name, type } }),

  joinActivity: (code: string) =>
    request<Activity>('/activities/join', { method: 'POST', body: { code } }),

  startActivity: (activityId: string) =>
    request<{ ok: true }>(`/activities/${activityId}/start`, {
      method: 'POST',
    }),

  setStep: (activityId: string, step: string) =>
    request<{ ok: true }>(`/activities/${activityId}/step`, {
      method: 'POST',
      body: { step },
    }),

  listContributions: (activityId: string, type: string) =>
    request<Contribution[]>(`/activities/${activityId}/contributions/${type}`),

  submitContribution: (
    activityId: string,
    type: string,
    text: string,
    orderIndex = 1,
  ) =>
    request<Contribution[]>(`/activities/${activityId}/contributions/${type}`, {
      method: 'POST',
      body: { text, orderIndex },
    }),

  questionFeedback: (activityId: string) =>
    request<{ evaluation: StoredEvaluation | null; generating: boolean }>(
      '/activities/' + activityId + '/evaluations/question',
      { method: 'POST' },
    ),

  readQuestionFeedback: (activityId: string) =>
    request<{ evaluation: StoredEvaluation | null }>(
      '/activities/' + activityId + '/evaluations/question',
    ),

  interviewState: (activityId: string) =>
    request<InterviewState>(`/activities/${activityId}/interview`),

  interviewProgress: (activityId: string) =>
    request<{ completed: number; total: number }>(
      `/activities/${activityId}/interview/progress`,
    ),

  interviewAsk: (activityId: string, text: string) =>
    request<InterviewState>(`/activities/${activityId}/interview/ask`, {
      method: 'POST',
      body: { text },
    }),

  interviewComplete: (activityId: string) =>
    request<{ completed: number; total: number }>(
      `/activities/${activityId}/interview/complete`,
      { method: 'POST' },
    ),

  teamTranscripts: (activityId: string) =>
    request<TeamTranscripts>(`/activities/${activityId}/interview/transcripts`),

  interviewFeedback: (activityId: string) =>
    request<{ evaluation: StoredEvaluation | null }>(
      '/activities/' + activityId + '/evaluations/interview',
      { method: 'POST' },
    ),

  sessionSummary: (activityId: string) =>
    request<SessionSummary>('/activities/' + activityId + '/summary'),

  votingState: (activityId: string, type: string) =>
    request<{ state: VotingState | null; myVote: string[] }>(
      `/activities/${activityId}/voting/${type}`,
    ),

  startVoting: (activityId: string, type: string, maxSelections = 1) =>
    request<VotingState>(`/activities/${activityId}/voting/${type}/start`, {
      method: 'POST',
      body: { maxSelections },
    }),

  castVote: (activityId: string, type: string, optionIds: string[]) =>
    request<VotingState>(`/activities/${activityId}/voting/${type}/vote`, {
      method: 'POST',
      body: { optionIds },
    }),

  povHmwData: (activityId: string) =>
    request<PovHmwData>(`/activities/${activityId}/pov-hmw`),

  setNeedsInsights: (activityId: string, needs: string[], insights: string[]) =>
    request<PovHmwData>(`/activities/${activityId}/pov-hmw`, {
      method: 'POST',
      body: { needs, insights },
    }),

  povFeedback: (activityId: string) =>
    request<{ evaluation: { feedback: ScoredSet } | null }>(
      `/activities/${activityId}/evaluations/pov`,
      { method: 'POST' },
    ),

  hmwFeedback: (activityId: string) =>
    request<{
      mine: { feedback: ScoredSet } | null;
      team: { feedback: ScoredSet } | null;
    }>(`/activities/${activityId}/evaluations/hmw`, { method: 'POST' }),

  povHmwSummary: (activityId: string) =>
    request<PovHmwSummary>(`/activities/${activityId}/summary/pov-hmw`),
};
