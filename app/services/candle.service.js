import log from "./logger";

export class CandleService {
    constructor(database, config, binance){
        this.database = database;
        this.config = config;
        this.binance = binance;
    }

    async checkCandle(){
        const totalDocuments = await this.database.db.collection('candles').count();
        const result = await this.database.lastPrices().toPromise();
        log(`Total documents: ${totalDocuments}`);

        result.forEach(group => {
            log(`Analising group: ${group._id} with ${group.candles.length} prices.`);
        });

        //console.log(result);

        // if (result.length <= 0 || result.length < 2) {
        //     console.log('Nothing to analise, skipping process.');
        //     return;
        // };

        // let kline = result[1];
        // let lastVela = await db.collection('vela').find({}).sort({ created_at: -1 }).limit(1).toArray();
        // lastVela = lastVela.length > 0 ? lastVela[0] : {
        //     price: result[0].price
        // };
        // let vela = calc.makeVela(kline.price, lastVela);
        // vela.price = kline.price;
        // vela.realPrice = kline.realPrice;
        // vela.symbol = config.symbol;
        // vela.action = null;
        // vela.realProfit = null;
        // vela.profit = null;

        // if (vela.flag == 1 && lastVela && lastVela.flag != 1)
        //     vela.action = 'BUY';
        // else if (lastVela && lastVela.flag == 1 && vela.flag != 1) {
        //     let lastBuy = (await db.collection('vela').find({
        //         action: 'BUY'
        //     }).sort({ created_at: -1 }).limit(1).toArray())[0];
        //     vela.action = 'SELL';
        //     vela.realProfit = ((vela.realPrice - lastBuy.realPrice) / vela.realPrice) * 100;
        //     vela.profit = ((vela.price - lastBuy.price) / vela.price) * 100;
        // }

        // vela.created_at = moment().valueOf();
        // await db.collection('vela').insert(vela);
        // this.logVela(vela);
    }
}