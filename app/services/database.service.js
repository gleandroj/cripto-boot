import { Subject, from, of } from 'rxjs';
import { tap, map, switchMap } from 'rxjs/operators';
import { STATUS_OPENED } from './candle.service';
import moment from 'moment';

export default class DatabaseService {

    constructor(db) {
        this.db = db;
        this.configSubject = new Subject();
    }

    async createCollections() {
        const collections = await this.db.listCollections().toArray();
        if (collections.findIndex((r) => r.name == 'computed_candles') < 0) {
            this.db.createCollection('computed_candles', {
                capped: true,
                max: 500000,
                size: 50000000
            });
        }
    }

    updateConfig(config) {
        delete config._id;
        return from(
            this.db.collection('config')
                .updateOne({ key: 'general' }, {
                    $set: Object.assign({ key: 'general' }, config)
                }, { upsert: true })
        ).pipe(
            tap(() => this.configSubject.next(config)),
            map((res) => config)
        );
    }

    getConfig() {
        return from(
            this.db.collection('config').findOne({ key: 'general' }, { _id: 0 })
        );
    }

    lastTrade(symbol, status) {
        return from(
            this.db.collection('trades')
                .findOne(
                    { symbol: symbol, status: status },
                    { sort: { _id: -1 } }
                )
        );
    }

    updateTrade(trade) {
        return from(
            this.db.collection('trades')
                .updateOne({
                    _id: trade._id
                }, { $set: trade })
        );
    }

    storeTrade(trade) {
        return from(
            this.db.collection('trades')
                .insertOne(trade)
        ).pipe(
            switchMap(c => of(trade))
        );
    }

    countTrades() {
        return from(
            this.db.collection('trades').find({}).count()
        )
    }

    trades(){
        return from(
            this.db.collection('trades').find({}).toArray()
        );
    }

    dailySuccessRate() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return from(
            this.db.collection('trades').aggregate(
                [
                    {
                        $match: {
                            ask_at: {
                                $gte: moment(start).valueOf(),
                                $lte: moment(end).valueOf()
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total_trades: {
                                $sum: {
                                    $cond: { if: { $gt: ["$bid_at", 0] }, then: 1, else: 0 }
                                }
                            },
                            total_success_trades: {
                                $sum: {
                                    $cond: { if: { $gt: ["$profit", 0] }, then: 1, else: 0 }
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            rate: {
                                $multiply: [
                                    {
                                        $cond: {
                                            if: {
                                                $gt: ["$total_trades", 0]
                                            }, 
                                            then: { $divide: ["$total_success_trades", "$total_trades"] }, 
                                            else: 0
                                        }
                                    }, 100
                                ]
                            }
                        }
                    }
                ], {
                    allowDiskUse: true
                }
            ).toArray()
        )
    }

    appreciation(pair, interval, limit) {
        return from(
            this.db.collection('candles').aggregate(
                [
                    {
                        $match: {
                            created_at: { $gte: moment().subtract(interval, "minutes").valueOf() },
                            symbol: { $regex: `${pair}$` }
                        }
                    },
                    { $sort: { _id: 1 } },
                    {
                        $group: {
                            _id: '$symbol',
                            first: { $first: "$$ROOT" },
                            last: { $last: "$$ROOT" }
                        }
                    },
                    {
                        $project: {
                            appreciation: {
                                $multiply: [
                                    {
                                        $subtract: [
                                            {
                                                $divide: ["$last.close", "$first.close"]
                                            }, 1
                                        ]
                                    }, 100
                                ]
                            }
                        }
                    },
                    {
                        $match: {
                            appreciation: { $gt: 0 }
                        }
                    },
                    { $sort: { appreciation: -1 } }
                ]
            )
                .limit(limit)
                .toArray()
        );
    }

    volume(pair, interval, limit) {
        const gte = moment().subtract(interval, "minutes").valueOf();
        return from(
            this.db.collection('computed_candles').aggregate(
                [
                    { $match: { symbol: { $regex: 'BTC$' } } },
                    { $sort: { _id: -1 } },
                    { $group: { _id: '$symbol', last: { $first: "$$ROOT" } } },
                    {
                        $group: {
                            _id: null,
                            qty: { $sum: 1 },
                            totalVolume: { $sum: "$$ROOT.last.volume" },
                            candles: {
                                $push: { symbol: "$$ROOT.last.symbol", volume: "$$ROOT.last.volume" }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            volumes: {
                                $map: {
                                    input: "$candles",
                                    as: "candle",
                                    in: {
                                        symbol: "$$candle.symbol",
                                        volume: "$$candle.volume",
                                        percent: {
                                            $multiply: [
                                                {
                                                    $divide: ["$$candle.volume", "$totalVolume"]
                                                }, 100
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        $unwind: { path: "$volumes" }
                    },
                    {
                        $project: { symbol: "$volumes.symbol", percent: "$volumes.percent" }
                    },
                    { $match: { percent: { $gt: 0 } } },
                    { $sort: { percent: -1 } }
                ]
            )
                .limit(limit)
                .toArray()
        );
    }

    paginateTrades(page_size, page) {
        return from(
            this.db.collection('trades').find({})
                .skip(page_size * (page - 1))
                .limit(page_size)
                .sort({ status: 1, bid_at: -1, _id: -1 })
                .toArray()
        )
    }

    openedTrades() {
        return from(
            this.db.collection('trades')
                .find({
                    status: STATUS_OPENED
                }).count()
        );
    }

    storeCandle(candle) {
        return from(
            this.db.collection('computed_candles')
                .insertOne(candle)
        ).pipe(
            switchMap(c => of(candle))
        );
    }

    lastCandle(symbol, interval) {
        return from(
            this.db.collection('computed_candles')
                .findOne(
                    {
                        symbol: symbol,
                        interval: interval
                    },
                    { sort: { _id: -1 } }
                )
        ).pipe(
            map((candle) => candle ? candle : {})
        );
    }

    candlePeriod(symbol, interval, period) {
        return from(
            this.db.collection('computed_candles')
                .find(
                    {
                        symbol: symbol,
                        interval: interval
                    }
                ).sort(
                    { _id: -1 }
                ).limit(period).toArray()
        ).pipe(
            map((prices) => prices ? prices : [])
        );
    }
}