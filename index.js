import dotenv from 'dotenv';
import Application from './app/app';
import BackgroundWorker from './app/worker';

dotenv.config();

let app = new Application();
let worker = new BackgroundWorker(app);

//worker.run();
/**
 * Boostrap Application Services
 * Eg: DB, Binance, Etc..
 */
app.boostrap().then(()=>{}, (err) => {
    console.log(err);
    process.exit(1);
});

/**
 * Listen app requests
 */
app.listen();  