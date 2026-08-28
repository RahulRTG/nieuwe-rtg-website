/* ============================================================================
   DE MERKKERN -- één bron voor wat een merk IS.

   Dit huis had het merk-idee al twee keer: kern/theater/huisstijl.js (de interne
   mediawereld van een zaak) en kern/webmerk.js (een keten met vestigingen).
   Allebei met dezelfde velden, allebei met hun eigen validatie. Een derde kopie
   erbij voor het Werk OS zou betekenen dat "wat is een geldige accentkleur" op
   drie plaatsen staat -- en binnen een maand op drie plaatsen anders.

   Deze module is dus GEEN derde huisstijlsysteem maar de definitie waar de
   andere twee uit lezen: welke velden bestaan, wat een geldige waarde is, wat
   de standaard is, en waar het merk ophoudt. De OPSLAG blijft waar hij hoort --
   het Theater bewaart per kanaal, Webmerk per keten, de tenant per org -- want
   die drie hebben een verschillende scope en dat is geen duplicatie maar het
   verschil tussen een zaak, een keten en een contract.

   DE HERKOMSTREGEL IS NIET UIT TE ZETTEN, OOK NIET IN 'private'.

   Een medewerker van een klant hoort te kunnen achterhalen wiens software zijn
   personeelsdossier bewaart -- dat is geen merkvraag maar een AVG-vraag, en het
   antwoord mag niet afhangen van een verkoopcontract. In 'powered' staat RTG in
   de schil; in 'private' verdwijnt het merk uit de schil maar blijft de
   herkomstregel in de voet, in het vertrouwensvenster en op de juridische
   schermen. Het manifest draagt hem daarom altijd, en er is geen veld om hem
   leeg te maken.

   WAAROM HET MANIFEST ONDERTEKEND IS. Niet als vertrouwensdecoratie. Het merk
   bepaalt wat een medewerker op zijn scherm ziet staan over wie hij is en waar
   hij is; wie de opslag rechtstreeks kan aanraken (een backup terugzetten, een
   migratie, een fout in een ander proces) zou de naam van de ene klant boven
   de wereld van de andere kunnen krijgen. De handtekening wordt bij het
   UITLEVEREN opnieuw gerekend, dus een manifest dat buitenom is gewijzigd komt
   er niet uit -- er komt de standaardstijl uit, met de reden erbij.

   WAT DIT MANIFEST (NOG) NIET BESTUURT, en dat hoort hardop te staan omdat de
   opsomming anders als dekking leest: e-mail, documenten, facturen, meldingen,
   het PWA-manifest en de AI-toon dragen dit merk NIET. Alleen de schermen van
   het Werk OS lezen het. Staat als open punt in TAKEN.md. */
'use strict';

const crypto = require('crypto');
/* VIA DE GEVEL EN NIET LANGS accounts/state. Hier stond een rechtstreekse greep
   in S.SECRET met een eigen HMAC-afleiding -- precies wat de verboden graaf
   (kluis-binnenwerk) tegenhoudt: ook de kern gaat via de gevel. De gevel biedt
   hetzelfde al aan als sleutelVoor(doel): een HKDF-afgeleide sleutel waarbij de
   ruwe sessiesleutel de kluis nooit verlaat. De afleiding verschilt van de oude
   (HKDF in plaats van HMAC), dus eerder getekende manifesten verifiëren niet
   meer -- dat kan, want dit merk draait nog nergens live en een manifest wordt
   bij de eerstvolgende wijziging opnieuw getekend. */
const accounts = require('../../accounts');

const STANDAARD_ACCENT = '#7F1634';        // de bordeaux van RTG, tot een klant iets anders kiest
const MAX_LOGO = 60000;                    // een klein beeld; dit is geen mediabibliotheek
const VERSIE = 1;

const GRENS =
  'Dit merk geldt binnen de eigen werkruimte. Een eigen domein bestaat hier niet, ' +
  'en e-mail, documenten en meldingen dragen dit merk nog niet.';

/* De sleutel is DOELGEBONDEN en niet de sessiesleutel zelf: wie ooit een
   merkhandtekening in handen krijgt, mag daarmee geen sessietoken kunnen
   nabouwen. Lui geladen, want de sleutel staat er pas nadat de accountlaag bij
   het opstarten is geopend. */
function sleutel() {
  const k = accounts.sleutelVoor('merkmanifest-v1');
  if (!k) throw new Error('De ondertekensleutel is nog niet geladen.');
  return k;
}

/* De velden van een merk, op één plek. Wie er een bijzet, ziet hier meteen wat
   er al is -- en moet dan ook de consument aanwijzen die hem toont. */
function leesMerkvelden(rauw, huidig, schoon) {
  const o = rauw || {};
  const m = { ...(huidig || {}) };
  if (o.naam != null) m.naam = schoon(o.naam, 60);
  if (o.payoff != null) m.payoff = schoon(o.payoff, 100);
  if (o.accent != null) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(o.accent)))
      return { error: 'Een accentkleur is een hexcode, bijvoorbeeld #7F1634.', status: 400 };
    m.accent = String(o.accent).toUpperCase();
  }
  if (o.thema != null) {
    if (!['licht', 'donker'].includes(o.thema)) return { error: 'Een thema is licht of donker.', status: 400 };
    m.thema = o.thema;
  }
  if (o.logo != null) {
    const s = String(o.logo);
    if (s === '') delete m.logo;
    else if (!/^data:image\/(png|jpeg|webp);base64,/.test(s) || s.length > MAX_LOGO)
      return { error: 'Een logo is een klein png-, jpeg- of webp-beeld (tot 60 kB).', status: 400 };
    else m.logo = s;
  }
  return { ok: true, merk: m };
}

/* Altijd volledig ingevuld uitleveren. Een half merk laat het scherm kiezen wat
   het invult, en dan staat de standaard op twee plekken. */
function volledig(merk, valNaamTerugOp) {
  const h = merk || {};
  return {
    naam: h.naam || valNaamTerugOp || 'Werkruimte',
    payoff: h.payoff || '',
    accent: h.accent || STANDAARD_ACCENT,
    thema: h.thema === 'licht' ? 'licht' : 'donker',
    logo: h.logo || null,
    eigen: !!(h.naam || h.payoff || h.accent || h.logo)
  };
}

/* Wat er ondertekend wordt: de velden in een VASTE volgorde, als LIJST en niet
   aaneengeplakt met een scheidingsteken. Dat is geen netheid maar de bekende
   valkuil van een handtekening over samengevoegde tekst: met een spatie ertussen
   levert naam "A B" met payoff "C" dezelfde grondslag op als naam "A" met payoff
   "B C" -- twee verschillende merken, een handtekening. JSON.stringify van een
   ARRAY ontsnapt elk teken en houdt de grens tussen de velden hard.

   Een array en geen object: bij een object hangt de uitkomst aan de volgorde
   waarin de sleutels zijn gezet, en dan valt de controle om zodra iemand een
   veld verplaatst in plaats van toevoegt. Komt er een veld bij, dan hoort VERSIE
   omhoog -- dat is precies waarvoor hij vooraan staat. */
function grondslag(org, modus, m) {
  return JSON.stringify([VERSIE, org, modus, m.naam, m.payoff, m.accent, m.thema, m.logo || '']);
}

function manifest(org, modus, merk, valNaamTerugOp, herkomst) {
  const m = volledig(merk, valNaamTerugOp);
  const kern = {
    versie: VERSIE, org, modus, merk: m,
    herkomst: herkomst || 'Geleverd door Rahul Travel Group.',
    grens: GRENS
  };
  kern.handtekening = crypto.createHmac('sha256', sleutel()).update(grondslag(org, modus, m)).digest('hex');
  return kern;
}

/* Klopt dit manifest nog met zijn eigen inhoud? Tijdvast vergelijken: een
   controle die bij het eerste verschillende teken stopt, vertelt met zijn duur
   hoe ver iemand zat. */
function verifieer(man) {
  if (!man || typeof man !== 'object' || typeof man.handtekening !== 'string') return false;
  let verwacht;
  try { verwacht = crypto.createHmac('sha256', sleutel()).update(grondslag(man.org, man.modus, man.merk || {})).digest('hex'); }
  catch (e) { return false; }
  const a = Buffer.from(verwacht, 'utf8');
  const b = Buffer.from(man.handtekening, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { leesMerkvelden, volledig, manifest, verifieer, STANDAARD_ACCENT, MAX_LOGO, GRENS, VERSIE };
