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
        if (collections.findIndex((r) => r.name == 'candles') < 0) {
            this.db.createCollection('candles', {
                capped: true,
                max: 10000,
                size: 10000000
            });
            this.db.createCollection('computed_candles', {
                capped: true,
                max: 10000,
                size: 10000000
            });
        }
    }

    candles() {
        return from(this.db.collection('candles').find({}).toArray());
    }

    storeCandle(event) {
        return from(
            this.db.collection('candles')
                .insertOne(event)
        );
    }

    storeComputedCandle(candle) {
        return from(
            this.db.collection('computed_candles')
                .insertOne(candle)
        ).pipe(
            switchMap(c => of(candle))
        );
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

    dailyProfit() {
        return from(
            this.db.collection('trades').find({}).count()
        )
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
                            total_trades: { $sum: 1 },
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
                                $multiply: [{ $divide: ["$total_success_trades", "$total_trades"] }, 100]
                            }
                        }
                    }
                ], {
                    allowDiskUse: true
                }
            ).toArray()
        )
    }

    paginateTrades(page_size, page) {
        return from(
            this.db.collection('trades').find({})
                .skip(page_size * (page - 1))
                .limit(page_size)
                .sort({status: 1, _id: -1})
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

    lastPrice(symbol) {
        return from(
            this.db.collection('candles')
                .findOne(
                    { symbol: symbol },
                    { sort: { _id: -1 } }
                )
        );
    }

    lastComputedCandle(symbol) {
        return from(
            this.db.collection('computed_candles')
                .findOne(
                    { symbol: symbol },
                    { sort: { _id: -1 } }
                )
        );
    }
}