/* Runs in the page. A correctly sized outer frame can still contain a
   collapsed, clipped app. Include legacy scroll roots as well as main. */
'use strict';
module.exports = function contentGeometry() {
  const home = document.querySelector('.wd-home');
  if (!home || home.hidden) return [];
  return Array.from(home.querySelectorAll('main,[data-rtg-screen-root],[data-rtg-scroll],.cmd-panes,#content'))
    .filter(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 180 && r.height < 120 && el.scrollHeight > Math.max(160,r.height + 80) &&
        s.visibility !== 'hidden' && s.display !== 'none' && /auto|scroll|hidden|clip/.test(s.overflowY);
    }).map(el => ({selector:el.tagName.toLowerCase()+(el.id ? '#'+el.id : '.'+String(el.className).trim().replace(/\s+/g,'.')),
      height:el.clientHeight, contentHeight:el.scrollHeight}));
};
