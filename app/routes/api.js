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

    app.express.route('/api/vela').get(getVela);
    app.express.route('/api/kline').get(getKline);
    app.express.route('/api/config').get(getConfig);
};