import {Response, Router} from 'express';
import asyncHandler from 'express-async-handler';
import {StatusCodes} from 'http-status-codes';
import {injectable} from 'inversify';
import {ControllerInterface, Route} from './controller.interface.js';

@injectable()
export abstract class Controller implements ControllerInterface {
  public readonly router = Router();

  constructor(public readonly basePath: string) {}

  protected addRoute({method, path, handler, middleware = []}: Route): void {
    this.router[method](path, ...middleware, asyncHandler(handler.bind(this)));
  }

  protected ok(response: Response, data: unknown): void {
    response.status(StatusCodes.OK).json(data);
  }

  protected created(response: Response, data: unknown): void {
    response.status(StatusCodes.CREATED).json(data);
  }

  protected noContent(response: Response): void {
    response.status(StatusCodes.NO_CONTENT).end();
  }
}
