import log from './services/logger';
import { interval } from 'rxjs';
import { CandleService } from './services/candle.service';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    storeSymbolStatus() {
        log('Wating for price change.');
        this.binance.live().subscribe(async (candle) => {
            await this.database.storeCandle(candle).toPromise();
        });
    }

    destroy() {
        if (this.checkCandleInterval) this.checkCandleInterval.unsubscribe();
        if (this.checkRankingInterval) this.checkRankingInterval.unsubscribe();
        if (this.candleService) delete this.candleService;
    }

    checkCandle() {
        this.candleService.checkCandle().then(() => { });
    }

    async initialize(config) {
        this.destroy();
        this.config = config ? config : await this.database.getConfig().toPromise();
        if (this.config && this.config.running) {
            log('Boot running.');
            this.candleService = new CandleService(
                this.database,
                this.config,
                this.binance
            );
            if (this.config.candle_interval) {
                log(`Candle interval: ${this.config.candle_interval} min.`);
                this.checkCandleInterval = interval(this.config.candle_interval * (1000 * 60))
                    .subscribe(() => this.checkCandle());
            }
            if (this.config.coin_choice_interval) {
                log(`Ranking interval: ${this.config.candle_interval} min.`);
                this.checkRankingInterval = interval(this.config.coin_choice_interval * (1000 * 60))
                    .subscribe(() => this.checkCandle());
            }
        }
    }

    run() {
        this.database = this.app.providers.database;
        this.binance = this.app.providers.binance;
        this.storeSymbolStatus();
        this.database.configSubject.subscribe((config) => {
            this.initialize(config).then(() => { });
            log('Config updated.');
        });
        this.initialize().then(() => { });
    }
}