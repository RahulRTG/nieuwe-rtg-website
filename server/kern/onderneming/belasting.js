/* DE BELASTINGRESERVERING: zet dit opzij, want het is niet van u.

   De belastingtool bestond al (kern/fiscaal/zzp.js): een indicatieve
   jaarberekening per land, met een reserveringspercentage. Wat er niet was, is
   de koppeling aan wat er ECHT is gefactureerd. De ondernemer moest zelf een
   verwachte jaarwinst intypen -- en precies dat getal is het getal dat hij niet
   weet.

   Deze laag rekent op de facturen die er staan, en houdt twee dingen streng
   uit elkaar:

   1. DE BTW IS GEEN SCHATTING. Wat u aan btw in rekening bracht, minus wat u
      aan uw leveranciers betaalde, is een optelsom uit uw eigen facturen. Dat
      geld is nooit van u geweest; het staat alleen even op uw rekening. Dit is
      het enige harde getal hier, en het staat daarom bovenaan.
   2. DE WINSTRESERVERING IS EEN INDICATIE, en rust op een winst die wij maar
      GEDEELTELIJK kennen: alleen wat via RTG is gefactureerd. Contante omzet,
      een bankrekening buiten RTG, autokosten, afschrijving, een boete -- daar
      weten wij niets van. Dat staat in het antwoord en niet alleen hier, want
      het reist mee naar het scherm.

   EN NIET VOOR EEN BUITENLANDSE RECHTSVORM. zzpBerekening rekent met
   Nederlandse regels. Een Duitse GmbH of een Britse sole trader door datzelfde
   sommetje halen geeft een getal dat er precies zo uitziet als een goed getal
   en het niet is. De rechtsvorm draagt zijn land (./rechtsvorm.js); is dat niet
   NL, dan komt er geen bedrag maar de reden.

   EN VOOR EEN B.V. WORDT ER NIETS UITGEREKEND. zzpBerekening is de
   inkomstenbelasting van een IB-ondernemer. Een B.V. betaalt
   vennootschapsbelasting en kent DGA-loon; een stichting heeft geen
   winstoogmerk. Datzelfde sommetje op een rechtspersoon loslaten geeft een
   getal dat er precies zo uitziet als een goed getal en het niet is. Dan komt
   er dus geen bedrag maar de reden waarom niet -- de rechtsvorm-as weet dat al
   (./rechtsvorm.js).

   EXTRAPOLATIE HEET EXTRAPOLATIE. Naast de reservering op wat er nu staat,
   geven we wat het wordt als dit tempo het hele jaar doorzet. Dat is een
   doortrekking van vandaag en geen prognose, en het draagt dat woord. */
'use strict';

const RV = require('./rechtsvorm');
const { zzpBerekening } = require('../fiscaal');

const rond = (n) => Math.round(n * 100) / 100;

module.exports = ({ db }) => {

  const alle = () => (Array.isArray(db.data.facturen) ? db.data.facturen : []);
  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  const inJaar = (f, jaar) => String(f.datum || f.at || '').slice(0, 4) === String(jaar);

  function belasting(o, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();
    const d = new Date(nuT);
    const jaar = d.getUTCFullYear();
    /* Hoeveel van het jaar is voorbij. Nodig om een tempo door te trekken, en
       nooit nul -- op 1 januari zou dat een deling door nul zijn. */
    const dagIn = Math.max(1, Math.floor((nuT - Date.UTC(jaar, 0, 1)) / 86400000) + 1);
    const dagenInJaar = (jaar % 4 === 0 && (jaar % 100 !== 0 || jaar % 400 === 0)) ? 366 : 365;

    const jaarFacturen = alle().filter(f => f && inJaar(f, jaar));
    const verkocht = jaarFacturen.filter(f => f.verkoper && f.verkoper.code === s.code);
    const gekocht = jaarFacturen.filter(f => f.koper && f.koper.supplierCode === s.code);

    const som = (rij, veld) => rond(rij.reduce((n, f) => n + (Number(f[veld]) || 0), 0));
    const btwUit = som(verkocht, 'btwBedrag');
    const btwIn = som(gekocht, 'btwBedrag');
    const omzet = som(verkocht, 'subtotaal');
    const inkoop = som(gekocht, 'subtotaal');
    const winst = rond(omzet - inkoop);

    const rv = RV.rechtsvormVan(o.rechtsvorm);
    const rechtspersoon = !!(rv && rv.rechtspersoon);

    /* De winstreservering. Alleen voor een IB-ondernemer, en alleen als er
       winst is: op verlies hoeft niemand iets opzij te zetten, en
       zzpBerekening weigert een nul terecht. */
    let reservering = null;
    /* Eerst het land en dan pas de rechtsvorm: voor een buitenlandse vorm doet
       het niet ter zake of hij rechtspersoon is -- wij kennen de regels van dat
       land sowieso niet. */
    if (rv && rv.land !== 'NL') {
      reservering = { kan: false,
        reden: 'Deze rechtsvorm hoort bij ' + rv.land + ' en wij rekenen alleen met Nederlandse regels. ' +
          'Wat u daar opzij hoort te zetten, hangt af van tarieven en aftrekken die wij niet kennen. ' +
          'Wij verzinnen daar geen getal bij: dat zou eruitzien als een goed getal en het niet zijn.' };
    } else if (rechtspersoon) {
      reservering = { kan: false,
        reden: 'Een ' + rv.label.toLowerCase() + ' betaalt geen inkomstenbelasting over de winst. ' +
          (rv.caps.includes('vpb')
            ? 'Hier gelden vennootschapsbelasting en, als u zelf in dienst bent, loonheffing over uw DGA-loon.'
            : 'Hier gelden andere regels dan de ondernemersaftrek van een eenmanszaak.') +
          ' Wij rekenen dat bewust niet uit: een getal dat er goed uitziet en het niet is, is erger dan geen getal.' };
    } else if (winst <= 0) {
      reservering = { kan: false,
        reden: winst < 0
          ? 'Op de facturen die wij zien staat u dit jaar op verlies. Dan valt er niets te reserveren.'
          : 'Er is dit jaar nog geen winst gefactureerd.' };
    } else {
      /* Twee aannames, en allebei staan ze in het antwoord.

         HET URENCRITERIUM leiden we af uit de opgegeven uren per week: 1225
         uur per jaar is ruwweg 24 uur per week. Staat er niets, dan nemen we
         aan dat het gehaald wordt -- dat is de gunstigste stand, en die hoort
         zichtbaar te zijn zodat iemand hem kan tegenspreken.

         DE STARTERSAFTREK REKENEN WE NIET MEE. Die hangt af van hoe vaak u hem
         al gebruikte en hoe lang u ondernemer bent, en dat weten wij niet. Hem
         meenemen zou de reservering te LAAG maken, en een reservering die te
         laag is, is erger dan geen reservering. */
      const uren = o.intake && o.intake.persoon ? o.intake.persoon.urenPerWeek : null;
      const urencriterium = uren === null || uren === undefined ? true : uren >= 24;
      const opties = { urencriterium, starter: false };
      const nu = zzpBerekening('NL', winst, opties);
      const jaarWinst = Math.round(winst / dagIn * dagenInJaar);
      const straks = zzpBerekening('NL', jaarWinst, opties);
      reservering = {
        kan: true,
        /* Op wat er NU staat: een percentage op geld dat al verdiend is. Geen
           voorspelling, alleen een tarief toegepast. */
        /* Het percentage uit kern/fiscaal is bewust ruimer dan de berekende
           belasting: het is het tarief plus vijf punten, met een bodem van
           20%. Daardoor dekt de reservering de indicatie altijd, ook waar de
           aftrekken de belasting op nul brengen. Hier stond eerst een
           `Math.max(pct, belasting)` "voor de zekerheid" -- die bond bij geen
           enkele winst tussen 1.000 en een miljoen, en het commentaar erboven
           beloofde bescherming die nergens vandaan kwam. Weg dus: dode code
           met een belofte eraan is erger dan geen code. */
        nu: { winst, percentage: nu.reserveerPct,
              bedrag: Math.round(winst * nu.reserveerPct / 100),
              belastingIndicatie: nu.belasting },
        /* En wat het wordt als dit tempo doorzet. Dit is een DOORTREKKING van
           vandaag; het woord staat er expres bij. */
        extrapolatie: { jaarwinst: jaarWinst, percentage: straks.reserveerPct,
          bedrag: Math.round(jaarWinst * straks.reserveerPct / 100),
          basis: dagIn + ' van de ' + dagenInJaar + ' dagen van ' + jaar + ' zijn voorbij',
          let: 'Een doortrekking van vandaag, geen prognose: seizoen, een grote klant of een stille maand gooien dit om.' },
        aannames: [
          { naam: 'urencriterium gehaald', waarde: urencriterium,
            uitleg: uren === null || uren === undefined
              ? 'U gaf geen uren op; wij nemen aan van wel. Klopt dat niet, dan valt de zelfstandigenaftrek weg en gaat de berekende belasting omhoog.'
              : 'Afgeleid uit ' + uren + ' uur per week (1225 uur per jaar is ruwweg 24 uur per week).' },
          { naam: 'startersaftrek meegerekend', waarde: opties.starter,
            uitleg: 'Wij weten niet hoe vaak u die al gebruikte. Meerekenen zou de reservering te laag maken.' }
        ],
        regels: nu.regels
      };
    }

    return {
      jaar, zaak: s.code,
      /* Het harde getal, bovenaan. */
      btw: {
        gefactureerd: btwUit, voorbelasting: btwIn, afTeDragen: rond(btwUit - btwIn),
        facturenUit: verkocht.length, facturenIn: gekocht.length,
        zeker: true,
        uitleg: 'Dit is een optelsom uit uw eigen facturen, geen schatting. De btw die u in rekening bracht is nooit van u geweest.'
      },
      winst: { omzet, inkoop, winst, basis: 'alleen facturen via RTG' },
      /* Het land waar deze cijfers op slaan, zodat een scherm nooit hoeft te
         raden of de btw-regel hierboven een Nederlandse is. Null zolang er geen
         rechtsvorm is gekozen. */
      land: rv ? rv.land : null,
      reservering,
      voorbehoud: 'Wij zien alleen wat via RTG is gefactureerd. Contante omzet, een rekening buiten RTG, autokosten, afschrijving of een boete kennen wij niet. Dit is een reservering en geen aangifte, en geen fiscaal advies.'
    };
  }

  return { belasting };
};

/* De opvolgregel: alleen over de btw, en alleen als er echt iets af te dragen
   is. De btw is het enige harde getal hier; een herinnering hangen aan een
   indicatie zou een schatting tot een schuld maken. */
function belastingOpvolging(b) {
  if (!b || !b.btw || b.btw.afTeDragen <= 0) return null;
  return {
    id: 'btw', soort: 'belasting', bedrag: b.btw.afTeDragen,
    kop: 'Zet ' + Math.round(b.btw.afTeDragen) + ' euro btw opzij',
    waarom: 'Dat bedrag bracht u dit jaar in rekening en is nooit van u geweest. Wie het meerekent als omzet, schrikt bij de aangifte.'
  };
}

module.exports.belastingOpvolging = belastingOpvolging;
