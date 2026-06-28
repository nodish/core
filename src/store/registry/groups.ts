import type { IndefiniteNode, NodeRegistry } from "../model";

// A node category, arranged as a tree to drive the "add node" menu. Each group
// holds the nodes that live directly in it plus any nested subgroups.
export interface NodeGroup {
  name: string; // this segment's label ("" for the synthetic root)
  path: string[]; // full path from the root, e.g. ["Math", "Basic Operations"]
  subgroups: NodeGroup[];
  nodes: IndefiniteNode[];
}

function makeGroup(name: string, path: string[]): NodeGroup {
  return { name, path, subgroups: [], nodes: [] };
}

// Build the category tree from a registry. A node's `group` path determines
// where it lands; an empty path puts it at the root. Subgroups and nodes keep
// registry/insertion order. `filter` can drop nodes that shouldn't appear in
// the menu (e.g. the singleton IO boundary nodes).
export function buildNodeGroupTree(
  registry: NodeRegistry,
  filter?: (node: IndefiniteNode) => boolean,
): NodeGroup {
  const root = makeGroup("", []);

  for (const node of Object.values(registry)) {
    if (filter && !filter(node)) continue;

    let group = root;
    const acc: string[] = [];
    for (const segment of node.group ?? []) {
      acc.push(segment);
      let next = group.subgroups.find((g) => g.name === segment);
      if (!next) {
        next = makeGroup(segment, [...acc]);
        group.subgroups.push(next);
      }
      group = next;
    }
    group.nodes.push(node);
  }

  return root;
}

// Sort a group tree in place: subgroups and nodes alphabetically. Useful when a
// menu wants stable, name-ordered entries rather than registration order.
export function sortNodeGroupTree(group: NodeGroup): NodeGroup {
  group.subgroups.sort((a, b) => a.name.localeCompare(b.name));
  group.nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));
  for (const sub of group.subgroups) sortNodeGroupTree(sub);
  return group;
}
