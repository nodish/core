import type { Component } from "vue";
import type {
  Port,
  PortTypeDefinition,
  TypeWidgetSpec,
} from "../../store/model";
import NumberWidget from "./NumberWidget.vue";
import ReadonlyWidget from "./ReadonlyWidget.vue";
import TextWidget from "./TextWidget.vue";

const byTypeId = new Map<string, Map<string, Component>>();
const byComponentId = new Map<string, Component>();

const genericByKind: Record<
  Exclude<TypeWidgetSpec["kind"], "none">,
  Component
> = {
  number: NumberWidget,
  text: TextWidget,
  custom: TextWidget,
};

function widgetsForType(typeId: string): Map<string, Component> {
  let widgets = byTypeId.get(typeId);
  if (!widgets) {
    widgets = new Map();
    byTypeId.set(typeId, widgets);
  }
  return widgets;
}

function resolveWidgetId(
  typeDef: PortTypeDefinition | undefined,
  port?: Port,
): string {
  return port?.widgetId ?? typeDef?.defaultWidget ?? "default";
}

/**
 * Bind a Vue component to editable ports of a type id (default widget slot).
 */
export function registerTypeWidget(typeId: string, component: Component): void;
/**
 * Bind a Vue component to a named widget slot for a type id.
 */
export function registerTypeWidget(
  typeId: string,
  widgetId: string,
  component: Component,
): void;
export function registerTypeWidget(
  typeId: string,
  widgetIdOrComponent: string | Component,
  maybeComponent?: Component,
): void {
  if (typeof widgetIdOrComponent === "string") {
    widgetsForType(typeId).set(widgetIdOrComponent, maybeComponent!);
    return;
  }
  widgetsForType(typeId).set("default", widgetIdOrComponent);
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
  port?: Port,
): Component {
  if (mode === "readonly") return ReadonlyWidget;

  const typeId = port?.type ?? typeDef?.id;
  const alignedTypeDef = typeDef && typeDef.id === typeId ? typeDef : undefined;
  const widgetId = resolveWidgetId(alignedTypeDef, port);

  const registered = typeId ? byTypeId.get(typeId) : undefined;
  if (registered?.has(widgetId)) {
    return registered.get(widgetId)!;
  }
  if (registered?.has("default")) {
    return registered.get("default")!;
  }

  if (effectiveWidget?.kind === "none") {
    return TextWidget;
  }
  if (effectiveWidget?.kind === "custom") {
    return byComponentId.get(effectiveWidget.componentId) ?? TextWidget;
  }
  if (effectiveWidget?.kind === "number" || effectiveWidget?.kind === "text") {
    return genericByKind[effectiveWidget.kind] ?? TextWidget;
  }
  if (alignedTypeDef?.widget?.kind === "custom") {
    return byComponentId.get(alignedTypeDef.widget.componentId) ?? TextWidget;
  }
  if (alignedTypeDef?.widget?.kind && alignedTypeDef.widget.kind !== "none") {
    return genericByKind[alignedTypeDef.widget.kind] ?? TextWidget;
  }
  return TextWidget;
}
