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
    }

    makeComputedCanldes() {
        return this.binance.symbols().pipe(
            switchMap(symbols =>
                from(symbols).pipe(
                    concatMap(symbol =>
                        this.database.lastPrice(symbol).pipe(
                            switchMap(
                                lastClose => this.database.lastComputedCandle(symbol).pipe(
                                    switchMap(lastComputed => {
                                        if (!lastClose) {
                                            //log(`Skipping candle for: ${symbol}. No prices found.`);
                                            return EMPTY;
                                        }
                                        const haAbe = lastComputed ? ((lastComputed.haAbe + lastClose.haClose) / 2) : ((lastClose.open + lastClose.haClose) / 2);
                                        const haFec = lastClose.haClose;
                                        const haMax = Math.max(lastClose.high, haAbe, haFec);
                                        const haMin = Math.min(lastClose.low, haAbe, haFec);
                                        const result = this.calc.rsi(
                                            haFec,
                                            lastComputed ? lastComputed.haFec : null,
                                            haMin,
                                            lastComputed ? lastComputed.haMin : null,
                                            lastComputed ? lastComputed.up : null,
                                            lastComputed ? lastComputed.down : null
                                        );
                                        const candle = {
                                            symbol: symbol,
                                            haAbe: haAbe,
                                            haFec: lastClose.haClose,
                                            haMax: haMax,
                                            haMin: haMin,
                                            close: lastClose.close,
                                            created_at: moment().valueOf(),
                                            flag: result.flag,
                                            up: result.up,
                                            down: result.down,
                                            rsi: result.rsi
                                        };
                                        return this.database.storeComputedCandle(candle)
                                            .pipe(map((r) => {
                                                return {
                                                    current: candle,
                                                    last: lastComputed
                                                };
                                            }));
                                    })
                                )
                            )
                        )
                    )
                )
            )
        );
    }

    async analyzeCandle(event) {
        const openedTrades = await this.database.openedTrades().toPromise();
        const symbol = event.current.symbol;
        const curr = event.current;
        const last = event.last;
        const maxTrades = this.config.simultaneous_trade;
        const amount = this.config.max_amout_per_trade || 0;

        if (curr.flag == 1 && (last && last.flag != 1) && (maxTrades && openedTrades < maxTrades )) {
            const trade = {
                symbol: symbol,
                status: STATUS_OPENED,
                amount: amount,
                ask_at: moment().valueOf(),
                ask_price: curr.close,
                bid_at: null,
                bid_price: null,
                profit: null
            };
            this.database.storeTrade(trade).subscribe(() => { });
            //log(`Buy ${symbol}, ${curr.haFec}`);
        }
        else if ((last && last.flag == 1) && curr.flag != 1) {
            let lastBuy = await this.database.lastTrade(symbol, STATUS_OPENED).toPromise();
            lastBuy.status = STATUS_CLOSED;
            lastBuy.bid_at = moment().valueOf();
            lastBuy.bid_price = curr.close;
            lastBuy.profit = (curr.close / lastBuy.ask_price) * (100 - 0.1);
            this.database.updateTrade(lastBuy);
            //Listar das trade (50 por página) Paginação
            //21:30 (meeting) calcular os TOP COIN.
            //log(`Sell ${symbol}, ${curr.haFec}`);
        }
    }

    async checkCandle() {
        const pair = this.config.pair;
        this.calc = new Calc(this.config.rsi_sensibility);
        this.makeComputedCanldes().subscribe((event) => {
            if (!this.config.pair) {
                log("No pair selected, skipping step.");
                return;
            }
            const len = event.current.symbol.length - pair.length;
            const isSelectedPair = event.current.symbol.indexOf(pair) >= len;
            if (isSelectedPair) this.analyzeCandle(event);
        });
    }
}