import { API } from "./config"
import type { Profile, FullAssessment, Roadmap, LoanRecommendation } from "./types"

// ── Legacy types (used by existing apply/ banker/ mihan/ routes) ──
export type { LoanRecommendation }
export type ProfileSummary = Profile
export interface ScoreResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: Profile & Record<string, any>
  score: import("./types").MihanScore
}
export interface AuditEntry {
  id: number
  timestamp: string
  profile_id: string
  profile_name: string
  composite_score: number
  tier: string
  event: string
  details: string
}

export async function getProfiles(): Promise<Profile[]> {
  const res = await fetch(`${API}/profiles`)
  if (!res.ok) throw new Error("Failed to fetch profiles")
  return res.json()
}

export async function getFullAssessment(profileId: string, version: "v1" | "v2" = "v2"): Promise<FullAssessment> {
  const res = await fetch(`${API}/profiles/${profileId}/full-assessment?version=${version}`)
  if (!res.ok) throw new Error("Failed to fetch assessment")
  return res.json()
}

export async function getExplanation(profileId: string, lang = "ar"): Promise<string> {
  const res = await fetch(`${API}/profiles/${profileId}/explanation?lang=${lang}`)
  const data = await res.json()
  return data.text
}

export async function getRoadmap(profileId: string): Promise<Roadmap> {
  const res = await fetch(`${API}/profiles/${profileId}/roadmap`)
  if (!res.ok) throw new Error("Failed to fetch roadmap")
  return res.json()
}

export async function requestHumanReview(profileId: string, notes = ""): Promise<void> {
  await fetch(`${API}/profiles/${profileId}/human-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  })
}

export async function simulateRejection(): Promise<{ reason_ar: string; suggestion_ar: string }> {
  const res = await fetch(`${API}/rejection-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  return res.json()
}

export function getProofOfIncomeUrl(profileId: string): string {
  return `${API}/profiles/${profileId}/proof-of-income`
}

export async function confirmBufferSelection(
  profileId: string,
  buffer: "escrow" | "direct-debit"
): Promise<void> {
  await fetch(`${API}/profiles/${profileId}/human-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notes: `Buffer selected: ${buffer === "escrow" ? "Two-Month Escrow Holdback" : "SAMA Direct Debit Mandate on legacy account"}`,
    }),
  })
}

export async function getScoreByVersion(profileId: string, version: "v1" | "v2"): Promise<import("./types").MihanScore | null> {
  try {
    const res = await fetch(`${API}/profiles/${profileId}/score?version=${version}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.score ?? null
  } catch {
    return null
  }
}

// ── Legacy api object (used by existing apply/ banker/ mihan/ routes) ──
export const api = {
  getProfiles: () => fetch(`${API}/profiles`).then(r => r.json()) as Promise<Profile[]>,
  getScore: (id: string) => fetch(`${API}/profiles/${id}/score`).then(r => r.json()) as Promise<ScoreResponse>,
  getExplanation: (id: string, lang = "ar") =>
    fetch(`${API}/profiles/${id}/explanation?lang=${lang}`).then(r => r.json()) as Promise<{ text: string }>,
  requestHumanReview: (id: string, notes = "") =>
    fetch(`${API}/profiles/${id}/human-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }).then(r => r.json()),
  getAuditLog: () => fetch(`${API}/audit-log`).then(r => r.json()) as Promise<AuditEntry[]>,
  proofOfIncomeUrl: (id: string) => `${API}/profiles/${id}/proof-of-income`,
}
