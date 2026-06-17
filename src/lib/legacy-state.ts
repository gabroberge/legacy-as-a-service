import {
  AI_REVIEW_COMMENTS,
  CONVENTION_SEEDS,
  DEFER_MIGRATION_INCIDENTS,
  DEPENDENCY_MAP_LABELS,
  INCIDENT_SEEDS,
  LEGACY_SYSTEM_NAMES,
  MIGRATION_BLOCKERS,
  OWNERSHIP_INCIDENTS,
  REFACTOR_SEEDS,
  SIMPLIFY_VER_LABELS,
  pick,
} from "./content-pool";
import { measureNode } from "./dep-node-layout";

export const STORAGE_KEY = "laas-control-plane";
const LEGACY_DEP_KEY = "laas-dep-map-positions";

export type NodeVariant = "default" | "deprecated" | "blocked";

export interface LegacyNode {
  id: string;
  label: string;
  ver: string;
  x: number;
  y: number;
  w: number;
  h: number;
  variant: NodeVariant;
  verDanger?: boolean;
  linksTo?: string;
}

export type RefactorStatus = "Proposed" | "Discussed" | "Deferred" | "Blocked" | "Forgotten";

export interface RefactorItem {
  id: string;
  title: string;
  owner: string;
  risk: string;
  targetQuarter: string;
  status: RefactorStatus;
  reason: string;
}

export type ConventionStatus = "Active" | "Disputed" | "Zombie" | "Deprecated but enforced";

export interface ConventionItem {
  id: string;
  name: string;
  originStory: string;
  currentValue: string;
  currentCost: string;
  status: ConventionStatus;
}

export type ReviewClassification =
  | "unclassified"
  | "Useful"
  | "Noise"
  | "Historically motivated"
  | "Confidently wrong"
  | "Needs human context";

export interface ReviewComment {
  id: string;
  text: string;
  classification: ReviewClassification;
}

export type IncidentLevel = "ok" | "info" | "warn" | "blocked" | "critical" | "noise";

export interface Incident {
  id: string;
  level: IncidentLevel;
  text: string;
  ts: number;
}

export interface LegacyState {
  metrics: {
    debtStability: number;
    migrationRisk: number;
    ownershipClarity: number;
    conventionPreservation: number;
    aiReviewNoise: number;
    refactorPipelineStatus: number;
    blockers: number;
  };
  nodes: LegacyNode[];
  refactors: RefactorItem[];
  conventions: ConventionItem[];
  reviewComments: ReviewComment[];
  incidents: Incident[];
  simplifyCount: number;
}

const DEFAULT_NODE_LAYOUT: Omit<LegacyNode, "label" | "ver" | "w" | "h">[] = [
  { id: "monolith-core", x: 72, y: 88, variant: "deprecated" },
  { id: "api-gateway", x: 248, y: 64, variant: "default" },
  { id: "tmp_service_FINAL", x: 408, y: 108, variant: "default" },
  { id: "migration-target", x: 500, y: 72, variant: "blocked", verDanger: true },
  { id: "cron-v1-backup", x: 72, y: 300, variant: "deprecated" },
  { id: "auth-legacy", x: 248, y: 328, variant: "default" },
  { id: "data2_final_new", x: 408, y: 368, variant: "default" },
  { id: "kafka-maybe", x: 500, y: 408, variant: "default" },
];

function buildDefaultNodes(): LegacyNode[] {
  return DEFAULT_NODE_LAYOUT.map((n) => {
    const meta = DEPENDENCY_MAP_LABELS[n.id]!;
    const { w, h } = measureNode(meta.label, meta.ver);
    return { ...n, w, h, label: meta.label, ver: meta.ver };
  });
}

const DEFAULT_NODES = buildDefaultNodes();

const QUARTERS = ["Q1 FY2026", "Q2 FY2026", "Q3 FY2026", "Q4 FY2026", "Q1 FY2027"];
const MAX_QUEUE_ITEMS = 40;

let state: LegacyState = defaultState();
const listeners = new Set<() => void>();

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function seedRefactors(count = 10): RefactorItem[] {
  return REFACTOR_SEEDS.slice(0, count).map((r, i) => ({
    id: `r${i + 1}`,
    ...r,
  }));
}

function seedConventions(count = 10): ConventionItem[] {
  return CONVENTION_SEEDS.slice(0, count).map((c, i) => ({
    id: `c${i + 1}`,
    ...c,
  }));
}

function seedIncidents(count = 5): Incident[] {
  const base = Date.now();
  return INCIDENT_SEEDS.slice(-count).map((inc, i) => ({
    id: `i${i}`,
    level: inc.level,
    text: inc.text,
    ts: base - (count - i) * 45000,
  }));
}

export function defaultState(): LegacyState {
  return {
    metrics: {
      debtStability: 72,
      migrationRisk: 41,
      ownershipClarity: 12,
      conventionPreservation: 68,
      aiReviewNoise: 47,
      refactorPipelineStatus: 23,
      blockers: 3,
    },
    nodes: buildDefaultNodes(),
    refactors: seedRefactors(12),
    conventions: seedConventions(12),
    reviewComments: [],
    incidents: seedIncidents(8),
    simplifyCount: 0,
  };
}

function migrateLegacyDepPositions(s: LegacyState) {
  try {
    const raw = localStorage.getItem(LEGACY_DEP_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Record<string, { x: number; y: number }>;
    for (const node of s.nodes) {
      const pos = saved[node.id];
      if (pos && node.id !== "migration-target") {
        node.x = pos.x;
        node.y = pos.y;
      }
    }
  } catch {
    /* ignore */
  }
}

export function loadState(): LegacyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = defaultState();
      migrateLegacyDepPositions(s);
      return s;
    }
    const parsed = JSON.parse(raw) as LegacyState;
    return { ...defaultState(), ...parsed, metrics: { ...defaultState().metrics, ...parsed.metrics } };
  } catch {
    return defaultState();
  }
}

export function saveState(s: LegacyState = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function getState() {
  return state;
}

export function commit(mutator: (s: LegacyState) => void) {
  mutator(state);
  saveState();
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetState() {
  state = defaultState();
  saveState();
  listeners.forEach((fn) => fn());
}

export function addIncident(level: IncidentLevel, text: string) {
  commit((s) => {
    s.incidents.unshift({ id: uid(), level, text, ts: Date.now() });
    if (s.incidents.length > 200) s.incidents.length = 200;
  });
}

export function deferMigration() {
  commit((s) => {
    s.metrics.debtStability = clamp(s.metrics.debtStability + 8);
    s.metrics.migrationRisk = clamp(s.metrics.migrationRisk - 12);
    s.metrics.refactorPipelineStatus = clamp(s.metrics.refactorPipelineStatus - 5);
  });
  addIncident("warn", pick(DEFER_MIGRATION_INCIDENTS));
}

export function runAIReviewBatch() {
  const count = 3 + Math.floor(Math.random() * 4);
  commit((s) => {
    for (let i = 0; i < count; i++) {
      s.reviewComments.unshift({
        id: uid(),
        text: pick(AI_REVIEW_COMMENTS),
        classification: "unclassified",
      });
    }
    s.metrics.aiReviewNoise = clamp(s.metrics.aiReviewNoise + count * 3);
    if (s.reviewComments.length > 80) s.reviewComments.length = 80;
  });
  addIncident("noise", `${count} low-context review comments generated`);
}

export function clarifyOwnership() {
  if (Math.random() < 0.7) {
    commit((s) => {
      s.metrics.ownershipClarity = clamp(s.metrics.ownershipClarity - 5);
      s.metrics.blockers += 1;
    });
    addIncident("ok", pick(OWNERSHIP_INCIDENTS.failed));
  } else {
    commit((s) => {
      s.metrics.ownershipClarity = clamp(s.metrics.ownershipClarity + 4);
    });
    addIncident("info", pick(OWNERSHIP_INCIDENTS.brief));
  }
}

export function simplifyArchitectureAction() {
  commit((s) => {
    s.simplifyCount += 1;
    const label = pick(LEGACY_SYSTEM_NAMES);
    const ver = pick(SIMPLIFY_VER_LABELS);
    const { w, h } = measureNode(label, ver);
    const id = `facade-${s.simplifyCount}-${label.slice(0, 12).replace(/[^a-z0-9-]/gi, "")}`;
    s.nodes.push({
      id,
      label,
      ver,
      x: 180 + s.simplifyCount * 8,
      y: 120 + (s.simplifyCount % 3) * 18,
      w,
      h,
      variant: "default",
      linksTo: "migration-target",
    });
    s.metrics.blockers += 1;
    s.metrics.debtStability = clamp(s.metrics.debtStability + 3);
    s.metrics.migrationRisk = clamp(s.metrics.migrationRisk + 5);
  });
  addIncident("critical", "developer attempted simplification");
}

export function preserveConventionAction() {
  const conv = state.conventions[Math.floor(Math.random() * state.conventions.length)];
  commit((s) => {
    s.metrics.conventionPreservation = clamp(s.metrics.conventionPreservation + 6);
    const c = s.conventions.find((x) => x.id === conv?.id);
    if (c && c.status !== "Deprecated but enforced") c.status = "Deprecated but enforced";
  });
  addIncident("info", `obsolete convention preserved: ${conv?.name ?? "unknown"}`);
}

export function generateBlocker() {
  const blocker = pick(MIGRATION_BLOCKERS);
  commit((s) => {
    s.metrics.blockers += 1;
    s.metrics.refactorPipelineStatus = clamp(s.metrics.refactorPipelineStatus - 8);
    s.metrics.migrationRisk = clamp(s.metrics.migrationRisk + 6);
  });
  addIncident("blocked", blocker);
}

export function discoverConvention() {
  const used = new Set(state.conventions.map((c) => c.name));
  const available = CONVENTION_SEEDS.filter((c) => !used.has(c.name));
  if (!available.length) {
    addIncident("info", "convention discovery exhausted — registry complete");
    return;
  }
  const seed = pick(available);
  commit((s) => {
    s.conventions.unshift({ id: uid(), ...seed });
    if (s.conventions.length > MAX_QUEUE_ITEMS) s.conventions.length = MAX_QUEUE_ITEMS;
    s.metrics.conventionPreservation = clamp(s.metrics.conventionPreservation + 4);
  });
  addIncident("info", `convention discovered: ${seed.name}`);
}

export function proposeRefactor() {
  const used = new Set(state.refactors.map((r) => r.title));
  const available = REFACTOR_SEEDS.filter((r) => !used.has(r.title));
  if (!available.length) {
    addIncident("warn", "refactor pipeline saturated — nothing left to propose");
    return;
  }
  const seed = pick(available);
  commit((s) => {
    s.refactors.unshift({
      id: uid(),
      ...seed,
      owner: seed.owner === "unknown" ? "unknown" : seed.owner,
    });
    if (s.refactors.length > MAX_QUEUE_ITEMS) s.refactors.length = MAX_QUEUE_ITEMS;
    s.metrics.refactorPipelineStatus = clamp(s.metrics.refactorPipelineStatus - 3);
    s.metrics.blockers += Math.random() < 0.15 ? 1 : 0;
  });
  addIncident("info", `refactor proposed: ${seed.title}`);
}

export function classifyReview(id: string, classification: ReviewClassification) {
  commit((s) => {
    const c = s.reviewComments.find((x) => x.id === id);
    if (!c || c.classification !== "unclassified") return;
    c.classification = classification;
    if (classification === "Noise" || classification === "Confidently wrong") {
      s.metrics.aiReviewNoise = clamp(s.metrics.aiReviewNoise + 2);
    } else if (classification === "Useful") {
      s.metrics.aiReviewNoise = clamp(s.metrics.aiReviewNoise - 1);
    }
  });
}

export function refactorAction(id: string, action: "defer" | "block" | "unknown" | "forget") {
  commit((s) => {
    const r = s.refactors.find((x) => x.id === id);
    if (!r) return;
    if (action === "defer") {
      const qi = QUARTERS.indexOf(r.targetQuarter);
      r.targetQuarter = QUARTERS[Math.min(qi + 1, QUARTERS.length - 1)]!;
      r.status = "Deferred";
      s.metrics.refactorPipelineStatus = clamp(s.metrics.refactorPipelineStatus - 4);
    } else if (action === "block") {
      r.status = "Blocked";
      s.metrics.blockers += 1;
    } else if (action === "unknown") {
      r.owner = "unknown";
      s.metrics.ownershipClarity = clamp(s.metrics.ownershipClarity - 3);
    } else if (action === "forget") {
      r.status = "Forgotten";
      r.reason = "Archived without resolution";
    }
  });
  addIncident("info", `refactor updated: ${action}`);
}

export function conventionAction(id: string, action: "preserve" | "dispute" | "rent" | "zombie") {
  commit((s) => {
    const c = s.conventions.find((x) => x.id === id);
    if (!c) return;
    if (action === "preserve") {
      c.status = "Deprecated but enforced";
      s.metrics.conventionPreservation = clamp(s.metrics.conventionPreservation + 5);
    } else if (action === "dispute") {
      c.status = "Disputed";
    } else if (action === "rent") {
      c.currentCost = "Still not paying rent";
    } else if (action === "zombie") {
      c.status = "Zombie";
      s.metrics.conventionPreservation = clamp(s.metrics.conventionPreservation + 3);
    }
  });
  const c = state.conventions.find((x) => x.id === id);
  addIncident("info", `convention ${action}: ${c?.name ?? id}`);
}

export function updateNodes(nodes: LegacyNode[]) {
  commit((s) => {
    s.nodes = nodes;
  });
}

export function resetNodes() {
  commit((s) => {
    s.nodes = buildDefaultNodes();
    s.simplifyCount = 0;
  });
}

export function addNode(node: LegacyNode) {
  commit((s) => {
    s.nodes.push(node);
  });
}

// init
state = loadState();
