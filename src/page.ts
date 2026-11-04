import { surfaceCss, surfaceScript } from './surface.ts'
/**
 * The JingleNotch dashboard: one self-contained HTML document — inline CSS
 * and vanilla JS, no build step, no external assets — polling
 * `/jingle/api/state`. The mascot is an original squircle drawn in SVG that
 * mirrors the most active session state.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JingleNotch · AI Agent Approval Notifier</title>
<style>
  :root {
    --bg: #0e1014; --panel: #15181f; --panel-2: #1b1f29; --line: #262b36;
    --text: #e7eaf0; --muted: #8b93a3; --accent: #ffb454;
    --idle: #6b7280; --thinking: #60a5fa; --working: #a78bfa;
    --attention: #f59e0b; --finished: #34d399; --error: #f87171;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    background: radial-gradient(1200px 500px at 50% -10%, #1a2030 0%, var(--bg) 60%);
    color: var(--text); font: 14px/1.5 ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    min-height: 100vh; padding: 28px 20px 40px;
  }
  .wrap { max-width: 1060px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  header .overlay-btn {
    border: 1px solid var(--border); background: transparent; color: var(--muted);
    border-radius: 8px; padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer;
  }
  header .overlay-btn:hover { color: var(--text); border-color: var(--muted); }
  header h1 { font-size: 20px; font-weight: 650; letter-spacing: .2px; }
  header h1 .dot { color: var(--accent); }
  header .sub { color: var(--muted); font-size: 13px; }
  header .uptime { margin-left: auto; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }

  .top { display: grid; grid-template-columns: 280px 1fr; gap: 18px; align-items: stretch; }
  @media (max-width: 760px) { .top { grid-template-columns: 1fr; } }

  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 20px; }
  .mascot-card { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px; gap: 6px; min-height: 260px; }
  .mascot-state { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }

  .alerts { display: flex; flex-direction: column; gap: 10px; padding: 16px; min-height: 260px; justify-content: center; }
  .alerts h2 { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .12em; font-weight: 600; }
  .alert { display: flex; gap: 10px; align-items: flex-start; background: var(--panel-2); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; }
  .alert .badge { font-size: 10px; font-weight: 700; letter-spacing: .08em; padding: 3px 8px; border-radius: 999px; margin-top: 2px; white-space: nowrap; }
  .badge.approval { background: rgba(245,158,11,.15); color: var(--attention); }
  .badge.question { background: rgba(96,165,250,.15); color: var(--thinking); }
  .alert .body { flex: 1; min-width: 0; }
  .alert .title { font-weight: 600; }
  .alert .detail { color: var(--muted); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alert .copy { border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 8px; font-size: 11px; padding: 4px 8px; cursor: pointer; }
  .alert .copy:hover { color: var(--text); border-color: var(--accent); }
  .approval-actions { display: flex; gap: 5px; flex: none; }
  .alert .copy.allow { color: var(--finished); }
  .alert .copy.always { color: var(--attention); }
  .alert .copy:disabled { cursor: wait; opacity: .55; }
  .question-actions { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  .quiet { color: var(--muted); font-size: 13px; text-align: center; }

  h2.section { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .12em; font-weight: 600; margin-top: 6px; }
  .pills { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
  .pill { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
  .pill .row { display: flex; align-items: center; gap: 8px; }
  .pill .name { font-weight: 650; font-size: 15px; }
  .pill .cwd { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
  .state { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; margin-left: auto; }
  .st-idle { background: rgba(107,114,128,.16); color: var(--idle); }
  .st-thinking { background: rgba(96,165,250,.14); color: var(--thinking); }
  .st-working { background: rgba(167,139,250,.14); color: var(--working); }
  .st-attention { background: rgba(245,158,11,.16); color: var(--attention); }
  .st-finished { background: rgba(52,211,153,.14); color: var(--finished); }
  .st-error { background: rgba(248,113,113,.14); color: var(--error); }

  .ticker { display: flex; flex-direction: column; gap: 3px; border-top: 1px solid var(--line); padding-top: 8px; min-height: 66px; }
  .tick { color: var(--muted); font-size: 12.5px; display: flex; gap: 8px; }
  .tick .k { flex: none; width: 58px; text-align: right; color: #566; font-variant-numeric: tabular-nums; }
  .tick.tool { color: #b9c2d4; }
  .tick.diff { color: #c4b5fd; }
  .tick.approval { color: var(--attention); }
  .tick.question { color: var(--thinking); }
  .tick.done { color: var(--finished); }
  .tick.failed { color: var(--error); }
  .tick span.txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pill .meta { display: flex; gap: 14px; color: var(--muted); font-size: 11.5px; font-variant-numeric: tabular-nums; }
  .pill .tool-now { color: var(--working); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  footer { display: flex; gap: 22px; flex-wrap: wrap; color: var(--muted); font-size: 12.5px; padding: 4px 4px 0; font-variant-numeric: tabular-nums; }
  footer b { color: var(--text); font-weight: 650; }

  /* mascot */
  .jingle { width: 132px; height: 120px; }
  .m-body { fill: #ffe9c9; stroke: #e8cfa4; stroke-width: 2; }
  .m-shine { fill: #fff6e6; opacity: .7; }
  .m-eye { fill: #2b2620; }
  .m-happy { stroke: #2b2620; stroke-width: 3; fill: none; stroke-linecap: round; display: none; }
  .m-cross { stroke: #2b2620; stroke-width: 3; stroke-linecap: round; display: none; }
  .m-brow { stroke: #2b2620; stroke-width: 3; stroke-linecap: round; display: none; }
  .m-blush { fill: #ffb9a3; opacity: .55; }
  .m-mouth { stroke: #2b2620; stroke-width: 2.5; fill: none; stroke-linecap: round; }
  .m-mark { font: 700 20px ui-sans-serif, system-ui; }
  .anim-idle { animation: breathe 3.4s ease-in-out infinite; transform-origin: 66px 96px; }
  .anim-thinking { animation: sway 2.6s ease-in-out infinite; transform-origin: 66px 96px; }
  .anim-working { animation: bounce 1s ease-in-out infinite; transform-origin: 66px 96px; }
  .anim-attention { animation: nudge .7s ease-in-out infinite; transform-origin: 66px 96px; }
  .anim-finished { animation: jump .8s cubic-bezier(.3,1.6,.5,1) infinite; transform-origin: 66px 110px; }
  .anim-error { animation: dizzy 1.2s linear infinite; transform-origin: 66px 66px; }
  .anim-annoyed { animation: shake .3s linear 2; transform-origin: 66px 96px; }
  @keyframes breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.035); } }
  @keyframes sway { 0%,100% { transform: rotate(-2.5deg); } 50% { transform: rotate(2.5deg); } }
  @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes nudge { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
  @keyframes jump { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-14px); } }
  @keyframes dizzy { 0% { transform: rotate(0); } 25% { transform: rotate(6deg); } 50% { transform: rotate(0); } 75% { transform: rotate(-6deg); } 100% { transform: rotate(0); } }
  @keyframes shake { 0%,100% { transform: translateX(0); } 33% { transform: translateX(-4px); } 66% { transform: translateX(4px); } }
  .jingle.click { cursor: pointer; }
${surfaceCss}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>JingleNotch<span class="dot">.</span></h1>
    <span class="sub">AI Agent Approval Notifier</span>
    <button class="overlay-btn" id="overlayBtn" title="Restart the notch overlay (Electron)">↻ notch overlay</button>
    <span class="uptime" id="uptime"></span>
  </header>

  <div class="top">
    <div class="card mascot-card">
      <svg id="jingle" class="jingle click" viewBox="0 0 132 132" role="img" aria-label="JingleNotch session indicator">
        <ellipse cx="66" cy="118" rx="34" ry="6" fill="#000" opacity=".25"/>
        <g id="m-all">
          <rect id="m-body" class="m-body" x="26" y="26" width="80" height="80" rx="26"/>
          <ellipse class="m-shine" cx="50" cy="46" rx="16" ry="9"/>
          <ellipse class="m-blush" cx="42" cy="76" rx="8" ry="4.5"/>
          <ellipse class="m-blush" cx="90" cy="76" rx="8" ry="4.5"/>
          <g id="eyes-open">
            <ellipse class="m-eye" cx="52" cy="64" rx="5.5" ry="7" id="eyeL"/>
            <ellipse class="m-eye" cx="80" cy="64" rx="5.5" ry="7" id="eyeR"/>
          </g>
          <g id="eyes-happy">
            <path class="m-happy" d="M46 66 Q52 59 58 66"/>
            <path class="m-happy" d="M74 66 Q80 59 86 66"/>
          </g>
          <g id="eyes-cross">
            <path class="m-cross" d="M47 60 L57 69 M57 60 L47 69"/>
            <path class="m-cross" d="M75 60 L85 69 M85 60 L75 69"/>
          </g>
          <g id="brows">
            <path class="m-brow" d="M45 53 L59 57"/>
            <path class="m-brow" d="M87 53 L73 57"/>
          </g>
          <path id="mouth" class="m-mouth" d="M60 82 Q66 87 72 82"/>
          <text id="mark" class="m-mark" x="98" y="40" fill="#f59e0b" display="none">!</text>
        </g>
      </svg>
      <div class="mascot-state" id="mascotLabel">idle</div>
    </div>

    <div class="card alerts" id="alerts">
      <h2>Needs you</h2>
      <div id="alertList" class="quiet">All clear — the agent is on its own.</div>
    </div>
  </div>

  <h2 class="section">Sessions</h2>
  <div class="pills" id="pills"></div>

  <footer id="stats"></footer>
</div>

<script>
${surfaceScript}
(function () {
  'use strict';
  var jingle = document.getElementById('jingle');
  var mascotLabel = document.getElementById('mascotLabel');
  var pillsEl = document.getElementById('pills');
  var alertList = document.getElementById('alertList');
  var statsEl = document.getElementById('stats');
  var uptimeEl = document.getElementById('uptime');
  var pokes = 0, lastPoke = 0, override = null, overrideUntil = 0;

  function fmtDur(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ' + (s % 60) + 's';
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }
  function fmtTime(t) {
    var d = new Date(t);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loudest(state) {
    var rank = { error: 5, attention: 4, working: 3, thinking: 2, finished: 1, idle: 0 };
    return rank[state] || 0;
  }

  function applyMascot(state) {
    if (override && Date.now() < overrideUntil) state = override;
    else override = null;
    var svg = jingle;
    svg.classList.remove.apply(svg.classList, ['anim-idle','anim-thinking','anim-working','anim-attention','anim-finished','anim-error','anim-annoyed'].filter(function (c) { return svg.classList.contains(c); }));
    svg.classList.add('anim-' + state);
    var open = document.getElementById('eyes-open');
    var happy = document.getElementById('eyes-happy');
    var cross = document.getElementById('eyes-cross');
    var brows = document.getElementById('brows');
    var mark = document.getElementById('mark');
    var mouth = document.getElementById('mouth');
    open.style.display = 'none'; happy.style.display = 'none'; cross.style.display = 'none'; brows.style.display = 'none';
    mark.style.display = 'none';
    if (state !== 'finished' && state !== 'error') open.style.display = '';
    var eyeL = document.getElementById('eyeL'), eyeR = document.getElementById('eyeR');
    eyeL.setAttribute('cx', '52'); eyeR.setAttribute('cx', '80');
    eyeL.setAttribute('cy', '64'); eyeR.setAttribute('cy', '64');
    mouth.setAttribute('d', 'M60 82 Q66 87 72 82');
    if (state === 'thinking') { eyeL.setAttribute('cy', '60'); eyeR.setAttribute('cy', '60'); }
    if (state === 'working') { eyeL.setAttribute('cx', '55'); eyeR.setAttribute('cx', '83'); }
    if (state === 'attention') { brows.style.display = ''; mark.style.display = ''; mouth.setAttribute('d', 'M60 85 Q66 81 72 85'); }
    if (state === 'finished') { happy.style.display = ''; mouth.setAttribute('d', 'M58 81 Q66 90 74 81'); }
    if (state === 'error' || state === 'annoyed') { cross.style.display = state === 'error' ? '' : 'none'; if (state === 'annoyed') { mouth.setAttribute('d', 'M60 85 Q66 79 72 85'); } else { mouth.setAttribute('d', 'M62 84 Q66 81 70 84'); } }
    mascotLabel.textContent = state === 'annoyed' ? 'hey!' : state;
  }

  jingle.addEventListener('click', function () {
    var now = Date.now();
    if (now - lastPoke < 1600) pokes++; else pokes = 1;
    lastPoke = now;
    override = pokes >= 3 ? 'error' : 'annoyed';
    overrideUntil = now + (pokes >= 3 ? 2000 : 1200);
    if (lastState) applyMascot(lastState); else applyMascot('idle');
  });

  function renderAlerts(state) {
    window.JingleNotchSurface.reconcile(alertList, state, function (action) {
      var path = action.kind === 'approval' ? '/jingle/api/approvals/' + encodeURIComponent(action.id)
        : '/jingle/api/questions/' + encodeURIComponent(action.sessionId) + '/' + encodeURIComponent(action.callId);
      return fetch(path, { method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify(action.kind === 'approval' ? {decision:action.decision} : {answers:action.answers})
      }).then(function (r) { return r.json(); });
    });
  }

  function renderPills(state) {
    var sessions = state.sessions || [];
    if (sessions.length === 0) {
      pillsEl.innerHTML = '<div class="quiet" style="grid-column:1/-1">No live sessions — say something to the agent and Jingle wakes up.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var now = state.now || Date.now();
      var ticks = (s.ticker || []).slice(-4).reverse();
      var tickHtml = '';
      for (var t = 0; t < ticks.length; t++) {
        tickHtml += '<div class="tick ' + esc(ticks[t].kind) + '"><span class="k">' + fmtTime(ticks[t].t) + '</span><span class="txt">' + esc(ticks[t].text) + '</span></div>';
      }
      html += '<div class="pill">'
        + '<div class="row"><span class="name">' + esc(s.label) + '</span><span class="state st-' + esc(s.state) + '">' + esc(s.state) + '</span></div>'
        + (s.cwd ? '<div class="cwd">' + esc(s.cwd) + '</div>' : '')
        + (s.currentTool ? '<div class="tool-now">▸ ' + esc(s.currentTool) + '</div>' : '')
        + '<div class="meta"><span>' + fmtDur(now - s.startedAt) + '</span><span>' + s.stats.turns + ' turns</span><span>' + s.stats.toolCalls + ' tools</span>'
        + (s.stats.filesChanged ? '<span>' + s.stats.filesChanged + ' files</span><span>+' + s.stats.linesAdded + ' −' + s.stats.linesRemoved + '</span>' : '')
        + (s.stats.approvals ? '<span>' + s.stats.approvals + ' approvals</span>' : '')
        + (s.stats.questions ? '<span>' + s.stats.questions + ' questions</span>' : '') + '</div>'
        + '<div class="ticker">' + (tickHtml || '<div class="tick"><span class="k">—</span><span class="txt">quiet</span></div>') + '</div>'
        + '</div>';
    }
    pillsEl.innerHTML = html;
    sessions.forEach(function (s,i) { window.JingleNotchSurface.changes(pillsEl.children[i],s.changes); });
  }

  var recapFingerprint;
  function renderStats(state) {
    var history=state.recap&&state.recap.weeks||[], fingerprint=JSON.stringify(history);
    var recap=document.getElementById('weekly-recap');
    if(!recap){recap=document.createElement('div');recap.id='weekly-recap';statsEl.parentNode.insertBefore(recap,statsEl.nextSibling);}
    if(recapFingerprint!==fingerprint){
      recap.replaceChildren();recapFingerprint=fingerprint;
      if(history.length){var detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Weekly activity · '+history.length+' weeks';detail.appendChild(summary);
      history.slice().reverse().forEach(function(w){var p=document.createElement('p');p.textContent=w.week+' · '+w.turns+' turns · '+w.toolCalls+' tools · '+w.approvals+' approvals · '+Math.round(w.activeMs/60000)+' active session minutes';detail.appendChild(p);});recap.appendChild(detail);}
    }
    var totals = state.totals || {};
    statsEl.innerHTML = '<span><b>' + (totals.sessionsToday || 0) + '</b> sessions today</span>'
      + '<span><b>' + (totals.turns || 0) + '</b> turns</span>'
      + '<span><b>' + (totals.toolCalls || 0) + '</b> tool calls</span>'
      + '<span><b>' + (totals.approvalsAsked || 0) + '</b> approvals asked</span>'
      + (totals.approvalsAutoAllowed ? '<span><b>' + totals.approvalsAutoAllowed + '</b> auto-allowed</span>' : '');
  }

  var lastState = null;
  function tick() {
    fetch('/jingle/api/state', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (state) {
        var loudestState = 'idle';
        var sessions = state.sessions || [];
        for (var i = 0; i < sessions.length; i++) {
          if (loudest(sessions[i].state) > loudest(loudestState)) loudestState = sessions[i].state;
        }
        lastState = loudestState;
        applyMascot(loudestState);
        renderAlerts(state);
        renderPills(state);
        renderStats(state);
        if (state.startedAt) uptimeEl.textContent = 'up ' + fmtDur(state.now - state.startedAt);
      })
      .catch(function () {
        mascotLabel.textContent = 'disconnected';
      });
  }
  tick();
  setInterval(tick, 1500);

  document.getElementById('overlayBtn').addEventListener('click', function () {
    fetch('/jingle/api/overlay', { method: 'POST', headers:{'content-type':'application/json'}, body:'{}' })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        mascotLabel.textContent = result.ok ? 'overlay!' : 'no overlay';
        if (!result.ok) window.alert(result.message ?? 'overlay failed');
      })
      .catch(function () { mascotLabel.textContent = 'disconnected'; });
  });
})();
</script>
</body>
</html>
`

export function dashboardPage(): string {
  return PAGE
}
