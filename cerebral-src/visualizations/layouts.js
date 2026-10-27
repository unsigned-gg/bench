import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { hexbin } from "d3-hexbin";
import { palette } from "./painter.js";
import { drawMap } from "./maps.js";
import { drawSpecial } from "./special.js";
import { getTerrain } from "./raster.js";

import { adapterNames } from "./registry.mjs";
export { adapterNames };
const color = (i) =>
  palette[((i % palette.length) + palette.length) % palette.length];
const point = (x, y) => [x, y];
const chart = { left: 64, top: 40, right: 928, bottom: 510 };
function scales(p, domain = [0, 110]) {
  return {
    x: d3.scaleLinear([0, 1], [chart.left, p.width - 30]),
    y: d3.scaleLinear(domain, [chart.bottom, chart.top]),
  };
}
function series(rows, g = 0, phase = 0) {
  return rows.map((r, i) => ({
    ...r,
    value: Math.max(
      1,
      r.value * (0.6 + g * 0.13) + Math.sin(i * 0.15 + g + phase) * g * 3,
    ),
    group: g,
  }));
}
function hierarchy(rows, state, animated = false) {
  const data = {
    name: "All demand",
    children: Array.from({ length: 6 }, (_, g) => ({
      name: ["Arbor", "Birch", "Cedar", "Delta", "Elm", "Fir"][g],
      group: g,
      children: rows.slice(g * 6, g * 6 + 6).map((r, i) => ({
        name: `${String.fromCharCode(65 + g)}${i + 1}`,
        value:
          r.value *
          (animated ? 1 + 0.25 * Math.sin(state.frame * 0.08 + g + i) : 1),
        group: g,
        length: r.weight,
      })),
    })),
  };
  const focus = state.depth > 0 ? data.children[state.focus % 6] : data;
  return d3
    .hierarchy(focus)
    .sum((n) => n.value || 0)
    .sort((a, b) => b.value - a.value);
}
function treeLayout(p, rows, state, entry) {
  let root = hierarchy(rows, state, entry.animated);
  const v = entry.variant;
  const radial = /radial|tree-of-life/.test(v);
  const indented = v.includes("indented");
  if (state.collapsed && root.children)
    root.children = root.children.slice(0, 3);
  const layout =
    v.includes("cluster") || v.includes("tree-of-life")
      ? d3.cluster()
      : d3.tree();
  layout.size(radial ? [2 * Math.PI, 215] : [440, 760])(root);
  const pos = (n) =>
    radial
      ? [
          480 + Math.cos(n.x - Math.PI / 2) * n.y,
          280 + Math.sin(n.x - Math.PI / 2) * n.y,
        ]
      : [90 + n.y, 55 + n.x];
  if (v.includes("tree-of-life"))
    for (const n of root.descendants())
      n.y = Math.min(215, n.depth * 45 + (n.data.length || 0) * 4);
  if (indented) {
    root.eachBefore((n) => {
      n.x = 30 + root.descendants().indexOf(n) * 13;
      n.y = n.depth * 36;
    });
  }
  for (const link of root.links()) {
    const a = pos(link.source),
      b = pos(link.target);
    if (radial) p.line([a, b], color(link.target.data.group || 0));
    else p.path(d3.linkHorizontal()({ source: a, target: b }), null, p.rule);
  }
  for (const n of root.descendants()) {
    const [x, y] = pos(n);
    p.circle(x, y, n.children ? 4 : 2.8, color(n.data.group || 0));
    p.text(x + (radial ? 5 : 8), y, n.data.name, { size: 11 });
    p.hit(x, y, n.data.name, n.value, {
      group: n.data.group ?? 0,
      path: n
        .ancestors()
        .reverse()
        .map((a) => a.data.name)
        .join(" → "),
    });
  }
}
function treemap(p, rows, state, entry) {
  const root = hierarchy(rows, state, entry.animated);
  const cascade = entry.variant.includes("cascaded"),
    nested = entry.variant.includes("nested");
  d3
    .treemap()
    .size([870, 470])
    .paddingOuter(nested ? 8 : 3)
    .paddingInner(nested ? 5 : 2)
    .paddingTop(nested ? 20 : 2)(root);
  const nodes =
    nested || cascade
      ? root.descendants().filter((n) => n.depth > 0)
      : root.leaves();
  for (const n of nodes) {
    const offset = cascade ? n.depth * 7 : 0;
    const x = 45 + n.x0 + offset,
      y = 40 + n.y0 + offset,
      w = n.x1 - n.x0 - offset,
      h = n.y1 - n.y0 - offset;
    if (w <= 0 || h <= 0) continue;
    p.rect(x, y, w, h, color(n.data.group || 0));
    if (w > 24 && h > 18)
      p.text(x + 6, y + 14, n.data.name, { fill: "#ffffff", size: 11 });
    p.hit(x + w / 2, y + h / 2, n.data.name, n.value, {
      group: n.data.group ?? 0,
    });
  }
}
function packing(p, rows, state, entry) {
  const root = hierarchy(rows, state, entry.animated);
  d3.pack().size([880, 470]).padding(5)(root);
  for (const n of root.descendants()) {
    p.circle(
      40 + n.x,
      40 + n.y,
      n.r,
      n.children ? p.paper : color(n.data.group || 0),
      p.rule,
    );
    if (!n.children) {
      p.text(40 + n.x, 40 + n.y, n.data.name, {
        anchor: "middle",
        fill: "#ffffff",
        size: 11,
      });
      p.hit(40 + n.x, 40 + n.y, n.data.name, n.value, {
        group: n.data.group ?? 0,
      });
    }
  }
}
function partition(p, rows, state, entry) {
  const root = hierarchy(rows, state, entry.animated);
  const radial = entry.adapter === "sunburst";
  d3.partition().size(radial ? [2 * Math.PI, 220] : [860, 470])(root);
  if (radial) {
    for (const n of root.descendants().slice(1)) {
      const arc = d3
        .arc()
        .innerRadius(n.y0)
        .outerRadius(n.y1 - 1)
        .startAngle(n.x0)
        .endAngle(n.x1 - 0.005);
      const d = arc();
      p.path(translatePath(d, 480, 280), color(n.data.group || 0), p.paper);
      const [x, y] = arc.centroid();
      p.hit(480 + x, 280 + y, n.data.name, n.value, {
        group: n.data.group ?? 0,
        path: n
          .ancestors()
          .reverse()
          .map((a) => a.data.name)
          .join(" → "),
      });
      if (n.x1 - n.x0 > 0.25)
        p.text(480 + x, 280 + y, n.data.name, {
          anchor: "middle",
          fill: "#ffffff",
          size: 11,
        });
    }
  } else
    for (const n of root.descendants()) {
      p.rect(
        50 + n.x0,
        40 + n.y0,
        Math.max(0, n.x1 - n.x0 - 1),
        n.y1 - n.y0 - 1,
        color(n.data.group || 0),
      );
      if (n.x1 - n.x0 > 25)
        p.text(55 + n.x0, 55 + n.y0, n.data.name, {
          fill: "#ffffff",
          size: 11,
        });
      p.hit(
        50 + (n.x0 + n.x1) / 2,
        40 + (n.y0 + n.y1) / 2,
        n.data.name,
        n.value,
      );
    }
}
// D3 paths are parsed into geometry, never mounted as SVG in the document.
function translatePath(d, x, y) {
  if (!d) return null;
  return d
    .replace(
      /([ML])(-?[\d.e+-]+),(-?[\d.e+-]+)/g,
      (_, c, a, b) => `${c}${Number(a) + x},${Number(b) + y}`,
    )
    .replace(/([Aa])([^AaMLCZ]*)/g, (all, c, rest) => {
      const nums = rest.split(",");
      if (nums.length === 7) {
        nums[5] = String(Number(nums[5]) + x);
        nums[6] = String(Number(nums[6]) + y);
        return c + nums.join(",");
      }
      return all;
    });
}
// Arc/radial transforms use a temporary coordinate offset on painter primitives.
function withOffset(p, x, y, fn) {
  const tri = p.tri.length,
    seg = p.segments.length,
    labels = p.labels.length,
    hits = p.hits.length;
  fn();
  for (let i = tri; i < p.tri.length; i += 3) {
    p.tri[i] += x;
    p.tri[i + 1] += y;
  }
  for (let i = seg; i < p.segments.length; i += 3) {
    p.segments[i] += x;
    p.segments[i + 1] += y;
  }
  for (let i = labels; i < p.labels.length; i++) {
    p.labels[i].x += x;
    p.labels[i].y += y;
  }
  for (let i = hits; i < p.hits.length; i++) {
    p.hits[i].x += x;
    p.hits[i].y += y;
  }
}
function bars(p, rows, state, entry) {
  const v = entry.variant;
  const horizontal = /horizontal|race|hierarchical/.test(v);
  const diverge = /diverging/.test(v);
  const grouped = /grouped|stacked-to-grouped/.test(v);
  const stacked =
    /stacked|revenue/.test(v) && (!grouped || v.includes("stacked-to-grouped"));
  const normalized = /normalized/.test(v);
  let data = rows.slice(0, horizontal ? 12 : 20).map((r, i) => ({
    ...r,
    value:
      r.value *
      (entry.animated ? 1 + 0.25 * Math.sin(state.frame * 0.06 + i) : 1),
    name: `Group ${i + 1}`,
  }));
  if (state.sorted || v.includes("race"))
    data.sort((a, b) => b.value - a.value);
  if (v.includes("hierarchical")) {
    data =
      state.depth > 0
        ? rows
            .slice((state.focus % 6) * 6, (state.focus % 6) * 6 + 6)
            .map((r, i) => ({ ...r, name: `Item ${i + 1}` }))
        : d3.range(6).map((g) => ({
            ...rows[g],
            value: d3.sum(rows.slice(g * 6, g * 6 + 6), (r) => r.value),
            name: `Group ${g + 1}`,
            group: g,
          }));
  }
  const max = normalized
    ? 1
    : d3.max(data, (r) =>
        stacked
          ? r.value + r.comparison + r.weight
          : grouped
            ? Math.max(r.value, r.comparison, r.weight)
            : r.value,
      ) * 1.1;
  const scale = d3.scaleLinear(
    [diverge ? -max : max * 0, max],
    horizontal ? [100, 900] : [510, 40],
  );
  const band = d3
    .scaleBand(
      data.map((r) => r.name),
      horizontal ? [45, 500] : [65, 925],
    )
    .padding(0.18);
  if (horizontal) {
    p.line(
      [
        [100, 510],
        [900, 510],
      ],
      p.rule,
    );
    for (let i = 0; i <= 4; i++) {
      const value = (diverge ? -max : 0) + ((diverge ? max * 2 : max) * i) / 4,
        x = scale(value);
      p.line(
        [
          [x, 40],
          [x, 510],
        ],
        p.rule,
      );
      p.text(x, 532, Number(value.toPrecision(3)), {
        anchor: "middle",
        muted: true,
      });
    }
    p.text(100, 20, normalized ? "Share" : "Demo units", { muted: true });
  } else
    p.axis(64, 510, diverge ? [-max, max] : [0, max], [
      "Groups",
      normalized ? "Share" : "Demo units",
    ]);
  for (const [i, r] of data.entries()) {
    const n = stacked || grouped ? 3 : 1;
    let base = 0;
    const total = r.value + r.comparison + r.weight;
    for (let g = 0; g < n; g++) {
      let value = [r.value, r.comparison, r.weight][g];
      if (normalized) value /= total;
      if (diverge) value *= i % 3 === 0 ? -1 : 1;
      const transition = v.includes("stacked-to-grouped")
        ? d3.easeCubic(state.frame / 100)
        : null;
      const groupAmount = transition ?? (grouped && !stacked ? 1 : 0);
      const baseValue = stacked ? base * (1 - groupAmount) : 0;
      const a = scale(baseValue),
        b = scale(baseValue + value);
      const thickness = band.bandwidth() * (1 - (groupAmount * 2) / 3);
      const t = band(r.name) + ((g * band.bandwidth()) / 3) * groupAmount;
      if (horizontal) {
        p.rect(
          Math.min(a, b),
          t,
          Math.abs(b - a),
          thickness,
          color(n > 1 ? g : r.group),
        );
        p.hit(Math.max(a, b), t + thickness / 2, r.name, value);
        if (g === 0)
          p.text(92, t + thickness / 2, r.name, { anchor: "end", size: 11 });
      } else {
        p.rect(
          t,
          Math.min(a, b),
          thickness,
          Math.abs(b - a),
          color(n > 1 ? g : r.group),
        );
        p.hit(t + thickness / 2, Math.min(a, b), r.name, value);
        if (g === 0 && i % 2 === 0)
          p.text(t, 530, r.name.replace("Group ", ""), { size: 10 });
      }
      if (stacked) base += value;
    }
  }
}
function lineChart(p, rows, state, entry, k) {
  const v = entry.variant,
    tourism = v.includes("tourists"),
    index = v.includes("index-chart"),
    change = v.includes("change-line");
  const count = /multi|ice|inline|labelling|inequality|index/.test(v) ? 6 : 1;
  let dataSets = Array.from({ length: count }, (_, g) =>
    rows.map((r, i) => ({
      ...r,
      value:
        g === 0
          ? r.value
          : Math.max(
              1,
              r.value * (0.6 + g * 0.1) + Math.sin(i * 0.15 + g) * g * 3,
            ),
    })),
  );
  if (tourism)
    dataSets = [
      rows.map((r) => ({
        ...r,
        value: 0.5 * Math.exp(r.x * 5) * (1 + (r.value - 50) / 300),
      })),
    ];
  if (v.includes("sea-ice"))
    dataSets = dataSets.map((data, g) =>
      data.map((r) => ({
        ...r,
        value: 45 + 30 * Math.cos(r.x * Math.PI * 2) + g * 4 + r.weight * 0.15,
      })),
    );
  if (index)
    dataSets = dataSets.map((data) => {
      const reference =
        data[Math.floor((state.frame / 100) * (data.length - 1))].value;
      return data.map((r) => ({ ...r, value: (r.value / reference) * 100 }));
    });
  if (change)
    dataSets = dataSets.map((data) =>
      data.map((r) => ({ ...r, value: (r.value / data[0].value - 1) * 100 })),
    );
  if (v.includes("moving-average")) {
    const mean = k.average(
      rows.map((r) => r.value),
      state.window,
    );
    dataSets = [rows.map((r, i) => ({ ...r, value: mean[i] }))];
  }
  const band = v.includes("bollinger")
    ? k.bands(
        rows.map((r) => r.value),
        state.window,
      )
    : null;
  const all = dataSets.flat().map((r) => r.value);
  if (band)
    all.push(...band.flatMap((r) => [r.mean - 2 * r.std, r.mean + 2 * r.std]));
  const min = tourism && state.log ? d3.min(all) : Math.min(0, d3.min(all)),
    max = d3.max(all) * 1.08;
  const x = d3.scaleLinear([0, 1], [64, 930]),
    y = (tourism && state.log ? d3.scaleLog() : d3.scaleLinear())
      .domain([min, max])
      .range([510, 40]);
  p.line(
    [
      [64, 40],
      [64, 510],
      [930, 510],
    ],
    p.rule,
  );
  const ticks =
    tourism && state.log
      ? [0.5, 1, 2, 5, 10, 20, 50].filter((t) => t >= min && t <= max)
      : y.ticks(5);
  for (const tick of ticks) {
    p.line(
      [
        [64, y(tick)],
        [930, y(tick)],
      ],
      p.rule,
    );
    p.text(54, y(tick), Number(tick.toPrecision(3)), {
      anchor: "end",
      muted: true,
    });
  }
  p.text(
    64,
    18,
    index
      ? "Index / reference = 100"
      : change
        ? "Relative change (%)"
        : tourism && state.log
          ? "Value / logarithmic scale"
          : "Demo units",
    { muted: true },
  );
  p.text(930, 538, "Sample position", { anchor: "end", muted: true });
  if (band) {
    p.path(
      d3
        .area()
        .x((r) => x(r.x))
        .y0((r, i) => y(band[i].mean - 2 * band[i].std))
        .y1((r, i) => y(band[i].mean + 2 * band[i].std))(rows),
      "#A8BFD2",
      null,
    );
    p.line(
      rows.map((r, i) => [x(r.x), y(band[i].mean)]),
      color(1),
    );
  }
  dataSets.forEach((data, g) => {
    if (/variable-color|gradient-encoding|threshold-encoding/.test(v)) {
      for (let i = 1; i < data.length; i++) {
        const stroke = v.includes("threshold")
          ? data[i].value > 60
            ? color(1)
            : color(0)
          : d3.interpolateTurbo(i / data.length);
        p.line(
          [
            [x(data[i - 1].x), y(data[i - 1].value)],
            [x(data[i].x), y(data[i].value)],
          ],
          stroke,
        );
      }
    } else
      p.path(
        d3
          .line()
          .defined((r, i) => !v.includes("missing") || i % 18 < 13)
          .x((r) => x(r.x))
          .y((r) => y(r.value))
          .curve(d3.curveMonotoneX)(data),
        null,
        color(g),
      );
    if (v.includes("inline")) {
      const r = data[Math.floor(data.length * (0.25 + g * 0.1))];
      p.text(x(r.x), y(r.value), `Series ${g + 1}`, {
        anchor: "middle",
        fill: color(g),
        size: 11,
        background: true,
      });
    } else if (/labelling|ice/.test(v)) {
      const r = data.at(-1);
      p.text(x(r.x) - 4, y(r.value) - 8, `Series ${g + 1}`, {
        anchor: "end",
        fill: color(g),
        size: 11,
      });
    }
    if (v.includes("styled-axes")) {
      p.line(
        [
          [64, 40],
          [64, 510],
          [930, 510],
        ],
        color(1),
      );
      p.text(70, 535, "Styled ticks / aligned grid / explicit units", {
        size: 11,
      });
    }
    data
      .filter((r, i) => i % 4 === 0)
      .forEach((r, i) =>
        p.hit(x(r.x), y(r.value), `Series ${g + 1} / ${i * 4 + 1}`, r.value),
      );
  });
}
function areaChart(p, rows, state, entry) {
  const v = entry.variant;
  const { x, y } = scales(p, [
    0,
    /stacked|stream|population/.test(v) ? 400 : 110,
  ]);
  const stack = /stacked|stream|population/.test(v);
  const normalized = v.includes("normalized");
  p.axis(64, 510, normalized ? [0, 1] : [0, stack ? 400 : 110], [
    "Sample position",
    normalized ? "Share" : "Demo units",
  ]);
  if (stack) {
    const matrix = rows.map((r, i) =>
      Object.fromEntries(
        Array.from({ length: 6 }, (_, g) => [
          g,
          Math.max(
            1,
            r.value * 0.6 + 25 * Math.sin(i * 0.12 + g + state.frame * 0.03),
          ),
        ]),
      ),
    );
    const layers = d3
      .stack()
      .keys(d3.range(6))
      .offset(
        normalized
          ? d3.stackOffsetExpand
          : v.includes("stream")
            ? d3.stackOffsetWiggle
            : d3.stackOffsetNone,
      )(matrix);
    const sy = d3.scaleLinear(d3.extent(layers.flat(2)), [510, 40]);
    for (let g = 0; g < layers.length; g++) {
      const area = d3
        .area()
        .x((r, i) => x(rows[i].x))
        .y0((r) => sy(r[0]))
        .y1((r) => sy(r[1]))
        .curve(d3.curveBasis);
      p.path(area(layers[g]), color(g), null);
    }
  } else if (v.includes("difference")) {
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      p.polygon(
        [
          [x(a.x), y(a.value)],
          [x(b.x), y(b.value)],
          [x(b.x), y(b.comparison)],
          [x(a.x), y(a.comparison)],
        ],
        b.value > b.comparison ? color(0) : color(1),
      );
    }
  } else {
    const area = d3
      .area()
      .defined((r, i) => !v.includes("missing") || i % 20 < 14)
      .x((r) => x(r.x))
      .y0((r) => (v.includes("band") ? y(r.comparison) : 510))
      .y1((r) => y(r.value))
      .curve(d3.curveMonotoneX);
    p.path(area(rows), color(0), null);
  }
  rows
    .filter((r, i) => i % 6 === 0)
    .forEach((r) => p.hit(x(r.x), y(r.value), r.name, r.value));
}
function scatter(p, rows, state, entry) {
  const v = entry.variant;
  const { x, y } = scales(p);
  p.axis(64, 510, [0, 110], ["Demo variable X", "Demo variable Y"]);
  const points = rows.map((r, i) => [
    x(v.includes("hertzsprung") ? Math.log10(r.weight) / 1.4 : r.x),
    y(r.comparison * 0.8 + Math.sin(r.angle + state.frame * 0.02) * 12),
    r,
  ]);
  if (v.includes("connected"))
    p.line(
      points.map((r) => r.slice(0, 2)),
      p.muted,
    );
  for (const [i, [a, b, r]] of points.entries()) {
    const rsize = /wealth|bubble/.test(v) ? r.weight : 3.5;
    if (v.includes("shapes") && i % 3 === 0)
      p.polygon(
        [
          [a, b - rsize],
          [a + rsize, b + rsize],
          [a - rsize, b + rsize],
        ],
        color(r.group),
      );
    else if (v.includes("shapes") && i % 3 === 1)
      p.rect(a - rsize, b - rsize, rsize * 2, rsize * 2, color(r.group));
    else p.circle(a, b, rsize, color(r.group));
    p.hit(a, b, r.name, r.comparison);
  }
}
function matrix(p, rows, state, entry) {
  const n = 4,
    size = 113,
    gap = 8;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      const left = 220 + a * (size + gap),
        top = 35 + b * (size + gap);
      p.line(
        [
          [left, top],
          [left + size, top],
          [left + size, top + size],
          [left, top + size],
          [left, top],
        ],
        p.rule,
      );
      if (a === b) {
        p.text(
          left + size / 2,
          top + size / 2,
          ["Value", "Comparison", "Weight", "Phase"][a],
          { anchor: "middle", size: 11 },
        );
        continue;
      }
      for (const r of rows.slice(0, 80)) {
        const vars = [
          r.value / 110,
          r.comparison / 100,
          r.weight / 22,
          r.angle / (Math.PI * 2),
        ];
        const x = left + vars[a] * size,
          y = top + (1 - vars[b]) * size;
        p.circle(x, y, 2, color(r.group));
        p.hit(x, y, r.name, vars[a]);
      }
    }
}
function network(p, rows, state, entry, k) {
  const n = entry.variant.includes("tree")
    ? 31
    : entry.variant.includes("temporal")
      ? 12 + Math.floor(state.frame / 4)
      : 40;
  const nodes = rows.slice(0, n).map((r, i) => ({
    x: 0.5 + 0.32 * Math.cos((i / n) * 6.283),
    y: 0.5 + 0.32 * Math.sin((i / n) * 6.283),
    group: r.group,
  }));
  let links = d3.range(1, n).map((i) => ({
    source: entry.variant.includes("tree")
      ? Math.floor((i - 1) / 2)
      : Math.max(0, i - 1 - (i % 4)),
    target: i,
  }));
  if (entry.variant.includes("disjoint"))
    links = links.filter((e) => e.target % 10 !== 0);
  let positions = k.force(nodes, links, 25 + Math.floor(state.frame / 5));
  if (entry.variant.includes("collision")) {
    positions = positions.map((n, i) => ({ ...n, r: (5 + (i % 3)) / 820 }));
    d3.forceSimulation(positions)
      .force(
        "collide",
        d3.forceCollide((n) => n.r * 2),
      )
      .stop()
      .tick(45);
  }
  if (
    state.dragNode !== null &&
    state.dragNode !== undefined &&
    positions[state.dragNode]
  ) {
    positions[state.dragNode].x = state.dragX;
    positions[state.dragNode].y = state.dragY;
  }
  for (const e of links) {
    const a = positions[e.source],
      b = positions[e.target];
    p.line(
      [
        [70 + a.x * 820, 40 + a.y * 470],
        [70 + b.x * 820, 40 + b.y * 470],
      ],
      p.rule,
    );
    if (entry.variant.includes("patent")) {
      const x = 70 + b.x * 820,
        y = 40 + b.y * 470;
      p.polygon(
        [
          [x, y],
          [x - 7, y - 3],
          [x - 5, y + 6],
        ],
        p.muted,
      );
    }
  }
  positions.forEach((r, i) => {
    p.circle(70 + r.x * 820, 40 + r.y * 470, 5 + (i % 3), color(r.group));
    p.hit(70 + r.x * 820, 40 + r.y * 470, `Node ${i + 1}`, i);
  });
}
function sankeyChart(p, rows, state, entry) {
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    name: `Stage ${Math.floor(i / 4) + 1}.${(i % 4) + 1}`,
  }));
  const links = [];
  for (let s = 0; s < 8; s++) {
    for (let g = 0; g < 2; g++)
      links.push({
        source: s,
        target: Math.floor(s / 4) * 4 + 4 + ((s + g) % 4),
        value: rows[s * 2 + g].weight,
      });
  }
  const graph = sankey()
    .nodeId((n) => n.id)
    .nodeWidth(12)
    .nodePadding(16)
    .extent([
      [90, 40],
      [870, 510],
    ])({ nodes, links });
  for (const e of graph.links) {
    const source = [e.source.x1, e.y0],
      target = [e.target.x0, e.y1];
    const path = d3.path();
    path.moveTo(source[0], source[1] - e.width / 2);
    path.bezierCurveTo(
      (source[0] + target[0]) / 2,
      source[1] - e.width / 2,
      (source[0] + target[0]) / 2,
      target[1] - e.width / 2,
      target[0],
      target[1] - e.width / 2,
    );
    path.lineTo(target[0], target[1] + e.width / 2);
    path.bezierCurveTo(
      (source[0] + target[0]) / 2,
      target[1] + e.width / 2,
      (source[0] + target[0]) / 2,
      source[1] + e.width / 2,
      source[0],
      source[1] + e.width / 2,
    );
    path.closePath();
    p.path(path.toString(), color(e.source.index % 4), null);
  }
  for (const n of graph.nodes) {
    p.rect(n.x0, n.y0, n.x1 - n.x0, n.y1 - n.y0, p.ink);
    p.text(n.x0 + 16, n.y0 + 10, n.name, { size: 11 });
    p.hit(n.x0, (n.y0 + n.y1) / 2, n.name, n.value);
  }
}
function chordChart(p, rows, state, entry) {
  const n = 6,
    matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) =>
        Math.round(rows[(i * n + j) % rows.length].weight),
      ),
    );
  const directed = /directed|dependency/.test(entry.variant);
  const layout = (directed ? d3.chordDirected() : d3.chord()).padAngle(0.035)(
    matrix,
  );
  withOffset(p, 480, 280, () => {
    for (const arc of layout.groups) {
      p.path(
        d3.arc().innerRadius(206).outerRadius(220)(arc),
        color(arc.index),
        null,
      );
      const a = (arc.startAngle + arc.endAngle) / 2;
      p.text(Math.sin(a) * 237, -Math.cos(a) * 237, `G${arc.index + 1}`, {
        anchor: "middle",
        size: 12,
      });
    }
    for (const ribbon of layout) {
      p.path(
        (directed ? d3.ribbonArrow() : d3.ribbon()).radius(202)(ribbon),
        color(ribbon.source.index),
        null,
      );
    }
  });
}
function bundleChart(p, rows, state, entry) {
  const root = hierarchy(rows, state, entry.animated);
  d3.cluster().size([2 * Math.PI, 210])(root);
  const leaves = root.leaves();
  withOffset(p, 480, 280, () => {
    const line = d3
      .lineRadial()
      .radius((d) => d.y)
      .angle((d) => d.x)
      .curve(d3.curveBundle.beta(entry.variant.endsWith("-2") ? 0.75 : 0.93));
    leaves.forEach((n, i) => {
      const other = leaves[(i * 7 + 11) % leaves.length];
      p.path(line(n.path(other)), null, color(n.data.group));
      const x = Math.sin(n.x) * n.y,
        y = -Math.cos(n.x) * n.y;
      p.text(x * 1.09, y * 1.09, n.data.name, { anchor: "middle", size: 10 });
      p.hit(x, y, n.data.name, n.value, {
        group: n.data.group ?? 0,
        path: n
          .ancestors()
          .reverse()
          .map((a) => a.data.name)
          .join(" → "),
      });
    });
  });
}
function pieChart(p, rows, state, entry) {
  const donut = entry.variant.includes("donut"),
    values = rows.slice(0, 8).map((r, i) => ({
      ...r,
      value:
        r.value *
        (entry.animated ? 1 + 0.3 * Math.sin(state.frame * 0.06 + i) : 1),
    }));
  const arcs = d3.pie().value((r) => r.value)(values);
  withOffset(p, 480, 280, () => {
    for (const a of arcs) {
      const arc = d3
        .arc()
        .innerRadius(donut ? 120 : 0)
        .outerRadius(220)
        .padAngle(0.012);
      p.path(arc(a), color(a.index), null);
      const [x, y] = arc.centroid(a);
      p.text(x, y, `${a.index + 1}`, { anchor: "middle", fill: "#ffffff" });
      p.hit(x, y, a.data.name, a.value);
    }
  });
}
function heatmap(p, rows, state, entry) {
  const calendar = entry.adapter === "calendar";
  const usage = entry.variant.includes("electric");
  const cols = calendar ? 52 : usage ? 48 : 40,
    rs = calendar ? 7 : usage ? 12 : 20;
  const dx = 840 / cols,
    dy = Math.min(58, 450 / rs);
  for (let r = 0; r < rs; r++)
    for (let c = 0; c < cols; c++) {
      let value = rows[(r * cols + c) % rows.length].value / 110;
      if (entry.variant.includes("vaccines")) value *= c < 22 ? 1 : 0.18;
      p.rect(
        70 + c * dx,
        50 + r * dy,
        Math.max(1, dx - 1),
        dy - 1,
        d3.interpolateViridis(value),
      );
      p.hit(
        70 + (c + 0.5) * dx,
        50 + (r + 0.5) * dy,
        `${calendar ? "Week" : "Column"} ${c + 1} / ${r + 1}`,
        value,
      );
    }
  p.text(
    70,
    30,
    calendar
      ? "52 weeks × 7 days"
      : usage
        ? "Days × half-hour intervals"
        : "Time × category",
    { muted: true },
  );
  if (entry.variant.includes("vaccines")) {
    p.line(
      [
        [70 + 22 * dx, 45],
        [70 + 22 * dx, 510],
      ],
      p.ink,
    );
    p.text(70 + 22 * dx + 6, 530, "Intervention boundary (demo)", { size: 11 });
  }
}
function statistics(p, rows, state, entry, k) {
  const v = entry.variant,
    { x, y } = scales(p);
  const values = rows.map((r) => r.value);
  if (entry.adapter === "box") {
    for (let g = 0; g < 6; g++) {
      const q = k.quantiles(
          rows.filter((r) => r.group === g).map((r) => r.value),
        ),
        xx = 140 + g * 135;
      const sy = d3.scaleLinear([0, 110], [500, 40]);
      p.line(
        [
          [xx, sy(q[0])],
          [xx, sy(q[4])],
        ],
        p.ink,
      );
      p.rect(xx - 30, sy(q[3]), 60, sy(q[1]) - sy(q[3]), color(g));
      p.line(
        [
          [xx - 30, sy(q[2])],
          [xx + 30, sy(q[2])],
        ],
        p.paper,
      );
      p.line(
        [
          [xx - 16, sy(q[0])],
          [xx + 16, sy(q[0])],
        ],
        p.ink,
      );
      p.line(
        [
          [xx - 16, sy(q[4])],
          [xx + 16, sy(q[4])],
        ],
        p.ink,
      );
      p.text(xx, 530, `G${g + 1}`, { anchor: "middle" });
      p.hit(xx, sy(q[2]), `Group ${g + 1} median`, q[2]);
    }
    p.axis(64, 510);
  } else if (entry.adapter === "histogram") {
    const bins = k.histogram(values, state.window, 0, 110);
    const max = d3.max(bins) || 1;
    bins.forEach((n, i) => {
      const h = (n / max) * 440;
      p.rect(
        65 + (i * 860) / bins.length,
        510 - h,
        860 / bins.length - 2,
        h,
        color(0),
      );
      p.hit(65 + ((i + 0.5) * 860) / bins.length, 510 - h, `Bin ${i + 1}`, n);
    });
    p.axis(64, 510, [0, max], ["Value bin", "Count"]);
  } else if (entry.adapter === "kde") {
    const density = k.kde(values, state.window / 2, 0, 110),
      sx = d3.scaleLinear([0, 110], [65, 930]),
      sy = d3.scaleLinear([0, d3.max(density, (r) => r[1])], [510, 40]);
    p.path(
      d3
        .area()
        .x((r) => sx(r[0]))
        .y0(510)
        .y1((r) => sy(r[1]))
        .curve(d3.curveBasis)(density),
      color(0),
      null,
    );
    p.axis(
      64,
      510,
      [0, d3.max(density, (r) => r[1])],
      ["Value", "Estimated density"],
    );
  } else {
    const a = values.slice().sort(d3.ascending),
      b = v.includes("normal")
        ? a.map((r, i) => inverseNormal((i + 0.5) / a.length))
        : rows.map((r) => r.comparison).sort(d3.ascending);
    const sx = d3.scaleLinear(d3.extent(a), [65, 930]),
      sy = d3.scaleLinear(d3.extent(b), [510, 40]);
    a.forEach((r, i) => p.circle(sx(r), sy(b[i]), 3, color(0)));
    p.line(
      [
        [65, 510],
        [930, 40],
      ],
      p.rule,
    );
    p.axis(64, 510, d3.extent(b), [
      "Sample quantile",
      v.includes("normal") ? "Normal quantile" : "Comparison quantile",
    ]);
  }
}
function inverseNormal(p) {
  const a = [
      -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269,
      -30.6647980661472, 2.50662827745924,
    ],
    b = [
      -54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197,
      -13.2806815528857,
    ],
    c = [
      -0.00778489400243029, -0.322396458041136, -2.40075827716184,
      -2.54973253934373, 4.37466414146497, 2.93816398269878,
    ],
    d = [
      0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742,
    ];
  const poly = (cs, x) => cs.reduce((v, c) => v * x + c, 0);
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    return poly(c, q) / (poly(d, q) * q + 1);
  }
  if (p > 0.97575) return -inverseNormal(1 - p);
  const q = p - 0.5,
    r = q * q;
  return (poly(a, r) * q) / (poly(b, r) * r + 1);
}
function contourChart(p, rows, state, entry, k) {
  const density = entry.adapter === "density";
  let contours;
  if (density)
    contours = d3
      .contourDensity()
      .x((r) => 70 + r.x * 820)
      .y((r) => 60 + r.comparison * 4)
      .size([960, 560])
      .bandwidth(state.window * 2)
      .thresholds(12)(rows);
  else {
    const size = 64,
      values = d3.range(size * size).map((i) => {
        const x = ((i % size) - size / 2) / size,
          y = (Math.floor(i / size) - size / 2) / size;
        return entry.variant.includes("volcano") ||
          entry.variant.includes("geotiff")
          ? 110 * Math.exp(-(x * x + y * y) * 12) + Math.sin(x * 40) * 8
          : 40 * (Math.sin(x * 15) + Math.cos(y * 15));
      });
    const raster = entry.variant.includes("geotiff") ? getTerrain() : null;
    contours = d3
      .contours()
      .size([raster?.width || size, raster?.height || size])
      .thresholds(raster ? k.quantiles(raster.values) : 18)(
      raster ? raster.values : values,
    );
  }
  const path = d3.geoPath(
    density ? null : d3.geoIdentity().scale(7).translate([260, 45]),
  );
  for (const c of contours)
    p.path(
      path(c),
      d3.interpolateViridis(
        (c.value - (density ? 0 : -80)) /
          (density ? d3.max(contours, (r) => r.value) : 190),
      ),
      p.paper,
    );
  p.text(
    65,
    25,
    entry.variant.includes("geotiff")
      ? "Decoded GeoTIFF · EPSG:4326 · 64 × 64 elevation raster"
      : density
        ? "Kernel density isolines"
        : "Marching-squares raster contours",
    { muted: true },
  );
}
function hexChart(p, rows, state, entry) {
  const points = rows.map((r) => [70 + r.x * 820, 50 + r.comparison * 4.3]);
  const bins = hexbin()
      .radius(state.window)
      .extent([
        [65, 40],
        [930, 510],
      ])(points),
    max = d3.max(bins, (r) => r.length) || 1;
  for (const bin of bins) {
    const radius = entry.variant.includes("area")
      ? state.window * Math.sqrt(bin.length / max)
      : state.window;
    const points = d3
      .range(6)
      .map((i) => [
        bin.x + Math.sin((i * Math.PI) / 3) * radius,
        bin.y + Math.cos((i * Math.PI) / 3) * radius,
      ]);
    p.polygon(
      points,
      d3.interpolateBlues(0.2 + (0.8 * bin.length) / max),
      p.paper,
    );
    p.hit(bin.x, bin.y, "Hexagonal bin", bin.length);
  }
  p.text(
    65,
    25,
    entry.variant.includes("area")
      ? "Area encodes bin count"
      : "Color encodes bin count",
    { muted: true },
  );
}
function parallel(p, rows, state, entry) {
  const dimensions = ["value", "comparison", "weight", "angle"];
  const sy = dimensions.map((dim) =>
    d3.scaleLinear(
      d3.extent(rows, (r) => r[dim]),
      [510, 40],
    ),
  );
  dimensions.forEach((dim, i) => {
    const x = 120 + i * 240;
    p.line(
      [
        [x, 40],
        [x, 510],
      ],
      p.rule,
    );
    p.text(x, 530, dim, { anchor: "middle" });
  });
  for (const r of rows.slice(0, 55))
    p.line(
      dimensions.map((dim, i) => [120 + i * 240, sy[i](r[dim])]),
      color(r.group),
    );
}
function slope(p, rows, state, entry) {
  const max = entry.variant.includes("cancer") ? 4 : 2;
  const sy = d3.scaleLinear([0, 110], [510, 40]);
  for (let g = 0; g < 10; g++) {
    const r = rows[g];
    const pts = d3
      .range(max)
      .map((i) => [
        100 + (i * 760) / (max - 1),
        sy(i % 2 ? r.comparison : r.value),
      ]);
    p.line(pts, color(g));
    pts.forEach(([x, y]) => p.circle(x, y, 4, color(g)));
    p.text(90, pts[0][1], `G${g + 1}`, { anchor: "end", size: 11 });
    p.text(870, pts.at(-1)[1], r.comparison.toFixed(1), { size: 11 });
  }
  p.text(100, 25, "Before");
  p.text(850, 25, "After");
}
function radialBars(p, rows, state, entry) {
  const groups = entry.adapter === "radialarea" ? 1 : 3;
  let data = rows.slice(0, 24);
  if (entry.variant.endsWith("-3"))
    data = data.slice().sort((a, b) => b.value - a.value);
  withOffset(p, 480, 280, () => {
    if (entry.adapter === "radialarea") {
      p.path(
        d3
          .areaRadial()
          .angle((r, i) => (i / data.length) * 2 * Math.PI)
          .innerRadius(65)
          .outerRadius((r) => 65 + r.value * 1.5)
          .curve(d3.curveCardinalClosed)(data),
        color(0),
        null,
      );
    } else {
      data.forEach((r, i) => {
        let radius = 75;
        for (let g = 0; g < groups; g++) {
          const h = [r.value, r.comparison, r.weight][g] * 0.7;
          const arc = d3
            .arc()
            .startAngle((i / data.length) * 6.283)
            .endAngle(((i + 0.9) / data.length) * 6.283)
            .innerRadius(radius)
            .outerRadius(radius + h);
          p.path(arc(), color(g), null);
          radius += h;
        }
      });
    }
    for (let r = 75; r <= 225; r += 50) p.circle(0, 0, r, null, p.rule);
  });
}
function beeswarm(p, rows, state, entry) {
  const x = d3.scaleLinear([0, 110], [75, 915]);
  const mirrored = entry.variant.includes("mirrored");
  const nodes = rows.slice(0, 140).map((r, i) => ({
    x: x(r.value),
    y: 280,
    group: r.group,
    value: r.value,
    r: 3 + (i % 3),
  }));
  d3.forceSimulation(nodes)
    .force("x", d3.forceX((n) => x(n.value)).strength(1))
    .force(
      "y",
      d3
        .forceY((n) => (mirrored ? (n.group % 2 ? 240 : 320) : 280))
        .strength(0.1),
    )
    .force(
      "collide",
      d3.forceCollide((n) => n.r + 1),
    )
    .stop()
    .tick(90);
  for (const [i, n] of nodes.entries()) {
    p.circle(n.x, n.y, n.r, color(n.group));
    p.hit(n.x, n.y, `Sample ${i + 1}`, n.value);
  }
  p.axis(64, 510, [0, 110], ["Demo value", "Collision-free placement"]);
}
function ridgeline(p, rows, state, entry, k) {
  const pulsar = entry.variant.includes("psr");
  const n = pulsar ? 35 : 9;
  for (let g = 0; g < n; g++) {
    const base = 70 + g * (pulsar ? 12 : 48);
    const values = rows
      .slice(0, 100)
      .map((r, i) => [
        70 + r.x * 830,
        base -
          (pulsar
            ? Math.exp(-(((r.x - 0.5) * 10) ** 2)) * r.weight * 2
            : Math.sin(r.x * 10 + g) * 10 + r.weight),
      ]);
    p.path(
      d3
        .area()
        .x((r) => r[0])
        .y0(base)
        .y1((r) => r[1])(values),
      p.paper,
      pulsar ? p.ink : color(g),
    );
  }
  p.text(
    70,
    25,
    pulsar
      ? "Synthetic stacked pulse profiles"
      : "Overlapping group distributions",
    { muted: true },
  );
}
function horizon(p, rows, state, entry) {
  for (let g = 0; g < 6; g++) {
    const baseline = 70 + g * 76;
    for (let band = 0; band < 3; band++) {
      const points = rows.map((r) => [
        70 + r.x * 840,
        baseline +
          55 -
          Math.max(
            0,
            Math.min(
              1,
              (r.value + 20 * Math.sin(g + state.frame * 0.04) - 20 * band) /
                20,
            ),
          ) *
            52,
      ]);
      p.path(
        d3
          .area()
          .x((r) => r[0])
          .y0(baseline + 55)
          .y1((r) => r[1])(points),
        d3.interpolateBlues(0.25 + 0.25 * band),
        null,
      );
    }
    p.text(10, baseline + 30, `G${g + 1}`, { size: 11 });
  }
}
function miscellaneous(p, rows, state, entry, k) {
  switch (entry.adapter) {
    case "arcdiagram": {
      const nodes = rows.slice(0, 24);
      nodes.forEach((r, i) => {
        const x = 60 + i * 36;
        p.circle(x, 490, 4, color(r.group));
        p.text(x, 515, i + 1, { anchor: "middle", size: 10 });
        const j = (i * 7 + 3) % 24;
        if (j > i) {
          const path = d3.path();
          path.moveTo(x, 490);
          path.quadraticCurveTo(
            (x + 60 + j * 36) / 2,
            490 - (j - i) * 20,
            60 + j * 36,
            490,
          );
          p.path(path.toString(), null, color(r.group));
        }
      });
      break;
    }
    case "pyramid": {
      const sx = d3.scaleLinear([0, 110], [0, 360]);
      for (let i = 0; i < 20; i++) {
        const r = rows[i],
          y = 50 + i * 23;
        p.rect(480 - sx(r.value), y, sx(r.value), 18, color(0));
        p.rect(482, y, sx(r.comparison), 18, color(1));
        p.text(470, y + 11, `${i * 5}`, {
          anchor: "end",
          fill: "#ffffff",
          size: 9,
        });
      }
      p.text(100, 25, "Population profile · synthetic groups", { muted: true });
      break;
    }
    case "mosaic": {
      const sums = d3.range(6).map((g) =>
          d3.sum(
            rows.filter((r) => r.group === g),
            (r) => r.value,
          ),
        ),
        total = d3.sum(sums);
      let left = 60;
      for (let g = 0; g < 6; g++) {
        const w = (sums[g] / total) * 850;
        let top = 45;
        const vals = rows.slice(g * 3, g * 3 + 3),
          sum = d3.sum(vals, (r) => r.value);
        for (let j = 0; j < 3; j++) {
          const h = (vals[j].value / sum) * 465;
          p.rect(left, top, w - 2, h - 2, color(j));
          top += h;
        }
        p.text(left, 530, `G${g + 1}`, { size: 11 });
        left += w;
      }
      break;
    }
    case "timeline": {
      for (let i = 0; i < 18; i++) {
        const r = rows[i],
          start = r.x * 640,
          w = 80 + r.weight * 6;
        p.rect(130 + start, 40 + i * 27, w, 16, color(r.group));
        p.text(120, 48 + i * 27, `Interval ${i + 1}`, {
          anchor: "end",
          size: 11,
        });
      }
      break;
    }
    case "trains": {
      for (let i = 0; i < 14; i++) {
        const pts = d3
          .range(7)
          .map((j) => [
            70 + j * 140,
            50 + ((rows[i].value * 4 + j * 33 + i * 13) % 430),
          ]);
        p.line(pts, color(i));
      }
      p.axis(64, 510, [0, 100], ["Time", "Station distance"]);
      break;
    }
    case "candle": {
      const sy = d3.scaleLinear([0, 110], [510, 40]);
      for (let i = 0; i < 35; i++) {
        const r = rows[i],
          x = 75 + i * 24,
          open = r.value,
          close = r.comparison;
        p.line(
          [
            [x, sy(Math.max(open, close) + 8)],
            [x, sy(Math.min(open, close) - 8)],
          ],
          p.ink,
        );
        p.rect(
          x - 7,
          sy(Math.max(open, close)),
          14,
          Math.max(1, Math.abs(sy(open) - sy(close))),
          close > open ? color(2) : color(1),
        );
        p.hit(x, sy(close), `Period ${i + 1}`, close);
      }
      p.axis(64, 510);
      break;
    }
    case "dots": {
      for (let i = 0; i < 15; i++) {
        const r = rows[i],
          y = 45 + i * 31;
        p.line(
          [
            [120, y],
            [900, y],
          ],
          p.rule,
        );
        p.circle(120 + r.value * 7, y, 6, color(0));
        p.circle(120 + r.comparison * 7, y, 4, color(1));
        p.text(110, y, `G${i + 1}`, { anchor: "end", size: 11 });
      }
      break;
    }
    case "bubbles": {
      const nodes = rows
        .slice(0, 55)
        .map((r) => ({ r: r.weight * 1.3, group: r.group, x: 480, y: 280 }));
      d3.forceSimulation(nodes)
        .force(
          "x",
          d3.forceX((n) => 120 + n.group * 135),
        )
        .force("y", d3.forceY(280))
        .force(
          "c",
          d3.forceCollide((n) => n.r + 2),
        )
        .stop()
        .tick(100);
      nodes.forEach((n, i) => {
        p.circle(n.x, n.y, n.r, color(n.group));
        p.hit(n.x, n.y, `Bubble ${i + 1}`, n.r);
      });
      break;
    }
    case "voronoi": {
      const points = rows
        .slice(0, 50)
        .map((r) => [65 + r.x * 830, 50 + r.comparison * 4.4]);
      const vor = d3.Delaunay.from(points).voronoi([60, 40, 930, 520]);
      for (let i = 0; i < points.length; i++) {
        p.path(vor.renderCell(i), null, p.rule);
        p.circle(...points[i], 3, color(0));
        p.text(points[i][0] + 4, points[i][1] - 5, `P${i + 1}`, { size: 10 });
      }
      break;
    }
    case "occlusion": {
      const placed = [];
      for (const r of rows.slice(0, 65)) {
        const x = 70 + r.x * 830,
          y = 50 + r.comparison * 4.2;
        p.circle(x, y, 3, color(r.group));
        const box = [x + 5, y - 12, 44, 13];
        if (
          !placed.some(
            (b) => Math.abs(b[0] - box[0]) < 44 && Math.abs(b[1] - box[1]) < 13,
          )
        ) {
          placed.push(box);
          p.text(box[0], box[1], r.name, { size: 10 });
        }
      }
      break;
    }
    case "tangled": {
      for (let level = 0; level < 5; level++)
        for (let i = 0; i < 6; i++) {
          const x = 110 + level * 175,
            y = 75 + i * 75;
          p.rect(x - 24, y - 12, 48, 24, color(i));
          p.text(x, y, `${level}.${i}`, {
            anchor: "middle",
            fill: "#ffffff",
            size: 11,
          });
          if (level < 4)
            for (let g = 0; g < 2; g++) {
              const yy = 75 + ((i * 2 + g) % 6) * 75;
              p.path(
                d3.linkHorizontal()({
                  source: [x + 24, y],
                  target: [x + 151, yy],
                }),
                null,
                p.rule,
              );
            }
        }
      break;
    }
    case "legend":
    case "schemes": {
      const interpolators = [
        d3.interpolateViridis,
        d3.interpolateTurbo,
        d3.interpolateBlues,
        d3.interpolateRdBu,
      ];
      for (let g = 0; g < 4; g++) {
        p.text(
          65,
          65 + g * 120,
          [
            "Sequential / Viridis",
            "Sequential / Turbo",
            "Sequential / Blues",
            "Diverging / RdBu",
          ][g],
        );
        for (let i = 0; i < 100; i++)
          p.rect(65 + i * 8.4, 85 + g * 120, 8.5, 36, interpolators[g](i / 99));
        p.text(65, 140 + g * 120, "Low", { size: 11 });
        p.text(905, 140 + g * 120, "High", { anchor: "end", size: 11 });
      }
      break;
    }
    case "arc": {
      const end = 0.2 + (state.frame / 100) * 5.6;
      withOffset(p, 480, 280, () =>
        p.path(
          d3
            .arc()
            .innerRadius(130)
            .outerRadius(220)
            .startAngle(0)
            .endAngle(end)(),
          color(0),
          null,
        ),
      );
      p.text(480, 280, `${((end / Math.PI) * 180).toFixed(0)}°`, {
        anchor: "middle",
      });
      break;
    }
    case "circles": {
      rows
        .slice(0, 32)
        .forEach((r, i) =>
          p.circle(
            100 + r.x * 750,
            80 + r.comparison * 4,
            10 + r.weight * (0.7 + 0.3 * Math.sin(state.frame * 0.03 + i)),
            color(r.group),
          ),
        );
      break;
    }
    default:
      throw new Error(`No miscellaneous adapter for ${entry.adapter}`);
  }
}

export function draw(p, rows, state, entry, k) {
  if (!adapterNames.has(entry.adapter))
    throw new Error(`Unknown adapter ${entry.adapter}`);
  switch (entry.adapter) {
    case "treemap":
      treemap(p, rows, state, entry);
      break;
    case "pack":
      packing(p, rows, state, entry);
      break;
    case "tree":
      treeLayout(p, rows, state, entry);
      break;
    case "sunburst":
    case "icicle":
      partition(p, rows, state, entry);
      break;
    case "bars":
      bars(p, rows, state, entry);
      break;
    case "line":
      lineChart(p, rows, state, entry, k);
      break;
    case "area":
      areaChart(p, rows, state, entry);
      break;
    case "scatter":
      scatter(p, rows, state, entry);
      break;
    case "matrix":
      matrix(p, rows, state, entry);
      break;
    case "network":
      network(p, rows, state, entry, k);
      break;
    case "sankey":
    case "parallelsets":
      sankeyChart(p, rows, state, entry);
      break;
    case "chord":
      chordChart(p, rows, state, entry);
      break;
    case "bundle":
      bundleChart(p, rows, state, entry);
      break;
    case "pie":
      pieChart(p, rows, state, entry);
      break;
    case "calendar":
    case "heatmap":
      heatmap(p, rows, state, entry);
      break;
    case "box":
    case "histogram":
    case "kde":
    case "qq":
      statistics(p, rows, state, entry, k);
      break;
    case "density":
    case "contours":
      contourChart(p, rows, state, entry, k);
      break;
    case "hexbin":
      if (entry.variant.includes("map")) drawMap(p, rows, state, entry, k);
      else hexChart(p, rows, state, entry);
      break;
    case "parallel":
      parallel(p, rows, state, entry);
      break;
    case "slope":
      slope(p, rows, state, entry);
      break;
    case "radialarea":
    case "radialbars":
      radialBars(p, rows, state, entry);
      break;
    case "beeswarm":
      beeswarm(p, rows, state, entry);
      break;
    case "ridgeline":
      ridgeline(p, rows, state, entry, k);
      break;
    case "horizon":
      horizon(p, rows, state, entry);
      break;
    case "map":
    case "tiles":
    case "vectorfield":
    case "stars":
    case "cartogram":
      drawMap(p, rows, state, entry, k);
      break;
    case "enclosure":
    case "centerline":
    case "comparison":
    case "predator":
    case "clock":
    case "fractions":
    case "stipple":
    case "watercolor":
    case "gears":
    case "owl":
    case "tadpoles":
    case "words":
    case "moon":
      drawSpecial(p, rows, state, entry, k);
      break;
    default:
      miscellaneous(p, rows, state, entry, k);
  }
}
