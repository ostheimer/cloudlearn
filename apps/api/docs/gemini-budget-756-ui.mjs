// Local browser acceptance with synthetic auth/API fixtures.
// Start web dev on port 4756 with the two local NEXT_PUBLIC URLs from the runbook.
import { chromium, expect } from '../../../node_modules/@playwright/test/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const userId='20000000-0000-4000-8000-000000000001', deckId='10000000-0000-4000-8000-000000000001', cardId='30000000-0000-4000-8000-000000000001';
const evidence=[];
for (const viewport of [{width:1280,height:900},{width:390,height:844}]) {
 const context=await browser.newContext({viewport}); const page=await context.newPage();  const errors=[],unexpected=[]; let aiCalls=0; page.setDefaultNavigationTimeout(120000); page.setDefaultTimeout(90000);
 page.on('pageerror', e=>errors.push(e.message));
 await page.addInitScript(({userId,deckId})=>{
  localStorage.setItem('clearn_onboarding_completed','true');
  localStorage.setItem(`clearn:setup:flashcards:${deckId}`,JSON.stringify({source:'all'}));
  localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'local-test-token',refresh_token:'local-test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:userId,email:'learner@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}}));
 },{userId,deckId});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;
  const json=body=>route.fulfill({json:body});
  if(p.startsWith('/api/v1/')){
   if(p==='/api/v1/scan/process'){aiCalls++;return route.fulfill({status:503,json:{code:'AI_DISABLED',message:'Die KI-Erstellung ist vorübergehend abgeschaltet. Gespeicherte Karten bleiben lernbar.'}});}
   if(p==='/api/v1/decks')return json({decks:[{id:deckId,userId,title:'Gespeicherte Biologie',tags:[],cardCount:1}]});
   if(p===`/api/v1/decks/${deckId}/cards`)return json({cards:[{id:cardId,userId,deckId,front:'Was ist eine Zelle?',back:'Die kleinste lebende Einheit.',type:'basic',difficulty:'medium',tags:[],starred:false,fsrsDue:'2020-01-01T00:00:00Z',fsrsState:'review'}]});
   if(p===`/api/v1/decks/${deckId}/details`)return json({details:{title:'Gespeicherte Biologie',speechLangFront:'de',speechLangBack:'de'}});
   if(p==='/api/v1/learn/progress')return json({progress:null});
   if(p==='/api/v1/lp/balance')return json({balance:100,costs:{aiScan:10,urlImport:15,pdfImport:20},tier:'free'});
   if(p==='/api/v1/usage')return json({tier:'free',lpBalance:100,lpCostAiScan:10,lpCostUrlImport:15,lpCostPdfImport:20});
   if(p==='/api/v1/account/profile')return json({displayName:'Lokaler Test',gender:null});
   if(p==='/api/v1/stats')return json({stats:{dailyGoal:20,reviewsToday:0}});
   return json({});
  }
  if(u.origin==='http://127.0.0.1:4756')return route.continue();
  unexpected.push(u.origin+p);return route.abort();
 });
 await page.goto('http://127.0.0.1:4756/dashboard/import',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/Text eingeben/}).click();
 await page.getByLabel('Dein Lernstoff als Text').fill('Eine Zelle ist die kleinste lebende Einheit.');

 const generate=page.getByRole('button',{name:/Karten erstellen|Karten erzeugen|Karten generieren/});
 await generate.click();
 await expect(page.getByText('Die KI-Erstellung ist vorübergehend abgeschaltet. Gespeicherte Karten bleiben lernbar.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Dein Lernstoff als Text')).toHaveValue('Eine Zelle ist die kleinste lebende Einheit.');
 await page.screenshot({path:new URL(`./gemini-budget-756/disabled-${viewport.width}.png`,import.meta.url).pathname,fullPage:true});
 await page.goto(`http://127.0.0.1:4756/dashboard/deck/${deckId}/learn`);

 await page.getByRole('button',{name:/Lernen starten|Jetzt lernen|Starten/}).click();
 await expect(page.getByText('Was ist eine Zelle?',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Karte umdrehen',exact:true}).click();
 await expect(page.getByText('Die kleinste lebende Einheit.',{exact:true})).toBeVisible();
 await page.waitForTimeout(500); // wait for the card flip to finish before visual readback
 await page.screenshot({path:new URL(`./gemini-budget-756/learning-${viewport.width}.png`,import.meta.url).pathname,fullPage:true});
 expect(errors).toEqual([]); expect(unexpected).toEqual([]); expect(aiCalls).toBe(1);
 evidence.push({viewport,aiCalls,errors,unexpected}); await context.close();
}
await browser.close(); console.log(JSON.stringify(evidence,null,2));
