/* Foundation OS, deel "casus": de individuele hulpvraag.

   DIT IS DE GEVOELIGSTE MODULE VAN HET HELE OS. Een projectdossier gaat over
   activiteiten; hier gaat het over een mens die iets nodig heeft en dat aan een
   vreemde moet vertellen. Vier keuzes komen daaruit voort, en ze zijn geen van
   alle vrijblijvend:

   1. CODENAAM, NIET DE NAAM. De casus draait op een codenaam, precies zoals de
      rest van RTG. De echte naam en het telefoonnummer staan versleuteld in EEN
      veld (server/kluis.js, AES-256-GCM als RTG_ENC_KEY er is) en worden alleen
      geopend als iemand er expliciet om vraagt -- met een auditregel per blik.
      Een lijst die de namen meteen toont, is een lijst die iedereen leest.

   2. GEEN VELD VOOR WAT NIET MAG. Er is hier geen veld voor gezondheid, geloof,
      schulden-in-detail of gezinssamenstelling. Wel een SOORT (voedsel,
      vervoer, schulden...) en een korte vraag. Wat er geen veld voor is, komt
      ook niet in een export, een rapportage of een gemeenteportaal terecht.
      Dataminimalisatie is een ontwerpkeuze, geen instelling.

   3. TOESTEMMING GAAT VOORAF AAN KOPPELEN. Een hulpvraag mag pas naar een
      lokale partner als de hulpvrager weet dat dat gebeurt en het goed vindt.
      Dat is hier een grendel: koppelen zonder vastgelegde toestemming lukt
      niet, ook niet met de beste bedoelingen en de grootste haast.

   4. EEN BEWAARTERMIJN DIE ER ECHT IS. Bij afronding krijgt de casus een datum
      waarop hij weg mag. De veger (server/bewaartermijnen.js) ruimt hem op; wat
      hier staat is de termijn, niet een voornemen.

   De gemeente ziet hier NIETS van. Wat een gemeente krijgt, staat in rapport.js
   en is geteld, niet gelezen. */

const SOORTEN = ['voedsel', 'kleding', 'schulden', 'vervoer', 'schoolspullen', 'eenzaamheid',
  'huisvesting', 'werk', 'zorgdoorverwijzing', 'digitale_hulp', 'noodhulp'];
const URGENTIE = ['laag', 'middel', 'hoog', 'acuut'];
/* De keten. "gekoppeld" kan naar zichzelf: een hulpvraag wisselt in de praktijk
   van partner (de eerste kan het niet oppakken, iemand gaat weg, het werk hoort
   ergens anders). Dat is geen randgeval maar de normale gang, en zonder die
   overgang zou zo'n wissel buiten het systeem om gaan. */
const KETEN = {
  ontvangen: ['intake', 'afgewezen'],
  intake: ['toestemming', 'afgewezen'],
  toestemming: ['gekoppeld', 'afgewezen'],
  // terug naar "toestemming" is geen omweg maar de weg terug: wie zijn
  // toestemming intrekt en later opnieuw ja zegt, hoort niet in een dood spoor
  // te belanden waarin het dossier alleen nog afgewezen kan worden.
  gekoppeld: ['gekoppeld', 'in_uitvoering', 'toestemming', 'afgewezen'],
  in_uitvoering: ['afgerond'],
  afgerond: ['nazorg'],
  nazorg: [], afgewezen: []
};
// De stappen waarvoor de toestemming op dat moment nog moet staan.
const EIST_TOESTEMMING = ['gekoppeld', 'in_uitvoering'];
const BEWAARDAGEN = 730; // twee jaar na afronding

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, poort, save, kluis } = ctx;

  const vind = id => S().casussen.find(c => c.id === String(id || '')) || null;
  const codenaam = () => 'HV-' + ctx.code('X').split('-')[1].slice(0, 5);

  // Het standaardbeeld: nooit het contact, altijd de codenaam.
  const beeld = c => ({ id: c.id, stad: c.stad, codenaam: c.codenaam, soort: c.soort,
    urgentie: c.urgentie, vraag: c.vraag, status: c.status, wijk: c.wijk,
    toestemming: c.toestemming ? { at: c.toestemming.at, door: c.toestemming.door, tekst: c.toestemming.tekst } : null,
    ingetrokken: c.ingetrokken ? { at: c.ingetrokken.at, reden: c.ingetrokken.reden } : null,
    partnerId: c.partnerId || null, projectId: c.projectId || null,
    stappen: (c.stappen || []).slice(0, 40), bewaarTot: c.bewaarTot || null, at: c.at });

  function lijst(req, stadId, filter) {
    const w = wie(req);
    const g = poort(w, stadId, 'casus.lezen', 'individual_cases');
    if (!g.ok) return g;
    const f = filter || {};
    let rijen = S().casussen.filter(c => c.stad === g.stad.id);
    if (f.status) rijen = rijen.filter(c => c.status === String(f.status));
    if (f.soort) rijen = rijen.filter(c => c.soort === String(f.soort));
    if (f.open === true) rijen = rijen.filter(c => !['afgerond', 'nazorg', 'afgewezen'].includes(c.status));
    return { ok: true, soorten: SOORTEN, urgenties: URGENTIE, keten: KETEN,
      aantal: rijen.length, casussen: rijen.slice(-300).reverse().map(beeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    const soort = String(b.soort || '');
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een soort hulpvraag (' + SOORTEN.join(', ') + ').' };
    const urg = String(b.urgentie || 'middel');
    if (!URGENTIE.includes(urg)) return { status: 400, error: 'Urgentie is laag, middel, hoog of acuut.' };
    const vraag = schoon(b.vraag, 300);
    if (vraag.length < 3) return { status: 400, error: 'Waar gaat de hulpvraag over? Kort en zakelijk; geen medische of financiele details.' };
    if (S().casussen.length >= 200000) return { status: 400, error: 'Het casusregister zit vol.' };
    const contact = schoon(b.contact, 200);
    const c = { id: rid(), stad: g.stad.id, codenaam: codenaam(), soort, urgentie: urg, vraag,
      // de eigen ingang van de hulpvrager (deelnemerportaal.js): de stand van
      // ZIJN vraag, en de knop om zijn toestemming in te trekken
      code: ctx.code('RTFD'),
      wijk: schoon(b.wijk, 60), status: 'ontvangen', toestemming: null, partnerId: null,
      projectId: null, stappen: [], bewaarTot: null,
      // Het enige veld met herleidbare gegevens, en het gaat versleuteld de db in.
      contact: contact ? kluis.versleutel(contact) : null,
      door: w.key, at: nu() };
    S().casussen.push(c);
    audit(w.key, 'casus.maak', c.codenaam, soort + ', urgentie ' + urg);
    save();
    return { ok: true, casus: beeld(c) };
  }

  /* De keten zelf (status + toestemming intrekken) staat in ./casus-keten.js.
     Dat is de plek waar de grendels zitten die deze module dragen -- toestemming
     die bij elke stap opnieuw wordt gelezen, de partner die actief moet zijn, en
     de hulpactie die aan afronden voorafgaat -- en dit bestand liep over de
     10 KB van keuringsregel 13. */
  const keten = require('./casus-keten')(ctx, { vind, beeld, KETEN, EIST_TOESTEMMING, BEWAARDAGEN });

  /* Het dossier zelf -- de stappen en het openen van de contactgegevens -- staat
     in ./casus-dossier.js. Dat is de kant waar echte gegevens van een echt mens
     langskomen, en het hoort met zijn eigen uitleg bij elkaar. */
  const dossier = require('./casus-dossier')(ctx, { vind, beeld });

  return { lijst, maak, status: keten.status, toestemmingWeg: keten.toestemmingWeg,
    toestemmingWegDirect: keten.toestemmingWegDirect,
    stap: dossier.stap, contactOpen: dossier.contactOpen, contactVan: dossier.contactVan,
    vind, beeld, SOORTEN, URGENTIE, KETEN, EIST_TOESTEMMING, BEWAARDAGEN };
};
module.exports.SOORTEN = SOORTEN;
module.exports.KETEN = KETEN;
module.exports.BEWAARDAGEN = BEWAARDAGEN;
