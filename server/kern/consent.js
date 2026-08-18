/* Het Consent Center: wie raakt mijn gegevens aan, en waar zet ik dat stop.

   Net als RTG Life bewaart deze laag NIETS. Hij leest de lagen die de
   toestemming zelf beheren en zet ze naast elkaar in een vorm. Intrekken gaat
   ook via die laag: er staat hier geen tweede knop die zijn eigen vlaggetje
   omzet, want dan is er een tweede waarheid over of iets nog mag (LAT regel 4).

   HET GEVAARLIJKSTE AAN DIT SCHERM IS ONVOLLEDIGHEID. Een overzicht dat "wie
   ziet wat" heet en er drie vergeet, is erger dan geen overzicht: het geeft
   zekerheid die er niet is. Daarom staat hieronder een REGISTER van elke laag
   die toestemming draagt, met per stuk of hij hier staat. Wat niet gedekt is,
   staat er MET reden bij en gaat als zodanig naar het scherm.

   EN ER LET IETS OP. test/consent-dekking.test.js zoekt in server/kern/ naar de
   vorm van een toestemming (een rij met een `key` en een `status: 'actief'`) en
   eist dat elke module die hem heeft, hier staat of daar een reden krijgt. Een
   nieuwe laag zakt dus met naam en toenaam. Wat die scan NIET vindt is een
   andere vorm -- RTG iD gebruikt een `ingetrokken`-vlag en de paspoortlaag een
   `status: 'goedgekeurd'`; die twee staan hier omdat een mens ze erin zette.
   Het gat is kleiner, niet weg, en het scherm zegt dat.

   IDENTITEIT KOMT UIT VIER LAGEN, en dat is de reden dat hier lang maar een van
   de vier stond. RTG iD (kern/rtgid.js) deelt attributen met een dienst, de
   paspoortlaag (kern/paspoort.js) opent het identiteitsbewijs zelf, het Zegel
   (public/shared/zegelcheck.js) bewijst een feit aan de balie, en payroll
   (kern/payroll/identiteit.js) laat een werkgever opvragen wat de
   loonadministratie eist. Alleen de eerste twee zetten iets OPEN dat blijft
   staan tot iemand het sluit; die horen op dit scherm. De andere twee zijn
   eenmalig: daar valt niets in te trekken, want er staat niets open. Ze horen
   bij de andere vraag -- "wie heeft er in mijn gegevens gekeken" -- en dat is
   een journaal (server/inzagelog.js), geen toestemming. Ze staan daarom
   hieronder bij het niet-gedekte, met die reden erbij.

   Wat een toets wel bewaakt: dat voor elke gedekte laag de intrekknop echt
   intrekt (heen en terug), en dat het register en wat het scherm toont niet
   uiteenlopen. */

/* Het register. Per laag: waar het over gaat, of het LEZEN of SCHRIJVEN is, en
   welke kern-functies hem lezen en stoppen. De volgorde is de volgorde op het
   scherm: het zwaarste bovenaan. */
const LAGEN = [
  { id: 'care-intake', naam: 'Medische context bij een zorgaanbieder', richting: 'ziet', gedekt: true },
  { id: 'care-vastlegging', naam: 'Zorgaanbieders die iets in uw dossier mogen vastleggen', richting: 'schrijft', gedekt: true },
  { id: 'paspoort-inzage', naam: 'Partners die uw identiteitsbewijs mogen inzien', richting: 'ziet', gedekt: true },
  { id: 'rtgid-sessie', naam: 'Diensten die met RTG iD uw gegevens ophalen', richting: 'ziet', gedekt: true },
  { id: 'rtgid-machtiging', naam: 'Mensen die namens u mogen inloggen', richting: 'doet', gedekt: true },
  { id: 'locatie', naam: 'Zaken die live met u meekijken', richting: 'ziet', gedekt: true },
  { id: 'zorgprofiel', naam: 'Uw zorgprofiel dat meereist met bestellingen', richting: 'ziet', gedekt: true },
  { id: 'toestel', naam: 'Toestellen die metingen wegschrijven', richting: 'schrijft', gedekt: true },
  { id: 'wachtlijst', naam: 'Zorgaanbieders die u mogen seinen als er iets vrijkomt', richting: 'seint', gedekt: true }
];

/* Wat dit scherm NIET dekt, met reden. Deze regels gaan mee naar het scherm,
   want een lezer hoort te weten waar de lijst ophoudt. */
const NIET_GEDEKT = [
  { naam: 'Wat u in De Salon of een genootschap plaatst',
    reden: 'Dat is publiceren en geen toestemming: u haalt het weg bij de post zelf.' },
  { naam: 'Uw veiligheidskring (Thuiswacht, Codewoord, Vitaal)',
    reden: 'Die kring krijgt pas iets te zien als er een alarm afgaat; u beheert hem in de veiligheidsapps.' },
  { naam: 'Uw noodkaart',
    reden: 'Die toont u zelf op uw scherm. Er is geen route waarmee een zaak, een kantoor of een hulpverlener hem opvraagt, dus er valt ook niets in te trekken.' },
  { naam: 'Uw medicatieschema',
    reden: 'Dat is uw eigen lijst. Niemand anders kan hem opvragen of aanpassen -- ook een behandelaar niet, want die schrijft voor in zijn eigen systeem.' },
  { naam: 'Uw dagcheck-in en wat u daarbij opschreef',
    reden: 'Daar valt niets te delen: die notities verlaten uw account niet, en er is geen knop die dat wel zou doen.' },
  { naam: 'Uw gedachtenboek',
    reden: 'Daar leest niemand in mee, ook geen model: er bestaat geen route die die tekst ergens anders heen stuurt, dus er valt niets in te trekken.' },
  { naam: 'Een ID-/leeftijdscheck met het Zegel',
    reden: 'Dat toont u zelf: de zaak scant uw Zegel en leert alleen het bewezen feit (18-plus, welke pas), nooit uw naam. Er blijft niets openstaan, dus er valt ook niets in te trekken.' },
  { naam: 'Wat uw werkgever voor de loonadministratie opvraagt',
    reden: 'Dat is een wettelijke plicht en geen toestemming die u geeft. U krijgt van elke opvraging bericht, en ze staat met reden in het inzagejournaal.' },
  { naam: 'Wat een zaak van een boeking weet',
    reden: 'Dat hoort bij de boeking en verdwijnt met de boeking; het is geen losse toestemming.' }
];

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
