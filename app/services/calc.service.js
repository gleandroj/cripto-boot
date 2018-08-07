import log from "./logger";

export default class Calc {

    constructor(dnsens) {
        this.dnsens = dnsens || 9;
        this.upsens = 100 - dnsens; //Quanto mais perto de 100 menos sensivel fica
    }

    ema(cur, prev, period) {
        if(prev){
            const aux = (2 / (period + 1));
            return (aux * cur) + ((1 - aux) * prev);
        }
        return cur;
    }

    rsi(cur, prev, lastRSI, period) {

        lastRSI = lastRSI ? lastRSI : {};
        prev = prev ? prev : cur;
        let up = this.ema(Math.max(cur - prev, 0), lastRSI.up, period);//
        let down = this.ema(Math.abs(Math.min(cur - prev, 0)), lastRSI.down, period);//
        let rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down));

        if (up < 0 || down < 0 || rsi < 0) {
            console.log("Max: " + Math.max(cur - prev, 0));
            console.log("Min: " + Math.abs(Math.min(cur - prev, 0)));
            console.log(`UP: ${up}`);
            console.log(`Down: ${down}`);
            console.log(`Current: ${cur}`);
            console.log(`Prev: ${prev}`);
            console.log(`RSI: ${rsi}`);
            console.log(
                "EMA: " + ((2 / period + 1) * cur) + ((1 - (2 / period + 1)) * prev)
            );
        }
        
        if(rsi > 100){
            console.log("RSI > 100");
            console.log("RSI: " + rsi);
        }

        return {
            rsi: rsi,
            up: up,
            down: down,
            flag: rsi < this.dnsens ? 0 : rsi > this.upsens ? 1 : 2
        };
    }
}