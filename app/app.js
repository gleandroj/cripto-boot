import express from 'express';
import bodyParser from 'body-parser';
import ServiceProvider from './providers';
import log from './services/logger';

export default class Application {

    constructor() {
        this.port = process.env.PORT || 3000;
        this.public_dir = 'public';
        this.express = express();
    }

    async boostrap() {
        this.express.use(bodyParser.json());
        this.express.use(bodyParser.urlencoded({ extended: true }));
        this.express.use('/public', express.static(this.public_dir));
        this.express.get('/api/ping', (req, res) => res.send('pong'));
        this._serviceProvider = new ServiceProvider(this);
        await this._serviceProvider.register();
        this._serviceProvider.registerRoutes();
    }

    listen() {
        this.express.listen(this.port, () => log(`App listening on port: ${this.port}`));
    }

    get providers() {
        return this._serviceProvider.providers;
    }
};