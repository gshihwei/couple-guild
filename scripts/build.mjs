import { cp, mkdir, rm } from 'node:fs/promises';
const out='dist';
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp('index.html',`${out}/index.html`); await cp('src',`${out}/src`,{recursive:true}); await cp('public',`${out}`,{recursive:true});
console.log('Static PWA build created in dist/');
