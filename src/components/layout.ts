import type { DefiniteNode } from "../store/model";

// Layout constants - shared by the node DOM and the wire math so sockets and
// wire endpoints always line up.
export const NODE_WIDTH = 100;
export const NODE_MIN_WIDTH = 60;
export const NODE_MAX_WIDTH = 320;
export const HEADER_H = 20;
export const ROW_H = 20;
export const NODE_FONT_SIZE = 11;
export const NODE_PADDING_X = 6;

// Effective width of a node, honoring its per-instance override.
export function nodeWidth(node: DefiniteNode): number {
  return node.width ?? NODE_WIDTH;
}

export function rowCount(node: DefiniteNode): number {
  return Math.max(
    Object.keys(node.inputs).length,
    Object.keys(node.outputs).length,
  );
}

export function nodeHeight(node: DefiniteNode): number {
  return HEADER_H + rowCount(node) * ROW_H;
}

// Vertical center of the i-th port row, relative to the node top.
export function rowY(index: number): number {
  return HEADER_H + (index + 0.5) * ROW_H;
}

export type Point = { x: number; y: number };

// Absolute position (in viewer space) of a port on a node, for wire endpoints.
// Inputs sit on the left edge, outputs on the right edge.
export function portPosition(node: DefiniteNode, portId: string): Point | null {
  const inIdx = Object.values(node.inputs).findIndex((p) => p.id === portId);
  if (inIdx >= 0) {
    return { x: node.location.x, y: node.location.y + rowY(inIdx) };
  }
  const outIdx = Object.values(node.outputs).findIndex((p) => p.id === portId);
  if (outIdx >= 0) {
    return {
      x: node.location.x + nodeWidth(node),
      y: node.location.y + rowY(outIdx),
    };
  }
  return null;
}

// Bezier control points for a wire from `a` (output side) to `b` (input side).
// The horizontal offset makes the wire bow out so it reads as a cable.
export function wireControls(a: Point, b: Point): [Point, Point] {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return [
    { x: a.x + dx, y: a.y },
    { x: b.x - dx, y: b.y },
  ];
}

export function wirePath(a: Point, b: Point): string {
  const [c1, c2] = wireControls(a, b);
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

// Sample the wire bezier into a polyline, used for slice hit-testing.
export function sampleWire(a: Point, b: Point, segments = 16): Point[] {
  const [c1, c2] = wireControls(a, b);
  const pts: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x =
      mt * mt * mt * a.x +
      3 * mt * mt * t * c1.x +
      3 * mt * t * t * c2.x +
      t * t * t * b.x;
    const y =
      mt * mt * mt * a.y +
      3 * mt * mt * t * c1.y +
      3 * mt * t * t * c2.y +
      t * t * t * b.y;
    pts.push({ x, y });
  }
  return pts;
}

// Parametric segment intersection with inclusive endpoints, so a crossing that
// lands exactly on a polyline vertex (e.g. a perfectly axis-aligned slice
// through a wire's sample point) is still detected. Parallel/collinear segments
// return false; adjacent non-parallel segments cover those cases in practice.
export function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): boolean {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = p4.x - p3.x;
  const sy = p4.y - p3.y;
  const denom = rx * sy - ry * sx;
  if (denom === 0) return false;
  const qpx = p3.x - p1.x;
  const qpy = p3.y - p1.y;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
