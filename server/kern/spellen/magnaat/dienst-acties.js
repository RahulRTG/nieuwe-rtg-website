/* Magnaat: WAT EEN SPELER MET LOONDIENST DOET -- de zes handelingen.

   De wetten staan in ./dienst.js; dit bestand doet er iets mee. Dezelfde
   scheiding als bij de AI-manager en de AI-concurrent, en om dezelfde reden: de
   lijst handelingen groeit met elke fase mee en de wetten niet.

   ALLE ZES ZIJN VRIJE ACTIES. Een sollicitatie die op je beurt moet wachten,
   duurt in een partij van zes met 24 uur per beurt een week -- precies de
   redenering waarmee de contractacties in ./handel-acties.js vrij werden
   (GAMEHALL.md 12.3). Solliciteren is bovendien iets wat je doet omdat je het
   ziet, niet omdat het jouw beurt is.

   EEN WERKNEMER VERANDERT NIETS RECHTSTREEKS. `werk-beleid` is met opzet geen
   nieuwe manier om aan een vestiging te zitten: hij controleert de rol en roept
   dan de GEWONE `beleid`-actie aan, met de eigenaar als handelende speler. Zou
   hij zelf het veld zetten, dan bestaat er een tweede weg naar dezelfde
   verandering -- en dan is de vraag "wie mag dit" op twee plekken beantwoord.
   Dat is de wet van ./beheer.js, hier toegepast op een mens. */
const D = require('./dienst');
const BS = require('./bestuur');
const { SECTOREN } = require('./sectoren');

module.exports = ({ K, mijnVestiging, wieHeeft, ACTIES, rond, herkomst }) => {
  const vind = (st, id) => (st.vestigingen ? Object.values(st.vestigingen).flat()
    .find(v => v.id === id) : null) || null;

  /* Het loon dat bij deze functie hoort. Voor een zaakrol uit de SECTOR van de
     vestiging; voor een bestuursrol uit de OMZET van het hele concern, want een
     directeur van twaalf zaken heeft een grotere baan dan een van een. Zie
     ./bestuur.js. Een vraag, een antwoord: de drie acties hieronder hoeven het
     onderscheid verder nergens te maken. */
  const bandVan = (st, werkgever, v, rol) => BS.isBestuur(rol)
    ? BS.bestuursband(st, werkgever, rol)
    : D.loonband(SECTOREN[v.sector].loon, rol);
  /* EEN BESTUURDER HEEFT GEEN VESTIGING, en dat is geen gebrek maar zijn hele
     onderscheid: hij werkt voor het concern. Deze twee regels zijn de enige
     plek waar dat in de sollicitatieweg iets uitmaakt. */
  const zaakVan = (st, f) => (BS.isBestuur(f.rol) ? true : vind(st, f.vestiging));

  /* Wat een speler ZIET staat in ./dienst-beeld.js -- daar wat hij ziet, hier
     wat hij doet. Zie de uitleg daar. */
  const { beeld } = require('./dienst-beeld')({ vind, herkomst });

  const ACTIETABEL = {
    /* EEN FUNCTIE OPENSTELLEN. De werkgever zegt: bij deze zaak is deze rol te
       vergeven, voor dit bedrag. Het bedrag staat er meteen bij, want een
       vacature zonder loon laat de kandidaat gokken en dan zet iedereen laag in. */
    'functie-openen'(potje, h, zet) {
      const st = potje.staat;
      const rol = String(zet.rol || '');
      if (!D.ROLLEN[rol]) return { status: 400, error: 'Die rol bestaat niet.' };
      /* EEN BESTUURDER WORDT NIET BIJ EEN ZAAK GEZOCHT MAAR BIJ EEN CONCERN, en
         zonder zaken is er niets te besturen -- dan is de vacature een titel. */
      const bestuur = BS.isBestuur(rol);
      const v = bestuur ? null : mijnVestiging(st, h, String(zet.vestiging || ''));
      if (!bestuur && !v) return { status: 400, error: 'Dat is niet jouw zaak.' };
      if (bestuur && !((st.vestigingen[h] || []).length))
        return { status: 400, error: 'Je hebt nog geen zaken om te laten besturen.' };
      const band = bandVan(st, h, v, rol);
      const loon = Math.round(Number(zet.loon) || band.basis);
      if (loon < band.min || loon > band.max)
        return { status: 400, error: 'Een loon voor deze rol ligt tussen ' + band.min + ' en ' + band.max + '.' };
      /* EEN ROL PER ZAAK, want twee bedrijfsleiders op een zaak is geen
         organisatie maar een onduidelijkheid. Wie de rol wil wisselen, zegt de
         lopende op. */
      /* EEN ROL PER PLEK: bij een zaakrol is die plek de vestiging, bij een
         bestuursrol het concern -- twee financieel directeuren is geen
         organisatie maar een onduidelijkheid, net als twee bedrijfsleiders op
         een zaak. */
      const bezet = bestuur
        ? D.lopend(st).some(d => d.werkgever === h && d.rol === rol)
        : D.dienstenBij(st, v.id).some(d => d.rol === rol);
      if (bezet) return { status: 409, error: 'Die rol is al vervuld.' };
      if (D.functies(st).some(f => f.status === 'open' && f.rol === rol
        && (bestuur ? f.werkgever === h : f.vestiging === v.id)))
        return { status: 409, error: 'Die functie staat al open.' };
      const f = { id: 'f' + (++st.functieTeller || (st.functieTeller = 1)),
        werkgever: h, vestiging: bestuur ? null : v.id,
        sector: bestuur ? null : v.sector, rol, loon,
        maand: st.maand, status: 'open', sollicitaties: [] };
      D.functies(st).push(f);
      return { status: 200, ok: true, id: f.id, loon };
    },

    'functie-intrekken'(potje, h, zet) {
      const st = potje.staat;
      const f = D.functies(st).find(x => x.id === String(zet.id || ''));
      if (!f || f.werkgever !== h) return { status: 404, error: 'Die functie bestaat niet.' };
      if (f.status !== 'open') return { status: 409, error: 'Die functie staat niet meer open.' };
      f.status = 'ingetrokken';
      return { status: 200, ok: true };
    },

    /* SOLLICITEREN. Je zegt wat je wilt verdienen; binnen de band, want anders is
       het geen bod maar een cadeau in een van beide richtingen. */
    solliciteren(potje, h, zet) {
      const st = potje.staat;
      const f = D.functies(st).find(x => x.id === String(zet.id || ''));
      if (!f || f.status !== 'open') return { status: 404, error: 'Die functie staat niet open.' };
      if (f.werkgever === h) return { status: 400, error: 'Je kunt niet bij jezelf solliciteren.' };
      /* EEN BAAN TEGELIJK. Niet omdat twee banen onmogelijk zijn, maar omdat de
         hele laag over EEN relatie gaat en een speler die overal in dienst is
         niemands werknemer meer is. Stap 2 kan dit verruimen; dan hangt het aan
         het echte model (kern/concern/employment.js), dat meerdere
         dienstverbanden per persoon al kent. */
      if (D.dienstVan(st, h)) return { status: 409, error: 'Je hebt al een baan. Zeg die eerst op.' };
      if (f.sollicitaties.some(s => s.speler === h))
        return { status: 409, error: 'Je hebt hier al gesolliciteerd.' };
      const v = zaakVan(st, f);
      if (!v) return { status: 404, error: 'Die zaak bestaat niet meer.' };
      const band = bandVan(st, f.werkgever, v, f.rol);
      const vraag = Math.round(Number(zet.loon) || f.loon);
      if (vraag < band.min || vraag > band.max)
        return { status: 400, error: 'Vraag tussen ' + band.min + ' en ' + band.max + '.' };
      f.sollicitaties.push({ speler: h, loon: vraag, maand: st.maand });
      return { status: 200, ok: true, gevraagd: vraag };
    },

    /* AANNEMEN. De werkgever kiest een sollicitant en het loon dat ER STAAT --
       dat van de sollicitatie, niet dat van de vacature. Anders is een
       tegenbod van de kandidaat een briefje dat niemand leest. */
    aannemen(potje, h, zet) {
      const st = potje.staat;
      const f = D.functies(st).find(x => x.id === String(zet.id || ''));
      if (!f || f.werkgever !== h) return { status: 404, error: 'Die functie bestaat niet.' };
      if (f.status !== 'open') return { status: 409, error: 'Die functie staat niet meer open.' };
      const wie = String(zet.speler || '');
      const s = f.sollicitaties.find(x => x.speler === wie);
      if (!s) return { status: 404, error: 'Die sollicitatie bestaat niet.' };
      if (D.dienstVan(st, wie)) return { status: 409, error: 'Die speler is inmiddels ergens anders begonnen.' };
      if (!zaakVan(st, f)) return { status: 404, error: 'Die zaak bestaat niet meer.' };
      const d = { id: 'd' + (++st.dienstTeller || (st.dienstTeller = 1)),
        werkgever: h, werknemer: wie, vestiging: f.vestiging, rol: f.rol,
        loon: s.loon, sinds: st.maand, maanden: 0, betaaldTotaal: 0, status: 'loopt' };
      D.dienstverbanden(st).push(d);
      f.status = 'vervuld';
      return { status: 200, ok: true, id: d.id, loon: d.loon };
    },

    /* OPZEGGEN EN ONTSLAAN zijn dezelfde handeling met een andere kant en een
       andere reden, en ze staan er allebei zonder boete of opzegtermijn. Een
       baan waar je niet uit kunt is een verplichting; zie ./dienst.js grens 3. */
    'dienst-opzeggen'(potje, h, zet) {
      const st = potje.staat;
      const d = D.lopend(st).find(x => x.id === String(zet.id || ''));
      if (!d) return { status: 404, error: 'Dat dienstverband bestaat niet.' };
      if (d.werknemer !== h && d.werkgever !== h)
        return { status: 403, error: 'Dat dienstverband is niet van jou.' };
      d.status = 'geeindigd';
      d.tot = st.maand;
      d.reden = d.werknemer === h ? 'opgezegd' : 'ontslagen';
      return { status: 200, ok: true, reden: d.reden };
    }
  };

  /* WAT IEMAND NAMENS EEN ANDER DOET staat in ./dienst-delegeren.js. Dat is een
     echte naad: hierboven staat hoe een dienstverband ONTSTAAT (vacature,
     sollicitatie, aannemen, opzeggen) en dat is af; daar staat wat een rol
     vervolgens MAG, en die lijst groeit met elke fase mee -- fase D zette er het
     bestuur bij. */
  Object.assign(ACTIETABEL, require('./dienst-delegeren')({ ACTIES }));

  return { ACTIES: ACTIETABEL, VRIJE_ACTIES: Object.keys(ACTIETABEL), beeld };
};
