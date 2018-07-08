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
                        volume: parseFloat(candle.volume),
                        openTime: candle.startTime,
                        closeTime: candle.closeTime,
                        created_at: candle.eventTime
                    });
                }
            });
        });
    }

    status() {
        return from(
            this.binance.dailyStats()
        ).pipe(map((response) => {
            const created_at = moment().utc().valueOf();
            return response.map((resp) => {
                return {
                    symbol: resp.symbol,
                    open: parseFloat(resp.openPrice),
                    close: parseFloat(resp.lastPrice),
                    high: parseFloat(resp.highPrice),
                    low: parseFloat(resp.lowPrice),
                    volume: parseFloat(resp.volume),
                    openTime: resp.openTime,
                    closeTime: resp.closeTime,
                    created_at: created_at
                };
            });
        }));
    }
}