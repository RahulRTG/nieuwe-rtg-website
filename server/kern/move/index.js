/* RTG MOVE -- de bewegingslaag: de naad tussen wat RTG organiseert en wat een
   mens daarna in de echte wereld moet afleggen.

   WAT DEZE LAAG IS. Eén plek die van een reis niet alleen weet WAAR iemand heen
   wil, maar of hij het HAALT: per overgang tussen twee onderdelen de beweging,
   de marge en het oordeel, en bij een verstoring wat er stroomafwaarts breekt.

   WAT DEZE LAAG NIET IS, en dat is met opzet. Geen nieuwe reisadministratie:
   net als kern/reiswereld.js heeft Move GEEN eigen collectie, schrijft nooit en
   bewaart niets. De tijdlijn komt uit de wereld, de plekken uit
   kern/mobiliteit/plekken, de reistijd uit kern/navigatie. Move voegt één ding
   toe dat nergens stond -- het verband tussen twee onderdelen -- en niets meer.

   DE REKENAARS WORDEN INGESPOTEN EN NIET GEIMPORTEERD. `reisTijd` en `afstandM`
   komen hier als functie binnen, zodat ./naad en ./haalbaar puur blijven en
   zonder server te toetsen zijn. En als een rekenaar NEE zegt -- de navigatie
   weigert eerlijk in Nederland zolang het NWB niet is ingelezen -- dan wordt de
   naad NIET_TE_BEPALEN en niet stilletjes ruim. Dat is dezelfde eerlijkheid
   als kern/navigatie/dekking.js, en het is de reden dat die module bestaat. */
'use strict';

const { haalbaar } = require('./haalbaar');
const { gevolg } = require('./gevolg');
const { UITKOMST, tijdstip } = require('./naad');

module.exports.maakMove = ({ kern }) => {

  /* DE REISTIJD KOMT UIT DE EIGEN MOTOR, en een weigering is een antwoord.
     `navRoute` geeft 503 in Nederland zonder ingeladen wegennet en 422 als er
     geen weg bij het punt ligt; in beide gevallen weet Move het niet. Hier een
     hemelsbrede afstand door een aangenomen snelheid delen zou een reistijd
     verzinnen -- en op zo'n getal wordt straks een reservering verzet. */
  function reisTijd(a, b) {
    if (!a || !b || !kern.navRoute) return null;
    const r = kern.navRoute({ van: { lat: a.lat, lng: a.lng }, naar: { lat: b.lat, lng: b.lng }, modus: 'auto' });
    if (!r || r.status !== 200 || !r.etaMin) return null;
    const min = Number(r.etaMin.auto);
    if (!Number.isFinite(min)) return null;
    return { minuten: min, modus: 'auto', bron: r.bron || null };
  }
  const afstandM = (a, b) => (a && b && kern.haversine) ? kern.haversine(a, b) : null;

  /* Een plek komt binnen als VERWIJZING en wordt door de plekkenlaag opgelost
     (kern/mobiliteit/plekken.js). Lukt dat niet, dan is er geen plek -- geen
     benadering op de stadsnaam, want dan wordt de marge een gok. */
  function plekVan(rij) {
    if (!rij || !rij.plek || !kern.plekBepaal) return null;
    try {
      const p = kern.plekBepaal(rij.plek);
      return (p && p.lat != null && p.lng != null && !p.onbekend) ? p : null;
    } catch (e) { return null; }
  }

  /* DE TIJDEN VAN EEN ONDERDEEL, en alleen waar het domein ze kent.

       nodigAt  wanneer je er moet ZIJN            -- uit dag + uur
       klaarAt  wanneer je er weg KUNT             -- uit dag + uur + duur

     Een onderdeel zonder uur levert geen tijdstip (kern/reiswereld.js zet `tijd`
     met opzet alleen waar het domein er een heeft), en een onderdeel zonder
     bekende duur levert geen klaarAt. Een duur van nul aannemen zou betekenen
     dat je een restaurant op hetzelfde moment binnenkomt en verlaat. */
  function tijdenVan(rij) {
    const start = tijdstip(rij.van, rij.tijd);
    const duur = Number(rij.duurMin);
    return {
      nodigAt: start,
      klaarAt: (start != null && Number.isFinite(duur) && duur >= 0) ? start + duur * 60000 : null
    };
  }

  /* De tijdlijn van de reiswereld wordt hier een rij onderdelen met plek en
     tijd. Wat niet op te lossen valt, gaat MEE met een lege plek of tijd -- niet
     eruit gefilterd. Een reis waarvan de helft stil verdwijnt, ziet er compleet
     uit en is het niet (dezelfde regel als reiswereld-bronnen.js regel 93). */
  function onderdelenVan(key) {
    const w = kern.reiswereld ? kern.reiswereld.komend(key) : null;
    const rijen = (w && w.komend) || [];
    return rijen.map(r => Object.assign({
      titel: r.titel, soort: r.soort, kenmerk: r.kenmerk, herkomst: r.herkomst,
      plek: plekVan(r)
    }, tijdenVan(r)));
  }

  /* IS MIJN REIS HAALBAAR. Naast het oordeel komt altijd de dekking mee: over
     welk deel van de overgangen Move iets kon zeggen. */
  function moveReis(key) {
    const onderdelen = onderdelenVan(key);
    const uit = haalbaar({ onderdelen, reisTijd, afstandM });
    return Object.assign({ status: 200 }, uit, {
      onderdelen: onderdelen.length,
      metPlek: onderdelen.filter(o => !!o.plek).length,
      metTijd: onderdelen.filter(o => o.nodigAt != null).length
    });
  }

  /* WAT EEN VERSCHUIVING DOET. De minuten komen van buiten en worden nooit
     geraden -- zelfde grens als kern/mobiliteit/storing.js. */
  function moveGevolg(key, body) {
    const b = body || {};
    return gevolg({ onderdelen: onderdelenVan(key), kenmerk: b.kenmerk,
      minuten: b.minuten, reisTijd, afstandM });
  }

  /* DE VOLGENDE BEWEGING -- wat de Continue Key mag aanbieden.

     Hij wordt AFGELEID en nooit verzonnen: de eerste overgang die nog moet
     komen en waarvan de bestemming bekend is. Weet Move dat niet, dan geeft hij
     `null` terug en houdt het scherm zijn gewone vraag ("Waar wilt u heen?").
     Een Continue Key die een bestemming raadt, stuurt iemand met één tik naar de
     verkeerde stad -- en dat is precies het defect dat RTG Navigatie al een keer
     had (een kaart rond een eiland waar de gebruiker niet was). */
  function moveVolgende(key, nuMs) {
    const nu = Number.isFinite(nuMs) ? nuMs : Date.now();
    const onderdelen = onderdelenVan(key);
    for (const o of onderdelen) {
      if (o.nodigAt != null && o.nodigAt > nu && o.plek) {
        return { status: 200, volgende: {
          titel: o.titel || '', soort: o.soort || '', kenmerk: o.kenmerk || '',
          nodigAt: new Date(o.nodigAt).toISOString(),
          plek: { lat: o.plek.lat, lng: o.plek.lng, label: o.plek.label || '', bron: o.plek.bron || '' }
        } };
      }
    }
    return { status: 200, volgende: null,
      waarom: 'Geen komend onderdeel met een bekende plek en tijd; Move verzint geen bestemming.' };
  }

  return { move: { reis: moveReis, gevolg: moveGevolg, volgende: moveVolgende, UITKOMST } };
};
