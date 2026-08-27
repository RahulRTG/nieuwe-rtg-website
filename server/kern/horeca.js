/* RTG Horeca OS (kern): de gedeelde rekenlaag onder het horecasysteem --
   rekeningen, regels, gangen, kortingen, fooi en de bonnen (cadeaubon en
   tegoed). De routes eromheen staan in server/routes/supplier/horeca/.

   Waarom dit een eigen laag is naast de bestaande kassa (`routes/supplier/
   kassa/`): die kassa rekent EEN bon af. Een horecarekening leeft langer dan
   dat -- hij gaat open bij het aanschuiven, verhuist naar een andere tafel,
   wordt samengevoegd met de tafel ernaast, in drieen gesplitst en pas daarna
   betaald. Die levensloop is het verschil tussen een kassa en een
   horecasysteem, en hij hoort op EEN plek te staan (LAT-regel 4).

   Drie regels die hier in de rekensom zitten en niet in een folder:

   1. GELD BLIJFT KLOPPEN. Splitsen en samenvoegen zijn verplaatsingen, geen
      berekeningen: de som van de delen is exact het geheel, tot op de cent.
      `controleerSom()` staat hieronder en wordt door beide gebruikt; als het
      niet klopt, gaat de handeling niet door. Een cent die "wegvalt" bij het
      splitsen is bij duizend bonnen per week een gat dat niemand meer vindt.
   2. FOOI IS NOOIT VOORGEVULD. Er is geen standaardpercentage en geen
      voorgeselecteerde knop; wat er niet expliciet wordt gegeven, wordt niet
      gerekend. Fooi hoort ook niet in de omzet: hij staat apart op de rekening
      en gaat naar het personeel (de verdeling zit in de workforce-laag).
   3. BEDRAGEN IN CENTEN. Een euro als kommagetal is de klassieke manier om er
      twee cent naast te zitten -- en bij een rekening die drie keer gesplitst
      wordt, is dat geen theorie. */
'use strict';

const KANALEN = ['tafel', 'bar', 'club', 'terras', 'afhaal', 'bezorging', 'roomservice',
  'hotelrestaurant', 'foodtruck', 'event', 'kiosk', 'qr', 'online'];
const REGELSTANDEN = ['besteld', 'gestart', 'bereid', 'klaar', 'uitgegeven'];

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const id = (n = 5) => crypto.randomBytes(n).toString('hex');
  /* HEET heleCenten EN NIET `centen`. Hij verandert de eenheid NIET: hij maakt
     van een bedrag een HEEL getal in centen, met een bovengrens. De naam
     `centen` betekende in dit huis drie dingen -- in kern/util.js rondt hij
     euro's af, op vier plekken maakte hij er centen van, en hier doet hij dit.
     Zie de kop van kern/geld/eenheid.js; `uitEuro` hieronder zet wel om. */
  const heleCenten = (v) => Math.round(Math.max(0, Math.min(10000000, Number(v) || 0)));
  const uitEuro = (v) => heleCenten(Math.round((Number(v) || 0) * 100));

  /* De staat per zaak. Bewust per zaakcode en niet een grote lijst met een
     zaakveld erin: een zaak leest en schrijft alleen zijn eigen doos. */
  function H(code) {
    if (!db.data.horeca) db.data.horeca = {};
    const c = String(code || '');
    if (!db.data.horeca[c]) db.data.horeca[c] = { rekeningen: {}, bonnen: {}, instel: {}, wachtrij: [] };
    const h = db.data.horeca[c];
    if (!h.rekeningen) h.rekeningen = {};
    if (!h.bonnen) h.bonnen = {};
    if (!h.instel) h.instel = {};
    if (!Array.isArray(h.wachtrij)) h.wachtrij = [];
    return h;
  }

  // de som van een regel en van een hele rekening, altijd op dezelfde manier
  const regelSom = (r) => heleCenten(r.centen * r.aantal);
  function kortingCenten(rek) {
    const bruto = (rek.regels || []).reduce((t, r) => t + regelSom(r), 0);
    let af = 0;
    for (const k of (rek.kortingen || [])) af += k.procent ? Math.round(bruto * k.procent / 100) : heleCenten(k.centen);
    return Math.min(bruto, af);
  }
  function totaal(rek) {
    const bruto = (rek.regels || []).reduce((t, r) => t + regelSom(r), 0);
    const korting = kortingCenten(rek);
    return { bruto, korting, netto: bruto - korting, fooi: heleCenten(rek.fooiCenten || 0),
      teBetalen: bruto - korting + heleCenten(rek.fooiCenten || 0),
      betaald: (rek.betalingen || []).reduce((t, b) => t + heleCenten(b.centen), 0) };
  }
  const openstaand = (rek) => { const t = totaal(rek); return t.teBetalen - t.betaald; };

  /* De somcontrole die splitsen en samenvoegen eerlijk houdt. Hij vergelijkt
     de NETTO waarde (regels min kortingen) van de delen met die van het
     geheel; fooi en betalingen doen niet mee, want die verhuizen niet.
     Kortingen tellen wel mee: een percentage dat bij het splitsen verdampt, is
     een cadeau dat niemand heeft gegeven. */
  const waarde = (rek) => (rek.regels || []).reduce((s, x) => s + regelSom(x), 0) - kortingCenten(rek);
  function controleerSom(voor, na) {
    const som = (lijst) => lijst.reduce((t, r) => t + waarde(r), 0);
    return som(voor) === som(na);
  }

  /* Happy hour: een tijdvak met een percentage op bepaalde groepen. Bewust
     berekend op het moment van BESTELLEN en niet bij het afrekenen -- anders
     verandert de prijs van een biertje nadat de gast hem heeft besteld, en dat
     is precies het soort verrassing waar mensen boos van worden. */
  function happyKorting(code, groep, wanneer) {
    const h = H(code);
    const lijst = Array.isArray(h.instel.happy) ? h.instel.happy : [];
    const t = wanneer ? new Date(wanneer) : new Date();
    const dag = t.getDay(); // 0 = zondag
    const klok = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    for (const hh of lijst) {
      if (Array.isArray(hh.dagen) && hh.dagen.length && !hh.dagen.includes(dag)) continue;
      if (hh.van && klok < hh.van) continue;
      if (hh.tot && klok > hh.tot) continue;
      if (Array.isArray(hh.groepen) && hh.groepen.length && groep && !hh.groepen.includes(groep)) continue;
      if (Array.isArray(hh.groepen) && hh.groepen.length && !groep) continue;
      return { naam: hh.naam || 'Happy hour', procent: Math.max(0, Math.min(90, Number(hh.procent) || 0)) };
    }
    return null;
  }

  /* ---------- de bonnen: cadeaubon en tegoed ----------
     Een bon is geld dat vooruit is betaald, dus hij kan nooit onder nul en het
     saldo staat op de bon zelf. Bij inwisselen wordt hij AFGEBOEKT voordat de
     betaling wordt genoteerd; andersom zou een dubbele klik twee keer betalen
     met hetzelfde tegoed. */
  function bonMaak(code, { soort, centen: waarde, naam, geldigTot }) {
    const h = H(code);
    let bonCode;
    do { bonCode = crypto.randomBytes(4).toString('hex').toUpperCase(); } while (h.bonnen[bonCode]);
    h.bonnen[bonCode] = { code: bonCode, soort: soort === 'tegoed' ? 'tegoed' : 'cadeaubon',
      uitgegeven: heleCenten(waarde), saldo: heleCenten(waarde), naam: schoon(naam, 60) || null,
      geldigTot: schoon(geldigTot, 10) || null, at: nu(), mutaties: [] };
    save();
    return h.bonnen[bonCode];
  }
  function bonBoek(code, bonCode, bedrag) {
    const h = H(code);
    const b = Object.prototype.hasOwnProperty.call(h.bonnen, String(bonCode || '')) ? h.bonnen[String(bonCode)] : null;
    if (!b) return { status: 404, error: 'Deze bon kennen we niet.' };
    if (b.geldigTot && b.geldigTot < nu().slice(0, 10)) return { status: 409, error: 'Deze bon is verlopen op ' + b.geldigTot + '.' };
    const wil = heleCenten(bedrag);
    if (!wil) return { status: 400, error: 'Vul het bedrag in.' };
    const echt = Math.min(wil, b.saldo);
    if (!echt) return { status: 409, error: 'Deze bon heeft geen saldo meer.' };
    b.saldo -= echt;
    b.mutaties.unshift({ at: nu(), centen: -echt });
    b.mutaties = b.mutaties.slice(0, 50);
    save();
    return { ok: true, geboekt: echt, restVraag: wil - echt, saldo: b.saldo, bon: b.code };
  }

  return { KANALEN, REGELSTANDEN, H, nu, id, heleCenten, uitEuro, regelSom, kortingCenten, waarde,
    totaal, openstaand, controleerSom, happyKorting, bonMaak, bonBoek };
};
