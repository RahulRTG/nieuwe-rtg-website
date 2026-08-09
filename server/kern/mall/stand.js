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

   Geen tweede administratie: er wordt hier niets opgeslagen en geen enkele
   openingstijd opnieuw gedefinieerd. Wat de ondernemer in zijn eigen scherm
   verandert, verandert hier mee omdat het dezelfde rij is.

   WAT WE NIET WETEN, ZEGGEN WE NIET. `openNu` geeft drie antwoorden: true,
   false en null. Null betekent "deze zaak heeft geen openingstijden
   vastgelegd" en is met opzet geen "open". Een filter "Nu open" laat zo'n zaak
   dus weg -- dat is eerlijker dan gokken, en het is voor de ondernemer meteen
   de reden om zijn uren wel in te vullen. Een Mall die "open" zegt terwijl de
   deur dicht zit, stuurt iemand voor niets door de regen.

   DE KLOK. Alles rekent in de tijd van de server. Voor een Mall die van
   Haarlem tot Ibiza loopt is dat niet goed genoeg zodra die twee in een andere
   tijdzone liggen; de zaak draagt op dit moment geen tijdzone, dus dat is een
   bekend gat en geen aanname die hier stil wordt gemaakt. Zie `WAAROM_NULL`
   hieronder en de tekst in README.md. */

const { LUNCH, DINER } = require('../foodcourt');

const WAAROM_NULL = 'Deze zaak heeft geen openingstijden vastgelegd in haar eigen systeem.';

const naarMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const tweeCijfers = (n) => String(n).padStart(2, '0');
const naarTijd = (m) => tweeCijfers(Math.floor(m / 60)) + ':' + tweeCijfers(m % 60);

module.exports = (ctx) => {
  const { db, haalVakwerk, haalFoodcourt, haalZaakFunctie } = ctx;

  /* De bronnen komen laat: vakwerk staat in kernlaag3, de foodcourt verderop in
     kernlaag2 en de zaak-schakelaars in server.js, allemaal NA de Mall. Een
     ontbrekende bron mag niet stil tot "geen beschikbaarheid" leiden, dus
     `bronnen()` zegt wie er hangt en test/mall-supplieros.test.js eist dat dat
     er op een echte server drie van de drie zijn (LAT-regel 3). */
  const vakwerk = () => (typeof haalVakwerk === 'function' ? haalVakwerk() : null);
  const foodcourt = () => (typeof haalFoodcourt === 'function' ? haalFoodcourt() : null);
  const zaakFunctie = () => (typeof haalZaakFunctie === 'function' ? haalZaakFunctie() : null);
  const bronnen = () => ({ vakwerk: !!vakwerk(), foodcourt: !!foodcourt(), zaak: !!zaakFunctie() });

  const nuDatum = () => new Date();
  const datumStr = (d) => d.toISOString().slice(0, 10);
  const minutenNu = (d) => d.getHours() * 60 + d.getMinutes();

  /* Neemt deze zaak op dit moment bestellingen of reserveringen aan? Dit is de
     schakelaar die de ondernemer zelf omzet in zijn mini-boardroom. We vragen
     het aan kern/zaak.js in plaats van s.settings zelf te lezen: die vlag stond
     al op vier plekken los uitgelezen, en dat is precies hoe "gesloten" op de
     ene plek "open" op de andere wordt (LAT-regel 4). */
  function neemtAan(s, wat) {
    const fn = zaakFunctie();
    if (fn) return !!fn(s, wat === 'orders' ? 'orders' : 'reserveren');
    // zonder de schakelaarmodule vallen we terug op de instelling zelf, en dat
    // is een feit uit dezelfde rij -- geen aanname
    const k = wat === 'orders' ? 'ordersOpen' : 'reservationsOpen';
    return !(s.settings && s.settings[k] === false);
  }

  /* De openingstijden van een dienstverlenende zaak, zoals zij die zelf in haar
     agenda zette (kern/vakwerk/agenda.js schrijft s.vakUren). */
  function vakUrenVan(s) {
    const vw = vakwerk();
    if (!vw || !vw.isVak(s)) return null;
    const r = vw.uren(s.code);
    return r && r.ok ? r.uren : null;
  }

  /* Is deze zaak nu open? true / false / null (onbekend, zie de kop).
     Twee soorten zaken kunnen het antwoord geven:
       - dienstverleners uit hun eigen agenda (dagen, van, tot, geblokkeerd)
       - eetgelegenheden uit de lunch- en dinerdiensten van de Food Court
     Een winkel of hotel draagt (nog) geen uren en blijft dus null. */
  function openNu(s, nu) {
    const d = nu || nuDatum();
    const u = vakUrenVan(s);
    if (u) {
      if (!neemtAan(s, 'reserveren')) return { open: false, tekst: 'Neemt nu geen afspraken aan', bron: 'schakelaar' };
      const vandaag = datumStr(d);
      if (!u.dagen[d.getDay()] || (u.geblokkeerd || []).includes(vandaag))
        return { open: false, tekst: 'Vandaag gesloten', bron: 'agenda' };
      const m = minutenNu(d), van = naarMin(u.van), tot = naarMin(u.tot);
      if (van == null || tot == null) return { open: null, tekst: WAAROM_NULL, bron: 'geen' };
      return m >= van && m < tot
        ? { open: true, tekst: 'Nu open tot ' + u.tot, bron: 'agenda' }
        : { open: false, tekst: m < van ? 'Opent om ' + u.van : 'Gesloten sinds ' + u.tot, bron: 'agenda' };
    }
    const fc = foodcourt();
    if (fc && fc.isEetgelegenheid(s)) {
      if (!neemtAan(s, 'reserveren')) return { open: false, tekst: 'Neemt nu geen reserveringen aan', bron: 'schakelaar' };
      const m = minutenNu(d);
      const dienst = [['lunch', LUNCH], ['diner', DINER]]
        .find(([, lijst]) => m >= naarMin(lijst[0]) && m <= naarMin(lijst[lijst.length - 1]));
      if (dienst) return { open: true, tekst: 'Nu open (' + dienst[0] + ')', bron: 'foodcourt' };
      const volgend = m < naarMin(LUNCH[0]) ? LUNCH[0] : (m < naarMin(DINER[0]) ? DINER[0] : null);
      return { open: false, tekst: volgend ? 'Opent om ' + volgend : 'Vandaag gesloten', bron: 'foodcourt' };
    }
    return { open: null, tekst: WAAROM_NULL, bron: 'geen' };
  }

  /* Het eerstvolgende moment waarop je hier terecht kunt. Duur: dit vraagt per
     zaak per dag de vrije tijdvakken op, dus hij wordt met opzet NIET voor de
     hele Mall berekend maar alleen voor de aanbod-objecten die werkelijk op het
     scherm komen (zie verrijk hieronder). Kijkt maximaal een week vooruit;
     verder dan dat is "bel even" een eerlijker antwoord dan een datum. */
  function eerstVrij(s, dienstId) {
    const vw = vakwerk();
    if (!vw || !vw.isVak(s) || !neemtAan(s, 'reserveren')) return null;
    const start = nuDatum();
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const datum = datumStr(d);
      const r = vw.slots(s.code, dienstId, datum);
      if (!r || !r.ok || !r.tijden.length) continue;
      const dagnaam = i === 0 ? 'vandaag' : (i === 1 ? 'morgen' : new Intl.DateTimeFormat('nl-NL', { weekday: 'long' }).format(d));
      return { datum, tijd: r.tijden[0], tekst: 'Eerste plek ' + dagnaam + ' om ' + r.tijden[0], hard: true };
    }
    return null;
  }

  /* De eerstvolgende vrije tafel, uit dezelfde tijdslotenlijst waarmee je ook
     werkelijk reserveert. Zelfde kostenafweging als eerstVrij. */
  function eersteTafel(s, personen) {
    const fc = foodcourt();
    if (!fc || !fc.isEetgelegenheid(s) || !neemtAan(s, 'reserveren')) return null;
    const start = nuDatum();
    for (let i = 0; i < 3; i++) {
      const datum = datumStr(new Date(start.getTime() + i * 86400000));
      const r = fc.tijden(s.code, datum, personen || 2);
      if (!r || !r.ok || !r.open) continue;
      const vrij = (r.slots || []).find(x => !x.vol);
      if (!vrij) continue;
      const dagnaam = i === 0 ? 'vandaag' : (i === 1 ? 'morgen' : 'overmorgen');
      return { datum, tijd: vrij.tijd, tekst: 'Tafel ' + dagnaam + ' om ' + vrij.tijd, hard: true };
    }
    return null;
  }

  /* De voorraad van een artikel, uit de varianten die de zaak zelf bijhoudt.
     Uitverkocht is een ANTWOORD en geen leegte: een artikel dat op is blijft
     zichtbaar met "Uitverkocht" erbij, want stilweg verdwijnen laat de klant
     zoeken naar iets wat er gisteren nog was. */
  function voorraad(varianten) {
    const v = Array.isArray(varianten) ? varianten : [];
    if (!v.length) return null;
    const totaal = v.reduce((n, x) => n + Math.max(0, Number(x.voorraad) || 0), 0);
    if (totaal <= 0) return { tekst: 'Uitverkocht', hard: false, uit: true };
    if (totaal <= 3) return { tekst: 'Nog ' + totaal + ' op voorraad', hard: true };
    return { tekst: 'Op voorraad', hard: true };
  }

  /* De pagina verrijken met wat te duur is voor de hele Mall. Krijgt de zaken
     erbij die op het scherm komen (hoogstens een pagina), en vult daar het
     eerstvolgende vrije moment in. Zo blijft een zoekopdracht over duizenden
     aanbod-objecten goedkoop terwijl wat je ziet wel echt actueel is. */
  function verrijk(items) {
    const zaken = new Map((db.data.suppliers || []).map(s => [s.code, s]));
    return items.map(a => {
      if (!a.aanbieder.code) return a;
      const s = zaken.get(a.aanbieder.code);
      if (!s) return a;
      let beter = null;
      if (a.type === 'dienst' || a.type === 'offerte') beter = eerstVrij(s, (a.id.split(':')[2] || null));
      else if (a.type === 'eten') beter = eersteTafel(s, 2);
      return beter ? { ...a, beschikbaar: beter } : a;
    });
  }

  const api = { openNu, eerstVrij, eersteTafel, voorraad, neemtAan, vakUrenVan, verrijk, bronnen, WAAROM_NULL };
  ctx.stand = api;
  return { mallStand: api };
};

module.exports.WAAROM_NULL = WAAROM_NULL;
module.exports.naarMin = naarMin;
module.exports.naarTijd = naarTijd;
