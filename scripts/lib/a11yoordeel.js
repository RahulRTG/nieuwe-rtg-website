'use strict';

/* HET OORDEEL VAN DE A11Y-SCAN, LOS VAN DE METING.

   WAAROM DIT ER IS

   De scan meet 268 schermen in drie staten plus een raakvlakronde, en dat duurt
   ruim een kwartier -- de op een na langste job in de keten. Opdelen over vier
   runners lag voor de hand en kon NIET, om een reden die het opschrijven waard
   is: het oordeel van deze scan is een BUDGET over de hele ronde ("ingelogd ten
   hoogste N contrastfouten", A11Y-INGELOGD.json, vandaag overal nul). Vier delen
   die elk hun eigen kwart tegen dat hele budget leggen, laten met z'n vieren
   vier keer zoveel door -- en alle vier melden groen. Een meter die zwakker
   wordt van het opdelen is erger dan een trage meter.

   BESTUUR.md zegt waar dat vandaan komt: de laag die iets toont, meet het niet.
   Hier is dat letterlijk de reparatie. Elk deel MEET en schrijft ruwe tellingen
   weg; dit bestand telt ze op en VELT daarna een keer het oordeel, over de hele
   ronde, tegen hetzelfde budget als vroeger. Draait de scan in zijn geheel (zoals
   `npm run a11y` lokaal doet), dan loopt hij door precies dezelfde functie.

   WAT HIER NIET IN ZIT is de meting zelf: geen browser, geen server, geen DOM.
   Daardoor kan test/a11yoordeel.test.js het oordeel laten zakken zonder Chromium,
   en dat is de enige manier waarop deze grens machinaal bewaakt kan worden. */

const raakvlak = require('../raakvlakkeuring');

const RONDES = ['uitgelogd', 'ingelogd', 'zaak'];

/* De delen bij elkaar optellen. Ronden worden op NAAM samengevoegd, niet op
   volgorde: een deel dat een ronde overslaat (geen zaak-sessie te krijgen) mag
   de tellingen van de andere delen niet verschuiven. */
function telOp(delen) {
  const perNaam = new Map();
  let totaal = 0, raakTotaal = 0, paginas = 0;
  for (const d of delen) {
    for (const r of (d.perRonde || [])) {
      const bij = perNaam.get(r.naam) || { naam: r.naam, struct: 0, contr: 0 };
      bij.struct += Number(r.struct || 0);
      bij.contr += Number(r.contr || 0);
      perNaam.set(r.naam, bij);
    }
    totaal += Number(d.totaal || 0);
    raakTotaal += Number(d.raakTotaal || 0);
    paginas += Number(d.paginas || 0);
  }
  /* In de volgorde van RONDES, zodat de afdruk niet van de leesvolgorde van een
     map afhangt; een ronde die er niet was, komt er ook niet bij. */
  const perRonde = RONDES.filter(n => perNaam.has(n)).map(n => perNaam.get(n));
  for (const [naam, r] of perNaam) if (!RONDES.includes(naam)) perRonde.push(r);
  return { perRonde, totaal, raakTotaal, paginas, delen: delen.length };
}

/* Het oordeel zelf. Geeft terug wat er FOUT is (leeg = geslaagd), wat er te
   MELDEN valt (een grens die strakker kan) en de samenvattende regel. Printen en
   afsluiten doet de aanroeper -- een functie die process.exit aanroept is niet
   te toetsen. */
function veld(meting, grens) {
  const perRonde = meting.perRonde || [];
  const totaal = Number(meting.totaal || 0);
  const raakTotaal = Number(meting.raakTotaal || 0);
  const uitgelogd = perRonde.find(r => r.naam === 'uitgelogd') || { struct: 0, contr: 0 };
  const ingelogd = perRonde.find(r => r.naam === 'ingelogd') || { struct: 0, contr: 0 };
  const zaakronde = perRonde.find(r => r.naam === 'zaak') || { struct: 0, contr: 0 };

  const fouten = [];
  if (totaal > 0) fouten.push(`${totaal} structurele overtreding(en) -- die zijn in beide staten hard nul`);
  if (uitgelogd.contr > grens.uitgelogd.contrast)
    fouten.push(`${uitgelogd.contr} contrastfouten uitgelogd, de grens is ${grens.uitgelogd.contrast}`);
  if (ingelogd.contr > grens.ingelogd.contrast)
    fouten.push(`${ingelogd.contr} contrastfouten ingelogd, de grens is ${grens.ingelogd.contrast} -- er is er een BIJGEKOMEN`);
  /* De zaakronde leest zijn eigen grens. Hij staat apart van `ingelogd` omdat
     het andere schermen zijn: alles achter de zaak-inlog. Zou hij bij ingelogd
     worden opgeteld, dan kan een reparatie aan de ene kant een verslechtering
     aan de andere kant maskeren. */
  if (zaakronde.contr > (grens.zaak || {}).contrast)
    fouten.push(`${zaakronde.contr} contrastfouten in de zaakronde, de grens is ${(grens.zaak || {}).contrast} -- er is er een BIJGEKOMEN`);
  /* Het raakvlak leest zijn grens uit hetzelfde register, en zijn oordeel staat
     in raakvlakkeuring.veltRaakvlak -- puur, dus test/raakvlak.test.js kan het
     zonder browser laten zakken. */
  const raakOordeel = raakvlak.veltRaakvlak(raakTotaal, (grens.raakvlak || {}).onder24);
  if (raakOordeel.faalt) fouten.push(raakOordeel.melding.trim().replace(/^\[a11y\] MISLUKT: /, ''));

  const meldingen = [];
  if (!raakOordeel.faalt && raakOordeel.melding) meldingen.push(raakOordeel.melding);
  if (ingelogd.contr < grens.ingelogd.contrast)
    meldingen.push(`\n[a11y] De grens kan strakker: ingelogd ${ingelogd.contr} tegen ${grens.ingelogd.contrast} in A11Y-INGELOGD.json.`);
  if (zaakronde.contr < ((grens.zaak || {}).contrast || 0))
    meldingen.push(`\n[a11y] De grens kan strakker: zaak ${zaakronde.contr} tegen ${(grens.zaak || {}).contrast} in A11Y-INGELOGD.json.`);

  const samenvatting = `\n[a11y] ${meting.paginas} schermen in DRIE staten: uitgelogd, als lid, en als zaak. ` +
    `Structuur nul in alle drie; contrast uitgelogd nul, lid ${ingelogd.contr} (grens ${grens.ingelogd.contrast}), ` +
    `zaak ${zaakronde.contr} (grens ${(grens.zaak || {}).contrast}). ` +
    `Raakvlak op telefoonformaat, lid en zaak: ${raakTotaal} onder ${raakvlak.GRENS}x${raakvlak.GRENS}.`;

  return { fouten, meldingen, samenvatting, uitgelogd, ingelogd, zaakronde, totaal, raakTotaal };
}

module.exports = { RONDES, telOp, veld };
