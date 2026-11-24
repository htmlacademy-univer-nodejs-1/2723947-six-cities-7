import type {Server} from 'node:http';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {AVATAR_DIRECTORY} from '../modules/user/user.controller.js';
import {Config} from '../shared/config/config.interface.js';
import {Database} from '../shared/database/database.interface.js';
import {Component} from '../shared/di/component.js';
import {ControllerInterface} from '../shared/http/controller.interface.js';
import {ExceptionFilter} from '../shared/http/exception-filter.js';
import {HttpError} from '../shared/http/http-error.js';
import {Logger} from '../shared/logger/logger.interface.js';

const defaultAvatar = fileURLToPath(new URL('../../markup/img/avatar-max.jpg', import.meta.url));

@injectable()
export class Application {
  private readonly app = express();
  private server?: Server;

  constructor(
    @inject(Component.Logger) private readonly logger: Logger,
    @inject(Component.Config) private readonly config: Config,
    @inject(Component.Database) private readonly database: Database,
    @inject(Component.UserController) private readonly users: ControllerInterface,
    @inject(Component.FavoriteController) private readonly favorites: ControllerInterface,
    @inject(Component.OfferController) private readonly offers: ControllerInterface,
    @inject(Component.ExceptionFilter) private readonly exceptions: ExceptionFilter,
  ) {}

  private registerMiddleware(): void {
    this.app.disable('x-powered-by');
    this.app.use(express.json());
    this.app.get('/static/avatars/default-avatar.jpg', (_request, response) => {
      response.sendFile(defaultAvatar);
    });
    this.app.use('/static/avatars', express.static(AVATAR_DIRECTORY));
  }

  public async init(): Promise<void> {
    this.registerMiddleware();
    for (const controller of [this.users, this.favorites, this.offers]) {
      this.app.use(controller.basePath, controller.router);
    }
    this.app.use((_request, _response, next) => next(new HttpError(StatusCodes.NOT_FOUND, 'Маршрут не найден')));
    this.app.use(this.exceptions.handle);

    try {
      await this.database.connect(this.config.get('MONGODB_URI'));
      const port = await new Promise<number>((resolve, reject) => {
        const server = this.app.listen(this.config.get('PORT'), () => {
          server.removeListener('error', reject);
          this.server = server;
          const address = server.address();
          resolve(typeof address === 'object' && address ? address.port : this.config.get('PORT'));
        });
        server.once('error', reject);
      });
      this.logger.info(`Порт приложения: ${port}`);
      this.logger.info('Приложение инициализировано');
    } catch (error) {
      await this.database.disconnect();
      throw error;
    }
  }

  public async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) {
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeIdleConnections?.();
      });
    } finally {
      await this.database.disconnect();
    }
  }
}
