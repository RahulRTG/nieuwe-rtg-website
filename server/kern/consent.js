/* Het Consent Center: wie raakt mijn gegevens aan, en waar zet ik dat stop.

   Net als RTG Life bewaart deze laag NIETS. Hij leest de lagen die de
   toestemming zelf beheren en zet ze naast elkaar in een vorm. Intrekken gaat
   ook via die laag: er staat hier geen tweede knop die zijn eigen vlaggetje
   omzet, want dan is er een tweede waarheid over of iets nog mag (LAT regel 4).

   Wat een toets wel bewaakt: dat voor elke gedekte laag de intrekknop echt
   intrekt (heen en terug), en dat het register en wat het scherm toont niet
   uiteenlopen. */

/* Het register (welke lagen toestemming dragen, en waar de lijst ophoudt)
   staat in ./consent-register.js. Het gaat aan het eind van dit bestand weer
   naar buiten, zodat test/consent-dekking.test.js en de route het op de oude
   plek blijven vinden. */
const { LAGEN, NIET_GEDEKT } = require('./consent-register');

const dagVan = d => (d ? String(d).slice(0, 10) : null);
/* Een dag is genoeg voor een toestemming die weken loopt. De paspoort-inzage
   duurt tien minuten, en "Tot 2026-08-18" leest daar als "de hele dag nog". */
const stipVan = d => (d ? String(d).slice(0, 10) + ' ' + String(d).slice(11, 16) : null);

/* Wat een partner in zo'n venster te zien krijgt, in de woorden van het lid.
   Niveau 'bevestiging' staat er niet bij: dat vraagt geen goedkeuring en legt
   dus nooit een lopende toestemming vast (kern/paspoort/verzoeken.js). */
const NIVEAU_TEKST = {
  idkaart: 'Uw ID-kaart: pasfoto, naam, nationaliteit en geboortedatum',
  paspoort: 'De volledige paspoortscan'
};

module.exports = ({ kern }) => {
  /* Elke laag apart, en een laag die het niet doet wordt gemeld en niet stil
     overgeslagen -- op dit scherm nog harder dan elders: een ontbrekende regel
     leest hier als "niemand kijkt mee". */
  function lees(naam, fn) {
    if (typeof fn !== 'function') return { fout: 'De laag ' + naam + ' is niet aangesloten.' };
    try { return { waarde: fn() }; } catch (e) { return { fout: 'De laag ' + naam + ' gaf een fout.' }; }
  }

  function consentVan(key) {
    const uit = [];
    const storingen = [];
    const pak = (naam, fn) => { const r = lees(naam, fn); if (r.fout) storingen.push(r.fout); return r.waarde; };

    const care = pak('Zorg', kern.careOverzicht && (() => kern.careOverzicht(key)));
    for (const i of (care && care.intakes) || []) {
      uit.push({ laag: 'care-intake', id: i.id, wie: i.aanbiederNaam,
        wat: 'De medische context die u apart met deze aanbieder deelde',
        tot: i.vervaltOp, richting: 'ziet', intrekbaar: true });
    }

    const vast = pak('Vastleggen', kern.vastleggingenVan && (() => kern.vastleggingenVan(key)));
    for (const v of (vast && vast.vastleggingen) || []) {
      uit.push({ laag: 'care-vastlegging', id: v.id, wie: v.aanbiederNaam,
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
    const nuMs = Date.now();
    for (const v of pas || []) {
      if (v.status !== 'goedgekeurd') continue;
      if (v.vervalt && Date.parse(v.vervalt) < nuMs) continue;
      uit.push({ laag: 'paspoort-inzage', id: v.id, wie: v.supplierName || v.supplierCode,
        wat: (NIVEAU_TEKST[v.niveau] || 'gegevens uit uw identiteitsbewijs') +
          (v.incident ? ' (vrijgegeven door RTG na een incident)' : ''),
        tot: stipVan(v.vervalt), richting: 'ziet', intrekbaar: true });
    }

    const id = pak('RTG iD', kern.rtgid && kern.rtgid.inzage && (() => kern.rtgid.inzage(key)));
    for (const s of (id && id.sessies) || []) {
      uit.push({ laag: 'rtgid-sessie', id: s.dienst, wie: s.dienst,
        wat: (s.attributen || []).join(', ') || 'gegevens uit uw RTG iD',
        tot: dagVan(s.verloopt), richting: 'ziet', intrekbaar: true });
    }
    for (const m of (id && id.machtigingen) || []) {
      if (m.ik !== 'geef') continue;   // wat u KRIJGT is geen toestemming die u geeft
      uit.push({ laag: 'rtgid-machtiging', id: m.id, wie: m.naar,
        wat: 'Mag namens u inloggen bij ' + m.dienst,
        tot: dagVan(m.tot), richting: 'doet', intrekbaar: true });
    }

    const loc = pak('Locatie', kern.locMijn && (() => kern.locMijn(key)));
    for (const d of (loc && loc.actief) || []) {
      uit.push({ laag: 'locatie', id: d.id, wie: d.supplierName || d.supplierCode,
        wat: 'Kijkt live mee met waar u bent', tot: null, richting: 'ziet', intrekbaar: true });
    }

    const zorg = pak('Zorgprofiel', kern.zorgVan && (() => kern.zorgVan(key)));
    if (zorg && zorg.delen) {
      const stukken = [(zorg.allergenen || []).length ? 'allergenen' : null, zorg.dieet ? 'dieet' : null,
        zorg.medisch ? 'aandachtspunten' : null].filter(Boolean);
      uit.push({ laag: 'zorgprofiel', id: 'profiel', wie: 'Zaken waar u bestelt of verblijft',
        wat: stukken.length ? stukken.join(', ') : 'uw zorgprofiel',
        tot: null, richting: 'ziet', intrekbaar: true });
    }

    const wacht = pak('Wachtlijst', kern.wachtlijstVan && (() => kern.wachtlijstVan(key)));
    for (const w of (wacht && wacht.lijsten) || []) {
      uit.push({ laag: 'wachtlijst', id: w.id, wie: w.aanbiederNaam,
        wat: 'Mag u een seintje geven als er een plek vrijkomt; er wordt niets voor u ingeboekt',
        tot: null, richting: 'seint', intrekbaar: true });
    }

    const toe = pak('Toestellen', kern.toestellenVan && (() => kern.toestellenVan(key)));
    for (const t of (toe && toe.toestellen) || []) {
      uit.push({ laag: 'toestel', id: t.id, wie: t.naam,
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

  /* Intrekken gaat naar de laag die de toestemming beheert. Er staat hier met
     opzet geen eigen vlaggetje: dan zou dit scherm kunnen zeggen dat iets uit
     staat terwijl de laag zelf het nog toelaat. */
  function consentIntrek(key, body) {
    const laag = String(body.laag || '');
    const id = String(body.id || '');
    const def = LAGEN.find(l => l.id === laag);
    if (!def) return { status: 404, error: 'Dit soort toestemming kent RTG niet.' };

    if (laag === 'care-intake') return kern.careIntakeStop(key, id);
    if (laag === 'care-vastlegging') return kern.vastleggingStop(key, id);
    if (laag === 'paspoort-inzage') return kern.paspoortTrekIn(key, id);
    if (laag === 'rtgid-sessie') return kern.rtgid.intrek(key, id);
    if (laag === 'rtgid-machtiging') return kern.rtgid.machtigIntrek(key, id);
    if (laag === 'locatie') return kern.locStopKlant(key, id);
    if (laag === 'toestel') return kern.toestelIntrek(key, { id });
    if (laag === 'wachtlijst') return kern.wachtlijstAf(key, { id });
    if (laag === 'zorgprofiel') {
      /* Het profiel zelf blijft staan; alleen het MEEREIZEN gaat uit. Het
         weggooien zou meer doen dan er gevraagd is, en het lid raakt dan zijn
         eigen allergenenlijst kwijt. */
      const p = kern.zorgVan(key);
      return kern.zorgZet(key, { ...p, delen: false });
    }
    return { status: 500, error: 'Deze laag staat in het register maar heeft geen intrekpad.' };
  }

  return { consentVan, consentIntrek };
};

module.exports.LAGEN = LAGEN;
module.exports.NIET_GEDEKT = NIET_GEDEKT;
