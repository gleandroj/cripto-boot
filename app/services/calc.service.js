
/*export default*/ class Calc {

    constructor(dnsens) {
        this.dnsens = dnsens || 9;
        this.upsens = 100 - dnsens; //Quanto mais perto de 100 menos sensivel fica
    }

    rma(cur, prev) {
        return (0.667 * cur) + (0.333 * prev);
    }

    rsi(current, last, lastRmaUP, lastRmaDown) {
        let up = this.rma(Math.max(current - last, 0), lastRmaUP);
        let down = this.rma(Math.abs(Math.min(current - last, 0)), lastRmaDown);
        let rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down));
        return {
            rsi: rsi,
            up: up,
            down: down,
            flag: rsi < this.dnsens ? 0 : rsi > this.upsens ? 1 : 2
        };
    }
    

    makeVela(currentPrice, lastRSI) {
        return this.rsi(currentPrice, lastRSI.price || 0, lastRSI.up || 0, lastRSI.down || 0);
    }
}

module.exports = Calc;