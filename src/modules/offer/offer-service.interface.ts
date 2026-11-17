import {City} from '../../types.js';
import {CreateOfferDto} from './dto/create-offer.dto.js';
import {UpdateOfferDto} from './dto/update-offer.dto.js';
import {OfferSummary, OfferView} from './offer-view.js';

export interface OfferService {
  findById(id: string, userId?: string): Promise<OfferView | null>;
  find(limit?: number, userId?: string): Promise<OfferSummary[]>;
  findPremium(city: City, userId?: string): Promise<OfferSummary[]>;
  findFavorites(userId: string): Promise<OfferSummary[]>;
  create(dto: CreateOfferDto): Promise<OfferView>;
  updateById(id: string, dto: UpdateOfferDto, authorId: string): Promise<OfferView | null>;
  deleteById(id: string, authorId: string): Promise<boolean>;
}
