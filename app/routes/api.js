export default (app) => {
    let binance = app.providers.binance;
    const get = async (req, res) => {
        try{
            res.json(await binance.prices())
        }catch(err){
            console.log(err);
            res.json(err);
        };
    };
    app.express.route('/api/binance').get(get);
};