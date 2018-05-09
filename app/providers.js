import Binance from 'binance-api-node';
import ApiRoutes from './routes/api';

export default class ServiceProvider{
    
    constructor(app){
        this.app = app;
    }

    registerRoutes(){
        ApiRoutes(this.app);
    }

    register(){
        let binance = Binance({
            APIKEY: process.env.BINANCE_APIKEY,
            APISECRET: process.env.BINANCE_APISECRET
        });
        
        this._providers = {
            binance: binance
        };
    }

    get providers(){
        return this._providers;
    }
};