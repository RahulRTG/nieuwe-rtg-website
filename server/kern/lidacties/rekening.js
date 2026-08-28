/* Lidacties (deelmodule): "De rekening" -- betalen na het eten.

   De zaak laat bestellingen achteraf lopen (betaalMoment 'achteraf'), en aan
   het eind van het bezoek vraagt het lid de rekening op. Alle openstaande,
   achteraf-lopende bonnen bij die zaak worden dan als een rekening opgeteld en
   in een keer afgerekend, met een fooi over het geheel. Aan-de-balie-bonnen
   tellen niet mee (die worden aan de kassa voldaan) en vooraf-bonnen evenmin
   (die zijn al bij het plaatsen betaald).

   Verbatim afgesplitst van bestellen.js zodat beide modules in de 5-10 KB-band
   blijven; de gedeelde context komt een keer bij het opstarten binnen. */
const subsidie = require('../commercie/subsidie');

module.exports = (ctx) => {
  const { save, findSupplier, ordersVanKlant, fooiUit, pasTegoedToe, verdienPunten,
    ledenvoordeelVoor, keuken, notifySupplier, sseToSupplier, sseToOffice, factuurVoorLid } = ctx;
  const { regelsVanItems } = require('./factuur');
  const { rekenAf } = require('./afrekenen')(ctx);

  /* Een bedrag over posten verdelen zonder een cent te verliezen of te
     scheppen: ieder krijgt zijn hele deel, en de restcenten gaan naar de posten
     met de grootste rest. De som is per definitie het totaal. Zelfde rekenwijze
     als bij het splitsen van een rekening tussen vrienden, en om dezelfde reden:
     3,34 + 3,33 + 3,33 en niet 3,33 + 3,33 + 3,33. */
  function verdeel(totaal, gewichten) {
    const som = gewichten.reduce((n, g) => n + g, 0);
    if (!(totaal > 0) || !(som > 0)) return gewichten.map(() => 0);
    const ruw = gewichten.map(g => (totaal * g) / som);
    const heel = ruw.map(x => Math.floor(x));
    let rest = totaal - heel.reduce((n, x) => n + x, 0);
    const orde = ruw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
    for (let k = 0; k < orde.length && rest > 0; k++, rest--) heel[orde[k].i]++;
    return heel;
  }

  function lopendeBonnen(session, code) {
    const s = findSupplier(code);
    if (!s) return { s: null, bonnen: [] };
    const bonnen = ordersVanKlant(session.key).filter(o =>
      o.supplierCode === s.code && !o.paid && o.betaalMoment === 'achteraf' && !o.aanBalie &&
      !['terugbetaald', 'geannuleerd', 'geweigerd'].includes(o.status));
    return { s, bonnen };
  }

  function rekeningVoor(session, body) {
    const { s, bonnen } = lopendeBonnen(session, body.supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    const subtotaal = bonnen.reduce((n, o) => n + (o.total || 0), 0);
    return {
      ok: true,
      rekening: {
        supplierCode: s.code, supplierName: s.name,
        aantal: bonnen.length,
        tafel: (bonnen.find(o => o.table) || {}).table || '',
        regels: bonnen.map(o => ({ ref: o.ref, at: o.at, total: o.total, items: (o.items || []).map(it => ({ name: it.name, qty: it.qty, price: it.price })) })),
        subtotaal
      }
    };
  }

  async function betaalRekeningVoor(session, body) {
    const { s, bonnen } = lopendeBonnen(session, body.supplierCode);
    if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
    if (!bonnen.length) return { status: 404, error: 'Er staat geen lopende rekening open bij deze zaak.' };
    const subtotaal = bonnen.reduce((n, o) => n + (o.total || 0), 0);
    const fooi = fooiUit(body, subtotaal);
    const nu = new Date().toISOString();
    /* WAT ER STOND, VOORDAT ER IETS VERANDERT. De lus hieronder zet de bonnen
       alvast op betaald omdat de bedragen (korting, voordeel) daaruit volgen;
       lukt de betaling daarna niet, dan moet alles terug naar precies deze
       stand. Herstellen uit een momentopname en niet met `delete`: een bon kan
       al een fooi of een korting dragen, en die hoort dan niet weg te vallen
       omdat een andere betaling misging. */
    const voorstand = bonnen.map(o => ({ paid: o.paid, paidAt: o.paidAt, status: o.status,
      rekeningVoldaan: o.rekeningVoldaan, puntenKorting: o.puntenKorting,
      regieKorting: o.regieKorting, fooi: o.fooi }));
    let korting = 0, voordeel = 0;
    bonnen.forEach((o, i) => {
      // puntentegoed van het lid (RTG legt bij) en het ledenvoordeel per genre
      const k = pasTegoedToe(session.key, o.total);
      if (k) { o.puntenKorting = k; korting += k; }
      const v = ledenvoordeelVoor(s, o.total - k);
      if (v) { o.regieKorting = v; o.voordeelOpbouw = subsidie.opbouwVan(o.total - k, v); voordeel += v; }
      o.paid = true;
      o.paidAt = nu;
      o.betaaldMet = 'app'; // de werkelijke betaalwijze, voor de dagafsluiting (TAKEN.md 4.59)
      o.rekeningVoldaan = true; // afgerekend als deel van een gezamenlijke rekening
      if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
      // de fooi voor het team komt een keer op de rekening (op de eerste bon)
      if (i === 0 && fooi) o.fooi = (o.fooi || 0) + fooi;
      verdienPunten(session.key, o.total - k - v, o.supplierName);
      // betaald = definitief: het keukenbrein boekt de ingredienten af
      try { keuken.boekVerkoopAf(s, o.items || [], 'rekening ' + o.ref); } catch (e) {}
      /* EEN FACTUUR PER BON, niet een per rekening. De bon is wat de
         boekhouding telt (elke order apart, op zijn eigen ref), dus een
         verzamelfactuur zou de omzet wel goed optellen maar niet meer
         terug te leiden zijn naar de bestelling die hem veroorzaakte.
         De fooi staat er bewust NIET op: die gaat naar het team en is geen
         omzet van de zaak -- de maandboekhouding telt hem ook niet mee. */
      factuurVoorLid({ supplierCode: o.supplierCode, supplierNaam: o.supplierName,
        codenaam: o.customerCodename, ref: o.ref, methode: 'rtg', regels: regelsVanItems(o.items) });
    });
    /* HET GELD, EN PAS DAARNA `save`. EEN betaling voor de hele rekening en niet
       een per bon: het lid rekent een keer af, dus er hoort een boeking tegenover
       te staan -- anders staat er bij een rekening van vijf bonnen vijf keer
       iets in het grootboek van de zaak voor een moment dat een keer bestond.
       De bonnen dragen wel elk hun eigen factuur; dat is de boekhouding, dit is
       de kas. */
    const geld = await rekenAf({ session, supplierCode: s.code, supplierNaam: s.name,
      bedrag: subtotaal, fooi, korting, voordeel, soort: 'rekening',
      ref: bonnen[0].ref, idem: 'rekening:' + bonnen.map(o => o.ref).join(',') });
    if (geld.error || geld.herhaald) {
      /* Niets is doorgegaan, dus alles terug: de bonnen stonden al op betaald in
         het geheugen. Zonder deze regel is een mislukte betaling een rekening
         die betaald LIJKT en het niet is -- precies de fout die deze ronde
         wegneemt, dan andersom.
         EEN HERHALING HOORT HIER OOK, en om dezelfde reden als bij de
         bestelling (zie ./betalen.js): twee tikken tegelijk glippen allebei
         langs de grendel, het geld gaat een keer, maar de markers, de facturen
         en het bericht aan de zaak zouden twee keer gezet worden. */
      bonnen.forEach((o, i) => {
        for (const [veld, waarde] of Object.entries(voorstand[i])) {
          if (waarde === undefined) delete o[veld]; else o[veld] = waarde;
        }
      });
      return geld.error ? geld : { status: 409, error: 'Deze rekening is al betaald.' };
    }
    /* DE MARKER OP ELKE BON, EN NIET ALLEEN OP DE EERSTE.

       Een rekening wordt in EEN keer betaald, maar annuleren gaat per BON
       (ervaring/leden/annuleren.js). Zou de marker alleen op bonnen[0] staan,
       dan meldt het annuleren van bon twee "geld retour" zonder dat er iets
       terugkomt -- precies de fout die deze ronde wegneemt, maar dan andersom --
       en zou het annuleren van bon een de HELE rekening terugboeken voor een
       enkele bon.

       Verdelen gebeurt met de grootste-restmethode over wat er ECHT is
       geboekt, zodat de som van de markers exact gelijk is aan de betaling.
       Naar rato afronden per bon zou een cent kunnen laten liggen of scheppen,
       en dan klopt de terugweg niet meer met de heenweg. */
    const gewicht = bonnen.map((o, i) => Math.round(((o.total || 0) + (i === 0 ? fooi : 0)) * 100));
    const zelfDeel = verdeel(geld.betaaldCenten, gewicht);
    const bijDeel = verdeel(geld.bijgelegdCenten, gewicht);
    bonnen.forEach((o, i) => { o.payBetaaldCenten = zelfDeel[i]; o.payBijgelegdCenten = bijDeel[i]; });
    save();
    const aantalItems = bonnen.reduce((n, o) => n + (o.items || []).reduce((m, it) => m + it.qty, 0), 0);
    const eerste = bonnen[0];
    notifySupplier(s.code, { icon: 'rekening', title: 'Rekening voldaan', body: eerste.customerCodename + (eerste.table ? ' · ' + eerste.table : '') + ', ' + bonnen.length + ' bon(nen), ' + aantalItems + ' item(s), € ' + subtotaal + (fooi ? ' · fooi € ' + fooi : '') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
    /* WAT HET LID BETAALT IS NIET HET SUBTOTAAL. Hier stond `betaald: subtotaal
       + fooi`, terwijl er twee kortingen boven waren verrekend: het puntentegoed
       van het lid en het RTG-ledenvoordeel. Het scherm toonde ze als aftrekposten
       en het gerapporteerde bedrag negeerde ze allebei -- dus de rekening klopte
       niet met zichzelf.

       De zaak ontvangt WEL het volle subtotaal: dat is de belofte, en het
       verschil legt RTG bij (kern/commercie/subsidie.js). Beide bedragen staan
       er nu apart, want ze zijn allebei waar en ze zijn niet hetzelfde. */
    const lidBetaalt = Math.round((subtotaal - korting - voordeel + fooi) * 100) / 100;
    return { ok: true, bijgeladen: geld.bijgeladen || 0, rekening: { supplierName: s.name, aantal: bonnen.length, subtotaal, fooi,
      puntenKorting: korting, regieKorting: voordeel,
      betaald: lidBetaalt,
      zaakOntvangt: subtotaal,
      rtgLegtBij: voordeel,
      refs: bonnen.map(o => o.ref) } };
  }

  return { rekeningVoor, betaalRekeningVoor };
};
