import { FieldType, FieldDefinition } from '../../types/field-types';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates content entry data against content type field definitions
 */
export class ContentEntryValidator {
  /**
   * Validate entire content entry data
   */
  static validateEntryData(
    data: Record<string, any>,
    fields: FieldDefinition[]
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Check required fields
    for (const field of fields) {
      if (field.required && (data[field.name] === undefined || data[field.name] === null)) {
        errors.push({
          field: field.name,
          message: `${field.label} is required`,
          type: 'required',
        });
      }
    }

    // Validate each provided field
    for (const [fieldName, fieldValue] of Object.entries(data)) {
      const fieldDef = fields.find((f) => f.name === fieldName);

      // Check if field exists in content type
      if (!fieldDef) {
        errors.push({
          field: fieldName,
          message: `Field "${fieldName}" is not defined in content type`,
          type: 'unknown_field',
        });
        continue;
      }

      // Skip validation if value is null/undefined and not required
      if ((fieldValue === null || fieldValue === undefined) && !fieldDef.required) {
        continue;
      }

      // Validate based on field type
      const fieldErrors = this.validateField(fieldName, fieldValue, fieldDef);
      errors.push(...fieldErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single field value
   */
  private static validateField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (fieldDef.type) {
      case FieldType.TEXT:
        errors.push(...this.validateTextField(fieldName, value, fieldDef));
        break;

      case FieldType.RICH_TEXT:
        errors.push(...this.validateRichTextField(fieldName, value, fieldDef));
        break;

      case FieldType.NUMBER:
        errors.push(...this.validateNumberField(fieldName, value, fieldDef));
        break;

      case FieldType.DATE:
        errors.push(...this.validateDateField(fieldName, value, fieldDef));
        break;

      case FieldType.BOOLEAN:
        errors.push(...this.validateBooleanField(fieldName, value, fieldDef));
        break;

      case FieldType.MEDIA:
        errors.push(...this.validateMediaField(fieldName, value, fieldDef));
        break;

      case FieldType.RELATION:
        errors.push(...this.validateRelationField(fieldName, value, fieldDef));
        break;

      default:
        errors.push({
          field: fieldName,
          message: `Unknown field type: ${fieldDef.type}`,
          type: 'invalid_type',
        });
    }

    return errors;
  }

  /**
   * Validate TEXT field
   */
  private static validateTextField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value !== 'string') {
      errors.push({
        field: fieldName,
        message: `${fieldDef.label} must be a string`,
        type: 'invalid_type',
      });
      return errors;
    }

    const validation = fieldDef.validation;
    if (validation) {
      // Check min length
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be at least ${validation.minLength} characters`,
          type: 'min_length',
        });
      }

      // Check max length
      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be at most ${validation.maxLength} characters`,
          type: 'max_length',
        });
      }

      // Check pattern
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          errors.push({
            field: fieldName,
            message: `${fieldDef.label} does not match the required pattern`,
            type: 'pattern',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate RICH_TEXT field
   */
  private static validateRichTextField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value !== 'string') {
      errors.push({
        field: fieldName,
        message: `${fieldDef.label} must be a string (HTML/Markdown)`,
        type: 'invalid_type',
      });
      return errors;
    }

    const validation = fieldDef.validation;
    if (validation) {
      // Check max length for rich text
      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be at most ${validation.maxLength} characters`,
          type: 'max_length',
        });
      }
    }

    return errors;
  }

  /**
   * Validate NUMBER field
   */
  private static validateNumberField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value !== 'number' || isNaN(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldDef.label} must be a valid number`,
        type: 'invalid_type',
      });
      return errors;
    }

    const validation = fieldDef.validation;
    if (validation) {
      // Check if integer is required
      if (validation.integer && !Number.isInteger(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be an integer`,
          type: 'integer',
        });
      }

      // Check min value
      if (validation.min !== undefined && value < validation.min) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be at least ${validation.min}`,
          type: 'min_value',
        });
      }

      // Check max value
      if (validation.max !== undefined && value > validation.max) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be at most ${validation.max}`,
          type: 'max_value',
        });
      }
    }

    return errors;
  }

  /**
   * Validate DATE field
   */
  private static validateDateField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Accept both Date objects and ISO date strings
    let dateValue: Date;

    if (value instanceof Date) {
      dateValue = value;
    } else if (typeof value === 'string') {
      dateValue = new Date(value);
    } else {
      errors.push({
        field: fieldName,
        message: `${fieldDef.label} must be a valid date`,
        type: 'invalid_type',
      });
      return errors;
    }

    if (isNaN(dateValue.getTime())) {
      errors.push({
        field: fieldName,
        message: `${fieldDef.label} must be a valid date`,
        type: 'invalid_date',
      });
      return errors;
    }

    const validation = fieldDef.validation;
    if (validation) {
      // Check min date
      if (validation.minDate) {
        const minDate = new Date(validation.minDate);
        if (dateValue < minDate) {
          errors.push({
            field: fieldName,
            message: `${fieldDef.label} must be on or after ${minDate.toISOString()}`,
            type: 'min_date',
          });
        }
      }

      // Check max date
      if (validation.maxDate) {
        const maxDate = new Date(validation.maxDate);
        if (dateValue > maxDate) {
          errors.push({
            field: fieldName,
            message: `${fieldDef.label} must be on or before ${maxDate.toISOString()}`,
            type: 'max_date',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate BOOLEAN field
   */
  private static validateBooleanField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof value !== 'boolean') {
      errors.push({
        field: fieldName,
        message: `${fieldDef.label} must be a boolean`,
        type: 'invalid_type',
      });
    }

    return errors;
  }

  /**
   * Validate MEDIA field (references to media items)
   */
  private static validateMediaField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Media field should contain media ID(s)
    const validation = fieldDef.validation;
    const isMultiple = validation?.multiple || false;

    if (isMultiple) {
      if (!Array.isArray(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be an array of media IDs`,
          type: 'invalid_type',
        });
        return errors;
      }

      // Check each ID is a string
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'string') {
          errors.push({
            field: fieldName,
            message: `${fieldDef.label}[${i}] must be a valid media ID`,
            type: 'invalid_id',
          });
        }
      }
    } else {
      if (typeof value !== 'string') {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be a valid media ID`,
          type: 'invalid_type',
        });
      }
    }

    return errors;
  }

  /**
   * Validate RELATION field (references to other content entries)
   */
  private static validateRelationField(
    fieldName: string,
    value: any,
    fieldDef: FieldDefinition
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    const validation = fieldDef.validation;
    const isMultiple = validation?.multiple || false;

    if (isMultiple) {
      if (!Array.isArray(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be an array of content entry IDs`,
          type: 'invalid_type',
        });
        return errors;
      }

      // Check each ID is a string
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'string') {
          errors.push({
            field: fieldName,
            message: `${fieldDef.label}[${i}] must be a valid content entry ID`,
            type: 'invalid_id',
          });
        }
      }
    } else {
      if (typeof value !== 'string') {
        errors.push({
          field: fieldName,
          message: `${fieldDef.label} must be a valid content entry ID`,
          type: 'invalid_type',
        });
      }
    }

    return errors;
  }
}
