import NumberWidget from "./NumberWidget.vue";
import TextWidget from "./TextWidget.vue";
import { registerTypeWidget } from "./registry";

/**
 * Register built-in Vue widgets for conventional `number` and `string` type ids.
 * Call once at app startup before loading packs that rely on those widgets.
 */
export function registerDefaultTypeWidgets(): void {
  registerTypeWidget("number", NumberWidget);
  registerTypeWidget("string", TextWidget);
}

export { registerComponentWidget, registerTypeWidget } from "./registry";
