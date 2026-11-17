import {CreateUserDto} from './dto/create-user.dto.js';
import {UpdateUserDto} from './dto/update-user.dto.js';
import {UserDocument} from './user.model.js';

export interface UserService {
  findById(id: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
  create(user: CreateUserDto): Promise<UserDocument>;
  updateById(id: string, dto: UpdateUserDto): Promise<UserDocument | null>;
  verifyPassword(email: string, password: string): Promise<UserDocument | null>;
}
