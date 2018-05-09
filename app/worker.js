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
            return;
            let result = await this.app.providers.db.collection('kline').insert({
                symbol: kline.symbol,
                eventTime: kline.eventTime,
                open: parseFloat(kline.open),
                close: parseFloat(kline.close),
                high: parseFloat(kline.high),
                low: parseFloat(kline.low)
            });
            console.log(result);
        });

        async function test(app) {
            let result = await app.providers.db.collection('kline').aggregate(
                [
                    {
                        $match: {
                            eventTime: {
                                $gte: moment().subtract(6, "minutes").valueOf(),
                                $lt: moment().valueOf()
                            }
                        }
                    },
                    {
                        $group: {
                            _id: '$symbol',
                            count: { $sum: 1 },
                            totalClose: { $sum: '$close' },
                            avgClose: { $avg: '$close' },
                            maxClose: { $max: '$close' },
                            minClose: { $min: '$close' }
                        }
                    }
                ]).toArray();
            console.log(result);
        }

        test(this.app).then(() => { });
    }

}