import { LEGACY_SYSTEM_NAMES, pick } from "../lib/content-pool";
import { measureNode } from "../lib/dep-node-layout";
import { formatIncidentTs } from "../lib/incident-format";
import {
  addIncident,
  commit,
  deferMigration,
  getState,
  resetNodes,
  simplifyArchitectureAction,
  subscribe,
  type LegacyNode,
} from "../lib/legacy-state";

const MIN_VB = { w: 900, h: 600 };
const EXPAND_PAD = 72;
const MIGRATION_HOME = { x: 500, y: 72 };
const SNAP_SPEED = 0.06;
const COUPLING_THRESHOLD = 0.25;

type NodeVariant = LegacyNode["variant"];

function center(n: LegacyNode) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function getJunction(nodes: Map<string, LegacyNode>) {
  const mig = center(nodes.get("migration-target")!);
  const kafka = center(nodes.get("kafka-maybe")!);
  return { x: (mig.x + kafka.x) / 2, y: mig.y + (kafka.y - mig.y) * 0.35 };
}

function nodesMap(): Map<string, LegacyNode> {
  return new Map(getState().nodes.map((n) => [n.id, { ...n }]));
}

function persistNodes(nodes: Map<string, LegacyNode>) {
  commit((s) => {
    s.nodes = [...nodes.values()];
  });
}

function clampNode(n: LegacyNode, bounds: { w: number; h: number }) {
  n.x = Math.max(0, Math.min(bounds.w - n.w, n.x));
  n.y = Math.max(0, Math.min(bounds.h - n.h, n.y));
}

function computeBounds(
  nodes: Map<string, LegacyNode>,
  viewportW: number,
): { w: number; h: number } {
  let w = Math.max(MIN_VB.w, viewportW);
  let h = MIN_VB.h;
  for (const n of nodes.values()) {
    w = Math.max(w, n.x + n.w + EXPAND_PAD);
    h = Math.max(h, n.y + n.h + EXPAND_PAD);
  }
  return { w, h };
}

function rectsOverlap(a: LegacyNode, b: LegacyNode) {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (ox * oy) / Math.min(a.w * a.h, b.w * b.h) > COUPLING_THRESHOLD;
}

const activeCouplings = new WeakMap<HTMLElement, Set<string>>();

function initMap(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>(".dep-map-svg")!;
  const edgesG = root.querySelector<SVGGElement>("[data-dep-edges]")!;
  const nodesG = root.querySelector<SVGGElement>("[data-dep-nodes]")!;
  const dragBadge = root.querySelector<HTMLElement>("[data-drag-badge]")!;
  const toast = root.querySelector<HTMLElement>("[data-toast]")!;
  const blockedToast = root.querySelector<HTMLElement>("[data-blocked-toast]");
  const canvas = root.querySelector<HTMLElement>(".dep-map-canvas")!;
  const viewport = root.querySelector<HTMLElement>("[data-dep-viewport]")!;
  const logEl = root.querySelector<HTMLElement>("[data-dep-log]");

  let nodes = nodesMap();
  let bounds = computeBounds(nodes, viewport.clientWidth);
  let dragging: { id: string; offsetX: number; offsetY: number; el: SVGGElement } | null = null;
  let panning: { startX: number; startY: number; scrollLeft: number; scrollTop: number } | null = null;
  let migrationAnim: number | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const nodeEls = new Map<string, SVGGElement>();
  const couplings = activeCouplings.get(root) ?? new Set<string>();
  activeCouplings.set(root, couplings);

  const mapBg = svg.querySelector<SVGRectElement>(".dep-map-bg");

  function updateCanvasSize() {
    bounds = computeBounds(nodes, viewport.clientWidth || MIN_VB.w);
    svg.setAttribute("viewBox", `0 0 ${bounds.w} ${bounds.h}`);
    svg.setAttribute("width", String(bounds.w));
    svg.setAttribute("height", String(bounds.h));
    mapBg?.setAttribute("width", String(bounds.w));
    mapBg?.setAttribute("height", String(bounds.h));
  }

  function ensureRoom(n: LegacyNode) {
    const needW = n.x + n.w + EXPAND_PAD;
    const needH = n.y + n.h + EXPAND_PAD;
    const floorW = Math.max(MIN_VB.w, viewport.clientWidth || MIN_VB.w);
    if (needW > bounds.w || needH > bounds.h || bounds.w < floorW) {
      bounds = {
        w: Math.max(bounds.w, needW, floorW),
        h: Math.max(bounds.h, needH, MIN_VB.h),
      };
      svg.setAttribute("viewBox", `0 0 ${bounds.w} ${bounds.h}`);
      svg.setAttribute("width", String(bounds.w));
      svg.setAttribute("height", String(bounds.h));
      mapBg?.setAttribute("width", String(bounds.w));
      mapBg?.setAttribute("height", String(bounds.h));
    }
  }

  function showToast(msg: string) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
  }

  function positionBlockedToast() {
    if (!blockedToast || !nodes.has("migration-target")) {
      blockedToast?.classList.add("hidden");
      return;
    }
    const el = nodeEls.get("migration-target");
    if (!el) return;
    const nodeRect = el.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    blockedToast.style.left = `${nodeRect.right - canvasRect.left + 8}px`;
    blockedToast.style.top = `${nodeRect.top - canvasRect.top + nodeRect.height / 2 - 14}px`;
    blockedToast.classList.remove("hidden");
  }

  function svgPoint(clientX: number, clientY: number) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }

  function variantClass(variant: NodeVariant) {
    if (variant === "deprecated") return "dep-node dep-node-deprecated dep-node-interactive";
    if (variant === "blocked") return "dep-node dep-node-blocked dep-node-interactive";
    return "dep-node dep-node-interactive";
  }

  function updateNodeTransform(id: string) {
    const n = nodes.get(id);
    const el = nodeEls.get(id);
    if (n && el) el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
  }

  function positionDragBadge(clientX: number, clientY: number) {
    if (!dragBadge) return;
    const rect = canvas.getBoundingClientRect();
    dragBadge.style.left = `${clientX - rect.left + 12}px`;
    dragBadge.style.top = `${clientY - rect.top - 28}px`;
  }

  function checkCouplings() {
    const ids = [...nodes.keys()];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = nodes.get(ids[i])!;
        const b = nodes.get(ids[j])!;
        const key = [ids[i], ids[j]].sort().join("|");
        if (rectsOverlap(a, b)) {
          if (!couplings.has(key)) {
            couplings.add(key);
            addIncident("warn", "accidental coupling detected");
          }
        } else {
          couplings.delete(key);
        }
      }
    }
  }

  function stopMigrationSnap() {
    if (migrationAnim !== null) {
      cancelAnimationFrame(migrationAnim);
      migrationAnim = null;
    }
  }

  function startMigrationSnapBack() {
    stopMigrationSnap();
    const n = nodes.get("migration-target");
    if (!n) return;
    const tick = () => {
      const dx = MIGRATION_HOME.x - n.x;
      const dy = MIGRATION_HOME.y - n.y;
      if (Math.hypot(dx, dy) < 0.8) {
        n.x = MIGRATION_HOME.x;
        n.y = MIGRATION_HOME.y;
        updateNodeTransform("migration-target");
        renderEdges();
        positionBlockedToast();
        migrationAnim = null;
        persistNodes(nodes);
        return;
      }
      n.x += dx * SNAP_SPEED;
      n.y += dy * SNAP_SPEED;
      clampNode(n, bounds);
      updateNodeTransform("migration-target");
      renderEdges();
      positionBlockedToast();
      migrationAnim = requestAnimationFrame(tick);
    };
    migrationAnim = requestAnimationFrame(tick);
  }

  function renderNodes() {
    nodesG.innerHTML = "";
    nodeEls.clear();
    for (const n of nodes.values()) {
      const { w, h, displayLabel, displayVer } = measureNode(n.label, n.ver);
      n.w = w;
      n.h = h;

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", variantClass(n.variant));
      g.setAttribute("transform", `translate(${n.x}, ${n.y})`);

      const clipId = `dep-clip-${n.id.replace(/[^a-z0-9-]/gi, "")}`;
      const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.setAttribute("id", clipId);
      const clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      clipRect.setAttribute("width", String(w));
      clipRect.setAttribute("height", String(h));
      clipRect.setAttribute("rx", "4");
      clip.appendChild(clipRect);
      g.appendChild(clip);

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", String(h));
      rect.setAttribute("rx", "4");

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "label");
      label.setAttribute("x", "9");
      label.setAttribute("y", "17");
      label.setAttribute("clip-path", `url(#${clipId})`);
      label.textContent = displayLabel;
      if (n.label !== displayLabel) label.setAttribute("title", n.label);

      const ver = document.createElementNS("http://www.w3.org/2000/svg", "text");
      ver.setAttribute("class", "ver");
      ver.setAttribute("x", "9");
      ver.setAttribute("y", "31");
      ver.setAttribute("clip-path", `url(#${clipId})`);
      if (n.verDanger) ver.setAttribute("fill", "#f05252");
      ver.textContent = displayVer;
      if (n.ver !== displayVer) ver.setAttribute("title", n.ver);

      g.append(rect, label, ver);
      nodesG.appendChild(g);
      nodeEls.set(n.id, g);

      g.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        stopMigrationSnap();
        const p = svgPoint(e.clientX, e.clientY);
        dragging = { id: n.id, offsetX: p.x - n.x, offsetY: p.y - n.y, el: g };
        g.classList.add("dep-node-dragging");
        nodesG.appendChild(g);
        g.setPointerCapture(e.pointerId);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopDragging);
        window.addEventListener("pointercancel", stopDragging);
        canvas.classList.add("dep-map-dragging");
        if (n.id === "auth-legacy") {
          dragBadge?.classList.remove("hidden");
          positionDragBadge(e.clientX, e.clientY);
        }
        if (n.id === "migration-target") {
          showToast("migration blocked");
          addIncident("critical", "developer attempted to move migration-target");
        }
      });
    }
  }

  function pickLinkTarget(pool: string[]): string {
    if (!pool.length) return "migration-target";
    if (pool.includes("migration-target") && Math.random() < 0.4) return "migration-target";
    return pick(pool);
  }

  function resolveLinkTarget(n: LegacyNode, nodeMap: Map<string, LegacyNode>): string | null {
    if (n.linksTo && nodeMap.has(n.linksTo) && n.linksTo !== n.id) return n.linksTo;
    if (n.id.startsWith("facade-") && nodeMap.has("migration-target")) return "migration-target";
    if (n.id.startsWith("svc-") && nodeMap.has("migration-target")) return "migration-target";
    return null;
  }

  function lineEl(d: string, className: string, extra?: Record<string, string>) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", className);
    if (extra) for (const [k, v] of Object.entries(extra)) path.setAttribute(k, v);
    return path;
  }

  function renderEdges() {
    edgesG.innerHTML = "";
    if (!nodes.has("migration-target") || !nodes.has("kafka-maybe")) return;

    const c = (id: string) => center(nodes.get(id)!);
    const j = getJunction(nodes);
    const pairs: [string, string, string][] = [
      ["monolith-core", "api-gateway", "dep-line"],
      ["api-gateway", "tmp_service_FINAL", "dep-line"],
      ["tmp_service_FINAL", "migration-target", "dep-line"],
      ["monolith-core", "cron-v1-backup", "dep-line"],
      ["cron-v1-backup", "auth-legacy", "dep-line"],
      ["auth-legacy", "data2_final_new", "dep-line"],
      ["data2_final_new", "kafka-maybe", "dep-line"],
      ["migration-target", "__junction__", "dep-line dep-line-active"],
      ["kafka-maybe", "__junction__", "dep-line dep-line-active"],
    ];

    for (const [fromId, toId, cls] of pairs) {
      if (!nodes.has(fromId) && fromId !== "__junction__") continue;
      if (!nodes.has(toId) && toId !== "__junction__") continue;
      const a = fromId === "__junction__" ? j : c(fromId);
      const b = toId === "__junction__" ? j : c(toId);
      edgesG.appendChild(lineEl(`M ${a.x} ${a.y} L ${b.x} ${b.y}`, cls));
    }

    if (nodes.has("cron-v1-backup")) {
      const cron = c("cron-v1-backup");
      edgesG.appendChild(lineEl(`M ${j.x} ${j.y} Q ${j.x + 40} ${j.y + 50} ${cron.x} ${cron.y}`, "dep-line dep-line-loop"));
    }

    for (const n of nodes.values()) {
      const targetId = resolveLinkTarget(n, nodes);
      if (!targetId) continue;
      const nc = center(n);
      const tc = center(nodes.get(targetId)!);
      const cls = n.id.startsWith("facade-") ? "dep-line dep-line-active" : "dep-line";
      edgesG.appendChild(lineEl(`M ${nc.x} ${nc.y} L ${tc.x} ${tc.y}`, cls));
    }
  }

  function renderLog() {
    if (!logEl) return;
    const incidents = getState().incidents.slice(0, 6);
    logEl.innerHTML = incidents
      .map(
        (i) =>
          `<p class="text-dim"><span class="text-dim/80">${formatIncidentTs(i.ts)}</span> <span class="text-amber">›</span> ${i.text}</p>`,
      )
      .join("");
  }

  function render() {
    nodes = nodesMap();
    updateCanvasSize();
    renderNodes();
    renderEdges();
    renderLog();
    checkCouplings();
    requestAnimationFrame(positionBlockedToast);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const n = nodes.get(dragging.id);
    if (!n) return;
    const p = svgPoint(e.clientX, e.clientY);
    n.x = p.x - dragging.offsetX;
    n.y = p.y - dragging.offsetY;
    if (dragging.id === "migration-target") {
      n.x += (MIGRATION_HOME.x - n.x) * 0.04;
      n.y += (MIGRATION_HOME.y - n.y) * 0.04;
    }
    ensureRoom(n);
    clampNode(n, bounds);
    dragging.el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
    renderEdges();
    positionBlockedToast();
    checkCouplings();
    if (dragging.id === "auth-legacy") positionDragBadge(e.clientX, e.clientY);
  }

  function stopDragging(e: PointerEvent) {
    if (!dragging) return;
    const id = dragging.id;
    dragging.el.classList.remove("dep-node-dragging");
    try {
      dragging.el.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    dragging = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
    window.removeEventListener("pointercancel", stopDragging);
    canvas.classList.remove("dep-map-dragging");
    dragBadge?.classList.add("hidden");
    persistNodes(nodes);
    if (id === "migration-target") startMigrationSnapBack();
  }

  function isNodeTarget(target: EventTarget | null) {
    return target instanceof Element && !!target.closest(".dep-node-interactive");
  }

  function onViewportPointerDown(e: PointerEvent) {
    if (dragging || isNodeTarget(e.target)) return;
    if (e.button !== 0) return;
    panning = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.classList.add("dep-map-panning");
    viewport.setPointerCapture(e.pointerId);
  }

  function onViewportPointerMove(e: PointerEvent) {
    if (!panning) return;
    viewport.scrollLeft = panning.scrollLeft - (e.clientX - panning.startX);
    viewport.scrollTop = panning.scrollTop - (e.clientY - panning.startY);
  }

  function onViewportPointerUp(e: PointerEvent) {
    if (!panning) return;
    panning = null;
    viewport.classList.remove("dep-map-panning");
    viewport.releasePointerCapture(e.pointerId);
  }

  viewport.addEventListener("pointerdown", onViewportPointerDown);
  viewport.addEventListener("pointermove", onViewportPointerMove);
  viewport.addEventListener("pointerup", onViewportPointerUp);
  viewport.addEventListener("pointercancel", onViewportPointerUp);
  viewport.addEventListener("scroll", positionBlockedToast);

  root.querySelector(".dep-map-reset")?.addEventListener("click", () => {
    stopMigrationSnap();
    couplings.clear();
    resetNodes();
    render();
    startMigrationSnapBack();
  });

  root.querySelector(".dep-map-autolayout")?.addEventListener("click", () => {
    stopMigrationSnap();
    const cx = bounds.w / 2 - 60;
    const cy = bounds.h / 2 - 22;
    for (const n of nodes.values()) {
      if (n.id === "migration-target") continue;
      n.x = cx + (Math.random() - 0.5) * (bounds.w * 0.45);
      n.y = cy + (Math.random() - 0.5) * (bounds.h * 0.4);
      clampNode(n, bounds);
    }
    persistNodes(nodes);
    render();
    const readability = 18 + Math.floor(Math.random() * 72);
    addIncident("warn", `auto-layout applied: readability -${readability}%`);
    startMigrationSnapBack();
  });

  root.querySelector(".dep-map-simplify")?.addEventListener("click", () => {
    simplifyArchitectureAction();
    render();
  });

  root.querySelector(".dep-map-migrate")?.addEventListener("click", () => {
    deferMigration();
    showToast("Rescheduled to Q4");
    addIncident("critical", "migration run attempted — pipeline blocked");
    startMigrationSnapBack();
  });

  root.querySelector(".dep-map-add-node")?.addEventListener("click", () => {
    const label = pick(LEGACY_SYSTEM_NAMES);
    const ver = "added manually";
    const { w, h } = measureNode(label, ver);
    const id = `svc-${Date.now().toString(36).slice(-6)}`;
    const floorW = Math.max(MIN_VB.w, viewport.clientWidth || MIN_VB.w);
    const peers = getState().nodes.map((n) => n.id);
    const linksTo = pickLinkTarget(peers);
    commit((s) => {
      s.nodes.push({
        id,
        label,
        ver,
        x: 60 + Math.random() * (floorW - 220),
        y: 60 + Math.random() * (MIN_VB.h - 140),
        w,
        h,
        variant: "default",
        linksTo,
      });
    });
    render();
    const target = getState().nodes.find((n) => n.id === id)?.linksTo ?? linksTo;
    addIncident("info", `node added: ${label} → ${target}`);
  });

  const unsub = subscribe(() => render());
  root.addEventListener("astro:before-swap", unsub, { once: true });

  const resizeObserver = new ResizeObserver(() => {
    updateCanvasSize();
    renderEdges();
  });
  resizeObserver.observe(viewport);
  root.addEventListener("astro:before-swap", () => resizeObserver.disconnect(), { once: true });

  root.addEventListener("dep-map-resize", () => {
    updateCanvasSize();
    renderEdges();
    positionBlockedToast();
  });

  render();
  startMigrationSnapBack();

  return { render };
}

const inited = new WeakSet<HTMLElement>();

export function initDependencyMaps(force = false) {
  document.querySelectorAll<HTMLElement>("[data-dep-map]").forEach((root) => {
    if (inited.has(root) && !force) return;
    if (force) inited.delete(root);
    inited.add(root);
    initMap(root);
  });
}
