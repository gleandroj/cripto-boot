import log from './services/logger';
import { interval } from 'rxjs';
import { CandleService } from './services/candle.service';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    waitForCandles(timeFrame) {
        log('Wating for price change.');
        this.binance.live(timeFrame).subscribe(async (candle) => {
            this.candleService.checkCandle(candle);
        });
    }

    destroy() {
        if (this.checkRankingInterval) this.checkRankingInterval.unsubscribe();
        if (this.candleService){
            this.candleService.destroy();
            delete this.candleService;
        }
    }

    checkRanking() {
        this.candleService.updateRanking().then(() => { });
    }

    async initialize(config) {
        this.destroy();
        this.config = config ? config : await this.database.getConfig().toPromise();
        if (this.config != null && this.config.running && this.config.rsi_sensibility != null) {
            log('Boot running.');
            this.candleService = new CandleService(
                this.database,
                this.config,
                this.binance
            );
            await this.candleService.initialize();
            await this.candleService.updateRanking();
            if (this.config.candle_interval) {
                this.waitForCandles(this.config.candle_interval);
            }
            if (this.config.coin_choice_interval) {
                log(`Ranking interval: ${this.config.coin_choice_interval} min.`);
                this.checkRankingInterval = interval(this.config.coin_choice_interval * (1000 * 60))
                    .subscribe(() => this.checkRanking());
            }
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