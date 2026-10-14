import convict from 'convict';
import {config as loadEnv} from 'dotenv';
import {injectable} from 'inversify';
import {AppConfig, Config} from './config.interface.js';
import {configSchema} from './config.schema.js';

@injectable()
export class ConfigService implements Config {
  private readonly configuration: convict.Config<AppConfig>;

  constructor() {
    loadEnv();
    this.configuration = convict(configSchema);
    try {
      this.configuration.validate({allowed: 'strict'});
    } catch {
      throw new Error('Проверьте обязательные переменные PORT (порт), DB_HOST (IP-адрес), SALT (непустая строка).');
    }
  }

  public get<T extends keyof AppConfig>(key: T): AppConfig[T] {
    return this.configuration.get(key) as AppConfig[T];
  }
}
