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

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
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
  isHost: boolean;
  members: string[];
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

  setStep: (activityId: string, step: string) =>
    request<{ ok: true }>(`/activities/${activityId}/step`, {
      method: 'POST',
      body: { step },
    }),
};
