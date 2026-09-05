const statusOf = (value) => value?.status ?? (value?.ok === false ? "inop" : "ok");

export function canonicalPendingId(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function transitionSince(previous, current, reportDate) {
  const previousStatus = statusOf(previous);
  const currentStatus = statusOf(current);
  if (currentStatus === "ok") return "";
  if (previousStatus !== "ok") return previous?.since || current?.since || reportDate;

  const previousReportDate = previous?._reportDate || "";
  const proposed = current?.since || "";
  return proposed && (!previousReportDate || proposed > previousReportDate) ? proposed : reportDate;
}

export function reconcilePendingSince(project, previousReport, proposedState, reportDate) {
  const next = JSON.parse(JSON.stringify(proposedState || {}));
  const previousState = previousReport?.state || {};
  const previousDate = previousReport?.meta?.date || "";

  for (const category of project.categories || []) {
    const current = next[category.id];
    const previous = previousState[category.id];
    if (!current) continue;

    if (category.type === "single") {
      current.since = transitionSince(previous ? { ...previous, _reportDate: previousDate } : null, current, reportDate);
    } else if (category.type === "items" && Array.isArray(current)) {
      current.forEach((item, index) => {
        const old = Array.isArray(previous) ? previous[index] : previous?.[index];
        item.since = transitionSince(old ? { ...old, _reportDate: previousDate } : null, item, reportDate);
      });
    } else if (category.type === "count" && Array.isArray(current.inoperative)) {
      const previousById = new Map((previous?.inoperative || []).map((item) => [canonicalPendingId(item.id), item]));
      current.inoperative.forEach((item) => {
        const old = previousById.get(canonicalPendingId(item.id));
        item.since = transitionSince(
          old ? { ...old, status: "inop", _reportDate: previousDate } : null,
          { ...item, status: "inop" },
          reportDate,
        );
      });
    }
  }
  return next;
}
