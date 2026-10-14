import 'reflect-metadata';
import {Application} from './app/application.js';
import {Component} from './shared/di/component.js';
import {container} from './shared/di/container.js';
import {Logger} from './shared/logger/logger.interface.js';

const logger = container.get<Logger>(Component.Logger);

try {
  const application = container.get<Application>(Component.Application);
  application.init();
} catch (error) {
  logger.error(error instanceof Error ? error.message : 'Не удалось инициализировать приложение');
  process.exitCode = 1;
}
