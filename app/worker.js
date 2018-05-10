import { CronJob, CronTime } from 'cron';
import moment from 'moment';
import Decimal from 'decimal.js';
import Calc from './services/calc.service';

const CRON_EXPRESSION = '*/5 * * * *';
const MINUTES = 5;
const OUT_DATE_FORMAT = 'D/M/Y hh:mm:ss';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    connectWebSocket(symbol) {
        let count = 0;
        this.app.providers.binance.ws.candles(symbol, '1m', async candle => {
            let result = await this.app.providers.db.collection('kline').insert({
                symbol: candle.symbol,
                eventTime: candle.eventTime,
                price: candle.close
            });
            count++;
        });
        setInterval(() => {
            console.log('Inserted more: ' + count + ' items.');
            count = 0;
        }, 60 * 1000);
    }

    poolingData() {
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
    }

    async consolidaVela(db, collectionName, symbol) {
        let start = moment().subtract(MINUTES, "minutes").valueOf();
        let end = moment().valueOf();

        let result = await db.collection(collectionName).find({
            symbol: symbol,
            eventTime: {
                $gte: start,
                $lt: end
            }
        }).sort({ "eventTime": 1 }).toArray();

        if (result.length <= 0) {
            console.log('Nothing to analise, skipping process.');
            return;
        };

        let lastVela = await db.collection('vela').find({}).sort({ _id: -1 }).limit(1).toArray();
        lastVela = lastVela.length > 0 ? lastVela[0] : {};
        let vela = Calc.makeVela(result, lastVela.up, lastVela.down);

        let action = null;

        if (vela.vela == 1 && lastVela && lastVela.vela != 1)
            action = 'BUY';
        else if (lastVela && lastVela.vela == 1 && vela.vela != 1)
            action = 'SELL';

        await db.collection('vela').insert(vela = {
            up: vela.up,
            down: vela.down,
            symbol: symbol,
            rsi: vela.rsi,
            vela: vela.vela,
            qty: vela.qty,
            price: vela.closePrice,
            minutes: MINUTES,
            action: action,
            created_at: moment().valueOf()
        });
        console.log('Inserted vela: ');
        console.log(vela);
    };

    async initializeConfig() {
        let current = await this.app.providers.db.collection('config').findOne({
            key: 'general'
        });

        if (!current) {
            current = await this.app.providers.db.collection('config').replaceOne(
                { key: 'general' },
                {
                    symbol: "ZILBTC",
                    key: 'general',
                    nextExecutionTime: null,
                    cron: CRON_EXPRESSION,
                    running: true,
                    allowTrade: false,
                    minutes: MINUTES
                },
                { upsert: true }
            );
            current = current.ops[0];
        }

        return current;
    }

    makeJob(db, startConfig) {
        return new CronJob({
            cronTime: startConfig.cron,
            onTick: async () => {
                let current = await db.collection('config').findOne({
                    key: 'general'
                });

                console.log('Current config: ');
                console.log(current);

                if (current && current.running) await this.consolidaVela(db, 'kline', current.symbol);;

                console.log('Job next execution time: ' + moment(this.job.nextDates()).format(OUT_DATE_FORMAT));
                await db.collection('config').updateOne(
                    { key: 'general' },
                    {
                        $set: {
                            nextExecutionTime: moment(this.job.nextDates()).valueOf(),
                        }
                    }
                );
            },
            start: false,
            timeZone: 'America/Sao_Paulo'
        });
    }

    run() {
        this.initializeConfig().then(async (config) => {
            console.log('Start config: ');
            console.log(config);
            this.connectWebSocket(config.symbol);
            this.job = this.makeJob(this.app.providers.db, config);
            this.job.start();
            await this.app.providers.db.collection('config').updateOne(
                { key: 'general' },
                {
                    $set: {
                        nextExecutionTime: moment(this.job.nextDates()).valueOf(),
                    }
                }
            );
            console.log('Service started, job next execution time: ' + moment(this.job.nextDates()).format(OUT_DATE_FORMAT));
        });
    }
}