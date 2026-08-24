/* ============================================================================
   DE LEVENSLOOP VAN EEN TENANT -- opzeggen, bewaren, vernietigen.

   VIER STANDEN EN GEEN ZEVEN. In de plannen stonden er ook 'voorbereiding',
   'proef' en 'beperkt'. Die staan hier niet, en dat is dezelfde regel als bij de
   modus 'sovereign': een toestand die nergens iets afdwingt, leest op een scherm
   als een werkend mechanisme. Wat hier staat, doet ook iets:

     actief      alles werkt
     opzegging   het einde is aangekondigd; alles werkt nog gewoon door
     bewaring    de toegang is dicht, de klok naar vernietiging loopt
     vernietigd  de gegevens zijn weg; alleen het bewijs blijft

   DRIE REGELS DIE NIET TE OMZEILEN ZIJN

   1. UITVOER KAN ALTIJD, ook in bewaring. Er is met opzet nergens een
      voorwaarde die de export van een stand of van een betaalstatus af laat
      hangen: een klant die zijn rekening niet betaalt, verliest zijn geld en
      niet zijn geschiedenis. Zou dat wel mogen, dan is exit-recht een gunst.
   2. VERNIETIGEN KAN NIET VOOR DE TERMIJN EN NIET ONDER EEN BEWARINGSPLICHT.
      Beide worden hier gecontroleerd en niet op het scherm; een knop die
      grijs is, is geen grens.
   3. HET BEWIJS DRAAGT GEEN PERSOONSGEGEVENS. Een vernietigingsbewijs met
      namen erin is een kopie van precies dat wat vernietigd moest worden. Er
      staan aantallen en checksums in, en verder de org, het moment en wie
      tekende.

   BEWARING SLUIT DE TOEGANG DOOR DE SLEUTELS IN TE TREKKEN en niet door een
   vlag te zetten die elke route apart moet lezen. Een lid-token wordt tegen
   l.token gehouden; is die weg, dan is de deur dicht -- overal tegelijk, zonder
   dat er ergens een controle vergeten kan worden. Het beheer-token blijft wel
   werken, want de klant moet zijn uitvoer nog kunnen ophalen.
   ========================================================================== */
'use strict';
const { nu: klokNu, datum: klokDatum } = require('../../lib/klok');

const { schrijf } = require('./journaal');

const STANDEN = ['actief', 'opzegging', 'bewaring', 'vernietigd'];
const DAG = 86400000;
const STANDAARD_BEWAARDAGEN = 90;
const MIN_DAGEN = 30;
const MAX_DAGEN = 3650;

/* Welke stap mag na welke. 'vernietigd' staat bij niemand in de lijst: daar kom
   je alleen via vernietig(), en daar kom je nooit meer vandaan. */
const MAG = {
  actief: ['opzegging'],
  opzegging: ['actief', 'bewaring'],
  bewaring: [],
  vernietigd: []
};

module.exports = ({ db, save, schoon, register, uitgang }) => {
  const nu = () => klokDatum().toISOString();

  function ruimte(code) {
    const w = db.data.werkruimtes || {};
    return Object.prototype.hasOwnProperty.call(w, String(code)) ? w[String(code)] : null;
  }
  function vak(t) {
    if (!t.levensloop) t.levensloop = { stand: 'actief', sinds: t.bij || nu(), legalHold: false, log: [] };
    return t.levensloop;
  }
  function noteer(t, wat, reden, door) {
    const v = vak(t);
    v.log.unshift({ wat, reden: reden || null, door: door || null, at: nu() });
    v.log = v.log.slice(0, 500);
    for (const code of t.werkruimtes) schrijf(ruimte(code), 'levensloop', wat, t.org, reden);
  }

  function stand(org) {
    const t = register.haal(org);
    if (!t) return null;
    const v = vak(t);
    return { org: t.org, stand: v.stand, sinds: v.sinds, legalHold: !!v.legalHold,
      legalHoldReden: v.legalHoldReden || null, bewaarTot: v.bewaarTot || null,
      teVernietigenVanaf: v.bewaarTot || null,
      mag: MAG[v.stand].slice(), log: v.log.slice(0, 50),
      let: 'Uitvoer kan in elke stand behalve "vernietigd" -- ook in bewaring, en ook bij een betalingsachterstand.' };
  }

  /* De sleutels van alle leden intrekken. Draait bij het ingaan van de
     bewaring, en levert het aantal terug zodat het in het bewijs kan. */
  function sluitToegang(t, reden) {
    let n = 0;
    for (const code of t.werkruimtes) {
      const w = ruimte(code);
      if (!w) continue;
      for (const l of Object.values(w.leden || {})) {
        if (!l.token) continue;
        l.token = null;
        if (l.status === 'actief') { l.status = 'uit dienst'; l.uitReden = reden; l.uitAt = nu(); }
        n++;
      }
    }
    return n;
  }

  function zet(org, opdracht) {
    const o = opdracht || {};
    const t = register.haal(org);
    if (!t) return { error: 'Die tenant kennen we niet.', status: 404 };
    const v = vak(t);
    const naar = String(o.naar || '');
    if (!STANDEN.includes(naar)) return { error: 'Een stand is: ' + STANDEN.join(', ') + '.', status: 400 };
    if (naar === 'vernietigd') return { error: 'Vernietigen gaat niet via een standwijziging; daar is een eigen handeling voor, met de termijn en de bewaringsplicht ervoor.', status: 400 };
    if (!MAG[v.stand].includes(naar))
      return { error: 'Van "' + v.stand + '" kan niet naar "' + naar + '".' +
        (MAG[v.stand].length ? ' Wel naar: ' + MAG[v.stand].join(', ') + '.' : ' Deze stand is een eindstand.'), status: 409 };

    const reden = schoon(o.reden, 300);
    if (!reden) return { error: 'Noteer waarom deze stand verandert; een levensloop zonder reden is later niet te reconstrueren.', status: 400 };
    const door = schoon(o.door, 80) || 'eigenaar';

    if (naar === 'bewaring') {
      const dagen = o.bewaardagen == null ? STANDAARD_BEWAARDAGEN : Number(o.bewaardagen);
      if (!Number.isFinite(dagen) || dagen < MIN_DAGEN || dagen > MAX_DAGEN)
        return { error: 'Een bewaartermijn ligt tussen ' + MIN_DAGEN + ' en ' + MAX_DAGEN + ' dagen.', status: 400 };
      v.bewaarTot = new Date(klokNu() + dagen * DAG).toISOString();
      v.bewaardagen = dagen;
      const gesloten = sluitToegang(t, 'Bewaring: ' + reden);
      noteer(t, 'levensloop-bewaring', reden + ' (' + gesloten + ' sleutels ingetrokken, termijn ' + dagen + ' dagen)', door);
    } else {
      if (naar === 'actief') { delete v.bewaarTot; delete v.bewaardagen; }
      noteer(t, 'levensloop-' + naar, reden, door);
    }

    v.stand = naar; v.sinds = nu();
    save();
    return { ok: true, levensloop: stand(org) };
  }

  /* De bewaringsplicht. Staat los van de stand: hij kan in elke stand aan, en
     zolang hij aan staat gebeurt er niets onomkeerbaars. */
  function houdVast(org, aan, reden, door) {
    const t = register.haal(org);
    if (!t) return { error: 'Die tenant kennen we niet.', status: 404 };
    const r = schoon(reden, 300);
    if (aan && !r) return { error: 'Een bewaringsplicht heeft een grond nodig (welke zaak, welk verzoek).', status: 400 };
    const v = vak(t);
    v.legalHold = !!aan;
    v.legalHoldReden = aan ? r : null;
    noteer(t, aan ? 'legal-hold-aan' : 'legal-hold-uit', r || 'opgeheven', schoon(door, 80) || 'eigenaar');
    save();
    return { ok: true, levensloop: stand(org) };
  }

  /* Vernietigen. Drie deuren ervoor, en de laatste is het bewijs: wat er niet
     te bewijzen valt, is niet aantoonbaar gebeurd. */
  /* DE VIER WEIGERINGEN APART: de poort moet ze kunnen stellen ZONDER te
     vernietigen. Geen kopie -- vernietig() roept deze functie zelf aan. */
  function magVernietigen(org, opdracht) {
    const o = opdracht || {};
    const t = register.haal(org);
    if (!t) return { error: 'Die tenant kennen we niet.', status: 404 };
    const v = vak(t);
    if (v.stand !== 'bewaring') return { error: 'Vernietigen kan alleen vanuit de bewaring; deze tenant staat op "' + v.stand + '".', status: 409 };
    if (v.legalHold) return { error: 'Er ligt een bewaringsplicht op deze tenant: ' + (v.legalHoldReden || 'zonder grond genoteerd') + '.', status: 409 };
    if (v.bewaarTot && klokNu() < Date.parse(v.bewaarTot))
      return { error: 'De bewaartermijn loopt tot ' + v.bewaarTot.slice(0, 10) + '. Tot die datum wordt er niets vernietigd.', status: 409 };
    if (!schoon(o.door, 80)) return { error: 'Wie tekent voor deze vernietiging?', status: 400 };
    return { ok: true, tenant: t, vak: v };
  }

  function vernietig(org, opdracht) {
    const o = opdracht || {};
    const mag = magVernietigen(org, o);
    if (mag.error) return mag;
    const t = mag.tenant, v = mag.vak;
    const door = schoon(o.door, 80);

    /* Het bewijs wordt uit de LAATSTE stand gerekend, vlak voor het weghalen --
       niet uit een eerdere export, want dan bewijst het iets over een moment
       waarop er nog geen vernietiging was. */
    const bewijs = { org: t.org, at: nu(), door, werkruimtes: [] };
    for (const code of t.werkruimtes.slice()) {
      const w = ruimte(code);
      if (!w) continue;
      const u = uitgang.exporteer(code);
      bewijs.werkruimtes.push({ code, catalogus: u.ok ? u.uitvoer.catalogus : [], checksum: u.ok ? u.uitvoer.checksum : null });
      delete db.data.werkruimtes[code];
    }
    bewijs.checksum = uitgang.som(bewijs.werkruimtes);
    t.werkruimtes = [];
    v.stand = 'vernietigd'; v.sinds = nu(); v.bewijs = bewijs;
    v.log.unshift({ wat: 'vernietigd', reden: bewijs.werkruimtes.length + ' werkruimte(s)', door, at: bewijs.at });
    save();
    return { ok: true, bewijs,
      let: 'Dit bewijs draagt aantallen en checksums en geen persoonsgegevens. Bewaar het: de gegevens waar het over gaat bestaan niet meer.' };
  }

  return { stand, zet, houdVast, magVernietigen, vernietig, STANDEN, STANDAARD_BEWAARDAGEN };
};
