import { from, Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import log from './logger';

export class BinanceService {

    constructor(binance) {
        binance.verbose = true;
        this.binance = binance;
        this._symbols = null;
        this.candleSubject = new Subject();
        this.count = 0;
        this.liveCleanFn = null;
    }

    exchangeInfo(){
        return from(
          this.binance.exchangeInfo()  
        );
    }

    balances(asset) {
        return from(
            this.binance.accountInfo()
        ).pipe(map(resp => resp.balances.filter(b => b.asset == asset)[0]));
    }

    getClient() {
        return this.binance;
    }

    getOrder(symbol, orderId) {
        return from(
            this.binance.getOrder({
                symbol: symbol,
                orderId: orderId
            })
        );
    }

    buyMarket(symbol, qnty) {
        return from(
            this.binance.order({
                symbol: symbol,
                quantity: qnty,
                side: 'BUY',
                type: 'MARKET'
            })
        );
    }

    getLastTrade(symbol) {
        return from(
            this.binance.myTrades({
                symbol: symbol,
                limit: 1
            })
        ).pipe(map(r => r[0]));
    }

    sellMarket(symbol, qnty) {
        return from(
            this.binance.order({
                symbol: symbol,
                quantity: qnty,
                side: 'SELL',
                type: 'MARKET'
            })
        );
    }

    stopLoss(symbol, qty, stopPriceTrigger, stopPriceSell) {
        return from(
            this.binance.order({
                symbol: symbol,
                quantity: qty,
                side: 'SELL',
                type: 'STOP_LOSS_LIMIT',
                stopPrice: stopPriceTrigger,
                price: stopPriceSell
            })
        );
    }

    cancelOrder(symbol, orderId) {
        return from(
            this.binance.cancelOrder({
                symbol: symbol,
                orderId: orderId
            })
        );
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
        //const symbols = ['XRPBTC'];
        const symbols = await this.symbols().toPromise();
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
                    volume: parseFloat(candle.quoteBuyVolume),
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