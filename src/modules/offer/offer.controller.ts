import {Request, Response} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {Component} from '../../shared/di/component.js';
import {Controller} from '../../shared/http/controller.js';
import {HttpError} from '../../shared/http/http-error.js';
import {RequestAuth} from '../../shared/http/request-auth.js';
import {City} from '../../types.js';
import {CreateOfferDto} from './dto/create-offer.dto.js';
import {UpdateOfferDto} from './dto/update-offer.dto.js';
import {OfferService} from './offer-service.interface.js';
import {toOfferResponse, toOfferSummaries} from './offer.response.js';

type CreateOfferBody = Omit<CreateOfferDto, 'authorId'>;

@injectable()
export class OfferController extends Controller {
  constructor(
    @inject(Component.OfferService) private readonly offers: OfferService,
    @inject(Component.RequestAuth) private readonly auth: RequestAuth,
  ) {
    super('/offers');
    this.addRoute({path: '/', method: 'get', handler: this.list});
    this.addRoute({path: '/', method: 'post', handler: this.create});
    this.addRoute({path: '/premium', method: 'get', handler: this.premium});
    this.addRoute({path: '/:offerId', method: 'get', handler: this.details});
    this.addRoute({path: '/:offerId', method: 'patch', handler: this.update});
    this.addRoute({path: '/:offerId', method: 'delete', handler: this.remove});
  }

  private async list(request: Request, response: Response): Promise<void> {
    const user = await this.auth.optionalUser(request);
    const input = request.query.limit;
    const limit = typeof input === 'string' ? Number(input) : undefined;
    if (input !== undefined && (limit === undefined || !Number.isSafeInteger(limit) || limit < 1)) {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Количество предложений должно быть положительным целым числом');
    }
    this.ok(response, toOfferSummaries(await this.offers.find(limit, user?.id)));
  }

  private async premium(request: Request, response: Response): Promise<void> {
    const user = await this.auth.optionalUser(request);
    const {city} = request.query;
    if (typeof city !== 'string') {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Укажите город');
    }
    this.ok(response, toOfferSummaries(await this.offers.findPremium(city as City, user?.id)));
  }

  private async details(request: Request, response: Response): Promise<void> {
    const user = await this.auth.optionalUser(request);
    const offer = await this.offers.findById(request.params.offerId, user?.id);
    if (!offer) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Предложение не найдено');
    }
    this.ok(response, toOfferResponse(offer, request));
  }

  private async create(request: Request, response: Response): Promise<void> {
    const user = await this.auth.requireUser(request);
    const body = request.body as CreateOfferBody;
    const offer = await this.offers.create({...body, authorId: user.id});
    this.created(response, toOfferResponse(offer, request));
  }

  private async update(request: Request, response: Response): Promise<void> {
    const user = await this.auth.requireUser(request);
    const dto = request.body as UpdateOfferDto;
    const offer = await this.offers.updateById(request.params.offerId, dto, user.id);
    if (!offer) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Предложение не найдено');
    }
    this.ok(response, toOfferResponse(offer, request));
  }

  private async remove(request: Request, response: Response): Promise<void> {
    const user = await this.auth.requireUser(request);
    if (!await this.offers.deleteById(request.params.offerId, user.id)) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Предложение не найдено');
    }
    this.noContent(response);
  }
}
