/** Shared DOM-only controls. Polling reuses keyed forms to preserve drafts and focus. */
export const surfaceCss = String.raw`
.cq-card { display:block; padding:16px; margin:8px 0; border:1px solid #424662; border-radius:14px; background:#191c29; color:#ebedf7; }
.cq-card h3 { margin:0 0 8px; font-size:14px; overflow-wrap:anywhere; }
.cq-card fieldset { border:0; padding:8px 0; margin:0; min-width:0; }
.cq-card legend { font-weight:600; white-space:pre-wrap; overflow-wrap:anywhere; }
.cq-card pre, .cq-diff pre { white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.6 ui-monospace,monospace; user-select:text; }
.cq-card label { display:block; padding:7px 0; cursor:pointer; }
.cq-card input { margin-right:8px; accent-color:#a5b4fc; }
.cq-card small { display:block; padding:4px 0 0 24px; color:#adb4ca; white-space:pre-wrap; }
.cq-card textarea { box-sizing:border-box; width:100%; min-height:64px; background:#10121b; color:inherit; border:1px solid #464b65; border-radius:8px; padding:8px; font:inherit; user-select:text; }
.cq-card button { margin:8px 6px 0 0; padding:7px 12px; border:0; border-radius:8px; background:#a5b4fc; color:#161629; cursor:pointer; font:inherit; }
.cq-card button:disabled { opacity:.45; cursor:wait; }
.cq-card .cq-error { color:#ffb1b1; white-space:pre-wrap; }
.cq-diff { margin:8px 0; overflow-wrap:anywhere; }
.cq-diff summary { cursor:pointer; color:#b9c4f5; padding:6px 0; }
.cq-diff .removed { color:#ffb1b1; } .cq-diff .added { color:#9ce5bd; }
`

export const surfaceScript = String.raw`
window.JingleNotchSurface = (function () {
  var serial = 0;
  function el(tag, text, cls) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  function reconcile(container, state, submit) {
    var entries = (state.approvals || []).map(function (item) { return { key:'a:' + item.id, item:item, approval:true }; })
      .concat((state.questions || []).map(function (item) { return { key:'q:' + JSON.stringify([item.sessionId,item.callId]), item:item }; }));
    var keep = new Set();
    entries.forEach(function (entry) {
      var schema = Object.assign({},entry.item); delete schema.replyQueued;
      var fingerprint = JSON.stringify(schema);
      var existing = Array.from(container.children).find(function (n) { return n.dataset.key === entry.key; });
      keep.add(entry.key);
      if (existing && existing.dataset.schema === fingerprint) { if(existing.setQueued)existing.setQueued(!!entry.item.replyQueued); return; }
      var card = entry.approval ? approval(entry.item, submit) : question(entry.item, submit);
      if(card.setQueued)card.setQueued(!!entry.item.replyQueued);
      card.dataset.key = entry.key; card.dataset.schema = fingerprint;
      if (existing) existing.replaceWith(card); else container.appendChild(card);
    });
    Array.from(container.children).forEach(function (n) { if (!keep.has(n.dataset.key)) n.remove(); });
  }
  function deliver(card, action, submit) {
    var buttons = card.querySelectorAll('button');
    buttons.forEach(function (b) { b.disabled = true; });
    var status = card.querySelector('.cq-error'); status.textContent = 'Sending…';
    return Promise.resolve().then(function () { return submit(action); }).then(function (result) {
      if (!result || !result.ok) throw new Error(result && (result.error || result.message) || 'Answer was not accepted. Refresh and retry.');
      status.textContent = 'Accepted';
    }).catch(function (error) {
      status.textContent = error.message || String(error);
      buttons.forEach(function (b) { b.disabled = false; });
    });
  }
  function approval(item, submit) {
    var card = el('section', undefined, 'cq-card');
    card.appendChild(el('h3', 'Approval · ' + item.toolName));
    if (item.reason) card.appendChild(el('pre', item.reason));
    if (!item.answerable) { card.appendChild(el('p','Reply in the dsh interface handling this request.')); return card; }
    [['Allow once','allowed-once'],['Deny','rejected'],['Always in this session','always']].forEach(function (pair) {
      var button = el('button', pair[0]); button.type = 'button';
      button.addEventListener('click', function () { deliver(card, { kind:'approval', id:item.id, decision:pair[1] }, submit); });
      card.appendChild(button);
    });
    card.appendChild(el('p', '', 'cq-error')); return card;
  }
  function question(item, submit) {
    var form = el('form', undefined, 'cq-card'); var fields = [];
    form.appendChild(el('h3', 'Agent question'));
    if (!item.questions || !item.questions.length) {
      form.appendChild(el('pre', item.preview)); form.appendChild(el('p','Open the dsh question panel to answer.')); return form;
    }
    item.questions.forEach(function (q) {
      var field = el('fieldset'); var group = 'cq-' + (++serial);
      field.appendChild(el('legend', (q.header ? q.header + ' · ' : '') + q.question));
      if (q.detail) field.appendChild(el('pre', q.detail));
      var controls = [];
      (q.options || []).forEach(function (option) {
        var label = el('label'); var input = el('input');
        input.type = q.multiSelect ? 'checkbox' : 'radio'; input.name = group; input.value = option.label;
        label.appendChild(input); label.appendChild(document.createTextNode(option.label));
        if (option.description) label.appendChild(el('small',option.description));
        field.appendChild(label); controls.push(input);
      });
      var custom = el('textarea'); custom.placeholder = 'Your answer or additional feedback'; custom.maxLength = 16384;
      custom.setAttribute('aria-label', q.question + ' · free text');
      custom.addEventListener('input',function () { if (!q.multiSelect && custom.value.trim()) controls.forEach(function (c) { c.checked=false; }); });
      controls.forEach(function (c) { c.addEventListener('change', function () { if (!q.multiSelect && c.checked) custom.value=''; }); });
      field.appendChild(custom);
      var skipLabel = el('label'); var skip = el('input'); skip.type='checkbox';
      skipLabel.appendChild(skip); skipLabel.appendChild(document.createTextNode('Skip this question'));
      skip.addEventListener('change',function () { custom.disabled=skip.checked; controls.forEach(function (c) { c.disabled=skip.checked; }); });
      field.appendChild(skipLabel); form.appendChild(field);
      fields.push({ q:q, controls:controls, custom:custom, skip:skip });
    });
    if (!item.answerable) { form.appendChild(el('p','Reply in the dsh interface handling this request.')); form.querySelectorAll('input,textarea').forEach(function(c){c.disabled=true;}); return form; }
    var send = el('button','Submit answers'); send.type='submit'; form.appendChild(send);
    var status = el('p','','cq-error'); status.setAttribute('role','status'); form.appendChild(status);
    form.setQueued = function(queued) {
      if(form.lastQueued === queued)return; form.lastQueued=queued;
      send.disabled=queued;
      fields.forEach(function(f){ f.skip.disabled=queued; f.custom.disabled=queued||f.skip.checked; f.controls.forEach(function(c){c.disabled=queued||f.skip.checked;}); });
      status.textContent=queued?'Reply queued; waiting for the agent to receive it.':'';
    };
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (fields.some(function (f) { return !f.skip.checked && !f.controls.some(function (c) { return c.checked; }) && !f.custom.value.trim(); })) {
        status.textContent='Answer each question or explicitly select Skip.'; return;
      }
      var answers = fields.map(function (f) {
        var a = { id:f.q.id, selected:f.skip.checked ? [] : f.controls.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }) };
        if (!f.skip.checked && f.custom.value.trim()) a.custom=f.custom.value;
        return a;
      });
      deliver(form,{ kind:'question', sessionId:item.sessionId, callId:item.callId, answers:answers },submit);
    });
    return form;
  }
  function changes(container, changes) {
    (changes || []).forEach(function (change) {
      var detail=el('details',undefined,'cq-diff');
      detail.appendChild(el('summary',change.path + '  +' + change.added + ' −' + change.removed + (change.approximate ? ' (estimated)' : '')));
      if (change.oldText !== undefined) detail.appendChild(el('pre', 'Before\n' + (change.oldText === null ? '(new file)' : change.oldText),'removed'));
      if (change.newText !== undefined) detail.appendChild(el('pre', 'After\n' + (change.newText === null ? '(deleted file)' : change.newText),'added'));
      if (change.truncated) detail.appendChild(el('p','Preview omitted: file exceeds the display limit.'));
      container.appendChild(detail);
    });
  }
  return { reconcile:reconcile, changes:changes, el:el };
})();
`
