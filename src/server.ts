export class Server{
  port: number;

  constructor(port: number){
    this.port = port;

		var app = require('express')();
		var http = require('http').Server(app);

		app.get('/', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/index.html');
		});

		app.get('/app.js', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/app.js');
		});

		app.get('/logo.png', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/logo.png');
		});

		app.get('/main.css', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/main.css');
		});

		app.get('/back.jpg', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/back.jpg');
		});

		app.get('/fonts/sourcehancodejp-normal-webfont.woff2', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/fonts/sourcehancodejp-normal-webfont.woff2');
		});

		app.get('/fonts/sourcehancodejp-normal-webfont.woff', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/fonts/sourcehancodejp-normal-webfont.woff');
		});

		app.get('/fonts/SourceHanCodeJP-Normal.otf', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/fonts/SourceHanCodeJP-Normal.otf');
		});

		app.get('/fonts/sourcehancodejp-normal-webfont.ttf', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/fonts/sourcehancodejp-normal-webfont.ttf');
		});

    http.listen(this.port, () => {
			console.log('listening on *:' + this.port);
		});
  }
}

new Server(3000);
