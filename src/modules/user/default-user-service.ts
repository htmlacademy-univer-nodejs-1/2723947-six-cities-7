import {randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {inject, injectable} from 'inversify';
import {Component} from '../../shared/di/component.js';
import {ServiceError} from '../../shared/errors/service-error.js';
import {CreateUserDto} from './dto/create-user.dto.js';
import {UpdateUserDto} from './dto/update-user.dto.js';
import {UserDocument, UserModel} from './user.model.js';
import {UserService} from './user-service.interface.js';

const scrypt = promisify(scryptCallback);

@injectable()
export class DefaultUserService implements UserService {
  constructor(@inject(Component.UserModel) private readonly model: UserModel) {}

  public async findById(id: string): Promise<UserDocument | null> {
    return this.model.findById(id).exec();
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({email}).exec();
  }

  public async create(user: CreateUserDto): Promise<UserDocument> {
    await this.model.init();
    const {password, name, email, avatarPath, type} = user;
    const salt = randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64) as Buffer;
    const created = await this.model.create({name, email, avatarPath, type, passwordHash: `${salt}:${hash.toString('hex')}`});
    const result = await this.findById(created.id);
    if (!result) {
      throw new ServiceError('NOT_FOUND', 'Пользователь удалён');
    }
    return result;
  }

  public async updateById(id: string, dto: UpdateUserDto): Promise<UserDocument | null> {
    const data = Object.fromEntries(['name', 'avatarPath', 'type']
      .filter((key) => dto[key as keyof UpdateUserDto] !== undefined)
      .map((key) => [key, dto[key as keyof UpdateUserDto]]));
    return this.model.findByIdAndUpdate(id, {$set: data}, {new: true}).exec();
  }

  public async verifyPassword(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.model.findOne({email}).select('+passwordHash').exec();
    if (!user) {
      return null;
    }
    const [salt, storedHash] = user.passwordHash.split(':');
    const expected = Buffer.from(storedHash, 'hex');
    const actual = await scrypt(password, salt, 64) as Buffer;
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }
    return this.findById(user.id);
  }
}
