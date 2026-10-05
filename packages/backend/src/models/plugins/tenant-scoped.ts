import { Schema, Types } from 'mongoose';

/** Fields the plugin adds; extend a model's interface with it. */
export interface TenantFields {
  projectId: Types.ObjectId;
}
import { scopeFor } from '../../utils/project-context';

const QUERY_HOOKS = [
  'count',
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndRemove',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'update',
  'updateMany',
  'updateOne',
] as const;

/**
 * Tenant data: adds projectId and scopes every query, aggregate and write to the project of the running
 * request (utils/project-context). Without a context it refuses, so a forgotten filter cannot leak data.
 */
export function tenantScoped(schema: Schema): void {
  schema.add({ projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true } });

  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, function () {
      const projectId = scopeFor(this.model.modelName);
      if (projectId) this.where({ projectId });
    });
  }

  schema.pre('estimatedDocumentCount', function () {
    if (scopeFor(this.model.modelName)) throw new Error('estimatedDocumentCount cannot be scoped to a project; use countDocuments');
  });

  schema.pre('aggregate', function () {
    const projectId = scopeFor((this as unknown as { _model: { modelName: string } })._model.modelName);
    if (!projectId) return;
    const pipeline = this.pipeline() as unknown as Record<string, unknown>[];
    const first = pipeline[0] as { $match?: Record<string, unknown> } | undefined;
    // $text and similar stages must stay in the first $match, so merge into it.
    if (first?.$match) first.$match = { ...first.$match, projectId };
    else pipeline.unshift({ $match: { projectId } });
  });

  schema.pre('validate', function () {
    const projectId = scopeFor((this.constructor as unknown as { modelName: string }).modelName);
    if (!projectId) return;
    const own = this.get('projectId') as Types.ObjectId | undefined;
    if (!own) this.set('projectId', projectId);
    else if (!own.equals(projectId)) throw new Error('The document belongs to another project');
  });

  schema.pre('insertMany', function (next: (err?: Error) => void, docs: Record<string, unknown>[] | Record<string, unknown>) {
    const projectId = scopeFor(this.modelName);
    if (projectId) {
      for (const doc of Array.isArray(docs) ? docs : [docs]) {
        if (!doc.projectId) doc.projectId = projectId;
        else if (!new Types.ObjectId(String(doc.projectId)).equals(projectId)) return next(new Error('The document belongs to another project'));
      }
    }
    next();
  });
}
