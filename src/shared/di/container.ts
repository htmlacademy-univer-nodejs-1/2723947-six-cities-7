import 'reflect-metadata';
import {Container} from 'inversify';
import {Application} from '../../app/application.js';
import {Config} from '../config/config.interface.js';
import {ConfigService} from '../config/config-service.js';
import {Logger} from '../logger/logger.interface.js';
import {PinoLogger} from '../logger/pino-logger.js';
import {Component} from './component.js';

export const container = new Container();
container.bind<Logger>(Component.Logger).to(PinoLogger).inSingletonScope();
container.bind<Config>(Component.Config).to(ConfigService).inSingletonScope();
container.bind<Application>(Component.Application).to(Application).inSingletonScope();
