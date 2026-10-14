export type AppConfig = {
  PORT: number;
  DB_HOST: string;
  SALT: string;
};

export interface Config {
  get<T extends keyof AppConfig>(key: T): AppConfig[T];
}
