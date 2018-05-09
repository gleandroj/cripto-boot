import express from 'express';

const app = express();

const public_dir = 'public';

app.use('/public', express.static(public_dir));

app.get('/api/ping', (req, res) => {
    res.send('pong');
});

const port = process.env.port || 3000;

app.listen(port, () =>  console.log(`App listening on port: ${port}`));