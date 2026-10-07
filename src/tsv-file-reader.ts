import {createReadStream} from 'node:fs';
import {AMENITIES, CITIES, HOUSING_TYPES} from './types.js';
import type {Amenity, City, HousingType, ImportedOffer} from './types.js';

import {COLUMNS} from './tsv.js';

function numberInRange(value: string, name: string, min: number, max: number): number {
  const result = Number(value);
  if (!value.trim() || !Number.isFinite(result) || result < min || result > max) {
    throw new Error(`Некорректное значение ${name}: ${value}`);
  }
  return result;
}

export function parseOffer(line: string): ImportedOffer {
  const fields = line.split('\t');
  if (fields.length !== COLUMNS.length) {
    throw new Error(`Ожидалось ${COLUMNS.length} столбцов, получено ${fields.length}`);
  }
  const [title, description, publicationDate, city, previewImage, images,
    isPremium, isFavorite, rating, housingType, bedrooms, maxAdults, price,
    amenities, authorEmail, latitude, longitude] = fields;
  const date = new Date(publicationDate);
  const photos = images.split(';');
  const facilities = amenities.split(';');
  if (title.length < 10 || title.length > 100 || description.length < 20 || description.length > 1024 ||
    Number.isNaN(date.getTime()) || !CITIES.includes(city as City) ||
    !HOUSING_TYPES.includes(housingType as HousingType) || photos.length !== 6 ||
    !previewImage.trim() || photos.some((photo) => !photo.trim()) ||
    facilities.some((item) => !AMENITIES.includes(item as Amenity)) ||
    !['true', 'false'].includes(isPremium) || !['true', 'false'].includes(isFavorite) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
    throw new Error('Некорректные данные предложения');
  }
  const parsedRating = numberInRange(rating, 'rating', 1, 5);
  const parsedBedrooms = numberInRange(bedrooms, 'bedrooms', 1, 8);
  const parsedMaxAdults = numberInRange(maxAdults, 'maxAdults', 1, 10);
  const parsedPrice = numberInRange(price, 'price', 100, 100000);
  if (!Number.isInteger(parsedRating * 10) || !Number.isInteger(parsedBedrooms) ||
    !Number.isInteger(parsedMaxAdults) || !Number.isInteger(parsedPrice)) {
    throw new Error('Некорректная точность числового значения');
  }
  return {
    title,
    description,
    publicationDate: date,
    city: city as City,
    previewImage,
    images: photos,
    isPremium: isPremium === 'true',
    isFavorite: isFavorite === 'true',
    rating: parsedRating,
    housingType: housingType as HousingType,
    bedrooms: parsedBedrooms,
    maxAdults: parsedMaxAdults,
    price: parsedPrice,
    amenities: facilities as Amenity[],
    authorEmail,
    coordinates: {
      latitude: numberInRange(latitude, 'latitude', -90, 90),
      longitude: numberInRange(longitude, 'longitude', -180, 180),
    },
  };
}

export async function* readOffers(path: string): AsyncGenerator<ImportedOffer> {
  const input = createReadStream(path, {encoding: 'utf8'});
  let remainder = '';
  let lineNumber = 0;
  function parseLine(raw: string): ImportedOffer | undefined {
    const line = raw.replace(/\r$/, '').replace(/^\uFEFF/, '');
    lineNumber++;
    if (!line.trim() || (lineNumber === 1 && line === COLUMNS.join('\t'))) {
      return undefined;
    }
    try {
      return parseOffer(line);
    } catch (error) {
      throw new Error(`Строка ${lineNumber}: ${(error as Error).message}`);
    }
  }
  try {
    for await (const chunk of input) {
      const text = remainder + chunk;
      let start = 0;
      let end = text.indexOf('\n');
      while (end !== -1) {
        if (end - start > 64 * 1024) {
          throw new Error(`Строка ${lineNumber + 1}: превышен предел 64 КиБ`);
        }
        const offer = parseLine(text.slice(start, end));
        if (offer) {
          yield offer;
        }
        start = end + 1;
        end = text.indexOf('\n', start);
      }
      remainder = text.slice(start);
      if (remainder.length > 64 * 1024) {
        throw new Error(`Строка ${lineNumber + 1}: превышен предел 64 КиБ`);
      }
    }
    if (remainder) {
      const offer = parseLine(remainder);
      if (offer) {
        yield offer;
      }
    }
  } finally {
    input.destroy();
  }
}
