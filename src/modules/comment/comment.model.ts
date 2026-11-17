import {Connection, Model, Schema} from 'mongoose';
import {CommentEntity} from './comment.entity.js';

export type CommentModel = Model<CommentEntity>;
const schema = new Schema<CommentEntity>({
  text: {type: String, required: true},
  rating: {type: Number, required: true},
  publicationDate: {type: Date, default: Date.now},
  author: {type: Schema.Types.ObjectId, ref: 'User', required: true},
  offer: {type: Schema.Types.ObjectId, ref: 'Offer', required: true},
}, {timestamps: true, collection: 'comments', bufferCommands: false});
schema.index({offer: 1, publicationDate: -1, _id: -1});

export function createCommentModel(connection: Connection): CommentModel {
  return connection.model<CommentEntity>('Comment', schema);
}
