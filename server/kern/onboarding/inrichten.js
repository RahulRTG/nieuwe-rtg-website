/* Onboarding (deelmodule): HET INRICHTEN -- in één keer invullen wat het huis
   anders per keer komt vragen.

   WAAROM DIT ER IS. De voordeur vraagt vier dingen (naam, e-mail, geboortedatum,
   wachtwoord) en al het andere staat op 'later': telefoon en adres worden pas
   gevraagd op het moment dat een handeling ze nodig heeft, met een eerlijk
   waarom erbij (kern/gegevenspoort.js). Dat is een goed ontwerp en het blijft
   staan -- niemand wordt hier iets gevraagd "voor de zekerheid".

   Maar het kent één stand die niemand wil: je meldt je aan, je komt binnen in
   een leeg huis, en bij elk eerste ding dat je doet staat er weer een vraag.
   Sinds de demo-inhoud eruit is (kern/demostand.js) is dat lege huis ook echt
   wat je ziet. Daarom biedt Rahul het ná het tekenen één keer aan: wil je het
   nu in één keer invullen, dan is het daarna klaar. Zeg je nee, dan verandert er
   niets en vraagt de gegevenspoort het later alsnog.

   HET SCHRIJFT NAAR DE PLEK WAAR DE POORT KIJKT, en dat is de hele truc. Het
   onboardingprofiel (slaOp in ./lid.js) is een ANDERE bak dan het ledendossier:
   wie daar zijn adres invulde werd bij de eerste bezorging alsnog om zijn adres
   gevraagd, want de poort leest md.adres. Twee plekken voor dezelfde waarheid
   (LAT-regel 4). Dit deel schrijft daarom rechtstreeks naar de kluis (telefoon)
   en het ledendossier (de rest) -- precies wat heeft() in de gegevenspoort leest.

   WAT ER BEWUST NIET IN ZIT:
   - NATIONALITEIT. Die mag een lid niet over zichzelf zetten; dat kan alleen met
     bewijs (het kantoor na verificatie, of de MRZ-scan). De uitleg staat in
     ./lid.js bij slaOp, en het gat dat het opleverde is daar gemeten. Wie hem
     hier zou toevoegen, opent het opnieuw.
   - HET PASPOORT. Dat is een eigen stap met een eigen scanner (./paspoort.js).
   - EEN VINKJE "MAG HET PLATFORM DIT ZIEN". Deze gegevens verlaten het lid
     nergens: ze staan in de kluis en het dossier, en ze worden gebruikt voor de
     handeling die het lid zelf start. Een schakelaar die toestemming vraagt voor
     iets wat niet gebeurt, is een belofte die de code niet waarmaakt -- precies
     wat LAT-regel 6 verbiedt. Komt er een plek waar zo'n gegeven wél naar een
     partner gaat, dan hoort het vinkje daar en niet hier. */
'use strict';

/* De onderdelen, in de volgorde waarin Rahul ze vraagt. `waarom` is geen
   marketingzin maar de handeling die het gegeven nodig heeft: dezelfde reden die
   de gegevenspoort later zou noemen. `waar` staat erbij zodat te lezen is waar
   het terechtkomt -- de kluis of het eigen dossier, nergens anders. */
const ONDERDELEN = [
  { id: 'telefoon', type: 'tel', label: 'Telefoonnummer',
    vraag: 'Wat is je telefoonnummer?',
    waarom: 'Zodra er een derde partij bij komt -- een bestelling, een tafel, een bezorging -- moet die je kunnen bereiken als er iets misgaat.',
    waar: 'de identiteitskluis' },
  { id: 'adres', type: 'text', label: 'Straat en huisnummer',
    vraag: 'Wat is je straat en huisnummer?',
    waarom: 'Nodig zodra er iets bij je bezorgd wordt.',
    waar: 'je eigen ledendossier' },
  { id: 'postcode', type: 'text', label: 'Postcode',
    vraag: 'En je postcode?',
    waarom: 'Hoort bij het adres; bepaalt ook je afvalkalender zodra je gemeente meedoet.',
    waar: 'je eigen ledendossier' },
  { id: 'plaats', type: 'text', label: 'Woonplaats',
    vraag: 'In welke plaats woon je?',
    waarom: 'Bepaalt wat er bij jou in de buurt te doen en te bestellen is.',
    waar: 'je eigen ledendossier' },
  { id: 'land', type: 'land', label: 'Land',
    vraag: 'En in welk land?',
    waarom: 'Sommige regels en prijzen verschillen per land.',
    waar: 'je eigen ledendossier' }
];

module.exports = (ctx) => {
  const { accounts, schoon } = ctx;
  const { plaatsNorm } = require('../../functies');
  const schoonVeld = (v, n) => schoon(String(v == null ? '' : v), n || 120);

  function dossier(acc) {
    try { return (accounts.getMemberState(acc.id) || {}); } catch (e) { return {}; }
  }

  /* Wat hebben we al? Leest dezelfde plekken als kern/gegevenspoort.js heeft().

     VERS UIT DE KLUIS, want `sess.account` is de rij zoals hij bij het inloggen
     was. Zet je in dezelfde beurt een telefoonnummer en lees je het daarna van
     die oude rij, dan staat het er nog niet: het nummer was opgeslagen en de
     stand zei "nog open". */
  function versAccount(acc) {
    try { return accounts.getUserById(acc.id) || acc; } catch (e) { return acc; }
  }
  function heeftAl(id, acc, md) {
    if (id === 'telefoon') return !!accounts.phoneOf(versAccount(acc));
    if (id === 'plaats') return !!String(md.plaats || '').trim();
    return !!String(md[id] || '').trim();
  }

  /* De stand voor de app: wat staat er nog open, en waarom vragen we het. Een
     sessie zonder account (demo-persona) heeft geen dossier om in te richten en
     krijgt een lege, afgeronde stand terug -- geen poort die nooit dichtgaat. */
  function inrichtStatus(sess) {
    const acc = sess && sess.account;
    if (!acc) return { ok: true, klaar: true, open: [], gedaan: [] };
    const md = dossier(acc);
    const open = [], gedaan = [];
    for (const o of ONDERDELEN) (heeftAl(o.id, acc, md) ? gedaan : open)
      .push({ id: o.id, type: o.type, label: o.label, vraag: o.vraag, waarom: o.waarom, waar: o.waar });
    return { ok: true, klaar: open.length === 0, open, gedaan: gedaan.map(o => o.id) };
  }

  /* Invullen. Alles wat meekomt en bekend is wordt bewaard; de rest genegeerd.
     Een leeg veld wist niets: dit scherm is om in te vullen, niet om te wissen
     (dat hoort bij het profiel, waar het lid het ook terug kan zien). */
  function inrichtOp(sess, velden) {
    const acc = sess && sess.account;
    if (!acc) return { status: 403, error: 'Inrichten hoort bij een echt account.' };
    const kenbaar = new Map(ONDERDELEN.map(o => [o.id, o]));
    const md = dossier(acc);
    let raakteDossier = false;
    for (const [k, ruw] of Object.entries(velden || {})) {
      if (!kenbaar.has(k)) continue;
      const waarde = schoonVeld(ruw, k === 'adres' ? 200 : 120).trim();
      if (!waarde) continue;
      if (k === 'telefoon') {
        // te kort om een nummer te zijn: overslaan in plaats van de hele stap
        // te laten mislukken (dezelfde soepelheid als bij de aanmelding)
        if (waarde.replace(/\D/g, '').length >= 8) accounts.setPhone(acc.id, waarde);
        continue;
      }
      if (k === 'land') {
        const ln = waarde.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
        if (ln.length === 2) { md.land = ln; raakteDossier = true; }
        continue;
      }
      if (k === 'plaats') {
        const pl = plaatsNorm ? plaatsNorm(waarde) : waarde;
        if (pl) { md.plaats = pl; raakteDossier = true; }
        continue;
      }
      md[k] = waarde; raakteDossier = true;
    }
    if (raakteDossier) accounts.saveMemberState(acc.id, md);
    return inrichtStatus(sess);
  }

  return { inrichtStatus, inrichtOp, ONDERDELEN };
};
