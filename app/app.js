import express from 'express';
import ServiceProvider from './providers';

let _application = null;

export default class Application {

    constructor(){
        this.port = process.env.port || 3000;
        this.public_dir = 'public';
        this.express = express();
    }

    async boostrap() {
        this.express.use('/public', express.static(this.public_dir));
        this.express.get('/api/ping', (req, res) => res.send('pong'));
        this._serviceProvider = new ServiceProvider(this);
        await this._serviceProvider.register();
        this._serviceProvider.registerRoutes();
    }

    listen() {
        this.express.listen(this.port, () => console.log(`App listening on port: ${this.port}`));
    }

    get providers(){
        return this._serviceProvider.providers;
    }
    
    static get instance(){
        return _application;
    }
};