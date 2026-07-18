/* RTFoundation-zorg: veilig thuis (status en versleutelde locatie delen met het
   gezin), de belangrijke gezinsinfo voor de oppas (noodnummers, allergieen,
   huisregels - versleuteld op schijf) en het AVG-recht om vergeten te worden
   (met vier-ogen-regel bij twee volwassenen). locatiePubliek/oppasinfoPubliek
   gaan op de context voor het gastoverzicht (foundation/gasten.js).
   Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, G, save, nu, schoon, encS, decS, sessieVan, gezinVan, profielVan, checkPin } = ctx;

/* veilig thuis: een kind (of ieder gezinslid) deelt zijn status en, als het wil,
   zijn locatie met het gezin. Alleen de laatste plek wordt bewaard, en delen
   kan altijd worden gestopt. */
const STATUSSEN = ['veilig thuis', 'onderweg', 'op school', 'bij een vriend', 'naar huis'];
router.post('/gezin/locatie', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  const status = STATUSSEN.includes(req.body.status) ? req.body.status : schoon(req.body.status, 40) || 'onderweg';
  const rec = { pid: s.p.id, naam: s.p.naam, avatar: s.p.avatar, kleur: s.p.kleur, status, at: nu() };
  if (req.body.lat != null && req.body.lon != null) {
    const lat = Number(req.body.lat), lon = Number(req.body.lon);
    if (isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      // de precieze GPS-plek ligt versleuteld op schijf
      rec.plek = encS((Math.round(lat * 1e5) / 1e5) + ',' + (Math.round(lon * 1e5) / 1e5));
    }
  }
  if (!s.g.locaties) s.g.locaties = {};
  s.g.locaties[s.p.id] = rec; save();
  res.json({ ok: true });
});
function locatiePubliek(l, mij) {
  const out = { pid: l.pid, naam: l.naam, avatar: l.avatar, kleur: l.kleur, status: l.status, at: l.at, vanMij: l.pid === mij };
  if (l.plek) { const d = decS(l.plek); const komma = d.indexOf(','); if (komma > 0) { out.lat = Number(d.slice(0, komma)); out.lon = Number(d.slice(komma + 1)); } }
  else if (l.lat != null) { out.lat = l.lat; out.lon = l.lon; } // oude, onversleutelde data
  return out;
}
router.post('/gezin/locatie/stop', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  if (s.g.locaties) delete s.g.locaties[s.p.id]; save();
  res.json({ ok: true });
});
router.get('/gezin/:code/locaties', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  const alle = Object.values(s.g.locaties || {})
    .filter(l => s.g.profielen[l.pid]) // alleen bestaande profielen
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .map(l => locatiePubliek(l, s.p.id));
  res.json({ locaties: alle, ikDeel: !!(s.g.locaties && s.g.locaties[s.p.id]) });
});

/* belangrijke gezinsinfo voor de oppas: noodnummers, allergieen, bedtijden en
   huisregels. Iedereen in het gezin (ook een gast) mag dit lezen; alleen een
   ouder of de beheerder mag het aanpassen. */
function oppasinfoPubliek(g) {
  const o = g.oppasinfo || {};
  // noodcontacten en gezondheidsinfo liggen versleuteld; hier weer leesbaar maken
  let contacten = [];
  if (Array.isArray(o.noodcontacten)) contacten = o.noodcontacten; // oude, onversleutelde data
  else if (o.noodcontacten) { try { contacten = JSON.parse(decS(o.noodcontacten)) || []; } catch (e) { contacten = []; } }
  return { noodcontacten: contacten, allergie: decS(o.allergie) || '', eten: decS(o.eten) || '', huisregels: decS(o.huisregels) || '', updatedAt: o.updatedAt || null, updatedBy: o.updatedBy || '' };
}
router.get('/gezin/:code/oppasinfo', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  res.json({ oppasinfo: oppasinfoPubliek(s.g), magBewerken: ['beheerder', 'ouder'].includes(s.p.rol) });
});
router.post('/gezin/oppasinfo', (req, res) => {
  const s = sessieVan(req, res); if (!s) return;
  if (!['beheerder', 'ouder'].includes(s.p.rol)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan de gezinsinfo aanpassen.' });
  const noodcontacten = (Array.isArray(req.body.noodcontacten) ? req.body.noodcontacten : []).slice(0, 12)
    .map(c => ({ naam: schoon(c && c.naam, 40), telefoon: schoon(c && c.telefoon, 30), wie: schoon(c && c.wie, 40) }))
    .filter(c => c.naam || c.telefoon);
  s.g.oppasinfo = {
    noodcontacten: encS(JSON.stringify(noodcontacten)),
    allergie: encS(schoon(req.body.allergie, 1500)),
    eten: encS(schoon(req.body.eten, 1500)),
    huisregels: encS(schoon(req.body.huisregels, 1500)),
    updatedAt: nu(), updatedBy: s.p.naam
  };
  save();
  res.json({ ok: true, oppasinfo: oppasinfoPubliek(s.g) });
});

/* AVG: het recht om vergeten te worden. Zijn er twee volwassenen (ouder of
   beheerder), dan is verwijderen een verzoek dat de tweede volwassene moet
   goedkeuren. Is er maar een volwassene, dan wist die het meteen. */
function volwassenen(g) { return Object.values(g.profielen || {}).filter(p => ['beheerder', 'ouder'].includes(p.rol)); }
async function adultCheck(g, req, res) {
  const p = profielVan(g, req.body && req.body.token);
  if (!p || !['beheerder', 'ouder'].includes(p.rol)) { res.status(403).json({ error: 'Alleen een ouder of de beheerder kan dit doen.' }); return null; }
  if (p.pin && p.pin.hash && !await checkPin(p.pin, req.body.pin)) { res.status(403).json({ error: 'De pincode klopt niet.' }); return null; }
  return p;
}
router.post('/gezin/wissen', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = await adultCheck(g, req, res); if (!p) return;
  if (volwassenen(g).length <= 1) { delete G()[g.code]; save(); return res.json({ ok: true, verwijderd: true }); }
  g.wisVerzoek = { door: p.id, doorNaam: p.naam, at: nu() }; save();
  res.json({ ok: true, wachtOpToestemming: true });
});
router.post('/gezin/wissen/bevestig', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!g.wisVerzoek) return res.status(400).json({ error: 'Er is geen verzoek om te verwijderen.' });
  const p = await adultCheck(g, req, res); if (!p) return;
  if (g.wisVerzoek.door === p.id) return res.status(403).json({ error: 'De tweede volwassene moet toestemming geven, niet degene die het verzoek deed.' });
  delete G()[g.code]; save();
  res.json({ ok: true, verwijderd: true });
});
router.post('/gezin/wissen/intrekken', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = await adultCheck(g, req, res); if (!p) return;
  delete g.wisVerzoek; save();
  res.json({ ok: true });
});

  // het gastoverzicht (gasten.js) leest locaties en oppasinfo via de context
  ctx.locatiePubliek = locatiePubliek;
  ctx.oppasinfoPubliek = oppasinfoPubliek;
};
