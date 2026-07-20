/* Foundation (deelmodule): de gezinsroutes: een gezin maken en inloggen
   op gezinscode, profielen kiezen, maken, wijzigen en verwijderen (met
   PIN), en de gezinsberichten. Krijgt de gedeelde context een keer bij
   het opstarten vanuit foundation.js. */
module.exports = (gctx) => {
  const { router, F, G, save, nu, rid, schoon, crypto, eigenVeld, encS, decS, teVaak, misluktePoging, goedePoging, ipVan,
    nieuweGezinscode, ROLLEN, GROEPEN, GROEP_INFO, schoonGroep, isBeschermd, isGast, KLEUREN,
    hashPin, checkPin, geldigePin, schoonAvatar, schoonKleur, nieuweCodenaam, ensureCodenaam, rtfHandle,
    socialProfielen, profielInfoVanHandle, pubProfiel, pubGezin, gezinVan, profielVan, beheerderVan, berichtVoorMij, tokenUit } = gctx;
  const bezorgAanGasten = (g, b) => gctx.bezorgAanGasten(g, b);
router.post('/gezin/maak', async (req, res) => {
  const bucket = 'maak:' + ipVan(req);
  if (teVaak(res, bucket)) return;
  misluktePoging(bucket, 8, 30); // hooguit 8 nieuwe gezinnen per adres per half uur
  const naam = schoon(req.body.gezinsnaam, 40);
  const beheerder = schoon(req.body.naam, 40);
  if (!naam) return res.status(400).json({ error: 'Geef je gezin een naam.' });
  if (!beheerder) return res.status(400).json({ error: 'Vul je eigen naam in.' });
  if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Kies een pincode van 4 tot 6 cijfers. Die beschermt de beheerder.' });
  const code = nieuweGezinscode();
  const pid = rid(4);
  const profiel = { id: pid, naam: beheerder, rol: 'beheerder', avatar: schoonAvatar(req.body.avatar) || '👑',
    kleur: schoonKleur(req.body.kleur), pin: await hashPin(req.body.pin), groep: schoonGroep(req.body.groep) || 'volw', token: rid(24), at: nu() };
  const g = { id: rid(4), code, naam, at: nu(), profielen: { [pid]: profiel }, berichten: [] };
  G()[code] = g; save();
  res.json({ code, token: profiel.token, profiel: pubProfiel(profiel), gezin: pubGezin(g) });
});

router.post('/gezin/inloggen', (req, res) => {
  const bucket = 'inlog:' + ipVan(req);
  if (teVaak(res, bucket)) return;
  const g = gezinVan(req, res); if (!g) { misluktePoging(bucket, 12, 5); return; } // raden van gezinscodes afremmen
  goedePoging(bucket);
  res.json({ gezin: pubGezin(g), profielen: Object.values(g.profielen).map(pubProfiel) });
});

router.post('/gezin/profiel/kies', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = eigenVeld(g.profielen, req.body.profielId);
  if (!p) return res.status(404).json({ error: 'Dit profiel bestaat niet meer.' });
  const bucket = 'pin:' + g.code + ':' + p.id;
  if (p.pin && p.pin.hash) {
    if (teVaak(res, bucket)) return;
    if (!await checkPin(p.pin, req.body.pin)) { misluktePoging(bucket, 6, 5); return res.status(403).json({ error: 'De pincode klopt niet.' }); }
    goedePoging(bucket);
  }
  res.json({ token: p.token, profiel: pubProfiel(p), gezin: pubGezin(g) });
});

router.get('/gezin/:code/mij', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, tokenUit(req));
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const ongelezen = (g.berichten || []).filter(b => berichtVoorMij(b, p.id) && b.van !== p.id && !(b.gelezenDoor || []).includes(p.id)).length;
  const adult = ['beheerder', 'ouder'].includes(p.rol);
  const wisVerzoek = (g.wisVerzoek && adult) ? { doorNaam: g.wisVerzoek.doorNaam, vanMij: g.wisVerzoek.door === p.id, at: g.wisVerzoek.at } : null;
  res.json({ gezin: pubGezin(g), profiel: pubProfiel(p), profielen: Object.values(g.profielen).map(pubProfiel), ongelezen, wisVerzoek });
});

router.post('/gezin/profiel/maak', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!beheerderVan(g, req, res)) return;
  const naam = schoon(req.body.naam, 40);
  if (!naam) return res.status(400).json({ error: 'Vul een naam in voor het nieuwe profiel.' });
  if (Object.keys(g.profielen).length >= 12) return res.status(400).json({ error: 'Een gezin kan tot 12 profielen hebben.' });
  const rol = ROLLEN.includes(req.body.rol) ? req.body.rol : 'kind';
  const p = { id: rid(4), naam, rol, avatar: schoonAvatar(req.body.avatar), kleur: schoonKleur(req.body.kleur), token: rid(24), at: nu() };
  const g0 = schoonGroep(req.body.groep); if (g0) p.groep = g0;
  if (req.body.pin) { if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Een pincode heeft 4 tot 6 cijfers, of laat hem leeg.' }); p.pin = await hashPin(req.body.pin); }
  g.profielen[p.id] = p; save();
  res.json({ profiel: pubProfiel(p) });
});

router.post('/gezin/profiel/wijzig', async (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  if (!beheerderVan(g, req, res)) return;
  const p = eigenVeld(g.profielen, req.body.profielId);
  if (!p) return res.status(404).json({ error: 'Profiel niet gevonden.' });
  if (typeof req.body.naam === 'string' && schoon(req.body.naam, 40)) p.naam = schoon(req.body.naam, 40);
  if (req.body.avatar != null) p.avatar = schoonAvatar(req.body.avatar);
  if (req.body.kleur != null) p.kleur = schoonKleur(req.body.kleur);
  if (req.body.groep != null) { const gg = schoonGroep(req.body.groep); if (gg) p.groep = gg; else delete p.groep; }
  if (ROLLEN.includes(req.body.rol)) {
    if (p.rol === 'beheerder' && req.body.rol !== 'beheerder' && Object.values(g.profielen).filter(x => x.rol === 'beheerder').length <= 1)
      return res.status(400).json({ error: 'Er moet altijd minstens een beheerder blijven.' });
    p.rol = req.body.rol;
  }
  if (req.body.pin === '') { delete p.pin; }
  else if (req.body.pin != null) { if (!geldigePin(req.body.pin)) return res.status(400).json({ error: 'Een pincode heeft 4 tot 6 cijfers.' }); p.pin = await hashPin(req.body.pin); }
  save();
  res.json({ profiel: pubProfiel(p) });
});

router.post('/gezin/profiel/verwijder', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const beheerder = beheerderVan(g, req, res); if (!beheerder) return;
  const id = String(req.body.profielId || '');
  const p = g.profielen[id];
  if (!p) return res.status(404).json({ error: 'Profiel niet gevonden.' });
  if (p.rol === 'beheerder' && Object.values(g.profielen).filter(x => x.rol === 'beheerder').length <= 1)
    return res.status(400).json({ error: 'De laatste beheerder kan niet worden verwijderd.' });
  delete g.profielen[id]; save();
  res.json({ ok: true });
});

router.post('/gezin/bericht', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, (req.body && req.body.token));
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const tekst = schoon(req.body.tekst, 800);
  if (!tekst) return res.status(400).json({ error: 'Schrijf een bericht.' });
  const naar = req.body.naar && g.profielen[req.body.naar] ? req.body.naar : 'allen';
  const soort = ['reis', 'hulp'].includes(req.body.soort) ? req.body.soort : 'bericht';
  const b = { id: rid(3), van: p.id, vanNaam: p.naam, vanAvatar: p.avatar, naar, soort, tekst: encS(tekst), at: nu(), gelezenDoor: [p.id] };
  if (!g.berichten) g.berichten = [];
  g.berichten.unshift(b); g.berichten = g.berichten.slice(0, 200); save();
  bezorgAanGasten(g, b); // gekoppelde oppas/familie krijgt dit ook in de RTG-app
  res.json({ ok: true, bericht: Object.assign({}, b, { tekst }) });
});

router.get('/gezin/:code/berichten', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, tokenUit(req));
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const mijn = (g.berichten || []).filter(b => berichtVoorMij(b, p.id)).map(b => ({
    id: b.id, van: b.van, vanNaam: b.vanNaam, vanAvatar: b.vanAvatar, naar: b.naar,
    naarNaam: b.naar === 'allen' ? 'iedereen' : (g.profielen[b.naar] ? g.profielen[b.naar].naam : ''),
    soort: b.soort, tekst: decS(b.tekst), at: b.at, vanMij: b.van === p.id,
    gelezen: (b.gelezenDoor || []).includes(p.id)
  }));
  res.json({ berichten: mijn });
});

router.post('/gezin/bericht/gelezen', (req, res) => {
  const g = gezinVan(req, res); if (!g) return;
  const p = profielVan(g, (req.body && req.body.token));
  if (!p) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  for (const b of (g.berichten || [])) if (berichtVoorMij(b, p.id) && !(b.gelezenDoor || []).includes(p.id)) { (b.gelezenDoor = b.gelezenDoor || []).push(p.id); }
  save();
  res.json({ ok: true });
});
};
