import type {ImportedOffer} from './types.js';

export const COLUMNS = [
  'title', 'description', 'publicationDate', 'city', 'previewImage', 'images',
  'isPremium', 'isFavorite', 'rating', 'housingType', 'bedrooms', 'maxAdults',
  'price', 'amenities', 'authorEmail', 'latitude', 'longitude',
];

export function serializeOffer(offer: ImportedOffer): string {
  return [
    offer.title, offer.description, offer.publicationDate.toISOString(), offer.city,
    offer.previewImage, offer.images.join(';'), offer.isPremium, offer.isFavorite,
    offer.rating, offer.housingType, offer.bedrooms, offer.maxAdults, offer.price,
    offer.amenities.join(';'), offer.authorEmail, offer.coordinates.latitude,
    offer.coordinates.longitude,
  ].join('\t');
}
