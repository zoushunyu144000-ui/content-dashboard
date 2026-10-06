import type { JsonSchema } from './schema';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateJson(value: unknown, schema: JsonSchema): ValidationResult {
  const errors: string[] = [];
  check(value, schema, '$', errors);
  return { ok: errors.length === 0, errors };
}

function check(value: unknown, schema: JsonSchema, path: string, errors: string[]): void {
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    errors.push(`${path} must be one of ${schema.enum.map(String).join(', ')}`);
    return;
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path} expected ${types.join('|')}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push(`${path} is shorter than ${schema.minLength}`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push(`${path} is longer than ${schema.maxLength}`);
    }
    if (schema.pattern) {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) errors.push(`${path} does not match pattern`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path} is below ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${path} is above ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${path} needs at least ${schema.minItems} items`);
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push(`${path} has more than ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, index) => check(item, schema.items as JsonSchema, `${path}[${index}]`, errors));
    }
    return;
  }

  if (value !== null && typeof value === 'object' && schema.properties) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        errors.push(`${path}.${key} is required`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(record)) {
        if (!schema.properties[key]) errors.push(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, child] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        check(record[key], child, `${path}.${key}`, errors);
      }
    }
  }
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return true;
  }
}
