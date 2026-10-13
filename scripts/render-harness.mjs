// Noninteractive, isolated React browser fixture. Not the live Electron host.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { requireHermes, dependencyRoot } from '../tests/dependencies.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
const {build}=requireHermes('esbuild'),{chromium}=requireHermes('playwright');
const boundary=`import {jsx} from 'react/jsx-runtime'; export const ROUTES_AREA='routes',SIDEBAR_NAV_AREA='sidebar',PALETTE_AREA='palette';export const Codicon=({name,size})=>jsx('i',{'aria-hidden':true,className:'codicon codicon-'+name,style:{fontSize:size}});export const host={state:{profile:{get:()=> 'fixture'},connectionId:{get:()=> 'fixture'}},navigate(){},request(){throw Error('Fixture: live gateway requests prohibited');},onEvent(){return()=>{};}};`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {jsx} from 'react/jsx-runtime';import {AACPage,createStore} from './desktop/plugin.js';window.fixtureStore=createStore({get:()=>null,set(){}});createRoot(document.getElementById('app')).render(jsx(AACPage,{store:window.fixtureStore}));`;
const result=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'fixture-entry.mjs'},bundle:true,write:false,format:'iife',nodePaths:[path.join(dependencyRoot,'node_modules')],plugins:[{name:'native-fixture',setup(b){b.onResolve({filter:/^@hermes\/plugin-sdk$/},()=>({path:'sdk',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:boundary,resolveDir:dependencyRoot,loader:'js'}));}}]});
const js=result.outputFiles[0].text;
const html=`<!doctype html><html><head><meta charset="utf-8"><style>:root{--ui-bg-base:#171c25;--ui-bg-secondary:#232c38;--ui-text-primary:#f0f3f7;--ui-text-secondary:#bec9d8;--ui-text-tertiary:#93a5bb;--ui-text-quaternary:#8094ac;--ui-stroke-secondary:#3a485b;--ui-accent:#9ac9ef;--ui-accent-secondary:#c5b8eb}html,body{margin:0;height:100%;font-family:system-ui;background:var(--ui-bg-base);color:var(--ui-text-primary)}#app{height:calc(100% - 28px)}.fixture-label{height:28px;box-sizing:border-box;padding:5px 16px;font-size:11px;background:var(--ui-bg-secondary);color:var(--ui-text-secondary)}.codicon:before{content:'◇'}</style></head><body><div class="fixture-label">ISOLATED REACT RENDER · native SDK boundary mocked · no live host/provider success</div><div id="app"></div><script src="/fixture.js"></script></body></html>`;
const server=http.createServer((req,res)=>{res.setHeader('content-type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?js:html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const evidence=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.AAC_BROWSER_EXECUTABLE?{executablePath:process.env.AAC_BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[1366,768],[1920,1080],[390,844]]){
  await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByRole('button',{name:'I',exact:true}).waitFor();
  await page.getByRole('button',{name:'I',exact:true}).click();await page.getByRole('button',{name:'need',exact:true}).click();await page.getByRole('button',{name:'help',exact:true}).click();
  await page.getByRole('button',{name:'Save phrase'}).click();
  const tiles=await page.locator('.tile').evaluateAll(nodes=>nodes.map(n=>({cell:n.dataset.cell,label:n.getAttribute('aria-label')})));
  await page.getByLabel('Find a word',{exact:true}).fill('help');assert.deepEqual(await page.locator('.tile').evaluateAll(nodes=>nodes.map(n=>({cell:n.dataset.cell,label:n.getAttribute('aria-label')}))),tiles);
  assert.equal(await page.locator('.find-match').count(),1);await page.getByRole('button',{name:'Clear find'}).click();
  await page.locator('main').evaluate(n=>n.scrollTop=0);
  const metrics=await page.evaluate(()=>({rootWidth:document.querySelector('main').clientWidth,rootScroll:document.querySelector('main').scrollWidth,lastTileBottom:[...document.querySelectorAll('.tile')].at(-1).getBoundingClientRect().bottom,viewportHeight:innerHeight}));
  assert.ok(metrics.rootScroll<=metrics.rootWidth+1,'page must not overflow horizontally');if(width>=1366)assert.ok(metrics.lastTileBottom<height,'whole fixed core should be visible at normal desktop size');
  await page.screenshot({path:path.join(out,`cockpit-${width}.png`),fullPage:false});
  await page.getByRole('button',{name:'Studio',exact:true}).click();await page.getByRole('tab',{name:'Expression',exact:true}).click();assert.equal(await page.getByRole('tabpanel').count(),1);
  await page.locator('main').evaluate(n=>n.scrollTop=0);
  const layout=await page.evaluate(()=>({studioTop:document.querySelector('.studio').getBoundingClientRect().top,boardTop:document.querySelector('.communication-surface').getBoundingClientRect().top,rootWidth:document.querySelector('main').clientWidth,rootScroll:document.querySelector('main').scrollWidth}));
  assert.ok(layout.rootScroll<=layout.rootWidth+1,'studio must not overflow page');if(width===390)assert.ok(layout.studioTop>layout.boardTop,'narrow studio must stack below vocabulary');else assert.equal(layout.studioTop,layout.boardTop,'wide studio must sit alongside vocabulary');
  await page.screenshot({path:path.join(out,`studio-${width}.png`),fullPage:false});
  await page.getByRole('button',{name:'Focus mode',exact:true}).click();assert.equal(await page.getByRole('tabpanel').count(),0);assert.equal(await page.getByRole('button',{name:'Stop',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Start scanning',exact:true}).count(),1);await page.screenshot({path:path.join(out,`focus-${width}.png`),fullPage:false});
  evidence.push({width,height,...metrics,...layout,coreCells:tiles.length,findStable:true,focusScanningRetained:true,speechStopAbsent:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'render-metrics.json'),JSON.stringify({boundary:'Actual React/plugin; SDK/native mocks; synthetic theme; Codicon glyph placeholders, not live host fonts',requests:'No provider, generation or config requests',viewports:evidence,errors},null,2));console.log(JSON.stringify(evidence,null,2));console.log('Headless React fixture: 3 viewports, 9 screenshots, stable core/find/focus/responsive geometry assertions passed.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
