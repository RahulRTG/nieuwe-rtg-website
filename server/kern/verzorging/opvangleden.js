/* De OUDERKANT van de kinderopvang: welke opvang is er, hoeveel plek, en een
   aanvraag klaarzetten.

   HDI.md par. 7.10 en de tabel in par. 4 laag 6. Kinderopvang bestond in dit
   huis al volledig -- groepen met een capaciteit, gescreende nanny's, een
   aanvraag die een mens bevestigt -- en elke route ernaartoe was een
   partnerroute. Een ouder kon er niet bij. Dat was geen ontbrekende functie
   maar een besluit dat nog niemand had genomen; dit bestand is dat besluit.

   Waarom dat uitmaakt staat in het voorbeeld waar de hele knelpuntlaag om
   draait: de bottleneck is niet motivatie, de bottleneck is kinderopvang. Zolang
   alleen de opvangorganisatie het aanbod kon zien, was het antwoord op die
   vraag "wij weten het wel, maar u niet".

   DE PROJECTIE IS HIER HET ONTWERP EN GEEN DETAIL. ./opvang.js houdt per groep
   een lijst `aanwezig` bij, en daar staan de VOORNAMEN VAN KINDEREN in met de
   naam van hun ouder erbij. Dat is de gevoeligste data van dit hele genre, en
   het is precies wat een ouder van een ander kind nooit te zien mag krijgen.
   Deze module leest die bak dus wel, maar geeft er per groep een GETAL uit:
   hoeveel plekken vrij. Zelfde regel voor de nanny's: een aantal gescreende
   nanny's, nooit hun namen -- dat zijn medewerkers op hun werkplek en die staan
   niet in een openbare lijst omdat ze toevallig in dezelfde bak wonen.

   Er is dus met opzet GEEN doorgeefluik naar opvang.overzicht(): wie dat zou
   doorgeven, lekt de hele aanwezigheidslijst. De projectie hieronder noemt elk
   veld dat eruit komt bij naam, zodat een nieuw veld in de bak niet vanzelf
   naar buiten reist.

   MAXIMAAL KLAARZETTEN, EN NIET MEER. COMMERCE.md par. 3 en APPSTORE.md grens 5:
   alles wat een derde raakt is klaarzetten. Een aanvraag komt binnen op
   `aangevraagd` en een mens bij de opvang bevestigt hem (opvang.nannyZet); RTG
   reserveert niets, belooft geen plek en zegt nergens dat het rond is. Het
   inschrijven van een kind in een groep (opvang.kindMeld) blijft daarom
   uitdrukkelijk bij de opvang: dat is de handeling waarmee een kind ergens
   staat, en die hoort een mens te doen die het kind heeft gezien.

   OP CODENAAM, zoals alles hier. De opvang ziet dezelfde naam als elke andere
   partner en niet meer dan dat (CLAUDE.md, privacy by design).

   Krijgt de opvang-kern mee in plaats van de bak opnieuw te openen; zelfde vorm
   en zelfde reden als ./beautyleden.js. */

const { TIJD, DATUM } = require('../genrehulp');

module.exports = ({ db, opvang }) => {
  const opvangVan = opvang.opvangVan;
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* Welke partners zijn een kinderopvang? De cap is de waarheid, niet een
     lijstje codes hier: wie het genre krijgt, staat er vanzelf bij. Dat is ook
     het besluit dat bij deze laag hoort -- ALLE partners met kinderopvang komen
     in beeld, niet alleen wie zich ergens voor aanmeldt. Een lijst die leeg
     begint, leest voor een ouder niet als "nog niemand aangemeld" maar als "er
     is niets", en dat is de verwarring die deze hele laag moet voorkomen. */
  const opvangen = () => (db.data.suppliers || []).filter(s => s && (db.capsVan(s) || []).includes('opvang'));
  const opvangMet = code => opvangen().find(s => s.code === String(code || ''));

  /* DE PROJECTIE. Elk veld staat hier met de hand; er wordt niets doorgegeven
     met een spread. Zie de kop: `aanwezig` mag hier nooit uit komen, en een
     nieuw veld in de bak hoort niet vanzelf mee te reizen. */
  function plek(p) {
    const o = opvangVan(p.code);
    return {
      code: p.code, naam: o.naam || p.name, waar: (p.loc && p.loc.label) || p.city || null,
      groepen: (o.groepen || []).map(g => ({
        id: g.id, naam: g.naam, capaciteit: g.capaciteit,
        /* Een GETAL en nooit de lijst. Dit is de hele reden dat deze module
           bestaat naast opvang.overzicht(). */
        vrij: Math.max(0, g.capaciteit - (g.aanwezig || []).length)
      })),
      /* Een aantal, geen namen: nanny's zijn medewerkers en horen niet in een
         lijst die elke ouder kan opvragen. */
      nannysGescreend: (o.nannies || []).filter(n => n && n.gescreend).length
    };
  }

  /* Het aanbod voor de ouder, plus wat er op zijn eigen codenaam openstaat. */
  function opvangwijzerOverzicht(codenaam) {
    return {
      ok: true,
      opvangen: opvangen().map(plek),
      mijn: opvangwijzerMijn(codenaam).aanvragen,
      /* De twee zinnen die deze laag eerlijk houden. Ze staan in het ANTWOORD en
         niet alleen in dit bestand, want een scherm dat ze vergeet laat een
         ouder anders denken dat een vrije plek een plek IS. */
      grens: 'Een vrije plek betekent dat er nu ruimte in de groep is, niet dat u hem heeft. Het ' +
        'inschrijven van een kind doet de opvang zelf, na een gesprek.',
      zelfDoen: 'RTG reserveert hier niets en vraagt niets voor u aan. U zet een aanvraag klaar; ' +
        'de opvang bevestigt hem, of niet.'
    };
  }

  /* Een aanvraag klaarzetten. Hij komt binnen op `aangevraagd` en blijft daar
     tot een mens bij de opvang hem bevestigt -- die stap zit in opvang.nannyZet
     en is hier met opzet niet na te bootsen. */
  function opvangwijzerVraag(sess, codenaam, body) {
    if (sess.tier === 'guest') return { status: 403, error: 'Een aanvraag klaarzetten kan met een lidmaatschap.' };
    const p = opvangMet(body.code);
    if (!p) return { status: 404, error: 'Deze opvang bestaat niet.' };
    const datum = String(body.datum || '');
    if (!DATUM.test(datum) || datum < vandaag()) return { status: 400, error: 'Kies een dag vanaf vandaag.' };
    if (!TIJD.test(String(body.van || '')) || !TIJD.test(String(body.tot || ''))) {
      return { status: 400, error: 'Kies een tijdvak.' };
    }
    /* De aanvraag gaat door de deur van de opvang zelf: die controleert het
       tijdvak, kapt de lijst af en bewaart. Twee plekken die hetzelfde
       schrijven, lopen uiteen (LAT.md regel 4), en db.data.opvang heeft een
       eigenaar (keuringsregel 63). */
    const r = opvang.nannyVraag(p.code, { gezin: codenaam, datum, van: body.van, tot: body.tot, wens: body.wens });
    if (!r.ok) return r;
    return { ok: true, aanvraag: { id: r.aanvraag.id, code: p.code, opvang: opvangVan(p.code).naam || p.name,
      datum: r.aanvraag.datum, van: r.aanvraag.van, tot: r.aanvraag.tot, status: r.aanvraag.status },
      wat_nu: 'De opvang heeft uw aanvraag. Zij bevestigen hem, of niet; er is nog niets vastgelegd.' };
  }

  /* Wat er op mijn codenaam openstaat, over alle opvangen heen. */
  function opvangwijzerMijn(codenaam) {
    const uit = [];
    for (const p of opvangen()) {
      const o = opvangVan(p.code);
      for (const a of (o.nannyBoekingen || [])) {
        if (a.gezin !== codenaam) continue;
        uit.push({ id: a.id, code: p.code, opvang: o.naam || p.name, datum: a.datum,
          van: a.van, tot: a.tot, status: a.status,
          /* De naam van de nanny staat er pas ALS het uw eigen bevestigde
             afspraak is. Daarvoor is het een medewerker in een lijst. */
          nanny: a.status === 'bevestigd' ? a.nanny : null });
      }
    }
    uit.sort((x, y) => (x.datum + x.van).localeCompare(y.datum + y.van));
    return { ok: true, aanvragen: uit };
  }

  /* Intrekken. Het schrijven gebeurt in ./opvang.js, want die bezit de bak; hier
     staat alleen wie het vraagt. Zie daar waarom deze knop moet bestaan. */
  function opvangwijzerWeg(codenaam, code, id) {
    const p = opvangMet(code);
    if (!p) return { status: 404, error: 'Deze opvang bestaat niet.' };
    return opvang.nannyWeg(p.code, id, codenaam);
  }

  return { opvangwijzer: { overzicht: opvangwijzerOverzicht, vraag: opvangwijzerVraag,
    mijn: opvangwijzerMijn, weg: opvangwijzerWeg } };
};
