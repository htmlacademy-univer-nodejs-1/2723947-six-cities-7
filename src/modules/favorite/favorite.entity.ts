import {Types} from 'mongoose';

export type FavoriteEntity = {
  user: Types.ObjectId;
  offer: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
