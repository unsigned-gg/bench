import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

const loader = new SVGLoader();
export const palette = [
  "#165DAD",
  "#C74B23",
  "#2B7D56",
  "#8A4C9C",
  "#936800",
  "#427E89",
  "#AF405C",
  "#6B7150",
];
const colors = new Map();
function color(value) {
  if (!colors.has(value)) {
    const c = new THREE.Color(value);
    colors.set(value, [c.r, c.g, c.b]);
  }
  return colors.get(value);
}

export class Painter {
  constructor(width = 960, height = 560, dark = false) {
    this.width = width;
    this.height = height;
    this.ink = dark ? "#F0EEE9" : "#0A0A0B";
    this.muted = dark ? "#A8A6A0" : "#66645F";
    this.rule = dark ? "#444442" : "#CBC8C1";
    this.paper = dark ? "#0A0A0B" : "#F0EEE9";
    this.tri = [];
    this.triColors = [];
    this.segments = [];
    this.segmentColors = [];
    this.labels = [];
    this.hits = [];
    this.images = [];
    this.marks = 0;
  }
  triangle(a, b, c, fill) {
    this.tri.push(...a, 0, ...b, 0, ...c, 0);
    this.triColors.push(...color(fill), ...color(fill), ...color(fill));
  }
  polygon(points, fill, stroke) {
    if (points.length < 3) return;
    const contour = points.map((p) => new THREE.Vector2(...p));
    if (fill) {
      for (const f of THREE.ShapeUtils.triangulateShape(contour, []))
        this.triangle(points[f[0]], points[f[1]], points[f[2]], fill);
    }
    if (stroke) this.line([...points, points[0]], stroke);
    this.marks++;
  }
  rect(x, y, w, h, fill = this.ink) {
    if (![x, y, w, h].every(Number.isFinite) || w < 0 || h < 0) return;
    this.triangle([x, y], [x + w, y], [x + w, y + h], fill);
    this.triangle([x, y], [x + w, y + h], [x, y + h], fill);
    this.marks++;
  }
  line(points, stroke = this.ink) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if ([...a, ...b].every(Number.isFinite)) {
        this.segments.push(...a, 0, ...b, 0);
        this.segmentColors.push(...color(stroke), ...color(stroke));
      }
    }
    this.marks++;
  }
  circle(x, y, r, fill = this.ink, stroke) {
    const n = Math.max(12, Math.min(48, Math.ceil(r)));
    const p = Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i / n) * Math.PI * 2),
      y + r * Math.sin((i / n) * Math.PI * 2),
    ]);
    this.polygon(p, fill, stroke);
  }
  path(d, fill = null, stroke = this.ink) {
    if (!d) return;
    const parsed = loader.parse(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`,
    );
    for (const path of parsed.paths) {
      if (fill) {
        for (const shape of SVGLoader.createShapes(path)) {
          const points = shape.extractPoints(6);
          const contour = points.shape.map((p) => [p.x, p.y]);
          const holes = points.holes.map((h) => h.map((p) => [p.x, p.y]));
          const flat = [...contour, ...holes.flat()];
          for (const f of THREE.ShapeUtils.triangulateShape(
            points.shape,
            points.holes,
          ))
            this.triangle(flat[f[0]], flat[f[1]], flat[f[2]], fill);
        }
      }
      if (stroke)
        for (const part of path.subPaths)
          this.line(
            part.getPoints(80).map((p) => [p.x, p.y]),
            stroke,
          );
    }
    this.marks++;
  }
  text(x, y, text, options = {}) {
    if (!Number.isFinite(x + y)) return;
    this.labels.push({ x, y, text: String(text), ...options });
  }
  hit(x, y, label, value, meta = {}) {
    if (Number.isFinite(x + y))
      this.hits.push({ x, y, label: String(label), value, ...meta });
  }
  axis(x, y, domain = [0, 100], labels = ["Sample", "Value"]) {
    this.line(
      [
        [x, y],
        [this.width - 30, y],
      ],
      this.rule,
    );
    this.line(
      [
        [x, 35],
        [x, y],
      ],
      this.rule,
    );
    for (let i = 0; i <= 4; i++) {
      const yy = y - ((y - 35) * i) / 4;
      this.line(
        [
          [x, yy],
          [this.width - 30, yy],
        ],
        this.rule,
      );
      this.text(
        x - 10,
        yy,
        Number((domain[0] + ((domain[1] - domain[0]) * i) / 4).toPrecision(3)),
        { anchor: "end", muted: true },
      );
    }
    this.text(x, 18, labels[1], { muted: true });
    this.text(this.width - 30, y + 28, labels[0], {
      anchor: "end",
      muted: true,
    });
  }
  glyph(x, y, text, size, fill) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = `${size}px monospace`;
    const width = Math.ceil(context.measureText(text).width) + 4;
    canvas.width = width * 2;
    canvas.height = Math.ceil(size * 1.4) * 2;
    context.scale(2, 2);
    context.font = `${size}px monospace`;
    context.fillStyle = fill;
    context.fillText(text, 2, size);
    this.image(x, y - size, width, canvas.height / 2, canvas, 1);
  }
  image(x, y, w, h, canvas, layer = -1) {
    this.images.push({ x, y, w, h, canvas, layer });
    this.marks++;
  }
  group() {
    const group = new THREE.Group();
    for (const [positions, vertexColors, type] of [
      [this.tri, this.triColors, "tri"],
      [this.segments, this.segmentColors, "line"],
    ]) {
      if (!positions.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(vertexColors, 3),
      );
      const material =
        type === "tri"
          ? new THREE.MeshBasicMaterial({
              vertexColors: true,
              side: THREE.DoubleSide,
              depthTest: false,
            })
          : new THREE.LineBasicMaterial({
              vertexColors: true,
              depthTest: false,
            });
      group.add(
        type === "tri"
          ? new THREE.Mesh(geometry, material)
          : new THREE.LineSegments(geometry, material),
      );
    }
    for (const image of this.images) {
      const texture = new THREE.CanvasTexture(image.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(image.w, image.h);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: image.layer > 0,
        alphaTest: image.layer > 0 ? 0 : 0.01,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(image.x + image.w / 2, image.y + image.h / 2, 0);
      mesh.scale.y = -1;
      mesh.renderOrder = image.layer;
      group.add(mesh);
    }
    return group;
  }
}

export class Viewport {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 960, 0, 560, -10, 10);
    this.group = null;
    this.zoom = 1;
    this.pan = [0, 0];
  }
  render(painter, zoom = 1, pan = [0, 0]) {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        o.geometry?.dispose();
        o.material?.map?.dispose();
        o.material?.dispose();
      });
    }
    this.group = painter.group();
    this.scene.add(this.group);
    this.scene.background = new THREE.Color(painter.paper);
    const canvas = this.renderer.domElement;
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.camera.left = 0;
    this.camera.right = painter.width;
    this.camera.top = 0;
    this.camera.bottom = painter.height;
    this.camera.zoom = zoom;
    this.camera.position.set(pan[0], pan[1], 1);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.group?.traverse((o) => {
      o.geometry?.dispose();
      o.material?.map?.dispose();
      o.material?.dispose();
    });
    this.renderer.dispose();
  }
}
