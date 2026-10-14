import {inject, injectable} from 'inversify';
import {Config} from '../shared/config/config.interface.js';
import {Component} from '../shared/di/component.js';
import {Logger} from '../shared/logger/logger.interface.js';

@injectable()
export class Application {
  constructor(
    @inject(Component.Logger) private readonly logger: Logger,
    @inject(Component.Config) private readonly config: Config,
  ) {
    this.logger.info(`Порт приложения: ${this.config.get('PORT')}`);
  }

  public init(): void {
    this.logger.info('Приложение инициализировано');
  }
}
