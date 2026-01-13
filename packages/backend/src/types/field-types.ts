/**
 * Field types supported by the CMS
 */
export enum FieldType {
  TEXT = 'TEXT',
  RICH_TEXT = 'RICH_TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  BOOLEAN = 'BOOLEAN',
  MEDIA = 'MEDIA',
  RELATION = 'RELATION',
}

/**
 * Base field definition
 */
export interface FieldDefinition {
  name: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  unique?: boolean;
  defaultValue?: any;
  validation?: FieldValidation;
}

/**
 * Validation rules for different field types
 */
export interface FieldValidation {
  // Text validation
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Number validation
  min?: number;
  max?: number;
  integer?: boolean;

  // Date validation
  minDate?: string;
  maxDate?: string;

  // Media validation
  allowedMimeTypes?: string[];
  maxFileSize?: number; // in bytes

  // Relation validation
  targetContentType?: string;
  multiple?: boolean;
}

/**
 * Content Type definition
 */
export interface ContentType {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  fields: FieldDefinition[];
  createdAt?: Date;
  updatedAt?: Date;
}
