import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TheCMS API',
      version: '1.0.0',
      description: 'Headless CMS API built with Express, TypeScript, and MongoDB',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://<your-app>.azurecontainerapps.io',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from Microsoft Entra External ID',
        },
      },
      schemas: {
        ContentType: {
          type: 'object',
          required: ['name', 'slug', 'fields'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier',
            },
            name: {
              type: 'string',
              description: 'Content type name',
              example: 'Blog Post',
            },
            slug: {
              type: 'string',
              description: 'URL-friendly identifier',
              example: 'blog-post',
            },
            description: {
              type: 'string',
              description: 'Optional description',
              example: 'Blog post content type',
            },
            fields: {
              type: 'array',
              description: 'Field definitions',
              items: {
                $ref: '#/components/schemas/FieldDefinition',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        FieldDefinition: {
          type: 'object',
          required: ['name', 'type', 'label', 'required'],
          properties: {
            name: {
              type: 'string',
              description: 'Field name (used in API)',
              example: 'title',
            },
            type: {
              type: 'string',
              enum: ['TEXT', 'RICH_TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'MEDIA', 'RELATION'],
              description: 'Field type',
              example: 'TEXT',
            },
            label: {
              type: 'string',
              description: 'Field label (displayed in UI)',
              example: 'Title',
            },
            description: {
              type: 'string',
              description: 'Field description',
              example: 'The title of the blog post',
            },
            required: {
              type: 'boolean',
              description: 'Whether the field is required',
              example: true,
            },
            unique: {
              type: 'boolean',
              description: 'Whether the field value must be unique',
              example: false,
            },
            defaultValue: {
              description: 'Default value for the field',
            },
            validation: {
              $ref: '#/components/schemas/FieldValidation',
            },
          },
        },
        FieldValidation: {
          type: 'object',
          properties: {
            minLength: {
              type: 'integer',
              description: 'Minimum length for text fields',
            },
            maxLength: {
              type: 'integer',
              description: 'Maximum length for text fields',
            },
            pattern: {
              type: 'string',
              description: 'Regex pattern for text validation',
            },
            min: {
              type: 'number',
              description: 'Minimum value for number fields',
            },
            max: {
              type: 'number',
              description: 'Maximum value for number fields',
            },
            integer: {
              type: 'boolean',
              description: 'Whether number must be an integer',
            },
            minDate: {
              type: 'string',
              format: 'date-time',
              description: 'Minimum date',
            },
            maxDate: {
              type: 'string',
              format: 'date-time',
              description: 'Maximum date',
            },
            allowedMimeTypes: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Allowed MIME types for media fields',
            },
            maxFileSize: {
              type: 'integer',
              description: 'Maximum file size in bytes',
            },
            targetContentType: {
              type: 'string',
              description: 'Target content type for relation fields',
            },
            multiple: {
              type: 'boolean',
              description: 'Whether multiple values are allowed',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
