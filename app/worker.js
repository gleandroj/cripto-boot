import { CronJob, CronTime } from 'cron';
import moment from 'moment';
import Decimal from 'decimal.js';
import Calc from './services/calc.service';

const MINUTES = 5;
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
                price: ((parseFloat(candle.open) + parseFloat(candle.close) + parseFloat(candle.high) + parseFloat(candle.low)) / 4),
                realPrice: candle.close
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

    logVela(vela) {
        console.log('Inserted vela: ');
        console.log(`Symbol: ${vela.symbol}, Rsi: ${vela.rsi}, Up: ${vela.up}, Down: ${vela.down}, Price: ${vela.price}, Action: ${vela.action}, Flag: ${vela.flag}`);
    }

    async consolidaVela(config, calc, db) {
        let result = await db.collection('kline').find({
            symbol: config.symbol
        }).sort({ "eventTime": -1 }).limit(2).toArray();

        if (result.length <= 0 || result.length < 2) {
            console.log('Nothing to analise, skipping process.');
            return;
        };

        let currentPrice = result[1].price;
        let lastVela = await db.collection('vela').find({}).sort({ created_at: -1 }).limit(1).toArray();
        lastVela = lastVela.length > 0 ? lastVela[0] : {
            price: result[0].price
        };
        let vela = calc.makeVela(currentPrice, lastVela);
        vela.action = null;
        if (vela.flag == 1 && lastVela && lastVela.flag != 1)
            vela.action = 'BUY';
        else if (lastVela && lastVela.flag == 1 && vela.flag != 1) {
            let lastBuy = (await db.collection('vela').find({
                action: 'BUY'
            }).sort({ created_at: -1 }).limit(1).toArray())[0];
            vela.action = 'SELL';
            vela.profit = ((vela.price - lastBuy.price) / vela.price);
        }

        vela.price = currentPrice;
        vela.symbol = config.symbol;
        vela.created_at = moment().valueOf();
        await db.collection('vela').insert(vela);
        this.logVela(vela);
    };

    async initializeConfig() {
        let current = await this.getCurrentConfig();
        let coll = await this.app.providers.db.listCollections({ name: 'kline' }).toArray();
        if (coll.length == 0) {
            await this.app.providers.db.createCollection("kline", {
                "capped": true,
                "size": 100000,
                "max": 100
            });
            console.log('Kline collection created.');
        }

        if (!current) {
            let curr = moment().valueOf();
            current = await this.app.providers.db.collection('config').replaceOne(
                { key: 'general' },
                {
                    symbol: "ZILBTC",
                    key: 'general',
                    nextExecutionTime: null,
                    cron: CRON_EXPRESSION,
                    running: true,
                    allowTrade: false,
                    dnsens: DNSENS,
                    updated_at: curr,
                    created_at: curr
                },
                { upsert: true }
            );
            current = current.ops[0];
        }

        return current;
    }

    logConfig(current) {
        console.log('Current config: ');
        console.log(`Symbol: ${current.symbol}, Allow trade: ${current.allowTrade}, Running: ${current.running}, Cron: ${current.cron}, Dnsense: ${current.dnsens}.`);
    }

    async getCurrentConfig() {
        return await this.app.providers.db.collection('config').findOne({
            key: 'general'
        });
    }

    makeJob(db, startConfig) {
        return new CronJob({
            cronTime: startConfig.cron,
            onTick: async () => {
                let current = await this.getCurrentConfig();
                //this.logConfig(current);
                await this.consolidaVela(current, new Calc(startConfig.dnsens), db);
                this.logJobNextExecution();
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

    logJobNextExecution() {
        console.log('Job next execution time: ' + moment(this.job.nextDates()).format(OUT_DATE_FORMAT));
    }

    listenConfig(startConfig) {
        let interval = setInterval(async () => {
            let current = await this.getCurrentConfig();

            if (startConfig.updated_at != current.updated_at) {
                clearInterval(interval);
                console.log('Job config modified');
                if (this.job.running) this.job.stop();
                this.job = this.makeJob(this.app.providers.db, current);
                if (current.running) {
                    this.job.start();
                    this.logJobNextExecution();
                }
                this.listenConfig(current);
                this.logConfig(current);
            }

        }, 1000);
    }

    run() {
        this.initializeConfig().then(async (config) => {
            this.connectWebSocket(config.symbol);
            this.job = this.makeJob(this.app.providers.db, config);
            if (config.running) this.job.start();
            this.listenConfig(config);
            await this.app.providers.db.collection('config').updateOne(
                { key: 'general' },
                {
                    $set: {
                        nextExecutionTime: moment(this.job.nextDates()).valueOf(),
                    }
                }
            );
            console.log('Service started...');
            this.logConfig(config);
            if (config.running) this.logJobNextExecution();
        });
    }
}