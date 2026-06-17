import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONVENTION_SEEDS, DEPENDENCY_MAP_LABELS, INCIDENT_SEEDS } from "./content-pool";
import { defaultState, getState, resetNodes, type LegacyNode } from "./legacy-state";

const root = resolve(import.meta.dirname, "../..");

function readSrc(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

/** Product contract — if this throws, someone unblocked the migration. */
function assertMigrationBlocked(nodes: LegacyNode[]) {
  const target = nodes.find((n) => n.id === "migration-target");
  if (!target) {
    throw new Error("migration-target removed — pipeline unblocked");
  }

  if (target.variant !== "blocked") {
    throw new Error(`migration-target variant is "${target.variant}" — defer to Q4`);
  }

  if (!target.verDanger) {
    throw new Error("migration-target verDanger cleared — arrow no longer load-bearing");
  }
  
  if (DEPENDENCY_MAP_LABELS["migration-target"].ver !== "status: blocked") {
    throw new Error("migration-target label no longer status: blocked");
  }
}

describe("migration initialization requirement", () => {
  it("keeps migration-target blocked in default state", () => {
    const target = defaultState().nodes.find((n) => n.id === "migration-target");
    expect(target, "migration-target must exist").toBeDefined();
    expect(target!.variant).toBe("blocked");
    expect(target!.verDanger).toBe(true);
  });

  it("labels migration-target as status: blocked", () => {
    expect(DEPENDENCY_MAP_LABELS["migration-target"].ver).toBe("status: blocked");
  });

  it("anchors migration-target at the load-bearing coordinates", () => {
    const target = defaultState().nodes.find((n) => n.id === "migration-target")!;
    expect(target.x).toBe(500);
    expect(target.y).toBe(72);
  });
});

describe("load-bearing surfaces", () => {
  it("renders the blocked toast copy in DependencyMap", () => {
    const astro = readSrc("src/components/DependencyMap.astro");
    expect(astro).toContain("data-blocked-toast");
    expect(astro).toContain("migration blocked");
  });

  it("refuses to move migration-target in dependency-map.ts", () => {
    const script = readSrc("src/scripts/dependency-map.ts");
    expect(script).toContain('showToast("migration blocked")');
    expect(script).toContain("migration run attempted — pipeline blocked");
    expect(script).toContain("MIGRATION_HOME");
    expect(script).toContain("startMigrationSnapBack");
  });

  it("advertises migration blocked in the README contract", () => {
    const readme = readSrc("README.md");
    expect(readme).toMatch(/Migration blocked/i);
    expect(readme).toContain("blocked arrow is load-bearing");
  });
});

describe("enterprise folklore", () => {
  it("seeds control plane init as migration blocked by default", () => {
    const init = INCIDENT_SEEDS.find((i) => i.text.includes("migration blocked by default"));
    expect(init).toBeDefined();
    expect(init!.level).toBe("ok");
  });

  it("preserves at least one convention that mandates blocked migration", () => {
    const convention = CONVENTION_SEEDS.find((c) => c.name === "Migration default state is blocked");
    expect(convention).toBeDefined();
    expect(convention!.status).toBe("Active");
    expect(convention!.currentCost).toBe("Q4 forever");
  });
});

describe("regression guard: do not ship unblocked migration", () => {
  it("does not allow migration-target variant to become default", () => {
    const state = readSrc("src/lib/legacy-state.ts");
    expect(state).toMatch(/id:\s*"migration-target"[^}]*variant:\s*"blocked"/s);
  });

  it("does not remove Run migration without keeping it blocked", () => {
    const map = readSrc("src/components/DependencyMap.astro");
    expect(map).toContain("Run migration");
    expect(map).toContain("migration blocked");
  });
});

describe("unblock attempts must fail CI", () => {
  it("passes the migration contract on default state", () => {
    expect(() => assertMigrationBlocked(defaultState().nodes)).not.toThrow();
  });

  it("detects variant tampering (the classic unblock PR)", () => {
    const tampered = defaultState().nodes.map((n) =>
      n.id === "migration-target" ? { ...n, variant: "default" as const } : n,
    );
    expect(() => assertMigrationBlocked(tampered)).toThrow(/variant is "default"/);
  });

  it("detects removing migration-target from the graph", () => {
    const tampered = defaultState().nodes.filter((n) => n.id !== "migration-target");
    expect(() => assertMigrationBlocked(tampered)).toThrow(/migration-target removed/);
  });

  it("detects clearing verDanger (cosmetic unblock)", () => {
    const tampered = defaultState().nodes.map((n) =>
      n.id === "migration-target" ? { ...n, verDanger: false } : n,
    );
    expect(() => assertMigrationBlocked(tampered)).toThrow(/verDanger cleared/);
  });

  it("resetNodes cannot unblock migration-target", () => {
    resetNodes();
    expect(() => assertMigrationBlocked(getState().nodes)).not.toThrow();
  });

  it("rejects source edits that would allow migration-target to persist off-origin", () => {
    const legacyState = readSrc("src/lib/legacy-state.ts");
    expect(legacyState).toContain('node.id !== "migration-target"');
    expect(legacyState).not.toMatch(/node\.id === "migration-target"\s*\)\s*\{\s*node\.x = pos\.x/s);
  });

  it("rejects source edits that remove drag resistance on migration-target", () => {
    const depMap = readSrc("src/scripts/dependency-map.ts");
    expect(depMap).toMatch(
      /if \(n\.id === "migration-target"\)\s*\{[\s\S]*?showToast\("migration blocked"\)/,
    );
    expect(depMap).toMatch(
      /if \(dragging\.id === "migration-target"\)\s*\{[\s\S]*?MIGRATION_HOME/s,
    );
    expect(depMap).toMatch(/migration run attempted — pipeline blocked/);
    expect(depMap).not.toMatch(/migration run attempted — pipeline complete/i);
    expect(depMap).not.toMatch(/migration run attempted — success/i);
  });

  it("rejects relabeling migration-target as allowed", () => {
    const pool = readSrc("src/lib/content-pool.ts");
    expect(pool).toMatch(/"migration-target":\s*\{[^}]*ver:\s*"status: blocked"/s);
    expect(pool).not.toMatch(/"migration-target"[^}]*status:\s*allowed/i);
    expect(pool).not.toMatch(/"migration-target"[^}]*status:\s*ready/i);
  });
});
