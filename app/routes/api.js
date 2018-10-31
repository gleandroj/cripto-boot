

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
            const setup = await db.getConfig().toPromise();
            let coins = [];
            if(setup){
                coins = (await binance.symbols().toPromise()).filter((s) => (new RegExp(`${setup.pair}$`)).test(s));
            }else{
                coins = await binance.symbols().toPromise();
            }
            res.json({
                setup: setup,
                coins: coins
            });
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
        if (authCheck(req, res)) {
            const getBalance = async(config) => {
                try{
                    return config ? (await binance.balances(config.pair).toPromise()) : null;
                }catch(e){
                    //console.log("Error: " + e.message);
                    return 0;
                }
            };
            const config = (await db.getConfig().toPromise());
            const rate = (await db.dailySuccessRate().toPromise())[0];
            const totalTrades = (await db.countTrades().toPromise());
            const page_size = req.query.page_size || 50;
            const page = req.query.page || 1;
            const data = (await db.paginateTrades(page_size, page).toPromise());
            const balance = await getBalance(config);
            res.json({
                total: totalTrades,
                data: data,
                balance: balance,
                dailySuccessRate: rate ? rate.rate : 0
            });
        }
    };

    const exportTrades = async (req, res) => {
        if (authCheck(req, res) || true) {
            const trades = (await db.trades().toPromise());
            if(trades.length === 0){
                res.xls('data.xlsx', [{}]);
                return;
            }
            res.xls('data.xlsx', trades);
        }
    };

    app.express.route('/').get(get);
    app.express.route('/api/trades').get(trades);
    app.express.route('/api/trades/export').get(exportTrades);
    app.express.route('/api/setup').get(getConfig);
    app.express.route('/api/setup').post(updateConfig);
    app.express.route('/api/login').post(login);
    app.express.route('/api/logout').get(logout);
};