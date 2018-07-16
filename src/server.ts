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
		
		app.get('/graph_closure.csv', (req, res) => {
			res.sendFile(__dirname.replace(/\/js$/g,"/docs") + '/graph_closure.csv');
		});
		
    http.listen(this.port, () => {
			console.log('listening on *:' + this.port);
		});
  }
}

new Server(3000);
