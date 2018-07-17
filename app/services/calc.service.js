
export default class Calc {

    constructor(dnsens) {
        this.dnsens = dnsens || 9;
        this.upsens = 100 - dnsens; //Quanto mais perto de 100 menos sensivel fica
    }

    rma(cur, prev) {
        return prev ? (0.667 * cur) + (0.333 * prev) : cur;
    }

    rsi(haFec, lastHaFec, haMin, lastHaMin, lastRmaUP, lastRmaDown) {
        lastHaFec = lastHaFec ? lastHaFec : haFec;
        lastHaMin = lastHaMin ? lastHaMin : haMin;

        let up = this.rma(Math.max(haFec - lastHaFec, 0), lastRmaUP);
        let down = this.rma(Math.abs(Math.min(haMin - lastHaMin, 0)), lastRmaDown);
        let rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down));
        return {
            rsi: rsi,
            up: up,
            down: down,
            flag: rsi < this.dnsens ? 0 : rsi > this.upsens ? 1 : 2
        };
    }
}