/* RTG Mall, deelbestand "stand": DE KOPPELING MET DE SUPPLIER OS.

   De Mall las tot nu toe alleen wat een zaak IS (naam, adres, artikelen,
   prijzen) en niet wat zij op dit moment DOET. Daardoor stond een gesloten
   kapper er net zo bij als een open kapper, een woensdagmiddag die de
   ondernemer in zijn eigen agenda had geblokkeerd was in de Mall niet te zien,
   en een artikel met voorraad nul verschilde in niets van een artikel dat op
   de plank ligt.

   Dit bestand haalt die stand op uit de systemen waar de ondernemer al werkt:

     agenda en openingstijden   kern/vakwerk/agenda.js  (s.vakUren + boekingen)
     tafels en diensten         kern/foodcourt.js       (LUNCH/DINER + bezet)
     aan/uit-schakelaars        kern/zaak.js            (zaakFunctieAan)
     voorraad                   de artikelen van de zaak zelf
     extern kassasysteem        ./extern.js             (push, met houdbaarheid)

   Geen tweede administratie: er wordt hier niets opgeslagen en geen enkele
   openingstijd opnieuw gedefinieerd. Wat de ondernemer in zijn eigen scherm
   verandert, verandert hier mee omdat het dezelfde rij is.

   WAT WE NIET WETEN, ZEGGEN WE NIET. `openNu` geeft drie antwoorden: true,
   false en null. Null betekent "deze zaak heeft geen openingstijden
   vastgelegd" en is met opzet geen "open". Een filter "Nu open" laat zo'n zaak
   dus weg -- dat is eerlijker dan gokken, en het is voor de ondernemer meteen
   de reden om zijn uren wel in te vullen. Een Mall die "open" zegt terwijl de
   deur dicht zit, stuurt iemand voor niets door de regen.

   DE KLOK IS DIE VAN DE ZAAK. Alles rekent in de tijdzone van de zaak zelf
   (kern/tijdzone.js), niet in die van de server. Zolang dat servertijd was,
   was "Nu open" in Ibiza een uur mis -- en dat is de stilste fout die er is,
   want de klant staat voor een dichte deur en denkt dat de zaak dicht is.

   Het dure werk (eerstvolgende vrije tijdvak, eerstvolgende tafel) staat in
   ./stand-agenda.js, omdat het per zaak per dag de agenda opvraagt en dus
   alleen voor de zichtbare pagina wordt gedaan. */

const { LUNCH, DINER } = require('../foodcourt');
const { zoneVan, lokaal } = require('../tijdzone');

const WAAROM_NULL = 'Deze zaak heeft geen openingstijden vastgelegd in haar eigen systeem.';

const naarMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

module.exports = (ctx) => {
  const { db, haalVakwerk, haalFoodcourt, haalZaakFunctie } = ctx;
  const extern = require('./extern')(ctx);

  /* De bronnen komen laat: vakwerk staat in kernlaag3, de foodcourt verderop in
     kernlaag2 en de zaak-schakelaars in server.js, allemaal NA de Mall. Een
     ontbrekende bron mag niet stil tot "geen beschikbaarheid" leiden, dus
     `bronnen()` zegt wie er hangt en test/mall-supplieros.test.js eist dat dat
     er op een echte server drie van de drie zijn (LAT-regel 3). */
  const vakwerk = () => (typeof haalVakwerk === 'function' ? haalVakwerk() : null);
  const foodcourt = () => (typeof haalFoodcourt === 'function' ? haalFoodcourt() : null);
  const zaakFunctie = () => (typeof haalZaakFunctie === 'function' ? haalZaakFunctie() : null);
  const bronnen = () => ({ vakwerk: !!vakwerk(), foodcourt: !!foodcourt(), zaak: !!zaakFunctie() });

  // de tijdzone van een zaak; het land komt uit dezelfde bepaling als de plek
  function zoneVoor(s) {
    const land = ctx.plek.plekVan({ stad: s.city, land: s.country }).land;
    return zoneVan(s, land);
  }
  const nuBij = (s, wanneer) => lokaal(zoneVoor(s).zone, wanneer);

  /* Neemt deze zaak op dit moment bestellingen of reserveringen aan? Dit is de
     schakelaar die de ondernemer zelf omzet in zijn mini-boardroom. We vragen
     het aan kern/zaak.js in plaats van s.settings zelf te lezen: die vlag stond
     al op vier plekken los uitgelezen, en dat is precies hoe "gesloten" op de
     ene plek "open" op de andere wordt (LAT-regel 4). */
  function neemtAan(s, wat) {
    const fn = zaakFunctie();
    if (fn) return !!fn(s, wat === 'orders' ? 'orders' : 'reserveren');
    const k = wat === 'orders' ? 'ordersOpen' : 'reservationsOpen';
    return !(s.settings && s.settings[k] === false);
  }

  // de openingstijden zoals de zaak ze zelf in haar agenda zette
  function vakUrenVan(s) {
    const vw = vakwerk();
    if (!vw || !vw.isVak(s)) return null;
    const r = vw.uren(s.code);
    return r && r.ok ? r.uren : null;
  }

  /* Is deze zaak nu open? true / false / null (onbekend, zie de kop).
     Vier bronnen, in volgorde van hardheid:
       1. een extern kassasysteem dat expliciet open/dicht meldt (en vers is)
       2. de schakelaar van de zaak zelf
       3. de eigen agenda van een dienstverlener
       4. de lunch- en dinerdiensten van de Food Court
     Een winkel of hotel draagt (nog) geen uren en blijft dus null. */
  function openNu(s, wanneer) {
    const ex = extern.openVan(s, wanneer);
    if (ex) return ex;
    const t = nuBij(s, wanneer);
    const u = vakUrenVan(s);
    if (u) {
      if (!neemtAan(s, 'reserveren')) return { open: false, tekst: 'Neemt nu geen afspraken aan', bron: 'schakelaar' };
      if (!u.dagen[t.dag] || (u.geblokkeerd || []).includes(t.datum))
        return { open: false, tekst: 'Vandaag gesloten', bron: 'agenda' };
      const van = naarMin(u.van), tot = naarMin(u.tot);
      if (van == null || tot == null) return { open: null, tekst: WAAROM_NULL, bron: 'geen' };
      return t.minuten >= van && t.minuten < tot
        ? { open: true, tekst: 'Nu open tot ' + u.tot, bron: 'agenda' }
        : { open: false, tekst: t.minuten < van ? 'Opent om ' + u.van : 'Gesloten sinds ' + u.tot, bron: 'agenda' };
    }
    const fc = foodcourt();
    if (fc && fc.isEetgelegenheid(s)) {
      if (!neemtAan(s, 'reserveren')) return { open: false, tekst: 'Neemt nu geen reserveringen aan', bron: 'schakelaar' };
      const dienst = [['lunch', LUNCH], ['diner', DINER]]
        .find(([, l]) => t.minuten >= naarMin(l[0]) && t.minuten <= naarMin(l[l.length - 1]));
      if (dienst) return { open: true, tekst: 'Nu open (' + dienst[0] + ')', bron: 'foodcourt' };
      const volgend = t.minuten < naarMin(LUNCH[0]) ? LUNCH[0] : (t.minuten < naarMin(DINER[0]) ? DINER[0] : null);
      return { open: false, tekst: volgend ? 'Opent om ' + volgend : 'Vandaag gesloten', bron: 'foodcourt' };
    }
    return { open: null, tekst: WAAROM_NULL, bron: 'geen' };
  }

  /* De voorraad van een artikel. Een extern kassasysteem mag hem overschrijven
     zolang zijn melding vers is; anders tellen de varianten van de zaak zelf.
     Uitverkocht is een ANTWOORD en geen leegte: een artikel dat op is blijft
     zichtbaar met "Uitverkocht" erbij, want stilweg verdwijnen laat de klant
     zoeken naar iets wat er gisteren nog was. */
  function voorraad(varianten, s, artikel) {
    const ex = extern.voorraadVan(s, artikel);
    const totaal = ex != null ? ex
      : (Array.isArray(varianten) && varianten.length
        ? varianten.reduce((n, x) => n + Math.max(0, Number(x.voorraad) || 0), 0)
        : null);
    if (totaal == null) return null;
    if (totaal <= 0) return { tekst: 'Uitverkocht', hard: false, uit: true };
    if (totaal <= 3) return { tekst: 'Nog ' + totaal + ' op voorraad', hard: true };
    return { tekst: 'Op voorraad', hard: true };
  }

  const api = { openNu, voorraad, neemtAan, vakUrenVan, zoneVoor, nuBij, bronnen, extern, WAAROM_NULL };
  Object.assign(api, require('./stand-agenda')(ctx, { vakwerk, foodcourt, neemtAan, nuBij }));
  ctx.stand = api;
  return { mallStand: api };
};

module.exports.WAAROM_NULL = WAAROM_NULL;
module.exports.naarMin = naarMin;
