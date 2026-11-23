const http =require('http');
const fs=require('fs');

const server1 = http.createServer((req,res)=>{
    const ourReadStream= fs.createReadStream(`${__dirname}/data.txt`,'utf8');
    ourReadStream.pipe(res);

});
server1.listen(3000);
console.log("listening to server 1 port no 3000....(read file)");

const server2 = http.createServer((req,res)=>{

if(req.url=='/')
{
    res.write('<body> <form method="post" action="/process"><input name="message" /></form></body>');
    res.end();
}

else if(req.url==='/process' && req.method ==='POST'){
req.on('data',(chunk)=>{
    console.log(chunk.toString());
});
 res.write('Thanks for submitting');
    res.end();
}
else{
    res.write('Not Found');
    res.end();
}

});
server2.listen(3001);
console.log("listening to server 2 port no 3001....(post method in form)");
