import {Request, Response} from 'express';
import {inject, injectable} from 'inversify';
import {Component} from '../../shared/di/component.js';
import {Controller} from '../../shared/http/controller.js';
import {RequestAuth} from '../../shared/http/request-auth.js';
import {toOfferResponse, toOfferSummaries} from '../offer/offer.response.js';
import {FavoriteService} from './favorite-service.interface.js';

@injectable()
export class FavoriteController extends Controller {
  constructor(
    @inject(Component.FavoriteService) private readonly favorites: FavoriteService,
    @inject(Component.RequestAuth) private readonly auth: RequestAuth,
  ) {
    super('/offers');
    this.addRoute({path: '/favorites', method: 'get', handler: this.list});
    this.addRoute({path: '/:offerId/favorite', method: 'put', handler: this.add});
    this.addRoute({path: '/:offerId/favorite', method: 'delete', handler: this.remove});
  }

  private async list(request: Request, response: Response): Promise<void> {
    const user = await this.auth.requireUser(request);
    this.ok(response, toOfferSummaries(await this.favorites.findByUserId(user.id)));
  }

  private async add(request: Request, response: Response): Promise<void> {
    const user = await this.auth.requireUser(request);
    const offer = await this.favorites.add({userId: user.id, offerId: request.params.offerId});
    this.ok(response, toOfferResponse(offer, request));
  }

  private async remove(request: Request, response: Response): Promise<void> {
    const user = await this.auth.requireUser(request);
    const offer = await this.favorites.remove(user.id, request.params.offerId);
    this.ok(response, toOfferResponse(offer, request));
  }
}
