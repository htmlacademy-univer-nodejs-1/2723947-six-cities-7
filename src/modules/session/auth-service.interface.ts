import {UserDocument} from '../user/user.model.js';
import {LoginDto} from './dto/login.dto.js';

export interface AuthService {
  login(dto: LoginDto): Promise<{token: string; user: UserDocument}>;
  check(token: string): Promise<UserDocument>;
  logout(token: string): Promise<void>;
}
