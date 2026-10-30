// Types and fetch helpers for the Go API. Shapes mirror the JSON tags in
// apps/api/internal/planner.

export interface Person {
  id: number
  name: string
  weeklyCapacity: number
}

export interface Project {
  id: number
  name: string
}

export type Status = 'under' | 'ok' | 'over'

export interface WeekLoad {
  personId: number
  personName: string
  weekStart: string
  capacity: number
  planned: number
  tracked: number
  utilisation: number
  status: Status
}

export interface CapacityReport {
  from: string
  to: string
  rows: WeekLoad[]
}

export interface NewAllocation {
  personId: number
  projectId: number
  start: string
  end: string
  hoursPerWeek: number
}

export interface NewTimeEntry {
  personId: number
  projectId: number
  date: string
  minutes: number
}

// ApiError carries the HTTP status and the message from the API's
// {"error": "..."} body.
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? res.statusText)
  }
  return body as T
}

const post = <T>(path: string, data: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data) })

export const api = {
  listPeople: () => request<Person[]>('/people'),
  createPerson: (p: Omit<Person, 'id'>) => post<Person>('/people', p),
  listProjects: () => request<Project[]>('/projects'),
  createProject: (p: Omit<Project, 'id'>) => post<Project>('/projects', p),
  createAllocation: (a: NewAllocation) => post<NewAllocation & { id: number }>('/allocations', a),
  createTimeEntry: (e: NewTimeEntry) => post<NewTimeEntry & { id: number }>('/time-entries', e),
  capacity: (from: string, to: string) =>
    request<CapacityReport>(`/capacity?${new URLSearchParams({ from, to })}`),
}

// Query keys in one place, so mutations invalidate exactly what they change.
export const queryKeys = {
  people: ['people'] as const,
  projects: ['projects'] as const,
  capacity: (from: string, to: string) => ['capacity', from, to] as const,
  allCapacity: ['capacity'] as const,
}
