import { Subject, from } from 'rxjs';
import { tap, map } from 'rxjs/operators';

export default class DatabaseService {

    constructor(db) {
        this.db = db;
        this.configSubject = new Subject();
    }

    async createCollections(){
        const collections = await this.db.listCollections().toArray();
        if(collections.findIndex((r) => r.name == 'candles') < 0){
            this.db.createCollection('candles', {
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
            ],{
                allowDiskUse: true
            }
        ).toArray());
    }
}