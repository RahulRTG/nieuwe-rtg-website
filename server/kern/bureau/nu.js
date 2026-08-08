/* Het Privekantoor, deelbestand "nu": de Situation Room.

   Eén scherm dat de vraag beantwoordt die een lid met een vol leven 's ochtends
   heeft: hoef ik iets te doen? Niet "hier zijn twaalf apps met elk een badge",
   maar één kop en daaronder de regels die die kop waarmaken.

   De kop is een BEWERING en dus telt hij precies. "Alles onder controle" mag hier
   alleen staan als er niets achterstallig is, niets op een besluit wacht en geen
   enkele bron stuk is. Een geruststelling die soms onterecht is, is erger dan
   geen geruststelling: dan gaat het lid het scherm wantrouwen en alsnog twaalf
   apps openen, en dan hebben wij niets opgelost.

   Vandaar ook dat een KAPOTTE BRON een regel krijgt en geen stilte. Als Cellier
   omvalt telt de tower zijn flessen niet meer -- en zonder deze regel zou het
   scherm dan "alles onder controle" zeggen, wat op dat moment letterlijk niet te
   weten is. Regel 5 van de lat: als iets niet gebeurt, hoort dat ergens te staan.

   Gemount via ./index.js. */
'use strict';

/* De ernst van een regel bepaalt de volgorde op het scherm en de kleur ervan.
   Hoog = er gaat iets kapot als u niets doet. */
const HOOG = 3, MIDDEN = 2, LAAG = 1;

module.exports = (ctx) => {
  const { tower, cases, samenvatting, graaf } = ctx;
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function nuBeeld(key, voorafG, voorafT) {
    // ook de tower mag meekomen: hij sorteert twaalfduizend termijnen, en dat
    // twee keer per scherm doen is dezelfde verspilling als de graaf twee keer
    // bouwen (zie ./index.js)
    const t = voorafT || tower(key, voorafG);
    const cs = cases(key);
    const sam = samenvatting(key, voorafG);
    const regels = [];

    /* 1. Wat er stuk is. Bovenaan, want dit maakt de rest van het scherm
          onbetrouwbaar en dat hoort het lid als eerste te weten. */
    for (const kamer of sam.stuk) {
      regels.push({ ernst: HOOG, soort: 'storing', tekst: 'Wij kunnen ' + kamer + ' nu niet uitlezen.',
        detail: 'Deze kamer telt niet mee in het overzicht hieronder. Onze techniek heeft er bericht van.' });
    }

    /* 1b. Wat er wel is maar niet getoond wordt. Geen storing, wel iets wat het
          lid hoort te weten voordat hij op dit scherm afgaat. */
    for (const a of (sam.afgekapt || [])) {
      regels.push({ ernst: MIDDEN, soort: 'afgekapt',
        tekst: 'Wij tonen de eerste ' + a.dak + ' uit ' + a.bron,
        detail: 'U heeft er meer dan ' + a.dak + '; wat daarna komt staat hier niet.' });
    }

    /* 2. Wat al te laat is. */
    for (const r of t.achterstallig) {
      regels.push({ ernst: r.zwaar ? HOOG : MIDDEN, soort: 'achterstallig',
        tekst: (r.waarvan ? r.waarvan + ' · ' : '') + r.wat + ' is verlopen',
        detail: 'Sinds ' + r.datum + ' (' + Math.abs(r.dagen) + ' dagen).', kamer: r.kamer });
    }

    /* 3. Wat op uw handtekening wacht. */
    for (const c of cs.zaken.filter(x => x.beslissing.nodig)) {
      regels.push({ ernst: MIDDEN, soort: 'beslissing', id: c.id, tekst: c.titel,
        detail: c.delegatie.reden, kamer: c.domein });
    }

    /* 4. Wat er deze week speelt. */
    const week = (t.vensters.find(v => v.sleutel === 'week') || { items: [] }).items;
    for (const r of week) {
      regels.push({ ernst: r.zwaar ? MIDDEN : LAAG, soort: 'komt',
        tekst: (r.waarvan ? r.waarvan + ' · ' : '') + r.naam,
        detail: r.dagen === 0 ? 'Vandaag.' : r.dagen === 1 ? 'Morgen.' : 'Over ' + r.dagen + ' dagen (' + r.datum + ').',
        kamer: r.kamer });
    }

    /* 5. Wat wij voor u aan het doen zijn. Eén regel, geen lijst: dit is
          geruststelling, geen werkvoorraad. */
    const lopend = cs.zaken.filter(c => c.status === 'in uitvoering').length;
    if (lopend) {
      regels.push({ ernst: LAAG, soort: 'loopt', tekst: lopend === 1 ? 'Eén zaak loopt' : lopend + ' zaken lopen',
        detail: 'Wij zijn ermee bezig; u hoeft niets te doen.' });
    }

    regels.sort((a, b) => b.ernst - a.ernst);

    /* De kop. De volgorde van deze vier gevallen is de volgorde waarin ze het
       lid raken, en elk geval noemt een getal dat uit de regels hierboven komt
       -- niet uit een aparte telling, want twee tellingen van hetzelfde lopen
       uiteen (regel 4 van de lat). */
    const beslissingen = cs.beslissingen;
    const storingen = sam.stuk.length;
    const aandacht = t.achterstallig.length;
    let kop, ernst;
    if (storingen) { kop = 'Wij missen even zicht op ' + storingen + (storingen === 1 ? ' kamer' : ' kamers'); ernst = 'storing'; }
    else if (t.achterstalligZwaar) { kop = aandacht + (aandacht === 1 ? ' zaak vraagt' : ' zaken vragen') + ' aandacht'; ernst = 'hoog'; }
    else if (beslissingen) { kop = 'Alles onder controle, ' + beslissingen + (beslissingen === 1 ? ' beslissing' : ' beslissingen') + ' nodig'; ernst = 'besluit'; }
    else if (aandacht) { kop = aandacht + (aandacht === 1 ? ' punt' : ' punten') + ' open'; ernst = 'midden'; }
    else { kop = 'Alles onder controle'; ernst = 'rustig'; }

    return {
      status: 200,
      kop, ernst, regels: regels.slice(0, 40),
      tellingen: {
        beslissingen, lopend, achterstallig: aandacht, storingen,
        afgekapt: (sam.afgekapt || []).length,
        dezeWeek: week.length, knopen: sam.knopen, waarde: sam.waarde
      },
      datum: vandaag()
    };
  }

  /* De verkenner: één knoop met alles wat eraan hangt. Dit is de graaf zoals een
     mens hem gebruikt -- niet als plaatje met bolletjes, maar als de vraag "wat
     raakt dit nog meer als ik eraan kom?" */
  function knoopDetail(key, id) {
    const g = graaf(key);
    const k = g.perId.get(id);
    if (!k) return { status: 404, error: 'Dit staat niet in uw kantoor.' };
    const kinderen = g.knopen.filter(x => x.ouder === id);
    const ouder = k.ouder ? g.perId.get(k.ouder) || null : null;
    // broers en zussen: wat aan dezelfde ouder hangt. Zonder ouder: wat in
    // dezelfde kamer uit dezelfde bron komt.
    const naast = k.ouder
      ? g.knopen.filter(x => x.ouder === k.ouder && x.id !== id)
      : g.knopen.filter(x => !x.ouder && x.kamer === k.kamer && x.id !== id).slice(0, 20);
    return { status: 200, knoop: k, ouder, kinderen, naast };
  }

  return { nuBeeld, knoopDetail };
};
