import {Connection, HydratedDocument, Model, Schema} from 'mongoose';
import {AMENITIES, CITIES, HOUSING_TYPES} from '../../types.js';
import {OfferEntity} from './offer.entity.js';

export type OfferRecord = OfferEntity;

export type OfferDocument = HydratedDocument<OfferRecord>;
export type OfferModel = Model<OfferRecord>;

const offerSchema = new Schema<OfferRecord>({
  title: {type: String, required: true},
  description: {type: String, required: true},
  publicationDate: {type: Date, required: true},
  city: {type: String, enum: CITIES, required: true},
  previewImage: {type: String, required: true},
  images: {type: [String], required: true},
  isPremium: {type: Boolean, required: true},
  rating: {type: Number, default: 1},
  ratingSum: {type: Number, default: 0, select: false},
  housingType: {type: String, enum: HOUSING_TYPES, required: true},
  bedrooms: {type: Number, required: true},
  maxAdults: {type: Number, required: true},
  price: {type: Number, required: true},
  amenities: {type: [String], enum: AMENITIES, required: true},
  author: {type: Schema.Types.ObjectId, ref: 'User', required: true},
  commentsCount: {type: Number, default: 0},
  coordinates: {
    latitude: {type: Number, required: true},
    longitude: {type: Number, required: true},
  },
}, {timestamps: true, collection: 'offers', bufferCommands: false});

offerSchema.index({publicationDate: -1, _id: -1});
offerSchema.index({city: 1, isPremium: 1, publicationDate: -1, _id: -1});

export function createOfferModel(connection: Connection): OfferModel {
  return connection.model<OfferRecord>('Offer', offerSchema);
}
