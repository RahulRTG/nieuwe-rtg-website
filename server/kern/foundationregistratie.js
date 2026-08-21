/* De toelatingsmotor van FOUNDATION. Een gezin maakt een eigen, afgeschermd
   huishouden aan; scholen, vrijwilligers en partnerstichtingen krijgen pas
   toegang nadat de Boardroom de officiële en organisatorische controles
   afzonderlijk heeft vastgelegd. We bewaren geen identiteitskopieën of VOG-
   inhoud: alleen welke bevoegde bron is bekeken, door wie en wanneer. */
'use strict';

const BRONNEN = Object.freeze({
  stichting:'https://www.kvk.nl/inschrijven/inschrijven-stichting/',
  ubo:'https://www.kvk.nl/ubo/moet-je-organisatie-ubo-opgave-doen/',
  anbi:'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/bijzondere_regelingen/goede_doelen/algemeen_nut_beogende_instellingen/aan_welke_voorwaarden_moet_een_anbi_voldoen/',
  brin:'https://duo.nl/open_onderwijsdata/onderwijs-algemeen/basisgegevens/basisgegevens-instellingen.jsp',
  vog:'https://www.justis.nl/producten/verklaring-omtrent-het-gedrag/vog-voor-vrijwilligers-en-vrijwilligersorganisaties',
  privacy:'https://www.autoriteitpersoonsgegevens.nl/themas/onderwijs/gebruik-van-persoonsgegevens-in-het-onderwijs/privacyregels-voor-scholen'
});

const TYPES = Object.freeze({
  school:{ label:'School of onderwijsinstelling', uitleg:'De directie meldt de officiële onderwijsinstelling aan.', nummer:'BRIN' },
  vrijwilliger:{ label:'Vrijwilliger', uitleg:'Eerst kennismaken en passend screenen; daarna pas een persoonlijke code.', nummer:null },
  partnerstichting:{ label:'Partnerstichting', uitleg:'Een bestaande maatschappelijke organisatie die lokaal met FOUNDATION wil samenwerken.', nummer:'officiële registratie' }
});

const eis = (id, label, bron, url, extra) => Object.assign({ id, label, bron, url,
  verplicht:true, status:'open', gecontroleerd:null }, extra || {});

function eisenVoor(type, b) {
  if (type === 'school') return [
    eis('brin','Naam, vestiging, bestuur en BRIN gecontroleerd','DUO Open Onderwijsdata',BRONNEN.brin),
    eis('bevoegdheid','Aanvrager vertegenwoordigt de school of het bevoegd gezag','Officieel schoolkanaal / bevoegd gezag',BRONNEN.brin),
    eis('privacy_kinderen','Privacy-informatie en rechten voor leerlingen en ouders zijn geregeld','Autoriteit Persoonsgegevens',BRONNEN.privacy),
    eis('verwerkersafspraken','Rollen, beveiliging en verwerkersafspraken zijn schriftelijk vastgelegd','AVG-verwerkingsregister',BRONNEN.privacy),
    eis('integriteit','Dubbele aanvraag en afwijkende gegevens beoordeeld','FOUNDATION-toelatingscontrole',null)
  ];
  if (type === 'vrijwilliger') {
    const kwetsbaar = b.werktMetKwetsbaren === true;
    const r = [
      eis('identiteit','Identiteit persoonlijk gezien; geen identiteitskopie opgeslagen','FOUNDATION-coördinator',null),
      eis('kennismaking','Kennismaking en passende rol afgerond','FOUNDATION-coördinator',null),
      eis('gedragscode','Gedragscode besproken en aanvaard','FOUNDATION-veiligheidsbeleid',BRONNEN.vog),
      eis('vog','Passende VOG gecontroleerd wanneer de rol daarom vraagt','Justis',BRONNEN.vog,
        kwetsbaar ? {} : { magNietVanToepassing:true }),
      eis('referentie','Minimaal één relevante referentie of eerdere inzet beoordeeld','FOUNDATION-aannamebeleid',BRONNEN.vog),
      eis('integriteit','Belangenconflict en overige veiligheidsignalen beoordeeld','FOUNDATION-toelatingscontrole',null)
    ];
    if (b.minderjarig === true) r.push(eis('ouder_toestemming','Toestemming van ouder of wettelijk vertegenwoordiger gecontroleerd','FOUNDATION-coördinator',null));
    return r;
  }
  if (type === 'partnerstichting') {
    const r = [
      eis('stichtingsregister','Rechtsvorm, naam, bestuur en actieve inschrijving gecontroleerd','KVK of officieel buitenlands register',BRONNEN.stichting),
      eis('ubo','UBO-opgave en vertegenwoordigingsbevoegdheid gecontroleerd','KVK UBO-register of bevoegde buitenlandse instantie',BRONNEN.ubo),
      eis('statuten_doel','Statutair doel en bestemming bij opheffing passen bij de samenwerking','Statuten / notariële akte',BRONNEN.stichting),
      eis('bestuur','Bestuur, tegenstrijdige belangen en tekenbevoegdheid beoordeeld','Officieel register en statuten',BRONNEN.stichting),
      eis('financien','Recent jaarstuk, bankrekening op organisatienaam en herkomst van middelen beoordeeld','Jaarrekening / bankverificatie',null),
      eis('integriteit','Sancties, fraude-, witwas- en reputatiesignalen beoordeeld','FOUNDATION-toelatingscontrole',null),
      eis('overeenkomst','Geld, vrijwilligers, persoonsgegevens, aansprakelijkheid en rapportage zijn toegewezen','Samenwerkingsovereenkomst',null)
    ];
    if (b.anbi === true) r.push(eis('anbi','ANBI-status en actuele publicatieplicht gecontroleerd','Belastingdienst',BRONNEN.anbi));
    if (b.verwerktPersoonsgegevens === true) r.push(eis('privacy','Privacyrollen, grondslag, bewaartermijnen en datalekroute gecontroleerd','Autoriteit Persoonsgegevens',BRONNEN.privacy));
    if (b.werktMetKwetsbaren === true) r.push(eis('vogbeleid','VOG-, gedragscode-, meldcode- en aannamebeleid gecontroleerd','Justis',BRONNEN.vog));
    return r;
  }
  return [];
}

function startControle(type, b, at) {
  return { versie:1, status:'controle_nodig', eisen:eisenVoor(type, b), historie:[], gestartAt:at };
}
function klaar(e, nu) {
  if (e.status === 'niet_van_toepassing' && e.magNietVanToepassing) return true;
  if (e.status !== 'geverifieerd' || !e.gecontroleerd) return false;
  return !(e.gecontroleerd.geldigTot && Date.parse(e.gecontroleerd.geldigTot) < nu);
}
function herbereken(toelating, nu) {
  const eisen = toelating && Array.isArray(toelating.eisen) ? toelating.eisen : [];
  const open = eisen.filter(e => e.verplicht && !klaar(e, nu || Date.now())).map(e => e.id);
  if (toelating) toelating.status = open.length ? 'controle_nodig' : 'klaar_voor_besluit';
  return { status:toelating ? toelating.status : 'controle_nodig', open };
}
function controleer(toelating, b, door, at) {
  if (!toelating || !Array.isArray(toelating.eisen)) return { status:409, error:'Deze aanvraag heeft geen geldig toelatingsdossier.' };
  const e = toelating.eisen.find(x => x.id === String((b || {}).onderdeel || ''));
  if (!e) return { status:400, error:'Onbekend controleonderdeel.' };
  const uitkomst = String(b.uitkomst || '');
  if (!['geverifieerd','niet_van_toepassing','afgekeurd'].includes(uitkomst)) return { status:400, error:'Kies geverifieerd, niet van toepassing of afgekeurd.' };
  if (uitkomst === 'niet_van_toepassing' && !e.magNietVanToepassing) return { status:409, error:'Dit verplichte bewijs kan niet als niet van toepassing worden afgevinkt.' };
  const referentie = String(b.referentie || '').trim().slice(0, 180);
  if (referentie.length < 3) return { status:400, error:'Leg de geraadpleegde bron en uitkomst vast.' };
  const geldigTot = String(b.geldigTot || '').trim().slice(0, 10) || null;
  if (geldigTot && !/^\d{4}-\d{2}-\d{2}$/.test(geldigTot)) return { status:400, error:'Gebruik voor geldig tot JJJJ-MM-DD.' };
  e.status = uitkomst; e.gecontroleerd = { door, at, referentie, geldigTot };
  toelating.historie = (toelating.historie || []).concat({ onderdeel:e.id, uitkomst, door, at, referentie }).slice(-100);
  const stand = herbereken(toelating, Date.parse(at));
  return { ok:true, toelating, open:stand.open };
}
function magGoedkeuren(a, nu) {
  if (!a || !TYPES[a.type]) return { ok:false, error:'Onbekende FOUNDATION-registratie.' };
  const stand = herbereken(a.toelating, nu || Date.now());
  if (stand.open.length) return { ok:false, open:stand.open,
    error:'Goedkeuren is geblokkeerd: rond eerst alle controles af (' + stand.open.join(', ') + ').' };
  return { ok:true };
}

module.exports = { BRONNEN, TYPES, eisenVoor, startControle, herbereken, controleer, magGoedkeuren };
