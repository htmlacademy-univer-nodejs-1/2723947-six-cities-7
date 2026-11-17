import {Types} from 'mongoose';
import {Offer} from '../../types.js';

export type OfferEntity = Omit<Offer, 'author' | 'isFavorite'> & {
  author: Types.ObjectId;
  ratingSum: number;
  createdAt: Date;
  updatedAt: Date;
};
