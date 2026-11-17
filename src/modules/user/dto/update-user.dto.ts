import {User} from '../../../types.js';

export type UpdateUserDto = Partial<Pick<User, 'name' | 'avatarPath' | 'type'>>;
