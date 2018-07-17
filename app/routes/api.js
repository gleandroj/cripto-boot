export default (app) => {
    const db = app.providers.database;
    const auth = app.providers.auth;
    const binance = app.providers.binance;

    const authCheck = function (req, res) {
        if (!req.session.token) {
            res.status(401);
            res.json({
                error: 'unauthenticated',
                message: 'Não autenticado.'
            });
            return false;
        }

        return true;
    };

    const getConfig = async (req, res) => {
        if (authCheck(req, res)) {
            res.json(await db.getConfig().toPromise());
        }
    };

    const updateConfig = async (req, res) => {
        if (authCheck(req, res)) {
            const config = req.body;
            res.json(await db.updateConfig(config).toPromise());
        }
    };

    const get = async (req, res) => {
        res.redirect('/public');
    };

    const login = (req, res) => {
        const result = auth.attemp(req.body.username, req.body.password);
        if (result) {
            req.session.token = result.token;
            res.json(result);
        } else {
            res.status(401);
            res.json({
                error: 'invalid_credetials',
                message: 'Usuário ou senha incorretos'
            });
        }
    };

    const logout = (req, res) => {
        if (authCheck(req, res)) {
            req.session.destroy();
            res.json({ success: true });
        }
    };

    const trades = async (req, res) => {
        if (authCheck(req, res)){
            const page_size = req.body.page_size || 50;
            const page = req.body.page || 1;
            res.json({
                total: (await db.countTrades().toPromise()),
                data: (await db.paginateTrades(page_size, page).toPromise())
            });
        }
    };

    app.express.route('/').get(get);
    app.express.route('/api/trades').get(trades);
    app.express.route('/api/setup').get(getConfig);
    app.express.route('/api/setup').post(updateConfig);
    app.express.route('/api/login').post(login);
    app.express.route('/api/logout').get(logout);

    // app.express.route('/api/vela').get(getVela);
    // app.express.route('/api/kline').get(getKline);
    // app.express.route('/api/config').get(getConfig);
    // app.express.route('/api/symbols').get(getSymbols);
    // app.express.route('/api/trades').get(getTrades);
};