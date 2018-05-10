let Calc = require("./app/services/calc.service");
let json = require('./test.json');
let rsi = (new Calc()).makeVela(json.current, 6.122931442080388e-9, 5.815602836879441e-9);
console.log(rsi);

