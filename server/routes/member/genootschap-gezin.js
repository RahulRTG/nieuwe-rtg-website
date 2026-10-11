/* DE GEZINSDEUR VAN HET GENOOTSCHAP -- /api/rtf/genootschap/* (B1,
   GEMEENSCHAP-FASE0.md par. 2 regel 3 en par. 4.1).

   TWEE DEUREN, EEN KERN. Elke route hieronder roept EXACT dezelfde kernfunctie
   aan als zijn tweeling onder /api/genootschap (routes/member/genootschap.js),
   met dezelfde afhandeling van het antwoord -- zoals /api/rtf/knelpunt dat doet
   (routes/knelpunt.js). Wat verschilt is alleen WIE er binnenkomt: hier een
   gezinsprofiel, met de sleutel `rtf:CODE:pid` uit rtf.verifieerProfiel en
   NOOIT uit het verzoek. `auth` wordt niet verzwakt; er komt een deur bij.
   test/genootschap-drager-server.test.js legt het antwoord van beide deuren
   byte voor byte naast elkaar.

   WIE ER NIET DOOR KAN, EN WAAROM.
   - een gast-profiel: gezinsPoort houdt hem tegen (hij heeft geen codenaam om
     een lidmaatschap aan te hangen);
   - een BESCHERMD profiel, en ieder gezinslid van wie het gezin geen leeftijd
     van 18 of ouder heeft opgegeven: een genootschap is een gemeenschap met
     volwassenen buiten het gezin, en de bescherming die dat voor kinderen vraagt
     (G5, par. 5.3) is er nog niet. Besluit 3 van de eigenaar (geen een-op-een
     tussen volwassene en minderjarige buiten het gezin) wijst dezelfde kant op.
     De weigering draagt de reden.

   WAT HIER MET OPZET NIET STAAT: prikken, uitnodigen, rollen, bijeenkomsten
   uitroepen en de AI. Een gezinslid kan lezen, zoeken, een OPENBAAR genootschap
   binnenlopen en weer vertrekken. Uitnodigen van een gezinslid gaat volgens het
   ontwerp via zijnVrienden() en niet op codenaam, en dat is een volgende stap. */
'use strict';
const { veiligeFout } = require('../../kern/util');
const { leeftijdVan } = require('../../lib/leeftijd');

const REDEN_JONG = 'Het genootschap is voor gezinsleden van 18 jaar en ouder. Voor kinderen en tieners ' +
  'wacht het op de bescherming van minderjarigen in gemeenschappen (GEMEENSCHAP-FASE0.md par. 5.3).';

module.exports = (kern) => {
  const { app, rtf, genootschap, prikbord, bijeenkomst } = kern;
  const { gezinsPoort } = require('../connect-gezinsdeur')({ rtf });
  const fout = (res, e) => res.status(400).json({ error: veiligeFout(e) });
  const uit = (res, r) => r && r.error ? res.status(400).json(r) : res.json(r);
  // het lijf zonder de geloofsbrief: code en token gaan nooit mee naar de kern
  const lijf = (req) => { const { code, token, ...rest } = req.body || {}; return rest; };

  /* De leeftijd komt uit het PROFIEL dat rtf.verifieerProfiel teruggeeft, niet
     uit het verzoek. Geen geboortedatum telt als jonger: bij twijfel de
     strengere weg (zelfde regel als lib/leeftijd.js ouderGeeftToestemming). */
  const alsGezinslid = (werk) => (req, res) => {
    const g = req.gezinslid;
    const lft = leeftijdVan(g && g.p && g.p.geboren);
    if (!g || g.beschermd || g.kind || lft == null || lft < 18) return res.status(403).json({ error: REDEN_JONG, wacht: 'G5' });
    try { werk(req, res, { key: g.handle }); } catch (e) { fout(res, e); }
  };

  app.post('/api/rtf/genootschap/mijn', gezinsPoort, alsGezinslid((req, res, sess) =>
    res.json(genootschap.mijn(sess))));
  app.post('/api/rtf/genootschap/zoek', gezinsPoort, alsGezinslid((req, res, sess) =>
    res.json(genootschap.zoek(sess, lijf(req)))));
  app.post('/api/rtf/genootschap/binnen', gezinsPoort, alsGezinslid((req, res, sess) =>
    uit(res, genootschap.tredBinnen(sess, lijf(req).groep))));
  app.post('/api/rtf/genootschap/vertrek', gezinsPoort, alsGezinslid((req, res, sess) =>
    uit(res, genootschap.vertrek(sess, lijf(req).groep))));
  app.post('/api/rtf/genootschap/prikbord', gezinsPoort, alsGezinslid((req, res, sess) =>
    uit(res, prikbord.lees(sess, lijf(req).groep, lijf(req)))));
  app.post('/api/rtf/genootschap/agenda', gezinsPoort, alsGezinslid((req, res, sess) =>
    uit(res, bijeenkomst.agenda(sess, lijf(req).groep))));
};
