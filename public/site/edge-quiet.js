/* Public reading policy only. The native Edge remains the state/action owner;
   app pages do not load this file. No cloned controls or visual state machine. */
(function (w, d) {
  'use strict';
  var root = d.querySelector('.ds-public-edge'), edge = w.RTGAdaptiveEdge;
  var host = root && root.querySelector('.rtg-adaptive-edge');
  if (!host || !edge || root.dataset.publicQuietBound) return;
  root.dataset.publicQuietBound = 'true';
  var idle = null, keyboard = false, pressed = false, pointer = null, positions = new WeakMap();
  var state = host.dataset.rtgAdaptiveState;
  function clear() { w.clearTimeout(idle); idle = null; }
  function protectedInteraction() {
    var active = d.activeElement;
    // Native dialogs remain in the DOM after closing. aria-modal describes
    // their semantics, not their open state; only a visible modal protects UI.
    var modal = d.querySelector('dialog[open]') || Array.from(d.querySelectorAll('[aria-modal="true"]:not(dialog):not([hidden])')).some(function(node){return node.getClientRects().length>0;});
    return pressed || host.dataset.rtgSurface || modal ||
      active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || keyboard && root.contains(active));
  }
  function close() {
    clear();
    if (host.dataset.rtgAdaptiveState === 'deck' && !protectedInteraction()) edge.setState('dock');
  }
  function schedule() {
    clear();
    if (!d.hidden && host.dataset.rtgAdaptiveState === 'deck' && !protectedInteraction()) idle = w.setTimeout(close, 4000);
  }
  // A pointer click may leave focus on a button. Only deliberate keyboard
  // navigation pins it open; a mouse/touch focus must not defeat idle reading.
  d.addEventListener('keydown', function () { keyboard = true; schedule(); }, true);
  d.addEventListener('pointerdown', function (event) { keyboard = false; pressed = root.contains(event.target); schedule(); }, { capture: true, passive: true });
  d.addEventListener('pointerup', function () { pressed = false; schedule(); }, { passive: true });
  d.addEventListener('pointercancel', function () { pressed = false; schedule(); }, { passive: true });
  root.addEventListener('pointermove', function (event) {
    // Safari reports zero movementX/Y for pointer events; use viewport points.
    if (!pointer || pointer[0] !== event.clientX || pointer[1] !== event.clientY) schedule();
    pointer = [event.clientX, event.clientY];
  }, { passive: true });
  root.addEventListener('pointerleave', function () { pointer = null; }, { passive: true });
  root.addEventListener('click', schedule);
  d.addEventListener('focusin', schedule);
  d.addEventListener('focusout', function () { w.queueMicrotask(schedule); });
  d.addEventListener('visibilitychange', schedule);
  w.addEventListener('pagehide', clear);
  w.addEventListener('pageshow', schedule);
  positions.set(d, [w.scrollX || 0, w.scrollY || 0]);
  d.addEventListener('scroll', function (event) {
    var target = event.target;
    if (target !== d && (!(target instanceof w.Element) || root.contains(target))) return;
    var point = target === d ? [w.scrollX || 0, w.scrollY || 0] : [target.scrollLeft, target.scrollTop];
    var previous = positions.get(target) || [0, 0]; positions.set(target, point);
    if (point[0] !== previous[0] || point[1] !== previous[1]) close();
  }, { passive: true, capture: true });
  new MutationObserver(function () {
    var next = host.dataset.rtgAdaptiveState;
    if (next !== state) { state = next; schedule(); }
  }).observe(host, { attributes: true, attributeFilter: ['data-rtg-adaptive-state'] });
  schedule();
})(window, document);
