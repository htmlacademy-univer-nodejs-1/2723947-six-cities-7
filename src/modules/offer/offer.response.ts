import {Expose, plainToInstance, Type} from 'class-transformer';
import {Request} from 'express';
import {Amenity, City, HousingType} from '../../types.js';
import {toUserResponse, UserResponse} from '../user/user.response.js';
import {OfferSummary, OfferView} from './offer-view.js';

export class OfferSummaryResponse {
  @Expose()
  public id!: string;

  @Expose()
  public title!: string;

  @Expose()
  public publicationDate!: Date;

  @Expose()
  public city!: City;

  @Expose()
  public previewImage!: string;

  @Expose()
  public isPremium!: boolean;

  @Expose()
  public isFavorite!: boolean;

  @Expose()
  public rating!: number;

  @Expose()
  public housingType!: HousingType;

  @Expose()
  public price!: number;

  @Expose()
  public commentsCount!: number;
}

class CoordinatesResponse {
  @Expose()
  public latitude!: number;

  @Expose()
  public longitude!: number;
}

export class OfferResponse extends OfferSummaryResponse {
  @Expose()
  public description!: string;

  @Expose()
  public images!: string[];

  @Expose()
  public bedrooms!: number;

  @Expose()
  public maxAdults!: number;

  @Expose()
  public amenities!: Amenity[];

  @Expose()
  @Type(() => CoordinatesResponse)
  public coordinates!: CoordinatesResponse;

  @Expose()
  @Type(() => UserResponse)
  public author!: UserResponse;
}

export function toOfferSummaries(offers: OfferSummary[]): OfferSummaryResponse[] {
  return plainToInstance(OfferSummaryResponse, offers.map((offer) => ({
    ...offer, id: offer._id.toString(),
  })), {excludeExtraneousValues: true});
}

export function toOfferResponse(offer: OfferView, request: Request): OfferResponse {
  return plainToInstance(OfferResponse, {
    ...offer,
    id: offer._id.toString(),
    author: toUserResponse(offer.author, request),
  }, {excludeExtraneousValues: true});
}
