import type {
  DefiniteNode,
  Port,
  PortTypeDefinition,
} from "../store/model";
import { effectiveWidget, widgetRowHeight } from "../store/types/effectiveWidget";

// Layout constants - shared by the node DOM and the wire math so sockets and
// wire endpoints always line up.
export const NODE_WIDTH = 100;
export const NODE_MIN_WIDTH = 60;
export const NODE_MAX_WIDTH = 320;
export const HEADER_H = 20;
export const ROW_H = 20;
export const ROW_MIN_H = 20;
export const ROW_MAX_H = 240;
export const NODE_FONT_SIZE = 11;
export const NODE_PADDING_X = 6;

export type PortTypeLookup = (
  port: Port,
) => PortTypeDefinition | undefined;

function clampRowHeight(h: number): number {
  return Math.max(ROW_MIN_H, Math.min(ROW_MAX_H, h));
}

/** Per-port row height in px (customProps.rowHeight wins over widget defaults). */
export function portRowHeight(
  port: Port,
  typeDef?: PortTypeDefinition,
): number {
  const override = port.customProps?.rowHeight;
  if (typeof override === "number" && override > 0) {
    return clampRowHeight(override);
  }
  const widget = effectiveWidget(typeDef, port);
  return clampRowHeight(widgetRowHeight(widget, ROW_H));
}

function columnBodyHeight(
  ports: Port[],
  lookup?: PortTypeLookup,
): number {
  let sum = 0;
  for (const port of ports) {
    sum += portRowHeight(port, lookup?.(port));
  }
  return sum;
}

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

export function nodeHeight(
  node: DefiniteNode,
  lookup?: PortTypeLookup,
): number {
  const inH = columnBodyHeight(Object.values(node.inputs), lookup);
  const outH = columnBodyHeight(Object.values(node.outputs), lookup);
  return HEADER_H + Math.max(inH, outH);
}

// Vertical center of the i-th port row at uniform ROW_H (legacy helper).
export function rowY(index: number): number {
  return HEADER_H + (index + 0.5) * ROW_H;
}

function portCenterY(
  ports: Port[],
  portId: string,
  lookup?: PortTypeLookup,
): number | null {
  let y = HEADER_H;
  for (const port of ports) {
    const h = portRowHeight(port, lookup?.(port));
    if (port.id === portId) return y + h / 2;
    y += h;
  }
  return null;
}

export type Point = { x: number; y: number };

// Absolute position (in viewer space) of a port on a node, for wire endpoints.
// Inputs sit on the left edge, outputs on the right edge.
export function portPosition(
  node: DefiniteNode,
  portId: string,
  lookup?: PortTypeLookup,
): Point | null {
  const inputs = Object.values(node.inputs);
  const inY = portCenterY(inputs, portId, lookup);
  if (inY !== null) {
    return { x: node.location.x, y: node.location.y + inY };
  }
  const outputs = Object.values(node.outputs);
  const outY = portCenterY(outputs, portId, lookup);
  if (outY !== null) {
    return {
      x: node.location.x + nodeWidth(node),
      y: node.location.y + outY,
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
