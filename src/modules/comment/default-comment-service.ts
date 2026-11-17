import {inject, injectable} from 'inversify';
import {Component} from '../../shared/di/component.js';
import {ServiceError} from '../../shared/errors/service-error.js';
import {OfferModel} from '../offer/offer.model.js';
import {PUBLIC_USER_FIELDS} from '../offer/default-offer-service.js';
import {PublicUser} from '../offer/offer-view.js';
import {UserService} from '../user/user-service.interface.js';
import {CommentService, CommentView} from './comment-service.interface.js';
import {CommentModel} from './comment.model.js';
import {CreateCommentDto} from './dto/create-comment.dto.js';

@injectable()
export class DefaultCommentService implements CommentService {
  constructor(
    @inject(Component.CommentModel) private readonly model: CommentModel,
    @inject(Component.OfferModel) private readonly offers: OfferModel,
    @inject(Component.UserService) private readonly users: UserService,
  ) {}

  public async findByOfferId(offerId: string): Promise<CommentView[]> {
    if (!await this.offers.exists({_id: offerId})) {
      throw new ServiceError('NOT_FOUND', 'Предложение не найдено');
    }
    return this.model.find({offer: offerId}).sort({publicationDate: -1, _id: -1}).limit(50)
      .populate<{author: PublicUser}>({path: 'author', select: PUBLIC_USER_FIELDS}).lean().exec();
  }

  public async create(dto: CreateCommentDto): Promise<CommentView> {
    if (!await this.offers.exists({_id: dto.offerId}) || !await this.users.findById(dto.authorId)) {
      throw new ServiceError('NOT_FOUND', 'Предложение или автор не найдены');
    }
    const comment = await this.model.create({text: dto.text, rating: dto.rating, author: dto.authorId, offer: dto.offerId});
    try {
      const offer = await this.offers.findByIdAndUpdate(dto.offerId, [
        {$set: {
          commentsCount: {$add: [{$ifNull: ['$commentsCount', 0]}, 1]},
          ratingSum: {$add: [{$ifNull: ['$ratingSum', 0]}, dto.rating]},
        }},
        {$set: {rating: {$divide: [{$floor: {$add: [{$divide: [{$multiply: ['$ratingSum', 10]}, '$commentsCount']}, 0.5]}}, 10]}}},
      ]).exec();
      if (!offer) {
        throw new ServiceError('NOT_FOUND', 'Предложение удалено');
      }
    } catch (error) {
      await this.model.deleteOne({_id: comment._id}).exec();
      throw error;
    }
    const result = await this.model.findById(comment._id)
      .populate<{author: PublicUser}>({path: 'author', select: PUBLIC_USER_FIELDS}).lean().exec();
    if (!result) {
      throw new ServiceError('NOT_FOUND', 'Предложение удалено');
    }
    return result;
  }
}
