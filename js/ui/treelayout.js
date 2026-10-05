// Layout for the big-button trees (research branches and skill branches). Pure functions, so tests can check them.
// nodes: [{ id, parents: [ids] }] in the order they should appear (callers sort by tier / name). Only parents that are in the list count.
// Every node gets a column (one to the right of its deepest parent) and a row; a node sits level with the middle of its children.
// A node with several parents hangs under the deepest one ("primary parent"); the other connections are drawn as extra lines.

export function layoutTree(nodes) {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const parentsOf = new Map(nodes.map((n) => [n.id, [...new Set(n.parents)].filter((p) => index.has(p) && p !== n.id)]));
  const depth = new Map();
  const dep = (id, stack) => {
    if (depth.has(id)) return depth.get(id);
    if (stack.has(id)) return 0; // a cycle in the data must not hang the game
    stack.add(id);
    const ps = parentsOf.get(id), d = ps.length ? 1 + Math.max(...ps.map((p) => dep(p, stack))) : 0;
    stack.delete(id); depth.set(id, d);
    return d;
  };
  for (const n of nodes) dep(n.id, new Set());
  const primary = new Map(), kids = new Map(nodes.map((n) => [n.id, []]));
  const roots = [];
  for (const n of nodes) {
    const ps = parentsOf.get(n.id).filter((p) => depth.get(p) === depth.get(n.id) - 1);
    if (!ps.length) { roots.push(n.id); continue; }
    ps.sort((a, b) => index.get(a) - index.get(b));
    primary.set(n.id, ps[0]); kids.get(ps[0]).push(n.id);
  }
  const row = new Map();
  let cursor = 0;
  const place = (id) => {
    const ks = kids.get(id);
    if (!ks.length) { row.set(id, cursor); cursor += 1; return; }
    for (const k of ks) place(k);
    row.set(id, (row.get(ks[0]) + row.get(ks[ks.length - 1])) / 2);
  };
  for (const r of roots) place(r);
  const pos = new Map();
  let cols = 0;
  for (const n of nodes) { const c = depth.get(n.id); pos.set(n.id, { col: c, row: row.get(n.id) }); cols = Math.max(cols, c + 1); }
  return { pos, cols, rows: cursor, primary, parentsOf };
}

/**
 * Layered layout (the research branches): every node already knows its column (`col`, e.g. its tier); empty columns are squeezed out.
 * Inside a column a node sits level with the average row of its parents (so lines run mostly straight), nodes with no parent in this
 * branch fill the free rows from the top. Returns the same shape as layoutTree plus `colValues` (the original column of each new column).
 */
export function layoutLayers(nodes) {
  const colValues = [...new Set(nodes.map((n) => n.col))].sort((a, b) => a - b);
  const colIdx = new Map(colValues.map((c, i) => [c, i]));
  const ids = new Set(nodes.map((n) => n.id));
  const parentsOf = new Map(nodes.map((n) => [n.id, [...new Set(n.parents)].filter((p) => ids.has(p) && p !== n.id)]));
  const row = new Map();
  let rows = 0;
  for (const c of colValues) {
    const group = nodes.filter((n) => n.col === c);
    const placed = [], loose = [];
    for (const n of group) {
      const ps = parentsOf.get(n.id).filter((p) => row.has(p));
      if (ps.length) placed.push({ n, d: ps.reduce((sum, p) => sum + row.get(p), 0) / ps.length }); else loose.push(n);
    }
    placed.sort((a, b) => a.d - b.d);
    const used = new Set();
    let last = -1;
    for (const { n, d } of placed) { let r = Math.max(Math.round(d), last + 1); while (used.has(r)) r++; row.set(n.id, r); used.add(r); last = r; }
    let r = 0;
    for (const n of loose) { while (used.has(r)) r++; row.set(n.id, r); used.add(r); }
    for (const n of group) rows = Math.max(rows, row.get(n.id) + 1);
  }
  const pos = new Map();
  for (const n of nodes) pos.set(n.id, { col: colIdx.get(n.col), row: row.get(n.id) });
  return { pos, cols: colValues.length, rows, parentsOf, colValues };
}
