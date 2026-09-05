/* Alleen een kaal intern pathname mag door een Samen-kamer reizen. */
'use strict';

function veiligSamenPad(waarde) {
  const p = String(waarde || '');
  if (!p || p.length > 200 || p !== p.trim() || /[?#\\\u0000-\u001f]/.test(p)) return null;
  if (!(p.startsWith('/apps/') || p.startsWith('/site/'))) return null;
  try {
    const url = new URL(p, 'https://samen.invalid');
    if (url.origin !== 'https://samen.invalid' || url.pathname !== p || url.search || url.hash)
      return null;
    return url.pathname;
  } catch (e) { return null; }
}

module.exports = { veiligSamenPad };
