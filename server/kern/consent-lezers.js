/* ============================================================================
   HET CONSENT CENTER, deel "lezers": de negen lagen uitlezen en naast elkaar
   zetten.

   Afgesplitst van ./consent.js op de 10 kB-grens, en op een echte naad -- dezelfde
   die accounts/tokens.js van accounts/intreklijst.js scheidt. Dit bestand LEEST
   negen lagen en maakt er rijen van; ./consent.js beslist wat er met een rij mag
   gebeuren en stuurt het intrekken door. Twee soorten werk: een fout hier is een
   rij die ontbreekt of dubbel staat, een fout daar is een toestemming die niet
   wordt ingetrokken terwijl het scherm zegt van wel.

   ELKE RIJ HEEFT DEZELFDE VORM, en dat is wat de firewall
   (./consent-relaties.js) mogelijk maakt:

     { laag, id, wie, partij, wat, tot, richting, intrekbaar }

   `wie` is tekst voor een mens; `partij` is de stabiele sleutel om op te
   groeperen. Zie de uitleg bij `sleutel` hieronder waarom dat twee velden
   moeten zijn.
   ========================================================================== */
'use strict';

const klok = require('../lib/klok');

/* DE PARTIJSLEUTEL, naast de weergavenaam.

   `wie` is tekst die een mens leest, en daar mag je niet op groeperen. Twee
   redenen, en allebei zijn het echte fouten en geen theorie:

     - de lagen vullen hem als `supplierName || supplierCode`. Ontbreekt de naam
       een keer, dan valt DEZELFDE zaak in twee groepen -- een keer onder zijn
       naam en een keer onder zijn code;
     - twee verschillende partijen kunnen dezelfde naam dragen, en dan zou
       "sluit deze relatie" bij de verkeerde aankomen.

   Vandaar een aparte sleutel, met de CODE als bron en de naam alleen als
   terugval. Waar een laag helemaal geen partij kent, is de sleutel `null` --
   die rijen worden niet gegroepeerd en dat is eerlijker dan ze aan elkaar
   plakken omdat hun label toevallig gelijk is. */
const sleutel = (v) => {
  const t = String(v == null ? '' : v).trim().toLowerCase();
  return t ? t.slice(0, 80) : null;
};

const dagVan = d => (d ? String(d).slice(0, 10) : null);
/* Een dag is genoeg voor een toestemming die weken loopt. De paspoort-inzage
   duurt tien minuten, en "Tot 2026-08-18" leest daar als "de hele dag nog". */
const stipVan = d => (d ? String(d).slice(0, 10) + ' ' + String(d).slice(11, 16) : null);
const NIVEAU_TEKST = {
  idkaart: 'Uw ID-kaart: pasfoto, naam, nationaliteit en geboortedatum',
  paspoort: 'De volledige paspoortscan'
};

module.exports = ({ kern, LAGEN, NIET_GEDEKT }) => {
  function lees(naam, fn) {
    if (typeof fn !== 'function') return { waarde: null };
    try { return { waarde: fn() }; }
    catch (e) { return { fout: naam + ': ' + (e && e.message ? e.message : 'onbekende storing') }; }
  }

  function consentVan(key) {
    const uit = [];
    const storingen = [];
    const pak = (naam, fn) => { const r = lees(naam, fn); if (r.fout) storingen.push(r.fout); return r.waarde; };

    const care = pak('Zorg', kern.careOverzicht && (() => kern.careOverzicht(key)));
    for (const i of (care && care.intakes) || []) {
      uit.push({ laag: 'care-intake', id: i.id, wie: i.aanbiederNaam, partij: sleutel(i.aanbiederCode || i.aanbiederNaam),
        wat: 'De medische context die u apart met deze aanbieder deelde',
        tot: i.vervaltOp, richting: 'ziet', intrekbaar: true });
    }

    const vast = pak('Vastleggen', kern.vastleggingenVan && (() => kern.vastleggingenVan(key)));
    for (const v of (vast && vast.vastleggingen) || []) {
      uit.push({ laag: 'care-vastlegging', id: v.id, wie: v.aanbiederNaam, partij: sleutel(v.aanbiederCode || v.aanbiederNaam),
        wat: 'Mag metingen in uw dossier vastleggen (bij een afspraak)',
        tot: null, richting: 'schrijft', intrekbaar: true });
    }

    /* De paspoortlaag beheert haar eigen toestemming: keurt een lid een verzoek
       goed, dan krijgt de partner een VENSTER waarin hij de ID-kaart of de scan
       mag openen. Dat staat open tot het vervalt of tot het lid het sluit, dus
       het hoort hier -- ook al vindt de dekkingstoets het niet.

       HET VENSTER WORDT HIER ZELF NAGEREKEND, en dat is geen dubbel werk.
       `mijnVerzoeken` schoont niet op; dat doet alleen de partnerkant
       (`vervalOpschonen` in partnerVerzoeken). Een verlopen goedkeuring staat
       dus nog met status 'goedgekeurd' in de lijst. Zou dit scherm die
       overnemen, dan meldt het een inzage die allang dicht is -- precies de
       schijnzekerheid waar dit bestand bovenaan voor waarschuwt. Vervallen is
       hier dus WEG, niet grijs. */
    const pas = pak('Paspoort', kern.paspoortMijn && (() => kern.paspoortMijn(key)));
    const nuMs = klok.nu();
    for (const v of pas || []) {
      if (v.status !== 'goedgekeurd') continue;
      if (v.vervalt && Date.parse(v.vervalt) < nuMs) continue;
      uit.push({ laag: 'paspoort-inzage', id: v.id, wie: v.supplierName || v.supplierCode, partij: sleutel(v.supplierCode),
        wat: (NIVEAU_TEKST[v.niveau] || 'gegevens uit uw identiteitsbewijs') +
          (v.incident ? ' (vrijgegeven door RTG na een incident)' : ''),
        tot: stipVan(v.vervalt), richting: 'ziet', intrekbaar: true });
    }

    const id = pak('RTG iD', kern.rtgid && kern.rtgid.inzage && (() => kern.rtgid.inzage(key)));
    for (const s of (id && id.sessies) || []) {
      uit.push({ laag: 'rtgid-sessie', id: s.dienst, wie: s.dienst, partij: sleutel(s.dienst),
        wat: (s.attributen || []).join(', ') || 'gegevens uit uw RTG iD',
        tot: dagVan(s.verloopt), richting: 'ziet', intrekbaar: true });
    }
    for (const m of (id && id.machtigingen) || []) {
      if (m.ik !== 'geef') continue;   // wat u KRIJGT is geen toestemming die u geeft
      uit.push({ laag: 'rtgid-machtiging', id: m.id, wie: m.naar, partij: sleutel(m.naar),
        wat: 'Mag namens u inloggen bij ' + m.dienst,
        tot: dagVan(m.tot), richting: 'doet', intrekbaar: true });
    }

    const loc = pak('Locatie', kern.locMijn && (() => kern.locMijn(key)));
    for (const d of (loc && loc.actief) || []) {
      uit.push({ laag: 'locatie', id: d.id, wie: d.supplierName || d.supplierCode, partij: sleutel(d.supplierCode),
        wat: 'Kijkt live mee met waar u bent', tot: null, richting: 'ziet', intrekbaar: true });
    }

    const zorg = pak('Zorgprofiel', kern.zorgVan && (() => kern.zorgVan(key)));
    if (zorg && zorg.delen) {
      const stukken = [(zorg.allergenen || []).length ? 'allergenen' : null, zorg.dieet ? 'dieet' : null,
        zorg.medisch ? 'aandachtspunten' : null].filter(Boolean);
      uit.push({ laag: 'zorgprofiel', id: 'profiel', wie: 'Zaken waar u bestelt of verblijft', partij: null,
        wat: stukken.length ? stukken.join(', ') : 'uw zorgprofiel',
        tot: null, richting: 'ziet', intrekbaar: true });
    }

    /* De naamvrijgave uit Metier: de zaak krijgt geen KOPIE van uw naam maar het
       recht hem live uit de kluis te lezen. Daarom staat `wat` er zo: intrekken
       sluit de deur, en er ligt niets achter dat blijft staan. */
    const met = pak('Metier', kern.metierBewijs && kern.metierBewijs.mijnToestemmingen
      && (() => kern.metierBewijs.mijnToestemmingen(key)));
    for (const g of (met && met.toestemmingen) || []) {
      if (!g.actief) continue;
      uit.push({ laag: 'metier-naam', id: g.code, wie: g.zaak || g.code, partij: sleutel(g.code),
        wat: 'Mag uw echte naam opvragen' + (g.waarvoor ? ' (' + g.waarvoor + ')' : ''),
        tot: null, richting: 'ziet', intrekbaar: true });
    }

    const wacht = pak('Wachtlijst', kern.wachtlijstVan && (() => kern.wachtlijstVan(key)));
    for (const w of (wacht && wacht.lijsten) || []) {
      uit.push({ laag: 'wachtlijst', id: w.id, wie: w.aanbiederNaam, partij: sleutel(w.aanbiederCode || w.aanbiederNaam),
        wat: 'Mag u een seintje geven als er een plek vrijkomt; er wordt niets voor u ingeboekt',
        tot: null, richting: 'seint', intrekbaar: true });
    }

    const toe = pak('Toestellen', kern.toestellenVan && (() => kern.toestellenVan(key)));
    for (const t of (toe && toe.toestellen) || []) {
      uit.push({ laag: 'toestel', id: t.id, wie: t.naam, partij: null,
        wat: 'Schrijft dagmetingen weg (' + t.geschreven + ' tot nu toe)',
        tot: null, richting: 'schrijft', intrekbaar: true });
    }

    return {
      ok: true, toestemmingen: uit, lagen: LAGEN, nietGedekt: NIET_GEDEKT, storingen,
      voorbehoud: 'Op deze lijst let een toets mee: een nieuwe toestemming van de bekende soort ' +
        'valt niet stil buiten dit scherm. Een soort die er anders uitziet nog wel, en dan is dit ' +
        'register weer mensenwerk.'
    };
  }


  return { consentVan };
};
