/* UITVOERENDE MEDIA (deelmodule): DE UITVOERING -- wat een kijker op dit moment
   krijgt, en waarom precies dat.

   DE DRIE GEZAGSVORMEN. Een uitvoering ontstaat alleen waar drie dingen
   tegelijk kloppen, en ze zijn met opzet niet hetzelfde:

     toestemming van de MAKER    wat mag RTG met mijn werk doen
     aanspraak van de KIJKER     wat mag deze mens van dit aanbod ontvangen
     regels van de PARTITUUR     wat is dit werk, en wat is er onmisbaar aan

   Ontbreekt er een, dan komt er geen uitvoering maar een WEIGERING met de
   reden. Dat is de kern van dit bestand en niet een randgeval: een uitvoering
   die het gevraagde niet kan halen, hoort niet iets anders te leveren dat er
   ongeveer op lijkt.

   DE REGEL DIE NIET MAG SNEUVELEN. RTG monteert alleen uit wat de maker heeft
   aangewezen en verzint er nooit iets bij. Elke regel hieronder is terug te
   voeren op een onderdeel van de partituur; er wordt niet overbrugd, niet
   gladgestreken en niet opgevuld. Dat is dezelfde beweging als "liever geen
   getal dan een getal dat niets meet" (het makersbord in kern/mediaos/hub.js),
   nu op montage.

   EN HET IS REPRODUCEERBAAR. Er zit geen toeval in dit bestand: dezelfde vraag
   op dezelfde partituur geeft dezelfde uitvoering. Zonder dat kan een maker
   niet zien wat een kijker werkelijk kreeg, en is "de officiële korte versie"
   een bewering die niemand kan natrekken (BESTUUR.md: elke bewering draagt haar
   bewijsgraad).

   DE DEUR BLIJFT VAN HET DOMEIN. Elk fragment wordt opgelost via de catalogus
   met de sessie van de KIJKER -- dezelfde weg als een afspeellijst
   (kern/mediaos/lijsten.js). Een uitvoering is dus geen doorgeefluik langs een
   dichte deur, ook niet als de maker het fragment er zelf in zette. */
'use strict';

const F = require('./fragment');
/* De verantwoording van een montage staat apart (./bewijs.js): het kiezen en
   het verantwoorden van die keuze zijn twee dingen, en zolang ze in één functie
   zitten kan het bewijs meebewegen met wat er toevallig uitkwam. */
const B = require('./bewijs');

module.exports = ({ catalogus, partituur, aanspraak }) => {

  function bouwUitvoering(sess, opdracht) {
    const o = opdracht || {};
    const p = partituur.met(o.partituurId);
    /* Een partituur die nog niet klaar is, bestaat alleen voor zijn maker. Niet
       "bestaat niet" tegen de maker zelf: die zit er middenin en heeft recht op
       een eerlijk antwoord (LAT.md regel 5). */
    if (!p || (!p.klaar && p.key !== sess.key))
      return { status: 404, error: 'Deze partituur bestaat niet.' };
    const ikMaker = p.key === sess.key;

    /* 1. DE AANSPRAAK. Waar de partituur er een vraagt, gaat die vraag vóór
       alles: wie er geen heeft, hoort niet te weten hoe lang het werk is of
       waar het uit bestaat. De maker van het werk komt er altijd in -- anders
       zou hij zijn eigen partituur niet kunnen nakijken. */
    let asp = null;
    if (p.aanspraakNodig && !ikMaker) {
      const h = aanspraak.heeft(sess.key, p.aanspraakNodig);
      if (!h.ok) return B.weiger(403, h.reden, { aanspraakNodig: p.aanspraakNodig });
      asp = { code: h.aanspraak.code, herkomst: h.aanspraak.herkomst, herkomstNaam: h.aanspraak.herkomstNaam };
    }

    /* 2. OPLOSSEN met de sessie van de kijker. Wat er niet is of dicht staat,
       valt niet stil weg maar komt in `nietBeschikbaar` terecht. */
    const wereld = catalogus.alles(sess);
    const kaart = new Map(wereld.rijen.map(r => [r.id, r]));
    const nietBeschikbaar = [];
    const bruikbaar = [];
    for (const od of (p.onderdelen || [])) {
      const f = F.lees(od.fragmentId);
      const rij = f ? kaart.get(f.stukId) : null;
      if (!rij) {
        nietBeschikbaar.push({ fragmentId: od.fragmentId, naam: od.naam, rol: od.rol,
          reden: 'Dit stuk is er niet meer voor u: weggehaald door de maker, of achter een deur die nu dicht staat.' });
        continue;
      }
      bruikbaar.push({ od, f, rij, duurS: f.duurS });
    }

    /* 3. DE KERN IS ALLES OF NIETS. Een uitvoering die een verplicht onderdeel
       mist, is niet een kortere versie van het werk maar een ander werk. Hier
       wordt dus geweigerd, ook al zou er een aardige montage over te houden
       zijn -- dat is precies de verleiding waar deze regel tegen staat. */
    const kernWeg = nietBeschikbaar.filter(x => x.rol === 'kern');
    const kern = bruikbaar.filter(x => x.od.rol === 'kern');
    const verdieping = bruikbaar.filter(x => x.od.rol !== 'kern');
    const kernS = kern.reduce((n, x) => n + x.duurS, 0);
    const totaalS = bruikbaar.reduce((n, x) => n + x.duurS, 0);
    const grond = B.grondVan({ kernS, totaalS, nietBeschikbaar, toestemming: p.toestemming, aanspraak: asp });
    if (kernWeg.length)
      return B.weiger(409, 'Van dit werk ontbreken ' + kernWeg.length + ' onmisbare onderdelen; een kortere versie zou een ander werk zijn.', grond);
    if (!kern.length)
      return B.weiger(409, 'Deze partituur heeft geen kern; RTG kan niet weten wat het werk is.', grond);

    /* 4. HET BUDGET. Geen budget betekent: het hele werk. */
    const gevraagd = Math.round(Number(o.secondenBudget));
    const budget = Number.isFinite(gevraagd) && gevraagd > 0
      ? (p.regels.maxS ? Math.min(gevraagd, p.regels.maxS) : gevraagd)
      : (p.regels.maxS || totaalS);

    /* 5. MAG ER INGEKORT WORDEN? Staat die schakelaar uit, dan is er maar één
       uitvoering en dat is het hele werk. Vraagt iemand om minder, dan is het
       antwoord nee met de reden -- niet een half werk. */
    if (!p.toestemming.inkorten && budget < totaalS)
      return B.weiger(409, 'Deze maker heeft inkorten niet toegestaan: dit werk bestaat alleen in zijn geheel (' +
        Math.round(totaalS) + ' seconden).', grond);
    if (kernS > budget)
      return B.weiger(409, 'Het onmisbare deel van dit werk duurt ' + Math.round(kernS) +
        ' seconden; u vroeg om ' + Math.round(budget) + '. Korter bestaat er niet.', grond);

    /* 6. DE KEUZE. Eerst de kern (die staat vast), daarna de verdieping in de
       volgorde van de MAKER zolang er ruimte is. Wat er niet in past valt niet
       stil weg maar komt in `weggelaten` met de reden erbij. */
    const diepte = Math.min(Math.max(Math.round(Number(o.diepte)) || 3, 1), 3);
    const gekozen = kern.slice();
    const weggelaten = [];
    let ruimte = budget - kernS;
    for (const x of verdieping) {
      if (x.od.diepte > diepte) {
        weggelaten.push({ fragmentId: x.od.fragmentId, naam: x.od.naam,
          reden: 'Dit gaat dieper (' + x.od.diepte + ') dan u vroeg (' + diepte + ').' });
        continue;
      }
      if (x.duurS > ruimte) {
        weggelaten.push({ fragmentId: x.od.fragmentId, naam: x.od.naam,
          reden: 'Hier was geen ruimte meer voor: het duurt ' + x.duurS + 's en er was nog ' + Math.round(ruimte * 10) / 10 + 's.' });
        continue;
      }
      gekozen.push(x); ruimte -= x.duurS;
    }

    /* 7. DE VOLGORDE. Zonder toestemming om te hermonteren blijft de volgorde
       van de maker staan, punt. Mét die toestemming zet RTG de kern vooraan --
       de enige hermontage die dit bestand kent, en hij staat in de uitleg bij
       de uitvoering zodat een kijker weet dat er iets is verschoven. */
    const volgorde = p.onderdelen.map(x => x.fragmentId);
    let regels = gekozen.slice().sort((a, b) => volgorde.indexOf(a.od.fragmentId) - volgorde.indexOf(b.od.fragmentId));
    let hermonteerd = false;
    if (p.toestemming.hermonteren) {
      const k = regels.filter(x => x.od.rol === 'kern'), v = regels.filter(x => x.od.rol !== 'kern');
      hermonteerd = v.length > 0 && volgorde.indexOf(v[0].od.fragmentId) < volgorde.indexOf(k[k.length - 1].od.fragmentId);
      if (hermonteerd) regels = k.concat(v);
    }

    const gekozenS = regels.reduce((n, x) => n + x.duurS, 0);
    return {
      status: 200,
      partituur: { id: p.id, naam: p.naam, maker: (regels[0] || {}).rij ? regels[0].rij.maker : null },
      uitvoering: regels.map(x => ({
        fragmentId: x.od.fragmentId, stukId: x.f.stukId, van: x.f.van, tot: x.f.tot, duurS: x.duurS,
        titel: x.od.naam, vorm: x.rij.vorm, vormNaam: x.rij.vormNaam, rol: x.od.rol,
        spelen: x.rij.spelen,
        waarom: x.od.rol === 'kern'
          ? 'De maker heeft dit als onmisbaar aangewezen.'
          : 'Verdieping op niveau ' + x.od.diepte + '; hier was ruimte voor.'
      })),
      totaalS: Math.round(gekozenS * 10) / 10,
      bewijs: B.maakBewijs({
        gevraagd: Number.isFinite(gevraagd) && gevraagd > 0 ? gevraagd : null, diepte,
        budget, kernS, totaalS, gekozenS: Math.round(gekozenS * 10) / 10,
        weggelaten, nietBeschikbaar, hermonteerd, toestemming: p.toestemming, aanspraak: asp
      }),
      uitleg: B.maakUitleg({ hermonteerd, weggelaten })
    };
  }

  /* Heet met opzet niet `voerUit`: die naam staat al in twee andere
     kernmodules (kern/command/bijstand-rtg.js, kern/wacht/raadkamer.js), en een
     derde maakt hem stomp -- dan zegt "voerUit" niets meer over wat er gebeurt.
     De route heet wel gewoon /voer; dat is de taal van de kijker. */
  return { bouwUitvoering };
};
