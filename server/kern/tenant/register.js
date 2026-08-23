/* ============================================================================
   DE TENANT SPINE -- welke van onze codes IS de klant.

   Dit huis had drie codes die alle drie "de klant" leken te betekenen, en dat
   is er twee te veel. Zolang dat zo blijft, kan niemand een vraag als "welke
   werkruimtes vallen onder dit contract" beantwoorden zonder te gokken.

   HIER LIGGEN DE VIER BETEKENISSEN VAST, EN ER KOMT ER GEEN VIJFDE BIJ:

     org (deze module)   de juridische, beveiligings- en contractgrens
     werkruimtecode W... een WorkOS-productinstantie binnen die organisatie
     leverancierscode    een zakelijke relatie of kanaal -- NOOIT een identiteit
     RTG-account         een mens

   WAAROM org EN NIET EEN NIEUW ID. `org` bestond al: het is de sleutel van
   sso_koppelingen, en dus al de grens waarlangs identiteit en domeinbezit zijn
   geregeld (zie sso/koppelingen.js -- wie een domein op die lijst zet, neemt de
   zeggenschap over elk account op dat domein over). Een vierde identiteitsmodel
   erbij verzinnen zou betekenen dat de contractgrens en de inloggrens twee
   verschillende dingen worden, en dan is de vraag "mag deze persoon hier bij"
   op twee plekken te beantwoorden. Dat is precies de fout van LAT-regel 4.

   Een tenant KAN zonder SSO bestaan: niet elke klant heeft een IdP. De koppeling
   is dan simpelweg afwezig; de org blijft de grens.

   WAAROM DIT BIJ DE EIGENAAR LIGT EN NIET BIJ DE KLANT. Dezelfde reden als bij
   kern/webmerk.js: een werkruimte die zichzelf aan een tenant kan hangen, kan
   zichzelf aan ANDERMANS tenant hangen -- en dan leest het merk, straks het
   contract en daarna de export van de een die van de ander. De routes staan
   daarom achter techAuth + eigenaarAlleen (routes/techniek/tenant.js).

   DRIE DINGEN DIE DEZE MODULE BEWUST NIET DOET. Er staat hier geen
   levenscyclus-toestand (proef, opzegging, bewaring), geen abonnement en geen
   quotum. Die staan in TAKEN.md als open punten, want een veld dat een
   toestand beweert die nergens wordt afgedwongen, is erger dan geen veld: het
   leest als een werkend mechanisme. Wat hier wel staat, wordt hier ook
   gehandhaafd. */
'use strict';

const ORG = /^[A-Z0-9][A-Z0-9-]{1,30}$/;

module.exports = ({ db, save, schoon, findSupplier, contract }) => {
  function pot() {
    if (!db.data.tenants || typeof db.data.tenants !== 'object') db.data.tenants = {};
    return db.data.tenants;
  }
  const nu = () => new Date().toISOString();
  const norm = (c) => String(c || '').trim().toUpperCase();
  /* Eigen veld, geen prototype: pot() is een gewoon object en "constructor" is
     een geldige tekenreeks voor een gebruiker die iets probeert. */
  const eigen = (o, k) => (Object.prototype.hasOwnProperty.call(o, String(k)) ? o[String(k)] : null);

  function haal(org) { return eigen(pot(), norm(org)); }
  function lijst() {
    return Object.values(pot()).map(t => ({
      org: t.org, naam: t.naam, modus: t.modus, actief: t.actief !== false,
      werkruimtes: t.werkruimtes.length, zaken: t.zaken.length,
      groepen: t.groepen.length, merk: !!t.merk, bij: t.bij
    }));
  }

  /* ---------- de drie presentatiemodi ----------
     Ze zijn een CONTRACT en geen thema-instelling: ze zeggen hoeveel van RTG de
     medewerker van de klant nog ziet. Twee ervan kan dit huis waarmaken.

     'sovereign' kan het niet, en die weigert daarom met de reden erbij. Er is
     geen externe hosting, geen certificaat-machinerie voor domeinen van derden
     en geen routering op hostnaam; kern/webmaker.js legt vast dat het eigen web
     met opzet op naam.rtg binnen het ecosysteem blijft, en TAKEN 4.21 zet de
     volgorde die daarvoor eerst genomen moet worden. Een modus die je kunt
     kiezen terwijl geen enkele regel code hem bedient, is de belofte-zonder-code
     van LAT-regel 6 -- en juist bij een verkoopbaar contract is dat de duurste
     soort. Hij staat hier met naam en niet als ontbrekende regel: weglaten leest
     als vergeten, weigeren met een reden leest als een besluit. */
  const MODI = ['powered', 'private'];
  const SOVEREIGN_WAAROM =
    'De modus "sovereign" belooft een eigen domein, eigen sleutels en een eigen runtime. ' +
    'Dit huis heeft geen externe hosting, geen certificaat-machinerie voor domeinen van derden ' +
    'en geen routering op hostnaam. Eerst het besluit OF wij extern gaan hosten, dan certificaten, ' +
    'dan routering op hostnaam, en pas dan deze modus. Zie TAKEN 4.21.';

  function leesModus(waarde, huidig) {
    if (waarde == null) return { modus: huidig || 'powered' };
    const m = String(waarde).toLowerCase();
    if (m === 'sovereign') return { error: SOVEREIGN_WAAROM, status: 400 };
    if (!MODI.includes(m)) return { error: 'Een modus is "powered" of "private".', status: 400 };
    return { modus: m };
  }

  /* ---------- de tenant zelf ---------- */
  function zet(opdracht) {
    const o = opdracht || {};
    const org = norm(o.org);
    if (!ORG.test(org)) return { error: 'Een org is 2 tot 31 tekens: hoofdletters, cijfers en streepjes.', status: 400 };
    const p = pot();
    const bestond = eigen(p, org);
    const m = leesModus(o.modus, bestond && bestond.modus);
    if (m.error) return m;
    const naam = schoon(o.naam, 80);
    if (!bestond && !naam) return { error: 'Hoe heet deze organisatie?', status: 400 };
    const t = bestond || { org, werkruimtes: [], zaken: [], groepen: [], merk: null, bij: nu() };
    if (naam) t.naam = naam;
    t.modus = m.modus;
    if (o.actief != null) t.actief = o.actief !== false;
    t.bij = nu();
    p[org] = t;
    save();
    return { ok: true, tenant: uit(t) };
  }

  function uit(t) {
    return { org: t.org, naam: t.naam, modus: t.modus, actief: t.actief !== false,
      werkruimtes: t.werkruimtes.slice(), zaken: t.zaken.slice(),
      groepen: t.groepen.map(g => ({ ...g })), merk: t.merk || null, bij: t.bij };
  }

  /* ---------- de bindingen ----------
     Eén werkruimte hoort bij hooguit EEN tenant, en dat is geen netheid maar de
     kern: twee tenants die dezelfde werkruimte opeisen, geven een werkruimte
     waarvan het merk, en straks het contract en de export, afhangt van wie er
     het laatst schreef. Dezelfde regel die kern/webmerk.js al voor vestigingen
     hanteert; hij staat hier opnieuw omdat het hier over een andere grens gaat
     en een gedeelde helper de twee zou laten meebewegen. */
  function bind(org, soort, code, aan) {
    const t = haal(org);
    if (!t) return { error: 'Die tenant kennen we niet.', status: 404 };
    const c = norm(code);
    if (!c) return { error: 'Welke code wilt u koppelen?', status: 400 };
    const veld = soort === 'zaak' ? 'zaken' : 'werkruimtes';

    if (aan) {
      if (soort === 'zaak') {
        if (!findSupplier || !findSupplier(c)) return { error: 'Deze zaak kennen we niet.', status: 404 };
      } else if (!eigen(db.data.werkruimtes || {}, c)) {
        return { error: 'Die werkruimte kennen we niet.', status: 404 };
      }
      const ander = Object.values(pot()).find(x => x.org !== t.org && x[veld].includes(c));
      if (ander) return { error: 'Deze code hoort al bij de tenant ' + ander.org + '.', status: 409 };
      /* De contractgrens staat HIER en niet in de route: een controle in een
         route is een controle die de volgende aanroeper mist. Alleen op
         werkruimtes -- een zaak is een relatie en geen productinstantie, en
         daar rekenen we niet voor. */
      if (veld === 'werkruimtes' && contract && !t[veld].includes(c)) {
        const mag = contract.magWerkruimteErbij(t.org);
        if (!mag.ok) return { error: mag.reden, status: 402 };
      }
      if (!t[veld].includes(c)) t[veld].push(c);
    } else {
      t[veld] = t[veld].filter(x => x !== c);
    }
    t.bij = nu();
    save();
    return { ok: true, tenant: uit(t) };
  }

  /* Andersom lezen. Hier hangt de hele runtime aan: een werkruimte moet kunnen
     vragen "onder welk contract val ik", zonder alle tenants te kennen. */
  function vanWerkruimte(code) {
    const c = norm(code);
    return Object.values(pot()).find(t => t.werkruimtes.includes(c)) || null;
  }
  function vanZaak(code) {
    const c = norm(code);
    return Object.values(pot()).find(t => t.zaken.includes(c)) || null;
  }

  return { haal, lijst, zet, bind, vanWerkruimte, vanZaak, uit, MODI, SOVEREIGN_WAAROM };
};
