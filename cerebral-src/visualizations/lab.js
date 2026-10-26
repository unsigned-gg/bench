import inventory from "./inventory.json";
import { Quaternion, Vector3, Euler } from "three";
import { loadKernels } from "./kernels.js";
import { Painter, Viewport } from "./painter.js";
import { draw } from "./layouts.js";
import { getTerrain, loadTerrain } from "./raster.js";
const $ = (id) => document.getElementById(id),
  entries = inventory.entries,
  canvas = $("chart");
const state = {
  frame: 50,
  window: 16,
  count: 192,
  zoom: 1,
  pan: [0, 0],
  rotation: 0,
  projection: 0,
  depth: 0,
  focus: 0,
  collapsed: false,
  sorted: false,
  log: false,
  refine: 0,
  dragNode: null,
};
let renderedView = { zoom: 1, pan: [0, 0] };
let terrainLoading = false;
let entry = entries[71],
  kernels,
  viewport,
  painter,
  rows = [],
  playing = false,
  selected = -1,
  lastFrame = 0,
  raf = 0,
  drag = null;
const descriptions = {
  treemap:
    "Partition an area by value while preserving parent–child relationships.",
  network: "Balance repulsion and link constraints to reveal connectivity.",
  scatter:
    "Position observations by two variables; inspect the relationship rather than a summary alone.",
  bars: "Compare values through position and length on a shared baseline.",
  area: "Compare continuous quantities through filled area and common time coordinates.",
  map: "Project geographic geometry and inspect a spatial encoding.",
  tree: "Follow explicit parent–child relationships through a hierarchical layout.",
  pack: "Use nested circles to reveal containment and relative weight.",
  sunburst: "Encode hierarchical depth as radial bands and value as angle.",
  icicle: "Encode hierarchical depth as horizontal bands and value as width.",
  histogram:
    "Aggregate numeric observations into bins using the WASM histogram kernel.",
  kde: "Estimate a continuous density using the WASM Gaussian kernel.",
  box: "Summarize each group with minimum, quartiles, median and maximum.",
  qq: "Compare ordered observations with corresponding sample or normal quantiles.",
  tiles:
    "Explore local raster and vector tiles with Web Mercator z/x/y coordinates.",
  predator: "Integrate the coupled Lotka–Volterra equations using WASM.",
  chord: "Encode flows between groups with arcs and ribbons.",
  sankey: "Preserve flow quantities between successive stages.",
  beeswarm:
    "Resolve overlap while preserving each observation’s value coordinate.",
  matrix: "Compare pairs of variables across a matrix of scatterplots.",
  density: "Estimate a two-dimensional density and trace its isolines.",
  contours: "Trace raster thresholds with marching squares.",
  hexbin: "Aggregate observations in a hexagonal spatial grid.",
  words:
    "Place weighted words with collision checks in a compact spiral layout.",
};
const help = {
  inspect:
    "Move over the chart or use Left / Right arrow keys to inspect marks. The input table is below.",
  brush:
    "Drag a rectangular brush to select marks. Use arrow keys to inspect individual observations.",
  zoom: "Use + / −, the mouse wheel, or drag to pan. Reset view returns to the original extent.",
  pan: "Drag to pan the view; + / − or the mouse wheel change scale. Reset view returns to the original extent.",
  rotate:
    "Drag horizontally to rotate the globe. The frame slider changes its orientation.",
  drill:
    "Select a region or press Enter on the canvas to drill into the hierarchy. Reset view returns to the root.",
  sort: "Use “Sort values” to reorder the bars. Reset view restores the original order.",
  sequence:
    "Move over an arc to inspect its place in the sequence. Click to focus a branch; reset to return.",
  scale: "Use “Log / linear” to compare how the scale changes the same series.",
  projection:
    "Use “Next projection” or scrub the frame slider to compare projections.",
  drag: "Drag a node to change its position. Reset view restores the layout.",
  refine:
    "Click the canvas or press Enter to subdivide the image. Reset view restores the initial level.",
  index:
    "Scrub the frame slider to change the reference observation used to index every series.",
  tooltip:
    "Move over the line or use Left / Right arrow keys to inspect a value.",
};
function reset() {
  Object.assign(state, {
    zoom: 1,
    pan: [0, 0],
    rotation: 0,
    rotation3D: null,
    projection: 0,
    depth: 0,
    focus: 0,
    collapsed: false,
    sorted: false,
    log: false,
    refine: 0,
    dragNode: null,
  });
  $("brush-selection").hidden = true;
  $("selection-status").textContent = "";
  selected = -1;
}
function setPlaying(value) {
  playing = value && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("play").textContent = playing ? "Pause" : "Play";
  $("play").setAttribute("aria-pressed", String(playing));
  if (playing && !raf) raf = requestAnimationFrame(tick);
}
function tick(time) {
  raf = 0;
  if (!playing || document.hidden) return;
  if (time - lastFrame > 160) {
    lastFrame = time;
    state.frame = (state.frame + 1) % 101;
    $("frame").value = state.frame;
    $("frame-value").textContent = state.frame;
    syncUrl();
    render(false);
  }
  if (playing) raf = requestAnimationFrame(tick);
}
function syncUrl(push = false) {
  const url = new URL(location.href);
  url.searchParams.set("chart", entry.id);
  const q = $("catalog-search").value.trim(),
    category = $("catalog-category").value;
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  if (category !== "all") url.searchParams.set("category", category);
  else url.searchParams.delete("category");
  for (const [key, value, defaultValue] of [
    ["frame", state.frame, 50],
    ["detail", state.window, 16],
    ["samples", state.count, 192],
  ]) {
    if (value !== defaultValue) url.searchParams.set(key, String(value));
    else url.searchParams.delete(key);
  }
  history[push ? "pushState" : "replaceState"]({}, "", url);
}
function filter(sync = true) {
  const query = $("catalog-search").value.trim().toLowerCase(),
    category = $("catalog-category").value;
  let count = 0;
  for (const a of $("catalog-list").querySelectorAll("a")) {
    const item = entries.find((e) => e.id === a.dataset.example);
    const show =
      (category === "all" || item.category === category) &&
      `${item.title} ${item.category} ${item.adapter}`
        .toLowerCase()
        .includes(query);
    a.hidden = !show;
    if (show) count++;
  }
  $("catalog-status").textContent =
    `${count} of 174 examples${count ? "" : " · no matches"}`;
  if (sync) syncUrl();
}
function choose(id, push = true) {
  const found = entries.find((e) => e.id === id);
  entry = found || entries[71];
  reset();
  setPlaying(false);
  $("example-title").textContent = entry.title;
  $("example-category").textContent =
    `${entry.category} / ${String(entry.index).padStart(3, "0")} of 174`;
  $("example-description").textContent =
    descriptions[entry.adapter] ||
    `Explore ${entry.title.toLowerCase()} using local geometry and a reproducible demonstration dataset.`;
  $("example-source").href = entry.source;
  $("example-source").textContent = `${entry.author} / original example ↗`;
  $("interaction-help").textContent = help[entry.interaction] || help.inspect;
  for (const a of $("catalog-list").querySelectorAll("a")) {
    if (a.dataset.example === entry.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  const labels = {
    drill: "Drill into branch",
    sequence: "Focus sequence",
    sort: "Sort values",
    scale: "Log / linear",
    projection: "Next projection",
    refine: "Refine image",
    index: "Advance reference",
  };
  const action = $("action");
  action.hidden = !labels[entry.interaction];
  action.textContent = labels[entry.interaction] || "Change view";
  $("frame-control").hidden = !(
    entry.animated ||
    ["index", "projection", "rotate"].includes(entry.interaction)
  );
  $("detail-control").hidden = !(
    ["histogram", "kde", "density", "hexbin"].includes(entry.adapter) ||
    /moving-average|bollinger/.test(entry.variant)
  );
  $("play").disabled =
    !entry.animated || matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.title = `${entry.title} — Cerebral visualization lab`;
  if (!found && id)
    $("selection-status").textContent =
      "Unknown example. Showing the bar chart.";
  if (push) syncUrl(true);
  render();
}
function table() {
  const body = $("data-body");
  body.replaceChildren();
  for (const [i, r] of rows.slice(0, 48).entries()) {
    const tr = document.createElement("tr");
    for (const value of [
      i + 1,
      r.x.toFixed(4),
      r.value.toFixed(4),
      r.comparison.toFixed(4),
      r.group + 1,
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    body.append(tr);
  }
  $("data-caption").textContent =
    `${entry.title} / first ${Math.min(48, rows.length)} of ${rows.length} generated input samples`;
}
function labels(zoom = state.zoom, pan = state.pan) {
  const layer = $("chart-labels");
  layer.replaceChildren();
  for (const l of painter.labels.slice(0, 250)) {
    const span = document.createElement("span");
    span.className = "chart-label";
    span.textContent = l.text;
    const x = (l.x - 480) * zoom + 480 - pan[0] * zoom,
      y = (l.y - 280) * zoom + 280 - pan[1] * zoom;
    span.style.left = x / 9.6 + "%";
    span.style.top = y / 5.6 + "%";
    span.style.fontSize = (l.size || 11) + "px";
    if (l.background) {
      span.style.background = "var(--paper)";
      span.style.padding = "3px";
    }
    if (l.fill)
      span.style.color =
        l.fill === "#ffffff"
          ? l.fill
          : `color-mix(in srgb, ${l.fill} 60%, var(--ink))`;
    else if (l.muted) span.style.color = "var(--muted)";
    span.style.transform = `translate(${l.anchor === "middle" ? "-50%" : l.anchor === "end" ? "-100%" : "0"}, -50%)`;
    layer.append(span);
  }
}
function render(updateTable = true) {
  if (!kernels || !viewport) return;
  if (entry.variant.includes("geotiff") && !getTerrain()) {
    if (!terrainLoading) {
      terrainLoading = true;
      loadTerrain()
        .then(() => {
          terrainLoading = false;
          render();
        })
        .catch((error) => {
          canvas.dataset.error = error.message;
          $("renderer-error").textContent = error.message;
          $("renderer-error").hidden = false;
        });
    }
    return;
  }
  try {
    rows = kernels.generate(
      174 + entry.index * 981,
      state.count,
      entry.animated ? state.frame * 0.025 : 0,
    );
    if (entry.variant.includes("geotiff")) {
      const terrain = getTerrain();
      rows = terrain.values.map((value, i) => ({
        x: (i % terrain.width) / terrain.width,
        value,
        comparison: 0,
        group: Math.floor(i / terrain.width) % 6,
        weight: 1,
      }));
    }
    painter = new Painter(
      960,
      560,
      document.documentElement.dataset.theme === "dark",
    );
    draw(painter, rows, state, entry, kernels);
    if (
      !painter.marks ||
      !painter.tri.every(Number.isFinite) ||
      !painter.segments.every(Number.isFinite)
    )
      throw new Error("The layout produced no finite geometry");
    let zoom = state.zoom,
      pan = state.pan;
    if (/scatterplot-tour|smooth-zooming/.test(entry.variant)) {
      const t = state.frame / 100;
      zoom *= 1 + 2 * Math.sin(t * Math.PI) ** 2;
      pan = [Math.cos(t * Math.PI * 2) * 140, Math.sin(t * Math.PI * 2) * 70];
    }
    viewport.render(painter, zoom, pan);
    renderedView = { zoom, pan };
    labels(zoom, pan);
    if (updateTable) table();
    canvas.dataset.example = entry.id;
    canvas.dataset.marks = painter.marks;
    canvas.dataset.vertices =
      (painter.tri.length + painter.segments.length) / 3 +
      painter.images.length * 6;
    delete canvas.dataset.error;
    $("renderer-error").hidden = true;
    $("chart-caption").textContent =
      `${entry.title} / deterministic demo / ${painter.marks.toLocaleString()} marks / Three.js + WASM`;
  } catch (error) {
    canvas.dataset.error = error.message;
    $("renderer-error").textContent =
      `This example could not render: ${error.message}. The source link and catalog remain available.`;
    $("renderer-error").hidden = false;
    console.error(error);
  }
}
function position(event) {
  const rect = canvas.getBoundingClientRect();
  return [
    ((event.clientX - rect.left) / rect.width) * 960,
    ((event.clientY - rect.top) / rect.height) * 560,
  ];
}
function worldPosition(pos) {
  return [
    (pos[0] - 480) / renderedView.zoom + 480 + renderedView.pan[0],
    (pos[1] - 280) / renderedView.zoom + 280 + renderedView.pan[1],
  ];
}
function inspect(index) {
  if (!painter?.hits.length) return;
  selected = (index + painter.hits.length) % painter.hits.length;
  const hit = painter.hits[selected];
  $("chart-tooltip").textContent =
    `${hit.label}: ${typeof hit.value === "number" ? Number(hit.value.toPrecision(5)) : hit.value}`;
  $("chart-tooltip").hidden = false;
  if (entry.interaction === "sequence" && hit.path)
    $("selection-status").textContent = hit.path;
}
function action() {
  switch (entry.interaction) {
    case "drill":
    case "sequence":
      state.depth = state.depth ? 0 : 1;
      state.focus =
        selected < 0 ? 0 : (painter?.hits[selected]?.group ?? selected);
      state.collapsed = !state.collapsed;
      break;
    case "sort":
      state.sorted = !state.sorted;
      break;
    case "scale":
      state.log = !state.log;
      break;
    case "projection":
      state.projection = (state.projection + 1) % 4;
      break;
    case "refine":
      state.refine = (state.refine + 1) % 6;
      break;
    case "index":
      state.frame = (state.frame + 10) % 101;
      $("frame").value = state.frame;
      $("frame-value").textContent = state.frame;
      break;
  }
  render();
}
$("catalog-list").addEventListener("click", (event) => {
  const a = event.target.closest("a[data-example]");
  if (a) {
    event.preventDefault();
    choose(a.dataset.example);
  }
});
$("catalog-search").addEventListener("input", () => filter());
$("catalog-category").addEventListener("change", () => filter());
$("frame").addEventListener("input", (event) => {
  state.frame = Number(event.target.value);
  $("frame-value").textContent = state.frame;
  syncUrl();
  render();
});
$("detail").addEventListener("input", (event) => {
  state.window = Number(event.target.value);
  $("detail-value").textContent = state.window;
  syncUrl();
  render();
});
$("samples").addEventListener("change", (event) => {
  state.count = Number(event.target.value);
  syncUrl();
  render();
});
$("reset").addEventListener("click", () => {
  reset();
  render();
});
$("action").addEventListener("click", action);
$("play").addEventListener("click", () => setPlaying(!playing));
for (const [id, factor] of [
  ["zoom-in", 1.25],
  ["zoom-out", 0.8],
])
  $(id).addEventListener("click", () => {
    state.zoom = Math.max(0.5, Math.min(6, state.zoom * factor));
    render(false);
  });
$("lab-theme").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("lab-theme").setAttribute(
    "aria-label",
    `Switch to ${dark ? "light" : "dark"} theme`,
  );
  try {
    localStorage.setItem("cerebral-theme", dark ? "dark" : "light");
  } catch {}
  render(false);
});
function spherePoint(pos) {
  const x = (pos[0] - 480) / 240,
    y = (280 - pos[1]) / 240;
  return new Vector3(
    x,
    y,
    Math.sqrt(Math.max(0, 1 - x * x - y * y)),
  ).normalize();
}
canvas.addEventListener("pointerdown", (event) => {
  const pos = position(event);
  drag = { start: pos, last: pos, moved: false };
  if (entry.interaction === "rotate") {
    const rotation = state.rotation3D || [
      state.rotation + state.frame * 3.6,
      -15,
      0,
    ];
    drag.quaternion = new Quaternion().setFromEuler(
      new Euler(
        (rotation[1] * Math.PI) / 180,
        (rotation[0] * Math.PI) / 180,
        ((rotation[2] || 0) * Math.PI) / 180,
        "YXZ",
      ),
    );
  }
  if (entry.interaction === "drag" && painter?.hits.length) {
    state.dragNode = kernels.nearest(
      painter.hits.map((h) => [h.x, h.y]),
      ...worldPosition(pos),
    );
  }
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!painter) return;
  const pos = position(event);
  if (drag) {
    drag.moved ||=
      Math.hypot(pos[0] - drag.start[0], pos[1] - drag.start[1]) > 4;
    if (entry.interaction === "brush") {
      const a = drag.start,
        b = pos,
        box = $("brush-selection");
      box.hidden = false;
      box.style.left = Math.min(a[0], b[0]) / 9.6 + "%";
      box.style.top = Math.min(a[1], b[1]) / 5.6 + "%";
      box.style.width = Math.abs(a[0] - b[0]) / 9.6 + "%";
      box.style.height = Math.abs(a[1] - b[1]) / 5.6 + "%";
      const [lo, hi] = [
        worldPosition([Math.min(a[0], b[0]), Math.min(a[1], b[1])]),
        worldPosition([Math.max(a[0], b[0]), Math.max(a[1], b[1])]),
      ];
      const count = painter.hits.filter(
        (h) => h.x >= lo[0] && h.x <= hi[0] && h.y >= lo[1] && h.y <= hi[1],
      ).length;
      $("selection-status").textContent =
        `${count} marks selected in the brush region.`;
    } else if (entry.interaction === "rotate") {
      const delta = new Quaternion().setFromUnitVectors(
        spherePoint(drag.start),
        spherePoint(pos),
      );
      const euler = new Euler().setFromQuaternion(
        delta.multiply(drag.quaternion),
        "YXZ",
      );
      state.rotation3D = [
        (euler.y * 180) / Math.PI,
        (euler.x * 180) / Math.PI,
        (euler.z * 180) / Math.PI,
      ];
      render(false);
    } else if (entry.interaction === "drag") {
      const w = worldPosition(pos);
      state.dragX = Math.max(0.02, Math.min(0.98, (w[0] - 70) / 820));
      state.dragY = Math.max(0.02, Math.min(0.98, (w[1] - 40) / 470));
      render(false);
    } else if (["zoom", "pan"].includes(entry.interaction)) {
      state.pan[0] -= (pos[0] - drag.last[0]) / state.zoom;
      state.pan[1] -= (pos[1] - drag.last[1]) / state.zoom;
      render(false);
    }
    drag.last = pos;
  } else if (painter.hits.length)
    inspect(
      kernels.nearest(
        painter.hits.map((h) => [h.x, h.y]),
        ...worldPosition(pos),
      ),
    );
});
canvas.addEventListener("pointerup", () => {
  if (
    drag &&
    !drag.moved &&
    ["drill", "sequence", "refine"].includes(entry.interaction)
  ) {
    if (painter?.hits.length)
      inspect(
        kernels.nearest(
          painter.hits.map((h) => [h.x, h.y]),
          ...worldPosition(drag.start),
        ),
      );
    action();
  }
  if (
    drag &&
    !drag.moved &&
    entry.variant.includes("zoom-to-bounding-box") &&
    painter?.hits.length
  ) {
    inspect(
      kernels.nearest(
        painter.hits.map((h) => [h.x, h.y]),
        ...worldPosition(drag.start),
      ),
    );
    const bounds = painter.hits[selected]?.bounds;
    if (bounds) {
      const [[x0, y0], [x1, y1]] = bounds;
      state.zoom = Math.min(
        6,
        0.85 * Math.min(960 / Math.max(1, x1 - x0), 560 / Math.max(1, y1 - y0)),
      );
      state.pan = [(x0 + x1) / 2 - 480, (y0 + y1) / 2 - 280];
      render(false);
    }
  }
  drag = null;
});
canvas.addEventListener("pointercancel", () => {
  drag = null;
});
canvas.addEventListener("pointerleave", () => {
  if (!drag) $("chart-tooltip").hidden = true;
});
canvas.addEventListener(
  "wheel",
  (event) => {
    if (!["zoom", "pan"].includes(entry.interaction) || event.ctrlKey) return;
    event.preventDefault();
    state.zoom = Math.max(
      0.5,
      Math.min(6, state.zoom * (event.deltaY > 0 ? 0.9 : 1.1)),
    );
    render(false);
  },
  { passive: false },
);
canvas.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    inspect(selected + (event.key === "ArrowRight" ? 1 : -1));
  }
  if (event.key === "Enter") {
    event.preventDefault();
    action();
  }
  if (event.key === "+" || event.key === "=") {
    state.zoom = Math.min(6, state.zoom * 1.2);
    render(false);
  }
  if (event.key === "-") {
    state.zoom = Math.max(0.5, state.zoom / 1.2);
    render(false);
  }
  if (event.key === "Escape") {
    reset();
    render();
  }
});
$("download-data").addEventListener("click", () => {
  const csv = [
    "sample,x,value,comparison,group,weight",
    ...rows.map((r, i) =>
      [i + 1, r.x, r.value, r.comparison, r.group + 1, r.weight].join(","),
    ),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.id}-demo.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function readUrl() {
  const params = new URLSearchParams(location.search);
  $("catalog-search").value = params.get("q") || "";
  const category = params.get("category") || "all";
  $("catalog-category").value = [...$("catalog-category").options].some(
    (o) => o.value === category,
  )
    ? category
    : "all";
  filter(false);
  choose(params.get("chart") || entries[71].id, false);
  const number = (key, defaultValue, min, max) => {
    const value = Number(params.get(key) ?? defaultValue);
    return Number.isFinite(value)
      ? Math.min(max, Math.max(min, Math.round(value)))
      : defaultValue;
  };
  state.frame = number("frame", 50, 0, 100);
  state.window = number("detail", 16, 4, 32);
  state.count = number("samples", 192, 96, 384);
  if (![96, 192, 384].includes(state.count)) state.count = 192;
  $("frame").value = state.frame;
  $("frame-value").textContent = state.frame;
  $("detail").value = state.window;
  $("detail-value").textContent = state.window;
  $("samples").value = state.count;
  render();
}
window.addEventListener("popstate", readUrl);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  } else if (playing && !raf) raf = requestAnimationFrame(tick);
});
new ResizeObserver(() => {
  if (viewport) render(false);
}).observe($("canvas-stage"));
window.addEventListener("pagehide", () => {
  setPlaying(false);
  viewport?.dispose();
});
readUrl();
try {
  kernels = await loadKernels();
  $("wasm-status").textContent = "WASM / ready";
  viewport = new Viewport(canvas);
  $("webgl-status").textContent = "Three.js / WebGL ready";
  render();
} catch (error) {
  if (kernels) {
    rows = kernels.generate(174 + entry.index * 981, state.count, 0);
    table();
  }
  $("wasm-status").textContent = kernels
    ? "WASM / ready"
    : "WASM / unavailable";
  $("webgl-status").textContent = viewport
    ? "Three.js / ready"
    : "Three.js / unavailable";
  $("renderer-error").textContent =
    `Interactive rendering is unavailable: ${error.message}. Browse the source catalog or return to the benchmark evidence.`;
  $("renderer-error").hidden = false;
  canvas.dataset.error = error.message;
}
