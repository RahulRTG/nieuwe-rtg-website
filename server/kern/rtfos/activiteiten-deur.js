/* Foundation OS, deel "activiteiten-deur": inschrijven, afmelden en inchecken.

   DIT IS DE OCHTEND ZELF: een rij bij de deur, en het moet in een seconde
   kloppen. VOL IS EEN WACHTLIJST, GEEN NEE (met de plaats erbij), en AFMELDEN
   SCHUIFT DE WACHTLIJST OP EN ZEGT WIE. EEN KIND ZONDER TOESTEMMING VAN DE
   OUDERS KOMT ER NIET IN -- een grendel bij het INCHECKEN, want die toestemming
   kan tussen inschrijven en de deur alsnog ontbreken. FOTOTOESTEMMING IS EEN
   APART VELD: nooit afgeleid, zonder invloed op binnenkomen.

   DE INCHECKCODE IS EEN GEHEIM, GEEN VOLGNUMMER (rtfos.activiteit_incheckcode).
   Hij bewijst een inschrijving aan de deur, ook van een kind. Daarom: 128 bits
   (kern/bearercode.js), op schijf alleen de SHA-256 op de inschrijving, kaal
   alleen in het antwoord op het inschrijven en op een nieuwe code
   (/api/rtfos/activiteit/incheckcode, dat de vorige intrekt). Issuer, doel en
   scope, verval aan het eind van de activiteitsdag, max_gebruik 1; afmelden
   trekt hem in. Inschrijven, nieuwe code, afmelden en inchecken lopen in EEN
   collectietransactie op `rtfos` (PostgreSQL: advisory lock + FOR UPDATE), dus
   twee deuren laten een inschrijving een keer binnen en een afmelding wint of
   verliest van een check-in, nooit allebei. Oude kale codes worden niet
   gehonoreerd: de stad maakt een nieuwe. */

const DOEL = 'activiteit-incheck';
const SCOPE = Object.freeze(['rtfos.activiteit.incheck']);

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, audit, wieIn, poortIn, crypto, codelevenscyclus } = ctx;
  const { beeld, ingeschreven, wachtlijst, schuifOp } = eigen;
  const bearer = require('../bearercode')({ crypto, namespace: 'rtfos.activiteit_incheckcode', nu });

  /* Elke deur-handeling is een transactie op de hele rtfos-collectie; de
     legacy-codes gaan er bij de eerste keer af. */
  const transactie = werk => codelevenscyclus.transactie(tx => {
    const staat = tx.staat;
    for (const a of staat.activiteiten || [])
      for (const i of a.inschrijvingen || [])
        if (i && Object.prototype.hasOwnProperty.call(i, 'checkinCode')) { delete i.checkinCode; i.codeLegacy = true; }
    return werk(staat);
  });
  function open(req, id, staat) {
    const a = (staat.activiteiten || []).find(x => x.id === String(id || ''));
    if (!a) return { status: 404, error: 'Deze activiteit bestaat niet.' };
    const w = wieIn(req, staat);
    const g = poortIn(w, a.stad, 'project.beheren', 'events', staat);
    if (!g.ok) return g;
    return { ok: true, a, w };
  }
  // Een nieuwe code maakt de vorige ongeldig; hij leeft tot het eind van de activiteitsdag.
  function geefCode(a, i, door) {
    const vorig = i.checkin_toegang;
    if (vorig) bearer.intrekken(vorig, door, 'nieuwe incheckcode');
    const eind = a.wanneer ? Date.parse(a.wanneer + 'T23:59:59.999Z') : Date.parse(nu()) + 90 * 86400000;
    const g = bearer.maak({ prefix: 'IN', issuer: 'rtg.rtfos.stad', doel: DOEL, scope: SCOPE,
      onderwerp: { soort: 'activiteit-inschrijving', activiteit: a.id, inschrijving: i.id, stad: a.stad },
      geldigMs: eind - Date.parse(nu()), maxGebruik: 1 });
    g.toegang.rotatie = ((vorig && vorig.rotatie) || 0) + 1;
    i.checkin_toegang = g.toegang;
    return g.code;
  }

  // Inschrijven op codenaam, nooit op een naam.
  function inschrijven(req, id, b) {
    b = b || {};
    return transactie(staat => {
      const o = open(req, id, staat);
      if (!o.ok) return o;
      const a = o.a;
      if (!['open', 'vol'].includes(a.status)) {
        return { status: 400, error: 'Deze activiteit staat op "' + a.status + '" en neemt geen inschrijvingen aan.' };
      }
      const codenaam = schoon(b.codenaam, 30);
      if (codenaam.length < 2) return { status: 400, error: 'Onder welke codenaam schrijft deze deelnemer in?' };
      if (!Array.isArray(a.inschrijvingen)) a.inschrijvingen = [];
      if (a.inschrijvingen.some(i => i.codenaam === codenaam && i.status !== 'afgemeld')) {
        return { status: 400, error: codenaam + ' staat al ingeschreven voor deze activiteit.' };
      }
      if (a.inschrijvingen.length >= 20000) return { status: 400, error: 'Deze activiteit zit vol met inschrijvingen.' };
      const minderjarig = b.minderjarig === true;
      const rij = { id: rid(), codenaam, minderjarig,
        // Twee toestemmingen, twee velden. De ene gaat over meedoen, de andere
        // over beeld; ze worden nooit uit elkaar afgeleid.
        oudertoestemming: minderjarig ? b.oudertoestemming === true : true,
        fototoestemming: b.fototoestemming === true,
        checkin_toegang: null, status: 'ingeschreven', door: o.w.key, at: nu() };
      const code = geefCode(a, rij, o.w.key);
      const vol = ingeschreven(a).length >= a.capaciteit;
      if (vol) {
        rij.status = 'wachtlijst';
        a.status = 'vol';
      }
      a.inschrijvingen.push(rij);
      const plaats = rij.status === 'wachtlijst' ? wachtlijst(a).findIndex(i => i.id === rij.id) + 1 : null;
      return { ok: true, eenmalig: true, activiteit: beeld(a),
        inschrijving: { id: rij.id, codenaam, status: rij.status, checkinCode: code,
          toegang: bearer.publiek(rij.checkin_toegang), wachtlijstplaats: plaats },
        bericht: rij.status === 'wachtlijst'
          ? codenaam + ' staat op de wachtlijst, plaats ' + plaats + '. Bij een afmelding schuift hij vanzelf op.'
          : codenaam + ' is ingeschreven.' };
    });
  }

  // Een nieuwe incheckcode (kwijt, gelekt): de vorige opent daarna niets meer.
  function nieuweCode(req, id, inschrijvingId) {
    return transactie(staat => {
      const o = open(req, id, staat);
      if (!o.ok) return o;
      const i = (o.a.inschrijvingen || []).find(x => x.id === String(inschrijvingId || ''));
      if (!i) return { status: 404, error: 'Deze inschrijving bestaat niet.' };
      if (i.status === 'afgemeld' || i.status === 'aanwezig')
        return { status: 409, error: i.codenaam + ' is ' + (i.status === 'aanwezig' ? 'al binnen' : 'afgemeld') + '; er komt geen nieuwe code.' };
      const code = geefCode(o.a, i, o.w.key);
      audit(o.w.key, 'activiteit.incheckcode', o.a.naam, i.codenaam + ', rotatie ' + i.checkin_toegang.rotatie, staat);
      return { ok: true, eenmalig: true, inschrijving: { id: i.id, codenaam: i.codenaam, checkinCode: code,
        toegang: bearer.publiek(i.checkin_toegang) } };
    });
  }

  function afmelden(req, id, inschrijvingId) {
    return transactie(staat => {
      const o = open(req, id, staat);
      if (!o.ok) return o;
      const a = o.a;
      const i = (a.inschrijvingen || []).find(x => x.id === String(inschrijvingId || ''));
      if (!i) return { status: 404, error: 'Deze inschrijving bestaat niet.' };
      if (i.status === 'afgemeld') return { status: 400, error: i.codenaam + ' is al afgemeld.' };
      i.status = 'afgemeld';
      if (i.checkin_toegang) bearer.intrekken(i.checkin_toegang, o.w.key, 'afgemeld');
      const opgeschoven = schuifOp(a);
      audit(o.w.key, 'activiteit.afmelding', a.naam, i.codenaam +
        (opgeschoven.length ? '; opgeschoven: ' + opgeschoven.join(', ') : ''), staat);
      return { ok: true, activiteit: beeld(a), opgeschoven,
        bericht: opgeschoven.length
          ? 'Er is een plek vrij en ' + opgeschoven.join(' en ') + ' schuift op. Laat het weten.'
          : i.codenaam + ' is afgemeld.' };
    });
  }

  /* Inchecken: elke weigering een eigen zin, want aan de deur is "er ging iets
     mis" onbruikbaar. Het zoeken vergelijkt elke hash van deze activiteit met
     timingSafeEqual en stopt niet bij een treffer. */
  function inchecken(req, id, checkinCode) {
    const gezocht = bearer.hash(String(checkinCode || '').slice(0, 80));
    return transactie(staat => {
      const o = open(req, id, staat);
      if (!o.ok) return o;
      const a = o.a;
      let i = null;
      for (const x of a.inschrijvingen || [])
        if (bearer.zelfdeHash(x && x.checkin_toegang && x.checkin_toegang.code_hash, gezocht)) i = x;
      if (!i) return { status: 404, error: 'Deze incheckcode hoort niet bij deze activiteit.' };
      if (i.status === 'afgemeld') return { status: 400, error: i.codenaam + ' heeft zich afgemeld voor deze activiteit.' };
      if (i.status === 'wachtlijst') {
        return { status: 403, error: i.codenaam + ' staat op de wachtlijst en heeft nog geen plek. Meld iemand af of verhoog de capaciteit.' };
      }
      if (i.minderjarig && !i.oudertoestemming) {
        return { status: 403, error: 'Voor ' + i.codenaam + ' staat geen toestemming van de ouders vastgelegd. Zonder die toestemming doet een minderjarige niet mee.' };
      }
      if (i.status === 'aanwezig') return { ok: true, alBinnen: true, activiteit: beeld(a), bericht: i.codenaam + ' was al ingecheckt.' };
      const t = i.checkin_toegang, onderwerp = (t && t.onderwerp) || {};
      const reden = onderwerp.activiteit !== a.id || onderwerp.inschrijving !== i.id ? 'verkeerd-onderwerp'
        : bearer.reden(t, { doel: DOEL, scope: SCOPE });
      if (reden) return { status: 403, error: 'Deze incheckcode is niet meer geldig (' + reden + '). Maak een nieuwe code voor ' + i.codenaam + '.' };
      bearer.gebruik(t);
      i.status = 'aanwezig';
      i.binnenAt = nu();
      if (a.status === 'open' || a.status === 'vol') a.status = 'bezig';
      return { ok: true, activiteit: beeld(a),
        fototoestemming: !!i.fototoestemming,
        bericht: i.codenaam + ' is binnen.' +
          (i.fototoestemming ? '' : ' Let op: geen toestemming voor foto\'s.') };
    });
  }

  return { inschrijven, afmelden, inchecken, nieuweCode };
};
module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
