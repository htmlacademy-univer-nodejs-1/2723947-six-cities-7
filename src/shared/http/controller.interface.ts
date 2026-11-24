import {Request, RequestHandler, Response, Router} from 'express';

export interface Route {
  path: string;
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  handler: (request: Request, response: Response) => Promise<void>;
  middleware?: RequestHandler[];
}

export interface ControllerInterface {
  basePath: string;
  router: Router;
}
