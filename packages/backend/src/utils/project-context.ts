import { AsyncLocalStorage } from 'async_hooks';
import { Types } from 'mongoose';

interface ProjectContext {
  projectId: Types.ObjectId | null;
  bypass: boolean;
}

const storage = new AsyncLocalStorage<ProjectContext>();

// Tests only (src/test/setup.ts): the project used when a test runs outside any context.
let testDefaultProject: Types.ObjectId | null = null;

/** Tests only: scope context-free code to this project, or null to keep the production rule (refuse). */
export function setTestDefaultProject(projectId: Types.ObjectId | null): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('setTestDefaultProject is for tests only');
  testDefaultProject = projectId;
}

/** Tests only: the default project, when set (only setTestDefaultProject can set it, and only in tests). */
export function getTestDefaultProject(): Types.ObjectId | null {
  return testDefaultProject;
}

/** Thrown when tenant data is touched outside runInProject or withoutProject. */
export class NoProjectContextError extends Error {
  constructor(modelName: string) {
    super(`${modelName} was used without a project context`);
    this.name = 'NoProjectContextError';
  }
}

type Executed<T> = T extends { exec(): infer R } ? R : T;

// Mongoose queries and aggregates are lazy: run them now, inside the context, not when the caller awaits.
function execute<T>(fn: () => T): Executed<T> {
  const result = fn() as T & { exec?: () => unknown };
  return (typeof result?.exec === 'function' ? result.exec() : result) as Executed<T>;
}

/** Runs fn with every tenant query scoped to the project. */
export function runInProject<T>(projectId: string | Types.ObjectId, fn: () => T): Executed<T> {
  return storage.run({ projectId: new Types.ObjectId(String(projectId)), bypass: false }, () => execute(fn));
}

/** Runs fn with tenant scoping lifted: superadmin listings, migrations, and lookups that find the project first. */
export function withoutProject<T>(fn: () => T): Executed<T> {
  return storage.run({ projectId: null, bypass: true }, () => execute(fn));
}

/** The project of the running request or job, or undefined outside runInProject. */
export function currentProjectId(): Types.ObjectId | undefined {
  const context = storage.getStore();
  return (context ? context.projectId : getTestDefaultProject()) ?? undefined;
}

/** The project to scope a query by, null when scoping is lifted; throws when there is no context at all. */
export function scopeFor(modelName: string): Types.ObjectId | null {
  const context = storage.getStore();
  if (!context) {
    const fallback = getTestDefaultProject();
    if (fallback) return fallback;
    throw new NoProjectContextError(modelName);
  }
  return context.bypass ? null : context.projectId;
}
