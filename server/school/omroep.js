/* School (deelmodule): communicatie die uitgaat -- de nieuwsbrief, de
   automatische herinneringen en het vakgroepgesprek van het personeel.

   Wat er NIET bij zit is net zo belangrijk: geen leesbevestiging per ouder,
   geen "wie heeft het geopend"-lijst. Dat is de knop waarmee een schoolapp
   ongemerkt een controlemiddel wordt, en hij levert niets op wat een telefoon-
   tje niet beter doet.

   De nieuwsbrief gaat MEERTALIG de deur uit: het Nederlands blijft altijd
   staan en de thuistaal komt ernaast (dezelfde regel als school/taal.js).
   Vertalen loopt via de bestaande vertaallaag, dus zonder AI-sleutel valt hij
   terug op het woordenboek in plaats van stuk te gaan.

   De herinneringen zijn met opzet BEREKEND en niet opgeslagen als takenlijst:
   wat open staat, volgt uit de gegevens zelf. Een aparte herinneringentabel
   loopt gegarandeerd uit de pas met de werkelijkheid (LAT-regel 4). Versturen
   gebeurt hooguit een keer per dag per onderwerp, want een herinnering die
   drie keer komt, wordt een herinnering die niemand meer leest. */
const vertaal = require('../translate');

module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, eigenVeld, poort } = sctx;

  const vandaag = () => new Date().toISOString().slice(0, 10);
  const overDagen = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const dagenGeleden = (d) => new Date(Date.now() - d * 86400000).toISOString();
  const klassenVan = (sch) => Object.values(K()).filter(k => k.schoolCode === sch.code);

  /* ---------- de nieuwsbrief ---------- */
  router.post('/school/nieuwsbrief', async (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie && !sctx.mag(g.p, 'leerling')) return res.status(403).json({ error: 'Een nieuwsbrief verstuurt de school.' });
    const titel = schoon(req.body.titel, 100), tekst = schoon(req.body.tekst, 4000);
    if (!titel || !tekst) return res.status(400).json({ error: 'Geef de nieuwsbrief een titel en een tekst.' });
    let doel = klassenVan(g.sch);
    const klasCode = String(req.body.klasCode || '').trim().toUpperCase();
    const vestiging = schoon(req.body.vestiging, 20);
    if (klasCode) doel = doel.filter(k => k.code === klasCode);
    if (vestiging) doel = doel.filter(k => k.vestiging === vestiging);
    if (!doel.length) return res.status(404).json({ error: 'Daar zijn geen klassen voor gevonden.' });

    // welke thuistalen komen er in de doelgroep voor? Een keer vertalen per taal.
    const talen = [...new Set(doel.flatMap(k => (k.leerlingen || []).map(l => l.taal).filter(Boolean)))].slice(0, 8);
    const vertalingen = {};
    for (const t of talen) {
      const kop = await vertaal.translate(titel, t, 'nl').catch(() => null);
      const body = await vertaal.translate(tekst, t, 'nl').catch(() => null);
      if (kop || body) vertalingen[t] = { titel: kop ? kop.text : titel, tekst: body ? body.text : tekst };
    }
    const brief = { id: rid(5), titel, tekst, at: nu(), door: g.p.naam, vertalingen, klassen: doel.map(k => k.code) };
    g.sch.nieuwsbrieven = [brief].concat(g.sch.nieuwsbrieven || []).slice(0, 200);
    for (const k of doel) {
      k.mededelingen.unshift({ id: rid(3), tekst: titel + ' -- ' + tekst, at: nu(), vanDirectie: true,
        van: g.sch.naam, nieuwsbrief: brief.id, vertalingen });
      k.mededelingen = k.mededelingen.slice(0, 100);
    }
    save();
    res.json({ ok: true, nieuwsbrief: { id: brief.id, titel: brief.titel, klassen: doel.length, talen: Object.keys(vertalingen) },
      uitleg: 'Het Nederlands blijft staan; de thuistaal komt ernaast. Er wordt niet bijgehouden wie hem opent.' });
  });

  router.post('/school/nieuwsbrief/lijst', (req, res) => {
    const g = poort(req, res); if (!g) return;
    res.json({ ok: true, nieuwsbrieven: (g.sch.nieuwsbrieven || []).slice(0, 50)
      .map(b => ({ id: b.id, titel: b.titel, at: b.at, door: b.door, klassen: (b.klassen || []).length, talen: Object.keys(b.vertalingen || {}) })) });
  });

  /* ---------- de herinneringen ----------
     Vier soorten, allemaal uitgerekend uit wat er al staat. */
  function herinneringen(sch) {
    const uit = [];
    const morgen = overDagen(1);
    for (const k of klassenVan(sch)) {
      for (const h of (k.huiswerk || [])) {
        if (!h.deadline || h.deadline < vandaag() || h.deadline > morgen) continue;
        const nog = (k.leerlingen || []).length - (h.afDoor || []).length;
        if (nog > 0) uit.push({ soort: 'huiswerk', klasCode: k.code, sleutel: 'hw:' + h.id,
          tekst: 'Huiswerk "' + h.titel + '" moet ' + (h.deadline === vandaag() ? 'vandaag' : 'morgen') + ' af; ' + nog + ' leerling(en) hebben nog niet afgevinkt.' });
      }
      for (const t of (k.toetsen || [])) {
        if (t.status !== 'open' || t.at >= dagenGeleden(3)) continue;
        const gemaakt = Object.values(t.werk || {}).filter(w => w && w.klaar).length;
        const nog = (k.leerlingen || []).length - gemaakt;
        if (nog > 0) uit.push({ soort: 'toets', klasCode: k.code, sleutel: 'toets:' + t.id,
          tekst: 'Toets "' + (t.naam || t.soort) + '" staat al langer dan drie dagen open; ' + nog + ' leerling(en) hebben hem nog niet gemaakt.' });
      }
    }
    for (const f of (sch.facturen || [])) {
      const open = Math.max(0, f.centen - (f.betaald || 0) + (f.terugbetaald || 0));
      if (!open || !f.vervalt || f.vervalt >= vandaag()) continue;
      if (f.vrijwillig) continue; // een vrijwillige bijdrage herinneren we niet automatisch
      uit.push({ soort: 'factuur', sleutel: 'fac:' + f.id, leerlingId: f.leerlingId,
        tekst: 'Factuur ' + f.nummer + ' (' + (open / 100).toFixed(2) + ' euro) is vervallen op ' + f.vervalt + '.' });
    }
    for (const v of (sch.verlof || [])) if (v.status === 'ingediend' && v.at < dagenGeleden(3))
      uit.push({ soort: 'verlof', sleutel: 'verlof:' + v.id, tekst: 'Verlofaanvraag van ' + (v.naam || 'een leerling') + ' wacht al langer dan drie dagen op een besluit.' });
    return uit;
  }

  router.post('/school/herinneringen', (req, res) => {
    const g = poort(req, res); if (!g) return;
    const rijen = herinneringen(g.sch);
    const gestuurd = g.sch.herinneringGestuurd || {};
    res.json({ ok: true, aantal: rijen.length,
      herinneringen: rijen.map(r => Object.assign({}, r, { alGestuurdVandaag: gestuurd[r.sleutel] === vandaag() })).slice(0, 200) });
  });

  /* Versturen: als mededeling in de klas (huiswerk en toets) of als regel op de
     werklijst van de administratie (factuur en verlof -- die horen niet in een
     klasmededeling thuis, want dan leest de hele klas mee over het geld van een
     gezin). */
  router.post('/school/herinnering/verstuur', (req, res) => {
    const g = poort(req, res); if (!g) return;
    if (!g.directie && !sctx.mag(g.p, 'leerling')) return res.status(403).json({ error: 'Herinneringen verstuurt de school.' });
    const gestuurd = g.sch.herinneringGestuurd || (g.sch.herinneringGestuurd = {});
    const soort = schoon(req.body.soort, 20);
    let n = 0, overgeslagen = 0;
    const intern = [];
    for (const r of herinneringen(g.sch)) {
      if (soort && r.soort !== soort) continue;
      if (gestuurd[r.sleutel] === vandaag()) { overgeslagen++; continue; }
      gestuurd[r.sleutel] = vandaag();
      if (r.klasCode) {
        const k = eigenVeld(K(), r.klasCode);
        if (k) { k.mededelingen.unshift({ id: rid(3), tekst: 'Herinnering: ' + r.tekst, at: nu(), van: g.sch.naam, herinnering: true }); n++; }
      } else { intern.push(r.tekst); n++; }
    }
    // opruimen: sleutels van gisteren en eerder hebben geen betekenis meer
    for (const s of Object.keys(gestuurd)) if (gestuurd[s] !== vandaag()) delete gestuurd[s];
    save();
    res.json({ ok: true, verstuurd: n, overgeslagen, intern,
      uitleg: 'Hooguit een keer per dag per onderwerp. Geld- en verlofherinneringen gaan naar de administratie, nooit naar de klas.' });
  });

  /* ---------- het vakgroepgesprek ----------
     Een draadje per vak of team, voor het personeel onderling. Bewust apart
     van de klasberichten: een leraar die met collega's overlegt, doet dat niet
     in de lijn met de ouders. */
  router.post('/school/vakgroep', (req, res) => {
    const g = poort(req, res); if (!g) return;
    const vak = schoon(req.body.vak, 40);
    if (!vak) return res.status(400).json({ error: 'Welk vak of team?' });
    const groepen = g.sch.vakgroepen || (g.sch.vakgroepen = {});
    const groep = groepen[vak] || (groepen[vak] = { vak, berichten: [] });
    const tekst = schoon(req.body.tekst, 1000);
    if (tekst) {
      groep.berichten.unshift({ id: rid(4), tekst, van: g.p.naam, at: nu() });
      groep.berichten = groep.berichten.slice(0, 300);
      save();
    }
    res.json({ ok: true, vak, berichten: groep.berichten.slice(0, 50),
      vakken: Object.keys(groepen) });
  });

  return { herinneringen };
};
