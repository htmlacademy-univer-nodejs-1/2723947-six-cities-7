import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import axios from 'axios';
import {AMENITIES, HOUSING_TYPES} from './types.js';
import type {ImportedOffer, OfferTemplate} from './types.js';
import {parseOffer} from './tsv-file-reader.js';
import {COLUMNS, serializeOffer} from './tsv.js';
import {randomInteger, randomItem, randomItems} from './random.js';

function generateOffer(template: OfferTemplate): ImportedOffer {
  return {
    ...template,
    publicationDate: new Date(Date.now() - randomInteger(0, 30 * 24 * 60 * 60 * 1000)),
    isPremium: randomInteger(0, 1) === 1,
    isFavorite: false,
    rating: randomInteger(10, 50) / 10,
    housingType: randomItem(HOUSING_TYPES),
    bedrooms: randomInteger(1, 8),
    maxAdults: randomInteger(1, 10),
    price: randomInteger(100, 100000),
    amenities: randomItems(AMENITIES),
  };
}

async function loadTemplates(url: string): Promise<OfferTemplate[]> {
  const address = new URL(url);
  if (!['http:', 'https:'].includes(address.protocol)) {
    throw new Error('Адрес JSON-сервера должен использовать HTTP или HTTPS');
  }
  const {data} = await axios.get<OfferTemplate[]>(address.href, {
    timeout: 10000,
    maxContentLength: 5 * 1024 * 1024,
  });
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('JSON-сервер должен вернуть непустой массив заготовок предложений');
  }
  for (const template of data) {
    try {
      // Validate remote data before opening the output file.
      const offer = generateOffer(template);
      if ([offer.title, offer.description, offer.previewImage, offer.authorEmail,
        ...offer.images].some((value) => typeof value !== 'string' || /[\t\r\n;]/.test(value))) {
        throw new Error('Недопустимые разделители TSV');
      }
      parseOffer(serializeOffer(offer));
    } catch {
      throw new Error('JSON-сервер вернул некорректную заготовку предложения');
    }
  }
  return data;
}

export async function generateOffers(count: number, path: string, url: string): Promise<void> {
  const templates = await loadTemplates(url);
  function* lines(): Generator<string> {
    yield `${COLUMNS.join('\t')}\n`;
    for (let index = 0; index < count; index++) {
      yield `${serializeOffer(generateOffer(randomItem(templates)))}\n`;
    }
  }
  await pipeline(Readable.from(lines()), createWriteStream(path, {flags: 'wx'}));
}
