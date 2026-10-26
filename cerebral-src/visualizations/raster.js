import { fromArrayBuffer } from "geotiff";
let terrain = null,
  pending = null;
export function getTerrain() {
  return terrain;
}
export function loadTerrain() {
  return (pending ??= (async () => {
    const response = await fetch("/visualizations/terrain.tiff");
    if (!response.ok) throw Error("Local GeoTIFF is unavailable");
    const tiff = await fromArrayBuffer(await response.arrayBuffer());
    const image = await tiff.getImage();
    const values = await image.readRasters({ interleave: true });
    terrain = {
      width: image.getWidth(),
      height: image.getHeight(),
      bbox: image.getBoundingBox(),
      values: Array.from(values),
    };
    return terrain;
  })());
}
