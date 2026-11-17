import {Connection, Model, Schema} from 'mongoose';
import {FavoriteEntity} from './favorite.entity.js';

export type FavoriteModel = Model<FavoriteEntity>;
const schema = new Schema<FavoriteEntity>({
  user: {type: Schema.Types.ObjectId, ref: 'User', required: true},
  offer: {type: Schema.Types.ObjectId, ref: 'Offer', required: true},
}, {timestamps: true, collection: 'favorites', bufferCommands: false});
schema.index({user: 1, offer: 1}, {unique: true});
schema.index({offer: 1});

export function createFavoriteModel(connection: Connection): FavoriteModel {
  return connection.model<FavoriteEntity>('Favorite', schema);
}
