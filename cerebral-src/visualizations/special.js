import * as d3 from "d3";
import { palette } from "./painter.js";
const c = (i) => palette[i % palette.length];
function gear(p, cx, cy, r, teeth, angle, fill) {
  const points = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = angle + (i / (teeth * 4)) * Math.PI * 2,
      rr = i % 4 < 2 ? r : r * 0.87;
    points.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  p.polygon(points, fill);
  p.circle(cx, cy, r * 0.2, p.paper, p.ink);
}
function fractionTree(depth, left, right, x, y, spread, p) {
  const [a, b] = left,
    [c, d] = right,
    mid = [a + c, b + d];
  p.text(x, y, `${mid[0]}/${mid[1]}`, { anchor: "middle", size: 11 });
  if (!depth) return;
  for (const [side, nextLeft, nextRight] of [
    [-1, left, mid],
    [1, mid, right],
  ]) {
    const xx = x + side * spread;
    p.line(
      [
        [x, y + 8],
        [xx, y + 74],
      ],
      p.rule,
    );
    fractionTree(depth - 1, nextLeft, nextRight, xx, y + 82, spread / 2, p);
  }
}
export function drawSpecial(p, rows, state, entry, k) {
  switch (entry.adapter) {
    case "enclosure": {
      const circles = rows.slice(0, 18).map((r) => ({
        x: 100 + r.x * 730,
        y: 90 + r.comparison * 3.5,
        r: 8 + r.weight,
      }));
      const enclose = d3.packEnclose(circles);
      p.circle(enclose.x, enclose.y, enclose.r, null, p.ink);
      circles.forEach((r, i) => p.circle(r.x, r.y, r.r, c(i)));
      p.text(65, 30, "Smallest enclosing circle of weighted disks", {
        muted: true,
      });
      break;
    }
    case "centerline": {
      const top = rows
        .slice(0, 70)
        .map((r) => [
          60 + r.x * 840,
          170 + Math.sin(r.x * 7) * 50 - r.weight * 2,
        ]);
      const bottom = rows
        .slice(0, 70)
        .map((r) => [
          60 + r.x * 840,
          350 + Math.sin(r.x * 7) * 50 + r.weight * 2,
        ]);
      p.polygon([...top, ...bottom.slice().reverse()], c(0));
      const center = top.map((r, i) => [r[0], (r[1] + bottom[i][1]) / 2]);
      p.line(center, p.paper);
      const text = "FOLLOW THE CENTERLINE";
      for (let i = 0; i < text.length; i++) {
        const q =
          center[
            Math.floor(((i + 1) / (text.length + 1)) * (center.length - 1))
          ];
        p.text(...q, text[i], { anchor: "middle", fill: "#ffffff", size: 14 });
      }
      break;
    }
    case "comparison": {
      const values = rows.slice(0, 6);
      for (let g = 0; g < 3; g++) {
        const left = 60 + g * 300;
        p.text(left, 45, ["Position", "Length", "Area"][g]);
        for (let i = 0; i < values.length; i++) {
          const y = 95 + i * 72,
            v = values[i].value;
          if (g === 0) {
            p.line(
              [
                [left, y],
                [left + 250, y],
              ],
              p.rule,
            );
            p.circle(left + v * 2, y, 5, c(i));
          } else if (g === 1) p.rect(left, y - 7, v * 2, 14, c(i));
          else p.circle(left + 125, y, Math.sqrt(v) * 2.8, c(i));
        }
      }
      break;
    }
    case "predator": {
      const data = k.predator(500, 0.03),
        max = d3.max(data, (r) => Math.max(r.prey, r.predator)),
        x = d3.scaleLinear([0, data.at(-1).x], [65, 930]),
        y = d3.scaleLinear([0, max], [510, 40]);
      for (const [g, key] of ["prey", "predator"].entries())
        p.path(
          d3
            .line()
            .x((r) => x(r.x))
            .y((r) => y(r[key]))(
            data.slice(
              0,
              Math.max(20, Math.round((data.length * state.frame) / 100)),
            ),
          ),
          null,
          c(g),
        );
      p.axis(
        64,
        510,
        [0, max],
        ["Simulation time", "Population (model units)"],
      );
      p.text(65, 25, "Lotka–Volterra numerical integration / WASM", {
        muted: true,
      });
      break;
    }
    case "clock": {
      const date = new Date(
        Date.UTC(2026, 0, 1, 0, 0, 0) + (state.frame / 100) * 86400000,
      );
      const fractions = [
        date.getUTCSeconds() / 60,
        date.getUTCMinutes() / 60,
        date.getUTCHours() / 24,
        (date.getUTCDay() + 1) / 7,
        date.getUTCDate() / 31,
        (date.getUTCMonth() + 1) / 12,
      ];
      fractions.forEach((v, i) => {
        const inner = 65 + i * 26,
          outer = inner + 20;
        const d = d3
          .arc()
          .innerRadius(inner)
          .outerRadius(outer)
          .startAngle(0)
          .endAngle(v * Math.PI * 2)();
        const before = p.tri.length;
        p.path(d, c(i), null);
        for (let j = before; j < p.tri.length; j += 3) {
          p.tri[j] += 480;
          p.tri[j + 1] += 280;
        }
      });
      p.text(480, 280, date.toISOString().slice(11, 19), { anchor: "middle" });
      p.text(480, 305, "UTC demonstration day", { anchor: "middle", size: 11 });
      break;
    }
    case "fractions":
      fractionTree(4, [0, 1], [1, 0], 480, 55, 225, p);
      break;
    case "stipple": {
      let points = rows
        .slice(0, 250)
        .map((r) => [80 + r.x * 800, 60 + r.comparison * 4.2]);
      for (let iter = 0; iter < Math.floor(state.frame / 5); iter++) {
        const vor = d3.Delaunay.from(points).voronoi([60, 40, 930, 515]);
        points = points.map((point, i) => {
          const polygon = vor.cellPolygon(i);
          if (!polygon) return point;
          const center = d3.polygonCentroid(polygon);
          return [
            point[0] + (center[0] - point[0]) * 0.6,
            point[1] + (center[1] - point[1]) * 0.6,
          ];
        });
      }
      points.forEach(([x, y], i) =>
        p.circle(
          x,
          y,
          1 + 3 * Math.exp(-((x - 480) ** 2 + (y - 280) ** 2) / 50000),
          p.ink,
        ),
      );
      p.text(65, 25, "Voronoi relaxation / weighted synthetic field", {
        muted: true,
      });
      break;
    }
    case "watercolor": {
      for (let layer = 0; layer < 18; layer++) {
        const points = d3.range(80).map((i) => {
          const a = (i / 80) * Math.PI * 2,
            r = 140 + layer * 4 + rows[(i + layer) % rows.length].weight;
          return [480 + Math.cos(a) * r, 280 + Math.sin(a) * r * 0.8];
        });
        p.polygon(
          points,
          d3.interpolateRgb(p.paper, c(layer % 3))(0.05 + (18 - layer) * 0.025),
        );
      }
      break;
    }
    case "gears": {
      const angle = (state.frame / 100) * Math.PI * 2;
      gear(p, 480, 280, 205, 48, -angle / 3, p.muted);
      p.circle(480, 280, 172, p.paper);
      gear(p, 480, 280, 70, 16, angle, c(0));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - angle / 3;
        gear(
          p,
          480 + Math.cos(a) * 120,
          280 + Math.sin(a) * 120,
          50,
          12,
          (-angle * 16) / 12,
          c(i + 1),
        );
      }
      p.text(480, 535, "Sun / planet / ring gear ratios", {
        anchor: "middle",
        muted: true,
      });
      break;
    }
    case "owl": {
      const depth = 2 + Math.min(5, state.refine),
        n = 2 ** depth,
        w = 430 / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const nx = ((x + 0.5) / n) * 2 - 1,
            ny = ((y + 0.5) / n) * 2 - 1;
          const face = nx * nx + ny * ny < 0.8,
            eyes =
              (nx - 0.35) ** 2 + (ny + 0.2) ** 2 < 0.07 ||
              (nx + 0.35) ** 2 + (ny + 0.2) ** 2 < 0.07;
          const pupil = (Math.abs(nx) - 0.35) ** 2 + (ny + 0.2) ** 2 < 0.012;
          p.circle(
            265 + (x + 0.5) * w,
            45 + (y + 0.5) * w,
            w * 0.48,
            pupil ? p.ink : eyes ? "#EEE6C9" : face ? "#9A774D" : p.paper,
          );
        }
      p.text(
        265,
        515,
        `Adaptive subdivision depth ${depth} / click to refine`,
        { muted: true, size: 11 },
      );
      break;
    }
    case "tadpoles": {
      for (let i = 0; i < 50; i++) {
        const r = rows[i],
          a = r.angle + state.frame * 0.02,
          x = 480 + Math.cos(a) * (100 + r.value * 2.2),
          y = 280 + Math.sin(a * 1.2) * (50 + r.weight * 7);
        const tail = d3
          .range(9)
          .map((j) => [
            x - j * 5 * Math.cos(a) + Math.sin(j + state.frame * 0.2) * j,
            y - j * 5 * Math.sin(a),
          ]);
        p.line(tail, p.muted);
        p.circle(x, y, 4, c(r.group));
      }
      break;
    }
    case "words": {
      const words = [
        "intent",
        "evidence",
        "memory",
        "routing",
        "latency",
        "affinity",
        "objects",
        "cohort",
        "cortex",
        "scorcher",
        "saga",
        "samples",
        "trace",
        "scheduler",
        "cache",
        "protocol",
        "plan",
        "clock",
        "simulation",
        "result",
        "transport",
        "queue",
        "data",
        "work",
      ];
      const placed = [];
      words.forEach((word, i) => {
        const size = 13 + rows[i].weight * 1.1,
          w = word.length * size * 0.6,
          h = size;
        let found;
        for (let j = 0; j < 1800; j++) {
          const a = j * 0.19,
            r = j * 0.15,
            x = 480 + Math.cos(a) * r - w / 2,
            y = 280 + Math.sin(a) * r * 0.6 - h / 2;
          if (x < 55 || x + w > 920 || y < 40 || y + h > 510) continue;
          if (
            !placed.some(
              (b) =>
                x < b.x + b.w + 4 &&
                x + w + 4 > b.x &&
                y < b.y + b.h + 4 &&
                y + h + 4 > b.y,
            )
          ) {
            found = { x, y, w, h };
            break;
          }
        }
        if (found) {
          placed.push(found);
          p.glyph(found.x, found.y + h, word, size, c(i));
          p.hit(found.x + w / 2, found.y + h / 2, word, size);
        }
      });
      break;
    }
    case "moon": {
      for (let moon = 0; moon < 8; moon++) {
        const cx = 110 + (moon % 4) * 240,
          cy = 145 + Math.floor(moon / 4) * 250,
          r = 72,
          phase = (moon / 8 + state.frame / 100) % 1,
          angle = phase * Math.PI * 2;
        p.circle(cx, cy, r, p.muted);
        for (let x = -r; x < r; x += 2) {
          const height = Math.sqrt(r * r - x * x);
          for (let y = -height; y < height; y += 3) {
            const z = Math.sqrt(Math.max(0, r * r - x * x - y * y)),
              light = x * Math.sin(angle) + z * Math.cos(angle);
            if (light > 0) p.rect(cx + x, cy + y, 2.1, 3.1, "#EBE3C9");
          }
        }
        p.text(cx, cy + 95, `${Math.round(phase * 360)}°`, {
          anchor: "middle",
          size: 11,
        });
      }
      break;
    }
    default:
      throw new Error(`Missing special ${entry.adapter}`);
  }
}
