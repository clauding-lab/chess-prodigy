import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v1')));
async function start(page,{strong=false,timed=false}={}){
 await page.goto('/');
 if(strong)await page.getByRole('button',{name:'Strong 1800',exact:true}).click();
 if(timed)await page.getByRole('button',{name:'5 min',exact:true}).click();
 await page.getByRole('button',{name:'Start',exact:true}).click();
}
async function play(page,from,to){
 await page.getByRole('button',{name:new RegExp('^'+from+',')}).click();
 await page.getByRole('button',{name:new RegExp('^'+to+',')}).click();
 await expect.poll(async()=> (await saved(page)).game.hist.length).toBeGreaterThanOrEqual(2);
 await expect(page.locator('.status')).toContainText('Your move');
}
test('reload preserves game, rating and theme without replaying engine moves',async({page})=>{
 await start(page);await play(page,'e2','e4');
 await page.getByRole('button',{name:'Dark board',exact:true}).click();
 const before=await saved(page);await page.reload();
 await expect(page.locator('.app')).toHaveAttribute('data-theme','dark');
 expect((await saved(page)).game.hist.map(e=>e.san)).toEqual(before.game.hist.map(e=>e.san));
 expect((await saved(page)).rating).toEqual(before.rating);
 await expect(page.getByRole('button',{name:'Start',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Resign',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Resign',exact:true}).click();
 await expect(page.locator('.result')).toBeVisible();
 const result=await saved(page);await page.reload();
 await expect(page.locator('.result')).toBeVisible();
 expect((await saved(page)).rating.games).toBe(result.rating.games);
});
test('keyboard plays and dialogs trap focus; both themes pass axe checks',async({page},info)=>{
 await start(page);
 const e2=page.getByRole('button',{name:'e2, white pawn'});await e2.focus();await e2.press('Enter');
 await e2.press('ArrowUp');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
 await expect.poll(async()=> (await saved(page)).game.hist.length).toBe(2);
 await page.getByRole('button',{name:'New game',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await page.keyboard.press('Shift+Tab');
 expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 for(const theme of ['wood','dark']){
  if(theme==='dark')await page.getByRole('button',{name:'Dark board',exact:true}).click();
  const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await info.attach('axe-'+theme,{body:JSON.stringify(scan.violations,null,2),contentType:'application/json'});
  expect(scan.violations).toEqual([]);
 }
});
test('Strong search keeps the interface responsive and restart rejects old results',async({page},info)=>{
 await start(page,{strong:true});
 await page.evaluate(()=>{window.__beats=[];let last=performance.now();window.__beatTimer=setInterval(()=>{const now=performance.now();window.__beats.push(now-last);last=now;},50);});
 await page.getByRole('button',{name:'a2, white pawn'}).click();await page.getByRole('button',{name:'a3, empty'}).click();
 await page.getByRole('button',{name:'Flip',exact:true}).click();
 await expect(page.locator('.sq').first()).toHaveAttribute('aria-label','h1, white rook');
 await expect.poll(async()=> (await saved(page)).game.hist.length).toBe(2);
 const beats=await page.evaluate(()=>{clearInterval(window.__beatTimer);return window.__beats;});
 expect(beats.length).toBeGreaterThan(2);expect(Math.max(...beats)).toBeLessThan(250);
 await info.attach('heartbeat',{body:JSON.stringify({project:info.project.name,maxGapMs:Math.max(...beats),samples:beats.length}),contentType:'application/json'});
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Start',exact:true}).click();
 await expect(page.locator('.movelist')).toContainText('Moves appear here');
});
test('cached app reopens offline and calculates an out-of-book reply',async({page,context})=>{
 await start(page,{strong:true});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);
 const reopened=await context.newPage();await page.close();await reopened.goto('/');
 // A fresh unstarted game is allowed to show setup again.
 if(await reopened.getByRole('button',{name:'Start',exact:true}).isVisible())await reopened.getByRole('button',{name:'Start',exact:true}).click();
 await play(reopened,'a2','a3');
 await reopened.getByRole('button',{name:'Resign',exact:true}).click();
 await reopened.getByRole('dialog').getByRole('button',{name:'Resign',exact:true}).click();
 await reopened.getByRole('dialog').getByRole('button',{name:'Review game',exact:true}).click();
 await expect(reopened.getByRole('dialog')).toContainText('Game review');
 await expect(reopened.getByRole('dialog')).not.toContainText('analysing…',{timeout:15000});
});
test('corrupt saves remain untouched during play until recovery is confirmed',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('chess-prodigy-state-v1','broken'));
 await page.goto('/');await page.getByRole('button',{name:'Start',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('chess-prodigy-state-v1'))).toBe('broken');
 await expect(page.getByText(/damaged|corrupt|could not be read/i)).toBeVisible();
 await page.getByRole('button',{name:'Enable saving',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Enable saving',exact:true}).click();
 expect((await saved(page)).version).toBe(1);
 await expect(page.locator('.notice')).toHaveCount(0);
});
