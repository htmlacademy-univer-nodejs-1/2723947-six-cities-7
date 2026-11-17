import {Offer} from '../../../types.js';

export type CreateOfferDto = Omit<Offer, 'author' | 'rating' | 'isFavorite' | 'commentsCount'> & {
  authorId: string;
};
