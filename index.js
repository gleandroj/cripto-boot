import dotenv from 'dotenv';
import Application from './app/app';
import BackgroundWorker from './app/worker';

dotenv.config();

let app = new Application();
let worker = new BackgroundWorker(app);

/**
 * Boostrap Application Services
 * Eg: DB, Binance, Etc..
 */
app.boostrap().then(() => {
    /**
    * Background worker
    */
    worker.run();
    /**
     * Listen app requests
     */
    app.listen();
}, (err) => {
    console.log(err);
    process.exit(1);
});

