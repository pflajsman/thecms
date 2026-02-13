import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Checkbox,
  FormControlLabel,
  Typography,
  Collapse,
} from '@mui/material';
import { Add, Delete, DragHandle, ExpandMore, ExpandLess } from '@mui/icons-material';
import type { FormFieldDefinition, FormFieldType } from '../../types';

interface FormFieldBuilderProps {
  fields: FormFieldDefinition[];
  onChange: (fields: FormFieldDefinition[]) => void;
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'TEXT', label: 'Text' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'TEXTAREA', label: 'Textarea' },
  { value: 'SELECT', label: 'Select' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CHECKBOX', label: 'Checkbox' },
  { value: 'DATE', label: 'Date' },
];

export function FormFieldBuilder({ fields, onChange }: FormFieldBuilderProps) {
  const [expandedField, setExpandedField] = useState<number | null>(null);

  const addField = () => {
    const newField: FormFieldDefinition = {
      name: '',
      type: 'TEXT',
      label: '',
      required: false,
    };
    onChange([...fields, newField]);
    setExpandedField(fields.length);
  };

  const updateField = (index: number, updates: Partial<FormFieldDefinition>) => {
    const updated = fields.map((field, i) =>
      i === index ? { ...field, ...updates } : field
    );
    onChange(updated);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
    if (expandedField === index) {
      setExpandedField(null);
    }
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const updated = [...fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  return (
    <Box>
      {fields.map((field, index) => (
        <Card key={index} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => moveField(index, 'up')}
                  disabled={index === 0}
                >
                  <DragHandle />
                </IconButton>
              </Box>

              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                {field.label || field.name || `Field ${index + 1}`}
              </Typography>

              <IconButton
                size="small"
                onClick={() =>
                  setExpandedField(expandedField === index ? null : index)
                }
              >
                {expandedField === index ? <ExpandLess /> : <ExpandMore />}
              </IconButton>

              <IconButton size="small" color="error" onClick={() => removeField(index)}>
                <Delete />
              </IconButton>
            </Box>

            <Collapse in={expandedField === index}>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <TextField
                  label="Field Name"
                  value={field.name}
                  onChange={(e) => {
                    const name = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '_')
                      .replace(/(^_|_$)/g, '');
                    updateField(index, { name });
                  }}
                  required
                  fullWidth
                  helperText="Internal field name (e.g., 'full_name')"
                />

                <TextField
                  label="Label"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  required
                  fullWidth
                  helperText="Display label for this field"
                />

                <FormControl fullWidth>
                  <InputLabel>Field Type</InputLabel>
                  <Select
                    value={field.type}
                    label="Field Type"
                    onChange={(e) =>
                      updateField(index, { type: e.target.value as FormFieldType })
                    }
                  >
                    {FIELD_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Placeholder"
                  value={field.placeholder || ''}
                  onChange={(e) => updateField(index, { placeholder: e.target.value })}
                  fullWidth
                  helperText="Placeholder text shown in the input"
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.required}
                      onChange={(e) =>
                        updateField(index, { required: e.target.checked })
                      }
                    />
                  }
                  label="Required field"
                />

                {/* SELECT options */}
                {field.type === 'SELECT' && (
                  <TextField
                    label="Options"
                    value={field.options?.join(', ') || ''}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value
                          ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                          : undefined,
                      })
                    }
                    fullWidth
                    helperText="Comma-separated options (e.g., 'Option A, Option B, Option C')"
                  />
                )}

                {/* TEXT / EMAIL / TEXTAREA validation */}
                {(field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'TEXTAREA') && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField
                      label="Min Length"
                      type="number"
                      value={field.validation?.minLength ?? ''}
                      onChange={(e) =>
                        updateField(index, {
                          validation: {
                            ...field.validation,
                            minLength: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                    <TextField
                      label="Max Length"
                      type="number"
                      value={field.validation?.maxLength ?? ''}
                      onChange={(e) =>
                        updateField(index, {
                          validation: {
                            ...field.validation,
                            maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                  </Box>
                )}

                {/* NUMBER validation */}
                {field.type === 'NUMBER' && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField
                      label="Min Value"
                      type="number"
                      value={field.validation?.min ?? ''}
                      onChange={(e) =>
                        updateField(index, {
                          validation: {
                            ...field.validation,
                            min: e.target.value ? parseFloat(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                    <TextField
                      label="Max Value"
                      type="number"
                      value={field.validation?.max ?? ''}
                      onChange={(e) =>
                        updateField(index, {
                          validation: {
                            ...field.validation,
                            max: e.target.value ? parseFloat(e.target.value) : undefined,
                          },
                        })
                      }
                    />
                  </Box>
                )}
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      ))}

      <Button
        variant="outlined"
        startIcon={<Add />}
        onClick={addField}
        fullWidth
        sx={{ mt: 2 }}
      >
        Add Field
      </Button>
    </Box>
  );
}
