export default (app) => {
    const db = app.providers.database;

    const getConfig = async (req, res) => {
        res.json(await db.getConfig().toPromise());
    };

    const updateConfig = async (req, res) => {
        const config = req.body;
        res.json(await db.updateConfig(config).toPromise());
    };

    const get = async (req, res) => {
        res.redirect('/public');
    };

    app.express.route('/').get(get);
    app.express.route('/api/setup').get(getConfig);
    app.express.route('/api/setup').post(updateConfig);

    // app.express.route('/api/vela').get(getVela);
    // app.express.route('/api/kline').get(getKline);
    // app.express.route('/api/config').get(getConfig);
    // app.express.route('/api/symbols').get(getSymbols);
    // app.express.route('/api/trades').get(getTrades);
};