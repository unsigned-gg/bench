export async function loadKernels(url = "/visualizations/kernels.wasm") {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`WASM download returned ${response.status}`);
  const { instance } = await WebAssembly.instantiate(
    await response.arrayBuffer(),
  );
  const e = instance.exports;
  if (!e.generate || !e.memory || e.capacity() !== 32768)
    throw new Error("Unexpected WASM kernel interface");
  const input = () =>
    new Float64Array(e.memory.buffer, e.input_ptr(), e.capacity());
  const output = (n) =>
    Array.from(new Float64Array(e.memory.buffer, e.output_ptr(), n));
  return {
    exports: e,
    generate(seed, count, phase) {
      const n = e.generate(seed, count, phase);
      const raw = output(n * 6);
      return Array.from({ length: n }, (_, i) => ({
        x: raw[6 * i],
        value: raw[6 * i + 1],
        comparison: raw[6 * i + 2],
        group: raw[6 * i + 3],
        angle: raw[6 * i + 4],
        weight: raw[6 * i + 5],
        name: `Sample ${i + 1}`,
      }));
    },
    average(values, window) {
      input().set(values);
      return output(e.moving_average(values.length, window));
    },
    bands(values, window) {
      input().set(values);
      const n = e.rolling_bands(values.length, window);
      const raw = output(n * 2);
      return Array.from({ length: n }, (_, i) => ({
        mean: raw[i * 2],
        std: raw[i * 2 + 1],
      }));
    },
    histogram(values, bins, min, max) {
      input().set(values);
      return output(e.histogram(values.length, bins, min, max));
    },
    quantiles(values) {
      input().set(values);
      return output(e.quantiles(values.length));
    },
    kde(values, bandwidth, min, max) {
      input().set(values);
      const n = e.kde(values.length, bandwidth, min, max);
      const raw = output(n * 2);
      return Array.from({ length: n }, (_, i) => [raw[i * 2], raw[i * 2 + 1]]);
    },
    force(nodes, links, iterations = 35) {
      let positions = nodes.flatMap((n) => [n.x, n.y]);
      const edges = links.flatMap((e) => [e.source, e.target]);
      for (let i = 0; i < iterations; i++) {
        input().set([...positions, ...edges]);
        e.force_step(nodes.length, links.length, 0.06);
        positions = output(nodes.length * 2);
      }
      return nodes.map((n, i) => ({
        ...n,
        x: positions[i * 2],
        y: positions[i * 2 + 1],
      }));
    },
    nearest(points, x, y) {
      input().set(points.flatMap((p) => [p[0], p[1]]));
      return e.nearest(points.length, x, y);
    },
    predator(count, dt) {
      const n = e.predator_prey(count, dt);
      const raw = output(n * 3);
      return Array.from({ length: n }, (_, i) => ({
        x: raw[3 * i],
        prey: raw[3 * i + 1],
        predator: raw[3 * i + 2],
      }));
    },
  };
}
