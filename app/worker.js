import { CronJob, CronTime } from 'cron';

const EVERY_SECOND_CRON_EXPRESSION = '* * * *';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    run() {
        // this.everySecondJob = new CronJob({
        //     cronTime: EVERY_SECOND_CRON_EXPRESSION,
        //     onTick: function () {
        //         console.log(new Date());
        //     },
        //     start: false,
        //     timeZone: 'America/Sao_Paulo'
        // });
        //this.everySecondJob.start();
        //console.log('job every second job', this.everySecondJob.running);

        this.app.providers.binance.ws.candles('ETHBTC', '1m', candle => {
            console.log(candle)
        });
    }

}