"use strict";
console.log("Running webapp...");

var Express = require('express'),
	bodyParser = require('body-parser');

var app = new Express(),
	port = process.env.PORT || 80;

app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

app.use(Express.static('./app'));
app.get('/messages',(req,res)=>{
	res.status(200).json(require('./messages.json'));
});
app.listen(port,()=>{
	//console.log(`Running webhook listener...`);
	console.log(`App listening on port ${port}`);
}) ;
