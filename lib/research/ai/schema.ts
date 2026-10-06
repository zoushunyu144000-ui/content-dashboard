export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: readonly unknown[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  description?: string;
}

const WIRE_DROP = new Set([
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'pattern',
  'format',
  'min',
  'max',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'default',
  'examples',
]);

/** OpenAI strict mode rejects array/string bounds. Local validation still uses the original schema. */
export function stripForStrict(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (WIRE_DROP.has(key)) continue;
    if (key === 'properties' && value && typeof value === 'object') {
      const properties: Record<string, JsonSchema> = {};
      for (const [name, child] of Object.entries(value as Record<string, JsonSchema>)) {
        properties[name] = stripForStrict(child);
      }
      out.properties = properties;
    } else if (key === 'items' && value && typeof value === 'object') {
      out.items = stripForStrict(value as JsonSchema);
    } else {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
