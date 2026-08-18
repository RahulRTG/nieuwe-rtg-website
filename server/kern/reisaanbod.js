/* HET REISAANBOD: de enige schrijver van db.data.partnerTrips.

   WAAROM DIT ER IS. Het reisbureau (kern/reisbureau.js) laat leden door de
   samengestelde reizen bladeren en er een aanvragen; het partnerkanaal toont
   dezelfde reizen aan niet-leden. Allebei LEZEN ze db.data.partnerTrips -- en
   niets in dit huis schreef daar ooit iets in. De seed was de enige bron, en
   sinds die zonder RTG_DEMO leeg begint (kern/demostand.js) betekende dat:

     - het reisbureau toont nul reizen,
     - reisbureau.boek() geeft 404 op elke aanvraag ("Reis niet gevonden"),
     - en het reisdossier van het lid (kern/lid/reisdossier.js) krijgt dus nooit
       iets te schrijven.

   Voor een reismembership stond daarmee de kern stil: een scherm dat aanbod
   belooft en een bak die niemand kan vullen is een belofte die de code niet
   waarmaakt (LAT-regel 6). Dit bestand is de deur.

   HET IS KANTOORWERK, EN DAT IS EEN KEUZE. Een reis in de RTG-catalogus is door
   RTG samengesteld -- dat staat zo in de kop van het reisbureau en het is ook
   wat de nettoprijs betekent: wij kochten in. Een partner zet hier dus niets
   neer; de reisadviseur doet dat, aan dezelfde balie waar hij de aanvragen
   bevestigt (routes/kantoren/reizen.js).

   DE VELDNAMEN ZIJN NIET VRIJ. reisAanbod() in kern/reisbureau.js, publicTrip()
   in kern/leverancier.js en de Mall-vindlaag lezen alle drie dezelfde rij:
   id, dest, title, dates, netto, desc, includes, visual. Wie hier een veld
   anders noemt, maakt een reis die in het ene scherm bestaat en in het andere
   leeg is. Daarom schrijft dit bestand precies die namen en niets erbij.

   NOOIT "GEBOEKT". Een reis neerzetten is aanbod maken, geen boeking en geen
   toezegging aan een luchtvaartmaatschappij of hotel; de merkregel dat we geen
   echte merken als bevestigde partner opvoeren geldt hier onverkort. Wat er in
   `includes` staat is wat RTG zelf regelt. */
'use strict';
const klok = require('../lib/klok');

const MAX_REIZEN = 500;

// dezelfde grenzen als het formulier: hier gehandhaafd, want een scherm is
// geen slot
const SNIJ = { title: 80, dest: 60, dates: 60, desc: 600, regel: 120, visual: 40 };

function maakReisaanbod({ db, save, crypto }) {
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const rij = () => (Array.isArray(db.data.partnerTrips) ? db.data.partnerTrips : (db.data.partnerTrips = []));
  const aanvragen = () => (Array.isArray(db.data.reisAanvragen) ? db.data.reisAanvragen : []);

  /* Een leesbare sleutel uit de titel (en anders de bestemming), want die staat
     straks in een link en in een aanvraag. Botst hij, dan komt er een korte
     willekeurige staart achter in plaats van een teller: twee kantoren die
     tegelijk een reis neerzetten krijgen anders dezelfde "monaco-2". */
  function nieuwId(title, dest) {
    const kern = String(title || dest).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reis';
    if (!rij().some(t => t.id === kern)) return kern;
    return kern + '-' + crypto.randomBytes(2).toString('hex');
  }

  /* Het beeld voor het kantoor: de rauwe velden (dus MET de nettoprijs, die een
     lid nooit als inkoop te zien krijgt) plus hoeveel aanvragen eraan hangen.
     Dat laatste staat erbij omdat het de vraag is die je stelt vlak voordat je
     een reis weghaalt. */
  function reisAanbodKantoor() {
    const open = new Map();
    for (const a of aanvragen()) {
      if (!a || a.status !== 'aangevraagd') continue;
      open.set(a.tripId, (open.get(a.tripId) || 0) + 1);
    }
    const lijst = rij().map(t => ({
      id: t.id, titel: t.title, bestemming: t.dest, netto: t.netto,
      dates: t.dates || null, desc: t.desc || null,
      includes: Array.isArray(t.includes) ? t.includes : [],
      visual: t.visual || null,
      door: t.gezetDoor || null, gezet: t.gezetAt || null,
      openAanvragen: open.get(t.id) || 0
    }));
    return { ok: true, aantal: lijst.length, reizen: lijst, valuta: 'EUR' };
  }

  /* Neerzetten of bijwerken. Met een id werk je een bestaande reis bij, zonder
     id komt er een nieuwe. Bijwerken laat weggelaten velden staan: een kantoor
     dat alleen de prijs aanpast, hoort niet de hele beschrijving opnieuw te
     hoeven typen -- en een leeg veld zou anders stilletjes de tekst wissen. */
  function reisAanbodZet(invoer, door) {
    const b = invoer || {};
    const bestaand = b.id ? rij().find(t => t.id === String(b.id)) : null;
    if (b.id && !bestaand) return { status: 404, error: 'Deze reis staat niet in het aanbod.' };

    const title = schoon(b.titel != null ? b.titel : (bestaand && bestaand.title), SNIJ.title);
    const dest = schoon(b.bestemming != null ? b.bestemming : (bestaand && bestaand.dest), SNIJ.dest);
    if (!title) return { status: 400, error: 'Hoe heet deze reis? Een titel is verplicht.' };
    if (!dest) return { status: 400, error: 'Naar welke bestemming gaat deze reis?' };

    /* ONTBREKEN IS NIET NUL. Hier stond `Number(ruwPrijs)` op een ontbrekend
       veld, en Number(null) is 0: een reis zonder prijs kwam er zo als GRATIS
       in te staan, zonder enige melding. Een lege prijs is een vraag die niet
       beantwoord is, geen bedrag. Een uitdrukkelijke 0 mag wel -- dat is een
       keuze die iemand maakt. */
    const gegeven = b.netto != null && String(b.netto).trim() !== '';
    const ruwPrijs = gegeven ? b.netto : (bestaand ? bestaand.netto : null);
    if (ruwPrijs == null)
      return { status: 400, error: 'Vul de nettoprijs per persoon in, in hele euro of met centen.' };
    const netto = Math.round(Number(ruwPrijs) * 100) / 100;
    if (!Number.isFinite(netto) || netto < 0)
      return { status: 400, error: 'Vul de nettoprijs per persoon in, in hele euro of met centen.' };
    if (netto > 1000000) return { status: 400, error: 'Die nettoprijs lijkt niet te kloppen.' };

    const includesRuw = b.includes != null ? b.includes : (bestaand && bestaand.includes);
    const includes = (Array.isArray(includesRuw) ? includesRuw : [])
      .map(r => schoon(r, SNIJ.regel)).filter(Boolean).slice(0, 12);
    const visual = schoon(b.visual != null ? b.visual : (bestaand && bestaand.visual), SNIJ.visual)
      .toLowerCase().replace(/[^a-z0-9-]/g, '') || null;

    const reis = bestaand || { id: nieuwId(title, dest) };
    reis.title = title;
    reis.dest = dest;
    reis.netto = netto;
    reis.dates = schoon(b.dates != null ? b.dates : bestaand && bestaand.dates, SNIJ.dates) || null;
    reis.desc = schoon(b.desc != null ? b.desc : bestaand && bestaand.desc, SNIJ.desc) || null;
    reis.includes = includes;
    reis.visual = visual;
    reis.gezetDoor = String(door || 'reisadviseur').slice(0, 60);
    reis.gezetAt = nu();

    if (!bestaand) {
      if (rij().length >= MAX_REIZEN)
        return { status: 409, error: 'Het aanbod zit vol. Haal eerst een reis weg.' };
      rij().unshift(reis);
    }
    save();
    return { ok: true, reis: { id: reis.id, titel: reis.title, bestemming: reis.dest, netto: reis.netto }, nieuw: !bestaand };
  }

  /* Weghalen, maar niet onder iemand vandaan. Een reis waar nog een open
     aanvraag aan hangt verdwijnt niet: het lid heeft hem in zijn dossier staan
     en de adviseur moet die aanvraag eerst afhandelen. Dat is dezelfde lijn als
     elders in dit huis -- een deur die dichtgaat krijgt een grond, en een
     lopende afspraak verdampt niet stilletjes. */
  function reisAanbodWeg(id, door) {
    const sleutel = String(id || '');
    const i = rij().findIndex(t => t.id === sleutel);
    if (i < 0) return { status: 404, error: 'Deze reis staat niet in het aanbod.' };
    const open = aanvragen().filter(a => a && a.status === 'aangevraagd' && a.tripId === sleutel).length;
    if (open) return { status: 409,
      error: open === 1
        ? 'Er staat nog een open aanvraag voor deze reis. Handel die eerst af; daarna kan hij weg.'
        : 'Er staan nog ' + open + ' open aanvragen voor deze reis. Handel die eerst af; daarna kan hij weg.' };
    const weg = rij()[i];
    rij().splice(i, 1);
    save();
    return { ok: true, id: weg.id, titel: weg.title, door: String(door || 'reisadviseur').slice(0, 60) };
  }

  return { reisaanbod: { reisAanbodKantoor, reisAanbodZet, reisAanbodWeg } };
}

module.exports = { maakReisaanbod };
