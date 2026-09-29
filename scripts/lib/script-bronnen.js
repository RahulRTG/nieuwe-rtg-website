/* Source-preserving build transform for owned HTML, not an HTML sanitizer. */
'use strict';
const { loop } = require('./ontleed');
module.exports = function zonderScripts(html, select) {
  const ranges = []; let opening = null, skip = null;
  loop(html, () => {}, (name, closing, raw, end) => {
    if (opening) {
      if (name === 'script' && closing) { if (opening.remove) { while (end < html.length && /\s/.test(html[end])) end++; ranges.push([opening.start, end]); } opening = null; }
      return;
    }
    if (skip) { if (closing && name === skip) skip = null; return; }
    if (!closing && ['style', 'textarea', 'title'].includes(name)) { skip = name; return; }
    if (name !== 'script' || closing) return;
    const src = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(raw.replace('<script/', '<script '));
    opening = { start: end - raw.length, remove: !!src && select(src[1] || src[2] || src[3] || '') };
  });
  if (opening && opening.remove) throw new Error('Unclosed selected script in source HTML');
  let result = '', from = 0;
  for (const [start, end] of ranges) { result += html.slice(from, start); from = end; }
  return result + html.slice(from);
};
