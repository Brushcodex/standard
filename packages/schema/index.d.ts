/** A parsed JSON Schema document. */
export type JsonSchema = Record<string, unknown>;

/** Every published specification's v1 JSON Schema, keyed by spec name. */
export declare const schemas: Readonly<{
  common: JsonSchema;
  recipe: JsonSchema;
  palette: JsonSchema;
  inventory: JsonSchema;
  project: JsonSchema;
  technique: JsonSchema;
  bundle: JsonSchema;
}>;

/** Map of schema `$id` -> schema object. */
export declare const schemaById: Readonly<Record<string, JsonSchema>>;

/** The spec names for which a v1 schema exists. */
export declare const SPEC_NAMES: readonly string[];
