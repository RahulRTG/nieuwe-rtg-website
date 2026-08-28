/* HET CONTRACT: wat is afgesproken, en tot wanneer staat dat vast.

   HET GAT DAT DIT SLUIT. kern/aanmeldingen/betaalschema.js zette bij een akkoord
   twaalf termijnen klaar en hield daarna op. Er was geen maand 13: geen
   verlenging, geen opzegging, geen opzegtermijn. Een lidmaatschap liep dus
   administratief af zonder dat iemand het besloot -- en niemand kon zien of dat
   het einde was of een vergeten regel.

   En er was een tweede, stillere: `test/pasprijs.test.js` toets 6 bewaakt dat
   een prijswijziging in de boardroom OVERAL doorkomt, ook op de factuur van een
   lid met een jaarcontract. Die toets bewaakt iets echts -- drie uiteengelopen
   kopieen van de pasprijs -- maar hij bewaakte tegelijk gedrag dat bij een
   twaalfmaands verbintenis niet hoort.

   DE OPLOSSING IS NIET "GENEREER MEER TERMIJNEN". Dat verplaatst het probleem
   naar maand 25. De billing engine stelt per periode een vraag:

       Is er op deze datum een geldige betalingsverplichting?

   en maakt dan pas een termijn. Maand 13 bestaat vanzelf als het contract
   verlengd is, en bestaat NIET als het is opgezegd. Dat is het verschil tussen
   een lijst die iemand ooit heeft aangemaakt en een afspraak die geldt.

   DE ACHT STANDEN (Engelse namen erbij; de code van dit huis is Nederlands):

     CONCEPT       draft          wordt opgesteld
     AANGEBODEN    offered        ligt bij de klant
     GEACCEPTEERD  accepted       getekend, nog niet begonnen
     ACTIEF        active         loopt
     VERLENGBAAR   renewal_due    de minimumtermijn loopt af; er moet iets gebeuren
     VERLENGD      renewed        verlengd -> gaat terug naar ACTIEF met een nieuwe termijn
     OPZEGGEND     terminating    opgezegd, loopt uit tot de einddatum
     GEEINDIGD     ended          klaar; geen verplichtingen meer

   DE PRIJS IS EEN MOMENTOPNAME. `afgesprokenCenten` wordt bij het tekenen
   vastgelegd en daarna nooit meer uit de prijslijst gehaald. Dat is de regel
   waar dit hele bestand om draait: voor een bestaand contract wordt de actuele
   catalogusprijs NOOIT opnieuw opgehaald. Zou dat wel gebeuren, dan verandert
   met een boardroom-klik het bedrag op de factuur van iemand die iets anders
   heeft getekend.

   `prijsVastTot` is de datum waarop die momentopname mag worden herzien: het
   einde van de minimumtermijn. Besluit van 20 augustus 2026 (COMMERCIE.md 3b):
   een prijswijziging raakt nooit een lopend contract.

   WAT DIT NIET IS: een tweede administratie van wat er betaald is. Dit bestand
   zegt wat er VERSCHULDIGD is en wanneer; of het geld er is, weet het grootboek.
   Dezelfde scheiding als bij ./fee.js. */
'use strict';

/* Tijd komt uit de tijdmachine en niet van het besturingssysteem: alleen zo is
   "wat gebeurt er op 29 februari" een vraag die je kunt stellen (server/lib/klok.js).
   De injecteerbare `nu` blijft bestaan -- toetsen zetten hem -- maar de TERUGVAL
   is de klok en niet Date.now(). */
const klok = require('../../lib/klok');
/* Twee onderwerpen staan apart, en allebei om dezelfde reden: dit bestand is de
   WINKEL. ./contract/vorm.js zegt wat een contract is en welke stap daarna mag;
   ./contract/verplichting.js rekent uit wat er verschuldigd is. */
const { STATUS, OVERGANG, LOPEND, VERLENGING, magOvergaan, maakContract } = require('./contract/vorm');
const { plusMaanden, maakVerplichting } = require('./contract/verplichting');

function maakContracten({ db, save, nu }) {
  const tijd = nu || klok.nu;
  function rij() {
    if (!db.data) db.data = {};
    if (!Array.isArray(db.data.contracten)) db.data.contracten = [];
    return db.data.contracten;
  }
  const vind = id => rij().find(c => c.id === String(id || '')) || null;

  function zet(c, naar, velden) {
    if (!magOvergaan(c.status, naar))
      return { error: 'Een contract kan niet van ' + c.status + ' naar ' + naar + '.' };
    c.status = naar;
    Object.assign(c, velden || {});
    (c.verloop = c.verloop || []).push({ naar, at: tijd() });
    save();
    return { ok: true, contract: c };
  }

  function open(gegevens) {
    const id = 'ctr_' + Math.random().toString(36).slice(2, 10) + '_' + rij().length;
    const c = maakContract({ ...gegevens, id, nu: tijd });
    rij().unshift(c);
    save();
    return c;
  }

  function bied(c) { return c ? zet(c, STATUS.AANGEBODEN) : { error: 'geen contract' }; }
  function accepteer(c, centen) {
    if (!c) return { error: 'geen contract' };
    const bedrag = Number.isFinite(centen) ? Math.round(centen) : c.afgesprokenCenten;
    if (!Number.isFinite(bedrag))
      return { error: 'Een contract zonder afgesproken bedrag kan niet worden geaccepteerd.' };
    return zet(c, STATUS.GEACCEPTEERD, { afgesprokenCenten: bedrag });
  }

  /* ACTIEF worden vraagt een bedrag. Dat is de grendel die voorkomt dat er ooit
     nog een lidmaatschap loopt waarvan niemand weet wat het kost -- het gat dat
     bij Business en Lifestyle bestond voordat de ladder er was. */
  function activeer(c) {
    if (!c) return { error: 'geen contract' };
    if (!Number.isFinite(c.afgesprokenCenten))
      return { error: 'Een contract zonder afgesproken bedrag kan niet actief worden.' };
    return zet(c, STATUS.ACTIEF);
  }

  // de minimumtermijn loopt af: er moet iets gebeuren (verlengen of opzeggen)
  function verlengbaar(c) { return c ? zet(c, STATUS.VERLENGBAAR) : { error: 'geen contract' }; }

  /* Verlengen. De nieuwe prijs mag hier gezet worden -- dit is het ENIGE moment
     waarop de afgesproken prijs mag veranderen, en daarom schuift `prijsVastTot`
     mee. Geen bedrag meegeven betekent: ongewijzigd voortzetten. */
  function verleng(c, nieuwCenten) {
    if (!c) return { error: 'geen contract' };
    if (c.verlenging === VERLENGING.GEEN)
      return { error: 'Dit contract verlengt niet; het eindigt op de afgesproken datum.' };
    /* Vroeg verlengen mag. Een contract dat nog ACTIEF is, gaat dan eerst langs
       VERLENGBAAR -- niet omdat dat administratief moet, maar omdat het verloop
       anders een sprong bevat die de statusmachine verbiedt. Zo blijft
       ACTIEF -> VERLENGBAAR -> VERLENGD -> ACTIEF de enige route, of de
       verlenging nu op tijd komt of eerder. */
    if (c.status === STATUS.ACTIEF) {
      const r0 = zet(c, STATUS.VERLENGBAAR);
      if (r0.error) return r0;
    }
    const r = zet(c, STATUS.VERLENGD, {
      afgesprokenCenten: Number.isFinite(nieuwCenten) ? Math.round(nieuwCenten) : c.afgesprokenCenten,
      periode: (c.periode || 1) + 1,
      prijsVastTot: plusMaanden(c.prijsVastTot, c.minimumMaanden)
    });
    if (r.error) return r;
    return zet(c, STATUS.ACTIEF);
  }

  /* Opzeggen. De einddatum wordt UITGEREKEND en niet ingevoerd: opzegtermijn
     vanaf nu, maar nooit voor het einde van de minimumtermijn -- anders zou
     opzeggen in maand twee de verbintenis van twaalf maanden opheffen. */
  function zegOp(c, opDatum) {
    if (!c) return { error: 'geen contract' };
    const vanaf = opDatum || new Date(tijd()).toISOString();
    const naOpzeg = plusMaanden(vanaf, c.opzegMaanden);
    const minEind = plusMaanden(c.startAt, c.minimumMaanden);
    const eind = new Date(naOpzeg) > new Date(minEind) ? naOpzeg : minEind;
    return zet(c, STATUS.OPZEGGEND, { eindigtOp: eind });
  }

  function beeindig(c) { return c ? zet(c, STATUS.GEEINDIGD, { eindigtOp: c.eindigtOp || new Date(tijd()).toISOString() }) : { error: 'geen contract' }; }

  const { verplichtingOp, termijnenTussen, eindeVerbintenis, verlooptBinnen } =
    maakVerplichting({ LOPEND, VERLENGING, STATUS, rij, tijd });

  function publiek(c) {
    if (!c) return null;
    return { id: c.id, pas: c.pas, aanmeldingId: c.aanmeldingId, status: c.status, periode: c.periode,
      startAt: c.startAt, minimumMaanden: c.minimumMaanden, frequentie: c.frequentie,
      verlenging: c.verlenging, opzegMaanden: c.opzegMaanden,
      maandCenten: c.afgesprokenCenten, prijsVastTot: c.prijsVastTot,
      eindeVerbintenis: eindeVerbintenis(c), eindigtOp: c.eindigtOp, btwProfiel: c.btwProfiel };
  }

  function lijst(filter) {
    filter = filter || {};
    return rij().filter(c => (!filter.pas || c.pas === filter.pas) &&
      (!filter.status || c.status === filter.status) &&
      (!filter.aanmeldingId || c.aanmeldingId === filter.aanmeldingId)).slice(0, 200).map(publiek);
  }

  return { STATUS, VERLENGING, LOPEND, open, vind, bied, accepteer, activeer, verlengbaar,
    verleng, zegOp, beeindig, verplichtingOp, termijnenTussen, eindeVerbintenis,
    verlooptBinnen, publiek, lijst, rij };
}

module.exports = { maakContracten, maakContract, STATUS, VERLENGING, OVERGANG, LOPEND, magOvergaan, plusMaanden };
