import { canonicalPendingId, reconcilePendingSince } from "./pendingSince";

const project = { categories: [{ id: "gate", type: "items" }, { id: "cftv", type: "count" }] };
const report = (date, gate, cameras = []) => ({ meta: { date }, state: { gate: [gate], cftv: { total: 10, inoperative: cameras } } });

test("limpa since quando o item volta a OK", () => {
  const previous = report("2026-08-23", { status: "inop", since: "2026-08-01" });
  const next = reconcilePendingSince(project, previous, report("2026-08-30", { status: "ok", since: "2026-08-01" }).state, "2026-08-30");
  expect(next.gate[0].since).toBe("");
});

test("ao voltar a INOP não reutiliza data anterior ao último OK", () => {
  const previous = report("2026-08-23", { status: "ok", since: "" });
  const next = reconcilePendingSince(project, previous, report("2026-08-30", { status: "inop", since: "2024-11-03" }).state, "2026-08-30");
  expect(next.gate[0].since).toBe("2026-08-30");
});

test("preserva a data enquanto a falha permanece contínua", () => {
  const previous = report("2026-08-23", { status: "partial", since: "2026-08-10" });
  const next = reconcilePendingSince(project, previous, report("2026-08-30", { status: "inop", since: "2026-08-30" }).state, "2026-08-30");
  expect(next.gate[0].since).toBe("2026-08-10");
});

test("reconcilia contáveis com variações de espaço no identificador", () => {
  expect(canonicalPendingId(" CF 35 ")).toBe(canonicalPendingId("CF35"));
  const previous = report("2026-08-23", { status: "ok", since: "" }, [{ id: "CF 35", since: "2026-08-10" }]);
  const next = reconcilePendingSince(project, previous, report("2026-08-30", { status: "ok", since: "" }, [{ id: "CF35", since: "2026-08-30" }]).state, "2026-08-30");
  expect(next.cftv.inoperative[0].since).toBe("2026-08-10");
});
