/* DE WERVING: staat er iemand te wachten, en wat zou een extra paar handen doen.

   Vacatures en sollicitaties bestaan al (db.data.vacatures, db.data.applications,
   gevuld door routes/member/werk.js en getoond in de personeels-app). Deze laag
   bouwt daar niets naast; hij TELT en KLOKT, en legt de uitkomst naast de
   bezetting uit ./capaciteit.js.

   HIER STAAN GEEN NAMEN. Een sollicitatie draagt in de opslag een echte naam en
   contactgegevens -- die heeft een werkgever ook nodig om iemand aan te nemen,
   en daarvoor is de personeels-app. Maar dit is een SIGNAALLAAG op het
   dagbeeld, en een dagbeeld heeft aan een aantal en een wachttijd genoeg. Elke
   naam die hier zou opduiken, is een naam die op een scherm belandt waar hij
   niet voor nodig is; dat is precies hoe de codenaam-regel elders sneuvelt.

   HET GROOTSTE PROBLEEM BIJ WERVING IS NIET WERVEN MAAR ANTWOORDEN. Een
   sollicitatie die drie weken blijft liggen, is een kandidaat die intussen
   ergens anders begint -- en de zaak denkt dat er niemand reageerde. Daarom is
   de wachttijd van de oudste openstaande sollicitatie het getal dat hier op het
   dagbeeld komt, en niet het aantal vacatures.

   WAT EEN EXTRA PERSOON DOET, IS REKENKUNDE EN GEEN BELOFTE. De beschikbare
   tijd in ./capaciteit.js schaalt recht evenredig met de teamgrootte, dus de
   bezetting bij n+1 mensen is exact uit te rekenen. Wat er NIET bij staat is of
   die persoon zichzelf terugverdient: daarvoor zouden wij vraag moeten kennen
   die nooit is gesteld, en dat doen wij niet (zie de kop van ./capaciteit.js). */
'use strict';

const DAG = 86400000;
/* Vanaf hier ligt een sollicitatie te lang. Twee weken: lang genoeg om niet te
   zeuren bij een drukke week, kort genoeg dat de kandidaat er nog is. */
const TE_LANG_DAGEN = 14;
/* De statussen die "er is nog niets mee gebeurd" betekenen. Dezelfde lijst als
   kern/zaak.js gebruikt voor zijn HR-momentopname. */
const OPEN_STATUS = ['nieuw', 'aangevraagd', 'open'];

const dagenGeleden = (iso, nuMs) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? Math.floor((nuMs - t) / DAG) : null;
};

module.exports = ({ db }) => {

  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  function werving(o, cap, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();

    const vacatures = ((db.data.vacatures || {})[s.code] || []).filter(v => v && v.open !== false);
    const alle = (db.data.applications || {})[s.code] || [];
    const wachtend = alle.filter(a => a && OPEN_STATUS.includes(a.status));

    const metDagen = wachtend
      .map(a => ({ dagen: dagenGeleden(a.at, nuT), functie: a.func || null, viaVacature: !!a.vacatureId }))
      .filter(a => a.dagen !== null)
      .sort((a, b) => b.dagen - a.dagen);
    const teLang = metDagen.filter(a => a.dagen >= TE_LANG_DAGEN);

    /* Wat een extra paar handen met de bezetting doet. Alleen als er iets te
       rekenen valt: zonder gemeten bezetting is dit een som over niets. */
    let extraPersoon = null;
    if (cap && cap.stand === 'gemeten' && cap.bezetting !== null && cap.uren) {
      const n = Math.max(1, cap.uren.capaciteit);
      extraPersoon = {
        van: cap.bezetting,
        naar: Math.round(cap.bezetting * n / (n + 1)),
        teamNu: n, teamDan: n + 1,
        uitleg: 'De beschikbare tijd schaalt recht evenredig met de teamgrootte, dus dit is een som en geen schatting.',
        /* En de grens van die som, want zonder dit leest hij als een advies. */
        let: 'Dit zegt niets over of die persoon zichzelf terugverdient. Daarvoor zouden wij vraag moeten kennen die nooit is gesteld.'
      };
    }

    return {
      zaak: s.code,
      vacatures: {
        open: vacatures.length,
        oudste: vacatures.length
          ? Math.max(...vacatures.map(v => dagenGeleden(v.at, nuT) || 0)) : null,
        functies: vacatures.map(v => v.func).filter(Boolean).slice(0, 10)
      },
      sollicitaties: {
        wachtend: wachtend.length,
        teLang: teLang.length,
        langstWachtend: metDagen.length ? metDagen[0].dagen : null,
        /* Op functie en wachttijd; geen namen. Zie de kop. */
        rijen: metDagen.slice(0, 10)
      },
      extraPersoon,
      /* Twee dingen die wij hier niet zien, en die het beeld zouden kantelen. */
      nietGemeten: 'Sollicitaties die buiten RTG binnenkomen tellen niet mee, en of iemand geschikt is kunnen wij niet zeggen. Namen en cv\'s staan in de personeels-app, niet hier.'
    };
  }

  return { WERVING_TE_LANG_DAGEN: TE_LANG_DAGEN, werving };
};

/* De opvolgregels. De eerste gaat over wat er al fout gaat, de tweede over wat
   er dreigt -- in die volgorde, want een kandidaat die wegloopt is een gemiste
   kans die u zelf veroorzaakte. */
function wervingOpvolging(w, cap) {
  if (!w) return [];
  const uit = [];

  if (w.sollicitaties.teLang > 0) {
    uit.push({ id: 'sollicitaties', aantal: w.sollicitaties.teLang,
      kop: w.sollicitaties.teLang + ' sollicitatie' + (w.sollicitaties.teLang === 1 ? '' : 's') +
        ' wacht' + (w.sollicitaties.teLang === 1 ? '' : 'en') + ' al ' + w.sollicitaties.langstWachtend + ' dagen',
      waarom: 'Wie geen antwoord krijgt, begint ergens anders. Dan denkt u dat er niemand reageerde, terwijl er iemand zat te wachten.' });
  }

  /* Vol, maar niemand gezocht. Alleen als de bezetting echt gemeten is: zonder
     agenda weten wij niet of het druk is. */
  if (cap && cap.stand === 'gemeten' && cap.bezetting !== null &&
      cap.bezetting >= 85 && w.vacatures.open === 0) {
    uit.push({ id: 'geen-vacature',
      kop: 'Uw agenda staat vol, maar u zoekt niemand',
      waarom: w.extraPersoon
        ? 'Met een persoon erbij zou uw bezetting van ' + w.extraPersoon.van + '% naar ' +
          w.extraPersoon.naar + '% gaan. Of dat uit kan, weet u zelf het beste.'
        : 'Iemand zoeken duurt weken; beginnen als het al te druk is, is te laat.' });
  }
  return uit;
}

module.exports.wervingOpvolging = wervingOpvolging;
module.exports.TE_LANG_DAGEN = TE_LANG_DAGEN;
module.exports.OPEN_STATUS = OPEN_STATUS;
