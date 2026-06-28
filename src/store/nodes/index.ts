import type { NodeSpecRegistry } from "../registry/defineNode";
import { addNode, divideNode, multiplyNode } from "./math";

export const defaultNodes: NodeSpecRegistry = {
  [addNode.typeId]: addNode,
  [multiplyNode.typeId]: multiplyNode,
  [divideNode.typeId]: divideNode,
};
