import moment from 'moment-timezone';
import log from './../logger';
import { delay, switchMap } from 'rxjs/operators';
import { roundPrice } from "./../helpers";

export const STATUS_OPENED = 0;
export const STATUS_CLOSED = 1;

export class BinanceTrader {

    constructor(binance) {
        this.binance = binance;
    }

    async exchangeInfo() {
        return await this.binance.exchangeInfo().toPromise();
    }

    async cancelOrder(symbol, orderId) {
        try {
            await this.binance.cancelOrder(
                symbol,
                orderId
            ).toPromise();
        } catch (e) {
            log(`Unable to cancel order (${orderId}) for symbol ${symbol}.`)
            log(`'Error: ${e.message}.`);
            return null;
        }
    }

    async stopLossOrder(symbol, quantity, stopLossTrigger, stopLossSell) {
        try {
            return await this.binance.stopLoss(
                symbol,
                quantity,
                stopLossTrigger,
                stopLossSell
            ).toPromise();
        } catch (e) {
            log(`Unable to put stop loss order to symbol ${symbol}.`);
            log(`Error: ${e.message}`);
            return null;
        }
    }

    async buy(symbol, quantity, price, market) {
        try {
            const binanceTrade = await this.binance.buyMarket(
                symbol,
                quantity
            ).pipe(
                delay(700),
                switchMap(() => this.binance.getLastTrade(symbol))
            ).toPromise();
            const tradeRealPrice = parseFloat(binanceTrade.price);
            const stopLossTrigger = roundPrice((tradeRealPrice * ((100 - 1.5) / 100)), market);
            const stopLossSell = roundPrice((tradeRealPrice * ((100 - 1.8) / 100)), market);
            const stopLossTrade = await this.stopLossOrder(symbol, quantity, stopLossTrigger, stopLossSell);
            return {
                symbol: symbol,
                status: STATUS_OPENED,
                quantity: quantity,
                ask_at: moment().valueOf(),
                ask_price: tradeRealPrice,
                bid_at: null,
                bid_price: null,
                profit: null,
                stop_loss_trigger: stopLossTrigger,
                stop_loss_sell: stopLossSell,
                binanceBuyTrade: binanceTrade,
                stopLossOrder: stopLossTrade
            };
        } catch (e) {
            log(`Unable to buy symbol ${symbol}.`)
            log(`Error: ${e.message}.`);
        }
    }

    updateSellTrade(trade, binanceTrade){
        const tradeRealPrice = parseFloat(binanceTrade.price);
        trade.status = STATUS_CLOSED;
        trade.bid_at = moment().valueOf();
        trade.bid_price = tradeRealPrice;
        trade.profit = (((trade.bid_price - trade.ask_price) / trade.ask_price) - 0.0015) * 100;
        trade.binanceSellTrade = binanceTrade;
        return trade;
    }
    
    async sell(trade, price, market) {
        try {
            if (trade.stopLossOrder != null && trade.stopLossOrder.orderId != null) {
                await this.cancelOrder(
                    trade.symbol,
                    trade.stopLossOrder.orderId
                );
            }
            const binanceTrade = await this.binance.sellMarket(
                trade.symbol,
                trade.quantity
            ).pipe(
                delay(1000),
                switchMap((r) => {
                    return this.binance.getLastTrade(trade.symbol);
                })
            ).toPromise();
            
            return this.updateSellTrade(trade, binanceTrade);
        } catch (e) {
            log(`Unable to sell symbol ${symbol}.`)
            log(`'Error: ${e.message}.`);
        }
    }

    async getLastTrade(symbol){
        return await this.binance.getLastTrade(symbol).toPromise();
    }
}