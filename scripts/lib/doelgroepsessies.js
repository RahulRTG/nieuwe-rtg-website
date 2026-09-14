/* ============================================================================
   EEN ECHTE SESSIE PER DOELGROEP -- de acht van het functieregister.

   WAAROM NAAST ./proefsessies.js EN NIET ERIN. Dat bestand heet "de vier
   sessies die een BROWSERproef nodig heeft" en is daarnaar gevormd: elke rol
   draagt een localStorage-sleutel en een startpagina. Hier is de vraag een
   andere -- een TOKEN per doelgroep uit server/functies/register/doelgroepen.js,
   voor een proef die alleen HTTP spreekt en nooit een browser opent. Vier van de
   acht bestaan daar al, en die worden hier GELEEND en niet overgetypt: wie de
   inlog van een lid twee keer opschrijft, heeft over een half jaar twee
   verschillende leden.

   `appwerkt.js` roept `haalSessies(base)` zonder lijst aan en krijgt dus alles
   wat in ROLLEN staat. Daar rollen zetten die hij niet vroeg, verandert stil een
   andere meting -- vandaar een eigen module in plaats van vier regels erbij.

   DRIE DINGEN DIE HIER VASTLIGGEN:

   1. NOOIT EEN NAGEBOUWD TOKEN. Elke sessie komt langs de echte route over de
      server. Een zelfgemaakt token meet je eigen aanname en niet de deur --
      dezelfde regel als in ./proefsessies.js.
   2. OVERSLAAN IS NOOIT STIL. Lukt een inlog niet, dan komt die doelgroep terug
      in `overgeslagen` met de reden. Een doelgroep zonder sessie mag NOOIT als
      "niet bereikbaar" worden geteld: dat zou van een kapotte inlog een
      registerleugen maken (scripts/tikken.js houdt dezelfde regel aan).
   3. HOE EEN DOELGROEP ZICH AANMELDT, VERSCHILT. Een lid, een zaak en het
      kantoor dragen `Authorization: Bearer`; een gezin draagt code+token in het
      LICHAAM en accepteert daarnaast de header. Dat staat hier per doelgroep in
      `draag()`, zodat een aanroeper er niet over hoeft na te denken.
   ========================================================================== */
'use strict';

const { ROLLEN } = require('./proefsessies');

async function post(url, lijf) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lijf || {}) }).catch(() => null);
  if (!r) return null;
  return r.json().catch(() => null);
}

/* De koptekst-drager: verreweg de meeste doelgroepen. */
const viaKop = (t) => ({ kop: { Authorization: 'Bearer ' + t }, lijf: {} });

/* De acht doelgroepen uit server/functies/register/doelgroepen.js, in dezelfde
   volgorde. `haal` geeft een waarde of null; `draag` zegt hoe die waarde in een
   verzoek gaat. */
const DOELGROEPEN = {
  rtg: {
    uitleg: 'een lid met de RTG Pass',
    haal: (basis) => ROLLEN.lid.haal(basis),
    draag: viaKop
  },
  /* Lifestyle en Business worden in dit huis NOOIT zelf aangevraagd -- ze gaan
     via menselijke goedkeuring (CLAUDE.md). De demo-inlog is daarom de enige
     weg aan een proefsessie te komen, en die bestaat alleen met RTG_DEMO. */
  lifestyle: {
    uitleg: 'een lid met de Lifestyle Pass (demo-inlog: deze pas wordt nooit zelf aangevraagd)',
    haal: async (basis) => (await post(basis + '/api/login', { tier: 'lifestyle' }) || {}).token || null,
    draag: viaKop
  },
  business: {
    uitleg: 'een lid met de Business Pass (demo-inlog, zie lifestyle)',
    haal: async (basis) => (await post(basis + '/api/login', { tier: 'business' }) || {}).token || null,
    draag: viaKop
  },
  gast: {
    uitleg: 'de gratis app zonder pas',
    haal: async (basis) => (await post(basis + '/api/login', { tier: 'guest' }) || {}).token || null,
    draag: viaKop
  },
  leverancier: {
    uitleg: 'de manager van een zaak in de partner-app',
    haal: (basis) => ROLLEN.zaak.haal(basis),
    draag: viaKop
  },
  /* Personeel is NIET dezelfde sessie als de leverancier, en dat verschil is de
     hele reden dat het een eigen doelgroep is: functies/doelgroep.js leest
     `sessie.manager` om de twee uit elkaar te houden op de gedeelde werkpaden.
     Een proef die hier de managersessie zou hergebruiken, meet `leverancier`
     twee keer en `personeel` nul keer. */
  personeel: {
    uitleg: 'een medewerker zonder managersrol in dezelfde zaak',
    haal: async (basis) => {
      /* De medewerker wordt KLAARGEZET en niet uit de seed geleend: die draagt
         wel een `staff`-rol maar een andere PIN dan de manager, en raden is geen
         meting. De manager maakt er een aan, en /staff/add geeft de PIN terug --
         dezelfde ingreep als de chauffeur in scripts/ritproef.js. De wereld
         klaarzetten mag; een uitslag klaarzetten niet. */
      const man = await ROLLEN.zaak.haal(basis);
      if (!man) return null;
      const toe = await fetch(basis + '/api/supplier/staff/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + man },
        body: JSON.stringify({ name: 'Proefmedewerker', func: 'bediening' })
      }).then((r) => r.json()).catch(() => null);
      if (!toe || !toe.staff || !toe.pin) return null;
      const r = await post(basis + '/api/supplier/login', { code: 'KIKUNOI', staffId: toe.staff.id, pin: toe.pin });
      return (r && r.token) || null;
    },
    draag: viaKop
  },
  foundation: {
    uitleg: 'de beheerder van een gezin in de RTFoundation',
    haal: (basis) => ROLLEN.gezin.haal(basis),
    /* Twee dragers tegelijk, en dat is met opzet. De foundation-router leest
       code+token uit het LICHAAM (gezinVan/profielVan) en accepteert daarnaast
       de Authorization-kop. Wie er maar een meestuurt, laat de helft van de
       gezinsroutes er onterecht onbereikbaar uitzien -- en dat zou hier als een
       registerleugen worden geteld. */
    draag: (s) => ({ kop: { Authorization: 'Bearer ' + s.token }, lijf: { code: s.code, token: s.token } })
  },
  intern: {
    uitleg: 'een medewerker van RTG met een kantoortoken',
    haal: (basis) => ROLLEN.kantoor.haal(basis),
    draag: viaKop
  }
};

/* Haalt alle (of de gevraagde) doelgroepsessies op tegen een draaiende server.
   Geeft { sessies, overgeslagen }. */
async function haalDoelgroepen(basis, welke) {
  const namen = welke && welke.length ? welke : Object.keys(DOELGROEPEN);
  const sessies = {}, overgeslagen = [];
  for (const naam of namen) {
    const d = DOELGROEPEN[naam];
    if (!d) { overgeslagen.push({ doelgroep: naam, reden: 'onbekende doelgroep' }); continue; }
    let waarde = null, fout = null;
    try { waarde = await d.haal(basis); } catch (e) { fout = String((e && e.message) || e); }
    if (!waarde) { overgeslagen.push({ doelgroep: naam, reden: fout || ('inloggen als ' + naam + ' leverde geen sessie op') }); continue; }
    sessies[naam] = { doelgroep: naam, waarde, uitleg: d.uitleg, draag: () => d.draag(waarde) };
  }
  return { sessies, overgeslagen };
}

module.exports = { DOELGROEPEN, haalDoelgroepen };
