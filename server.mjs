import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};

const server=createServer(async(req,res)=>{
  try{
    const url=decodeURIComponent(req.url?.split('?')[0]||'/');
    let path=normalize(join(root,url==='/'?'index.html':url.replace(/^\//,'')));
    if(!path.startsWith(root)) throw new Error('bad path');
    try{const s=await stat(path); if(s.isDirectory()) path=join(path,'index.html');}catch{}
    let data; try{data=await readFile(path);}catch{path=join(root,'index.html');data=await readFile(path);}
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,()=>console.log(`Couple Guild running at http://localhost:${port}`));
