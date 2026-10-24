/* Eerste begrensde Lifestyle-familie: uitsluitend bestaande leesingangen die
   geen object-id vragen. Het RTG-lid blijft een afzonderlijke pas-tegenproef. */
'use strict';
const ROUTES = Object.freeze([
  ...['overzicht', 'nu', 'tower', 'termijnen', 'graaf', 'kamers', 'delegatie',
    'beveiliging', 'reputatie', 'dieren', 'zaken'].map(p => '/api/member/bureau/' + p),
  ...['reisboek', 'cellier', 'table', 'maison', 'garderobe', 'mecenaat',
    'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties'].map(p => '/api/member/rechterhand/' + p)
]);
const past = (methode, pad) => methode === 'POST' && ROUTES.includes(pad);
const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
function oordeel(p) {
  const open = reden => ({ stand: 'open', reden });
  if (!p || !past(p.methode, p.pad)) return open('geen exacte Lifestyle-fixture');
  for (const [naam, tier] of [['premium', 'lifestyle'], ['rtg', 'rtg']]) {
    const q = p[naam];
    if (!q || !ok(q.voor?.status) || !ok(q.na?.status) || q.voor.tier !== tier || q.na.tier !== tier ||
        !Number.isInteger(q.voor.id) || q.voor.id !== q.na.id)
      return open(naam + ': eigen account, tier en sessie vóór/na niet bewezen');
  }
  if (p.premium.voor.id === p.rtg.voor.id) return open('geen afzonderlijke pasactoren');
  if (ok(p.rtg.status)) return { stand: 'gat', reden: 'RTG-pas kwam door de Lifestyle-poort' };
  if (![401,403].includes(p.rtg.status) || !ok(p.premium.status)) return open('geen positieve Lifestyle-uitvoering of strikte RTG-weigering');
  return { stand: 'bewezen', reden: 'eigen Lifestyle-account binnen, afzonderlijk geldig RTG-account geweigerd' };
}
function maakFixtures({ vraag, bouw, login } = {}) {
  const wereld = require('./voltooiwereld');
  const post = (pad, lijf, token) => vraag('POST', pad, token, lijf);
  let premium, opbouw;
  const maak = bouw || (() => wereld.lifestyleLid({post}, 'rol-lifestyle'));
  const herstel = login || (lid => wereld.inloggen({post}, lid));
  const sessie = async token => {
    const r = await vraag('POST','/api/auth/me',token,{});
    return {status:r.status,id:r.data?.user?.id,tier:r.data?.user?.tier};
  };
  return { past, async meet(methode, pad, rtgToken, lijf = {}) {
    const proef = { methode, pad };
    if (!past(methode,pad)) return {proef, oordeel:oordeel(proef)};
    try {
      if (!premium) premium = await (opbouw ||= Promise.resolve().then(maak));
      let voor = await sessie(premium.token);
      if (!ok(voor.status)) { premium.token = await herstel(premium); voor = await sessie(premium.token); }
      const rtgVoor = await sessie(rtgToken);
      const eigen = await vraag(methode,pad,premium.token,lijf);
      const tegen = await vraag(methode,pad,rtgToken,lijf);
      proef.premium = {voor,status:eigen.status,na:await sessie(premium.token)};
      proef.rtg = {voor:rtgVoor,status:tegen.status,na:await sessie(rtgToken)};
      return {proef,eigen,oordeel:oordeel(proef)};
    } catch(e) { return {proef,oordeel:{stand:'open',reden:'Lifestyle-opbouw niet bewezen: '+e.message}}; }
  } };
}
module.exports = { ROUTES, past, oordeel, maakFixtures };
