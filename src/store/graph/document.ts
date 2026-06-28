import type { GraphDocument, NodeMap } from "../model";
import { validateGraphInterface } from "../interface/graphInterface";
import {
  applyGraphInterface,
  ensureBoundaryNodes,
  validateBoundary,
} from "../nodes/io";
import { clonePlain } from "../utils/clonePlain";
import { validateGraphTypes } from "./validateGraphTypes";

/**
 * Serialize the current workspace to a {@link GraphDocument}.
 * Alias of {@link exportGraph}.
 */
export function serializeDocument(map: NodeMap): GraphDocument {
  return {
    graph: clonePlain(map.graph),
    interface: clonePlain(map.graphInterface),
    extensions: map.extensions.length ? [...map.extensions] : undefined,
  };
}

/** Serialize the current workspace to a {@link GraphDocument}. */
export function exportGraph(map: NodeMap): GraphDocument {
  return serializeDocument(map);
}

/**
 * Parse a JSON string into a {@link GraphDocument}.
 * @throws When JSON is invalid or required fields are missing.
 */
export function parseGraphDocument(json: string): GraphDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("invalid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("document must be an object");
  }
  const doc = parsed as Partial<GraphDocument>;
  if (!doc.graph || typeof doc.graph !== "object") {
    throw new Error("document missing graph");
  }
  if (!Array.isArray(doc.graph.nodes)) {
    throw new Error("graph.nodes must be an array");
  }
  if (!Array.isArray(doc.graph.connections)) {
    throw new Error("graph.connections must be an array");
  }
  if (!doc.interface || typeof doc.interface !== "object") {
    throw new Error("document missing interface");
  }
  if (
    doc.extensions !== undefined &&
    (!Array.isArray(doc.extensions) ||
      doc.extensions.some((e) => typeof e !== "string"))
  ) {
    throw new Error("extensions must be an array of strings");
  }
  return doc as GraphDocument;
}

function validateRequiredExtensions(
  map: NodeMap,
  ids: string[] | undefined,
): string[] {
  if (!ids?.length) return [];
  return ids
    .filter((id) => !map.extensions.includes(id))
    .map((id) => `missing pack "${id}" (call map.loadPack() before import)`);
}

/**
 * Validate a document against the current map without applying it.
 * @returns Human-readable error messages (empty when valid).
 */
export function validateDocument(map: NodeMap, doc: GraphDocument): string[] {
  const errors: string[] = [];
  errors.push(...validateRequiredExtensions(map, doc.extensions));
  errors.push(...validateBoundary({ ...map, graph: doc.graph }));
  errors.push(...validateGraphInterface(map, doc.interface));
  errors.push(...validateGraphTypes(map, doc.graph));
  return errors;
}

/**
 * Replace the map's graph and interface from a document.
 * @returns Errors from extension checks before apply, then validation errors after apply.
 */
export function applyDocument(map: NodeMap, doc: GraphDocument): string[] {
  const errors = validateRequiredExtensions(map, doc.extensions);
  if (errors.length) return errors;

  map.graph = clonePlain(doc.graph);
  map.graphInterface = clonePlain(doc.interface);

  applyGraphInterface(map, map.graphInterface);
  ensureBoundaryNodes(map);

  errors.push(...validateDocument(map, doc));
  return errors;
}

/** Replace the map's graph from a document. Alias of {@link applyDocument}. */
export function importGraph(map: NodeMap, doc: GraphDocument): string[] {
  return applyDocument(map, doc);
}
