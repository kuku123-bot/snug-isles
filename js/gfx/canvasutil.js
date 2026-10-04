// Browser-only helpers to turn pixmaps into canvases.
export function pixmapToCanvas(pm, scale = 1) {
  const c = document.createElement('canvas');
  c.width = pm.w; c.height = pm.h;
  c.getContext('2d').putImageData(new ImageData(pm.bytes(), pm.w, pm.h), 0, 0);
  if (scale === 1) return c;
  const o = document.createElement('canvas');
  o.width = pm.w * scale; o.height = pm.h * scale;
  const x = o.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(c, 0, 0, o.width, o.height);
  return o;
}
