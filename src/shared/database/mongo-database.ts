import {inject, injectable} from 'inversify';
import type {Connection} from 'mongoose';
import {Component} from '../di/component.js';
import {Logger} from '../logger/logger.interface.js';
import {Database} from './database.interface.js';

@injectable()
export class MongoDatabase implements Database {
  constructor(
    @inject(Component.MongoConnection) private readonly connection: Connection,
    @inject(Component.Logger) private readonly logger: Logger,
  ) {}

  public async connect(uri: string): Promise<void> {
    this.logger.info('Подключение к MongoDB');
    try {
      await this.connection.openUri(uri, {serverSelectionTimeoutMS: 5000});
      this.logger.info('Соединение с MongoDB установлено');
    } catch {
      this.logger.error('Не удалось подключиться к MongoDB');
      throw new Error('Не удалось подключиться к MongoDB. Проверьте URI, учётные данные и доступность сервера.');
    }
  }

  public async disconnect(): Promise<void> {
    await this.connection.close();
    this.logger.info('Соединение с MongoDB закрыто');
  }
}
