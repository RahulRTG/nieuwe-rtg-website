/* Public painted doorway. Native Edge remains the only state/gesture owner. */
(function (w, d) {
  'use strict';
  var lipsUrl = new URL('../images/brand/rtg-edge-lips.webp', d.currentScript.src).href;
  function mount(runtime, root) {
    var edge = w.RTGAdaptiveEdge, door = d.createElement('button');
    var mark = d.createElement('img'), close = d.createElement('span');
    door.type = 'button'; door.className = 'ds-public-edge-toggle';
    mark.src = lipsUrl; mark.alt = ''; mark.width = 56; mark.height = 38;
    close.textContent = '×'; close.setAttribute('aria-hidden', 'true'); door.append(mark, close);
    runtime.bar.id = 'publicEdgeBar'; door.setAttribute('aria-controls', runtime.bar.id); runtime.host.append(door);
    function sync() {
      var open = ['deck', 'expanded'].includes(runtime.host.dataset.rtgAdaptiveState);
      door.setAttribute('aria-expanded', String(open)); door.setAttribute('aria-label', open ? 'Edge sluiten' : 'Edge openen');
      if (!open && d.activeElement !== door && runtime.host.contains(d.activeElement)) door.focus({ preventScroll: true });
    }
    door.addEventListener('click', function (event) {
      event.stopPropagation(); edge.setState(door.getAttribute('aria-expanded') === 'true' ? 'dock' : 'deck'); sync();
    });
    d.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || d.querySelector('dialog[open]')) return;
      var state = runtime.host.dataset.rtgAdaptiveState;
      if (state === 'deck') edge.setState('dock');
      if (state === 'deck' || state === 'expanded') w.requestAnimationFrame(function () {
        if (runtime.host.dataset.rtgAdaptiveState === 'dock' && !d.querySelector('dialog[open]')) door.focus({ preventScroll: true });
      });
    }, true);
    d.addEventListener('pointerdown', function (event) {
      if (runtime.host.dataset.rtgAdaptiveState === 'deck' && !root.contains(event.target)) edge.setState('dock');
    }, { passive: true });
    new MutationObserver(sync).observe(runtime.host, { attributes: true, attributeFilter: ['data-rtg-adaptive-state'] }); sync();
    return door;
  }
  function dress(root) {
    var bar = root.querySelector('.rtg-adaptive-bar'); if (!bar) return;
    bar.classList.add('ds-edge__balk');
    bar.querySelectorAll('.rtg-adaptive-item').forEach(function (button) {
      button.classList.add('ds-edge__knop');
      var rahul = button.dataset.rtgAdaptiveSlot === '2' && button.dataset.rtgAdaptiveAction === 'ai';
      button.classList.toggle('ds-edge__knop--rahul', rahul);
      // Keep the original button, native handlers and accessible name.
      if (rahul && !button.querySelector('.ds-edge-painted-lips')) {
        var lips = d.createElement('img'), icon = button.querySelector('svg');
        lips.className = 'rtg-adaptive-lips ds-edge-painted-lips'; lips.src = lipsUrl;
        lips.alt = ''; lips.width = 56; lips.height = 38;
        if (icon) icon.replaceWith(lips); else button.prepend(lips);
      }
    });
  }
  w.RTGPublicEdgeDoor = Object.freeze({ mount: mount, dress: dress });
})(window, document);
