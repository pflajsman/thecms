import { TextField, Checkbox, FormControlLabel, Typography, Box } from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { RichTextEditor } from './RichTextEditor';
import type { Field } from '../types';

interface DynamicFormGeneratorProps {
  fields: Field[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  errors?: Record<string, string>;
}

export function DynamicFormGenerator({ fields, values, onChange, errors }: DynamicFormGeneratorProps) {
  const renderField = (field: Field) => {
    const value = values[field.name] ?? field.defaultValue ?? '';
    const error = errors?.[field.name];

    switch (field.type) {
      case 'TEXT':
        return (
          <TextField
            key={field.name}
            label={field.label}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            required={field.required}
            fullWidth
            margin="normal"
            helperText={error || field.description}
            error={!!error}
            inputProps={{
              minLength: field.validation?.minLength,
              maxLength: field.validation?.maxLength,
            }}
          />
        );

      case 'RICH_TEXT':
        return (
          <Box key={field.name} sx={{ my: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {field.label}
              {field.required && <span style={{ color: 'red' }}> *</span>}
            </Typography>
            {field.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {field.description}
              </Typography>
            )}
            <RichTextEditor
              value={value}
              onChange={(val) => onChange(field.name, val)}
              placeholder={field.description}
            />
            {error && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {error}
              </Typography>
            )}
          </Box>
        );

      case 'NUMBER':
        return (
          <TextField
            key={field.name}
            label={field.label}
            type="number"
            value={value}
            onChange={(e) => onChange(field.name, parseFloat(e.target.value))}
            required={field.required}
            fullWidth
            margin="normal"
            helperText={error || field.description}
            error={!!error}
            inputProps={{
              min: field.validation?.min,
              max: field.validation?.max,
            }}
          />
        );

      case 'DATE':
        return (
          <LocalizationProvider key={field.name} dateAdapter={AdapterDateFns}>
            <DatePicker
              label={field.label}
              value={value ? new Date(value) : null}
              onChange={(date) => onChange(field.name, date?.toISOString())}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: 'normal',
                  required: field.required,
                  helperText: error || field.description,
                  error: !!error,
                },
              }}
            />
          </LocalizationProvider>
        );

      case 'BOOLEAN':
        return (
          <Box key={field.name} sx={{ my: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!value}
                  onChange={(e) => onChange(field.name, e.target.checked)}
                />
              }
              label={field.label}
            />
            {field.description && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                {field.description}
              </Typography>
            )}
            {error && (
              <Typography variant="caption" color="error" sx={{ ml: 4 }}>
                {error}
              </Typography>
            )}
          </Box>
        );

      case 'MEDIA':
        return (
          <Box key={field.name} sx={{ my: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {field.label}
              {field.required && <span style={{ color: 'red' }}> *</span>}
            </Typography>
            {field.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {field.description}
              </Typography>
            )}
            {/* Media picker will be implemented */}
            <TextField
              value={value}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder="Media ID (Media picker coming soon)"
              fullWidth
              helperText={error}
              error={!!error}
            />
          </Box>
        );

      case 'RELATION':
        return (
          <Box key={field.name} sx={{ my: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {field.label}
              {field.required && <span style={{ color: 'red' }}> *</span>}
            </Typography>
            {field.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {field.description}
              </Typography>
            )}
            {/* Relation picker will be implemented */}
            <TextField
              value={value}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder="Related entry ID (Relation picker coming soon)"
              fullWidth
              helperText={error}
              error={!!error}
            />
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {fields.map((field) => renderField(field))}
    </Box>
  );
}
