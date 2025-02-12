const express = require('express');
const app = express();
const http = require('http');
const path = require("path");
const dbApi = require('./src/api/routes/db');

// Mongoose
require("./src/api/models/db.js");
// const server = http.createServer(app);
// const { Server } = require("socket.io");
// const io = new Server(server);
const port = 3000;

app.use('/api', (req, res, next) => {
    //res.header('Access-Control-Allow-Origin', 'http://localhost:4200'); //should solve CORS error? (put heroku link later)
    res.header('Access-Control-Allow-Origin', '*'); // TODO works only with *
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.get('/', (req, res) => {   
    res.send('Hello World!');
});

app.use('/api', dbApi);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

module.exports = app;