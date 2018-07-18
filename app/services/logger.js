import moment from 'moment-timezone';

const OUT_DATE_FORMAT = 'DD/MM/Y HH:mm:ss';

export default function log(msg) {
    const date = moment().tz('America/Sao_Paulo').format(OUT_DATE_FORMAT);
    console.log(`${date}: ${msg}`);
};