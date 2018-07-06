import log from './services/logger';

export default class BackgroundWorker {

    constructor(app) {
        this.app = app;
    }

    async initialize(){
        this.config = await this.database.getConfig().toPromise();
        if(this.config){
            log('Boot initialized.');
        }
    }

    run() {
        this.database = this.app.providers.database;
        this.initialize().then(() => { });
        this.database.configSubject.subscribe((config) => {
            this.config = config;
            log('Config updated.');
        });
    }
}