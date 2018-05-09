'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var app = (0, _express2.default)();

var public_dir = 'public';

app.use('/public', _express2.default.static(public_dir));

app.get('/api/ping', function (req, res) {
    res.send('pong');
});

var port = process.env.port || 3000;

app.listen(port, function () {
    return console.log('App listening on port: ' + port);
});