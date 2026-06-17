import {
  addIncident,
  discoverConvention,
  proposeRefactor,
  clarifyOwnership,
  classifyReview,
  commit,
  conventionAction,
  deferMigration,
  generateBlocker,
  getState,
  preserveConventionAction,
  refactorAction,
  resetState,
  runAIReviewBatch,
  simplifyArchitectureAction,
  subscribe,
} from "../lib/legacy-state";
import type { IncidentLevel, LegacyState } from "../lib/legacy-state";
import { formatIncidentTs } from "../lib/incident-format";
import { initDependencyMaps } from "./dependency-map";

const INCIDENT_CLASS: Record<IncidentLevel, string> = {
  ok: "text-terminal",
  info: "text-muted",
  warn: "text-amber",
  blocked: "text-danger",
  critical: "text-danger",
  noise: "text-amber",
};

const INCIDENT_LABEL: Record<IncidentLevel, string> = {
  ok: "[OK]",
  info: "[INFO]",
  warn: "[WARN]",
  blocked: "[BLOCKED]",
  critical: "[CRITICAL]",
  noise: "[NOISE]",
};

const METRICS: { key: keyof LegacyState["metrics"]; label: string; tone: string; suffix?: string }[] = [
  { key: "debtStability", label: "Debt Stability", tone: "text-terminal" },
  { key: "migrationRisk", label: "Migration Risk", tone: "text-danger" },
  { key: "ownershipClarity", label: "Ownership Clarity", tone: "text-amber" },
  { key: "conventionPreservation", label: "Convention Preservation", tone: "text-terminal" },
  { key: "aiReviewNoise", label: "AI Review Noise", tone: "text-amber" },
  { key: "refactorPipelineStatus", label: "Refactor Pipeline", tone: "text-dim" },
  { key: "blockers", label: "Active Blockers", tone: "text-danger", suffix: "" },
];

export function initControlPlane() {
  const root = document.getElementById("cp-root");
  if (!root || root.dataset.cpInit === "true") return;
  root.dataset.cpInit = "true";

  const panels = root.querySelectorAll<HTMLElement>("[data-cp-panel]");
  const tabs = root.querySelectorAll<HTMLElement>("[data-cp-tab]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.cpTab!;
      tabs.forEach((t) => {
        const active = t.dataset.cpTab === id;
        t.classList.toggle("cp-tab--active", active);
        t.setAttribute("aria-selected", String(active));
      });
      panels.forEach((p) => {
        p.hidden = p.dataset.cpPanel !== id;
      });
      if (id === "deps") {
        requestAnimationFrame(() => {
          root.querySelector("[data-dep-map]")?.dispatchEvent(new Event("dep-map-resize"));
        });
      }
    });
  });

  root.querySelector("[data-action-defer]")?.addEventListener("click", deferMigration);
  root.querySelector("[data-action-ai]")?.addEventListener("click", runAIReviewBatch);
  root.querySelector("[data-action-ownership]")?.addEventListener("click", clarifyOwnership);
  root.querySelector("[data-action-simplify]")?.addEventListener("click", simplifyArchitectureAction);
  root.querySelector("[data-action-preserve]")?.addEventListener("click", preserveConventionAction);
  root.querySelector("[data-action-blocker]")?.addEventListener("click", generateBlocker);
  root.querySelector("[data-action-reset]")?.addEventListener("click", () => {
    if (confirm("Reset all control plane state? This cannot be undone.")) {
      resetState();
      initDependencyMaps(true);
    }
  });

  root.querySelector("[data-action-run-review]")?.addEventListener("click", runAIReviewBatch);
  root.querySelector("[data-action-discover-convention]")?.addEventListener("click", discoverConvention);
  root.querySelector("[data-action-propose-refactor]")?.addEventListener("click", proposeRefactor);

  subscribe(render);
  render();
  initDependencyMaps();
}

function render() {
  const s = getState();
  renderMetrics(s);
  renderRefactors(s);
  renderConventions(s);
  renderReviews(s);
  renderIncidents(s);
  renderOverviewIncidents(s);
}

function renderMetrics(s: LegacyState) {
  const el = document.querySelector("[data-cp-metrics]");
  if (!el) return;
  el.innerHTML = METRICS.map(
    (m) => `
    <div class="rounded-md border border-white/12 bg-panel p-4">
      <div class="mb-1 font-mono text-xs tracking-wider text-dim uppercase">${m.label}</div>
      <div class="text-2xl font-bold ${m.tone}">${Math.round(s.metrics[m.key])}${m.suffix === "" ? "" : "%"}</div>
    </div>`,
  ).join("");
  const blockers = document.querySelector("[data-cp-blockers]");
  if (blockers) blockers.textContent = String(s.metrics.blockers);
}

function renderRefactors(s: LegacyState) {
  const el = document.querySelector("[data-cp-refactors]");
  if (!el) return;
  el.innerHTML = s.refactors
    .map(
      (r) => `
    <div class="rounded-md border border-white/12 bg-panel p-4">
      <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 class="font-semibold">${r.title}</h3>
        <span class="tag ${statusTag(r.status)}">${r.status}</span>
      </div>
      <div class="mb-3 grid gap-1 font-mono text-xs text-muted sm:grid-cols-2">
        <span>owner: ${r.owner}</span>
        <span>risk: ${r.risk}</span>
        <span>target: ${r.targetQuarter}</span>
      </div>
      <p class="mb-3 text-sm text-muted">${r.reason}</p>
      <div class="flex flex-wrap gap-1.5">
        <button type="button" class="cp-mini-btn" data-refactor="${r.id}" data-refactor-action="defer">Defer quarter</button>
        <button type="button" class="cp-mini-btn" data-refactor="${r.id}" data-refactor-action="block">Block</button>
        <button type="button" class="cp-mini-btn" data-refactor="${r.id}" data-refactor-action="unknown">Owner unknown</button>
        <button type="button" class="cp-mini-btn" data-refactor="${r.id}" data-refactor-action="forget">Forget</button>
      </div>
    </div>`,
    )
    .join("");

  el.querySelectorAll("[data-refactor-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      refactorAction(
        (btn as HTMLElement).dataset.refactor!,
        (btn as HTMLElement).dataset.refactorAction as "defer" | "block" | "unknown" | "forget",
      );
    });
  });
}

function statusTag(status: string) {
  if (status === "Blocked") return "tag--blocked";
  if (status === "Deferred" || status === "Forgotten") return "tag--defer";
  if (status === "Discussed") return "tag--deprecated";
  return "tag--live";
}

function renderConventions(s: LegacyState) {
  const el = document.querySelector("[data-cp-conventions]");
  if (!el) return;
  el.innerHTML = `
    <table class="w-full min-w-[640px] border-collapse text-sm">
      <thead>
        <tr class="border-b border-white/12 text-left font-mono text-xs text-muted uppercase">
          <th class="p-3">Name</th>
          <th class="p-3">Origin</th>
          <th class="p-3">Value</th>
          <th class="p-3">Cost</th>
          <th class="p-3">Status</th>
          <th class="p-3"></th>
        </tr>
      </thead>
      <tbody>
        ${s.conventions
          .map(
            (c) => `
          <tr class="border-b border-white/7 hover:bg-amber/2">
            <td class="p-3 font-mono text-xs text-amber">${c.name}</td>
            <td class="p-3 text-muted">${c.originStory}</td>
            <td class="p-3">${c.currentValue}</td>
            <td class="p-3 text-muted">${c.currentCost}</td>
            <td class="p-3"><span class="tag tag--deprecated text-[0.6rem]">${c.status}</span></td>
            <td class="p-3">
              <div class="flex flex-wrap gap-1">
                <button type="button" class="cp-mini-btn" data-convention="${c.id}" data-convention-action="preserve">Preserve</button>
                <button type="button" class="cp-mini-btn" data-convention="${c.id}" data-convention-action="dispute">Dispute</button>
                <button type="button" class="cp-mini-btn" data-convention="${c.id}" data-convention-action="rent">Pays rent?</button>
                <button type="button" class="cp-mini-btn" data-convention="${c.id}" data-convention-action="zombie">Zombie</button>
              </div>
            </td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;

  el.querySelectorAll("[data-convention-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      conventionAction(
        (btn as HTMLElement).dataset.convention!,
        (btn as HTMLElement).dataset.conventionAction as "preserve" | "dispute" | "rent" | "zombie",
      );
    });
  });
}

function renderReviews(s: LegacyState) {
  const el = document.querySelector("[data-cp-reviews]");
  if (!el) return;
  if (!s.reviewComments.length) {
    el.innerHTML = `<p class="p-6 text-center text-sm text-muted">No review noise yet. Run AI Review to generate low-context comments.</p>`;
    return;
  }
  const classes: { v: string; label: string }[] = [
    { v: "Useful", label: "Useful" },
    { v: "Noise", label: "Noise" },
    { v: "Historically motivated", label: "Historical" },
    { v: "Confidently wrong", label: "Wrong" },
    { v: "Needs human context", label: "Needs context" },
  ];
  el.innerHTML = s.reviewComments
    .map(
      (c) => `
    <div class="border-b border-white/7 p-4 last:border-b-0">
      <p class="mb-2 text-sm ${c.classification === "unclassified" ? "text-[#e8eaef]" : "text-muted"}">"${c.text}"</p>
      ${
        c.classification === "unclassified"
          ? `<div class="flex flex-wrap gap-1.5">${classes.map((cl) => `<button type="button" class="cp-mini-btn" data-review="${c.id}" data-review-class="${cl.v}">${cl.label}</button>`).join("")}</div>`
          : `<span class="font-mono text-xs text-dim">→ ${c.classification}</span>`
      }
    </div>`,
    )
    .join("");

  el.querySelectorAll("[data-review-class]").forEach((btn) => {
    btn.addEventListener("click", () => {
      classifyReview(
        (btn as HTMLElement).dataset.review!,
        (btn as HTMLElement).dataset.reviewClass as "Useful" | "Noise" | "Historically motivated" | "Confidently wrong" | "Needs human context",
      );
    });
  });
}

function renderIncidents(s: LegacyState) {
  renderIncidentList("[data-cp-incidents]", s.incidents, 100);
}

function renderOverviewIncidents(s: LegacyState) {
  renderIncidentList("[data-cp-overview-incidents]", s.incidents.slice(0, 8), 8);
}

function renderIncidentList(selector: string, incidents: LegacyState["incidents"], _limit: number) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = incidents
    .map(
      (i) =>
        `<p class="font-mono text-xs leading-relaxed"><span class="text-dim">${formatIncidentTs(i.ts)}</span> <span class="${INCIDENT_CLASS[i.level]}">${INCIDENT_LABEL[i.level]}</span> <span class="text-muted">${i.text}</span></p>`,
    )
    .join("");
}
