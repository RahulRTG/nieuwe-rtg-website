/* School (deelmodule): de ouderbijdrage en de telefoonboom.
   - De ouderbijdrage is en blijft VRIJWILLIG: dat staat in elk antwoord, en
     een kind wordt nooit ergens van uitgesloten omdat er niet betaald is.
   - De telefoonboom is het oudste noodkanaal dat er is: de leraar belt de
     eerste twee gezinnen, elk gezin belt er weer twee. Iedereen ziet alleen
     de eigen takken; nummers geven ouders zelf op, alleen voor dit doel. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, klasVan, gezinSessie, leerlingVan } = sctx;
  const VRIJWILLIG = 'De ouderbijdrage is vrijwillig; een kind wordt nooit uitgesloten als er niet betaald is.';

  const bijdragen = (k) => { if (!Array.isArray(k.bijdragen)) k.bijdragen = []; return k.bijdragen; };

  /* ---------- de vrijwillige ouderbijdrage ---------- */
  router.post('/school/bijdrage/maak', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const titel = schoon(req.body.titel, 80);
    const bedrag = Math.round(Number(req.body.bedrag) * 100) / 100;
    if (!titel) return res.status(400).json({ error: 'Geef de bijdrage een naam.' });
    if (!(bedrag > 0 && bedrag <= 500)) return res.status(400).json({ error: 'Een bijdrage is tussen 0,01 en 500 euro.' });
    const b = { id: rid(4), titel, bedrag, omschrijving: schoon(req.body.omschrijving, 300),
      vrijwillig: true, betaald: [], at: nu() };
    bijdragen(k).unshift(b); k.bijdragen = k.bijdragen.slice(0, 100);
    save();
    res.json({ ok: true, bijdrage: { id: b.id, titel: b.titel, bedrag: b.bedrag }, vrijwillig: VRIJWILLIG });
  });

  router.post('/school/bijdrage/betaal', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder of verzorger betaalt de bijdrage.' });
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, String(req.body.profielId || ''));
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const b = bijdragen(k).find(x => x.id === String(req.body.bijdrageId || ''));
    if (!b) return res.status(404).json({ error: 'Bijdrage niet gevonden.' });
    if (b.betaald.some(x => x.sleutel === l.sleutel)) return res.status(409).json({ error: 'Deze bijdrage is al betaald voor dit kind.' });
    b.betaald.push({ sleutel: l.sleutel, door: schoon(s.p.naam, 60), at: nu() });
    save();
    res.json({ ok: true, betaald: true, vrijwillig: VRIJWILLIG });
  });

  router.post('/school/bijdrage/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const mijnIds = s.beheerder ? Object.keys(s.g.profielen) : [s.p.id];
    const eigen = (k.leerlingen || []).filter(l => l.gezinCode === s.g.code && mijnIds.includes(l.profielId));
    if (!eigen.length) return res.status(403).json({ error: 'Geen kind van jullie in deze klas.' });
    res.json({ ok: true, vrijwillig: VRIJWILLIG, bijdragen: bijdragen(k).map(b => ({
      id: b.id, titel: b.titel, bedrag: b.bedrag, omschrijving: b.omschrijving, at: b.at,
      kinderen: eigen.map(l => ({ profielId: l.profielId, naam: l.naam,
        betaald: b.betaald.some(x => x.sleutel === l.sleutel) }))
    })) });
  });

  // de leraar ziet wie er betaald heeft (administratie), met de vaste regel erbij
  router.post('/school/bijdrage/overzicht', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const naamVan = (sl) => { const l = (k.leerlingen || []).find(x => x.sleutel === sl); return l ? l.naam : sl; };
    res.json({ ok: true, vrijwillig: VRIJWILLIG, bijdragen: bijdragen(k).map(b => ({
      id: b.id, titel: b.titel, bedrag: b.bedrag, at: b.at,
      betaald: b.betaald.map(x => ({ naam: naamVan(x.sleutel), at: x.at })),
      leerlingen: (k.leerlingen || []).length
    })) });
  });

  /* ---------- de telefoonboom ----------
     Een gezin is een knoop (broertjes en zusjes tellen als een). De leraar
     belt de gezinnen op plek 1 en 2; het gezin op plek i belt plek 2i+2 en
     2i+3. Zo wordt iedereen precies een keer gebeld. */
  const boomVan = (k) => {
    if (!k.telefoonboom || typeof k.telefoonboom !== 'object') k.telefoonboom = { nummers: {}, volgorde: null, alarm: null };
    return k.telefoonboom;
  };
  const knopen = (k) => { const gezien = {}; return (k.leerlingen || []).filter(l => (gezien[l.gezinCode] ? false : (gezien[l.gezinCode] = true))); };
  const takken = (volgorde, i) => [volgorde[2 * i + 2], volgorde[2 * i + 3]].filter(Boolean);

  // een ouder zet het eigen nummer erin -- vrijwillig en alleen voor de boom
  router.post('/school/telefoonboom/nummer', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'Alleen een ouder of verzorger zet het nummer in de boom.' });
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const eigen = k && (k.leerlingen || []).find(l => l.gezinCode === s.g.code);
    if (!eigen) return res.status(403).json({ error: 'Geen kind van jullie in deze klas.' });
    const nummer = String(req.body.nummer || '').trim();
    if (!/^\+?[0-9][0-9 -]{5,18}$/.test(nummer)) return res.status(400).json({ error: 'Geen geldig telefoonnummer.' });
    boomVan(k).nummers[s.g.code] = { nummer, naam: schoon(s.p.naam, 60) };
    save();
    res.json({ ok: true });
  });

  router.post('/school/telefoonboom/maak', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const b = boomVan(k);
    b.volgorde = knopen(k).map(l => ({ gezinCode: l.gezinCode, kind: l.naam }));
    b.alarm = null; b.at = nu();
    save();
    res.json({ ok: true, aantal: b.volgorde.length });
  });

  const tak = (k, n) => {
    const num = boomVan(k).nummers[n.gezinCode];
    return { kind: n.kind, naam: num ? num.naam : null, nummer: num ? num.nummer : null };
  };

  router.post('/school/telefoonboom/start', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const b = boomVan(k);
    if (!b.volgorde || !b.volgorde.length) return res.status(400).json({ error: 'Maak eerst de telefoonboom.' });
    const bericht = schoon(req.body.bericht, 300);
    if (!bericht) return res.status(400).json({ error: 'Schrijf het bericht dat wordt doorgegeven.' });
    b.alarm = { bericht, at: nu(), bevestigd: {} };
    save();
    res.json({ ok: true, leraarBelt: b.volgorde.slice(0, 2).map(n => tak(k, n)) });
  });

  // wie bel ik? alleen de eigen takken, nooit de hele lijst
  router.post('/school/telefoonboom/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'De telefoonboom is voor ouders en verzorgers.' });
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const b = boomVan(k);
    const ix = (b.volgorde || []).findIndex(n => n.gezinCode === s.g.code);
    if (ix < 0) return res.status(404).json({ error: 'Jullie staan (nog) niet in de telefoonboom; vraag de leraar hem opnieuw te maken.' });
    res.json({ ok: true, ikBel: takken(b.volgorde, ix).map(n => tak(k, n)),
      nummerGezet: !!b.nummers[s.g.code],
      alarm: b.alarm ? { bericht: b.alarm.bericht, at: b.alarm.at, doorgegeven: !!b.alarm.bevestigd[s.g.code] } : null });
  });

  router.post('/school/telefoonboom/doorgegeven', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    if (!s.beheerder) return res.status(403).json({ error: 'De telefoonboom is voor ouders en verzorgers.' });
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const b = k && boomVan(k);
    if (!b || !b.alarm) return res.status(400).json({ error: 'Er loopt geen telefoonboom-alarm.' });
    b.alarm.bevestigd[s.g.code] = nu();
    save();
    res.json({ ok: true });
  });

  // het leraar-overzicht: de hele boom, wie een nummer heeft en wie al belde
  router.post('/school/telefoonboom', (req, res) => {
    const k = klasVan(req, res); if (!k) return;
    const b = boomVan(k);
    res.json({ ok: true, alarm: b.alarm ? { bericht: b.alarm.bericht, at: b.alarm.at } : null,
      volgorde: (b.volgorde || []).map((n, i) => ({ kind: n.kind, nummer: !!b.nummers[n.gezinCode],
        belt: takken(b.volgorde, i).map(x => x.kind),
        doorgegeven: b.alarm ? !!b.alarm.bevestigd[n.gezinCode] : null })) });
  });
};
