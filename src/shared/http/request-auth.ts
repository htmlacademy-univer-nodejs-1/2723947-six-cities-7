import {Request} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {AuthService} from '../../modules/session/auth-service.interface.js';
import {UserDocument} from '../../modules/user/user.model.js';
import {Component} from '../di/component.js';
import {HttpError} from './http-error.js';

@injectable()
export class RequestAuth {
  constructor(@inject(Component.AuthService) private readonly auth: AuthService) {}

  public token(request: Request): string {
    const token = /^Bearer ([^\s,]+)$/i.exec(request.get('Authorization') ?? '')?.[1];
    if (!token) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Требуется действующий Bearer-токен');
    }
    return token;
  }

  public async requireUser(request: Request): Promise<UserDocument> {
    return this.auth.check(this.token(request));
  }

  public async optionalUser(request: Request): Promise<UserDocument | undefined> {
    if (request.get('Authorization') !== undefined) {
      return this.requireUser(request);
    }
    return undefined;
  }
}
