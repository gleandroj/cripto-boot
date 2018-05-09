import Binance from 'binance-api-node';
import { MongoClient } from 'mongodb';
import { format } from 'util';
import ApiRoutes from './routes/api';

export default class ServiceProvider {

    constructor(app) {
        this.app = app;
    }

    registerRoutes() {
        ApiRoutes(this.app);
    }

    registerDb() {
        const host = encodeURIComponent(process.env.MONGO_HOST);
        const user = encodeURIComponent(process.env.MONGO_USERNAME);
        const password = encodeURIComponent(process.env.MONGO_PASSWORD);
        const authMechanism = 'DEFAULT';
        const url = format('mongodb://%s:%s@%s:27017/?authMechanism=%s', user, password, host, authMechanism);
        return MongoClient.connect(url);
    }

    async register() {
        let binance = Binance({
            APIKEY: process.env.BINANCE_APIKEY,
            APISECRET: process.env.BINANCE_APISECRET
        });
        let client = await this.registerDb();
        this._providers = {
            binance: binance,
            clientDB: client,
            db: client.db(process.env.MONGO_DB)
        };
    }

    get providers() {
        return this._providers;
    }
};