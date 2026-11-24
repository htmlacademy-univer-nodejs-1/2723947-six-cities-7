import convict from 'convict';
import {AppConfig} from './config.interface.js';

export const configSchema: convict.Schema<AppConfig> = {
  PORT: {
    doc: 'Порт приложения',
    format: 'port',
    default: null,
    env: 'PORT',
  },
  MONGODB_URI: {
    doc: 'Строка подключения к MongoDB',
    format: (value: unknown): void => {
      if (typeof value !== 'string' || !/^mongodb(?:\+srv)?:\/\/\S+$/.test(value)) {
        throw new Error('Ожидается URI MongoDB');
      }
    },
    default: null,
    env: 'MONGODB_URI',
    sensitive: true,
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
