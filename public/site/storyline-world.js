/* A world story uses the same local scenarios as the app landing. */
(function (w, d) {
  'use strict';
  var host = d.querySelector('[data-story-demo]'), C = w.RTGExperienceCore, stage = w.RTGStorylineStage;
  if (!host || !C || !stage) return;
  var state = C.state(), initial = host.dataset.storyDemo;
  C.choose(state, initial);
  var root = stage.create(host);
  host.querySelector('[data-story-fallback]').hidden = true;
  stage.paint(root, state);
  var label = d.createElement('label'); label.className = 'story-permission';
  var check = d.createElement('input'); check.type = 'checkbox'; check.checked = true;
  var copy = d.createElement('span'); copy.textContent = 'Neem de voorbeeldagenda mee.';
  label.append(check, copy); root.querySelector('.story-controls').appendChild(label);
  function render() { stage.paint(root, state); }
  root.querySelector('select').addEventListener('change', function () { C.option(state, this.value); render(); });
  check.addEventListener('change', function () { C.permission(state, 'calendar', this.checked); render(); });
  w.RTGWorldStory = Object.freeze({
    reset: function () { state = C.state(); C.choose(state, initial); check.checked = true; render(); },
    proposal: function () { host.scrollIntoView({ behavior: w.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); root.querySelector('select').focus({ preventScroll: true }); }
  });
}(window, document));
