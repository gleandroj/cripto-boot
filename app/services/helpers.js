
// Effectively counts the number of decimal places, so 0.001 or 0.234 results in 3
export const getPrecision = function (tickSize) {
    if (!isFinite(tickSize)) return 0;
    let e = 1, p = 0;
    while (Math.round(tickSize * e) / e !== tickSize) { e *= 10; p++; }
    return p;
};

export const round = function (amount, tickSize) {
    let precision = 100000000;
    let t = getPrecision(tickSize);

    if (Number.isInteger(t))
        precision = Math.pow(10, t);

    amount *= precision;
    amount = Math.floor(amount);
    amount /= precision;

    // https://gist.github.com/jiggzson/b5f489af9ad931e3d186
    amount = scientificToDecimal(amount);

    return amount;
};

// https://gist.github.com/jiggzson/b5f489af9ad931e3d186
export const scientificToDecimal = function (num) {
    if (/\d+\.?\d*e[\+\-]*\d+/i.test(num)) {
        let zero = '0';
        let parts = String(num).toLowerCase().split('e'); // split into coeff and exponent
        let e = parts.pop(); // store the exponential part
        let l = Math.abs(e); // get the number of zeros
        let sign = e / l;
        let coeff_array = parts[0].split('.');
        if (sign === -1) {
            num = zero + '.' + new Array(l).join(zero) + coeff_array.join('');
        } else {
            let dec = coeff_array[1];
            if (dec) {
                l = l - dec.length;
            }
            num = coeff_array.join('') + new Array(l + 1).join(zero);
        }
    } else {
        // make sure we always cast to string
        num = num + '';
    }

    return num;
}

export const roundAmount = function (amount, market) {
    return round(amount, market.minimalOrder.amount);
}

export const roundPrice = function (price, market) {
    return round(price, market.minimalOrder.price);
}

export const isValidPrice = function (price, market) {
    return price >= market.minimalOrder.price;
}

export const isValidLot = function (price, amount, market) {
    return amount * price >= market.minimalOrder.order;
}