import type { Component } from "vue";
import type { PortTypeDefinition, TypeWidgetSpec } from "../../store/model";
import NumberWidget from "./NumberWidget.vue";
import ReadonlyWidget from "./ReadonlyWidget.vue";
import TextWidget from "./TextWidget.vue";

const byTypeId = new Map<string, Component>();
const byComponentId = new Map<string, Component>();

const genericByKind: Record<TypeWidgetSpec["kind"], Component> = {
  number: NumberWidget,
  text: TextWidget,
  custom: TextWidget,
};

/**
 * Bind a Vue component to all editable ports of a type id.
 * Overrides the generic widget for that type.
 */
export function registerTypeWidget(typeId: string, component: Component): void {
  byTypeId.set(typeId, component);
}

/**
 * Bind a Vue component to a custom widget id
 * ({@link TypeWidgetSpec} `kind: "custom"`).
 */
export function registerComponentWidget(
  componentId: string,
  component: Component,
): void {
  byComponentId.set(componentId, component);
}

export function resolveTypeWidget(
  typeDef: PortTypeDefinition | undefined,
  effectiveWidget: TypeWidgetSpec | undefined,
  mode: "editable" | "readonly",
): Component {
  if (mode === "readonly") return ReadonlyWidget;
  if (typeDef && byTypeId.has(typeDef.id)) {
    return byTypeId.get(typeDef.id)!;
  }
  if (effectiveWidget?.kind === "custom") {
    return byComponentId.get(effectiveWidget.componentId) ?? TextWidget;
  }
  if (effectiveWidget?.kind) {
    return genericByKind[effectiveWidget.kind] ?? TextWidget;
  }
  return TextWidget;
}
