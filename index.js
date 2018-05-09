import dotenv from 'dotenv';
import Application from './app/app';
import BackgroundWorker from './app/worker';

dotenv.config();

let app = new Application();
let worker = new BackgroundWorker(app);

worker.run();
app.listen();
