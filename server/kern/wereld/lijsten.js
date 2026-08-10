/* RTG Wereld -- BEWAARDE LIJSTEN: de talentpool (`werving.talentpool`) en de
   leads (`sales.leads`).

   EEN IMPLEMENTATIE, TWEE LIJSTEN. Een talentpool en een leadlijst zijn
   hetzelfde ding met een andere naam: mensen die jij apart hebt gezet, met een
   notitie en een stand erbij. Ze twee keer bouwen zou dezelfde code op twee
   plekken zetten, met twee keer dezelfde bugs (LAT-regel 4). Wat verschilt zijn
   de STANDEN, en die staan daarom als data en niet als code.

   EN WAT DIT BEWUST NIET IS. In rechten.js stonden ook `werving.suite` en
   `sales.suite` -- ATS, interviews, assessments, contracten, CRM,
   account-intelligence. Die zijn NIET gebouwd, en die namen zijn daarom uit de
   lijst gehaald in plaats van hier half te worden aangezet. Een half aangezette
   wervingslaag is gevaarlijker dan een afwezige: iemand gaat er sollicitanten
   in bewaren en denkt dat er een proces omheen staat.

   Wat er wel is, is de kern die je zonder dat alles al nodig hebt: iemand
   onthouden die je tegenkwam, met waarom.

   PRIVACY, EN DIT IS DE REDEN DAT DE LIJST OP CODENAAM DRAAIT. Je bewaart een
   CODENAAM, geen persoon. Je krijgt geen e-mailadres, geen telefoonnummer en
   geen echte naam -- die staan in de kluis en komen hier niet langs. Wie de
   naam wil, vraagt hem via kern/metier/bewijs.js aan de persoon zelf, en die
   kan hem intrekken. Een wervingslijst die stilletjes persoonsgegevens
   verzamelt is precies wat dit ontwerp niet wil.

   EN JE BEWAART ALLEEN WIE JE MAG ZIEN. De poort staat op het moment van
   toevoegen: je kunt geen codenaam in je pool zetten die je via zoeken niet had
   kunnen vinden. Anders is de lijst een omweg om het bestaan van een lid te
   toetsen. */
'use strict';

const SOORTEN = {
  talent: {
    vermogen: 'werving.talentpool',
    standen: ['gezien', 'benaderd', 'in gesprek', 'niet nu'],
    naam: 'Talentpool'
  },
  lead: {
    vermogen: 'sales.leads',
    standen: ['nieuw', 'benaderd', 'in gesprek', 'gewonnen', 'verloren'],
    naam: 'Leads'
  }
};

const NOTITIE_MAX = 400;
const MAX_PER_LIJST = 500;

module.exports = ({ db, codenaamVan }) => {
  function L() {
    if (!db.data.wereld || typeof db.data.wereld !== 'object') db.data.wereld = {};
    if (!db.data.wereld.lijsten || typeof db.data.wereld.lijsten !== 'object') db.data.wereld.lijsten = {};
    return db.data.wereld.lijsten;
  }
  const sleutel = (key, soort) => key + '::' + soort;
  const nu = () => new Date().toISOString();

  const rij = (key, soort) => {
    const l = L();
    const s = sleutel(key, soort);
    if (!Array.isArray(l[s])) l[s] = [];
    return l[s];
  };

  /* Toevoegen. `magIkZien` is een functie die de AANROEPER meegeeft: die weet
     of deze zoeker dit lid mag vinden. Hem hier zelf uitrekenen zou de
     zichtbaarheidsregel op een tweede plek zetten -- en dan is de dag dat die
     twee uiteenlopen de dag dat de pool een adressenboek wordt. */
  function voegToe(key, soort, doelKey, doelCodenaam, notitie, magIkZien) {
    const S = SOORTEN[soort];
    if (!S) return { error: 'Deze lijst ken ik niet.' };
    if (!doelKey || doelKey === key) return { error: 'Wie?' };
    if (!magIkZien(doelKey)) return { error: 'Dit lid is niet voor je zichtbaar.' };

    const lijst = rij(key, soort);
    if (lijst.some(x => x.key === doelKey)) return { error: 'Die staat er al in.' };
    if (lijst.length >= MAX_PER_LIJST) return { error: 'Deze lijst is vol.' };

    lijst.unshift({
      key: doelKey, codenaam: doelCodenaam,
      stand: S.standen[0], notitie: String(notitie || '').slice(0, NOTITIE_MAX),
      at: nu(), bij: nu()
    });
    return { ok: true, soort, codenaam: doelCodenaam, stand: S.standen[0] };
  }

  /* De stand of de notitie bijwerken. De stand moet uit de lijst van DEZE soort
     komen -- niet "een string die op een stand lijkt" (LAT-regel 8). */
  function zet(key, soort, doelKey, invoer) {
    const S = SOORTEN[soort];
    if (!S) return { error: 'Deze lijst ken ik niet.' };
    const item = rij(key, soort).find(x => x.key === doelKey);
    if (!item) return { error: 'Die staat niet in je lijst.' };
    const v = invoer || {};
    if (v.stand !== undefined) {
      if (!S.standen.includes(v.stand)) return { error: 'Deze stand hoort niet bij deze lijst.' };
      item.stand = v.stand;
    }
    if (v.notitie !== undefined) item.notitie = String(v.notitie || '').slice(0, NOTITIE_MAX);
    item.bij = nu();
    return { ok: true, item: { codenaam: item.codenaam, stand: item.stand, notitie: item.notitie } };
  }

  function weg(key, soort, doelKey) {
    if (!SOORTEN[soort]) return { error: 'Deze lijst ken ik niet.' };
    const lijst = rij(key, soort);
    const i = lijst.findIndex(x => x.key === doelKey);
    if (i < 0) return { error: 'Die staat niet in je lijst.' };
    lijst.splice(i, 1);
    return { ok: true };
  }

  /* De lijst lezen. De codenaam wordt LIVE opgehaald en niet uit de bewaarde
     regel gelezen: een codenaam kan wisselen, en dan zou je lijst een naam
     tonen die niemand meer draagt. Kan hij niet meer worden opgehaald (het lid
     is weg), dan zeggen we dat in plaats van een lege regel te tonen. */
  function lees(key, soort) {
    const S = SOORTEN[soort];
    if (!S) return { error: 'Deze lijst ken ik niet.' };
    return {
      soort, naam: S.naam, standen: S.standen,
      items: rij(key, soort).map(x => ({
        codenaam: codenaamVan(x.key) || '(lid bestaat niet meer)',
        stand: x.stand, notitie: x.notitie, at: x.at, bij: x.bij
      }))
    };
  }

  return { SOORTEN, voegToe, zet, weg, lees };
};
