export type AppConfig = {
  PORT: number;
  MONGODB_URI: string;
  SALT: string;
};

export interface Config {
  get<T extends keyof AppConfig>(key: T): AppConfig[T];
}
