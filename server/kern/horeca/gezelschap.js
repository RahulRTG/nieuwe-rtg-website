/* Horeca (kern): het GEZELSCHAP aan een rekening -- wie zit er, en wat staat er
   op wiens naam.

   WAT HIER NIET GEBEURT: er wordt geen model uitgevonden. Een rekening kent al
   `deelnemers` (nr, handle, lid, leeftijd) en een regel kent al `gastNr` --
   alleen kon je er tot nu toe uitsluitend via de GASTENDEUR bij. Wie de QR
   scande en aanschoof kreeg een stoel; de bediening die dezelfde tafel opnam,
   kon niets per persoon vastleggen. Dezelfde data, maar één van de twee kanten
   had geen deur. Deze module is die deur (LAT-regel 4: één waarheid, twee
   ingangen -- niet twee waarheden).

   DRIE DINGEN DIE HIER VASTLIGGEN.

   1. EEN STOEL IS GEEN SESSIE. Een deelnemer die de gast zelf aanmaakt door de
      QR te scannen, krijgt een `hash` van zijn sleutel; daarmee herkent
      kern/gast/sessie.js hem terug. Een stoel die de BEDIENING aanmaakt krijgt
      die hash NOOIT. Dat is geen detail maar de veiligheidsgrens: kon de
      bediening een deelnemer met sleutel aanmaken, dan was "voeg een stoel toe"
      een achterdeur waarmee je een gastsessie op een vreemde rekening opent.
      Een stoel is een plek aan tafel, geen inlog.

   2. EEN NUMMER WORDT NOOIT HERGEBRUIKT, ook niet als de stoel ertussenuit is
      gegaan -- daarvoor houdt de rekening een teller bij (zie volgendNummer).
      Een bon die bij de pas "stoel 2" zegt, mag na een wisseling niet ineens
      naar iemand anders wijzen. Wie een menselijke naam wil, geeft de stoel een
      `handle` ("bij het raam", "de jarige") -- het nummer draagt de identiteit,
      de handle de betekenis.

   3. EEN STOEL WEGHALEN HAALT NOOIT GELD WEG. De regels van die stoel vallen
      terug op de tafel (gastNr null, dus "gedeeld") en worden geteld en
      gemeld. Ze verdwijnen niet, want dan zou een tik op een kruisje een
      bestelling laten verdampen die de keuken al aan het maken is. */
'use strict';

module.exports = ({ horeca, schoon }) => {
  const { regelSom, nu } = horeca;

  // dezelfde grens als schuifAan() in kern/gast/sessie.js: één tafel, één feest
  const MAX = 40;

  function lijst(rek) {
    if (!Array.isArray(rek.deelnemers)) rek.deelnemers = [];
    return rek.deelnemers;
  }

  /* Het volgende stoelnummer, en waarom dit niet `max(nr) + 1` is.

     Dat was het wel, en een toets liet hem zakken: zit er nog één iemand
     (nr 1) omdat nr 2 is opgestaan, dan geeft max+1 opnieuw 2. De belofte
     "een nummer wordt nooit hergebruikt" heeft dus GEHEUGEN nodig, en dat
     geheugen is `stoelTeller` op de rekening -- het hoogste nummer dat hier
     ooit is uitgegeven. De `max()` blijft ernaast staan voor rekeningen die al
     bestonden voordat de teller er was.

     Deze functie is ook wat kern/gast/sessie.js gebruikt bij het aanschuiven.
     Zou die zijn eigen max+1 houden, dan hergebruikt de gastendeur nummers en
     de bedieningsdeur niet -- twee gedragingen op één model, en dat is precies
     de fout die deze module opheft. */
  function volgendNummer(rek) {
    const hoogste = lijst(rek).reduce((m, d) => Math.max(m, d.nr || 0), 0);
    const nr = Math.max(parseInt(rek.stoelTeller, 10) || 0, hoogste) + 1;
    rek.stoelTeller = nr;
    return nr;
  }

  /* Een stoel zoals de buitenwereld hem mag zien. De `hash` gaat er expres uit:
     dat is het geheim waarmee een gastsessie zich legitimeert, en die hoort
     nooit op een bedieningsscherm terecht te komen. */
  function publiek(d, regels) {
    const eigen = regels.filter((r) => r.gastNr === d.nr);
    return {
      nr: d.nr,
      handle: d.handle,
      lid: !!d.lid,
      // een stoel van de bediening heeft geen sleutel en dus geen eigen telefoon
      eigenSessie: !!d.hash,
      leeftijdGeverifieerd: !!d.leeftijdGeverifieerd,
      regels: eigen.length,
      centen: eigen.reduce((t, r) => t + regelSom(r), 0),
      allergieen: [...new Set(eigen.map((r) => r.allergie).filter(Boolean))],
      at: d.at || null
    };
  }

  /* Het gezelschap in één beeld: elke stoel met wat erop staat, plus wat op
     niemands naam staat. Die laatste hoop is geen restpost maar een echt ding
     -- de fles wijn voor de tafel hoort van iedereen te zijn, en verdeling.js
     rekent hem ook zo. */
  function beeld(rek) {
    const regels = rek.regels || [];
    const mensen = lijst(rek);
    const nummers = new Set(mensen.map((d) => d.nr));
    /* Defensief: een regel die naar een verdwenen stoel wijst telt als gedeeld
       in plaats van nergens. Anders zou zijn bedrag uit dit beeld vallen
       terwijl het wel op de rekening staat. */
    const gedeeld = regels.filter((r) => !r.gastNr || !nummers.has(r.gastNr));
    return {
      gasten: rek.gasten || 0,
      stoelen: mensen.map((d) => publiek(d, regels)),
      gedeeld: {
        regels: gedeeld.length,
        centen: gedeeld.reduce((t, r) => t + regelSom(r), 0),
        allergieen: [...new Set(gedeeld.map((r) => r.allergie).filter(Boolean))]
      },
      /* De optelsom staat erbij zodat een scherm hem kan tonen zonder zelf te
         rekenen, en zodat een toets hem tegen de rekening kan leggen. */
      centenTotaal: regels.reduce((t, r) => t + regelSom(r), 0)
    };
  }

  /* Een stoel erbij, of een bestaande hernoemen. Geen `hash`: zie punt 1. */
  function zetStoel(rek, invoer, wie) {
    const b = invoer || {};
    const mensen = lijst(rek);
    const naam = schoon(b.handle, 40);

    if (b.nr != null && String(b.nr) !== '') {
      const nr = parseInt(b.nr, 10);
      const d = mensen.find((x) => x.nr === nr);
      if (!d) return { status: 404, error: 'Stoel ' + b.nr + ' zit niet aan deze rekening.' };
      if (!naam) return { status: 400, error: 'Geef de stoel een naam.' };
      d.handle = naam;
      return { ok: true, stoel: publiek(d, rek.regels || []) };
    }

    if (mensen.length >= MAX) return { status: 409, error: 'Er zitten al ' + MAX + ' mensen op deze rekening.' };
    const nr = volgendNummer(rek);   // nooit hergebruiken (punt 2)
    const d = { nr, handle: naam || ('Stoel ' + nr), lid: false, leeftijd: null,
      leeftijdGeverifieerd: false, at: nu(), door: wie || null };
    mensen.push(d);
    // het aantal gasten volgt de stoelen, nooit andersom
    rek.gasten = Math.max(rek.gasten || 1, mensen.length);
    return { ok: true, stoel: publiek(d, rek.regels || []) };
  }

  /* Een stoel weg. Zijn regels vallen terug op de tafel en worden geteld --
     nooit verwijderd (punt 3). Een stoel MET eigen sessie kan de bediening niet
     zomaar wegklikken: daar hangt een telefoon aan die dan stil zou stoppen met
     werken. Die moet eerst zelf afsluiten. */
  function haalStoel(rek, nr, { ookMetSessie } = {}) {
    const mensen = lijst(rek);
    const n = parseInt(nr, 10);
    const i = mensen.findIndex((x) => x.nr === n);
    if (i < 0) return { status: 404, error: 'Stoel ' + nr + ' zit niet aan deze rekening.' };
    if (mensen[i].hash && !ookMetSessie) return { status: 409,
      error: 'Deze gast bestelt van zijn eigen telefoon. Laat hem afsluiten, of neem de rekening over.' };
    const los = (rek.regels || []).filter((r) => r.gastNr === n);
    for (const r of los) r.gastNr = null;
    const weg = mensen.splice(i, 1)[0];
    return { ok: true, stoel: weg.nr, handle: weg.handle, losgemaakt: los.length,
      let: los.length ? los.length + ' regel(s) staan nu op de tafel in plaats van op ' + weg.handle + '.' : null };
  }

  /* Een regel naar een stoel, of terug naar de tafel (nr leeg of 0).
     Verplaatst alleen een verwijzing; aan de regel zelf verandert niets. */
  function regelNaarStoel(rek, regelId, nr) {
    const r = (rek.regels || []).find((x) => x.id === String(regelId || ''));
    if (!r) return { status: 404, error: 'Die regel staat niet op deze rekening.' };
    const n = nr == null || String(nr) === '' ? 0 : parseInt(nr, 10);
    if (!n) { r.gastNr = null; return { ok: true, regel: r, naar: null }; }
    const d = lijst(rek).find((x) => x.nr === n);
    if (!d) return { status: 404, error: 'Stoel ' + nr + ' zit niet aan deze rekening.' };
    r.gastNr = d.nr;
    return { ok: true, regel: r, naar: d.nr, handle: d.handle };
  }

  /* De handle bij een nummer, voor een bon of een pas. Geeft null als de stoel
     niet (meer) bestaat -- de aanroeper toont dan gewoon niets, in plaats van
     "stoel undefined". */
  function handleVan(rek, nr) {
    if (!nr) return null;
    const d = (rek.deelnemers || []).find((x) => x.nr === nr);
    return d ? d.handle : null;
  }

  return { MAX, beeld, zetStoel, haalStoel, regelNaarStoel, handleVan, volgendNummer };
};
