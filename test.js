/*let Calc = require("./app/services/calc.service");
let json = require('./test.json');

function rma(cur, prev) {
    return (cur + prev) / 2;
};

function rsi(current, last, lastRmaUP, lastRmaDown) {
    let up = rma(Math.max(current - last, 0), lastRmaUP);
    let down = rma(Math.abs(Math.min(current - last, 0)), lastRmaDown);
    let rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down));
    return {
        rsi: rsi,
        up: up,
        down: down,
        price: current
    };
};

let calc = (new Calc(9));
let last = null, lastVela = {};

json.last.forEach((v) => {
    if(last == null){
        last = v;
        return;
    }
    let vela = calc.makeVela(v.price, last.price, lastVela);
    lastVela = vela;
});
*/