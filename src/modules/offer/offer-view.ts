import {Types} from 'mongoose';
import {User} from '../../types.js';
import {OfferEntity} from './offer.entity.js';

export type PublicUser = Omit<User, 'password'> & {_id: Types.ObjectId};
export type OfferView = Omit<OfferEntity, 'author' | 'ratingSum'> & {
  _id: Types.ObjectId;
  author: PublicUser;
  isFavorite: boolean;
};
export type OfferSummary = Pick<OfferView,
  '_id' | 'title' | 'price' | 'housingType' | 'isFavorite' | 'publicationDate' |
  'city' | 'previewImage' | 'isPremium' | 'rating' | 'commentsCount'>;
