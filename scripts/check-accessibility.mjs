import lighthouse from 'lighthouse';
import {launch} from 'chrome-launcher';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const url=process.env.CHESS_PREVIEW_URL??'http://127.0.0.1:4173';
const chrome=await launch({chromeFlags:['--headless=new','--no-sandbox']});
try{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:'+chrome.port);
 const context=browser.contexts()[0];const page=await context.newPage();
 await page.goto(url);await page.getByRole('button',{name:'Start',exact:true}).click();
 await page.getByRole('button',{name:'e2, white pawn'}).click();await page.getByRole('button',{name:'e4, empty'}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chess-prodigy-state-v1')).game.hist.length===2);
 for(const theme of ['wood','dark']){
  await page.getByRole('button',{name:theme==='wood'?'Wooden board':'Dark board',exact:true}).click();
  const report=await lighthouse(url,{port:chrome.port,onlyCategories:['accessibility'],disableStorageReset:true,output:'json',logLevel:'error'});
  await writeFile('docs/verification/lighthouse-'+theme+'.json',report.report);
  const score=Math.round(report.lhr.categories.accessibility.score*100);
  console.log(theme+': '+score);
  if(score<90)process.exitCode=1;
 }
 await browser.close();
}finally{await chrome.kill();}
