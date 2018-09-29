import { from, Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import log from './logger';
import request from 'request-promise';

export class BinanceService {

    constructor(binance) {
        binance.verbose = true;
        this.binance = binance;
        this._symbols = null;
        this.candleSubject = new Subject();
        this.count = 0;
        this.liveCleanFn = null;
    }

    exchangeInfo() {
        const options = {
            url: 'https://www.binance.com/exchange/public/product',
            headers: {
                Connection: 'keep-alive',
                'User-Agent': 'Request-Promise',
            },
            json: true,
        };
        const getOrderMinSize = currency => {
            if (currency === 'BTC') return 0.001;
            else if (currency === 'ETH') return 0.01;
            else if (currency === 'USDT') return 10;
            else return 1;
        };
        return from(
            request(options)
        ).pipe(map((body) => {
            if (!body && !body.data) {
                throw new Error('Unable to fetch product list, response was empty');
            }
            return body.data.map((market) => {
                return {
                    symbol: market.symbol,
                    minimalOrder: {
                        amount: parseFloat(market.minTrade),
                        price: parseFloat(market.tickSize),
                        order: getOrderMinSize(market.quoteAsset)
                    },
                };
            });
        }));
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

    stopLoss(symbol, qty, stopPriceTrigger, stopPriceSell, isTrailing) {
        return from(
            this.binance.order({
                symbol: symbol,
                quantity: qty,
                side: 'SELL',
                type: 'STOP_LOSS_LIMIT',
                stopPrice: stopPriceTrigger,
                price: stopPriceSell
            })
        ).pipe(map(order => {
            return {
                symbol: symbol,
                orderId: order.orderId,
                clientOrderId: order.clientOrderId,
                transactTime: order.transactTime,
                quantity: qty,
                stopPriceTrigger: stopPriceTrigger,
                stopPriceSell: stopPriceSell,
                isTrailing: isTrailing ? isTrailing : false
            };
        }));
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
        //const symbols = ['BCCBTC'];
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