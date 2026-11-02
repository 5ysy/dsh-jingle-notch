import { surfaceCss, surfaceScript } from '../surface.ts'
import { DEFAULT_OVERLAY_PREFERENCES } from './preferences.ts'
import { WHALE_ASSETS } from './whale-assets.ts'
import { compactWhaleState } from './whale.ts'
import { actionableOverlayRequests, orderOverlaySessions, sessionHue } from './presentation.ts'

const icons = {
  home: '<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7"/>',
  recap: '<path d="M5 19V9M12 19V5M19 19v-7M3 19h18"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  quit: '<path d="M14 4h6v16h-6M20 12H6m5-5-5 5 5 5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
}
function icon(name: keyof typeof icons): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`
}

function whaleMarkup(id: string, className: string): string {
  const picture = (name: 'working' | 'layered', poster: 'workingPoster' | 'layeredPoster') =>
    `<picture class="whale-image whale-${name}"><source media="(prefers-reduced-motion: reduce)" srcset="${WHALE_ASSETS[poster]}"><img class="whale-raster" src="${WHALE_ASSETS[name]}" data-poster="${WHALE_ASSETS[poster]}" alt="" draggable="false"></picture>`
  return `<span${id ? ` id="${id}"` : ''} class="whale-avatar ${className}" data-state="idle" aria-hidden="true">${picture('layered','layeredPoster')}${picture('working','workingPoster')}<span class="whale-fallback" hidden>🐳</span></span>`
}

export function overlayHtml(nonce: string): string {
  return String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>JingleNotch · 鲸铃 Jingle</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: jingle-notch-whale://art; base-uri 'none'; form-action 'none'">
<style>
:root{color-scheme:dark;--notch:184px;--top:38px;--ink:#f1f2f4;--muted:#9298a3;--mint:#54d5c1}
*{box-sizing:border-box}body{margin:0;background:transparent;color:var(--ink);font:12px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;user-select:none}button,input,select{font:inherit}button{cursor:pointer;color:inherit}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--mint);outline-offset:2px}button:disabled{cursor:default}button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}button svg circle{fill:#08090b}
#island{background:#08090b;border-radius:0 0 23px 23px;overflow:hidden}body.expanded #island{box-shadow:0 5px 10px #0005}
#bar{height:var(--top);display:flex;align-items:center;justify-content:center;width:calc(var(--notch) + 110px);margin:auto;background:#08090b;border-radius:0 0 17px 17px}body.expanded #bar{width:100%;border-radius:0}
#notch{width:var(--notch);height:100%;flex:none}.wing{display:flex;align-items:center;width:55px;height:100%;gap:1px;padding:0 3px;flex:none}.left{justify-content:flex-start}.right{justify-content:flex-end}body.expanded .wing{width:calc((100% - var(--notch))/2);padding:0 12px;gap:6px}
.icon-button{border:0;background:transparent;color:#9298a3;border-radius:6px;width:23px;height:23px;display:flex;align-items:center;justify-content:center;padding:3px;flex:none}.icon-button:hover,.icon-button[aria-pressed=true]{color:#e6e9ed;background:#24272c}#mascot,#mascot-secondary{width:27px;height:27px;padding:0;overflow:visible}.brand{font-size:10px;font-weight:650;letter-spacing:1px;color:#8a9099}.expanded-only{display:none}body.expanded .expanded-only{display:flex}body.expanded #mascot,body.expanded #mascot-secondary{display:none}
.whale-avatar{position:relative;display:block;overflow:visible;isolation:isolate;filter:drop-shadow(0 2px 4px #163a8050)}.whale-image{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-drag:none}.whale-raster{display:block;width:100%;height:100%;object-fit:contain;border-radius:8px;transform-origin:center}.whale-fallback{position:absolute;inset:0;text-align:center;font-size:20px}.whale-avatar[data-unavailable=true] .whale-image{display:none}.whale-working{display:none}.whale-avatar[data-state=working] .whale-layered{display:none}.whale-avatar[data-state=working] .whale-working{display:block}.compact-whale{width:27px;height:27px}.compact-whale .whale-layered .whale-raster{transform:scale(1.28)}.compact-whale .whale-working .whale-raster{transform:scale(1.08)}.focus-whale{width:52px;height:52px;flex:none;filter:drop-shadow(0 0 9px #5d9ff044)}.focus-whale .whale-raster{transform:scale(1.22)}.session-whale{overflow:visible}.session-whale .whale-raster{transform:scale(1.35)}.whale-avatar[data-state=thinking]{animation:whale-think 2.4s ease-in-out infinite}.whale-avatar[data-state=working]{animation:whale-work 1.8s ease-in-out infinite}.whale-avatar[data-state=attention]{animation:whale-attention 1.25s ease-in-out infinite}.whale-avatar[data-state=finished]{animation:whale-finished 1.1s ease-in-out 2}.whale-avatar[data-state=idle]{animation:whale-idle 3.6s ease-in-out infinite}.whale-avatar[data-state=error]{animation:whale-error .55s ease-in-out 3}
#dots{display:none;gap:3px;width:27px;overflow:hidden;flex:none;align-items:center}body.expanded #dots{display:flex;width:auto;max-width:37px;margin-right:4px}.dot,.session-led{width:5px;height:5px;border-radius:50%;background:#737b88;flex:none}.working{--state:#46d3bc}.thinking{--state:#b3a2f4}.attention{--state:#f0b960}.error{--state:#f28e97}.finished{--state:#8ad7a7}.idle{--state:#737b88}.dot,.session-led{background:var(--state,#737b88)}.dot.attention{animation:pulse 1.8s ease-in-out infinite}
body[data-mode=hidden] #bar{opacity:0}body[data-mode=hidden] #island{background:transparent}#panel{display:none;padding:0 10px 10px;max-height:calc(100vh - var(--top) - 12px);overflow:auto;scrollbar-width:thin;scrollbar-color:#41464e transparent}body.expanded #panel{display:block;animation:arrive .2s ease-out}#content{min-width:0}#home-view,#detail-view,#settings-view,#recap-view{display:none}body[data-view=home] #home-view,body[data-view=detail] #detail-view,body[data-view=settings] #settings-view,body[data-view=recap] #recap-view{display:block}
.section-title{display:flex;gap:7px;align-items:center;padding:6px 4px 10px;font-size:10px;color:#9a9fa9}.section-title strong{color:#d5d9df;font-weight:600;font-size:11px}.spacer{flex:1}.text-button{padding:0;border:0;background:transparent;color:#8f97a2;font-size:10px}.text-button:hover{color:#e4e8ed}.quiet{color:#868d98;font-size:11px}.section-title #quit{color:#898f99}
#overview{display:grid;grid-template-columns:1.15fr 1fr;gap:9px;min-height:118px}.focus-card,.session-list{border-radius:16px;background:#141619}.focus-card{border:1px solid #22262b;text-align:left;padding:13px 14px;min-width:0;display:flex;align-items:center}.focus-card:hover{background:#191d21;border-color:#3d494c}.focus-main{display:flex;gap:12px;align-items:center;min-width:0;width:100%}.focus-copy{min-width:0;color:#d0d5db;font-size:11px;text-align:left}.focus-copy span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.focus-name-row{display:flex;align-items:baseline;gap:7px;min-width:0}.focus-name-row strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.focus-workspace{color:#818b96;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.focus-summary{color:#c8d0d6;margin-top:6px}.focus-tool{color:#8c949e;font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.session-list{padding:10px;min-width:0;display:flex;align-items:center}#session-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:35px;gap:7px;width:100%;max-height:77px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;overflow-anchor:none;scrollbar-width:thin}.session-chip{min-width:0;text-align:left;border:1px solid hsl(var(--session-hue,160) 44% 45% / .7);border-radius:20px;background:transparent;padding:7px 9px;display:flex;gap:7px;align-items:center;height:35px}.session-chip:hover{background:hsl(var(--session-hue,160) 24% 16%)}.session-chip[aria-pressed=true]{border-color:hsl(var(--session-hue,160) 64% 64%);background:hsl(var(--session-hue,160) 30% 15%)}.session-avatar{width:24px;height:17px;position:relative;flex:none}.session-whale{width:24px;height:17px}.session-whale .whale-raster{border-radius:4px}.session-name{font-size:10px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.session-count{font-size:9px;margin-left:auto;color:#f0b960}
.detail-heading{display:flex;align-items:center;gap:8px;padding:8px 4px 5px}.detail-heading h2{font-size:12px;margin:0;overflow-wrap:anywhere}.back-button{border:0;border-radius:7px;background:#20242a;color:#aab2bd;padding:4px 8px;font-size:11px}#status{color:#929ca8;margin:4px 4px 10px;overflow-wrap:anywhere;font-size:10px}#cards,#detail,#activity{user-select:text}#activity p{padding:7px 4px;margin:0;overflow-wrap:anywhere;border-bottom:1px solid #24282d;font-size:11px;color:#bfc6cf}#activity time{color:#697582;font-size:10px;margin-right:8px;font-variant-numeric:tabular-nums}
.settings-card{background:#141619;border:1px solid #272c31;border-radius:15px;padding:5px 14px;margin-top:3px}.setting{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:11px 0;border-bottom:1px solid #262a2f}.setting:last-child{border:0}.setting span{color:#d6dae0;font-size:11px}.setting small{display:block;color:#7f8995;font-size:10px;margin-top:3px;max-width:330px}.setting input[type=checkbox]{appearance:none;width:30px;height:18px;border-radius:12px;background:#373d45;position:relative;cursor:pointer;flex:none;margin:0}.setting input[type=checkbox]:before{content:'';position:absolute;left:3px;top:3px;width:12px;height:12px;background:#eef2f5;border-radius:50%;transition:transform .15s}.setting input[type=checkbox]:checked{background:#3cae9b}.setting input[type=checkbox]:checked:before{transform:translateX(12px)}.setting select{min-width:92px;background:#23282e;border:1px solid #353d46;border-radius:7px;color:#d4dbe2;padding:5px;font-size:11px}#save-state{font-size:10px;color:#86939d;min-height:15px;margin:8px 4px 0}.error-text{color:#f4a8ad!important}.settings-help{color:#7e8997;font-size:10px;padding:0 4px;margin:6px 0 0}
.recap-card{background:#141619;border:1px solid #272c31;border-radius:15px;padding:13px 14px;margin-top:3px}.recap-head{display:flex;align-items:baseline;gap:8px}.recap-head strong{font-size:12px}.recap-head span{color:#858f9b;font-size:10px}.recap-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:11px}.recap-metric{padding:9px 8px;border-radius:10px;background:#1b1f23}.recap-metric b{display:block;color:#e7ebee;font-size:15px;font-variant-numeric:tabular-nums}.recap-metric span{display:block;color:#858e99;font-size:9px;margin-top:2px}.recap-empty{color:#89929e;font-size:11px;padding:12px 0 2px}.recap-note{color:#707b87;font-size:10px;margin:10px 0 0}
#connection{display:none;color:#f1c27e;font-size:10px;padding:6px 4px}body.offline #connection{display:block}
@keyframes blink{0%,92%,96%,100%{transform:scaleY(1)}94%{transform:scaleY(.12)}}@keyframes whale-idle{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-2px) rotate(1deg)}}@keyframes whale-think{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-2px) rotate(2deg)}}@keyframes whale-work{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-1px) rotate(1deg)}}@keyframes whale-attention{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}@keyframes whale-finished{0%,100%{transform:translateY(0)}45%{transform:translateY(-4px) rotate(-3deg)}}@keyframes whale-error{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px) rotate(-2deg)}75%{transform:translateX(2px) rotate(2deg)}}@keyframes pulse{50%{opacity:.35}}@keyframes arrive{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*,*:before{animation:none!important;transition:none!important}}
${surfaceCss}
.cq-card{border-color:#343d44;border-radius:12px;background:#171c21;padding:13px}.cq-card h3{font-size:12px}.cq-card input{accent-color:#54d5c1}.cq-card button{background:#89d5c5;color:#132b29;font-size:11px}.cq-card textarea{background:#101418;border-color:#3c4853}.cq-diff summary{color:#b6c7ce}
</style></head><body data-mode="compact" data-view="home">
<div id="island"><div id="bar"><div class="wing left">
<button id="mascot" class="icon-button" aria-label="Expand sessions" title="Open sessions">${whaleMarkup('mascot-avatar','compact-whale')}</button>
<button id="home" class="icon-button expanded-only" aria-label="Session overview" title="Sessions">${icon('home')}</button><button id="recap-open" class="icon-button expanded-only" aria-label="Weekly recap" title="Weekly recap">${icon('recap')}</button><span class="brand expanded-only">Jingle</span></div>
<div id="notch"></div><div class="wing right"><button id="mascot-secondary" class="icon-button" aria-label="Expand sessions" title="Open sessions">${whaleMarkup('secondary-avatar','compact-whale')}</button><div id="dots" aria-label="Session states"></div><button id="settings-open" class="icon-button expanded-only" aria-label="Settings" title="Settings">${icon('settings')}</button><button id="quit-top" class="icon-button expanded-only" aria-label="Quit overlay" title="Quit overlay">${icon('quit')}</button><button id="close" class="icon-button expanded-only" title="Collapse · Esc" aria-label="Collapse overlay">${icon('close')}</button></div></div>
<section id="panel" aria-label="JingleNotch · AI Agent Approval Notifier"><div id="content"><div id="connection" role="status">Waiting for dsh to reconnect…</div>
<section id="home-view">
<div id="overview"><button id="focus" class="focus-card" title="View session details"><div class="focus-main">${whaleMarkup('focus-avatar','focus-whale')}<div class="focus-copy"><div class="focus-name-row"><strong id="focus-name">Waiting for dsh</strong><span id="focus-workspace" class="focus-workspace"></span></div><span id="focus-summary" class="focus-summary">Your sessions will appear here.</span><div id="focus-tool" class="focus-tool"></div></div></div></button>
<div class="session-list"><div id="session-grid" tabindex="0" aria-label="Sessions; scroll for more"></div></div></div>
</section>
<section id="recap-view"><div class="section-title"><strong>Weekly recap</strong><span class="spacer"></span><button id="recap-done" class="text-button">Done</button></div><div id="weekly-recap" class="recap-card"></div></section>
<section id="detail-view"><div class="detail-heading"><button id="back" class="back-button" aria-label="Back to sessions">‹</button><h2 id="detail-title">Session activity</h2></div><p id="status"></p><div id="cards"></div><div id="detail"></div><div id="activity"></div></section>
<section id="settings-view"><div class="section-title"><strong>Notch behavior</strong><span class="spacer"></span><button id="settings-done" class="text-button">Done</button></div><div class="settings-card">
<label class="setting" for="open-on-hover"><span>Open on hover<small>Move to the notch to peek; click inside to keep it open longer.</small></span><input id="open-on-hover" type="checkbox"></label>
<label class="setting" for="auto-close"><span>Auto-close after<small>Clicked panels close after this delay.</small></span><select id="auto-close"><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="0">Never</option></select></label>
<label class="setting" for="hide-after"><span>Hide when inactive<small>Hide the small wings. Hover over the notch to bring them back.</small></span><select id="hide-after"><option value="60">1 minute</option><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="0">Never</option></select></label>
<label class="setting" for="expand-attention"><span>Expand for new requests<small>Open when any session needs an approval or answer.</small></span><input id="expand-attention" type="checkbox"></label>
</div><p id="save-state" aria-live="polite"></p><p class="settings-help">Hover, settings and unfinished replies keep the panel open. Esc folds it.</p></section>
</div></section></div>
<script nonce="${nonce}">
${surfaceScript}
(function(){
'use strict';
var api=window.jingleNotch,ui=window.JingleNotchSurface,state,selected,expanded=false,view='home',settingsReady=false,saving=false;
var preferences=${JSON.stringify(DEFAULT_OVERLAY_PREFERENCES)},appearance={},detailKey,sessionNodes=new Map(),drafts=new Map();
var panel=document.getElementById('panel'),content=document.getElementById('content'),grid=document.getElementById('session-grid');
var fields=['open-on-hover','auto-close','hide-after','expand-attention'];
var compactWhaleState=${compactWhaleState.toString()};
var actionableOverlayRequests=${actionableOverlayRequests.toString()},orderOverlaySessions=${orderOverlaySessions.toString()},sessionHue=${sessionHue.toString()};
var lastRequests=new Set(),pendingTarget,attentionScheduled=false,composing=false,lastRenderedSelection,lastEditing;
var labels={idle:'Idle',working:'Working',thinking:'Thinking',attention:'Needs you',finished:'Finished',error:'Failed'};
function current(){return state&&(state.sessions||[]).find(function(s){return s.id===selected;});}
function setView(next){view=next;document.body.dataset.view=next;document.getElementById('settings-open').setAttribute('aria-pressed',String(next==='settings'));document.getElementById('recap-open').setAttribute('aria-pressed',String(next==='recap'));if(next==='detail')renderDetail();if(next==='recap')renderRecap();updateHold();measure();}
function openView(next){api.expand(true);setView(next);}
function collapse(){if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();api.expand(false);}
function syncSettings(){document.getElementById('open-on-hover').checked=preferences.openOnHover;document.getElementById('auto-close').value=String(preferences.autoCloseSeconds);document.getElementById('hide-after').value=String(preferences.hideAfterSeconds);document.getElementById('expand-attention').checked=preferences.expandOnAttention;}
fields.forEach(function(id){document.getElementById(id).disabled=true;});
api.getPreferences().then(function(value){preferences=value;syncSettings();settingsReady=true;fields.forEach(function(id){document.getElementById(id).disabled=false;});render();}).catch(function(){document.getElementById('save-state').textContent='Could not load settings. Reopen the overlay to retry.';});
function savePreferences(){
 if(!settingsReady||saving)return;saving=true;fields.forEach(function(id){document.getElementById(id).disabled=true;});
 var next={openOnHover:document.getElementById('open-on-hover').checked,autoCloseSeconds:Number(document.getElementById('auto-close').value),hideAfterSeconds:Number(document.getElementById('hide-after').value),expandOnAttention:document.getElementById('expand-attention').checked};
 var message=document.getElementById('save-state');message.classList.remove('error-text');message.textContent='Saving…';
 api.setPreferences(next).then(function(result){if(!result.ok)throw new Error(result.error);preferences=result.preferences;message.textContent='Saved on this Mac';}).catch(function(){message.textContent='Could not save settings. Please try again.';message.classList.add('error-text');}).finally(function(){syncSettings();saving=false;fields.forEach(function(id){document.getElementById(id).disabled=false;});});
}
fields.forEach(function(id){document.getElementById(id).addEventListener('change',savePreferences);});
document.getElementById('mascot').addEventListener('click',function(){openView('home');});
document.getElementById('mascot-secondary').addEventListener('click',function(){openView('home');});
document.getElementById('home').addEventListener('click',function(){setView('home');});
document.getElementById('recap-open').addEventListener('click',function(){openView(view==='recap'?'home':'recap');});
document.getElementById('recap-done').addEventListener('click',function(){setView('home');});
document.getElementById('settings-open').addEventListener('click',function(){openView(view==='settings'?'home':'settings');});
document.getElementById('settings-done').addEventListener('click',function(){setView('home');});
document.getElementById('close').addEventListener('click',collapse);
document.getElementById('quit-top').addEventListener('click',function(){api.quit();});
document.getElementById('focus').addEventListener('click',function(){if(current())setView('detail');});
document.getElementById('back').addEventListener('click',function(){setView('home');});
document.addEventListener('pointerdown',function(){api.interact();});
document.addEventListener('keydown',function(e){
 if(e.isComposing||composing||e.keyCode===229)return;
 if(e.key==='Escape'){e.preventDefault();collapse();return;}api.interact();
 if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&state&&state.sessions.length){var sessions=state.sessions,index=sessions.findIndex(function(s){return s.id===selected;});selected=sessions[(index+(e.key==='ArrowRight'?1:-1)+sessions.length)%sessions.length].id;detailKey=undefined;render();e.preventDefault();}
});
function setWhaleState(node,next){if(node.dataset.state!==next)node.dataset.state=next;}
document.addEventListener('error',function(event){
 var image=event.target;if(!image.classList||!image.classList.contains('whale-raster'))return;
 console.warn('jingleNotch whale: image decode failed',image.currentSrc||image.src);
 if(!image.dataset.failed){image.dataset.failed='true';var source=image.parentElement.querySelector('source');if(source)source.remove();image.src=image.dataset.poster;}
 else{var avatar=image.closest('.whale-avatar');avatar.dataset.unavailable='true';avatar.querySelector('.whale-fallback').hidden=false;}
},true);
function interactionBusy(){return composing||view==='settings'||drafts.size>0||panel.contains(document.activeElement)&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);}
function updateHold(){api.hold(expanded&&interactionBusy());var active=document.activeElement,editing=expanded&&(composing||panel.contains(active)&&(active.tagName==='TEXTAREA'||active.tagName==='INPUT'&&!['radio','checkbox','button','submit'].includes(active.type)));if(editing!==lastEditing){lastEditing=editing;api.editing(editing);}if(pendingTarget&&!interactionBusy()&&!attentionScheduled){attentionScheduled=true;requestAnimationFrame(function(){attentionScheduled=false;render();});}}
document.addEventListener('compositionstart',function(){composing=true;updateHold();});
document.addEventListener('compositionend',function(){composing=false;updateHold();});
document.addEventListener('focusin',updateHold);document.addEventListener('focusout',function(){setTimeout(updateHold,0);});
document.getElementById('cards').addEventListener('input',function(e){var card=e.target.closest('.cq-card');if(!card)return;var dirty=Array.from(card.querySelectorAll('input,textarea')).some(function(input){return input.tagName==='TEXTAREA'?input.value.trim():input.checked;});if(dirty)drafts.set(card.dataset.key,card);else drafts.delete(card.dataset.key);updateHold();});
document.getElementById('cards').addEventListener('change',function(e){e.target.dispatchEvent(new Event('input',{bubbles:true}));});
function measure(){if(expanded)requestAnimationFrame(function(){api.contentHeight(content.scrollHeight+12);});}
new ResizeObserver(measure).observe(content);
api.onGeometry(function(g){document.documentElement.style.setProperty('--notch',g.notch+'px');document.documentElement.style.setProperty('--top',g.top+'px');});
api.onAppearance(function(value){
 var wasExpanded=expanded;appearance=value;expanded=value.mode==='expanded';document.body.dataset.mode=value.mode;document.body.classList.toggle('expanded',expanded);
 if(!expanded&&wasExpanded){setView('home');}
 if(expanded&&!wasExpanded){if(view==='detail')renderDetail();measure();updateHold();}
});
api.onConnection(function(connected){document.body.classList.toggle('offline',!connected);measure();});
api.onState(function(value){var requests=actionableOverlayRequests(value),fresh=requests.filter(function(request){return !lastRequests.has(request.key);});lastRequests=new Set(requests.map(function(request){return request.key;}));var target=fresh.find(function(request){return request.sessionId;});if(target)pendingTarget=target.sessionId;if(pendingTarget&&!requests.some(function(request){return request.sessionId===pendingTarget;}))pendingTarget=undefined;state=value;render();});
function render(){
 if(!state)return;var requests=actionableOverlayRequests(state),sessions=orderOverlaySessions(state.sessions||[],requests);
 if(pendingTarget&&!sessions.some(function(session){return session.id===pendingTarget;}))pendingTarget=undefined;
 if(pendingTarget&&settingsReady){if(!preferences.expandOnAttention)pendingTarget=undefined;else if(!interactionBusy()&&sessions.some(function(session){return session.id===pendingTarget;})){selected=pendingTarget;pendingTarget=undefined;detailKey=undefined;setView('home');}}
 if(!sessions.some(function(s){return s.id===selected;})){selected=(sessions.find(function(s){return s.state==='attention';})||sessions[0]||{}).id;detailKey=undefined;}
 var dots=document.getElementById('dots');dots.replaceChildren();sessions.slice(0,5).forEach(function(s){var dot=ui.el('span',undefined,'dot '+s.state);dot.title=s.label+' · '+(labels[s.state]||s.state);dots.appendChild(dot);});
 var scrollTop=grid.scrollTop,keep=new Set();sessions.forEach(function(s){
  keep.add(s.id);var chip=sessionNodes.get(s.id);if(!chip){chip=ui.el('button',undefined,'session-chip');chip.type='button';chip.dataset.id=s.id;var avatar=ui.el('span',undefined,'session-avatar');avatar.innerHTML=${JSON.stringify(whaleMarkup('','session-whale'))};chip.appendChild(avatar);chip.appendChild(ui.el('span',undefined,'session-name'));chip.appendChild(ui.el('span',undefined,'session-count'));chip.addEventListener('click',function(){selected=s.id;detailKey=undefined;render();});sessionNodes.set(s.id,chip);grid.appendChild(chip);}
  chip.style.setProperty('--session-hue',String(sessionHue(s.id)));chip.setAttribute('aria-pressed',String(s.id===selected));chip.setAttribute('aria-label',s.label+' · '+(labels[s.state]||s.state));chip.title=(s.cwd||s.label)+' · '+(s.currentTool||labels[s.state]||s.state);setWhaleState(chip.children[0].firstElementChild,s.state);chip.children[1].textContent=s.label;
  var waiting=(state.approvals||[]).filter(function(a){return a.sessionId===s.id;}).length+(state.questions||[]).filter(function(q){return q.sessionId===s.id;}).length;chip.children[2].textContent=waiting||'';
 });
 sessionNodes.forEach(function(node,id){if(!keep.has(id)){node.remove();sessionNodes.delete(id);}});
 sessions.forEach(function(session,index){var node=sessionNodes.get(session.id);if(grid.children[index]!==node)grid.insertBefore(node,grid.children[index]||null);});grid.scrollTop=scrollTop;
 if(selected!==lastRenderedSelection){lastRenderedSelection=selected;requestAnimationFrame(function(){var node=sessionNodes.get(selected);if(node)node.scrollIntoView({block:'nearest'});});}
 var empty=grid.querySelector('.quiet');if(!sessions.length&&!empty)grid.appendChild(ui.el('span','No live sessions','quiet'));else if(sessions.length&&empty)empty.remove();
 var item=current(),latest=item&&item.ticker&&item.ticker.at(-1);
 document.getElementById('focus').disabled=!item;
 document.getElementById('focus-name').textContent=item?item.label:'All quiet';document.getElementById('focus-workspace').textContent=item&&item.cwd?item.cwd:'';
 document.getElementById('focus-summary').textContent=latest?latest.text:item?'Ready when you are.':'Start a dsh session to see it here.';
 document.getElementById('focus-tool').textContent=item?(item.currentTool||((item.stats&&item.stats.toolCalls)||0)+' tools · '+((item.stats&&item.stats.filesChanged)||0)+' files'):'';
 var urgent=requests.length,compactState=compactWhaleState(sessions,urgent>0);
 setWhaleState(document.getElementById('mascot-avatar'),compactState);
 setWhaleState(document.getElementById('secondary-avatar'),compactState==='working'?'idle':'working');
 setWhaleState(document.getElementById('focus-avatar'),item?item.state:'idle');
 renderRecap();
 renderDetail();measure();
}
 function renderRecap(){
  var container=document.getElementById('weekly-recap');if(!container)return;container.replaceChildren();
  var weeks=state&&state.recap&&Array.isArray(state.recap.weeks)?state.recap.weeks.slice().reverse():[];
  var week=weeks[0];
  if(!week){container.appendChild(ui.el('p','No activity recorded this week yet.','recap-empty'));return;}
  var head=ui.el('div',undefined,'recap-head');head.appendChild(ui.el('strong','This week'));head.appendChild(ui.el('span',week.week));container.appendChild(head);
  var metrics=ui.el('div',undefined,'recap-metrics');[['turns',week.turns],['tool calls',week.toolCalls],['active min',Math.round(week.activeMs/60000)]].forEach(function(entry){var metric=ui.el('div',undefined,'recap-metric');metric.appendChild(ui.el('b',String(entry[1]||0)));metric.appendChild(ui.el('span',entry[0]));metrics.appendChild(metric);});container.appendChild(metrics);
  container.appendChild(ui.el('p','Aggregated locally from dsh sessions.','recap-note'));
 }
function renderDetail(){
 if(!state)return;var item=current(),cards=document.getElementById('cards');
 document.getElementById('detail-title').textContent=item?item.label:'Pending requests';document.getElementById('status').textContent=item?(item.cwd||item.currentTool||labels[item.state]):'No active sessions';
 // Keep request DOM mounted across session switches to preserve drafts and question selections.
 ui.reconcile(cards,state,function(action){return api.submit(action);});
 var visible=new Set((state.approvals||[]).filter(function(a){return !a.sessionId||a.sessionId===selected;}).map(function(a){return 'a:'+a.id;}).concat((state.questions||[]).filter(function(q){return q.sessionId===selected;}).map(function(q){return 'q:'+JSON.stringify([q.sessionId,q.callId]);})));
 Array.from(cards.children).forEach(function(card){card.hidden=!visible.has(card.dataset.key);card.style.display=card.hidden?'none':'';});
 drafts.forEach(function(card,key){if(!card.isConnected)drafts.delete(key);});updateHold();
 var detail=document.getElementById('detail'),key=JSON.stringify([selected,item&&item.changes]);if(detailKey!==key){detail.replaceChildren();ui.changes(detail,item&&item.changes);detailKey=key;}
 var activity=document.getElementById('activity');activity.replaceChildren();((item&&item.ticker)||[]).slice(-8).reverse().forEach(function(t){var p=ui.el('p');p.appendChild(ui.el('time',new Date(t.t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));p.appendChild(document.createTextNode(t.text));activity.appendChild(p);});
}
})();
</script></body></html>`
}
