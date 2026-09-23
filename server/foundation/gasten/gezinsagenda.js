/* RTFoundation-gasten (deelmodule): de gezinsagenda (samen plannen).
   Gemount vanuit foundation/gasten.js op de gedeelde context; agendaPubliek,
   setAgenda en wisGezinsagenda gaan terug de context in (voor de
   koppelinglaag, server.js en het wissen in foundation/zorg.js).

   DE GEZINSAGENDA IS GEEN EIGEN AGENDA MEER. Tot de consolidatieronde van 23
   september 2026 stond hij als lijst in het gezinsrecord, met een eigen
   bereik-uitrol en een eigen opslag naast de RTG-agendakern -- twee
   implementaties van hetzelfde doel (SCHERMEIGENAAR.json). Nu schrijft en leest
   hij via DEZELFDE motor als de ledenagenda (kern/agenda.js + agenda-pro.js),
   onder de sleutel gezin:<code>. Wat hier blijft is wat van het GEZIN is: wie
   er mag schrijven (het gezin) en lezen (ook de oppas), de kleur en naam per
   gezinslid, het plafond van 200 punten, en school die alleen-lezen meekijkt.
   De motor wordt laat gebonden (setAgenda), zoals de marktplaats: hij bestaat
   pas na de sociale kern. */
const { agendaGezinSleutel } = require('../../kern/agenda');
const { keerN } = require('../../kern/agenda-pro');
const { schoolPunten } = require('../../school/planner');

module.exports = (ctx) => {
  const { router, F, G, db, save, schoon, isGast } = ctx;
  const { familieVan, sessieVan } = ctx;
  let agenda = null;
  // de enige deur naar de gedeelde agendacollectie, dezelfde als die van de motor
  const { agendaWortel } = require('../../kern/agenda-opslag')({ db });
  const sleutel = g => agendaGezinSleutel(g.code);
  // alleen lezen: een gezin zonder punten krijgt geen lege lijst in de opslag
  const punten = g => agendaWortel()[sleutel(g)] || [];
  function motorKlaar(res) {
    if (agenda) return true;
    res.status(503).json({ error: 'De agenda is nu even niet beschikbaar.' });
    return false;
  }

  /* De overname: wat nog in het gezinsrecord stond, gaat EEN keer naar de
     motor, met zijn eigen id (een oppas of een koppeling die het id kent, blijft
     het vinden) en zonder dat er iets bij verzonnen wordt. Idempotent: een id
     dat er al staat wordt niet nog eens gezet, en het veld in het gezinsrecord
     verdwijnt pas als alles over is. */
  function neemOver() {
    const w = agendaWortel();
    let bewogen = 0;
    for (const g of Object.values(G())) {
      if (!g || !Array.isArray(g.agenda)) continue;
      const k = sleutel(g);
      const doel = Array.isArray(w[k]) ? w[k] : (w[k] = []);
      for (const a of g.agenda) {
        if (!a || !a.id || doel.some(x => x.id === a.id)) continue;
        doel.push({ id: a.id, titel: a.titel, datum: a.datum, tijd: a.tijd || null, eind: null, plek: null,
          notitie: a.notitie || null, herhaal: a.herhaal || 'geen', herhaalTot: a.herhaalTot || null,
          herinner: null, gedaan: false, wie: a.wie || null, door: a.door || null, at: a.at || null });
        bewogen++;
      }
      delete g.agenda;
      bewogen++;
    }
    if (bewogen) save();
    return bewogen;
  }
  function setAgenda(m) { agenda = m; neemOver(); }
  // AVG: een gewist gezin neemt zijn agenda mee (foundation/zorg.js)
  function wisGezinsagenda(code) {
    delete agendaWortel()[agendaGezinSleutel(code)];
  }

  function velden(body) {
    return { herhaal: body.herhaal, herhaalTot: body.herhaalTot, notitie: schoon(body.notitie, 120) };
  }
  /* gezinsagenda: samen plannen. Het gezin voegt toe; iedereen (ook de oppas) mag
     de planning zien, zodat een oppas weet wat er die dag speelt. */
  router.post('/gezin/agenda', async (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!motorKlaar(res)) return;
    const titel = schoon(req.body.titel, 80);
    if (!titel) return res.status(400).json({ error: 'Waar gaat het agendapunt over?' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.datum || '')) return res.status(400).json({ error: 'Kies een datum.' });
    const wie = req.body.wie && s.g.profielen[req.body.wie] ? req.body.wie : '';
    if (punten(s.g).length >= 200) return res.status(400).json({ error: 'De agenda is vol. Haal eerst iets weg.' });
    const r = await agenda.bewaarAfspraak(sleutel(s.g), Object.assign(velden(req.body),
      { titel, datum: req.body.datum, tijd: req.body.tijd, wie, door: s.p.id }));
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    const item = punten(s.g).find(x => x.id === r.id);
    res.json({ ok: true, item: { id: item.id, titel: item.titel, datum: item.datum, tijd: item.tijd || '',
      wie: item.wie || '', door: item.door || '', herhaal: item.herhaal, herhaalTot: item.herhaalTot || '',
      notitie: item.notitie || '', at: item.at } });
  });
  /* wijzigen is verzetten, geen verdubbelen: hetzelfde punt schuift mee. De
     motor bewaart een punt in zijn geheel, dus wat niet wordt meegestuurd komt
     van het bestaande punt. */
  router.post('/gezin/agenda/wijzig', async (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!motorKlaar(res)) return;
    const a = punten(s.g).find(x => x.id === req.body.itemId);
    if (!a) return res.status(404).json({ error: 'Dit agendapunt bestaat niet (meer).' });
    const b = req.body;
    const data = { id: a.id, titel: a.titel, datum: a.datum, tijd: a.tijd, eind: a.eind, plek: a.plek,
      notitie: a.notitie, herhaal: a.herhaal, herhaalTot: a.herhaalTot, herinner: a.herinner, wie: a.wie || '' };
    if (b.titel !== undefined) { const t = schoon(b.titel, 80); if (!t) return res.status(400).json({ error: 'Waar gaat het agendapunt over?' }); data.titel = t; }
    if (b.datum !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(b.datum)) return res.status(400).json({ error: 'Kies een datum.' }); data.datum = b.datum; }
    if (b.tijd !== undefined) data.tijd = b.tijd;
    if (b.wie !== undefined) data.wie = b.wie && s.g.profielen[b.wie] ? b.wie : '';
    if (b.herhaal !== undefined) data.herhaal = b.herhaal;
    if (b.herhaalTot !== undefined) data.herhaalTot = b.herhaalTot;
    if (b.notitie !== undefined) data.notitie = schoon(b.notitie, 120);
    const r = await agenda.bewaarAfspraak(sleutel(s.g), data);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true });
  });
  /* het bereik: de motor rolt de herhalingen uit (dezelfde klemregel als de
     ledenagenda); hier komen de kleur en de naam van het gezinslid erbij --
     klaar voor een maandraster. De oppas mag dit ook lezen (sessieVan),
     schrijven blijft van het gezin. */
  router.post('/gezin/agenda/bereik', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    if (!motorKlaar(res)) return;
    const van = /^\d{4}-\d{2}-\d{2}$/.test(req.body.van || '') ? req.body.van : new Date().toISOString().slice(0, 10);
    let totD = /^\d{4}-\d{2}-\d{2}$/.test(req.body.tot || '') ? req.body.tot : '';
    if (!totD || totD < van) totD = keerN(van, 'maand', 2);
    const vandaag = new Date().toISOString().slice(0, 10);
    const r = agenda.bereik(sleutel(s.g), van, totD);
    const uit = (r.items || []).map(i => {
      const p = i.wie && s.g.profielen[i.wie];
      return { id: i.id, titel: i.titel, tijd: i.tijd || '', wie: i.wie || '',
        wieNaam: p ? p.naam : '', wieKleur: p && p.kleur ? p.kleur : '',
        herhaal: i.herhaal || 'geen', herhaalTot: i.herhaalTot || '', notitie: i.notitie || '',
        basis: i.basis, datum: i.datum, vandaag: i.datum === vandaag };
    });
    /* school kijkt mee, alleen-lezen: open huiswerk en de toetsen van de
       tieners op hun dag (dezelfde regel als de RTG-ecosysteemlaag: de
       agenda leest school, hij herschrijft school niet). Niet voor de oppas. */
    if (!isGast(s.p)) for (const x of schoolPunten(F(), s.g, van, totD)) uit.push(x);
    uit.sort((x, y) => (x.datum + (x.tijd || '99:99')).localeCompare(y.datum + (y.tijd || '99:99')));
    res.json({ items: uit, magBewerken: !isGast(s.p),
      profielen: Object.values(s.g.profielen).filter(p => !isGast(p))
        .map(p => ({ id: p.id, naam: p.naam, kleur: p.kleur || '' })) });
  });
  router.post('/gezin/agenda/verwijder', async (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!motorKlaar(res)) return;
    const r = await agenda.verwijder(sleutel(s.g), req.body.itemId);
    if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true });
  });
  function agendaPubliek(g) {
    const vandaag = new Date().toISOString().slice(0, 10);
    return punten(g)
      .map(a => ({ id: a.id, titel: a.titel, datum: a.datum, tijd: a.tijd || '', wie: a.wie || '', wieNaam: a.wie && g.profielen[a.wie] ? g.profielen[a.wie].naam : '', voorbij: a.datum < vandaag, vandaag: a.datum === vandaag }))
      .sort((a, b) => (a.datum + (a.tijd || '99:99')).localeCompare(b.datum + (b.tijd || '99:99')));
  }
  router.get('/gezin/:code/agenda', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    res.json({ agenda: agendaPubliek(s.g), magBewerken: !isGast(s.p) });
  });

  return { agendaPubliek, setAgenda, wisGezinsagenda };
};
