const STORAGE_KEY = "laas-dep-map-positions";
const VB = { w: 480, h: 300 };
const MIGRATION_HOME = { x: 330, y: 45 };
const SNAP_SPEED = 0.06;
const COUPLING_THRESHOLD = 0.25;

type NodeVariant = "default" | "deprecated" | "blocked";

interface NodeData {
  id: string;
  label: string;
  ver: string;
  x: number;
  y: number;
  w: number;
  h: number;
  variant: NodeVariant;
  verDanger?: boolean;
}

const DEFAULT_NODES: NodeData[] = [
  { id: "monolith-core", label: "monolith-core", ver: "v3.14.159 · deprecated", x: 60, y: 55, w: 120, h: 44, variant: "deprecated" },
  { id: "api-gateway", label: "api-gateway", ver: "owner: unknown", x: 160, y: 35, w: 110, h: 44, variant: "default" },
  { id: "tmp_service_FINAL", label: "tmp_service_FINAL", ver: "since 2016", x: 250, y: 65, w: 130, h: 44, variant: "default" },
  { id: "migration-target", label: "migration-target", ver: "status: blocked", x: 330, y: 45, w: 120, h: 44, variant: "blocked", verDanger: true },
  { id: "cron-v1-backup", label: "cron-v1-backup", ver: "do not remove", x: 60, y: 140, w: 120, h: 44, variant: "deprecated" },
  { id: "auth-legacy", label: "auth-legacy", ver: "MD5 · working", x: 160, y: 160, w: 110, h: 44, variant: "default" },
  { id: "data2_final_new", label: "data2_final_new", ver: "preserved asset", x: 250, y: 180, w: 130, h: 44, variant: "default" },
  { id: "kafka-maybe", label: "kafka-maybe", ver: "provisioned never", x: 330, y: 200, w: 120, h: 44, variant: "default" },
];

const INITIAL_LOGS: { level: "ok" | "warn" | "blocked"; text: string }[] = [
  { level: "ok", text: "convention_preservation_engine: 12 assets locked" },
  { level: "warn", text: "migration_path: loop detected → origin" },
  { level: "blocked", text: "refactor_pipeline: rescheduled to Q4 FY2026" },
];

const LOG_CLASS = { ok: "text-terminal", warn: "text-amber", blocked: "text-danger" };
const LOG_LABEL = { ok: "[OK]", warn: "[WARN]", blocked: "[BLOCKED]" };

function center(n: NodeData) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function getJunction(nodes: Map<string, NodeData>) {
  const mig = center(nodes.get("migration-target")!);
  const kafka = center(nodes.get("kafka-maybe")!);
  return {
    x: (mig.x + kafka.x) / 2,
    y: mig.y + (kafka.y - mig.y) * 0.35,
  };
}

function defaultNodes(): Map<string, NodeData> {
  return new Map(DEFAULT_NODES.map((n) => [n.id, { ...n }]));
}

function loadPositions(): Map<string, NodeData> {
  const map = defaultNodes();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return map;
    const saved = JSON.parse(raw) as Record<string, { x: number; y: number }>;
    for (const [id, pos] of Object.entries(saved)) {
      const node = map.get(id);
      if (node && id !== "migration-target") {
        node.x = pos.x;
        node.y = pos.y;
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

function savePositions(nodes: Map<string, NodeData>) {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, n] of nodes) {
    if (id !== "migration-target") out[id] = { x: n.x, y: n.y };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
}

function clampNode(n: NodeData) {
  n.x = Math.max(0, Math.min(VB.w - n.w, n.x));
  n.y = Math.max(0, Math.min(VB.h - n.h, n.y));
}

function rectsOverlap(a: NodeData, b: NodeData): boolean {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const overlap = ox * oy;
  const minArea = Math.min(a.w * a.h, b.w * b.h);
  return overlap / minArea > COUPLING_THRESHOLD;
}

function initMap(root: HTMLElement) {
  if (root.dataset.depInit === "true") return;
  root.dataset.depInit = "true";

  const svg = root.querySelector<SVGSVGElement>(".dep-map-svg")!;
  const edgesG = root.querySelector<SVGGElement>("[data-dep-edges]")!;
  const nodesG = root.querySelector<SVGGElement>("[data-dep-nodes]")!;
  const blockedG = root.querySelector<SVGGElement>("[data-dep-blocked]")!;
  const logEl = root.querySelector<HTMLElement>("[data-dep-log]")!;
  const dragBadge = root.querySelector<HTMLElement>("[data-drag-badge]")!;
  const toast = root.querySelector<HTMLElement>("[data-toast]")!;
  const canvas = root.querySelector<HTMLElement>(".dep-map-canvas")!;
  const resetBtn = root.querySelector<HTMLButtonElement>(".dep-map-reset")!;
  const autoLayoutBtn = root.querySelector<HTMLButtonElement>(".dep-map-autolayout")!;
  const simplifyBtn = root.querySelector<HTMLButtonElement>(".dep-map-simplify")!;
  const migrateBtn = root.querySelector<HTMLButtonElement>(".dep-map-migrate")!;

  let nodes = loadPositions();
  let dragging: { id: string; offsetX: number; offsetY: number; el: SVGGElement } | null = null;
  let migrationAnim: number | null = null;
  let simplifyCount = 0;
  const nodeEls = new Map<string, SVGGElement>();
  const activeCouplings = new Set<string>();
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function appendLog(level: keyof typeof LOG_CLASS, text: string) {
    const p = document.createElement("p");
    p.innerHTML = `<span class="${LOG_CLASS[level]}">${LOG_LABEL[level]}</span> ${text}`;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderLogs() {
    logEl.innerHTML = "";
    for (const line of INITIAL_LOGS) appendLog(line.level, line.text);
  }

  function showToast(msg: string) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
  }

  function svgPoint(clientX: number, clientY: number) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
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
          if (!activeCouplings.has(key)) {
            activeCouplings.add(key);
            appendLog("warn", "accidental coupling detected");
          }
        } else {
          activeCouplings.delete(key);
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
        migrationAnim = null;
        return;
      }
      n.x += dx * SNAP_SPEED;
      n.y += dy * SNAP_SPEED;
      clampNode(n);
      updateNodeTransform("migration-target");
      renderEdges();
      migrationAnim = requestAnimationFrame(tick);
    };
    migrationAnim = requestAnimationFrame(tick);
  }

  function renderNodes() {
    nodesG.innerHTML = "";
    nodeEls.clear();
    for (const n of nodes.values()) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", variantClass(n.variant));
      g.setAttribute("transform", `translate(${n.x}, ${n.y})`);
      g.dataset.nodeId = n.id;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", String(n.w));
      rect.setAttribute("height", String(n.h));
      rect.setAttribute("rx", "4");

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("class", "label");
      label.setAttribute("x", "10");
      label.setAttribute("y", "18");
      label.textContent = n.label;

      const ver = document.createElementNS("http://www.w3.org/2000/svg", "text");
      ver.setAttribute("class", "ver");
      ver.setAttribute("x", "10");
      ver.setAttribute("y", "32");
      if (n.verDanger) ver.setAttribute("fill", "#f05252");
      ver.textContent = n.ver;

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
        canvas.classList.add("dep-map-dragging");
        if (n.id === "auth-legacy") {
          dragBadge.classList.remove("hidden");
          positionDragBadge(e.clientX, e.clientY);
        }
      });
    }
  }

  function lineEl(d: string, className: string, extra?: Record<string, string>) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", className);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) path.setAttribute(k, v);
    }
    return path;
  }

  function renderEdges() {
    edgesG.innerHTML = "";
    blockedG.innerHTML = "";

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
      const cpx = j.x + 40;
      const cpy = j.y + 50;
      edgesG.appendChild(
        lineEl(`M ${j.x} ${j.y} Q ${cpx} ${cpy} ${cron.x} ${cron.y}`, "dep-line dep-line-loop"),
      );
    }

    const bx = j.x + 42;
    const by = j.y - 42;
    edgesG.appendChild(
      lineEl(`M ${j.x} ${j.y} L ${bx} ${by}`, "", {
        stroke: "#f05252",
        "stroke-width": "1.5",
        "stroke-dasharray": "3 3",
        fill: "none",
        opacity: "0.5",
        "marker-end": "url(#dep-arrow)",
      }),
    );

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(bx + 5));
    text.setAttribute("y", String(by - 2));
    text.setAttribute("font-family", "JetBrains Mono, monospace");
    text.setAttribute("font-size", "7");
    text.setAttribute("fill", "#f05252");
    text.textContent = "BLOCKED";
    blockedG.appendChild(text);

    // connect orphan simplify nodes to nearest chaos
    for (const n of nodes.values()) {
      if (n.id.startsWith("facade-wrapper-")) {
        const mig = center(nodes.get("migration-target")!);
        const nc = center(n);
        edgesG.appendChild(lineEl(`M ${nc.x} ${nc.y} L ${mig.x} ${mig.y}`, "dep-line dep-line-active"));
      }
    }
  }

  function render() {
    renderEdges();
    renderNodes();
    checkCouplings();
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
    clampNode(n);
    dragging.el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
    renderEdges();
    checkCouplings();
    if (dragging.id === "auth-legacy") positionDragBadge(e.clientX, e.clientY);
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    const id = dragging.id;
    dragging.el.classList.remove("dep-node-dragging");
    dragging.el.releasePointerCapture(e.pointerId);
    dragging = null;
    canvas.classList.remove("dep-map-dragging");
    dragBadge.classList.add("hidden");
    savePositions(nodes);
    if (id === "migration-target") startMigrationSnapBack();
  }

  function autoLayout() {
    stopMigrationSnap();
    const ids = [...nodes.keys()];
    // cluster everything on top of each other — worse is better
    const cx = VB.w / 2 - 60;
    const cy = VB.h / 2 - 22;
    for (const id of ids) {
      const n = nodes.get(id)!;
      if (id === "migration-target") continue;
      n.x = cx + (Math.random() - 0.5) * 90;
      n.y = cy + (Math.random() - 0.5) * 70;
      clampNode(n);
    }
    render();
    appendLog("warn", "auto-layout applied: readability -47%");
    startMigrationSnapBack();
  }

  function simplifyArchitecture() {
    simplifyCount++;
    const id = `facade-wrapper-${simplifyCount}`;
    nodes.set(id, {
      id,
      label: id,
      ver: "narrows nothing",
      x: 180 + simplifyCount * 8,
      y: 120 + (simplifyCount % 3) * 18,
      w: 130,
      h: 44,
      variant: "default",
    });
    render();
    appendLog("ok", `architecture simplified: +1 node (${id})`);
    checkCouplings();
  }

  function runMigration() {
    showToast("Rescheduled to Q4");
    appendLog("blocked", "Rescheduled to Q4");
    startMigrationSnapBack();
  }

  function reset() {
    stopMigrationSnap();
    localStorage.removeItem(STORAGE_KEY);
    simplifyCount = 0;
    activeCouplings.clear();
    nodes = defaultNodes();
    renderLogs();
    render();
  }

  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);

  resetBtn.addEventListener("click", reset);
  autoLayoutBtn.addEventListener("click", autoLayout);
  simplifyBtn.addEventListener("click", simplifyArchitecture);
  migrateBtn.addEventListener("click", runMigration);

  renderLogs();
  render();
  startMigrationSnapBack();
}

export function initDependencyMaps() {
  document.querySelectorAll<HTMLElement>("[data-dep-map]").forEach(initMap);
}
