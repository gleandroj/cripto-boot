import log from "./logger";
import { switchMap, map, concatMap } from "rxjs/operators";
import { from, EMPTY } from "rxjs";
import moment from 'moment';
import Calc from "./calc.service";

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

    destroy(){
        delete this.calc;
    }

    async initialize() {
        this.openedTrades = await this.database.openedTrades().toPromise();
        this.calc = new Calc(this.config.rsi_sensibility);
    }

    logRanking() {
        const newRanking = this.ranking.map((t) => `${t._id}, Vol: ${t.volume}`);
        log(`Ranking updated: ${newRanking.join(' | ')}`);
    }

    async updateRanking() {
        const interval = this.config.coin_choice_interval ? this.config.coin_choice_interval : 0;
        const pair = this.config.pair ? this.config.pair : '';
        this.ranking = await this.database.volume(pair, interval, 5).toPromise();
        this.logRanking();
    }

    async checkCandle(candle) {
        const previousCandle = await this.database.lastCandle(candle.symbol, candle.interval).toPromise();

        const haAbe = previousCandle ? ((previousCandle.haAbe + candle.haClose) / 2) : ((candle.open + candle.haClose) / 2);
        const haFec = candle.haClose;
        const haMax = Math.max(candle.high, haAbe, haFec);
        const haMin = Math.min(candle.low, haAbe, haFec);

        const result = this.calc.rsi(
            haFec,
            previousCandle ? previousCandle.haFec : haFec,
            haMin,
            previousCandle ? previousCandle.haMin : haMin,
            previousCandle ? previousCandle.up : null,
            previousCandle ? previousCandle.down : null
        );

        const computed = {
            symbol: candle.symbol,
            interval: candle.interval,
            haAbe: haAbe,
            haFec: candle.haClose,
            haMax: haMax,
            haMin: haMin,
            close: candle.close,
            created_at: moment().valueOf(),
            flag: result.flag,
            up: result.up,
            down: result.down,
            rsi: result.rsi
        };

        await this.database.storeCandle(computed).toPromise();
        await this.analyzeCandle({
            current: computed,
            previous: previousCandle
        });
    }

    async buy(symbol, amount, price) {
        const trade = {
            symbol: symbol,
            status: STATUS_OPENED,
            amount: amount,
            ask_at: moment().valueOf(),
            ask_price: price,
            bid_at: null,
            bid_price: null,
            profit: null
        };
        await this.database.storeTrade(trade).toPromise();
        this.openedTrades++;
        log(`Buy ${symbol}, ${curr.close}`);
    }

    async sell(trade, price) {
        trade.status = STATUS_CLOSED;
        trade.bid_at = moment().valueOf();
        trade.bid_price = price;
        trade.profit = ((trade.bid_price - trade.ask_price) / trade.bid_price) * (100 - 0.1);
        await this.database.updateTrade(trade).toPromise();
        log(`Sell ${symbol}, ${curr.close}`);
    }

    async analyzeCandle(event) {
        const pair = this.config ? this.config.pair : null;

        const symbol = event.current.symbol;
        const curr = event.current;
        const previous = event.previous;

        const maxTrades = this.config.simultaneous_trade;
        const amount = this.config.max_amout_per_trade || 0;

        const isSelectedPair = (new RegExp(`${pair}$`)).test(curr.symbol);
        const openedTrade = this.openedTrades;
        const isOnRanking = this.ranking.findIndex((t) => t._id == symbol) > -1;

        if (isOnRanking &&
            isSelectedPair &&
            curr.flag == 1 &&
            (previous && previous.flag != 1) &&
            (maxTrades && openedTrades != null && openedTrades < maxTrades) &&
            !openedTrade
        ) {
            await this.buy(symbol, amount, curr.close);
        }
        else if (curr.flag != 1 &&
            (previous && previous.flag == 1) &&
            openedTrade
        ) {
            await this.sell(openedTrade, curr.close);
        }
    }
}