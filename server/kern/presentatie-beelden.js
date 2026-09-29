/* Personal presentation preferences. Bytes remain owned by Bestanden. */
'use strict';
const SLOT = /^(living|work|travel|foundation|company)\/(sfeer|hoofd|beeld-[a-f0-9]{8})$/;
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
function crop(value) {
  if (!value || !['x', 'y', 'zoom'].every(k => Number.isFinite(value[k]))) return null;
  if (value.x < 0 || value.x > 100 || value.y < 0 || value.y > 100 || value.zoom < 1 || value.zoom > 3) return null;
  return { x: value.x, y: value.y, zoom: value.zoom };
}
function lees(md) { return md.presentationImages || {}; }
function zet(md, input, files) {
  if (!input || !SLOT.test(input.slot)) return { status: 400, error: 'Kies een geldige beeldplek.' };
  const previous = lees(md), next = { ...previous };
  if (input.image === null) delete next[input.slot];
  else {
    const image = input.image, desktop = crop(image && image.desktop), mobile = crop(image && image.mobile);
    if (!image || typeof image.file !== 'string' || !desktop || !mobile) return { status: 400, error: 'Kies een foto en geldige uitsneden.' };
    if (!files.some(f => f.id === image.file && f.vanMij && !f.weg && MIME.has(f.mime))) return { status: 404, error: 'Deze foto staat niet in uw eigen bestanden.' };
    if (!previous[input.slot] && Object.keys(previous).length >= 1000) return { status: 409, error: 'Herstel eerst een eerder aangepast beeld.' };
    next[input.slot] = { file: image.file, desktop, mobile };
  }
  md.presentationImages = next;
  return { ok: true, images: next };
}
module.exports = { lees, zet };
