import { CronJob, CronTime } from 'cron';
import moment from 'moment';
import Decimal from 'decimal.js';
import Calc from './services/calc.service';

const MINUTES = 1;
const CRON_EXPRESSION = `*/${MINUTES} * * * *`;
const OUT_DATE_FORMAT = 'D/M/Y hh:mm:ss';
const DNSENS = 9;

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
                price: parseFloat(candle.close)
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

    async consolidaVela(config, calc, db) {
        let result = await db.collection('kline').find({
            symbol: config.symbol
        }).sort({ "eventTime": -1 }).limit(2).toArray();

        if (result.length <= 0 || result.length < 2) {
            console.log('Nothing to analise, skipping process.');
            return;
        };

        let currentPrice = result[1].price, lastPrice = result[0].price;
        let lastVela = await db.collection('vela').find({}).sort({ created_at: -1 }).limit(1).toArray();
        lastVela = lastVela.length > 0 ? lastVela[0] : {};

        let vela = calc.makeVela(currentPrice, lastPrice, lastVela);

        vela.action = null;
        if (vela.flag == 1 && lastVela && lastVela.flag != 1)
            vela.action = 'BUY';
        else if (lastVela && lastVela.flag == 1 && vela.flag != 1)
            vela.action = 'SELL';
        console.log(currentPrice);
        vela.price = currentPrice;
        vela.symbol = config.symbol;
        vela.minutes = config.minutes;
        vela.created_at = moment().valueOf();
        await db.collection('vela').insert(vela);

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
                    minutes: MINUTES,
                    dnsens: DNSENS
                },
                { upsert: true }
            );
            current = current.ops[0];
        }

        return current;
    }

    makeJob(db, startConfig) {
        let calc = new Calc(startConfig.minutes, startConfig.dnsens);
        return new CronJob({
            cronTime: startConfig.cron,
            onTick: async () => {
                let current = await db.collection('config').findOne({
                    key: 'general'
                });

                console.log('Current config: ');
                console.log(current);

                if (current && current.running) await this.consolidaVela(current, calc, db);

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
            timeZone: 'America/Sao_Paulo',
            runOnInit: true
        });
    }

    run() {
        this.initializeConfig().then(async (config) => {
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