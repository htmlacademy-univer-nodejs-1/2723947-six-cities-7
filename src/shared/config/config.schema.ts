import convict from 'convict';
import validatorFormats from 'convict-format-with-validator';
import {AppConfig} from './config.interface.js';

convict.addFormats(validatorFormats);

export const configSchema: convict.Schema<AppConfig> = {
  PORT: {
    doc: 'Порт приложения',
    format: 'port',
    default: null,
    env: 'PORT',
  },
  DB_HOST: {
    doc: 'IP-адрес сервера базы данных',
    format: 'ipaddress',
    default: null,
    env: 'DB_HOST',
  },
  SALT: {
    doc: 'Соль для хеширования паролей',
    format: (value: unknown): void => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('SALT должна быть непустой строкой');
      }
    },
    default: null,
    env: 'SALT',
    sensitive: true,
  },
};
