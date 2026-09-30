'use strict';
const { text, date, fail, get, version, blueprint, snapshot, clone } = require('./model');
module.exports = function places(ctx) {
  const { state, key, data: p, action, at, id, sources } = ctx;
  if (action === 'place.create') {
    const row = { id, owner:key, revision:1, status:'draft', title:text(p.title,120,true),
      area:text(p.area,100,true), description:text(p.description,1200), createdAt:at, updatedAt:at };
    state.places[id] = row; return row;
  }
  if (action.startsWith('place.')) {
    const row = get(state,'places',p.id); version(row,p.revision);
    if (action === 'place.update') Object.assign(row,{ title:text(p.title,120,true),
      area:text(p.area,100,true), description:text(p.description,1200) });
    if (action === 'place.publish') row.status = 'published';
    if (action === 'place.withdraw') { row.status = 'withdrawn'; row.reason = text(p.reason,500,true); }
    return row;
  }
  if (action === 'blueprint.create' || action === 'blueprint.fork') {
    const original = action.endsWith('fork') ? get(state,'blueprints',p.id) : null;
    if (original) version(original,p.revision);
    const place = get(state,'places',original ? original.placeId : p.placeId);
    if (place.status !== 'published') fail('De plek moet eerst gedeeld zijn.',409);
    const value = original ? clone(snapshot(original)) : blueprint(p);
    delete value.version; delete value.at; delete value.author;
    if (original) {
      value.title = text(p.title,120,true);
      // Een variant krijgt geen aanspraak op de media van de oorspronkelijke maker.
      value.mediaRef = '';
    }
    checkMedia(value);
    const row = { id, owner:key, organizer:key, placeId:place.id, revision:1, version:1,
      status:'draft', createdAt:at, updatedAt:at,
      derivedFrom:original ? { id:original.id,version:original.version } : null,
      versions:[{...value,version:1,at,author:key}] };
    state.blueprints[id] = row; return row;
  }
  const row = get(state,'blueprints',p.id); version(row,p.revision);
  const place = get(state,'places',row.placeId);
  if (action !== 'blueprint.withdraw' && place.status !== 'published') fail('Deze plek is ingetrokken.',409,'SOURCE_WITHDRAWN');
  if (action === 'blueprint.update') {
    const value = blueprint(p); checkMedia(value);
    row.version++; row.versions.push({...value,version:row.version,at,author:key});
  }
  if (action === 'blueprint.publish') { checkMedia(snapshot(row)); row.status = 'published'; }
  if (action === 'blueprint.withdraw') { row.status = 'withdrawn'; row.reason = text(p.reason,500,true); }
  return row;
  function checkMedia(value) {
    if (!value.mediaRef) return;
    const m = sources.media(key,value.mediaRef);
    if (!m || !m.mine || !m.shareable) fail('Koppel alleen uw eigen toegankelijke, deelbare media.',403,'MEDIA_NOT_ALLOWED');
    value.mediaVersion = m.version;
  }
};
