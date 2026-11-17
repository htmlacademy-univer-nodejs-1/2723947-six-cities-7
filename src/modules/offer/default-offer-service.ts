import {inject, injectable} from 'inversify';
import {FilterQuery, Types} from 'mongoose';
import {Component} from '../../shared/di/component.js';
import {ServiceError} from '../../shared/errors/service-error.js';
import {City} from '../../types.js';
import {CommentModel} from '../comment/comment.model.js';
import {FavoriteModel} from '../favorite/favorite.model.js';
import {UserService} from '../user/user-service.interface.js';
import {CreateOfferDto} from './dto/create-offer.dto.js';
import {UpdateOfferDto} from './dto/update-offer.dto.js';
import {OfferEntity} from './offer.entity.js';
import {OfferModel} from './offer.model.js';
import {OfferSummary, OfferView, PublicUser} from './offer-view.js';
import {OfferService} from './offer-service.interface.js';

const EDITABLE_FIELDS = ['title', 'description', 'publicationDate', 'city', 'previewImage',
  'images', 'isPremium', 'housingType', 'bedrooms', 'maxAdults', 'price', 'amenities', 'coordinates'] as const;
const SUMMARY_FIELDS = '_id title price housingType publicationDate city previewImage isPremium rating commentsCount';
export const PUBLIC_USER_FIELDS = '_id name email avatarPath type';

function editableData(dto: UpdateOfferDto): UpdateOfferDto {
  return Object.fromEntries(EDITABLE_FIELDS.filter((key) => dto[key] !== undefined).map((key) => [key, dto[key]]));
}

@injectable()
export class DefaultOfferService implements OfferService {
  constructor(
    @inject(Component.OfferModel) private readonly model: OfferModel,
    @inject(Component.CommentModel) private readonly comments: CommentModel,
    @inject(Component.FavoriteModel) private readonly favorites: FavoriteModel,
    @inject(Component.UserService) private readonly users: UserService,
  ) {}

  private async favoriteIds(userId: string | undefined, ids: Types.ObjectId[]): Promise<Set<string>> {
    if (!userId || ids.length === 0) {
      return new Set();
    }
    const favorites = await this.favorites.find({user: userId, offer: {$in: ids}}).select('offer').lean().exec();
    return new Set(favorites.map((item) => item.offer.toString()));
  }

  private async list(filter: FilterQuery<OfferEntity>, userId?: string, limit?: number): Promise<OfferSummary[]> {
    const query = this.model.find(filter).select(SUMMARY_FIELDS).sort({publicationDate: -1, _id: -1});
    if (limit !== undefined) {
      query.limit(limit);
    }
    const offers = await query.lean().exec();
    const favorites = await this.favoriteIds(userId, offers.map((offer) => offer._id));
    return offers.map((offer) => ({...offer, isFavorite: favorites.has(offer._id.toString())}));
  }

  public async findById(id: string, userId?: string): Promise<OfferView | null> {
    const offer = await this.model.findById(id).populate<{author: PublicUser}>({path: 'author', select: PUBLIC_USER_FIELDS}).lean().exec();
    if (!offer) {
      return null;
    }
    const favorites = await this.favoriteIds(userId, [offer._id]);
    return {...offer, isFavorite: favorites.has(offer._id.toString())};
  }

  public async find(limit = 60, userId?: string): Promise<OfferSummary[]> {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error('Количество предложений должно быть положительным целым числом');
    }
    return this.list({}, userId, limit);
  }

  public async findPremium(city: City, userId?: string): Promise<OfferSummary[]> {
    return this.list({city, isPremium: true}, userId, 3);
  }

  public async findFavorites(userId: string): Promise<OfferSummary[]> {
    const favorites = await this.favorites.find({user: userId}).select('offer').lean().exec();
    return this.list({_id: {$in: favorites.map((item) => item.offer)}}, userId);
  }

  public async create(dto: CreateOfferDto): Promise<OfferView> {
    if (!await this.users.findById(dto.authorId)) {
      throw new ServiceError('NOT_FOUND', 'Автор не найден');
    }
    const created = await this.model.create({...editableData(dto), author: dto.authorId});
    const result = await this.findById(created.id);
    if (!result) {
      throw new ServiceError('NOT_FOUND', 'Предложение удалено');
    }
    return result;
  }

  private async checkOwner(id: string, authorId: string): Promise<boolean> {
    const offer = await this.model.findById(id).select('author').lean().exec();
    if (!offer) {
      return false;
    }
    if (offer.author.toString() !== authorId) {
      throw new ServiceError('FORBIDDEN', 'Изменять и удалять предложение может только автор');
    }
    return true;
  }

  public async updateById(id: string, dto: UpdateOfferDto, authorId: string): Promise<OfferView | null> {
    if (!await this.checkOwner(id, authorId)) {
      return null;
    }
    const updated = await this.model.findOneAndUpdate({_id: id, author: authorId}, {$set: editableData(dto)}, {new: true}).exec();
    return updated ? this.findById(id, authorId) : null;
  }

  public async deleteById(id: string, authorId: string): Promise<boolean> {
    if (!await this.checkOwner(id, authorId)) {
      return false;
    }
    const result = await this.model.deleteOne({_id: id, author: authorId}).exec();
    if (!result.deletedCount) {
      return false;
    }
    await this.comments.deleteMany({offer: id}).exec();
    await this.favorites.deleteMany({offer: id}).exec();
    return true;
  }
}
