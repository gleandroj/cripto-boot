import { from, Observable, Sub } from 'rxjs';
import { map } from 'rxjs/operators';
import moment from 'moment';
import log from './logger';

export class BinanceService {

    constructor(binance) {
        this.binance = binance;
    }

    symbols() {
        return from(from(
            this.binance.prices()
        )).pipe(map((prices) => Object.keys(prices)));
    }

    live() {
        return new Observable(async (subscribes) => {
            const symbols = await this.symbols().toPromise();
            this.binance.ws.candles(symbols, '1m', candle => {
                if (subscribes) {
                    subscribes.next({
                        symbol: candle.symbol,
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
                }
            });
        });
    }
}