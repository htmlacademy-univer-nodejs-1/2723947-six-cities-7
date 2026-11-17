import {inject, injectable} from 'inversify';
import {Component} from '../../shared/di/component.js';
import {ServiceError} from '../../shared/errors/service-error.js';
import {OfferService} from '../offer/offer-service.interface.js';
import {OfferSummary, OfferView} from '../offer/offer-view.js';
import {UserService} from '../user/user-service.interface.js';
import {CreateFavoriteDto} from './dto/create-favorite.dto.js';
import {FavoriteModel} from './favorite.model.js';
import {FavoriteService} from './favorite-service.interface.js';

@injectable()
export class DefaultFavoriteService implements FavoriteService {
  constructor(
    @inject(Component.FavoriteModel) private readonly model: FavoriteModel,
    @inject(Component.OfferService) private readonly offers: OfferService,
    @inject(Component.UserService) private readonly users: UserService,
  ) {}

  public async findByUserId(userId: string): Promise<OfferSummary[]> {
    return this.offers.findFavorites(userId);
  }

  public async add(dto: CreateFavoriteDto): Promise<OfferView> {
    if (!await this.users.findById(dto.userId) || !await this.offers.findById(dto.offerId)) {
      throw new ServiceError('NOT_FOUND', 'Пользователь или предложение не найдены');
    }
    await this.model.init();
    const filter = {user: dto.userId, offer: dto.offerId};
    try {
      await this.model.updateOne(filter, {$setOnInsert: filter}, {upsert: true}).exec();
    } catch (error) {
      if ((error as {code?: number}).code !== 11000) {
        throw error;
      }
    }
    const offer = await this.offers.findById(dto.offerId, dto.userId);
    if (!offer) {
      await this.model.deleteOne(filter).exec();
      throw new ServiceError('NOT_FOUND', 'Предложение удалено');
    }
    return offer;
  }

  public async remove(userId: string, offerId: string): Promise<OfferView> {
    await this.model.deleteOne({user: userId, offer: offerId}).exec();
    const offer = await this.offers.findById(offerId, userId);
    if (!offer) {
      throw new ServiceError('NOT_FOUND', 'Предложение не найдено');
    }
    return offer;
  }
}
