/* Presentation only. The caller lends its actual controls, with listeners and
   input state intact. It remains responsible for permissions and execution. */
(function (w, d) {
  'use strict';
  var active = null;
  function start(rt) {
    var slot = d.createElement('div'), mouth = rt.bar.querySelector('[data-rtg-adaptive-action="ai"]').cloneNode(true);
    slot.className = 'rtg-adaptive-surface'; slot.hidden = true;
    mouth.removeAttribute('data-rtg-adaptive-slot'); mouth.setAttribute('aria-label', 'Bediening openen');
    mouth.onclick = function () { w.RTGAdaptiveEdge.setState('expanded'); };
    slot.appendChild(mouth); rt.host.appendChild(slot);
    var borrowed = null, frame = 0;
    function measure() {
      frame = 0;
      var v = w.visualViewport;
      // A zoomed viewport is not a keyboard. Do not drag controls off-screen
      // while a person magnifies the page.
      var lift = v && v.scale === 1 ? Math.max(0, w.innerHeight - v.height - v.offsetTop) : 0;
      d.body.style.setProperty('--rtg-edge-keyboard', lift + 'px');
      if (borrowed) d.body.style.setProperty('--rtg-adaptive-height', Math.max(58, Math.ceil(slot.getBoundingClientRect().height)) + 'px');
      else d.body.style.removeProperty('--rtg-adaptive-height');
    }
    function schedule() { if (!frame) frame = w.requestAnimationFrame(measure); }
    var size = w.ResizeObserver ? new w.ResizeObserver(schedule) : null;
    if (size) size.observe(slot);
    if (w.visualViewport) { w.visualViewport.addEventListener('resize', schedule); w.visualViewport.addEventListener('scroll', schedule); }
    w.addEventListener('resize', schedule);
    function move(node, parent, before) {
      var focus = node.contains(d.activeElement) ? d.activeElement : null;
      if (parent.moveBefore && node.isConnected && parent.isConnected) parent.moveBefore(node, before);
      else parent.insertBefore(node, before);
      if (focus && d.activeElement !== focus) focus.focus({ preventScroll:true });
    }
    function release() {
      if (!borrowed) return;
      var b = borrowed; borrowed = null;
      move(b.node, b.parent, b.next && b.next.parentNode === b.parent ? b.next : null);
      slot.hidden = true; delete rt.host.dataset.rtgSurface; delete d.body.dataset.rtgEdgeSurface;
      schedule();
    }
    function mount(node, options) {
      if (!node || node.ownerDocument !== d || !node.parentNode || rt.host.contains(node)) return null;
      release();
      borrowed = { node:node, parent:node.parentNode, next:node.nextSibling };
      move(node, slot, null); slot.hidden = false;
      rt.host.dataset.rtgSurface = String(options && options.kind || 'controls');
      d.body.dataset.rtgEdgeSurface = rt.host.dataset.rtgSurface;
      w.RTGAdaptiveEdge.setState('dock'); schedule();
      var owned = borrowed;
      return function () { if (borrowed === owned) release(); };
    }
    active = { mount:mount };
    schedule();
    return function () {
      release(); active = null; if (size) size.disconnect(); if (frame) w.cancelAnimationFrame(frame);
      w.removeEventListener('resize', schedule);
      if (w.visualViewport) { w.visualViewport.removeEventListener('resize', schedule); w.visualViewport.removeEventListener('scroll', schedule); }
      d.body.style.removeProperty('--rtg-edge-keyboard'); d.body.style.removeProperty('--rtg-adaptive-height');
    };
  }
  w.RTGAdaptiveEdgeSurface = Object.freeze({ start:start, mount:function (node, options) { return active && active.mount(node, options); } });
}(window, document));
