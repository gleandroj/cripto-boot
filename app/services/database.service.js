import { Subject, from } from 'rxjs';
import { tap, map } from 'rxjs/operators';

export default class DatabaseService {

    constructor(db) {
        this.db = db;
        this.configSubject = new Subject();
    }

    candles(){
        return from(this.db.collection('candles').find({}).toArray());
    }

    storeCandle(event) {
        return from(
            this.db.collection('candles')
                .insertOne(event)
        )
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
            this.db.collection('config').findOne({ key: 'general' })
        );
    }

}