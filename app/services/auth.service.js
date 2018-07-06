import crypto from 'crypto';

export default class AuthService {
    attemp(username, password) {
        if (username == process.env.USERNAME && password == process.env.PASSWORD) {
            return {
                token: crypto.randomBytes(48).toString('hex')
            };
        } else {
            return null;
        }
    }
}