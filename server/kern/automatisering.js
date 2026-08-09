/* De automatiseringen ("draaiboeken") van RTG: kleine, herbruikbare stappen die
   over de RTMAIL-rail lopen. Elk draaiboek BEREIDT VOOR en BERICHT; alles wat
   geld uitgeeft of toegang/een baan verleent blijft langs de bestaande poorten
   lopen waar een mens beslist -- zo blijft de automatisering risicoloos.

   Privacy by design: RTMAIL draait op codenamen. De draaiboeken zetten daarom
   geen echte namen in de berichten (die blijven in de kluis); een welkomstwoord
   is warm maar zonder naam.

   Dit begint met het welkom-draaiboek voor elk nieuw lid (RTG en RTF). Volgende
   draaiboeken (personeel, inkoop, facturen, overheid) komen hier stap voor stap
   bij, elk met een eigen test. */
const { maakBtwTelling, periodeVak, vorigeBtwPeriode } = require('./fiscaal/btwtelling');

module.exports = ({ rtmail, db, nu }) => {
  const klok = () => (nu ? nu() : new Date().toISOString()).slice(0, 10);
  const telling = db ? maakBtwTelling({ db }) : null;
  // Een nieuw lid krijgt meteen een welkom in zijn eigen RTMAIL-postvak. Geeft
  // het bezorgde bericht terug (of null als er geen bruikbaar adres is).
  function welkomLid({ codename, wereld } = {}) {
    const adres = rtmail.normAdres(codename);
    if (!adres) return null;
    const merk = wereld === 'RTF' ? 'de RTFoundation' : 'Rahul Travel Group';
    const tekst = 'Welkom bij ' + merk + '. Je account staat live en dit is je eigen RTMAIL-postvak ' +
      'binnen het platform -- hier houd ik je op de hoogte en regel ik dingen voor je. Fijn dat je er bent. -- Rahul';
    return rtmail.systeemStuur(adres, 'Welkom bij ' + merk, tekst, 'welkom');
  }

  // Personeel-draaiboek: een nieuwe sollicitatie zet een seintje in het RTMAIL-
  // postvak van de zaak. Codenaam-privacy: geen echte naam, alleen de codenaam
  // en de functie; de kandidaat en het cv staan in de sollicitatie-lijst. Het
  // aannemen (een baan geven) blijft de zaak zelf, langs de bestaande poort.
  function sollicitatieBinnen({ zaakCode, functie, codename } = {}) {
    const adres = rtmail.normAdres(zaakCode);
    if (!adres) return null;
    const f = functie ? (' als ' + String(functie).slice(0, 60)) : '';
    const wie = codename ? ' (codenaam ' + String(codename).slice(0, 40) + ')' : '';
    const tekst = 'Er is een nieuwe sollicitatie binnen' + f + wie + '. Bekijk de kandidaat en het cv ' +
      'bij Team / sollicitaties. Aannemen of afwijzen beslist u zelf.';
    return rtmail.systeemStuur(adres, 'Nieuwe sollicitatie', tekst, 'personeel');
  }

  // Facturen-draaiboek: een geboekte factuur zet een seintje in het RTMAIL-
  // postvak van beide kanten -- de verkoper (zaak) en de koper (lid op codenaam,
  // of een andere zaak). De factuur zelf staat al in de facturen-app; RTMAIL is
  // het seintje. Bedragen worden in hele euro's afgerond in het onderwerp.
  function factuurGeboekt({ verkoperCode, verkoperNaam, koperCodenaam, koperZaakCode, nummer, totaal } = {}) {
    const nr = nummer ? ('#' + String(nummer).slice(0, 40)) : 'een factuur';
    const bedrag = (totaal != null && isFinite(totaal)) ? ' (EUR ' + Number(totaal).toFixed(2) + ')' : '';
    const uit = [];
    if (verkoperCode) uit.push(rtmail.systeemStuur(rtmail.normAdres(verkoperCode),
      'Factuur geboekt ' + nr, 'Je factuur ' + nr + bedrag + ' is geboekt. Je vindt hem terug in de facturen-app.', 'factuur'));
    // de koper: een lid (codenaam) of een andere zaak (zaakcode)
    const koper = koperCodenaam || koperZaakCode;
    if (koper) uit.push(rtmail.systeemStuur(rtmail.normAdres(koper),
      'Nieuwe factuur ' + nr, 'Er is een nieuwe factuur ' + nr + bedrag + ' van ' + (verkoperNaam ? String(verkoperNaam).slice(0, 60) : 'een RTG-partner') +
      '. Je vindt hem in de facturen-app. Betalen doe je zelf, wanneer het jou uitkomt.', 'factuur'));
    return uit.filter(Boolean);
  }

  // Inkoop-draaiboek: Rahul (of de zaak) stelt een CONCEPT-inkooporder op en
  // bezorgt hem via RTMAIL bij de groothandel, met een kopie in het eigen
  // postvak. De bestelling zelf (het geld) wacht op het akkoord van de zaak --
  // het draaiboek bestelt nooit uit zichzelf.
  function inkoopVoorstel({ zaakCode, groothandelCode, regels } = {}) {
    const naar = rtmail.normAdres(groothandelCode);
    const eigen = rtmail.normAdres(zaakCode);
    if (!naar || !eigen) return null;
    const lijst = (Array.isArray(regels) ? regels : []).slice(0, 40)
      .map(r => '- ' + (r.aantal ? (Number(r.aantal) + 'x ') : '') + String(r.wat || r.omschrijving || 'artikel').slice(0, 80)).join('\n');
    const body = 'Concept-inkooporder van ' + eigen + ':\n' + (lijst || '(geen regels opgegeven)') +
      '\n\nDit is een concept; de zaak bevestigt de bestelling zelf. Reageer gerust met een prijsopgave.';
    const naarGroot = rtmail.systeemStuur(naar, 'Concept-inkooporder', body, 'inkoop');
    const kopie = rtmail.systeemStuur(eigen, 'Inkoopvoorstel klaargezet',
      'Rahul heeft een concept-inkooporder naar ' + naar + ' klaargezet. Bekijk en bevestig de bestelling zelf; er is nog niets besteld of betaald.', 'inkoop');
    return [naarGroot, kopie].filter(Boolean);
  }

  /* Overheid-draaiboek: DE BTW-HERINNERING.

     Het bedrag stond hier in een parameter, en de route haalde hem uit het
     verzoek. Dat is precies de fout die de btw-aangifte kwam oplossen, alleen
     dan in een e-mail: een tweede getal naast het factuurregister, en dus een
     herinnering die iets anders zegt dan de aangifte waar hij naar verwijst.
     Nu telt het draaiboek zelf, met dezelfde routine als de aangifte.

     HIJ HERINNERT ALLEEN ALS ER IETS TE HERINNEREN VALT. Is er over het tijdvak
     al ingediend, of viel er niets aan te geven, dan gaat er geen bericht. Een
     draaiboek dat ook mailt als alles op orde is, leert de ondernemer zijn post
     te negeren -- en dan mist hij de keer dat het wel moest.

     De aangiftetermijn is een maand na afloop van het tijdvak (art. 10 AWR voor
     een aangiftebelasting): het tijdvak eindigt 30 juni, de aangifte moet er
     31 juli zijn. Die datum wordt dus gerekend en niet meegestuurd. */
  function btwStand(zaakCode) {
    if (!telling) return null;
    const code = String(zaakCode || '').toUpperCase();
    const periode = vorigeBtwPeriode(klok());
    const vak = periodeVak(periode);
    if (!vak) return null;
    const alIngediend = (db.data.btwAangiftes || []).some(a =>
      a.code === code && a.periode === periode && a.stand === 'ingediend');
    if (alIngediend) return null;
    const t = telling.telFacturen(code, vak);
    if (t.verkoopSom - t.voorbelasting <= 0) return null;
    const eind = new Date(vak.tot + 'T00:00:00.000Z');
    const deadline = new Date(Date.UTC(eind.getUTCFullYear(), eind.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
    return { periode, centen: t.verkoopSom - t.voorbelasting, deadline };
  }

  function btwHerinnering({ zaakCode } = {}) {
    const adres = rtmail.normAdres(zaakCode);
    if (!adres) return null;
    const st = btwStand(zaakCode);
    if (!st) return null;
    const body = 'Je btw-aangifte over ' + st.periode + ' komt eraan. Deadline: ' + st.deadline + '.' +
      ' Uit je factuurregister komt op dit moment EUR ' + (st.centen / 100).toFixed(2) + ' te betalen.' +
      ' Maak de aangifte op in je Kantoor onder Boekhouding; die telt hem uit datzelfde register.' +
      ' Controleren en indienen doe je zelf; Rahul dient nooit voor je in.';
    return rtmail.systeemStuur(adres, 'Btw-aangifte komt eraan', body, 'overheid');
  }

  return { welkomLid, sollicitatieBinnen, factuurGeboekt, inkoopVoorstel, btwHerinnering, btwStand };
};
