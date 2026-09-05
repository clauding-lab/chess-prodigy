import {test,expect} from '@playwright/test';
test('a stopped native worker recovers once; repeated failure exposes an actionable retry',async({page})=>{
 await page.addInitScript(()=>{
  const post=Worker.prototype.postMessage;
  window.__dropAi=true;window.__aiAttempts=0;
  Worker.prototype.postMessage=function(request,...rest){
   if(request.type==='ai'){
    window.__aiAttempts++;
    if(window.__dropAi){this.terminate();return;}
   }
   return post.call(this,request,...rest);
  };
 });
 await page.goto('/');await page.getByRole('button',{name:'Start',exact:true}).click();
 await page.getByRole('button',{name:'a2, white pawn'}).click();await page.getByRole('button',{name:'a3, empty'}).click();
 await expect(page.getByRole('button',{name:'Try the engine again',exact:true})).toBeVisible({timeout:10000});
 expect(await page.evaluate(()=>window.__aiAttempts)).toBe(2);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v1')).game.hist.length)).toBe(1);
 await page.evaluate(()=>window.__dropAi=false);
 await page.getByRole('button',{name:'Try the engine again',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v1')).game.hist.length)).toBe(2);
 await expect(page.getByRole('button',{name:'Try the engine again',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>window.__aiAttempts)).toBe(3);
});
