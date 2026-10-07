export const CITIES = ['Paris', 'Cologne', 'Brussels', 'Amsterdam', 'Hamburg', 'Dusseldorf'] as const;
export type City = typeof CITIES[number];

export const HOUSING_TYPES = ['apartment', 'house', 'room', 'hotel'] as const;
export type HousingType = typeof HOUSING_TYPES[number];

export const AMENITIES = [
  'Breakfast', 'Air conditioning', 'Laptop friendly workspace', 'Baby seat',
  'Washer', 'Towels', 'Fridge',
] as const;
export type Amenity = typeof AMENITIES[number];

export type UserType = 'regular' | 'pro';

export type User = {
  name: string;
  email: string;
  avatarPath?: string;
  password: string;
  type: UserType;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Offer = {
  title: string;
  description: string;
  publicationDate: Date;
  city: City;
  previewImage: string;
  images: string[];
  isPremium: boolean;
  isFavorite: boolean;
  rating: number;
  housingType: HousingType;
  bedrooms: number;
  maxAdults: number;
  price: number;
  amenities: Amenity[];
  author: User;
  commentsCount: number;
  coordinates: Coordinates;
};

export type Comment = {
  text: string;
  publicationDate: Date;
  rating: number;
  author: User;
};

// The file identifies an existing author by email; the database will resolve that reference.
export type ImportedOffer = Omit<Offer, 'author' | 'commentsCount'> & {
  authorEmail: string;
};

export type OfferTemplate = Pick<ImportedOffer,
  'title' | 'description' | 'city' | 'previewImage' | 'images' | 'authorEmail' | 'coordinates'>;
