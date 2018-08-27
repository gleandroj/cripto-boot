import log from "./logger";
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
            flagMACD: macd > signal && macd > 0 ? 1 : 2
        };
        Object.assign(candle, computed);
        await this.database.storeCandle(candle).toPromise();
        await this.analyzeCandle({
            current: candle,
            previous: prev
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
            profit: null,
            stop_loss_trigger: price * ((100 - 1.4)/100),
            stop_loss_sell: price * ((100 - 1.5)/100)
        };
        await this.database.storeTrade(trade).toPromise();
        this.openedTrades++;
        log(`Buy ${trade.symbol}, ${price}`);
    }

    async sell(trade, price) {
        trade.status = STATUS_CLOSED;
        trade.bid_at = moment().valueOf();
        trade.bid_price = price;
        trade.profit = (((trade.bid_price - trade.ask_price) / trade.ask_price) - 0.001) * 100;
        await this.database.updateTrade(trade).toPromise();
        this.openedTrades--;
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

        if (
            isOnRanking &&
            isSelectedPair &&
            curr.rsi2.flag == 1 &&
            (previous && previous.rsi2 && previous.rsi2.flag != 1) &&
            (maxTrades && openedTrades != null && openedTrades < maxTrades) &&
            !currentTrade
        ) {
            await this.buy(symbol, amount, curr.close);
        } else if (
            curr.rsi2.flag != 1 &&
            (previous && previous.rsi2 && previous.rsi2.flag != 1) &&
            currentTrade
        ) {
            await this.sell(currentTrade, curr.close)
        }
    }
}