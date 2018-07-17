import { Subject, from, of } from 'rxjs';
import { tap, map, switchMap } from 'rxjs/operators';
import { STATUS_OPENED } from './candle.service';


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
                }, trade)
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

    countTrades(){
        return from(
            this.db.collection('trades').find({}).count()
        )
    }

    paginateTrades(page_size, page) {
        return from(
            this.db.collection('trades').find({})
                .skip(page_size * (page - 1))
                .limit(page_size)
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
                .findOne({
                    $query: {
                        symbol: symbol
                    }, $orderby: {
                        id: -1
                    }
                })
        );
    }

    lastPrices() {
        return from(this.db.collection('candles').aggregate(
            [
                {
                    $group: {
                        _id: '$symbol',
                        last_created_at: {
                            $last: "$created_at"
                        },
                        candles: {
                            $push: "$$ROOT"
                        },
                        total: {
                            $sum: 1
                        }
                    }
                },
                {
                    $project: {
                        "candles": {
                            $slice: [
                                "$candles",
                                -2
                            ]
                        }
                    }
                }
            ], {
                allowDiskUse: true
            }
        ).toArray());
    }
}