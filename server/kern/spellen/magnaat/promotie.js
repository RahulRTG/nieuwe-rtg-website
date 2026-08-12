/* Magnaat: DE PROMOTIE -- "Sven wil je spreken."

   VERHAAL.md hoofdstuk 2, en het is de handeling die het spel het langst heeft
   gemist. Promoveren KON al: je zegt je baan op en solliciteert opnieuw. Maar
   dat is geen promotie, dat is ontslag met een sollicitatie erachter. Het reset
   je dienstjaren, het breekt de arbeidsrelatie, en het voelt niet als wat het
   hoort te zijn -- iemand vond je goed genoeg.

   ================== VIER REGELS ==================

   1. HET IS EEN INTERNE OVERGANG. Dezelfde arbeidsrelatie, dezelfde `sinds`,
      dezelfde `maanden`. Er wordt niets opgezegd en er wordt niets opnieuw
      begonnen. Zou het dienstverband breken, dan verliest de loopbaan precies
      het verband dat haar de moeite waard maakt: "hij werkte drie jaar en twee
      maanden voor jou" wordt dan twee losse baantjes.

   2. HET IS EEN ONDERHANDELING EN GEEN TOEKENNING. De werkgever biedt een rol
      en een loon; de werknemer accepteert, weigert of doet een tegenbod. Een
      promotie die je overkomt is een veldwijziging met een feestje eromheen.
      Een promotie die je kunt weigeren is een keuze -- en pas dan betekent
      accepteren iets.

   3. DE AI GEBRUIKT DEZELFDE HANDELING. Geen `if diensttijd > x: rol++` in de
      concurrent. Sven doet letterlijk het voorstel dat een mens ook zou doen,
      langs deze acties, met deze loonband. Anders zijn er twee arbeidsmarkten
      en twee loopbaanmodellen. Zie ./concurrent-werven.js.

   4. EEN PROMOTIE GAAT OMHOOG. Niet omlaag en niet opzij: een "promotie" naar
      een lagere rol is een demotie, en die hoort een eigen naam en een eigen
      gesprek te hebben. Hier staat wat er WEL kan.

   ================== DRIE SOORTEN, EN WAAROM DAT UITMAAKT ==================

     vakinhoudelijk   hulp -> vakkracht. Je gaat de kwaliteit dragen.
     leidinggevend    vakkracht -> bedrijfsleider. Je gaat over mensen.
     bestuurlijk      bedrijfsleider -> een concernrol. Je gaat over het geheel.

   Het onderscheid staat er niet voor de sier. Een rol is in deze map een LIJST
   BEVOEGDHEDEN (./dienst-rollen.js), en een leidinggevende krijgt daarmee
   toegang tot schermen en handelingen waar hij gisteren niet bij mocht. Dat is
   de hele belofte van VERHAAL.md hoofdstuk 3: het systeem vertelt je niet dat
   je belangrijker bent geworden, het geeft je verantwoordelijkheid.

   Een bestuurlijke promotie verandert bovendien de PLEK: een bedrijfsleider
   hoort bij een vestiging, een directeur bij het concern. Zijn `vestiging`
   wordt daarbij null -- zie ./bestuur.js. */
'use strict';
const D = require('./dienst');
const BS = require('./bestuur');
const { SECTOREN } = require('./sectoren');

/* DE LADDER. Een rol is pas een promotie als hij hoger staat dan waar je zit. */
const TRAP = { hulp: 0, vakkracht: 1, bedrijfsleider: 2, coo: 3, cfo: 3, ceo: 4 };

const soortVan = (van, naar) => (TRAP[naar] >= 3 ? 'bestuurlijk'
  : TRAP[naar] === 2 ? 'leidinggevend' : 'vakinhoudelijk');

module.exports = ({ ACTIES }) => {
  const lijst = (st) => (st.promoties = st.promoties || []);
  const lopende = (st) => lijst(st).filter(p => p.status === 'open' || p.status === 'tegenbod');

  /* WAT EEN NIEUWE ROL BETAALT. Voor een zaakrol uit de sector van de vestiging,
     voor een bestuursrol uit de omzet van het concern -- dezelfde twee antwoorden
     als bij een gewone vacature (./dienst-acties.js), en met opzet niet een
     derde. */
  function band(st, d, rol) {
    if (BS.isBestuur(rol)) return BS.bestuursband(st, d.werkgever, rol);
    const v = Object.values(st.vestigingen || {}).flat().find(x => x.id === d.vestiging);
    if (!v) return null;
    return D.loonband(SECTOREN[v.sector].loon, rol);
  }

  const ACTIETABEL = {
    /* DE WERKGEVER BIEDT. Hij noemt de rol en het bedrag, want een voorstel
       zonder bedrag laat de ander gokken -- dezelfde reden als bij een vacature. */
    'promotie-aanbieden'(potje, h, zet) {
      const st = potje.staat;
      const d = D.lopend(st).find(x => x.id === String(zet.dienst || ''));
      if (!d) return { status: 404, error: 'Dat dienstverband bestaat niet.' };
      if (d.werkgever !== h) return { status: 403, error: 'Die persoon werkt niet voor jou.' };
      const rol = String(zet.rol || '');
      if (!D.ROLLEN[rol]) return { status: 400, error: 'Die rol bestaat niet.' };
      if (!(TRAP[rol] > TRAP[d.rol]))
        return { status: 400, error: 'Een promotie gaat omhoog; ' + rol + ' is dat niet vanaf ' + d.rol + '.' };
      /* EEN ROL PER PLEK, net als bij een vacature: twee bedrijfsleiders op een
         zaak is geen organisatie maar een onduidelijkheid. */
      const bezet = BS.isBestuur(rol)
        ? D.lopend(st).some(x => x.werkgever === h && x.rol === rol)
        : D.dienstenBij(st, d.vestiging).some(x => x.rol === rol);
      if (bezet) return { status: 409, error: 'Die rol is al vervuld.' };
      if (lopende(st).some(p => p.dienst === d.id))
        return { status: 409, error: 'Er ligt al een voorstel bij deze persoon.' };
      const b = band(st, d, rol);
      if (!b) return { status: 404, error: 'Die zaak bestaat niet meer.' };
      const loon = Math.round(Number(zet.loon) || b.basis);
      if (loon < b.min || loon > b.max)
        return { status: 400, error: 'Een loon voor deze rol ligt tussen ' + b.min + ' en ' + b.max + '.' };
      /* EEN PROMOTIE HOORT MEER TE BETALEN. Anders is het meer werk voor
         hetzelfde geld met een mooiere titel, en dat is geen aanbod. */
      if (loon <= d.loon)
        return { status: 400, error: 'Een promotie betaalt meer dan wat hij nu verdient (' + Math.round(d.loon) + ').' };
      const p = { id: 'pr' + (++st.promotieTeller || (st.promotieTeller = 1)),
        dienst: d.id, werkgever: h, werknemer: d.werknemer, van: d.rol, naar: rol,
        soort: soortVan(d.rol, rol), loon, maand: st.maand, status: 'open' };
      lijst(st).push(p);
      return { status: 200, ok: true, id: p.id, soort: p.soort, loon, wek: d.werknemer };
    },

    /* DE WERKNEMER ANTWOORDT. Ja, nee, of een bedrag ertussen. */
    'promotie-antwoord'(potje, h, zet) {
      const st = potje.staat;
      const p = lopende(st).find(x => x.id === String(zet.id || ''));
      if (!p) return { status: 404, error: 'Dat voorstel ligt er niet (meer).' };
      const mijn = p.status === 'open' ? p.werknemer : p.werkgever;
      if (mijn !== h) return { status: 403, error: 'Dat voorstel is niet aan jou.' };
      const antwoord = String(zet.antwoord || '');
      if (antwoord === 'nee') {
        p.status = 'geweigerd'; p.eindMaand = st.maand;
        return { status: 200, ok: true, status2: 'geweigerd', wek: p.status === 'open' ? p.werkgever : p.werknemer };
      }
      if (antwoord === 'tegenbod') {
        const d0 = D.lopend(st).find(x => x.id === p.dienst);
        if (!d0) return { status: 404, error: 'Dat dienstverband loopt niet meer.' };
        const b = band(st, d0, p.naar);
        const vraag = Math.round(Number(zet.loon) || 0);
        if (!b || vraag < b.min || vraag > b.max)
          return { status: 400, error: 'Vraag tussen ' + (b ? b.min : 0) + ' en ' + (b ? b.max : 0) + '.' };
        if (vraag <= d0.loon)
          return { status: 400, error: 'Vraag meer dan je nu verdient (' + Math.round(d0.loon) + ').' };
        /* HET VOORSTEL WISSELT VAN KANT en wordt niet een nieuw voorstel: zo
           blijft het EEN gesprek met een geschiedenis, en niet een rij losse
           briefjes. */
        (p.tegenbiedingen = p.tegenbiedingen || []).push({ door: h, loon: vraag, maand: st.maand });
        p.loon = vraag;
        p.status = p.status === 'open' ? 'tegenbod' : 'open';
        return { status: 200, ok: true, status2: p.status, loon: vraag,
          wek: p.status === 'tegenbod' ? p.werkgever : p.werknemer };
      }
      if (antwoord !== 'ja') return { status: 400, error: 'Antwoord met ja, nee of tegenbod.' };
      const d = D.lopend(st).find(x => x.id === p.dienst);
      if (!d) return { status: 404, error: 'Dat dienstverband loopt niet meer.' };
      /* DE OVERGANG ZELF, en let op wat er NIET gebeurt: `sinds` en `maanden`
         blijven staan. Dit is dezelfde arbeidsrelatie, een trede hoger. */
      d.rol = p.naar;
      d.loon = p.loon;
      if (BS.isBestuur(p.naar)) d.vestiging = null;
      (d.promoties = d.promoties || []).push({ van: p.van, naar: p.naar, maand: st.maand, soort: p.soort });
      p.status = 'aangenomen'; p.eindMaand = st.maand;
      return { status: 200, ok: true, rol: d.rol, loon: d.loon, soort: p.soort,
        mag: (D.ROLLEN[d.rol] || {}).mag || (BS.BESTUURSROLLEN[d.rol] || {}).mag || [],
        wek: p.werkgever === h ? p.werknemer : p.werkgever };
    },

    /* INTREKKEN. Van beide kanten, want een voorstel dat blijft hangen is een
       verplichting -- en die vallen onder de afwezigheidsgrens. */
    'promotie-intrekken'(potje, h, zet) {
      const st = potje.staat;
      const p = lopende(st).find(x => x.id === String(zet.id || ''));
      if (!p) return { status: 404, error: 'Dat voorstel ligt er niet (meer).' };
      if (p.werkgever !== h && p.werknemer !== h)
        return { status: 403, error: 'Dat voorstel gaat niet over jou.' };
      p.status = 'ingetrokken'; p.eindMaand = st.maand;
      return { status: 200, ok: true };
    }
  };

  /* WAT ER OP JE SCHERM STAAT: wat er aan jou is voorgesteld, en wat jij hebt
     voorgesteld. Op codenaam, want de rest is een gesprek tussen twee mensen. */
  function beeld(st, h, codenaamVan) {
    return lopende(st).filter(p => p.werkgever === h || p.werknemer === h).map(p => ({
      id: p.id, van: p.van, naar: p.naar, naarNaam: (D.ROLLEN[p.naar] || {}).naam || p.naar,
      soort: p.soort, loon: p.loon, maand: p.maand,
      aanZet: p.status === 'open' ? codenaamVan(p.werknemer) : codenaamVan(p.werkgever),
      mijn: (p.status === 'open' ? p.werknemer : p.werkgever) === h,
      van_wie: codenaamVan(p.werkgever), aan: codenaamVan(p.werknemer),
      mag: (D.ROLLEN[p.naar] || {}).mag || (BS.BESTUURSROLLEN[p.naar] || {}).mag || []
    }));
  }

  return { ACTIES: ACTIETABEL, VRIJE_ACTIES: Object.keys(ACTIETABEL), beeld, TRAP, soortVan, band };
};
module.exports.TRAP = TRAP;
module.exports.soortVan = soortVan;
