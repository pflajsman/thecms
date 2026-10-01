import mongoose from 'mongoose';
import { ContentTypeModel, type IContentType } from '../../models/content-type.model';
import { FieldType } from '../../types/field-types';

export const PRODUCT_CORE_FIELDS = ['name', 'description', 'images'] as const;

const CORE_FIELDS = [
  { name: 'name', label: 'Name', type: FieldType.TEXT, required: true },
  { name: 'description', label: 'Description', type: FieldType.RICH_TEXT, required: false },
  { name: 'images', label: 'Images', type: FieldType.MEDIA, required: false, validation: { multiple: true } },
];

/** Idempotent: the system content type that holds product text and images. */
export async function ensureProductModel(): Promise<IContentType> {
  const existing = await ContentTypeModel.findOne({ system: 'product' });
  if (existing) return existing;
  // A user model may already use the slug "product"; the system model then takes "shop-product".
  const slug = (await ContentTypeModel.exists({ slug: 'product' })) ? 'shop-product' : 'product';
  return ContentTypeModel.create({ name: 'Product', slug, system: 'product', titleField: 'name', fields: CORE_FIELDS });
}

export async function productContentTypeId(): Promise<mongoose.Types.ObjectId> {
  return (await ensureProductModel())._id as mongoose.Types.ObjectId;
}
