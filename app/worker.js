import { CronJob, CronTime } from 'cron';
import moment from 'moment';

const EVERY_SECOND_CRON_EXPRESSION = '* * * *';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    run() {
        this.everySecondJob = new CronJob({
            cronTime: EVERY_SECOND_CRON_EXPRESSION,
            onTick: function () {
                console.log(new Date());
            },
            start: false,
            timeZone: 'America/Sao_Paulo'
        });
        this.everySecondJob.start();
        console.log('job every second job', this.everySecondJob.running);

        this.app.providers.binance.ws.candles('ETHBTC', '1m', async kline => {
            let result = await this.app.providers.db.collection('kline').insert({
                symbol: kline.symbol,
                eventTime: kline.eventTime,
                open: parseFloat(kline.open),
                close: parseFloat(kline.close),
                high: parseFloat(kline.high),
                low: parseFloat(kline.low)
            });
        });

        async function test(db) {
            let start = moment().subtract(60, "minutes").valueOf();
            let end = moment().valueOf();

            let result = await db.collection('kline').aggregate(
                [
                    {
                        $match: {
                            eventTime: {
                                $gte: start,
                                $lt: end
                            }
                        }
                    },
                    {
                        $group: {
                            _id: '$symbol',
                            itemsCount: { $sum: 1 },
                            totalClose: { $sum: '$close' },
                            avgClose: { $avg: '$close' },
                            maxClose: { $max: '$close' },
                            minClose: { $min: '$close' }
                        }
                    }
                ]).toArray();

            result = result[0];
            result.symbol = result._id;
            delete result._id;
            result.startTime = start;
            result.endTime = end;
            result.created_at = moment().valueOf();
            await db.collection('velas').insert(result);
        }

        test(this.app.providers.db).then(() => { });
    }

}