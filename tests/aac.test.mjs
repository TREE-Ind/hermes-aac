import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { requireHermes as require } from './dependencies.mjs';
const React = require("react"),
  runtime = require("react/jsx-runtime"),
  { renderToStaticMarkup } = require("react-dom/server");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
const {
  render,
  fireEvent,
  cleanup,
  waitFor,
  act,
} = require("@testing-library/react");
function studioTab(view,name){if(!view.queryByRole('tab',{name,exact:true}))fireEvent.click(view.getByRole('button',{name:'Studio',exact:true}));fireEvent.click(view.getByRole('tab',{name,exact:true}));}
function expressivePreviewTest(){ test('Expressive delivery is neutral by default; explicit choices preview tags without changing words or speaking; reset clears tags',()=>{
 const calls=[];dom.window.hermesDesktop={api:async r=>{calls.push(r);throw Error('No call expected');}};
 const store=mod.createStore({get:()=>null,set(){}});store.dispatch({type:'select',text:'I need help'});
 const view=render(runtime.jsx(mod.AACPage,{store}));
 try{studioTab(view,'Expression');assert.ok(view.queryByLabelText('Delivery emotion'),'expressive delivery section missing');
 assert.equal(view.getByLabelText('Exact synthesis preview').textContent,'I need help');
 fireEvent.change(view.getByLabelText('Delivery emotion'),{target:{value:'happy'}});
 fireEvent.change(view.getByLabelText('Vocal cue'),{target:{value:'sighs'}});
 assert.equal(view.getByLabelText('Exact synthesis preview').textContent,'[happy] [sighs] I need help');
 assert.equal(store.get().words.join(' '),'I need help');assert.equal(view.getByLabelText('Utterance strip').textContent,'I need help');assert.equal(calls.length,0);
 fireEvent.click(view.getByRole('button',{name:'Reset delivery'}));assert.equal(view.getByLabelText('Exact synthesis preview').textContent,'I need help');
 }finally{cleanup();}
}); }
const contributions = [];
const sdk = {
  ROUTES_AREA: "routes",
  SIDEBAR_NAV_AREA: "sidebar.nav",
  PALETTE_AREA: "palette",
  Codicon: props => runtime.jsx("i", {"aria-hidden":true,className:`codicon codicon-${props.name}`}),
  host: {
    navigate() {},
    state: { activeSessionId: { get: () => null },profile:{get:()=> 'default'},connectionId:{get:()=> 'local'} },
    request: async () => {
      throw Error("No gateway in test");
    },
    onEvent: () => () => {},
  },
};
const context = vm.createContext({
  console,
  structuredClone,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  AbortController,
  Blob,
  URL,
  window: dom.window,
  Audio: class { async play() {} pause() {} },
});
let mod;
if (fs.existsSync(new URL("../desktop/plugin.js", import.meta.url))) {
  const module = new vm.SourceTextModule(
    fs.readFileSync(new URL("../desktop/plugin.js", import.meta.url), "utf8"),
    { context },
  );
  await module.link(async (name) => {
    const values =
      name === "@hermes/plugin-sdk"
        ? sdk
        : name === "react"
          ? React
          : name === "react/jsx-runtime"
            ? runtime
            : null;
    if (!values) throw Error("Forbidden import " + name);
    const m = new vm.SyntheticModule(
      Object.keys(values),
      function () {
        for (const [k, v] of Object.entries(values)) this.setExport(k, v);
      },
      { context },
    );
    return m;
  });
  await module.evaluate();
  mod = module.namespace;
}
test('Cockpit keeps board first and focus mode hides studio without removing communication or access',()=>{
 const view=render(runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})}));
 try{
 assert.ok(!view.queryByLabelText('Situation'),'context should not stack above board');
 assert.ok(view.queryByRole('button',{name:'Focus mode'}),'focus toggle missing');
 studioTab(view,'Context / AI');
 assert.ok(view.queryByRole('tablist',{name:'Communication studio'}));
 assert.ok(view.queryByRole('tabpanel'));
 fireEvent.click(view.getByRole('button',{name:'Focus mode'}));
 assert.ok(!view.queryByRole('tabpanel'));assert.ok(view.queryByLabelText('Communication board'));assert.ok(view.queryByRole('button',{name:'Stop',exact:true}));assert.ok(view.queryByRole('button',{name:'Start scanning'}));
 fireEvent.click(view.getByRole('button',{name:'Exit focus mode'}));
 assert.ok(view.queryByRole('tabpanel'));
 }finally{cleanup();}
});
test('Favorites save only explicit selections, persist locally, insert on click and remove through management',()=>{
 const data=new Map(),storage={get:k=>data.get(k),set:(k,v)=>data.set(k,v)};const store=mod.createStore(storage);const view=render(runtime.jsx(mod.AACPage,{store}));
 try{fireEvent.click(view.getByRole('button',{name:'I',exact:true}));assert.equal(data.size,0,'selections must never create history');
 assert.ok(view.queryByRole('button',{name:'Save phrase'}),'explicit favorite save missing');fireEvent.click(view.getByRole('button',{name:'Save phrase'}));assert.equal(mod.createStore(storage).get().favorites[0],'I');assert.equal(mod.createStore(storage).get().words.length,0);
 fireEvent.click(view.getByRole('button',{name:'Clear',exact:true}));assert.equal(store.get().words.length,0);fireEvent.click(view.getByRole('button',{name:'Add favorite: I'}));assert.equal(store.get().words.join(' '),'I');
 fireEvent.click(view.getByRole('button',{name:'Manage phrases'}));fireEvent.click(view.getByRole('button',{name:'Remove favorite: I'}));assert.equal(mod.createStore(storage).get().favorites.length,0);
 fireEvent.click(view.getByRole('button',{name:'want',exact:true}));assert.ok(!JSON.stringify([...data.values()]).includes('want'));
 }finally{cleanup();}
});
test('Find highlights matching existing tiles without hiding or reordering cells and clear resets count',()=>{
 const view=render(runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})}));
 try{const cells=()=>[...view.container.querySelectorAll('.tile')].map(b=>`${b.dataset.cell}:${b.getAttribute('aria-label')}`).join('|');const before=cells();
 assert.ok(view.queryByLabelText('Find a word'),'word find missing');fireEvent.change(view.getByLabelText('Find a word'),{target:{value:'help'}});assert.equal(cells(),before);assert.equal(view.container.querySelectorAll('.tile.find-match').length,1);assert.match(view.getByLabelText('Word find results').textContent,/1 match/);
 fireEvent.change(view.getByLabelText('Find a word'),{target:{value:'no such word'}});assert.equal(cells(),before);assert.match(view.getByLabelText('Word find results').textContent,/0 matches/);fireEvent.click(view.getByRole('button',{name:'Clear find'}));assert.equal(view.getByLabelText('Find a word').value,'');assert.equal(view.container.querySelectorAll('.tile.find-match').length,0);
 }finally{cleanup();}
});
test('Scanning excludes hidden studio tabs and closed disclosure/dialog targets and cleans up after Focus',()=>{
 let tick,cleared=0;const old=context.setInterval,oldClear=context.clearInterval;context.setInterval=fn=>{tick=fn;return 19;};context.clearInterval=()=>cleared++;
 const view=render(runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})}));
 try{studioTab(view,'Expression');studioTab(view,'Context / AI');fireEvent.click(view.getByRole('button',{name:'Start scanning'}));
 for(let n=0;n<140;n++){act(()=>tick());const target=view.container.querySelector('.scan-target');assert.ok(!target.closest('[hidden]'),'hidden tab became scan target');}
 fireEvent.click(view.getByRole('button',{name:'Focus mode'}));assert.ok(view.container.contains(document.activeElement));for(let n=0;n<80;n++){act(()=>tick());assert.ok(!view.container.querySelector('.scan-target')?.closest('.studio'));}
 fireEvent.keyDown(document.activeElement,{key:'Escape'});assert.equal(cleared,1);assert.ok(!view.container.querySelector('.scan-target'));
 const root=document.createElement('div');root.tabIndex=-1;root.innerHTML='<button class="tile" data-scan="true">visible</button><details><button data-scan="true">closed disclosure</button></details><dialog><button data-scan="true">closed dialog</button></dialog>';document.body.append(root);const scanner=mod.attachScanning(root,{scanMs:500,onExit(){}},{setInterval:()=>1,clearInterval(){}});scanner.advance();assert.equal(root.querySelector('.scan-target').textContent,'visible');scanner.dispose();root.remove();
 }finally{cleanup();context.setInterval=old;context.clearInterval=oldClear;}
});
test('Inline delivery presets are explicit, leave words untouched and never call native synthesis',()=>{
 const calls=[];dom.window.hermesDesktop={api:async r=>{calls.push(r);throw Error('Unexpected native call');}};const store=mod.createStore({get:()=>null,set(){}});store.dispatch({type:'select',text:'My words'});const view=render(runtime.jsx(mod.AACPage,{store}));
 try{assert.ok(view.queryByRole('button',{name:'Delivery presets'}),'preset popover missing');fireEvent.click(view.getByRole('button',{name:'Delivery presets'}));fireEvent.click(view.getByRole('button',{name:'Thoughtful delivery'}));assert.equal(view.getByLabelText('Compact synthesis preview').textContent,'[thoughtful] My words');assert.equal(store.get().words[0],'My words');assert.equal(calls.length,0);assert.ok(!view.queryByRole('button',{name:'Thoughtful delivery'}));
 }finally{cleanup();}
});
test('Focus round trip retains an unsent AI draft without sharing it',()=>{
 const view=render(runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})}));
 try{studioTab(view,'Context / AI');fireEvent.change(view.getByLabelText('Question for Hermes'),{target:{value:'My unsent draft'}});fireEvent.click(view.getByRole('button',{name:'Focus mode'}));fireEvent.click(view.getByRole('button',{name:'Exit focus mode'}));assert.equal(view.getByLabelText('Question for Hermes').value,'My unsent draft');assert.ok(!view.queryByLabelText('Exact text sent to Hermes'));
 }finally{cleanup();}
});
expressivePreviewTest();
test('Tagged Speak checks fresh owner v3 config and transmits only explicit allowed tags; mismatches refuse visibly',async()=>{
 let provider='edge',model='eleven_v3';const calls=[];
 dom.window.hermesDesktop={api:async r=>{calls.push(r);if(r.path==='/api/config')return{tts:{provider,elevenlabs:{model_id:model,voice_id:'v'}}};return{ok:true,provider:'elevenlabs',data_url:'data:audio/mpeg;base64,AA=='};}};
 const store=mod.createStore({get:()=>null,set(){}});store.dispatch({type:'select',text:'I need help'});const view=render(runtime.jsx(mod.AACPage,{store}));
 try{studioTab(view,'Expression');fireEvent.change(view.getByLabelText('Delivery emotion'),{target:{value:'happy'}});
 fireEvent.click(view.getByRole('button',{name:'Speak',exact:true}));
 await waitFor(()=>assert.ok(view.queryByText(/Expressive speech requires/)));assert.equal(calls.filter(r=>r.path==='/api/audio/speak').length,0);
 provider='elevenlabs';model='eleven_multilingual_v2';fireEvent.click(view.getByRole('button',{name:'Speak',exact:true}));await waitFor(()=>assert.equal(calls.filter(r=>r.path==='/api/config').length,2));assert.equal(calls.filter(r=>r.path==='/api/audio/speak').length,0);
 model='eleven_v3';fireEvent.click(view.getByRole('button',{name:'Speak',exact:true}));await waitFor(()=>assert.ok(view.queryByText(/Playing your words/)));
 assert.equal(calls.find(r=>r.path==='/api/audio/speak').body.text,'[happy] I need help');assert.ok(calls.every(r=>r.profile==='default'&&r.connectionId==='local'));assert.equal(store.get().words.join(' '),'I need help');
 }finally{cleanup();}
});
test('Enable Eleven v3 is staged, writes only model_id on pinned elevenlabs owner, and requires exact readback',async()=>{
 const calls=[];let config={tts:{provider:'elevenlabs',elevenlabs:{model_id:'eleven_multilingual_v2',voice_id:'keep'}}};
 dom.window.hermesDesktop={api:async r=>{calls.push(r);if(r.method==='PUT'){config={tts:{...config.tts,elevenlabs:{...config.tts.elevenlabs,...r.body.config.tts.elevenlabs}}};return{ok:true};}return config;}};
 const view=render(runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})}));
 try{studioTab(view,'Expression');assert.ok(view.queryByRole('button',{name:'Review Enable Eleven v3'}),'model enable review missing');
 fireEvent.click(view.getByRole('button',{name:'Review Enable Eleven v3'}));await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Enable Eleven v3 in shared Hermes settings'})));assert.ok(calls.every(r=>r.method==='GET'));
 fireEvent.click(view.getByRole('button',{name:'Enable Eleven v3 in shared Hermes settings'}));await waitFor(()=>assert.ok(view.queryByText(/Eleven v3 saved and verified/)));
 assert.equal(JSON.stringify(calls.find(r=>r.method==='PUT').body),JSON.stringify({config:{tts:{elevenlabs:{model_id:'eleven_v3'}}}}));assert.equal(config.tts.elevenlabs.voice_id,'keep');assert.equal(calls.at(-1).method,'GET');assert.ok(calls.every(r=>r.profile==='default'&&r.connectionId==='local'));
 }finally{cleanup();}
});
test('Expressive pending config, changed owner/model, provider mismatch audio and Stop never play late or stale audio',async()=>{
 const choice={emotion:'happy',delivery:'normal',cue:'none'};let played=0,scope={profile:'default',connectionId:'local'};
 const Audio=class{async play(){played++;}pause(){}};
 const valid={tts:{provider:'elevenlabs',elevenlabs:{model_id:'eleven_v3',voice_id:'v'}}};
 let resolve,calls=[];const player=mod.createSpeech({owner:()=>scope,Audio,api:r=>{calls.push(r);return r.path==='/api/config'?new Promise(fn=>resolve=fn):Promise.resolve({ok:true,provider:'elevenlabs',data_url:'data:audio/mpeg;base64,AA=='});}});
 const waiting=player.speak('Words',choice);player.stop();resolve(valid);await assert.rejects(waiting,/stopped/i);assert.equal(calls.length,1,'Stop during config must prevent synthesis POST');
 let reads=0;const stale=mod.createSpeech({owner:()=>scope,Audio,api:async r=>{if(r.path==='/api/config'){reads++;return reads===1?valid:{tts:{provider:'edge'}};}return{ok:true,provider:'elevenlabs',data_url:'data:audio/mpeg;base64,AA=='};}});
 await assert.rejects(stale.speak('Words',choice),/config changed/i);assert.equal(played,0);
 const mismatch=mod.createSpeech({owner:()=>scope,Audio,api:async r=>r.path==='/api/config'?valid:{ok:true,provider:'edge',data_url:'data:audio/mpeg;base64,AA=='}});
 await assert.rejects(mismatch.speak('Words',choice),/provider/i);assert.equal(played,0);
 const changed=mod.createSpeech({owner:()=>scope,Audio,api:async()=>{scope={profile:'other',connectionId:'local'};return valid;}});
 await assert.rejects(changed.speak('Words',choice),/Gateway\/profile changed/);assert.equal(played,0);
 const unknown=mod.createSpeech({owner:()=>({}),Audio,api:async()=>{throw Error('must not call');}});await assert.rejects(unknown.speak('Words',choice),/known gateway/);
});
test('Delivery allowlist bounds combinations, preserves literal words and rejects invalid AI delivery output',()=>{
 assert.equal(typeof mod.validateDelivery,'function','delivery validator missing');
 assert.equal(mod.deliveryText('  My words!  ',{emotion:'happy',delivery:'whispers',cue:'sighs'}),'[happy] [whispers] [sighs]   My words!  ');
 for(const choice of [{emotion:'<script>'},{emotion:'happy',delivery:'normal',cue:'explosion'},{emotion:'happy',delivery:'normal',cue:'none',text:'rewritten words'},{emotion:'happy',delivery:'normal',cue:['laughs','sighs']}])assert.throws(()=>mod.validateDelivery(choice));
 assert.throws(()=>mod.deliveryText('[angry] words',{emotion:'happy',delivery:'normal',cue:'none'}));assert.throws(()=>mod.deliveryText('x'.repeat(5000),{emotion:'happy',delivery:'normal',cue:'none'}));
 assert.equal(mod.deliveryText(' [literal]  '),' [literal]  ');
 assert.equal(mod.parseDeliveries('{"options":[{"emotion":"happy","delivery":"normal","cue":"none"}]}')[0].emotion,'happy');
 for(const value of ['not JSON','{"options":[]}','{"options":[{"emotion":"confident","delivery":"normal","cue":"none"}]}','{"options":[{"emotion":"happy","delivery":"normal","cue":"none","text":"rewrite"}]}'])assert.throws(()=>mod.parseDeliveries(value));
});
test('AI delivery proposals require reviewed sharing and apply click without rewriting words or speaking',async()=>{
 const listeners=new Set();let calls=0;
 sdk.host.onEvent=(_,fn)=>{listeners.add(fn);return()=>listeners.delete(fn);};sdk.host.request=async method=>{calls++;return method==='session.create'?{session_id:'delivery'}:{accepted:true};};
 const store=mod.createStore({get:()=>null,set(){}});store.dispatch({type:'select',text:'My exact words'});const view=render(runtime.jsx(mod.AACPage,{store}));
 try{studioTab(view,'Context / AI');fireEvent.change(view.getByLabelText('Question for Hermes'),{target:{value:'I want an excited delivery option'}});
 assert.ok(view.queryByRole('button',{name:'Review delivery suggestions'}),'AI delivery review missing');
 fireEvent.click(view.getByRole('button',{name:'Review delivery suggestions'}));assert.equal(calls,0);assert.ok(!view.getByLabelText('Exact text sent to Hermes').textContent.includes('My exact words'));
 fireEvent.click(view.getByRole('button',{name:'Confirm and send to Hermes'}));await waitFor(()=>assert.equal(calls,2));
 act(()=>{for(const fn of [...listeners])fn({type:'message.complete',payload:{session_id:'delivery',text:'{"options":[{"emotion":"excited","delivery":"normal","cue":"none"}]}'}});});
 await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Apply delivery: excited · normal · none'})));
 studioTab(view,'Expression');assert.equal(view.getByLabelText('Delivery emotion').value,'neutral');studioTab(view,'Context / AI');assert.equal(store.get().words.join(' '),'My exact words');
 fireEvent.click(view.getByRole('button',{name:'Apply delivery: excited · normal · none'}));assert.equal(view.getByLabelText('Exact synthesis preview').textContent,'[excited] My exact words');assert.equal(store.get().words.join(' '),'My exact words');
 fireEvent.click(view.getByRole('button',{name:'Review delivery suggestions'}));fireEvent.click(view.getByRole('button',{name:'Confirm and send to Hermes'}));await waitFor(()=>assert.equal(calls,4));
 act(()=>{for(const fn of [...listeners])fn({type:'message.complete',payload:{session_id:'delivery',text:'{"options":[{"emotion":"evil","delivery":"normal","cue":"none"}]}'}});});
 await waitFor(()=>assert.match(view.getByRole('alert').textContent,/Invalid delivery/));assert.ok(!view.queryByRole('button',{name:/Apply delivery:/}));assert.equal(view.getByLabelText('Delivery emotion').value,'excited');
 }finally{cleanup();}
});
test('Invalid expressive message shows refusal preview without crashing communication; reset restores exact literal text',()=>{
 const store=mod.createStore({get:()=>null,set(){}});store.dispatch({type:'select',text:'[literal] words'});const view=render(runtime.jsx(mod.AACPage,{store}));
 try{studioTab(view,'Expression');fireEvent.change(view.getByLabelText('Delivery emotion'),{target:{value:'happy'}});assert.ok(view.queryByRole('button',{name:'Reset delivery'}));assert.match(view.getByLabelText('Exact synthesis preview').textContent,/refuses existing/);assert.equal(store.get().words[0],'[literal] words');fireEvent.click(view.getByRole('button',{name:'Reset delivery'}));assert.equal(view.getByLabelText('Exact synthesis preview').textContent,'[literal] words');}finally{cleanup();}
});
test('Model enable refuses stale owner/config and failed readback; provider mismatch never stages or writes',async()=>{
 let profile='default',config={tts:{provider:'elevenlabs',elevenlabs:{model_id:'old'}}},writes=0;
 sdk.host.state.profile={get:()=>profile};
 dom.window.hermesDesktop={api:async r=>{if(r.method==='PUT'){writes++;return{ok:true};}return config;}};
 const view=render(runtime.jsx(React.StrictMode,{children:runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})})}));
 const review=async()=>{fireEvent.click(view.getByRole('button',{name:'Review Enable Eleven v3'}));await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Enable Eleven v3 in shared Hermes settings'})));};
 try{studioTab(view,'Expression');await review();profile='other';fireEvent.click(view.getByRole('button',{name:'Enable Eleven v3 in shared Hermes settings'}));await waitFor(()=>assert.ok(view.queryByText(/Gateway\/profile changed. Review again/)));assert.equal(writes,0);
 profile='default';await review();config={tts:{provider:'elevenlabs',elevenlabs:{model_id:'changed'}}};fireEvent.click(view.getByRole('button',{name:'Enable Eleven v3 in shared Hermes settings'}));await waitFor(()=>assert.ok(view.queryByText(/Shared config changed/)));assert.equal(writes,0);
 await review();fireEvent.click(view.getByRole('button',{name:'Enable Eleven v3 in shared Hermes settings'}));await waitFor(()=>assert.ok(view.queryByText(/Model write could not be verified/)));assert.equal(writes,1);assert.ok(!view.queryByText(/Eleven v3 saved and verified/));
 config={tts:{provider:'edge'}};fireEvent.click(view.getByRole('button',{name:'Review Enable Eleven v3'}));await waitFor(()=>assert.ok(view.queryByText(/Select ElevenLabs explicitly/)));assert.ok(!view.queryByRole('button',{name:'Enable Eleven v3 in shared Hermes settings'}));assert.equal(writes,1);
 }finally{cleanup();sdk.host.state.profile={get:()=> 'default'};}
});
test('Expressive config read failures refuse without synthesis and neutral message remains exact',async()=>{
 let posts=0;const player=mod.createSpeech({owner:()=>({profile:'default',connectionId:'local'}),api:async r=>{if(r.method==='GET')throw Error('Config read unavailable');posts++;return{ok:true,data_url:'data:audio/mpeg;base64,AA=='};},Audio:class{async play(){}pause(){}}});
 await assert.rejects(player.speak('Words',{emotion:'sad',delivery:'normal',cue:'none'}),/Config read unavailable/);assert.equal(posts,0);await player.speak('Words');assert.equal(posts,1);player.stop();
});
test('Reset delivery while expressive synthesis is pending discards late tagged audio',async()=>{
 let resolve,played=0;const config={tts:{provider:'elevenlabs',elevenlabs:{model_id:'eleven_v3'}}};
 dom.window.hermesDesktop={api:r=>r.path==='/api/config'?Promise.resolve(config):new Promise(fn=>resolve=fn)};context.Audio=class{async play(){played++;}pause(){}};
 const store=mod.createStore({get:()=>null,set(){}});store.dispatch({type:'select',text:'Words'});const view=render(runtime.jsx(mod.AACPage,{store}));
 try{studioTab(view,'Expression');fireEvent.change(view.getByLabelText('Delivery emotion'),{target:{value:'happy'}});fireEvent.click(view.getByRole('button',{name:'Speak',exact:true}));await waitFor(()=>assert.equal(typeof resolve,'function'));
 fireEvent.click(view.getByRole('button',{name:'Reset delivery'}));resolve({ok:true,provider:'elevenlabs',data_url:'data:audio/mpeg;base64,AA=='});await waitFor(()=>assert.ok(view.queryByText(/late audio discarded/)));assert.equal(played,0);assert.equal(view.getByLabelText('Exact synthesis preview').textContent,'Words');
 }finally{cleanup();}
});
test("Start scanning owns keyboard focus and announces immediate/live targets across React rerenders", () => {
  let tick, cleared = 0;
  const oldSet = context.setInterval, oldClear = context.clearInterval;
  context.setInterval = fn => { tick = fn; return 44; };
  context.clearInterval = () => cleared++;
  const store = mod.createStore({get:()=>null,set(){}});
  const view = render(runtime.jsx(mod.AACPage,{store}));
  try {
    document.body.tabIndex = -1; document.body.focus();
    fireEvent.click(view.getByRole('button',{name:'Start scanning'}));
    assert.ok(view.container.contains(document.activeElement), 'Start must acquire page focus for a Space switch');
    assert.match(view.getByLabelText('Scanning status').textContent,/I/);
    assert.equal(view.container.querySelector('.scan-target').getAttribute('aria-label'),'I');
    fireEvent.keyDown(document.activeElement,{key:' '});
    assert.equal(store.get().words.join(' '),'I');
    act(()=>tick());
    assert.equal(view.container.querySelector('.scan-target').getAttribute('aria-label'),'you');
    fireEvent.click(view.getByRole('button',{name:'Food & drink',exact:true}));
    assert.match(view.getByLabelText('Scanning status').textContent,/drink/,'category rerender must refresh active-target announcement immediately');
    act(()=>tick());
    assert.ok(view.container.querySelector('.scan-target'));
    for(let n=0;n<12;n++) act(()=>tick());
    assert.ok(view.container.querySelector('.scan-target'));
    fireEvent.keyDown(document.activeElement,{key:'Escape'});
    assert.ok(!view.container.querySelector('.scan-target'));
    assert.equal(cleared,1);
  } finally {cleanup(); context.setInterval=oldSet; context.clearInterval=oldClear;}
});
test('ElevenLabs browser loads server-only catalog and search never writes config', async () => {
 const calls=[];
 dom.window.hermesDesktop={api:async r=>{calls.push(r); if(r.path==='/api/config')return {tts:{provider:'edge',elevenlabs:{voice_id:'old'}}}; if(r.path==='/api/audio/elevenlabs/voices')return {available:true,voices:[{voice_id:'v1',name:'Alice',label:'Alice (professional)'},{voice_id:'v2',name:'Bob',label:'Bob'}]}; throw Error('Unexpected endpoint');}};
 const view=render(runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})}));
 try {studioTab(view,'Access & voice');
 assert.ok(view.queryByRole('button',{name:'Load ElevenLabs voices'}),'catalog loader missing');
 fireEvent.click(view.getByRole('button',{name:'Load ElevenLabs voices'}));
 await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Choose Alice (professional)'})));
 fireEvent.change(view.getByLabelText('Search ElevenLabs voices'),{target:{value:'Alice'}});
 assert.ok(!view.queryByRole('button',{name:'Choose Bob'}));
 fireEvent.click(view.getByRole('button',{name:'Choose Alice (professional)'}));
 assert.equal(calls.length,2); assert.ok(calls.every(r=>r.profile==='default'&&r.connectionId==='local'));
 assert.ok(view.getByText(/edge · old/));
 }finally{cleanup();}
});
test('Applying selected ElevenLabs voice writes only explicit shared fields and verifies exact readback', async()=>{
 const calls=[]; let settings={tts:{provider:'edge',elevenlabs:{voice_id:'old',model_id:'keep'}}};
 dom.window.hermesDesktop={api:async r=>{calls.push(r); if(r.path==='/api/audio/elevenlabs/voices')return {available:true,voices:[{voice_id:'v1',name:'Alice',label:'Alice'}]}; if(r.method==='PUT'){settings={tts:{...settings.tts,...r.body.config.tts,elevenlabs:{...settings.tts.elevenlabs,...r.body.config.tts.elevenlabs}}};return {ok:true};} return settings;}};
 const view=render(runtime.jsx(mod.VoicePanel,{}));
 try{fireEvent.click(view.getByRole('button',{name:'Load ElevenLabs voices'}));await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Choose Alice'})));
 fireEvent.click(view.getByRole('button',{name:'Choose Alice'}));
 assert.ok(view.queryByRole('button',{name:'Apply ElevenLabs voice to Hermes'}),'explicit config apply missing');
 fireEvent.click(view.getByRole('button',{name:'Apply ElevenLabs voice to Hermes'}));
 await waitFor(()=>assert.ok(view.queryByText(/Saved and verified/)));
 const write=calls.find(r=>r.method==='PUT');assert.equal(JSON.stringify(write.body),JSON.stringify({config:{tts:{provider:'elevenlabs',elevenlabs:{voice_id:'v1'}}}}));
 assert.equal(calls.at(-1).path,'/api/config');assert.equal(settings.tts.elevenlabs.model_id,'keep');
 }finally{cleanup();}
});
test('Situational workspace changes shortcuts and topics without moving core or sharing',()=>{
 const store=mod.createStore({get:()=>null,set(){}}), view=render(runtime.jsx(mod.AACPage,{store}));
 try{studioTab(view,'Context / AI');assert.ok(view.queryByLabelText('Situation'),'situational workspace missing');
 const before=[...view.container.querySelectorAll('.tile')].map(x=>x.getAttribute('aria-label')).join('|');
 fireEvent.change(view.getByLabelText('Situation'),{target:{value:'health'}});
 assert.equal(store.get().words.length,0);
 assert.equal([...view.container.querySelectorAll('.tile')].map(x=>x.getAttribute('aria-label')).join('|'),before);
 fireEvent.click(view.getByRole('button',{name:'Add phrase: I need a break'}));assert.equal(store.get().words.join(' '),'I need a break');
 fireEvent.click(view.getByRole('button',{name:'Explore this situation with Hermes'}));
 assert.equal(view.getByLabelText('Board generation topic').value,'a healthcare appointment');
 assert.ok(!view.queryByLabelText('Exact text sent to Hermes'));
 }finally{cleanup();}
});
test('AI phrase proposals have reviewed sharing, streamed progress and click-only insertion',async()=>{
 const listeners=new Set();let calls=0;
 sdk.host.onEvent=(_,fn)=>{listeners.add(fn);return()=>listeners.delete(fn);};
 sdk.host.request=async(method)=>{calls++;if(method==='session.create')return{session_id:'phrases'};return{accepted:true};};
 const store=mod.createStore({get:()=>null,set(){}}),view=render(runtime.jsx(mod.AACPage,{store}));
 try{studioTab(view,'Context / AI');fireEvent.change(view.getByLabelText('Question for Hermes'),{target:{value:'How can I request a pause?'}});
 assert.ok(view.queryByRole('button',{name:'Review phrase suggestions'}),'structured phrase proposal action missing');
 fireEvent.click(view.getByRole('button',{name:'Review phrase suggestions'}));assert.equal(calls,0);
 fireEvent.click(view.getByRole('button',{name:'Confirm and send to Hermes'}));
 await waitFor(()=>assert.equal(calls,2));assert.ok(view.getByRole('progressbar'));
 act(()=>{for(const fn of listeners)fn({type:'message.delta',payload:{session_id:'phrases',text:'{"phrases":['}});});
 assert.ok(view.getByText(/Response received/));
 act(()=>{for(const fn of [...listeners])fn({type:'message.complete',payload:{session_id:'phrases',text:'{"phrases":["Please give me a moment","I need quiet"]}'}});});
 await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Add suggestion: I need quiet'})));
 assert.equal(store.get().words.length,0);assert.equal(store.get().active,'core');
 fireEvent.click(view.getByRole('button',{name:'Add suggestion: I need quiet'}));assert.equal(store.get().words.join(' '),'I need quiet');
 assert.ok(!view.queryByRole('progressbar'));
 }finally{cleanup();}
});
test('Voice unavailable state provides Settings navigation and never substitutes a catalog',async()=>{
 let destination; sdk.host.navigate=p=>destination=p;
 dom.window.hermesDesktop={api:async r=>r.path==='/api/config'?{tts:{provider:'edge'}}:{available:false,voices:[],error:'unauthorized'}};
 const view=render(runtime.jsx(mod.VoicePanel,{}));
 try{fireEvent.click(view.getByRole('button',{name:'Load ElevenLabs voices'}));await waitFor(()=>assert.ok(view.queryByText(/ElevenLabs unavailable/)));
 assert.ok(!view.queryByRole('button',{name:/Choose /}));
 assert.ok(view.queryByRole('button',{name:'Open Hermes Settings'}),'credential settings navigation missing');
 fireEvent.click(view.getByRole('button',{name:'Open Hermes Settings'}));assert.equal(destination,'/settings');
 }finally{cleanup();}
});
test('Workspace and voice cards use responsive themed layout and reduced-motion-safe progress',()=>{
 const html=renderToStaticMarkup(runtime.jsx(mod.AACPage,{store:mod.createStore({get:()=>null,set(){}})}));
 assert.ok(html.includes('.haac .suggestion-cards'),'responsive suggestion styling missing');
 assert.ok(html.includes('prefers-reduced-motion'));
});
test('Scan timer reaches category and message actions using actual page keyboard handlers',()=>{
 let tick;const old=context.setInterval,oldClear=context.clearInterval;context.setInterval=fn=>{tick=fn;return 8;};context.clearInterval=()=>{};
 const store=mod.createStore({get:()=>null,set(){}}),view=render(runtime.jsx(mod.AACPage,{store}));
 try{fireEvent.click(view.getByRole('button',{name:'Start scanning'}));
 const advanceTo=name=>{for(let i=0;i<100;i++){const target=view.container.querySelector('.scan-target');if(target?.textContent===name)return;act(()=>tick());}assert.fail('Scan did not reach '+name);};
 fireEvent.keyDown(document.activeElement,{key:' '});assert.equal(store.get().words.length,1);
 fireEvent.keyDown(document.activeElement,{key:' ',repeat:true});assert.equal(store.get().words.length,1);
 advanceTo('Undo');fireEvent.keyDown(document.activeElement,{key:' '});assert.equal(store.get().words.length,0);
 advanceTo('Food & drink');fireEvent.keyDown(document.activeElement,{key:' '});assert.equal(store.get().active,'food');
 advanceTo('water1');fireEvent.keyDown(document.activeElement,{key:' '});assert.equal(store.get().words[0],'water');
 fireEvent.keyDown(document.activeElement,{key:'Escape'});assert.ok(!view.container.querySelector('.scan-target'));
 }finally{cleanup();context.setInterval=old;context.clearInterval=oldClear;}
});
test('Voice writes refuse changed profile and surface failed readback rather than claim success',async()=>{
 let reads=0,writes=0,profile='default';sdk.host.state.profile={get:()=>profile};
 dom.window.hermesDesktop={api:async r=>{if(r.path.includes('/voices'))return{available:true,voices:[{voice_id:'v',label:'Voice'}]};if(r.method==='PUT'){writes++;return{ok:true};}reads++;return{tts:{provider:'edge',elevenlabs:{voice_id:'old'}}};}};
 const view=render(runtime.jsx(mod.VoicePanel,{}));
 try{fireEvent.click(view.getByRole('button',{name:'Load ElevenLabs voices'}));await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Choose Voice'})));fireEvent.click(view.getByRole('button',{name:'Choose Voice'}));
 profile='other';fireEvent.click(view.getByRole('button',{name:'Apply ElevenLabs voice to Hermes'}));assert.equal(writes,0);assert.ok(view.getByText(/Gateway\/profile changed/));
 profile='default';fireEvent.click(view.getByRole('button',{name:'Apply ElevenLabs voice to Hermes'}));await waitFor(()=>assert.ok(view.queryByText(/could not be verified/)));assert.equal(writes,1);assert.equal(reads,2);assert.ok(!view.queryByText(/Saved and verified/));
 }finally{cleanup();sdk.host.state.profile={get:()=> 'default'};}
});
test('Phrase parser bounds and treats markup as plain suggestion text',()=>{
 assert.throws(()=>mod.parsePhrases('{"phrases":[]}'));assert.throws(()=>mod.parsePhrases('{"phrases":[7]}'));assert.throws(()=>mod.parsePhrases('not json'));
 assert.equal(mod.parsePhrases('{"phrases":["<script>literal</script>"]}')[0],'<script>literal</script>');
});
test('Voice browser survives React StrictMode effect replay',async()=>{
 dom.window.hermesDesktop={api:async r=>r.path==='/api/config'?{tts:{provider:'edge'}}:{available:true,voices:[{voice_id:'strict',label:'Strict voice'}]}};
 const view=render(runtime.jsx(React.StrictMode,{children:runtime.jsx(mod.VoicePanel,{})}));
 try{fireEvent.click(view.getByRole('button',{name:'Load ElevenLabs voices'}));await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Choose Strict voice'})));}finally{cleanup();}
});
test('Failed voice reload removes old gateway catalog and cannot stage a stale voice',async()=>{
 let fail=false;
 dom.window.hermesDesktop={api:async r=>{if(fail)throw Error('Gateway offline');return r.path==='/api/config'?{tts:{provider:'edge'}}:{available:true,voices:[{voice_id:'old',label:'Old voice'}]};}};
 const view=render(runtime.jsx(mod.VoicePanel,{}));
 try{fireEvent.click(view.getByRole('button',{name:'Load ElevenLabs voices'}));await waitFor(()=>assert.ok(view.queryByRole('button',{name:'Choose Old voice'})));fail=true;
 fireEvent.click(view.getByRole('button',{name:'Load ElevenLabs voices'}));await waitFor(()=>assert.ok(view.queryByText(/Gateway offline/)));
 assert.ok(!view.queryByRole('button',{name:'Choose Old voice'}),'failed reload left stale catalog actionable');
 }finally{cleanup();}
});
test("OBF import validates structure, references, executable actions and preserves blank cells", () => {
  assert.equal(typeof mod?.validateBoard, "function");
  const b = mod.coreBoard();
  b.grid.order[0][1] = null;
  const validated = mod.validateBoard(JSON.stringify(b));
  assert.equal(validated.grid.order[0][1], null);
  assert.equal(mod.validateBoard(mod.exportBoard(validated)).name, b.name);
  for (const mutate of [
    (x) => (x.grid.order[0][0] = "missing"),
    (x) => x.buttons.push({ ...x.buttons[0] }),
    (x) => (x.buttons[0].actions = [":speak"]),
    (x) => (x.grid.rows = 100),
    (x) => (x.buttons[0].label = ""),
    (x) => (x.grid.order[0][0] = x.grid.order[1][0]),
  ]) {
    const invalid = mod.coreBoard();
    mutate(invalid);
    assert.throws(() => mod.validateBoard(invalid));
  }
  assert.throws(() => mod.validateBoard("{oops"));
  assert.throws(() => mod.validateBoard({ format: "open-board-0.1" }));
});
test("board proposals require approval and persist custom boards without private utterances", () => {
  assert.equal(typeof mod?.createStore, "function");
  const data = new Map();
  const storage = { get: (k) => data.get(k), set: (k, v) => data.set(k, v) };
  const store = mod.createStore(storage);
  store.dispatch({ type: "select", text: "private message" });
  const b = mod.coreBoard();
  b.id = "generated";
  b.name = "My activities";
  store.dispatch({ type: "propose", board: b });
  assert.equal(store.get().custom.length, 0);
  assert.equal(store.get().active, "core");
  store.dispatch({ type: "approve" });
  assert.equal(store.get().custom.length, 1);
  assert.equal(store.get().active, "generated");
  assert.equal(mod.createStore(storage).get().words.length, 0);
  assert.equal(mod.createStore(storage).get().custom[0].name, "My activities");
  assert.ok(!JSON.stringify([...data.values()]).includes("private message"));
  store.dispatch({ type: "propose", board: mod.coreBoard() });
  store.dispatch({ type: "reject" });
  assert.equal(store.get().proposal, null);
  assert.equal(store.get().custom.length, 1);
});
test("Hermes speech sends exact text without synthesis overrides", async () => {
  assert.equal(typeof mod.createSpeech, "function");
  const calls = [], played = [];
  const player = mod.createSpeech({
    api: async request => { calls.push(request); return {ok:true, data_url:'data:audio/mpeg;base64,AA=='}; },
    owner: () => ({profile:'default', connectionId:'local'}),
    Audio: class { constructor(url) { this.src=url; } async play() { played.push(this.src); } pause() {} }
  });
  await player.speak('I need help');
  assert.equal(JSON.stringify(calls[0].body), JSON.stringify({text:'I need help'}));
  assert.equal(calls[0].path, '/api/audio/speak');
  assert.equal(calls[0].profile, 'default');
  assert.equal(calls[0].connectionId, 'local');
  assert.equal(played.length, 1);
  player.stop();
});
test("stop invalidates late speech and blocks overlapping synthesis", async () => {
  let resolve, played=0, paused=0, calls=0;
  const player = mod.createSpeech({owner:()=>({}), api:()=>{calls++; return new Promise(r=>resolve=r);},
    Audio:class { async play(){played++;} pause(){paused++;} }});
  const pending = player.speak('first');
  const second = player.speak('second');
  assert.equal(calls,1, 'overlapping synthesis must be refused');
  await assert.rejects(second, /already|pending/i);
  player.stop();
  resolve({ok:true,data_url:'data:audio/mpeg;base64,AA=='});
  await assert.rejects(pending, /stopped|cancel/i);
  assert.equal(played,0); assert.equal(calls,1);
  const next = player.speak('next');
  resolve({ok:true,data_url:'data:audio/mpeg;base64,AA=='});
  await next; player.stop(); assert.equal(paused,1);
});
test("Speak uses authenticated host bridge only on click and unmount discards pending audio", async () => {
  const calls=[]; let resolve, played=0;
  sdk.host.state.profile={get:()=> 'default'};
  sdk.host.state.connectionId={get:()=> 'local'};
  dom.window.hermesDesktop={api: request => {calls.push(request);return new Promise(r=>resolve=r);}};
  context.Audio=class {async play(){played++;} pause(){}};
  const store=mod.createStore({get:()=>null,set(){}});
  const view=render(runtime.jsx(mod.AACPage,{store}));
  fireEvent.click(view.getByRole('button',{name:'I',exact:true}));
  assert.equal(calls.length,0);
  fireEvent.click(view.getByRole('button',{name:'Speak',exact:true}));
  assert.equal(calls.length,1,'Speak must call Hermes audio API');
  assert.equal(calls[0].body.text,'I');
  view.unmount();
  resolve({ok:true,data_url:'data:audio/mpeg;base64,AA=='});
  await new Promise(r=>setTimeout(r,0));
  assert.equal(played,0); cleanup();
});
test("failed playback releases audio and provider failure never falls back", async () => {
  let paused=0, created=0;
  const player=mod.createSpeech({owner:()=>({}),api:async()=>({ok:true,data_url:'data:audio/mpeg;base64,AA=='}),
    Audio:class {constructor(){created++;} async play(){throw Error('Playback denied');} pause(){paused++;}}});
  await assert.rejects(player.speak('hello'), /Playback denied/);
  assert.equal(paused,1,'failed playback must release audio');
  const failed=mod.createSpeech({owner:()=>({}),api:async()=>{throw Error('Provider unavailable');},Audio:class {constructor(){created++;}}});
  await assert.rejects(failed.speak('hello'), /Provider unavailable/);
  assert.equal(created,1);
});
test("native route registration renders usable board categories and explicit speech controls", () => {
  assert.equal(typeof mod?.default?.register, "function");
  mod.default.register({
    register: (c) => {
      contributions.push(c);
      return () => {};
    },
    storage: { get: () => null, set() {} },
    onDispose() {},
  });
  assert.equal(contributions.length, 3);
  assert.equal(
    contributions.find((c) => c.area === "routes").data.path,
    "/aac",
  );
  assert.equal(
    contributions.find((c) => c.area === "sidebar.nav").data.label,
    "Communication",
  );
  assert.equal(
    typeof contributions.find((c) => c.area === "palette").data.run,
    "function",
  );
  const html = renderToStaticMarkup(
    contributions.find((c) => c.area === "routes").render(),
  );
  for (const str of [
    "Speak",
    "Stop",
    "Undo",
    "Clear",
    "Core words",
    "Food &amp; drink",
    "Feelings",
    "Places",
    "Activities",
    "Studio",
    "Cloud/local TTS depends on Hermes settings",
    'aria-label="Communication board"',
  ])
    assert.ok(html.includes(str), str + " missing");
  assert.ok(!html.includes("undefined"));
});
test("personal board creation previews then approves and editing keeps its locations", () => {
  const store = mod.createStore({ get: () => null, set() {} });
  const view = render(runtime.jsx(mod.AACPage, { store }));
  fireEvent.click(view.getByRole("button", { name: "I", exact: true }));
  fireEvent.click(view.getByRole("button", { name: "want", exact: true }));
  assert.equal(store.get().words.join(" "), "I want");
  fireEvent.click(view.getByRole("button", { name: "Undo", exact: true }));
  assert.equal(store.get().words.join(" "), "I");
  studioTab(view,'Boards');
  assert.ok(
    view.queryByLabelText("Personal board name"),
    "creation form missing",
  );
  fireEvent.change(view.getByLabelText("Personal board name"), {
    target: { value: "My choices" },
  });
  fireEvent.change(view.getByLabelText("One phrase per line"), {
    target: { value: "book\nblanket\nquiet" },
  });
  fireEvent.click(view.getByRole("button", { name: "Preview personal board" }));
  assert.equal(store.get().custom.length, 0);
  assert.equal(store.get().proposal.name, "My choices");
  fireEvent.click(view.getByRole("button", { name: "Approve board" }));
  assert.equal(store.get().custom.length, 1);
  const original = JSON.stringify(store.get().custom[0].grid.order);
  fireEvent.change(view.getByLabelText("Button label"), {
    target: { value: "my book" },
  });
  fireEvent.click(view.getByRole("button", { name: "Save button edit" }));
  assert.equal(store.get().custom[0].buttons[0].label, "my book");
  assert.equal(JSON.stringify(store.get().custom[0].grid.order), original);
  cleanup();
});
test("switch scanning highlights live targets, selects once and releases timers", () => {
  assert.equal(typeof mod?.attachScanning, "function");
  const root = document.createElement("div");
  root.innerHTML =
    '<button class="tile" data-scan="true">I</button><button class="tile" data-scan="true">want</button><button data-scan="true">Speak</button><button data-scan="true" disabled>disabled</button><input />';
  document.body.append(root);
  let clicked = 0;
  root.children[1].onclick = () => clicked++;
  let tick,
    cleared = false;
  const scanning = mod.attachScanning(
    root,
    { scanMs: 500, onExit() {} },
    {
      setInterval: (fn) => {
        tick = fn;
        return 9;
      },
      clearInterval: (id) => {
        cleared = id === 9;
      },
    },
  );
  assert.equal(root.querySelector(".scan-target").textContent, "I");
  tick();
  assert.equal(root.querySelector(".scan-target").textContent, "want");
  fireEvent.keyDown(root.children[1], { key: " ", repeat: false });
  assert.equal(clicked, 1);
  fireEvent.keyDown(root.children[1], { key: " ", repeat: true });
  assert.equal(clicked, 1);
  scanning.dispose();
  assert.ok(cleared);
  assert.equal(root.querySelector(".scan-target"), null);
  root.remove();
});
test("speech/access settings are Hermes-managed and persist scan speed", () => {
  const store = mod.createStore({ get: () => null, set() {} });
  const view = render(runtime.jsx(mod.AACPage, { store }));
  studioTab(view,'Access & voice');
  assert.ok(!view.queryByLabelText("Speech rate"), 'AAC must not override Hermes speech rate');
  assert.equal(view.queryByLabelText("Pitch"), null);
  assert.equal(view.queryByLabelText("Offline voice"), null);
  assert.ok(view.getByText(/Hermes-managed voice/));
  assert.ok(view.getByText(/Cloud providers receive spoken text/));
  fireEvent.change(view.getByLabelText("Scan interval (seconds)"), {
    target: { value: "2.5" },
  });
  assert.equal(store.get().settings.scanMs, 2500);
  assert.ok(view.getByText(/Space selects the highlighted/));
  fireEvent.click(view.getByRole("button", { name: "Start scanning" }));
  assert.ok(view.container.querySelector(".scan-target"));
  fireEvent.keyDown(view.getByRole("button", { name: "Stop scanning" }), {
    key: " ",
  });
  assert.equal(store.get().words[0], "I");
  fireEvent.keyDown(view.getByRole("button", { name: "Stop scanning" }), {
    key: "Escape",
  });
  assert.equal(view.container.querySelector(".scan-target"), null);
  cleanup();
});
test("Hermes requests use documented fresh-session RPC and reject unrelated events without sharing utterances", async () => {
  assert.equal(typeof mod?.requestHermes, "function");
  const calls = [],
    listeners = new Set();
  const api = {
    request: async (method, params) => {
      calls.push({ method, params });
      if (method === "session.create")
        return { session_id: "aac-runtime", stored_session_id: "aac-stored" };
      if (method === "prompt.submit") {
        for (const fn of [...listeners])
          fn({
            type: "message.complete",
            payload: { session_id: "other", text: "unrelated" },
          });
        for (const fn of [...listeners])
          fn({
            type: "message.complete",
            payload: { session_id: "aac-runtime", text: "A short answer" },
          });
        return { accepted: true };
      }
      throw Error("Unknown method");
    },
    onEvent: (type, fn) => {
      assert.equal(type, "*");
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const answer = await mod.requestHermes("ask", "How can I ask for a break?", {
    hostApi: api,
  });
  assert.equal(answer, "A short answer");
  assert.equal(calls[0].method, "session.create");
  assert.equal(calls[1].method, "prompt.submit");
  assert.equal(calls[1].params.session_id, "aac-runtime");
  assert.ok(calls[1].params.text.includes("How can I ask for a break?"));
  assert.equal(listeners.size, 0);
  const prompt = mod.generationPrompt("a visit to the park");
  assert.ok(prompt.includes("open-board-0.1"));
  assert.ok(!prompt.includes("private message"));
  assert.equal(
    mod.parseProposal("```json\n" + mod.exportBoard(mod.coreBoard()) + "\n```")
      .id,
    "core",
  );
  assert.throws(() => mod.parseProposal("<script>bad</script>"));
});
test("Ask Hermes UI requires sharing review, does not auto-copy utterances and reports real gateway failures", async () => {
  const calls = [];
  sdk.host.request = async (method, params) => {
    calls.push({ method, params });
    throw Error("Gateway unavailable in test");
  };
  const store = mod.createStore({ get: () => null, set() {} });
  store.dispatch({ type: "select", text: "private phrase" });
  const view = render(runtime.jsx(mod.AACPage, { store }));
  studioTab(view,'Context / AI');
  assert.ok(
    view.queryByLabelText("Question for Hermes"),
    "Hermes consent form missing",
  );
  assert.equal(view.getByLabelText("Question for Hermes").value, "");
  assert.equal(calls.length, 0);
  fireEvent.change(view.getByLabelText("Question for Hermes"), {
    target: { value: "How do I ask for a break?" },
  });
  fireEvent.click(view.getByRole("button", { name: "Review sharing" }));
  assert.equal(calls.length, 0);
  assert.ok(
    view
      .getByLabelText("Exact text sent to Hermes")
      .textContent.includes("How do I ask for a break?"),
  );
  assert.ok(
    !view
      .getByLabelText("Exact text sent to Hermes")
      .textContent.includes("private phrase"),
  );
  fireEvent.click(
    view.getByRole("button", { name: "Confirm and send to Hermes" }),
  );
  await waitFor(() => assert.match(view.getByRole('alert').textContent,/Gateway unavailable in test/));
  assert.equal(calls.length, 1);
  assert.equal(store.get().words.join(" "), "private phrase");
  cleanup();
});
test("generated UI is validated board data and stays a proposal until approval", async () => {
  const listeners = new Set(),
    calls = [];
  const proposal = mod.coreBoard();
  proposal.id = "park-board";
  proposal.name = "Park vocabulary";
  sdk.host.onEvent = (type, fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  sdk.host.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "session.create") return { session_id: "generated-runtime" };
    if (method === "prompt.submit") {
      for (const fn of [...listeners])
        fn({
          type: "message.complete",
          payload: {
            session_id: "generated-runtime",
            text: mod.exportBoard(proposal),
          },
        });
      return { accepted: true };
    }
    throw Error("Unexpected RPC");
  };
  const store = mod.createStore({ get: () => null, set() {} });
  const view = render(runtime.jsx(mod.AACPage, { store }));
  studioTab(view,'Context / AI');
  assert.ok(
    view.queryByLabelText("Board generation topic"),
    "generation form missing",
  );
  fireEvent.change(view.getByLabelText("Board generation topic"), {
    target: { value: "a day at the park" },
  });
  fireEvent.click(
    view.getByRole("button", { name: "Review generation request" }),
  );
  assert.equal(calls.length, 0);
  fireEvent.click(
    view.getByRole("button", { name: "Confirm and send to Hermes" }),
  );
  await waitFor(() =>
    assert.equal(store.get().proposal?.name, "Park vocabulary"),
  );
  assert.equal(store.get().active, "core");
  assert.equal(store.get().custom.length, 0);
  assert.equal(store.get().words.length, 0);
  assert.equal(listeners.size, 0);
  fireEvent.click(view.getByRole("button", { name: "Approve board" }));
  assert.equal(store.get().active, "park-board");
  assert.equal(store.get().words.length, 0);
  cleanup();
});
test("persistence rejects unsafe settings and colliding personal board ids", () => {
  const store = mod.createStore({
    get: () => ({ custom: [], settings: { scanMs: 0, rate: 99, voice: 17 } }),
    set() {},
  });
  assert.equal(store.get().settings.scanMs, 1800);
  assert.equal(store.get().settings.rate, undefined);
  assert.equal(store.get().settings.voice, undefined);
  assert.throws(() =>
    store.dispatch({ type: "settings", settings: { scanMs: 0 } }),
  );
  for (let i = 0; i < 8; i++) {
    store.dispatch({ type: "propose", board: mod.coreBoard() });
    store.dispatch({ type: "approve" });
  }
  assert.equal(new Set(store.get().custom.map((b) => b.id)).size, 8);
  assert.ok(store.get().custom.every((b) => b.id !== "core"));
  const bad = mod.createStore({
    get: () => ({ custom: [mod.coreBoard()], settings: {} }),
    set() {},
  });
  assert.equal(bad.get().custom.length, 0);
});
test("personal creation accepts its advertised 48 phrase limit", () => {
  const store = mod.createStore({ get: () => null, set() {} });
  const view = render(runtime.jsx(mod.AACPage, { store }));
  studioTab(view,'Boards');
  fireEvent.change(view.getByLabelText("One phrase per line"), {
    target: {
      value: Array.from({ length: 48 }, (_, i) => "phrase " + i).join("\n"),
    },
  });
  fireEvent.click(view.getByRole("button", { name: "Preview personal board" }));
  assert.equal(store.get().proposal?.buttons.length, 48);
  cleanup();
});

test("manual JSON import refuses invalid data and renders markup as literal labels", () => {
  const store = mod.createStore({ get: () => null, set() {} });
  const view = render(runtime.jsx(mod.AACPage, { store }));
  studioTab(view,'Boards');
  fireEvent.change(view.getByLabelText("Board JSON"), {
    target: { value: '{"format":"open-board-0.1"}' },
  });
  fireEvent.click(view.getByRole("button", { name: "Preview JSON" }));
  assert.equal(store.get().proposal, null);
  const b = mod.coreBoard();
  b.id = "plain-data";
  b.buttons[0].label = "<script>alert(1)</script>";
  fireEvent.change(view.getByLabelText("Board JSON"), {
    target: { value: mod.exportBoard(b) },
  });
  fireEvent.click(view.getByRole("button", { name: "Preview JSON" }));
  assert.ok(store.get().proposal);
  assert.equal(view.container.querySelector("script"), null);
  fireEvent.click(view.getByRole("button", { name: "Reject proposal" }));
  assert.equal(store.get().proposal, null);
  cleanup();
});

test("stable core has fixed positions and selection builds exact utterance", () => {
  assert.ok(mod, "plugin implementation missing");
  const board = mod.coreBoard();
  assert.equal(board.grid.order[0][0], "i");
  assert.equal(board.buttons.find((x) => x.id === "no").label, "no");
  let state = mod.initialState();
  state = mod.reduce(state, { type: "select", text: "I" });
  state = mod.reduce(state, { type: "select", text: "want" });
  assert.equal(state.words.join(" "), "I want");
  state = mod.reduce(state, { type: "undo" });
  assert.equal(state.words.join(" "), "I");
  state = mod.reduce(state, { type: "clear" });
  assert.equal(state.words.length, 0);
  assert.deepEqual(board.grid.order, mod.coreBoard().grid.order);
});
