import {createHash, randomBytes} from 'node:crypto';
import {inject, injectable} from 'inversify';
import {Component} from '../../shared/di/component.js';
import {ServiceError} from '../../shared/errors/service-error.js';
import {UserService} from '../user/user-service.interface.js';
import {UserDocument} from '../user/user.model.js';
import {AuthService} from './auth-service.interface.js';
import {LoginDto} from './dto/login.dto.js';
import {SessionModel} from './session.model.js';

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@injectable()
export class DefaultAuthService implements AuthService {
  constructor(
    @inject(Component.SessionModel) private readonly model: SessionModel,
    @inject(Component.UserService) private readonly users: UserService,
  ) {}

  public async login(dto: LoginDto): Promise<{token: string; user: UserDocument}> {
    const user = await this.users.verifyPassword(dto.email, dto.password);
    if (!user) {
      throw new ServiceError('UNAUTHORIZED', 'Неверный email или пароль');
    }
    const token = randomBytes(32).toString('hex');
    await this.model.create({user: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS)});
    return {token, user};
  }

  public async check(token: string): Promise<UserDocument> {
    const session = await this.model.findOne({tokenHash: hashToken(token), expiresAt: {$gt: new Date()}}).exec();
    const user = session ? await this.users.findById(session.user.toString()) : null;
    if (!user) {
      throw new ServiceError('UNAUTHORIZED', 'Сеанс недействителен');
    }
    return user;
  }

  public async logout(token: string): Promise<void> {
    const session = await this.model.findOneAndDelete({tokenHash: hashToken(token), expiresAt: {$gt: new Date()}}).exec();
    if (!session) {
      throw new ServiceError('UNAUTHORIZED', 'Сеанс недействителен');
    }
  }
}
