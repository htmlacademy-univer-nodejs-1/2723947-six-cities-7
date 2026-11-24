import {randomUUID} from 'node:crypto';
import {mkdir, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Request, Response} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import multer from 'multer';
import {Component} from '../../shared/di/component.js';
import {Controller} from '../../shared/http/controller.js';
import {HttpError} from '../../shared/http/http-error.js';
import {RequestAuth} from '../../shared/http/request-auth.js';
import {AuthService} from '../session/auth-service.interface.js';
import {LoginDto} from '../session/dto/login.dto.js';
import {CreateUserDto} from './dto/create-user.dto.js';
import {UserService} from './user-service.interface.js';
import {toUserResponse, UserResponse} from './user.response.js';

export const AVATAR_DIRECTORY = 'uploads/avatars';

type RegistrationBody = Omit<CreateUserDto, 'avatarPath'>;
type SessionResponse = {token: string; user: UserResponse};

const upload = multer({
  limits: {fileSize: 5 * 1024 * 1024, files: 1, fields: 4},
  fileFilter: (_request, file, callback) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      callback(null, true);
      return;
    }
    callback(new HttpError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Для аватара разрешены JPG и PNG'));
  },
}).single('avatar');

@injectable()
export class UserController extends Controller {
  constructor(
    @inject(Component.UserService) private readonly users: UserService,
    @inject(Component.AuthService) private readonly auth: AuthService,
    @inject(Component.RequestAuth) private readonly requestAuth: RequestAuth,
  ) {
    super('/users');
    this.addRoute({path: '/', method: 'post', middleware: [upload], handler: this.register});
    this.addRoute({path: '/login', method: 'post', handler: this.login});
    this.addRoute({path: '/login', method: 'get', handler: this.check});
    this.addRoute({path: '/login', method: 'delete', handler: this.logout});
  }

  private async register(request: Request, response: Response): Promise<void> {
    if (await this.requestAuth.optionalUser(request)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'Регистрация доступна только анонимным клиентам');
    }
    if (!request.is('multipart/form-data')) {
      throw new HttpError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Ожидается multipart/form-data');
    }
    const {name, email, type, password} = (request.body ?? {}) as RegistrationBody;
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Укажите email и пароль');
    }

    let avatarPath: string | undefined;
    if (request.file) {
      const extension = request.file.mimetype === 'image/png' ? 'png' : 'jpg';
      avatarPath = `${randomUUID()}.${extension}`;
      await mkdir(AVATAR_DIRECTORY, {recursive: true});
      await writeFile(join(AVATAR_DIRECTORY, avatarPath), request.file.buffer, {flag: 'wx'});
    }
    const dto: CreateUserDto = {name, email, type, password, avatarPath};
    const user = await this.users.create(dto).catch(async (error: unknown) => {
      if (avatarPath) {
        await unlink(join(AVATAR_DIRECTORY, avatarPath));
      }
      throw error;
    });
    this.created(response, toUserResponse(user, request));
  }

  private async login(request: Request, response: Response): Promise<void> {
    const {email, password} = (request.body ?? {}) as LoginDto;
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Укажите email и пароль');
    }
    const result = await this.auth.login({email, password});
    const body: SessionResponse = {token: result.token, user: toUserResponse(result.user, request)};
    this.ok(response, body);
  }

  private async check(request: Request, response: Response): Promise<void> {
    this.ok(response, toUserResponse(await this.requestAuth.requireUser(request), request));
  }

  private async logout(request: Request, response: Response): Promise<void> {
    await this.auth.logout(this.requestAuth.token(request));
    this.noContent(response);
  }
}
