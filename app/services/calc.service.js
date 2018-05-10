
export default class Calc {

    static makeVela(data, lastUp, lastDown) {
        let value = {
            last: null,
            up: 0,
            down: 0
        };

        data.map((current, i) => {
            if (value.last != null) {
                let r = (current.price - value.last.price);
                if (r > 0) {
                    value.up += r;
                } else {
                    value.down += r;
                }
            }
            value.last = current;
        });

        let closePrice = parseFloat(data[data.length - 1].price);


        let up = 0;
        let down = 0;

        if (!lastUp || !lastDown) {
            lastUp = value.up / data.length;
            lastDown = Math.abs(value.down) / data.length;
        }

        let k = (2 / data.length + 1);

        up = ((closePrice - (lastUp)) * k) + lastUp;
        down = ((closePrice - (lastDown)) * k) + lastDown;

        let fr = up / down;
        let rsi = 100 - (100 / (1 + fr));

        //Configurações Iniciais
        let dnsens = 9; //Sensibilidade do RSI
        let needbg = true;
        let upsens = 100 - dnsens; //Quanto mais perto de 100 menos sensivel fica

        let vela = rsi < dnsens ? 0 : rsi > upsens ? 1 : 2;

        return {
            up: up,
            down: down,
            rsi: isNaN(rsi) ? null : rsi,
            vela: vela,
            closePrice: closePrice,
            qty: data.length
        };
    }
}

//module.exports = Calc;