import log from "./logger";
import moment from 'moment';
import Calc from "./calc.service";
import { switchMap, delay } from "rxjs/operators";

export const STATUS_OPENED = 0;
export const STATUS_CLOSED = 1;

export class CandleService {

    constructor(database, config, binance) {
        this.database = database;
        this.config = config;
        this.binance = binance;
        this.ranking = [];
        this.openedTrades = null;
    }

    destroy() {
        delete this.calc;
    }

    async initialize() {
        this.openedTrades = await this.database.openedTrades().toPromise();
        this.calc = new Calc(this.config.rsi_sensibility);
    }

    logRanking() {
        const newRanking = this.ranking.map((t) => `${t.symbol}, Percent: ${t.percent}`);
        log(`Ranking updated: ${newRanking.join(' | ')}`);
    }

    async updateRanking() {
        const interval = this.config.coin_choice_interval ? this.config.coin_choice_interval : 0;
        const pair = this.config && this.config.pair ? this.config.pair : null;
        const max = this.config && this.config.coin_ranking_max ? this.config.coin_ranking_max : 5;
        this.ranking = await this.database.volume(pair, interval, max).toPromise();
        this.logRanking();
    }

    async checkCandle(candle) {
        const prev = (await this.database.lastCandle(
            candle.symbol,
            candle.interval
        ).toPromise());

        const haClose = ((candle.open + candle.close + candle.high + candle.low) / 4);
        const haOpen = prev.haOpen ? ((prev.haOpen + haClose) / 2) : ((candle.open + haClose) / 2);
        const haMax = Math.max(candle.high, haOpen, haClose);
        const haMin = Math.min(candle.low, haOpen, haClose);

        const fastMA = this.calc.ema(haClose, prev.fastMA, 12);
        const slowMA = this.calc.ema(haClose, prev.slowMA, 26);
        const macd = fastMA - slowMA;
        const signal = this.calc.ema(macd, prev.macd, 9);
        const hist = macd - signal;

        const computed = {
            haClose: haClose,
            haOpen: haOpen,
            haMax: haMax,
            haMin: haMin,
            rsi2: this.calc.rsi(haClose, prev.haClose, prev.rsi2, 2),
            rsi14: this.calc.rsi(haClose, prev.haClose, prev.rsi14, 14),
            fastMA: fastMA,
            slowMA: slowMA,
            macd: macd,
            signal: signal,
            hist: hist,
            flagMACD: macd > signal
        };
        Object.assign(candle, computed);
        await this.database.storeCandle(candle).toPromise();
        await this.analyzeCandle({
            current: candle,
            previous: prev
        });
    }

    async buy(symbol, amount, price) {
        try {
            const quantity = (amount / price).toFixed(2);
            const binanceTrade = await this.binance.buyMarket(
                symbol,
                quantity
            ).pipe(
                delay(1000),
                switchMap((r) => this.binance.getLastTrade(symbol))
            ).toPromise();
            price = parseFloat(binanceTrade.price);
            const stop_loss_trigger = (price * ((100 - 1.4) / 100)).toFixed(6);
            const stop_loss_sell = (price * ((100 - 1.5) / 100)).toFixed(6);
            let stopLossTrade = {};
            try {
                stopLossTrade = await this.binance.stopLoss(
                    symbol,
                    quantity,
                    stop_loss_trigger,
                    stop_loss_sell
                ).toPromise();
            } catch (e) {
                console.log('Stop loss error: ', e);
                console.log(this.binanceTrade);
                stopLossTrade = {};
            }
            const trade = {
                symbol: symbol,
                status: STATUS_OPENED,
                amount: (amount / price).toFixed(2),
                transactTime: binanceTrade.transactTime,
                ask_at: moment().valueOf(),
                ask_price: price,
                bid_at: null,
                bid_price: null,
                profit: null,
                stop_loss_trigger: stop_loss_trigger,
                stop_loss_sell: stop_loss_sell,
                binanceBuyTrade: binanceTrade,
                stopLossOrder: stopLossTrade
            };
            await this.database.storeTrade(trade).toPromise();
            this.openedTrades++;
            log(`Buy ${trade.symbol}, ${price}`);
            console.log(trade);
        } catch (e) {
            console.log('Error: ', e);
        }
    }

    async sell(trade, price) {
        try {
            if (trade.stopLossOrder && trade.stopLossOrder.orderId) {
                await this.binance.cancelOrder({
                    symbol: trade.symbol,
                    orderId: trade.stopLossOrder.orderId
                });
            }

            const binanceTrade = await this.binance.sellMarket(
                trade.symbol,
                trade.amount
            ).pipe(
                delay(1000),
                switchMap((r) => {
                    console.log(r);
                    return this.binance.getLastTrade(symbol);
                })
            ).toPromise();

            console.log(
                binanceTrade
            );

            trade.status = STATUS_CLOSED;
            trade.bid_at = moment().valueOf();
            trade.bid_price = price;
            trade.profit = (((trade.bid_price - trade.ask_price) / trade.ask_price) - 0.0015) * 100;
            trade.binanceSellTrade = binanceTrade;
            await this.database.updateTrade(trade).toPromise();
            this.openedTrades--;
            log(`Sell ${trade.symbol}, ${price}`);
            console.log(trade);
        } catch (e) {
            console.log('Error: ', e);
        }
    }

    async analyzeCandle(event) {
        const pair = this.config ? this.config.pair : null;
        const trading = this.config ? this.config.trading : false;
        const symbol = event.current.symbol;
        const curr = event.current;
        const previous = event.previous;

        const maxTrades = this.config.simultaneous_trade;
        const amount = this.config.max_amout_per_trade || 0;

        const isSelectedPair = (new RegExp(`${pair}$`)).test(curr.symbol);
        const openedTrades = this.openedTrades;
        const isOnRanking = this.ranking.findIndex((t) => t.symbol === symbol) > -1;
        const currentTrade = await this.database.lastTrade(symbol, STATUS_OPENED).toPromise();

        if (
            // isOnRanking &&
            // isSelectedPair &&
            // curr.rsi2.flag == 1 &&
            // (previous && previous.rsi2 && previous.rsi2.flag != 1) &&
            // curr.flagMACD == 1 &&
            // (previous && previous.flagMACD != 1) &&
            // (maxTrades && openedTrades != null && openedTrades < maxTrades) &&
            !currentTrade
            && trading
        ) {
            await this.buy(symbol, amount, curr.close);
        } else if (
            //curr.macd < curr.signal &&
            currentTrade
        ) {
            await this.sell(currentTrade, curr.close)
        }
    }
}