import {Types} from 'mongoose';

export type SessionEntity = {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
