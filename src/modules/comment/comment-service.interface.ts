import {Types} from 'mongoose';
import {PublicUser} from '../offer/offer-view.js';
import {CommentEntity} from './comment.entity.js';
import {CreateCommentDto} from './dto/create-comment.dto.js';

export type CommentView = Omit<CommentEntity, 'author'> & {_id: Types.ObjectId; author: PublicUser};
export interface CommentService {
  findByOfferId(offerId: string): Promise<CommentView[]>;
  create(dto: CreateCommentDto): Promise<CommentView>;
}
