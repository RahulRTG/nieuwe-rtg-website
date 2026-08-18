/* Guest OS (deellaag): DE TAFEL -- scannen, aanschuiven en de kaart lezen.

   Dit is de enige plek in het gastdomein waar iemand binnenkomt zonder sleutel:
   de QR op tafel is hier de poort. Dat token is geen gemakje maar de
   toegangscontrole, en daarom staat er een rem op (`tooManyTries`) -- anders is
   een tafelsessie te raden door genoeg te proberen.

   DE KAART IS EEN LEESLAAG. De gerechten komen uit `s.menu` van de zaak, waar
   ze al stonden voor de kassa en de bediening. Er komt geen tweede menu naast;
   wat deze laag toevoegt is wat de GAST nodig heeft en de kassa niet toont:
   welke allergenen erin zitten, wat de keuken op uitverkocht heeft gezet, en
   waarom iets niet besteld kan worden. */
'use strict';

module.exports = (kern) => {
  const { app, schoon, findSupplier, beleid, sessie, orderlaag, gastAuth, stuur,
    tooManyTries, noteFailedTry } = kern;
  /* Het doorgeefluik naar de hotellaag komt uit routes/gast.js en leest de
     ECHTE kern op het moment van aanroepen; de folio-laag wordt later gemount. */
  const { folioVan } = kern;

  /* De rem op het raden van een QR-token. `tooManyTries` is GEEN middleware
     maar een helper die zelf antwoordt en true teruggeeft -- hem als
     middleware ophangen laat de route hangen (express geeft hem dan (req, res,
     next) en er wordt nooit een next aangeroepen). Dat is hier een keer
     gebeurd; vandaar deze regel en de vorm hieronder. */
  const geremd = (req, res, soort) => {
    const bucket = 'gast-' + soort + ':' + req.ip;
    if (tooManyTries(res, bucket)) return true;
    req.gastBucket = bucket;
    return false;
  };

  /* De kaart van een zaak, in de vorm die de gast leest. `alcohol` volgt uit de
     categorie of een expliciet vlaggetje op het item: de leeftijdsregel in
     beleid.js hangt eraan, dus raden mag hier niet stil gebeuren. */
  function kaartVanZaak(zaakcode) {
    const s = findSupplier(zaakcode);
    const menu = (s && Array.isArray(s.menu)) ? s.menu : [];
    const h = kern.horeca.H(zaakcode);
    const uit = (h.instel && h.instel.uitverkocht) || {};
    const twins = h.dishTwins || {};
    return menu.map(m => ({
      id: m.id, naam: m.name, uitleg: m.desc || null, cat: m.cat || 'Overig',
      foto: m.foto || m.photo || m.image || null,
      centen: Math.round(Number(m.price) * 100), allergenen: Array.isArray(m.allergens) ? m.allergens : [],
      station: m.station || null,
      alcohol: !!m.alcohol || /wijn|bier|cava|cocktail|gin|whisk|rum|vodka|borrel/i.test(String(m.name || '')),
      uitverkocht: !!uit[m.id], sindsWanneerUit: uit[m.id] ? uit[m.id].at : null,
      twin: twins[m.id] && twins[m.id].publicatie ? { versie:twins[m.id].publicatie.versie,
        presentatie:twins[m.id].publicatie.presentatie||null, service:twins[m.id].publicatie.service||null,
        pairing:twins[m.id].publicatie.pairing||null } : null
    }));
  }
  kern.gastKaartVanZaak = kaartVanZaak;

  /* ---------- de QR scannen ----------
     Geeft nog geen sessie: eerst zie je waar je bent en wat er speelt. Pas bij
     aanschuiven ontstaat er een deelnemer. Dat scheelt lege deelnemers op elke
     rekening van iedereen die per ongeluk scant. */
  app.post('/api/gast/tafel', (req, res) => {
    if (geremd(req, res, 'qr')) return;
    const plek = sessie.zaakBijToken((req.body || {}).token);
    if (!plek) { noteFailedTry(req.gastBucket, req.ip); return res.status(404).json({ error: 'Deze code hoort niet bij een tafel of kamer die wij kennen.', code: 'qr-onbekend' }); }
    const s = findSupplier(plek.zaakcode);
    /* Bij een KAMER wordt hier al gekeken of er een gastrekening op staat, dus
       voordat iemand een kaart doorbladert. Wie is uitgecheckt hoort dat meteen
       te lezen in plaats van pas bij het bestellen. */
    if (plek.soort === 'kamer' && !folioVan(plek.zaakcode, plek.plek)) {
      return res.status(409).json({ error: 'Er staat geen open gastrekening op kamer ' + plek.plek +
        '. Roomservice loopt via de receptie.', code: 'geen-verblijf', kamer: plek.plek });
    }
    const bestaand = sessie.rekeningVoorPlek(plek.zaakcode, plek.soort, plek.plek, { open: false });
    res.json({ ok: true, zaak: { code: plek.zaakcode, naam: s ? s.name : plek.zaakcode, plaats: s ? s.city : null },
      soort: plek.soort, plek: plek.plek, tafel: plek.soort === 'tafel' ? plek.plek : null,
      kamer: plek.soort === 'kamer' ? plek.plek : null,
      beleid: beleid.beleidVan(plek.zaakcode),
      lopendeRekening: bestaand && !bestaand.error ? { gasten: (bestaand.deelnemers || []).length, regels: bestaand.regels.length } : null,
      kaart: kaartVanZaak(plek.zaakcode) });
  });

  /* ---------- aanschuiven ----------
     Een lid mag zijn codenaam meesturen; die staat al op zijn sessie en is
     bewust NIET de echte naam. Wie geen lid is, geeft een voornaam of krijgt
     "Gast 3". Beide zijn genoeg om te weten wie welk biertje bestelde. */
  app.post('/api/gast/aanschuiven', (req, res) => {
    if (geremd(req, res, 'aanschuif')) return;
    const b = req.body || {};
    const plek = sessie.zaakBijToken(b.token);
    if (!plek) { noteFailedTry(req.gastBucket, req.ip); return res.status(404).json({ error: 'Deze code hoort niet bij een tafel die wij kennen.', code: 'qr-onbekend' }); }
    const uit = sessie.schuifAan(plek.zaakcode, plek.plek, {
      soort: plek.soort, folioVan,
      naam: b.naam, codenaam: b.codenaam, lid: !!b.lid,
      /* De leeftijd telt alleen als hij GEVERIFIEERD is. Een gast die zelf
         invult dat hij 19 is, opent hier geen alcoholdeur: beleid.js kijkt naar
         `leeftijdGeverifieerd`, en dat vlaggetje kan een gast niet zetten. */
      leeftijd: b.leeftijd, leeftijdGeverifieerd: false });
    if (uit.error) return stuur(res, uit);
    orderlaag.audit(uit.rekening, { actor: uit.deelnemer.handle, bron: 'gast', wat: 'aangeschoven',
      naar: 'deelnemer ' + uit.deelnemer.nr });
    kern.save();
    res.json({ ok: true, sleutel: uit.sleutel, ik: { nr: uit.deelnemer.nr, handle: uit.deelnemer.handle },
      zaak: plek.zaakcode, soort: plek.soort, plek: plek.plek,
      tafel: plek.soort === 'tafel' ? plek.plek : null,
      kamer: plek.soort === 'kamer' ? plek.plek : null,
      rekening: orderlaag.gastBeeld(uit.rekening, uit.deelnemer),
      let: 'Bewaar deze sessie op je telefoon; hij vervalt zodra de rekening is voldaan.' });
  });

  /* ---------- de kaart, met een sessie ---------- */
  app.post('/api/gast/kaart', gastAuth, (req, res) => {
    const { zaakcode } = req.gast;
    const zoek = String(schoon((req.body || {}).zoek, 40) || '').toLowerCase();
    const dieet = Array.isArray((req.body || {}).zonder) ? (req.body || {}).zonder.map(x => String(x).toLowerCase()) : [];
    let rijen = kaartVanZaak(zaakcode);
    /* Filteren op wat er NIET in mag zit hier en niet in de client: een
       dieetfilter dat in de browser draait, filtert alleen wat de browser al
       heeft en mist dus precies het gerecht dat later binnenkwam. */
    if (dieet.length) rijen = rijen.filter(r => !r.allergenen.some(a => dieet.includes(String(a).toLowerCase())));
    if (zoek) rijen = rijen.filter(r => (r.naam + ' ' + (r.uitleg || '')).toLowerCase().includes(zoek));
    const cats = [...new Set(rijen.map(r => r.cat))];
    res.json({ ok: true, aantal: rijen.length, categorieen: cats, kaart: rijen,
      gefilterdOp: dieet.length ? dieet : null,
      beleid: beleid.beleidVan(zaakcode) });
  });

  /* Menu Concierge: filtert alleen op gepubliceerde kaartfeiten. Bij een
     allergeen wordt nooit "veilig" beloofd: de bestaande menselijke
     bevestigingsgrendel blijft gelden bij bestellen. */
  app.post('/api/gast/concierge', gastAuth, (req,res) => {
    const { zaakcode }=req.gast, b=req.body||{}, vraag=String(schoon(b.vraag,240)||'').toLowerCase();
    const zonder=(Array.isArray(b.zonder)?b.zonder:[]).map(x=>String(x).toLowerCase()).filter(Boolean);
    const woorden=vraag.split(/[^a-zà-ÿ0-9]+/).filter(x=>x.length>2);
    let kaart=kaartVanZaak(zaakcode).filter(x=>!x.uitverkocht&&!x.alcohol&&!x.allergenen.some(a=>zonder.includes(String(a).toLowerCase())));
    kaart=kaart.map(x=>{const tekst=(x.naam+' '+(x.uitleg||'')+' '+x.cat+' '+((x.twin&&x.twin.pairing)||'')).toLowerCase();return Object.assign({},x,{score:woorden.reduce((n,w)=>n+(tekst.includes(w)?1:0),0)});}).sort((a,b)=>b.score-a.score||a.centen-b.centen).slice(0,4);
    res.json({ok:true,suggesties:kaart,antwoord:kaart.length?'Deze combinaties passen het best bij uw vraag en zijn nu beschikbaar. Allergieën worden bij bestellen altijd nog persoonlijk gecontroleerd.':'Ik zie nu geen passende beschikbare combinatie. Vraag de bediening om een persoonlijk alternatief.',menselijkeControle:zonder.length>0});
  });
};
