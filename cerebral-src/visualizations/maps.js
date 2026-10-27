import * as d3 from "d3";
import * as geo from "d3-geo-projection";
import { feature } from "topojson-client";
import { geoVoronoi } from "d3-geo-voronoi";
import world from "world-atlas/countries-110m.json";
import us from "us-atlas/states-10m.json";
import { palette } from "./painter.js";
const sphere = { type: "Sphere" },
  land = feature(world, world.objects.countries),
  states = feature(us, us.objects.states);
const tileCache = new Map();
const graticule = d3.geoGraticule10();
function projection(entry, state) {
  const v = entry.variant;
  let p;
  if (/spilhaus/.test(v))
    return d3
      .geoStereographic()
      .rotate([95, 45])
      .center([30, -5])
      .clipAngle(166)
      .translate([480, 280])
      .scale(47);
  if (/orthographic-to|projection-transitions/.test(v)) {
    const t = state.frame / 100;
    p = d3
      .geoProjection((lambda, phi) => {
        const a = d3.geoOrthographicRaw(lambda, phi),
          b = d3.geoEquirectangularRaw(lambda, phi);
        return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t];
      })
      .clipAngle(90 + t * 90)
      .rotate([state.rotation, 0]);
  } else if (/world-tour|versor|solar|graticule-labels/.test(v))
    p = d3
      .geoOrthographic()
      .rotate(state.rotation3D || [state.rotation + state.frame * 3.6, -15]);
  else if (/projection-comparison/.test(v))
    p = [
      d3.geoEqualEarth,
      geo.geoMollweide,
      d3.geoNaturalEarth1,
      d3.geoMercator,
    ][state.projection % 4]();
  else if (/mercator|tiles/.test(v)) p = d3.geoMercator();
  else p = d3.geoNaturalEarth1();
  return p.fitExtent(
    [
      [45, 40],
      [915, 510],
    ],
    sphere,
  );
}
function rasterTiles(p, state, entry) {
  const z = Math.min(3, Math.max(1, Math.round(state.zoom) + 1)),
    n = 2 ** z,
    size = 480 / n,
    left = 240,
    top = 40;
  const v = entry.variant;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const key = `${p.paper}:${z}:${x}:${y}:${v.includes("clip")}`;
      let canvas = tileCache.get(key);
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (v.includes("clipped")) {
          ctx.beginPath();
          ctx.arc(64, 64, 61, 0, Math.PI * 2);
          ctx.clip();
        }
        ctx.fillStyle = p.paper;
        ctx.fillRect(0, 0, 128, 128);
        const pr = d3
          .geoMercator()
          .scale((n * 128) / (2 * Math.PI))
          .translate([n * 64 - x * 128, n * 64 - y * 128]);
        const path = d3.geoPath(pr, ctx);
        ctx.beginPath();
        path(land);
        ctx.fillStyle = p.paper === "#0A0A0B" ? "#334E61" : "#B7C6CE";
        ctx.fill();
        ctx.beginPath();
        path(graticule);
        ctx.strokeStyle = p.rule;
        ctx.lineWidth = 0.4;
        ctx.stroke();
        tileCache.set(key, canvas);
        if (tileCache.size > 200)
          tileCache.delete(tileCache.keys().next().value);
      }
      if (!v.includes("vector-tiles"))
        p.image(left + x * size, top + y * size, size, size, canvas);
      if (/vector-tiles|raster-vector/.test(v)) {
        const pr = d3
          .geoMercator()
          .scale(480 / (2 * Math.PI))
          .translate([left + 240, top + 240])
          .clipExtent([
            [left + x * size, top + y * size],
            [left + (x + 1) * size, top + (y + 1) * size],
          ]);
        p.path(
          d3.geoPath(pr)(land),
          v.includes("vector-tiles") ? palette[0] : null,
          p.ink,
        );
      }
      if (!v.includes("seamless"))
        p.line(
          [
            [left + x * size, top + y * size],
            [left + (x + 1) * size, top + y * size],
            [left + (x + 1) * size, top + (y + 1) * size],
            [left + x * size, top + (y + 1) * size],
            [left + x * size, top + y * size],
          ],
          p.rule,
        );
      if (n <= 4)
        p.text(left + x * size + 5, top + y * size + 14, `${z}/${x}/${y}`, {
          size: 10,
        });
    }
  p.text(240, 545, "Local Natural Earth tiles · Web Mercator · z/x/y", {
    muted: true,
    size: 11,
  });
}
export function drawMap(p, rows, state, entry, k) {
  const v = entry.variant;
  if (entry.adapter === "tiles") {
    rasterTiles(p, state, entry);
    return;
  }
  if (entry.adapter === "vectorfield") {
    for (let y = 60; y < 510; y += 25)
      for (let x = 60; x < 920; x += 25) {
        const angle =
            Math.sin(x / 180 + state.frame * 0.02) + Math.cos(y / 120),
          dx = Math.cos(angle) * 15,
          dy = Math.sin(angle) * 15;
        p.line(
          [
            [x, y],
            [x + dx, y + dy],
          ],
          palette[0],
        );
        p.polygon(
          [
            [x + dx, y + dy],
            [x + dx - dx * 0.3 - dy * 0.22, y + dy - dy * 0.3 + dx * 0.22],
            [x + dx - dx * 0.3 + dy * 0.22, y + dy - dy * 0.3 - dx * 0.22],
          ],
          palette[0],
        );
      }
    p.text(60, 25, "Sampled vector direction and magnitude", { muted: true });
    return;
  }
  if (entry.adapter === "stars") {
    const pr = d3
      .geoStereographic()
      .rotate([state.rotation, 90])
      .clipAngle(90)
      .fitExtent(
        [
          [245, 35],
          [715, 525],
        ],
        sphere,
      );
    const path = d3.geoPath(pr);
    p.path(path(graticule), null, p.rule);
    for (const r of rows) {
      const pos = pr([r.x * 360 - 180, r.comparison * 1.5 - 75]);
      if (pos && pos[0] > 245 && pos[0] < 715 && pos[1] > 35 && pos[1] < 525)
        p.circle(...pos, r.weight / 8, p.ink);
    }
    p.text(245, 545, "Synthetic star field · stereographic sky view", {
      muted: true,
      size: 11,
    });
    return;
  }
  const usView =
    /us-state|us-airports|non-contiguous|choropleth-2$|hexbin-map|bubble-map|spike-map/.test(
      v,
    ) && !/world|bivariate/.test(v);
  const dataset = usView ? states : land;
  const pr = usView
    ? d3.geoAlbersUsa().fitExtent(
        [
          [60, 50],
          [900, 505],
        ],
        states,
      )
    : projection(entry, state);
  const path = d3.geoPath(pr);
  if (!usView) {
    p.path(path(sphere), p.paper, p.rule);
    p.path(path(graticule), null, p.rule);
  }
  const choropleth = /choropleth|cartogram/.test(v);
  for (const [i, f] of dataset.features.entries()) {
    const value = rows[i % rows.length].value / 110;
    let fill = choropleth
      ? v.includes("bivariate")
        ? d3.interpolateRgbBasis(["#e8e8e8", "#ace4e4", "#dfb0d6", "#5a478b"])(
            (value + (i % 4) / 4) / 2,
          )
        : d3.interpolateBlues(0.15 + 0.8 * value)
      : p.paper;
    {
      const center = path.centroid(f);
      if (center.every(Number.isFinite))
        p.hit(
          ...center,
          f.properties?.name || String(f.id),
          rows[i % rows.length].value,
          { bounds: path.bounds(f) },
        );
    }
    const beforeTri = p.tri.length,
      beforeSeg = p.segments.length;
    p.path(path(f), fill, p.muted);
    if (entry.adapter === "cartogram") {
      const c = path.centroid(f),
        scale = 0.35 + value * 0.6;
      for (const [array, start] of [
        [p.tri, beforeTri],
        [p.segments, beforeSeg],
      ])
        for (let j = start; j < array.length; j += 3) {
          array[j] = c[0] + (array[j] - c[0]) * scale;
          array[j + 1] = c[1] + (array[j + 1] - c[1]) * scale;
        }
    }
  }
  if (/tissot/.test(v)) {
    for (let lon = -150; lon < 180; lon += 30)
      for (let lat = -60; lat < 90; lat += 30)
        p.path(
          path(d3.geoCircle().center([lon, lat]).radius(5)()),
          null,
          palette[1],
        );
  }
  if (/antimeridian/.test(v)) {
    p.path(
      path({
        type: "LineString",
        coordinates: [
          [140, 35],
          [-145, 40],
          [-90, 10],
        ],
      }),
      null,
      palette[1],
    );
    p.text(70, 540, "A great-circle path crossing the antimeridian", {
      muted: true,
    });
  }
  if (/solar-terminator/.test(v)) {
    const center = [
      state.frame * 3.6 - 180,
      23.4 * Math.sin((state.frame / 100) * Math.PI * 2),
    ];
    p.path(path(d3.geoCircle().center(center).radius(90)()), "#445065", p.ink);
  }
  if (/solar-path/.test(v)) {
    const coords = d3
      .range(0, 361, 4)
      .map((t) => [
        t - 180,
        23.4 * Math.sin(((t + state.frame) * Math.PI) / 180),
      ]);
    p.path(path({ type: "LineString", coordinates: coords }), null, palette[1]);
    const sun = pr(
      coords[Math.floor((state.frame / 100) * (coords.length - 1))],
    );
    if (sun) p.circle(...sun, 7, palette[4]);
  }
  if (/graticule-labels/.test(v)) {
    for (let lon = -120; lon < 180; lon += 30) {
      const pos = pr([lon, 0]);
      if (pos && pos[0] > 40 && pos[0] < 920)
        p.text(...pos, `${lon}°`, { size: 10 });
    }
  }
  if (/bubble-map|spike-map|airports|walmarts|hexbin-map/.test(v)) {
    const points = [],
      coordinates = [];
    const n = v.includes("walmarts")
      ? Math.max(3, Math.floor(state.frame * 1.8))
      : 90;
    for (let i = 0; i < n; i++) {
      const r = rows[i % rows.length];
      const lon = usView ? -123 + r.x * 55 : r.x * 350 - 175,
        lat = usView ? 27 + (r.comparison % 24) : -60 + (r.comparison % 120);
      const pos = pr([lon, lat]);
      if (pos && pos.every(Number.isFinite)) {
        points.push(pos);
        coordinates.push([lon, lat]);
        if (v.includes("spike"))
          p.polygon(
            [
              [pos[0] - 3, pos[1]],
              [pos[0] + 3, pos[1]],
              [pos[0], pos[1] - r.weight * 1.6],
            ],
            palette[1],
          );
        else if (!v.includes("voronoi") && !v.includes("hexbin"))
          p.circle(
            ...pos,
            v.includes("bubble") ? r.weight * 0.6 : 2.5,
            palette[1],
          );
        p.hit(...pos, `Location ${i + 1}`, r.value);
      }
    }
    if (v.includes("voronoi")) {
      if (v.includes("world")) {
        p.path(path(geoVoronoi(coordinates).polygons()), null, palette[0]);
      } else {
        const vor = d3.Delaunay.from(points).voronoi([50, 40, 920, 515]);
        points.forEach((pos, i) => p.path(vor.renderCell(i), null, palette[0]));
      }
      points.forEach((pos) => p.circle(...pos, 2, palette[1]));
    }
    if (v.includes("hexbin")) {
      const bins = new Map();
      for (const [x, y] of points) {
        const q = Math.round(x / 16),
          r = Math.round(y / 14);
        const key = q + "," + r;
        bins.set(key, {
          x: q * 16 + (r % 2) * 8,
          y: r * 14,
          n: (bins.get(key)?.n || 0) + 1,
        });
      }
      for (const b of bins.values())
        p.polygon(
          d3
            .range(6)
            .map((i) => [
              b.x + Math.cos((i * Math.PI) / 3) * 9,
              b.y + Math.sin((i * Math.PI) / 3) * 9,
            ]),
          d3.interpolateBlues(Math.min(1, 0.25 + b.n * 0.15)),
          p.paper,
        );
    }
  }
  if (choropleth)
    for (let i = 0; i < 8; i++) {
      p.rect(65 + i * 25, 520, 25, 12, d3.interpolateBlues(0.15 + i * 0.1));
    }
  p.text(
    65,
    553,
    usView
      ? "US Atlas geometry / synthetic values"
      : "Natural Earth geometry / synthetic values",
    { muted: true, size: 10 },
  );
}
