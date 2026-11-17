import {User} from '../../types.js';

export type UserEntity = Omit<User, 'password'> & {
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};
