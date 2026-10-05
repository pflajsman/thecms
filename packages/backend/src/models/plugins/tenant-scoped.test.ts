import mongoose, { Schema, Types } from 'mongoose';
import { useTestDb } from '../../test/db';
import { tenantScoped } from './tenant-scoped';
import { NoProjectContextError, runInProject, withoutProject } from '../../utils/project-context';

useTestDb();

const schema = new Schema({ name: String, n: Number });
schema.plugin(tenantScoped);
const Thing = mongoose.model('TenantThing', schema);

const a = new Types.ObjectId();
const b = new Types.ObjectId();

async function seed() {
  await runInProject(a, () => Thing.create([{ name: 'a1', n: 1 }, { name: 'a2', n: 2 }]));
  await runInProject(b, () => Thing.insertMany([{ name: 'b1', n: 1 }]));
}

it('refuses every operation without a project context', async () => {
  await expect(Thing.find()).rejects.toBeInstanceOf(NoProjectContextError);
  await expect(Thing.create({ name: 'x' })).rejects.toBeInstanceOf(NoProjectContextError);
  await expect(Thing.insertMany([{ name: 'x' }])).rejects.toBeInstanceOf(NoProjectContextError);
  await expect(Thing.aggregate([{ $match: {} }])).rejects.toBeInstanceOf(NoProjectContextError);
});

it('sees and changes only the current project', async () => {
  await seed();
  const bThing = await withoutProject(() => Thing.findOne({ name: 'b1' }));

  await runInProject(a, async () => {
    expect((await Thing.find().sort({ n: 1 })).map((t) => t.name)).toEqual(['a1', 'a2']);
    expect(await Thing.countDocuments()).toBe(2);
    expect(await Thing.findById(bThing!._id)).toBeNull();
    expect(await Thing.distinct('name')).toEqual(['a1', 'a2']);
    expect((await Thing.aggregate([{ $match: { n: 1 } }])).map((t) => t.name)).toEqual(['a1']);
    expect((await Thing.aggregate([{ $sort: { n: 1 } }])).length).toBe(2);
    await Thing.updateMany({}, { $set: { n: 9 } });
    await Thing.findOneAndUpdate({ _id: bThing!._id }, { $set: { n: 9 } });
    await Thing.deleteMany({ name: 'b1' });
  });

  const b1 = await withoutProject(() => Thing.findById(bThing!._id));
  expect(b1?.get('n')).toBe(1);
  expect(await withoutProject(() => Thing.countDocuments())).toBe(3);
});

it('refuses to save a document into another project', async () => {
  await seed();
  const bThing = await withoutProject(() => Thing.findOne({ name: 'b1' }));
  bThing!.set('n', 5);
  await expect(runInProject(a, () => bThing!.save())).rejects.toThrow('another project');
  await expect(runInProject(a, () => Thing.insertMany([{ name: 'x', projectId: b }]))).rejects.toThrow('another project');
});

it('keeps the context across awaits', async () => {
  await seed();
  const names = await runInProject(b, async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return (await Thing.find()).map((t) => t.name);
  });
  expect(names).toEqual(['b1']);
});
