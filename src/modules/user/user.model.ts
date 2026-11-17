import {Connection, HydratedDocument, Model, Schema} from 'mongoose';
import {UserEntity} from './user.entity.js';

export type UserRecord = UserEntity;

export type UserDocument = HydratedDocument<UserRecord>;
export type UserModel = Model<UserRecord>;

const userSchema = new Schema<UserRecord>({
  name: {type: String, required: true},
  email: {type: String, required: true, unique: true},
  avatarPath: {type: String, default: 'default-avatar.png'},
  passwordHash: {type: String, required: true, select: false},
  type: {type: String, enum: ['regular', 'pro'], required: true},
}, {timestamps: true, collection: 'users', bufferCommands: false});

export function createUserModel(connection: Connection): UserModel {
  return connection.model<UserRecord>('User', userSchema);
}
