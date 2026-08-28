/* De BTW-AANGIFTE van een zaak (kern/fiscaal/btwaangifte.js).

   De tegenhanger van de loonaangifte (kern/payroll/aangifte.js) en met opzet
   naar hetzelfde model gebouwd: EEN bron, controles die weigeren in plaats van
   waarschuwen, en een ingediende aangifte die niet meer verandert maar een
   correctie krijgt.

   DE BRON IS HET FACTUURREGISTER, en niets anders. Er wordt hier niets opnieuw
   uitgerekend: elke factuurregel draagt zijn eigen tarief sinds
   kern/facturatie/motor.js hem boekte, en dat tarief is wat de klant op zijn bon
   zag staan. Een aangifte die zelf btw berekent is een tweede btw-motor naast de
   facturatiemotor, en twee motoren lopen uiteen -- precies de reden waarom de
   loonaangifte niets naast de loonrun uitrekent. Het tellen zelf staat in
   ./btwtelling.js.

   Dat betekent ook eerlijk zijn over wat er NIET in zit: omzet die nooit een
   factuur kreeg, staat niet in deze aangifte. Daarom telt hij hoeveel facturen
   hij gebruikte en over welk vak, zodat het na te lopen is.

   WIE HEM MAAKT. Anders dan bij de loonaangifte doet de ondernemer dit zelf: hij
   is de belastingplichtige. Dezelfde afspraak als in het btw-draaiboek
   (kern/automatisering.js): controleren en indienen doet de zaak zelf, Rahul
   dient nooit voor iemand in.

   WAT HIER NIET GEBEURT: verzenden. `dienIn` legt vast DAT er is ingediend, door
   wie en met welk kenmerk; de verzending loopt buiten RTG om. Net als bij de
   loonaangifte staat dat er met zoveel woorden bij, zodat niemand denkt dat de
   aangifte de deur uit is omdat hij hier op 'ingediend' staat. */
'use strict';

const { maakBtwTelling, periodeVak } = require('./btwtelling');
const { zekerheid } = require('./zekerheid');

const tussenstand = (vak) => 'De periode loopt nog tot en met ' + vak.tot +
  '. Dit is een tussenstand; indienen kan pas als de periode voorbij is.';

function maakBtwAangifte({ db, save, crypto, nu }) {
  const tijd = nu || (() => new Date().toISOString());
  const vandaag = () => tijd().slice(0, 10);
  const { telFacturen, tarievenPerTarief, controleerRegister } = maakBtwTelling({ db });

  function bak() {
    if (!Array.isArray(db.data.btwAangiftes)) db.data.btwAangiftes = [];
    return db.data.btwAangiftes;
  }
  const vind = (id) => bak().find(a => a.id === id) || null;

  /* ---------- opmaken ---------- */
  /* Een concept mag opnieuw worden opgemaakt zolang de periode loopt: er komen
     facturen bij, en een concept dat de eerste stand vasthoudt is misleidend.
     Een INGEDIENDE aangifte verandert niet meer; daar komt een correctie
     bovenop, die verwijst naar wat hij rechtzet. */
  function maak(zaak, periode, door, opties) {
    opties = opties || {};
    if (!zaak || !zaak.code) return { status: 404, error: 'Deze zaak kennen we niet.' };
    if (!door) return { status: 400, error: 'Noteer wie deze aangifte opmaakt.' };
    const vak = periodeVak(periode);
    if (!vak) return { status: 400, error: 'Geef een periode als 2026K3 (kwartaal) of 2026-07 (maand).' };
    if (vak.van > vandaag()) return { status: 400, error: 'Die periode is nog niet begonnen.' };

    const code = String(zaak.code).toUpperCase();
    const land = (zaak.settings && zaak.settings.land) || 'NL';
    const eerder = bak().filter(a => a.code === code && a.periode === vak.periode);
    const laatste = eerder[0] || null;
    const ingediend = eerder.find(a => a.stand === 'ingediend') || null;
    if (ingediend && !opties.correctie) return { status: 409,
      error: 'Er is al een aangifte over ' + vak.periode + ' ingediend (' + String(ingediend.ingediendOp).slice(0, 10) +
        '). Een tweede aangifte over dezelfde periode telt de Belastingdienst erbovenop; maak een correctie.' };
    if (opties.correctie && !ingediend) return { status: 409,
      error: 'Er is over ' + vak.periode + ' nog niets ingediend, dus er valt niets te corrigeren.' };

    const t = telFacturen(code, vak);
    // de twee weigeringen over het register zelf staan in ./btwtelling.js
    const scheef = controleerRegister(t);
    if (scheef) return scheef;

    /* De aangifte is GETELD en niet geschat; ./zekerheid.js zegt dat met zoveel
       woorden, inclusief waar hij ophoudt (omzet zonder factuur). */
    const cijfers = { zekerheid: zekerheid('btw.aangifte'), tarieven: tarievenPerTarief(t.verkoop, land),
      verschuldigdCenten: t.verkoopSom, voorbelastingCenten: t.voorbelasting,
      saldoCenten: t.verkoopSom - t.voorbelasting,
      verkoopFacturen: t.verkoopAantal, inkoopFacturen: t.inkoopAantal };
    const loopt = vak.tot >= vandaag();

    /* Een concept wordt BIJGEWERKT en niet gedupliceerd -- ook een concept-
       correctie. Twee concepten over dezelfde periode betekent dat er een van
       de twee wordt ingediend en dat niemand weet welke. */
    if (laatste && laatste.stand === 'concept') {
      Object.assign(laatste, cijfers, { periodeLoopt: loopt, bijgewerktOp: tijd(), bijgewerktDoor: door });
      if (ingediend) laatste.verschilCenten = laatste.saldoCenten - ingediend.saldoCenten;
      /* De tussenstand-zin hoort bij een LOPENDE periode. Een concept dat in
         het kwartaal is opgemaakt en na afloop wordt bijgewerkt, zou hem
         anders blijven dragen -- en dan staat er "indienen kan pas als de
         periode voorbij is" boven een aangifte die juist wel ingediend kan
         worden. */
      if (loopt) laatste.let = tussenstand(vak); else delete laatste.let;
      save();
      return { ok: true, bijgewerkt: true, aangifte: laatste };
    }

    const a = Object.assign({
      id: 'btw_' + crypto.randomBytes(5).toString('hex'),
      code, zaak: zaak.name || code, land,
      periode: vak.periode, periodeSoort: vak.soort, van: vak.van, tot: vak.tot,
      soort: opties.correctie ? 'correctie' : 'aangifte',
      corrigeert: ingediend ? ingediend.id : null
    }, cijfers, {
      periodeLoopt: loopt, stand: 'concept',
      opgemaaktDoor: door, opgemaaktOp: tijd(), bijgewerktOp: null, bijgewerktDoor: null,
      ingediendDoor: null, ingediendOp: null, kenmerk: null
    });
    /* Een correctie zonder het verschil erbij dwingt de ondernemer twee schermen
       naast elkaar te leggen om te zien wat hij nu eigenlijk rechtzet. */
    if (ingediend) a.verschilCenten = a.saldoCenten - ingediend.saldoCenten;
    if (loopt) a.let = tussenstand(vak);
    bak().unshift(a);
    if (bak().length > 5000) bak().length = 5000;
    save();
    return { ok: true, aangifte: a };
  }

  /* ---------- indienen ---------- */
  /* Vastleggen DAT er is ingediend, met het kenmerk dat de Belastingdienst
     teruggaf: zonder kenmerk is "ingediend" een bewering zonder bewijs, en dat
     is precies wat je bij een controle nodig hebt. */
  function dienIn(id, door, kenmerk) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Deze aangifte kennen we niet.' };
    if (a.stand === 'ingediend') return { status: 409, error: 'Deze aangifte is al ingediend op ' + a.ingediendOp + '.' };
    if (!door) return { status: 400, error: 'Noteer wie deze aangifte indient.' };
    if (a.tot >= vandaag()) return { status: 409,
      error: 'De periode loopt nog tot en met ' + a.tot + '. Een aangifte over een periode die niet voorbij is, kan niet worden ingediend.' };
    const k = String(kenmerk || '').trim();
    if (k.length < 4) return { status: 400,
      error: 'Noteer het kenmerk dat de Belastingdienst teruggaf. Zonder kenmerk is "ingediend" een bewering zonder bewijs.' };

    /* DE TWEEDE CONTROLE DIE ERTOE DOET. Tussen opmaken en indienen kan er een
       factuur bij zijn gekomen -- een concept van halverwege het kwartaal is
       daarna gewoon verouderd. Indienen op oude cijfers is een verkeerde
       aangifte met een handtekening eronder, dus hier wordt opnieuw geteld en
       geweigerd bij verschil. */
    const t = telFacturen(a.code, { van: a.van, tot: a.tot });
    if (t.verkoopSom !== a.verschuldigdCenten || t.voorbelasting !== a.voorbelastingCenten)
      return { status: 409, error: 'De cijfers zijn veranderd sinds deze aangifte is opgemaakt (nu ' +
        (t.verkoopSom - t.voorbelasting) + ' cent te betalen, in de aangifte ' + a.saldoCenten +
        ' cent). Maak de aangifte opnieuw op en controleer hem.' };

    a.stand = 'ingediend'; a.ingediendDoor = door; a.ingediendOp = tijd(); a.kenmerk = k;
    delete a.let;
    save();
    return { ok: true, aangifte: a,
      let: 'Vastgelegd dat deze aangifte is ingediend. Het verzenden zelf loopt buiten RTG om; dit is de administratie ervan.' };
  }

  /* ---------- teruglezen ---------- */
  const vanZaak = (code, jaar) => bak()
    .filter(a => a.code === String(code || '').toUpperCase() && (!jaar || a.periode.slice(0, 4) === String(jaar)));

  /* `haalBtwAangifte` en niet `haal`: dezelfde reden als in kern/payroll/
     aangifte.js -- `haal` bestaat elders al als top-level naam, en twee
     dezelfde namen naast elkaar is hoe je later de verkeerde te pakken hebt. */
  const haalBtwAangifte = (id) => vind(id);

  return { btwAangifte: { maak, dienIn, vanZaak, haal: haalBtwAangifte, tel: telFacturen, periodeVak } };
}

module.exports = { maakBtwAangifte };
