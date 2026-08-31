/* Geisoleerde modulehost: de Runtime bezit chrome, foutgrens en lifecycle; de
   module ontvangt alleen haar eigen surface en een bevroren capabilitycontext. */
(function (w, d) {
  'use strict';
  function el(tag, cls, tekst) { var n = d.createElement(tag); if (cls) n.className = cls; if (tekst != null) n.textContent = tekst; return n; }
  function knop(tekst, actie, cls) { var b = el('button', cls || '', tekst); b.type = 'button'; b.dataset.ssAction = actie; b.setAttribute('aria-label', tekst); return b; }
  w.RTGWorkspaceModuleHost = function (opties) {
    var o = opties || {}, def = o.definition, m = def.manifest, suspended = false, active = false, userHidden = false;
    var root = el('section', 'rtg-ss-module rtg-module');
    root.dataset.ssModule = m.id; root.dataset.rtgModule = m.id; root.dataset.rtgSource = m.source; root.dataset.rtgMaturity = m.maturity;
    root.setAttribute('aria-labelledby', o.runtimeId + '-titel-' + m.id);
    var head = el('div', 'rtg-ss-module-head'), titel = el('h3', '', m.name); titel.id = o.runtimeId + '-titel-' + m.id; head.appendChild(titel);
    var tools = el('div', 'rtg-module-head-tools'), status = el('span', 'rtg-module-state', ''); tools.appendChild(status);
    var focus = knop(m.name + ' vergroten', 'focus-module', 'rtg-module-focus'); focus.dataset.ssModuleId = m.id; tools.appendChild(focus);
    var controls = el('div', 'rtg-ss-module-controls'); [['Omhoog', 'up'], ['Omlaag', 'down'], ['Verberg', 'hide']].forEach(function (x) {
      var b = knop(m.name + ' ' + x[0].toLowerCase(), x[1]); b.dataset.ssModuleId = m.id; controls.appendChild(b);
    });
    tools.appendChild(controls); head.appendChild(tools); root.appendChild(head);
    var body = el('div', 'rtg-module-surface'); body.dataset.rtgScope = m.id; root.appendChild(body);
    var ctx = o.context(status), instance;
    function error(waar, e) { if (typeof o.error === 'function') o.error(waar + ':' + m.id, e); }
    function hook(naam, arg) {
      [def.lifecycle && def.lifecycle[naam], instance && instance[naam]].forEach(function (fn) {
        if (typeof fn === 'function') try { fn(arg); } catch (e) { error(naam, e); }
      });
    }
    function fallback(tekst) { body.textContent = ''; body.appendChild(el('p', 'rtg-module-error', tekst)); }
    try { instance = def.create(ctx) || {}; } catch (e) { instance = {}; error('create', e); fallback('Module tijdelijk niet beschikbaar.'); }
    if (instance.actions) Object.keys(instance.actions).forEach(function (a) { o.registerAction(m.id, a, instance.actions[a]); });
    try { if (typeof instance.mount === 'function') instance.mount(body); } catch (e) { error('mount', e); fallback('Module tijdelijk niet beschikbaar.'); }
    hook('onMount', { surface: body });
    if (typeof instance.onEvent === 'function') m.events.subscribes.forEach(function (type) { o.subscribe(m.id, type, instance.onEvent); });
    function render(state, directive, isActive) {
      var mode = directive && directive.surface || 'inherit';
      var takeover = mode === 'focus' && directive && directive.reason === 'critical-safety-takeover';
      var hidden = !takeover && (userHidden || mode === 'hidden' || mode === 'suspended');
      root.hidden = hidden;
      if (mode === 'suspended' && !suspended) { suspended = true; hook('onSuspend', { reason: directive.reason }); }
      else if (mode !== 'suspended' && suspended) { suspended = false; hook('onResume', { reason: directive.reason }); }
      root.dataset.rtgModuleState = state; root.dataset.rtgActive = isActive ? 'true' : 'false';
      status.textContent = mode === 'suspended' ? 'onderbroken' : state;
      if (isActive && !active && !hidden) hook('onActivate', { state: state }); active = isActive && !hidden;
      if (hidden) return;
      try {
        var surface = def.surfaces && def.surfaces[state];
        if (typeof surface === 'function') surface(body, ctx);
        else if (typeof instance.render === 'function') instance.render(state, o.workspaceContext());
      } catch (e) { error('render', e); fallback('Surface tijdelijk niet beschikbaar.'); }
    }
    return { root: root, body: body, render: render,
      setHidden: function (hidden) { userHidden = hidden === true; },
      handle: function (target) { try { return !!(typeof instance.handle === 'function' && instance.handle(target)); } catch (e) { error('handle', e); return true; } },
      destroy: function () { hook('onUnmount', {}); try { if (typeof instance.destroy === 'function') instance.destroy(); } catch (e) {} instance = null; } };
  };
})(window, document);
