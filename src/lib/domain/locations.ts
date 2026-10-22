/** Pure helpers for the location hierarchy (Home → Kitchen → Pantry → Shelf 2 → Container A). */
export interface LocationNodeInput {
  id: string;
  parentId: string | null;
  name: string;
  kind: string;
  sortOrder?: number;
  lotCount?: number;
  productCount?: number;
}

export interface LocationNode extends LocationNodeInput {
  depth: number;
  children: LocationNode[];
  /** Products stored here or in any descendant. */
  totalProductCount: number;
  totalLotCount: number;
}

function byOrder(a: LocationNodeInput, b: LocationNodeInput): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
}

export function buildLocationTree(items: LocationNodeInput[]): LocationNode[] {
  const nodes = new Map<string, LocationNode>();
  for (const item of items) {
    nodes.set(item.id, { ...item, depth: 0, children: [], totalProductCount: 0, totalLotCount: 0 });
  }
  const roots: LocationNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const visit = (node: LocationNode, depth: number, seen: Set<string>): void => {
    if (seen.has(node.id)) return; // defensive: never loop on bad data
    seen.add(node.id);
    node.depth = depth;
    node.children.sort(byOrder);
    node.totalProductCount = node.productCount ?? 0;
    node.totalLotCount = node.lotCount ?? 0;
    for (const child of node.children) {
      visit(child, depth + 1, seen);
      node.totalProductCount += child.totalProductCount;
      node.totalLotCount += child.totalLotCount;
    }
  };
  roots.sort(byOrder);
  const seen = new Set<string>();
  for (const root of roots) visit(root, 0, seen);
  return roots;
}

export function flattenTree(roots: LocationNode[]): LocationNode[] {
  const out: LocationNode[] = [];
  const walk = (n: LocationNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

/** Ancestors from the root down to (and including) the location. */
export function getAncestors<T extends { id: string; parentId: string | null }>(items: T[], id: string): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const chain: T[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

export function locationPath<T extends { id: string; parentId: string | null; name: string }>(
  items: T[],
  id: string,
  separator = " / ",
): string {
  return getAncestors(items, id)
    .map((l) => l.name)
    .join(separator);
}

/** The location itself plus all nested locations. */
export function getDescendantIds<T extends { id: string; parentId: string | null }>(items: T[], id: string): string[] {
  const children = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    const list = children.get(item.parentId) ?? [];
    list.push(item.id);
    children.set(item.parentId, list);
  }
  const result: string[] = [];
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const next = stack.pop() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    result.push(next);
    stack.push(...(children.get(next) ?? []));
  }
  return result;
}

/** True when making `newParentId` the parent of `id` would create a cycle. */
export function wouldCreateCycle<T extends { id: string; parentId: string | null }>(
  items: T[],
  id: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === id) return true;
  return getDescendantIds(items, id).includes(newParentId);
}

/** Options for a "parent location" picker: excludes the node itself and its descendants. */
export function validParentOptions<T extends { id: string; parentId: string | null; name: string }>(
  items: T[],
  editingId?: string,
): Array<{ id: string; label: string }> {
  const excluded = new Set(editingId ? getDescendantIds(items, editingId) : []);
  return items
    .filter((i) => !excluded.has(i.id))
    .map((i) => ({ id: i.id, label: locationPath(items, i.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
