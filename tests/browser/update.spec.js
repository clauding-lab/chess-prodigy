import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';

test('a real waiting service worker defers active play and preserves saves when accepted',async({page})=>{
 let version=1;
 const root=resolve('dist');
 const server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   const file=resolve(root,path==='/'?'index.html':'.'+path);
   if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
   let body=await readFile(file);
   if(path==='/sw.js')body=Buffer.from(body.toString().replace(/url:"index.html",revision:"[^"]+"/, 'url:"index.html",revision:"test-release-'+version+'"'));
   if(path==='/'||path==='/index.html')body=Buffer.from(body.toString().replace('</head>','<meta name="chess-test-release" content="'+version+'"/></head>'));
   const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
   res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-cache'}).end(body);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);await page.getByRole('button',{name:'Start',exact:true}).click();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
  if(await page.getByRole('button',{name:'Start',exact:true}).isVisible())await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button',{name:'e2, white pawn'}).click();await page.getByRole('button',{name:'e4, empty'}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v2')).game.hist.length)).toBe(2);
  const oldId=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v2')).game.id);
  version=2;
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await expect.poll(()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
  await expect(page.getByLabel('App update')).toContainText('wait until your game finishes');
  await expect(page.getByRole('button',{name:'Update now',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v2')).game.id)).toBe(oldId);
  await page.getByRole('button',{name:'Resign',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Resign',exact:true}).click();
  await page.getByRole('button',{name:'View board',exact:true}).click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v2')));
  await expect(page.getByRole('button',{name:'Update now',exact:true})).toBeVisible();
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Update now',exact:true}).click()]);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v2')));
  expect(after.game).toEqual(before.game);expect(after.rating).toEqual(before.rating);expect(after.preferences).toEqual(before.preferences);
  await expect(page.locator('meta[name="chess-test-release"]')).toHaveAttribute('content','2');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
