import moment from 'moment';

const OUT_DATE_FORMAT = 'DD/MM/Y HH:mm:ss';

export default function log(msg) {
    const date = moment().format(OUT_DATE_FORMAT);
    console.log(`${date}: ${msg}`);
};