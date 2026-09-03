/* RTG Boardroom, deel "schakelaar": de directe schakelaars van de eigenaar --
   per persoon/land/doelgroep aan/uit, storing melden, reset naar standaard, en
   het toepassen van een AI-voorstel (schakelen + de geld-regie). De aan/uit-
   stand wordt door de functie-middleware echt gehandhaafd; "storing" is puur een
   statusvlag. Afgesplitst uit boardroom/index.js; de gedeelde helpers komen via
   het bord-object binnen. */
const functies = require('../../../functies');
module.exports = (b) => {
  const { app, techAuth, eigenaarAlleen, staat, save, herleidPersoon, boardroomTelling,
    geldPasprijsZet, geldKortingZet, geldCommissieZet } = b;

  /* Directe schakelaar (alleen de eigenaar). Vijf assen, meest specifiek wint:
     - { id, persoon, aan }   -> per persoon (e-mail/codenaam/sleutel)
     - { id, plaats, aan }    -> per woonplaats (stad of dorp, vrije naam)
     - { id, land, aan }      -> per land (2-letter code)
     - { id, doelgroep, aan } -> per pas/doelgroep
     - { id, aan }            -> globaal
     Op een as (niet globaal) betekent aan=true: de beperking wordt verwijderd. */
  app.post('/api/boardroom/zet', techAuth, eigenaarAlleen, async (req, res) => {
    const t = staat();
    const f = functies.OP_ID[req.body.id];
    if (!f) return res.status(404).json({ error: 'Onbekende functie.' });
    const aan = req.body.aan !== false && req.body.aan !== 'false';
    /* Eerst uitrekenen WELKE as geraakt wordt en of die klopt, en pas daarna de
       stand aanraken. Andersom kostte een geweigerd verzoek toch iets: een
       onbekende codenaam of een landcode van een letter liet een verse
       functie-stand achter EN wiste het automaat-merk van een bestaande -- dus
       een 404 die de storingswachter stilzette. */
    let as = '', sleutel = '';
    if (req.body.persoon) {
      const p = await herleidPersoon(req.body.persoon);
      if (!p) return res.status(404).json({ error: 'Geen account gevonden op die codenaam of e-mail.' });
      as = 'perPersoon'; sleutel = p.key;
    } else if (req.body.plaats) {
      const plaats = functies.plaatsNorm(req.body.plaats);
      if (!plaats) return res.status(400).json({ error: 'Geef een plaatsnaam (stad of dorp).' });
      as = 'perPlaats'; sleutel = plaats;
    } else if (req.body.land) {
      const land = String(req.body.land).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      if (land.length !== 2) return res.status(400).json({ error: 'Geef een geldige landcode (2 letters).' });
      as = 'perLand'; sleutel = land;
    } else if (req.body.doelgroep) {
      const dg = String(req.body.doelgroep);
      if (!(f.doelgroepen || []).includes(dg)) return res.status(400).json({ error: 'Deze functie kent die doelgroep niet.' });
      as = 'perDoelgroep'; sleutel = dg;
    }
    const cur = t.functies[f.id] = t.functies[f.id] || {};
    /* De hand wint van de automaat: elke greep van de eigenaar wist het
       automaat-merk, zodat de storingswachter deze stand nooit meer als de
       zijne behandelt (en dus niet stiekem terugschakelt). */
    delete cur.automaat;
    if (as) {
      cur[as] = cur[as] || {};
      // op een as betekent aan=true: de beperking verdwijnt weer
      if (aan) delete cur[as][sleutel]; else cur[as][sleutel] = false;
    } else {
      cur.aan = aan;
    }
    // de tegenhanger volgt automatisch (dezelfde regel als in de kantoren-boardroom)
    const ookGeschakeld = functies.volgKoppels(f.id, t.functies);
    save();
    res.json({ ok: true, id: f.id, status: functies.functieStatus(f.id, t.functies),
      ookGeschakeld: ookGeschakeld.length ? ookGeschakeld : undefined });
  });

  /* De automaat per functie aan of uit: { id, wachter:bool }. Uit betekent:
     de storingswachter mag deze functie nooit zelf dichtgooien of heropenen;
     elke schakeling is dan mensenwerk. Voor geld-functies bijvoorbeeld een
     redelijke keuze. */
  app.post('/api/boardroom/wachter', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const f = functies.OP_ID[req.body.id];
    if (!f) return res.status(404).json({ error: 'Onbekende functie.' });
    const cur = t.functies[f.id] = t.functies[f.id] || {};
    if (req.body.wachter === false || req.body.wachter === 'false') cur.wachter = false;
    else { delete cur.wachter; delete cur.automaat; }
    save();
    res.json({ ok: true, id: f.id, wachter: cur.wachter !== false });
  });

  // Storing melden of herstellen (oranje aan/uit): { id, storing:bool, reden }.
  app.post('/api/boardroom/storing', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const f = functies.OP_ID[req.body.id];
    if (!f) return res.status(404).json({ error: 'Onbekende functie.' });
    const cur = t.functies[f.id] = t.functies[f.id] || {};
    if (req.body.storing === false || req.body.storing === 'false') cur.storing = null;
    else cur.storing = { reden: String(req.body.reden || 'Handmatig gemeld').slice(0, 160), at: new Date().toISOString() };
    save();
    res.json({ ok: true, id: f.id, status: functies.functieStatus(f.id, t.functies) });
  });

  // Reset: alle functies terug naar de standaard (alles aan, storingen weg).
  app.post('/api/boardroom/reset', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    t.functies = {};
    save();
    res.json({ ok: true, functies: functies.catalogus(t.functies), samenvatting: boardroomTelling(functies.catalogus(t.functies)) });
  });

  // Een AI-voorstel toepassen (alleen de eigenaar, in een tik). Naast het
  // schakelen (globaal/pas/genre) voert dit ook de geld-regie uit via de
  // geld-motor van de kern, die de grenzen nogmaals bewaakt.
  app.post('/api/boardroom/toepassen', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const wijz = functies.valideerVoorstel(req.body.voorstel);
    let toegepast = 0;
    const fouten = [];
    for (const w of wijz) {
      if (w.soort === 'pasprijs' || w.soort === 'korting' || w.soort === 'commissie') {
        const doe = w.soort === 'pasprijs' ? geldPasprijsZet({ pas: w.pas, euro: w.euro })
          : w.soort === 'korting' ? geldKortingZet({ genre: w.genre, pct: w.pct })
          : geldCommissieZet(w.code ? { code: w.code, pct: w.pct } : { genre: w.genre, pct: w.pct });
        if (doe && doe.ok) toegepast++; else fouten.push(w.naam + ': ' + ((doe && doe.error) || 'mislukt'));
        continue;
      }
      const cur = t.functies[w.id] = t.functies[w.id] || {};
      if (w.genre) {
        cur.perGenre = cur.perGenre || {};
        const f = functies.OP_ID[w.id];
        // aan: terug naar de standaard, of een expliciete uitzondering als de
        // standaard-matrix (alleenGenres) dit genre normaal niet kent
        if (w.aan) {
          if (f && Array.isArray(f.alleenGenres) && !f.alleenGenres.includes(w.genre)) cur.perGenre[w.genre] = true;
          else delete cur.perGenre[w.genre];
        } else cur.perGenre[w.genre] = false;
      }
      else if (w.doelgroep) { cur.perDoelgroep = cur.perDoelgroep || {}; cur.perDoelgroep[w.doelgroep] = w.aan; }
      else cur.aan = w.aan;
      toegepast++;
      // de tegenhanger volgt automatisch mee (dezelfde regel als bij direct schakelen)
      functies.volgKoppels(w.id, t.functies);
    }
    save();
    res.json({ ok: true, toegepast, fouten: fouten.length ? fouten : undefined, functies: functies.catalogus(t.functies) });
  });
};
