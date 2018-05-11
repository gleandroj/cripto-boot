import path from 'path';
import { CronTime } from 'cron';
import moment from 'moment';

export default (app) => {
    let binance = app.providers.binance;
    let db = app.providers.db;

    const getVela = async (req, res) => {
        try {
            res.json(await db.collection('vela').find({}).toArray())
        } catch (err) {
            console.log(err);
            res.json(err);
        };
    };

    const getKline = async (req, res) => {
        try {
            res.json(await db.collection('kline').find({}).toArray())
        } catch (err) {
            console.log(err);
            res.json(err);
        };
    };

    const getConfig = async (req, res) => {
        try {
            res.json(await db.collection('config').findOne({ key: 'general' }));
        } catch (err) {
            console.log(err);
            res.json(err);
        };
    };

    const isCronValid = function (cron) {
        try {
            (new CronTime(cron));
            return true;
        } catch (err) {
            return false;
        }
    }

    const updateConfig = async (req, res) => {
        try {
            if (!isCronValid(req.body.config.cron)) {
                res.status(400);
                res.json({ description: 'Invalid cron expression.' });
                return;
            } else {
                delete req.body.config._id;
                req.body.config.updated_at = moment().valueOf();
                let config = await db.collection('config').updateOne({ key: 'general' }, { $set: req.body.config });
                await getConfig(req, res);
            }
        } catch (err) {
            console.log(err);
            res.json(err);
        };
    };

    const get = async (req, res) => {
        res.redirect('/public');
    };
    app.express.route('/').get(get);
    app.express.route('/api/vela').get(getVela);
    app.express.route('/api/kline').get(getKline);
    app.express.route('/api/config').get(getConfig);
    app.express.route('/api/config').post(updateConfig);
};