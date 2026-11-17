import {CreateOfferDto} from './create-offer.dto.js';

export type UpdateOfferDto = Partial<Omit<CreateOfferDto, 'authorId'>>;
