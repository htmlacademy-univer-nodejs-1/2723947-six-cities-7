export class ServiceError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'UNAUTHORIZED', message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}
