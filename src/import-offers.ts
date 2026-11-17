import {randomBytes} from 'node:crypto';
import {inject, injectable} from 'inversify';
import {OfferService} from './modules/offer/offer-service.interface.js';
import {UserService} from './modules/user/user-service.interface.js';
import {Database} from './shared/database/database.interface.js';
import {Component} from './shared/di/component.js';
import {Logger} from './shared/logger/logger.interface.js';
import {readOffers} from './tsv-file-reader.js';

@injectable()
export class ImportOffers {
  constructor(
    @inject(Component.Database) private readonly database: Database,
    @inject(Component.UserService) private readonly users: UserService,
    @inject(Component.OfferService) private readonly offers: OfferService,
    @inject(Component.Logger) private readonly logger: Logger,
  ) {}

  public async execute(path: string, uri: string): Promise<number> {
    let count = 0;
    try {
      await this.database.connect(uri);
      for await (const {authorEmail, ...offer} of readOffers(path)) {
        let author = await this.users.findByEmail(authorEmail);
        if (!author) {
          author = await this.users.create({
            name: authorEmail.split('@')[0].slice(0, 15),
            email: authorEmail,
            password: randomBytes(6).toString('hex'),
            type: 'regular',
          });
        }
        await this.offers.create({...offer, authorId: author.id});
        count++;
      }
      this.logger.info(`Импортировано предложений: ${count}`);
      return count;
    } catch (error) {
      this.logger.error(`Импорт прерван. Сохранено предложений: ${count}`);
      throw error;
    } finally {
      await this.database.disconnect();
    }
  }
}
