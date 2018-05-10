import { CronJob, CronTime } from 'cron';
import moment from 'moment';
import Decimal from 'decimal.js';

const EVERY_MINUTE_CRON_EXPRESSION = '* * * *';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    run() {
        setInterval(async () => {
            return;
            let prices = await this.app.providers.binance.prices()
            let keys = Object.keys(prices);
            keys.map(async (key) => {
                let result = await this.app.providers.db.collection('prices').insert({
                    symbol: key,
                    eventTime: moment().valueOf(),
                    price: parseFloat(prices[key])
                });
            });
            console.log(`Inserted more: ${keys.length}`);
        }, 1000);

        async function consilidaVela(db) {
            let start = moment().subtract(1, "minutes").valueOf();
            let end = moment().valueOf();

            let result = await db.collection('prices').find({
                symbol: 'ETHBTC',
                eventTime: {
                    $gte: start,
                    $lt: end
                }
            }).toArray();


            let value = {
                last: null,
                up: 0,
                down: 0
            };

            result.map((current, i) => {
                if (value.last != null) {
                    let r = (current.price - value.last.price);
                    //console.log(r.toString());
                    if (r > 0) {
                        value.up += r;
                    } else {
                        value.down += -r;
                    }
                }
                value.last = current;
            });
            console.log(value.up);
            console.log(value.down);
            //value.up = value.up/result.lenght;
            //value.down = value.down/result.lenght;
            //console.log(Math.round);
            /*let fr = Math.round(value.up) / Math.round(value.down);
            let ifr = 100 - (100 / (1 + fr));
            console.log(ifr);*/
            await db.collection('velas').insert(result);
        };
        consilidaVela(this.app.providers.db).then(() => { });
        /*
        this.everyMinuteJob = new CronJob({
            cronTime: EVERY_MINUTE_CRON_EXPRESSION,
            onTick: () => consilidaVela(this.app.providers.db).then(() => { }),
            start: false,
            timeZone: 'America/Sao_Paulo'
        });
        this.everyMinuteJob.start();*/
    }

}