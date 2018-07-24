import { from, Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import log from './logger';

export class BinanceService {

    constructor(binance) {
        this.binance = binance;
        this._symbols = null;
        this.candleSubject = new Subject();
        this.count = 0;
        this.liveCleanFn = null;
    }

    balances(asset) {
        return from(
            this.binance.accountInfo()
        ).pipe(map(resp => resp.balances.filter(b => b.asset == asset)[0]));
    }

    symbols() {
        if (this._symbols) from(this._symbols);
        return from(from(
            this.binance.prices()
        )).pipe(
            map((prices) => Object.keys(prices)),
            tap((symbols) => this._symbols = symbols)
        );
    }

    logLive() {
        setTimeout(() => {
            log(`Inserted more ${this.count} candles.`);
            this.count = 0;
            this.logLive();
        }, 1000 * 60);
    }

    async wsLive(timeFrame) {
        const symbols = ['ETHBTC'];
        //const symbols = await this.symbols().toPromise();
        log(`Awaiting for price changes of ${symbols.length} symbols.`);
        this.logLive();
        return this.binance.ws.candles(symbols, timeFrame, async candle => {
            if (candle.isFinal) {
                this.candleSubject.next({
                    symbol: candle.symbol.trim(),
                    interval: candle.interval,
                    open: parseFloat(candle.open),
                    close: parseFloat(candle.close),
                    high: parseFloat(candle.high),
                    low: parseFloat(candle.low),
                    haClose: (parseFloat(candle.open) + parseFloat(candle.close) + parseFloat(candle.high) + parseFloat(candle.low)) / 4,
                    volume: parseFloat(candle.volume),
                    openTime: candle.startTime,
                    closeTime: candle.closeTime,
                    created_at: candle.eventTime
                });
                this.count++;
            }
        });
    }

    live(timeFrame) {
        if (this.liveCleanFn != null) {
            this.liveCleanFn();
        }
        this.wsLive(timeFrame).then((clean) => {
            this.liveCleanFn = clean;
        });
        return this.candleSubject;
    }
}