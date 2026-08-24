/* DE BRONNEN VAN DE GEZONDHEIDSKAART -- de enige plek waar deze laag iets
   AANRAAKT dat buiten haarzelf ligt.

   ELKE BRON IS EEN LEZER. Er wordt hier niets geteld dat elders al geteld
   wordt: de meting per capability, de servicedoelen, de sonde, de gegevens-
   kwaliteit, de hashketen van het journaal en de back-upstand bestonden alle zes
   al. Wat hier gebeurt is ze in EEN vorm gieten, zodat ./gezondheid.js ze naast
   elkaar kan leggen zonder elke bron apart te kennen.

   DIE VORM IS EEN BEVINDING, en die draagt vier dingen die een dashboard
   normaal weglaat:

     graad     hoe hard dit is: onbekend, vermoed, gemeten of bewezen
     at        wanneer het gemeten is -- bewijs zonder datum veroudert ongemerkt
     zin       wat er staat, in de taal van de bron zelf
     zegtNiet  wat deze bron NIET aantoont

   Dat laatste veld is de reden dat dit bestand bestaat. Een back-upcontrole die
   nakijkt of de bestanden er zijn, bewijst niet dat je ze kunt terugzetten; een
   meting vanaf de machine zelf bewijst niet dat een klant erbij kan. Zonder die
   zin leest een groen bolletje als iets sterkers dan het is.

   EN EEN BRON DIE OMVALT, LIEGT NIET. Elke lezer zit in een try: gaat de laag
   eronder stuk, dan komt er graad `onbekend` met de foutmelding erbij. Niet
   groen en ook niet rood -- niet vastgesteld. Dat is LAT.md regel 3.

   De vijf lezers van het FUNDAMENT staan in ./gezondheid-fundament.js: die
   kijken naar dingen die geen verkeer hebben. Hier staan de twee die dat wel
   doen. */
'use strict';

const fundament = require('./gezondheid-fundament');

/* De drempels staan hier en niet in een configuratiebestand. Dezelfde knip als
   in ./alarm.js: getallen mogen in gegevens staan, maar een regeltaal in JSON is
   een tweede implementatie die je niet kunt toetsen. Ze gaan mee in de uitslag,
   zodat een scherm kan tonen waaraan is gemeten. */
const D = {
  foutLet: 1, foutStoring: 5,          // procent 5xx op het verkeer van dit vermogen
  defectenLet: 1, defectenStoring: 25, // wezen en dubbele sleutels
  backupDagenLet: 2, backupDagenStoring: 7,
  sondeDeelStoring: 0.25,              // deel mislukte metingen van buitenaf
  budgetKrap: 0.25                     // deel foutbudget over waaronder het krap heet
};

const nuIso = () => new Date().toISOString();
const pct = (deel, van) => van ? Number((deel / van * 100).toFixed(3)) : null;

/* Een bron die niet te lezen was. Met de reden, want "onbekend" zonder reden is
   niet te repareren. */
const stil = (bron, waarom) => ({ bron, graad: 'onbekend', oordeel: null, at: nuIso(), waarom, zin: waarom });

function maakBronnen({ meting, functies, slo, sonde, alarm, kwaliteit, journaal, backup, dataDir }) {
  const probeer = (doe) => {
    try { return { ok: true, waarde: doe() }; }
    catch (e) { return { ok: false, waarom: 'deze bron kon niet gelezen worden (' + e.message + ')' }; }
  };

  /* ---------- alles in EEN keer lezen ----------
     Per vermogen opnieuw meten zou twaalf keer dezelfde tellers uitlezen en --
     erger -- twaalf net iets verschillende momentopnamen opleveren. */
  function snapshot() {
    return {
      meting: probeer(() => {
        const st = require('../../meting-capaciteit').stand(meting, functies);
        const perCat = new Map();
        /* OPTELLEN en niet overschrijven. Vandaag levert meting-capaciteit één
           rij zonder functie ("(geen functie)"), maar wie hier de laatste rij
           bewaart, verliest er stil een zodra dat er twee worden -- en dat is
           precies het verkeer dat nergens anders wordt geteld. */
        const buiten = { verzoeken: 0, fouten5xx: 0, namen: [] };
        for (const rij of st.capabilities) {
          const f = functies.OP_ID[rij.id];
          if (!f) {
            buiten.verzoeken += rij.verzoeken; buiten.fouten5xx += rij.fouten5xx;
            buiten.namen.push(rij.naam);
            continue;
          }
          const g = perCat.get(f.categorie) ||
            { categorie: f.categorie, verzoeken: 0, fouten5xx: 0, clientfouten4xx: 0, functies: 0 };
          g.verzoeken += rij.verzoeken; g.fouten5xx += rij.fouten5xx;
          g.clientfouten4xx += rij.clientfouten4xx; g.functies++;
          perCat.set(f.categorie, g);
        }
        return { perCat, buiten: buiten.namen.length ? buiten : null,
          venster: st.venster, vloer: st.vloer };
      }),
      sonde: probeer(() => sonde.stand(24)),
      slo: probeer(() => slo.stand()),
      kwaliteit: probeer(() => kwaliteit.meet()),
      journaal: probeer(() => journaal.controleer()),
      backup: probeer(() => backup.lees(dataDir)),
      alarm: probeer(() => alarm.stand())
    };
  }

  /* EEN ALARM IS EEN TWEEDE LEZING van bronnen die hierboven al staan, en geen
     tweede meting. Het telt daarom alleen mee als het AF gaat: dan zegt het iets
     wat de losse bron niet zegt. Staat het niet aan, dan levert het geen
     bevinding -- anders telt dezelfde stilte twee keer als groen. */
  function vanAlarm(id, snap) {
    if (!snap.alarm.ok) return stil('alarm', snap.alarm.waarom);
    const a = (snap.alarm.waarde.alarmen || []).find(x => x.id === id);
    if (!a || !a.actief) return null;
    return { bron: 'alarm', graad: 'gemeten', at: a.sinds || nuIso(), afgeleid: true,
      oordeel: a.ernst === 'hoog' ? 'storing' : 'let op',
      getallen: { ernst: a.ernst, stilTot: a.stilTot || null },
      zin: a.naam + ': ' + a.wat,
      zegtNiet: 'Dit alarm rekent op dezelfde bronnen als hierboven. Het is een tweede lezing van ' +
        'hetzelfde en geen tweede meting.' };
  }

  /* HET VERKEER van dit vermogen. Onder de vloer van de meting geen percentage:
     nul fouten op drie verzoeken ziet er groener uit dan elk echt cijfer. */
  function vanMeting(v, snap) {
    if (!snap.meting.ok) return stil('meting', snap.meting.waarom);
    const m = snap.meting.waarde;
    let verzoeken = 0, fouten = 0, client = 0, gedekt = 0;
    for (const c of v.categorieen) {
      const g = m.perCat.get(c);
      if (!g) continue;
      verzoeken += g.verzoeken; fouten += g.fouten5xx; client += g.clientfouten4xx; gedekt++;
    }
    const at = m.venster.sinds;
    if (verzoeken < m.vloer) {
      return { bron: 'meting', graad: 'onbekend', oordeel: null, at,
        getallen: { verzoeken, vloer: m.vloer, categorieen: gedekt },
        zin: 'te weinig verkeer in dit venster (' + verzoeken + ' van de ' + m.vloer +
          ' die nodig zijn) om er iets over te zeggen',
        zegtNiet: 'Dit is geen goed nieuws en geen slecht nieuws. Er is niets gemeten.' };
    }
    const p = pct(fouten, verzoeken);
    return { bron: 'meting', at, graad: 'gemeten',
      oordeel: p >= D.foutStoring ? 'storing' : p >= D.foutLet ? 'let op' : 'in orde',
      getallen: { verzoeken, fouten5xx: fouten, clientfouten4xx: client, foutpercentage: p, categorieen: gedekt },
      zin: verzoeken + ' verzoeken, ' + fouten + ' serverfouten (' + p + '%)',
      zegtNiet: 'De teller zit in het geheugen van dit proces en begint bij een herstart opnieuw; dit is ' +
        'dus geen maandcijfer. En hij telt verzoeken en geen uitkomsten -- een boeking die netjes met ' +
        'een 200 het verkeerde antwoord geeft, staat hier als gezond.' };
  }

  /* DE SCHAKELKAST. Uit is een KEUZE en geen storing, en dat onderscheid staat
     hier omdat het op elk ander bord verdwijnt: een dienst die bewust dicht
     staat, hoort niet als rood te lezen -- en ook niet als groen. */
  function vanSchakelaars(v, staat) {
    const ids = functies.FUNCTIES.filter(f => v.categorieen.includes(f.categorie));
    if (!ids.length) return null;
    const per = { aan: 0, uit: [], storing: [] };
    for (const f of ids) {
      const st = functies.functieStatus(f.id, staat || {});
      if (st === 'aan') per.aan++;
      else if (st === 'uit') per.uit.push(f.naam);
      else per.storing.push(f.naam);
    }
    const staan = (n) => n + (n === 1 ? ' staat' : ' staan');
    const delen = [per.aan + ' van de ' + ids.length + ' schakelaars ' + (per.aan === 1 ? 'staat' : 'staan') + ' aan'];
    if (per.uit.length) delen.push(staan(per.uit.length) + ' bewust uit');
    if (per.storing.length) delen.push(staan(per.storing.length) + ' op storing');
    return { bron: 'schakelaars', graad: 'gemeten', at: nuIso(),
      oordeel: per.storing.length ? 'storing' : null,
      getallen: { totaal: ids.length, aan: per.aan, uit: per.uit.length, storing: per.storing.length },
      uit: per.uit.slice(0, 8), storingen: per.storing.slice(0, 8),
      zin: delen.join(', '),
      zegtNiet: 'Een schakelaar die aan staat, zegt dat de deur open is -- niet dat er iemand achter ' +
        'zit. En uit is hier een keuze van een mens, geen defect.' };
  }

  /* De lezers op naam, zodat ./gezondheid.js `bronnen: [...]` uit de kaart kan
     volgen zonder een tweede namenlijst. */
  const LEZERS = {
    meting: (v, snap) => vanMeting(v, snap),
    schakelaars: (v, snap, staat) => vanSchakelaars(v, staat),
    sonde: (v, snap) => fundament.vanSonde(snap, D, stil),
    slo: (v, snap) => fundament.vanSlo(snap, D, stil),
    kwaliteit: (v, snap) => fundament.vanKwaliteit(snap, D, stil),
    journaal: (v, snap) => fundament.vanJournaal(snap, D, stil),
    backup: (v, snap) => fundament.vanBackup(snap, D, stil)
  };

  return { snapshot, LEZERS, vanAlarm, D };
}

module.exports = { maakBronnen, D, stil };
