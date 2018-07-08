import log from './services/logger';
import { interval } from 'rxjs';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    storeSymbolStatus() {
        const binance = this.app.providers.binance;
        const subscribe = binance.live().subscribe((event) => {
            this.database.storeCandle(event).subscribe(() => {
                console.log('OK');
             });
        });
    }

    destroy() {}

    async initialize() {
        this.destroy();
        this.config = await this.database.getConfig().toPromise();
        if (this.config && this.config.running) {
            log('Boot running.');
            this.storeSymbolStatus();
        }
        console.log(await this.database.candles().toPromise());
    }

    run() {
        this.database = this.app.providers.database;
        this.initialize().then(() => { });
        this.database.configSubject.subscribe((config) => {
            this.config = config;
            log('Config updated.');
        });
    }
}