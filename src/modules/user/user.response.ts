import {Expose, plainToInstance} from 'class-transformer';
import {Request} from 'express';
import {UserType} from '../../types.js';

type UserResponseSource = {
  _id: {toString(): string};
  name: string;
  email: string;
  type: UserType;
  avatarPath?: string;
};

export class UserResponse {
  @Expose()
  public id!: string;

  @Expose()
  public name!: string;

  @Expose()
  public email!: string;

  @Expose()
  public type!: UserType;

  @Expose()
  public avatarPath!: string;
}

export function toUserResponse(user: UserResponseSource, request: Request): UserResponse {
  const filename = !user.avatarPath || user.avatarPath === 'default-avatar.png' ? 'default-avatar.jpg' : user.avatarPath;
  return plainToInstance(UserResponse, {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    type: user.type,
    avatarPath: `${request.protocol}://${request.get('host')}/static/avatars/${encodeURIComponent(filename)}`,
  }, {excludeExtraneousValues: true});
}
