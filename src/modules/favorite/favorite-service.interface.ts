import {OfferSummary, OfferView} from '../offer/offer-view.js';
import {CreateFavoriteDto} from './dto/create-favorite.dto.js';

export interface FavoriteService {
  findByUserId(userId: string): Promise<OfferSummary[]>;
  add(dto: CreateFavoriteDto): Promise<OfferView>;
  remove(userId: string, offerId: string): Promise<OfferView>;
}
