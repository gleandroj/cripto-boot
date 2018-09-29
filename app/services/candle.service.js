import log from "./logger";
import Calc from "./calc.service";
import { roundAmount, roundPrice, isValidLot } from "./helpers";
import { STATUS_OPENED, STATUS_CLOSED } from './exchange/binance-trader';

export class CandleService {

    constructor(trader, database, config) {
        this.trader = trader;
        this.database = database;
        this.config = config;
        this.ranking = [];
        this.openedTrades = null;
        this.exchangeInfo = null;
    }

    destroy() {
        delete this.calc;
    }

    async initialize() {
        log('Fetching opened trades.');
        this.openedTrades = await this.database.openedTrades().toPromise();
        log('Initializing Exchange Market Data.');
        this.exchangeInfo = await this.trader.exchangeInfo();
        this.calc = new Calc(this.config.rsi_sensibility);
    }

    async updateRanking() {
        const interval = this.config.coin_choice_interval ? this.config.coin_choice_interval : 0;
        const pair = this.config && this.config.pair ? this.config.pair : null;
        const max = this.config && this.config.coin_ranking_max ? this.config.coin_ranking_max : 5;
        this.ranking = await this.database.volume(pair, interval, max).toPromise();
        const newRanking = this.ranking.map((t) => `${t.symbol}, Percent: ${t.percent}`);
        log(`Ranking updated: ${newRanking.join(' | ')}`);
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
        const market = this.exchangeInfo.find((t) => t.symbol === symbol);
        const quantity = roundAmount((amount / curr.close), market);

        if (currentTrade) {
            const lastTrade = await this.trader.getLastTrade(currentTrade.symbol);
            const buyOrderId = currentTrade.binanceBuyTrade.orderId;
            const isLastTradeBuy = lastTrade.orderId == buyOrderId;
            if (!isLastTradeBuy && lastTrade.isMaker) {//Trade was stop loss
                await this.database.updateTrade(
                    this.trader.updateSellTrade(currentTrade, lastTrade)
                ).toPromise();
                this.openedTrades--;
                log(`Sell by stop loss ${currentTrade.symbol}, ${currentTrade.bid_price}`);
                return;
            }
        }

        if (
            currentTrade &&
            curr.macd < curr.signal
        ) {
            const trade = await this.trader.sell(currentTrade, curr.close, market)
            if (trade) {
                await this.database.updateTrade(trade).toPromise();
                this.openedTrades--;
                log(`Sell ${trade.symbol}, ${trade.bid_price}`);
            }
        } else if (
            currentTrade &&
            currentTrade.stopLossOrder &&
            !currentTrade.stopLossOrder.isTrailing
        ) {
            const price = curr.close;
            const buyPrice = currentTrade.ask_price;
            if (price >= (buyPrice * 1.005)) {
                const oldStopLossOrderId = currentTrade.stopLossOrder.orderId;
                currentTrade.stop_loss_trigger = roundPrice(buyPrice * 1.002, market);
                currentTrade.stop_loss_sell = roundPrice(buyPrice * 1.0018, market);
                await this.trader.cancelOrder(symbol, oldStopLossOrderId);
                currentTrade.stopLossOrder = await this.trader.stopLossOrder(symbol, currentTrade.quantity, currentTrade.stop_loss_trigger, currentTrade.stop_loss_sell);
                await this.database.updateTrade(currentTrade).toPromise();
                log(`Trailing for ${currentTrade.symbol}, ${currentTrade.stop_loss_sell}`);
            }
        }
        else if (
            !currentTrade &&
            trading &&
            isOnRanking &&
            isSelectedPair &&
            curr.rsi2.flag == 1 &&
            (previous && previous.rsi2 && previous.rsi2.flag != 1) &&
            curr.flagMACD == 1 &&
            (previous && previous.flagMACD != 1) &&
            (maxTrades && openedTrades != null && openedTrades < maxTrades) &&
            isValidLot(curr.close, quantity, market)
        ) {
            const trade = await this.trader.buy(symbol, quantity, curr.close, market);
            if (trade) {
                await this.database.storeTrade(trade).toPromise();
                this.openedTrades++;
                log(`Buy ${trade.symbol}, ${trade.ask_price}`);
            }
        }
    }
}