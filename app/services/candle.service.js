import log from "./logger";
import { switchMap, map, concatMap } from "rxjs/operators";
import { from, of } from "rxjs";
import moment from 'moment';
import Calc from "./calc.service";

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
                        this.database.lastPriceForSymbol(symbol).pipe(
                            switchMap(
                                lastClose => this.database.lastComputedCandle(symbol).pipe(
                                    switchMap(lastComputed => {
                                        if (!lastClose) {
                                            log(`Skipping candle for: ${symbol}. No prices found.`);
                                            return;
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
                                            created_at: moment().valueOf(),
                                            flag: result.flag,
                                            up: result.up,
                                            down: result.down,
                                            rsi: result.rsi
                                        };
                                        return of({
                                            current: candle,
                                            last: lastComputed
                                        });
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
        //console.log(event);
        const curr = event.current;
        const last = event.last;
        if (curr.flag == 1 && last && last.flag != 1){
            curr.action = 'BUY';
            log(`Buy ${curr.symbol}, ${curr.haFec}`);
        }
        else if (last && last.flag == 1 && curr.flag != 1) {
            // let lastBuy = (await db.collection('vela').find({
            //     action: 'BUY'
            // }).sort({ created_at: -1 }).limit(1).toArray())[0];
            // vela.action = 'SELL';
            // vela.realProfit = ((vela.realPrice - lastBuy.realPrice) / vela.realPrice) * 100;
            // vela.profit = ((vela.price - lastBuy.price) / vela.price) * 100;
            curr.action = 'SELL';
            log(`Sell ${curr.symbol}, ${curr.haFec}`);
        }
        this.database.storeComputedCandle(curr).subscribe(() => {});
        // vela.created_at = moment().valueOf();
        // await db.collection('vela').insert(vela);
        // this.logVela(vela);
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