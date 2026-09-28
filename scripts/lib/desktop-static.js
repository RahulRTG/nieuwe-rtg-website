'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
module.exports = async function (directory) {
  const root = path.resolve(directory);
  const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
  const server = http.createServer((req,res) => {
    let file;
    try {
      const url = new URL(req.url,'http://localhost');
      file = path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if (!file.startsWith(root+path.sep) && file !== root) throw new Error('path');
      if (fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
      const body = fs.readFileSync(file);
      res.writeHead(200, {'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
    } catch (_) { res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found'); }
  });
  await new Promise((resolve,reject) => { server.once('error',reject);server.listen(0,'127.0.0.1',resolve); });
  return {base:'http://127.0.0.1:'+server.address().port, close:()=>new Promise(resolve=>server.close(resolve))};
};
