
/*export default*/ class Calc {

    constructor(dnsens) {
        this.dnsens = dnsens || 9;
        this.upsens = 100 - dnsens; //Quanto mais perto de 100 menos sensivel fica
    }

    rma(cur, prev) {
        return (cur + prev) / 2;
    };

    rsi(current, last, lastRmaUP, lastRmaDown) {
        let up = this.rma(Math.max(current - last, 0), lastRmaUP);
        let down = this.rma(Math.abs(Math.min(current - last, 0)), lastRmaDown);
        let rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down));
        return {
            rsi: rsi,
            up: up,
            down: down
        };
    };

    makeVela(currentPrice, lastPrice, lastRSI) {
        let rsiObj = this.rsi(currentPrice, lastPrice, lastRSI.up || 0, lastRSI.down || 0);
        rsiObj.flag = rsiObj.rsi < this.dnsens ? 0 : rsiObj.rsi > this.upsens ? 1 : 2;
        return rsiObj;
    }
}

module.exports = Calc;