import 'reflect-metadata';
import {Container} from 'inversify';
import {Connection, createConnection} from 'mongoose';
import {ImportOffers} from '../../import-offers.js';
import {createUserModel, UserModel} from '../../modules/user/user.model.js';
import {DefaultUserService} from '../../modules/user/default-user-service.js';
import {UserService} from '../../modules/user/user-service.interface.js';
import {createOfferModel, OfferModel} from '../../modules/offer/offer.model.js';
import {DefaultOfferService} from '../../modules/offer/default-offer-service.js';
import {OfferService} from '../../modules/offer/offer-service.interface.js';
import {createCommentModel, CommentModel} from '../../modules/comment/comment.model.js';
import {CommentService} from '../../modules/comment/comment-service.interface.js';
import {DefaultCommentService} from '../../modules/comment/default-comment-service.js';
import {createFavoriteModel, FavoriteModel} from '../../modules/favorite/favorite.model.js';
import {FavoriteService} from '../../modules/favorite/favorite-service.interface.js';
import {DefaultFavoriteService} from '../../modules/favorite/default-favorite-service.js';
import {createSessionModel, SessionModel} from '../../modules/session/session.model.js';
import {AuthService} from '../../modules/session/auth-service.interface.js';
import {DefaultAuthService} from '../../modules/session/default-auth-service.js';
import {Database} from '../database/database.interface.js';
import {MongoDatabase} from '../database/mongo-database.js';
import {Application} from '../../app/application.js';
import {Config} from '../config/config.interface.js';
import {ConfigService} from '../config/config-service.js';
import {Logger} from '../logger/logger.interface.js';
import {PinoLogger} from '../logger/pino-logger.js';
import {Component} from './component.js';

export const container = new Container();
container.bind<Logger>(Component.Logger).to(PinoLogger).inSingletonScope();
container.bind<Config>(Component.Config).to(ConfigService).inSingletonScope();
container.bind<Application>(Component.Application).to(Application).inSingletonScope();
container.bind<Connection>(Component.MongoConnection).toConstantValue(createConnection());
container.bind<Database>(Component.Database).to(MongoDatabase).inSingletonScope();
container.bind<UserModel>(Component.UserModel).toDynamicValue(() =>
  createUserModel(container.get<Connection>(Component.MongoConnection))).inSingletonScope();
container.bind<OfferModel>(Component.OfferModel).toDynamicValue(() =>
  createOfferModel(container.get<Connection>(Component.MongoConnection))).inSingletonScope();
container.bind<UserService>(Component.UserService).to(DefaultUserService).inSingletonScope();
container.bind<OfferService>(Component.OfferService).to(DefaultOfferService).inSingletonScope();
container.bind<CommentModel>(Component.CommentModel).toDynamicValue(() =>
  createCommentModel(container.get<Connection>(Component.MongoConnection))).inSingletonScope();
container.bind<FavoriteModel>(Component.FavoriteModel).toDynamicValue(() =>
  createFavoriteModel(container.get<Connection>(Component.MongoConnection))).inSingletonScope();
container.bind<SessionModel>(Component.SessionModel).toDynamicValue(() =>
  createSessionModel(container.get<Connection>(Component.MongoConnection))).inSingletonScope();
container.bind<CommentService>(Component.CommentService).to(DefaultCommentService).inSingletonScope();
container.bind<FavoriteService>(Component.FavoriteService).to(DefaultFavoriteService).inSingletonScope();
container.bind<AuthService>(Component.AuthService).to(DefaultAuthService).inSingletonScope();
container.bind<ImportOffers>(Component.ImportOffers).to(ImportOffers).inSingletonScope();
