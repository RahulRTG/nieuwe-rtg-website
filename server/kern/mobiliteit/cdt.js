/* Mobility OS (deelmodule): de CDT-registratie. Vanaf 1 januari 2028 gaat het
   Nederlandse taxivervoer van de boordcomputer over op de Centrale Database
   Taxivervoer: ritten en arbeids-, rij- en rusttijden worden dan langs die weg
   geregistreerd. Deze laag legt vast wat daarvoor nodig is.

   WAT HIER GEBEURT: de dienst van een chauffeur (aanmelden, rijden, andere
   werkzaamheden, pauze, afmelden) en de ritten die daaronder vallen. De
   rekenkant -- arbeidstijd, rijtijd, pauze en de grenzen -- staat in
   ./cdt-tijden; de uitvoer in ./cdt-export.

   DE RITTEN WORDEN NIET OVERGESCHREVEN. Ze staan al in de rittenmotor
   (mobOpdrachten) en worden hier per dienst OPGEZOCHT. Een tweede rittenlijst
   voor de inspectie zou binnen een maand uiteenlopen met de eerste, en dan heb
   je twee waarheden over wat er gereden is -- waarvan er een naar de overheid
   gaat (LAT.md regel 4).

   DE CHAUFFEURSKAART IS DE SLEUTEL, NIET DE NAAM. Een dienst hangt aan het
   kaartnummer van de chauffeur en aan de onderneming; dat is ook precies wat de
   registratie identificeert. In de rest van RTG draait alles op codenamen, maar
   hier kan dat niet: een inspectie moet een dienst aan een bevoegd persoon
   kunnen koppelen. Daarom staat het kaartnummer erop en verder zo min mogelijk.

   WAT DEZE LAAG NIET IS: een koppeling met de ILT. Aanleveren aan de CDT loopt
   via een ICT-dienstverlener die aan de eisen van de inspectie voldoet, en dat
   is RTG niet. Zie ./cdt-export, dat daar niet omheen draait. */

const { GRENZEN, SOORTEN, tel, signalen, rustSignaal } = require('./cdt-tijden');

const DIENST_MAX = 4000;          // bewaargrens in de json-stand; de export gaat eerder

module.exports = (ctx) => {
  const { db, save, id, schoon, nu, findSupplier, opdrachtenVanVervoerder, logActivity } = ctx;

  function ensureCdt() {
    if (!Array.isArray(db.data.mobDiensten)) db.data.mobDiensten = [];
    if (!db.data.mobCdtRegime || typeof db.data.mobCdtRegime !== 'object') db.data.mobCdtRegime = {};
  }
  const dienstenVan = code => { ensureCdt(); return db.data.mobDiensten.filter(d => d.vervoerder === code); };
  const openDienst = (code, kaart) => dienstenVan(code).find(d => d.chauffeurskaart === kaart && !d.eind) || null;

  // de grenzen van deze onderneming: de standaard, tenzij hij zijn eigen regime zette
  const regimeVan = code => Object.assign({}, GRENZEN, (db.data.mobCdtRegime || {})[code] || {});

  function regimeZet(code, body = {}) {
    ensureCdt();
    const eigen = {};
    for (const [k, v] of Object.entries(body.grenzen || {})) {
      if (!Object.prototype.hasOwnProperty.call(GRENZEN, k)) return { status: 400, error: 'Onbekende grens: ' + k };
      if (!Number.isFinite(v) || v <= 0 || v > 7 * 24 * 60) return { status: 400, error: 'De grens ' + k + ' moet in minuten en zinnig zijn.' };
      eigen[k] = Math.round(v);
    }
    if (!Object.keys(eigen).length) return { status: 400, error: 'Geef minstens een grens op.' };
    db.data.mobCdtRegime[code] = Object.assign({}, db.data.mobCdtRegime[code] || {}, eigen);
    save();
    return { ok: true, grenzen: regimeVan(code), standaard: GRENZEN };
  }

  /* Aanmelden. De chauffeurskaart is verplicht: zonder kaartnummer is er geen
     registratie die iets identificeert, en dan legt het systeem iets vast
     waarmee niemand iets kan. Fail-closed, net als bij de voertuigpapieren. */
  function dienstStart(supplier, actor, body = {}) {
    ensureCdt();
    const kaart = schoon(body.chauffeurskaart, 30).toUpperCase();
    if (!/^[A-Z0-9-]{4,30}$/.test(kaart))
      return { status: 400, error: 'Vul het nummer van de chauffeurskaart in; zonder kaart is er geen registratie.' };
    if (openDienst(supplier.code, kaart))
      return { status: 409, error: 'Deze chauffeurskaart heeft al een lopende dienst; meld die eerst af.' };

    const start = nu();
    // de rust sinds de vorige dienst is een signaal bij het BEGIN, niet achteraf
    const vorige = dienstenVan(supplier.code).filter(d => d.chauffeurskaart === kaart && d.eind)
      .sort((a, b) => a.eind.localeCompare(b.eind)).pop();
    const rust = vorige ? rustSignaal(new Date(vorige.eind).getTime(), new Date(start).getTime(), regimeVan(supplier.code)) : null;

    const d = { id: id('dn'), vervoerder: supplier.code, chauffeurskaart: kaart,
      voertuig: schoon(body.voertuig, 40) || null,
      start, eind: null, blokken: [{ soort: 'ander', van: start, tot: null }],
      startSignalen: rust ? [rust] : [], gemeldDoor: schoon(actor, 60) || 'chauffeur' };
    db.data.mobDiensten.push(d);
    if (db.data.mobDiensten.length > DIENST_MAX) db.data.mobDiensten = db.data.mobDiensten.slice(-DIENST_MAX);
    save();
    logActivity(supplier.code, actor, 'meldde zich aan op kaart ' + kaart);
    return { ok: true, dienst: dienstBeeld(d), signalen: rust ? [rust] : [] };
  }

  /* Overschakelen naar een andere soort werk. Er is altijd precies EEN open
     blok: het lopende blok wordt gesloten op hetzelfde moment waarop het
     volgende begint. Zonder die koppeling ontstaan er gaten of overlappingen in
     de tijdlijn, en dan telt de arbeidstijd niet meer op. */
  function dienstSoort(supplier, actor, body = {}) {
    ensureCdt();
    const kaart = schoon(body.chauffeurskaart, 30).toUpperCase();
    const d = openDienst(supplier.code, kaart);
    if (!d) return { status: 404, error: 'Geen lopende dienst op deze chauffeurskaart.' };
    const soort = schoon(body.soort, 20);
    if (!SOORTEN[soort]) return { status: 400, error: 'Onbekende soort: ' + Object.keys(SOORTEN).join(', ') };

    const t = nu();
    const open = d.blokken.find(b => !b.tot);
    if (open && open.soort === soort)
      return { status: 409, error: 'De chauffeur staat al op "' + SOORTEN[soort].naam.toLowerCase() + '".' };
    if (open) open.tot = t;
    d.blokken.push({ soort, van: t, tot: null });
    save();
    const beeld = dienstBeeld(d);
    return { ok: true, dienst: beeld, signalen: beeld.signalen };
  }

  /* Afmelden. Het laatste blok sluit, en de dienst krijgt zijn eindstand mee:
     die telling is wat er straks de deur uit gaat, dus die wordt hier vastgezet
     en niet elke keer opnieuw gerekend uit een lijst die nog kan bewegen. */
  function dienstEind(supplier, actor, body = {}) {
    ensureCdt();
    const kaart = schoon(body.chauffeurskaart, 30).toUpperCase();
    const d = openDienst(supplier.code, kaart);
    if (!d) return { status: 404, error: 'Geen lopende dienst op deze chauffeurskaart.' };
    const t = nu();
    const open = d.blokken.find(b => !b.tot);
    if (open) open.tot = t;
    d.eind = t;
    const som = tel(d.blokken, new Date(t).getTime());
    d.som = { arbeidMin: som.arbeidMin, rijMin: som.rijMin, pauzeMin: som.pauzeMin };
    d.signalen = signalen(som, regimeVan(supplier.code));
    save();
    logActivity(supplier.code, actor, 'meldde zich af op kaart ' + kaart +
      ' (' + Math.round(som.arbeidMin / 6) / 10 + ' uur arbeid)');
    return { ok: true, dienst: dienstBeeld(d) };
  }

  /* De ritten die onder een dienst vallen: opgezocht in de rittenmotor, op
     voertuig en tijdvenster. Niet gekopieerd -- zie de kop van dit bestand. */
  function rittenVan(d) {
    const van = new Date(d.start).getTime();
    const tot = d.eind ? new Date(d.eind).getTime() : Date.now();
    return (opdrachtenVanVervoerder(d.vervoerder) || []).filter(o => {
      if (d.voertuig && o.voertuig && o.voertuig !== d.voertuig) return false;
      const t = new Date(o.gemaakt).getTime();
      return t >= van && t <= tot;
    });
  }

  function dienstBeeld(d) {
    const lopend = !d.eind;
    const som = lopend ? tel(d.blokken) : tel(d.blokken, new Date(d.eind).getTime());
    const sig = lopend ? signalen(som, regimeVan(d.vervoerder)) : (d.signalen || []);
    const ritten = rittenVan(d);
    return { id: d.id, vervoerder: d.vervoerder, chauffeurskaart: d.chauffeurskaart,
      voertuig: d.voertuig, start: d.start, eind: d.eind, lopend,
      huidigeSoort: (d.blokken.find(b => !b.tot) || {}).soort || null,
      arbeidMin: som.arbeidMin, rijMin: som.rijMin, pauzeMin: som.pauzeMin,
      blokken: som.blokken, signalen: (d.startSignalen || []).concat(sig),
      ritten: ritten.length, ritRefs: ritten.map(o => o.ref), grenzen: regimeVan(d.vervoerder) };
  }

  /* Het bord van de onderneming: wie er nu rijdt en wat er vandaag staat. De
     werkgever is verantwoordelijk voor de registratie, dus die moet hem zien. */
  function cdtBeeld(supplier, body = {}) {
    ensureCdt();
    const dag = /^\d{4}-\d{2}-\d{2}$/.test(String(body.datum || '')) ? String(body.datum) : nu().slice(0, 10);
    const alle = dienstenVan(supplier.code);
    const vandaag = alle.filter(d => d.start.slice(0, 10) === dag || (d.eind && d.eind.slice(0, 10) === dag));
    const beelden = vandaag.map(dienstBeeld);
    return { ok: true, datum: dag, vervoerder: supplier.code,
      lopend: beelden.filter(b => b.lopend), afgerond: beelden.filter(b => !b.lopend),
      signalen: beelden.flatMap(b => b.signalen.map(s => Object.assign({ chauffeurskaart: b.chauffeurskaart }, s))),
      grenzen: regimeVan(supplier.code), standaardGrenzen: GRENZEN };
  }

  return { ensureCdt, dienstStart, dienstSoort, dienstEind, dienstBeeld, cdtBeeld,
    dienstenVan, openDienst, rittenVan, regimeVan, regimeZet, CDT_SOORTEN: SOORTEN, CDT_GRENZEN: GRENZEN };
};
