import {Types} from 'mongoose';
import {Comment} from '../../types.js';

export type CommentEntity = Omit<Comment, 'author'> & {
  author: Types.ObjectId;
  offer: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
