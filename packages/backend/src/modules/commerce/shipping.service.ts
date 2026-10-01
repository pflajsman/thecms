import mongoose from 'mongoose';
import { ShippingMethodModel, ShippingZoneModel, type IShippingMethod, type IShippingZone } from '../../models/shipping.model';
import { AppError } from '../../middleware/error.middleware';
import { LanguagesService } from '../languages/languages.service';
import { SettingsService } from './settings.service';
import type { MethodInput, ZoneInput } from './commerce.schema';

async function load<T>(model: mongoose.Model<T>, id: string, what: string): Promise<mongoose.HydratedDocument<T>> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${what} ID`, 400);
  const doc = await model.findById(id);
  if (!doc) throw new AppError(`${what} not found`, 404);
  return doc;
}

async function checkZone(input: ZoneInput, selfId?: string): Promise<ZoneInput> {
  const countries = [...new Set(input.countries.map((c) => c.toUpperCase()))];
  if (input.rest && countries.length) throw new AppError('The "everywhere else" zone has no countries', 400);
  if (!input.rest && countries.length === 0) throw new AppError('Add at least one country', 400);
  const others = await ShippingZoneModel.find(selfId ? { _id: { $ne: selfId } } : {}).lean();
  if (input.rest && others.some((z) => z.rest)) throw new AppError('There is already an "everywhere else" zone', 409);
  for (const c of countries) {
    const owner = others.find((z) => z.countries.includes(c));
    if (owner) throw new AppError(`${c} is already in ${owner.name}`, 409);
  }
  return { ...input, countries };
}

async function checkMethod(input: MethodInput): Promise<MethodInput> {
  const defaultCode = await LanguagesService.defaultCode();
  if (!input.labels[defaultCode]) throw new AppError(`Add a name in ${defaultCode}`, 400);
  const currencies = (await SettingsService.get()).currencies.map((c) => c.code);
  const unknown = (map: Record<string, number>) => Object.keys(map).filter((c) => !currencies.includes(c));
  const bad = [...unknown(input.codFees), ...unknown(input.freeOver), ...input.rates.flatMap((r) => r.bands.flatMap((b) => unknown(b.prices)))];
  if (bad.length) throw new AppError(`Unknown currency ${[...new Set(bad)].join(', ')}`, 400);
  const zoneIds = input.rates.map((r) => r.zoneId);
  if (new Set(zoneIds).size !== zoneIds.length) throw new AppError('Each zone can have only one rate list', 400);
  if ((await ShippingZoneModel.countDocuments({ _id: { $in: zoneIds } })) !== zoneIds.length) throw new AppError('Unknown shipping zone', 400);
  for (const r of input.rates) {
    for (const [i, band] of r.bands.entries()) {
      const last = i === r.bands.length - 1;
      if (band.upToGrams === null && !last) throw new AppError('Only the last weight band can be open-ended', 400);
      const prev = r.bands[i - 1];
      if (prev && band.upToGrams !== null && prev.upToGrams !== null && band.upToGrams <= prev.upToGrams)
        throw new AppError('Weight bands must increase', 400);
    }
  }
  return input;
}

export class ShippingService {
  static listZones(): Promise<IShippingZone[]> {
    return ShippingZoneModel.find().sort({ order: 1 }).exec();
  }

  static async createZone(input: ZoneInput): Promise<IShippingZone> {
    const checked = await checkZone(input);
    return ShippingZoneModel.create({ ...checked, order: await ShippingZoneModel.countDocuments() });
  }

  static async updateZone(id: string, input: ZoneInput): Promise<IShippingZone> {
    const zone = await load(ShippingZoneModel, id, 'Shipping zone');
    zone.set(await checkZone(input, id));
    return zone.save();
  }

  static async deleteZone(id: string): Promise<void> {
    const zone = await load(ShippingZoneModel, id, 'Shipping zone');
    if (await ShippingMethodModel.exists({ 'rates.zoneId': zone._id })) throw new AppError('A shipping method uses this zone', 409);
    await zone.deleteOne();
  }

  static listMethods(): Promise<IShippingMethod[]> {
    return ShippingMethodModel.find().sort({ order: 1 }).exec();
  }

  static async createMethod(input: MethodInput): Promise<IShippingMethod> {
    const checked = await checkMethod(input);
    return ShippingMethodModel.create({ ...checked, order: await ShippingMethodModel.countDocuments() });
  }

  static async updateMethod(id: string, input: MethodInput): Promise<IShippingMethod> {
    const method = await load(ShippingMethodModel, id, 'Shipping method');
    method.set(await checkMethod(input));
    method.markModified('labels');
    method.markModified('codFees');
    method.markModified('freeOver');
    method.markModified('rates');
    return method.save();
  }

  static async deleteMethod(id: string): Promise<void> {
    const method = await load(ShippingMethodModel, id, 'Shipping method');
    await method.deleteOne();
  }
}
