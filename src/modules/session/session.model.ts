import {Connection, Model, Schema} from 'mongoose';
import {SessionEntity} from './session.entity.js';

export type SessionModel = Model<SessionEntity>;
const schema = new Schema<SessionEntity>({
  user: {type: Schema.Types.ObjectId, ref: 'User', required: true},
  tokenHash: {type: String, required: true, unique: true, select: false},
  expiresAt: {type: Date, required: true},
}, {timestamps: true, collection: 'sessions', bufferCommands: false});
schema.index({expiresAt: 1}, {expireAfterSeconds: 0});

export function createSessionModel(connection: Connection): SessionModel {
  return connection.model<SessionEntity>('Session', schema);
}
