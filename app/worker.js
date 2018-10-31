import log from './services/logger';
import { interval } from 'rxjs';
import { CandleService } from './services/candle.service';
import { BinanceTrader } from './services/exchange/binance-trader';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    waitForCandles(timeFrame) {
        log('Wating for price change.');
        this.liveSubscription = this.binance.live(timeFrame).subscribe(async (candle) => {
            this.candleService.checkCandle(candle);
        });
    }

    destroy() {
        if (this.checkRankingInterval) {
            this.checkRankingInterval.unsubscribe();
            delete this.checkRankingInterval;
        }
        if (this.liveSubscription) {
            this.liveSubscription.unsubscribe();
            delete this.liveSubscription;
        }
        if (this.candleService) {
            this.candleService.destroy();
            delete this.candleService;
        }
    }

    async initialize(config) {
        this.destroy();
        this.config = config ? config : await this.database.getConfig().toPromise();

        if (
            this.config != null &&
            this.config.candle_interval != null &&
            this.config.coins != null &&
            this.config.max_amout_per_trade != null &&
            this.config.pair != null &&
            this.config.rsi_sensibility != null &&
            this.config.running != null &&
            this.config.running === true &&
            this.config.simultaneous_trade != null &&
            this.config.macd_fast_period != null &&
            this.config.macd_slow_period != null &&
            this.config.macd_signal_period != null
        ) {
            log('---------------------');
            log(`Exchange: Binance.`);
            log('Boot running.');
            log(`Pair: ${this.config.pair}.`);
            log(`Simultaneous Trades: ${this.config.simultaneous_trade}.`);
            log(`Candle interval: ${this.config.candle_interval}.`);
            log(`RSI Sensibility: ${this.config.rsi_sensibility}.`);
            log(`Maximum Amount per Trade: ${this.config.max_amout_per_trade}.`);
            log(`Coins: ${this.config.coins.join(',')}.`);
            log(`MACD Fast Period: ${this.config.macd_fast_period}.`);
            log(`MACD Slow Period : ${this.config.macd_slow_period}.`);
            log(`MACD Signal Period: ${this.config.macd_signal_period}`);
            log(`Trading: ${this.config.trading}.`)
            log('---------------------');
            this.candleService = new CandleService(
                new BinanceTrader(this.binance),
                this.database,
                this.config
            );
            await this.candleService.initialize();
            this.waitForCandles(this.config.candle_interval);
        }
    }

    run() {
        this.database = this.app.providers.database;
        this.binance = this.app.providers.binance;
        this.database.configSubject.subscribe((config) => {
            this.initialize(config).then(() => { });
            log('Config updated.');
        });
        this.initialize().then(() => { });
    }
}