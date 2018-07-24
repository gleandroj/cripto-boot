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
        //const interval = this.config.coin_choice_interval ? this.config.coin_choice_interval : 0;
        const pair = this.config && this.config.pair ? this.config.pair : null;
        const regex = new RegExp(`${pair}$`);
        const dailyStats = await this.binance.dailyStats().toPromise();
        this.ranking = dailyStats.filter((p) => p.percent > 0 && regex.test(p.symbol)).sort((a, b) => b.percent - a.percent).slice(0, 5);
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
            volume: candle.volume,
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
        log(`Buy ${trade.symbol}, ${price}`);
    }

    async sell(trade, price) {
        trade.status = STATUS_CLOSED;
        trade.bid_at = moment().valueOf();
        trade.bid_price = price;
        trade.profit = ((trade.bid_price - trade.ask_price) / trade.bid_price) * (100 - 0.1);
        await this.database.updateTrade(trade).toPromise();
        log(`Sell ${trade.symbol}, ${price}`);
    }

    async analyzeCandle(event) {
        const pair = this.config ? this.config.pair : null;

        const symbol = event.current.symbol;
        const curr = event.current;
        const previous = event.previous;

        const maxTrades = this.config.simultaneous_trade;
        const amount = this.config.max_amout_per_trade || 0;

        const isSelectedPair = (new RegExp(`${pair}$`)).test(curr.symbol);
        const openedTrades = this.openedTrades;
        const isOnRanking = this.ranking.findIndex((t) => t.symbol === symbol) > -1;
        const currentTrade = await this.database.lastTrade(symbol, STATUS_OPENED).toPromise();

        if (isOnRanking &&
            isSelectedPair &&
            curr.flag == 1 &&
            (previous && previous.flag != 1) &&
            (maxTrades && openedTrades != null && openedTrades < maxTrades) &&
            !currentTrade
        ) {
            await this.buy(symbol, amount, curr.close);
        }
        else if (curr.flag != 1 &&
            (previous && previous.flag == 1) &&
            currentTrade
        ) {
            await this.sell(currentTrade, curr.close);
        }
    }
}