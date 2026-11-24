import {ErrorRequestHandler} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {MulterError} from 'multer';
import {Component} from '../di/component.js';
import {ServiceError} from '../errors/service-error.js';
import {Logger} from '../logger/logger.interface.js';
import {HttpError} from './http-error.js';

const SERVICE_STATUS = {
  NOT_FOUND: StatusCodes.NOT_FOUND,
  FORBIDDEN: StatusCodes.FORBIDDEN,
  UNAUTHORIZED: StatusCodes.UNAUTHORIZED,
};

function clientError(error: unknown): HttpError | undefined {
  if (error instanceof HttpError && error.status < 500) {
    return error;
  }
  if (error instanceof ServiceError) {
    return new HttpError(SERVICE_STATUS[error.code], error.message);
  }
  if (error instanceof MulterError) {
    return new HttpError(StatusCodes.BAD_REQUEST, 'Не удалось загрузить аватар');
  }
  if (error instanceof Error) {
    const cause = error as Error & {code?: number; status?: number};
    if (cause.code === 11000) {
      return new HttpError(StatusCodes.CONFLICT, 'Пользователь с таким email уже существует');
    }
    if (error.name === 'CastError' || error.name === 'ValidationError') {
      return new HttpError(StatusCodes.BAD_REQUEST, 'Некорректные данные запроса');
    }
    if (cause.status && cause.status >= 400 && cause.status < 500) {
      return new HttpError(cause.status, 'Не удалось обработать запрос');
    }
  }
  return undefined;
}

@injectable()
export class ExceptionFilter {
  constructor(@inject(Component.Logger) private readonly logger: Logger) {}

  public readonly handle: ErrorRequestHandler = (error: unknown, request, response, next): void => {
    const failure = clientError(error);
    const status = failure?.status ?? StatusCodes.INTERNAL_SERVER_ERROR;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const log = `${request.method} ${status}: ${errorName}`;
    if (failure) {
      this.logger.warn(log);
    } else {
      this.logger.error(log);
    }
    if (response.headersSent) {
      next(error);
      return;
    }
    if (status === StatusCodes.UNAUTHORIZED) {
      response.set('WWW-Authenticate', 'Bearer');
    }
    response.status(status).json({message: failure?.message ?? 'Внутренняя ошибка сервера'});
  };
}
