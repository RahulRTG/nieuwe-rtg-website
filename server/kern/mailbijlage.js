/* BIJLAGEN VAN BUITEN: eerst door de scanner, dan pas te openen.

   TOT VANDAAG BEWAARDE RTG MAIL GEEN ENKELE BIJLAGE. De buitenpoort noemde
   alleen de naam en zei erbij dat er nooit iets wordt opgeslagen dat te openen
   valt. Dat was de juiste keuze zolang er geen scanner achter zat -- opslaan
   zonder scanner is erger dan weigeren -- maar het was ook een halve
   mailbox: een factuur die je niet kunt openen, is geen factuur.

   De scanner bestond al: kern/antivirus (handtekeningen, heuristiek, entropie),
   dezelfde die de bestandenkluis bewaakt. Er is er hier dus GEEN tweede
   gebouwd. Wat deze laag doet is de weg openen die er nog niet was.

   VIER REGELS, en de eerste is de enige die er echt toe doet:

   1. WAT NIET SCHOON IS, WORDT NIET BEWAARD. Geen quarantaine-map waar iemand
      later "toch even" bij kan, geen knop "ik weet wat ik doe". Besmet en
      verdacht gaan allebei de deur uit; wat blijft staan is de MELDING met de
      reden, zodat de lezer weet dat er iets was en wat.
   2. HET OORDEEL WORDT EEN KEER GEVELD, bij binnenkomst, en bewaard bij de
      bijlage. Opnieuw scannen bij het openen zou betekenen dat het antwoord
      kan wisselen tussen zien en openen -- en dan is niet meer uit te leggen
      wat er gebeurd is.
   3. DE BIJLAGE HOORT BIJ HET BERICHT, niet bij de gebruiker. Wie het bericht
      mag lezen (kern/rtmail-recht.js), mag de bijlage openen; niemand anders.
   4. BEGRENSD. Een bericht mag hooguit twintig bijlagen dragen en samen 25 MB.
      Wat daarboven komt wordt geweigerd met de reden, niet stilletjes afgekapt.

   De bytes gaan door dezelfde kluis als de rest van het huis (server/kluis.js):
   met RTG_ENC_KEY versleuteld op schijf, met alleen een verwijzing in de
   database. */
'use strict';
const fs = require('fs');
const path = require('path');
const kluis = require('../kluis');

const MAX_PER_BERICHT = 20;
const MAX_SAMEN = 25 * 1024 * 1024;
const MAX_EEN = 15 * 1024 * 1024;

module.exports = ({ db, save, crypto, antivirus, dir }) => {
  const OPSLAG = path.join(dir || path.join(__dirname, '..', 'data'), 'mailbijlagen');
  const nu = () => new Date().toISOString();

  const eigen = require('./eigencollectie')({ db, domein: 'kern/mailbijlage', bezit: { mailBijlagen: 'kaart' } });
  function B() {
    const b = eigen.bak('mailBijlagen');
    if (!Array.isArray(b.rijen)) b.rijen = [];
    return b;
  }

  /* De bytes gaan door `versleutelBestand`, de aan de NAAM gebonden variant, en
     niet door de gewone. Het verschil telt hier: zonder binding kan wie bij de
     opslag kan twee blobs omwisselen -- de versleuteling merkt daar niets van
     (het blob is ongeschonden) en de lezer krijgt daarna andermans bijlage bij
     zijn bericht. Met de naam als context gaat er dan gewoon niets open. */
  function bewaarBlob(buf) {
    fs.mkdirSync(OPSLAG, { recursive: true, mode: 0o700 });
    const naam = crypto.randomBytes(12).toString('hex');
    fs.writeFileSync(path.join(OPSLAG, naam), kluis.versleutelBestand(buf, naam), { mode: 0o600 });
    return naam;
  }
  function leesBlob(ref) {
    try { return kluis.ontsleutelBestand(fs.readFileSync(path.join(OPSLAG, ref)), ref); }
    catch (e) { return null; }
  }

  const schoonNaam = (n) => String(n || '')
    .replace(/[\\/\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'bijlage';

  /* De bijlagen van EEN binnengekomen bericht verwerken. Geeft per bijlage een
     rij terug: bewaard met een verwijzing, of geweigerd met de reden. De
     aanroeper hoeft niets te weten van de scanner. */
  function verwerk(berichtId, bijlagen, meta) {
    const lijst = (Array.isArray(bijlagen) ? bijlagen : []).filter(b => b && Buffer.isBuffer(b.inhoud));
    const uit = [];
    let samen = 0;
    for (const b of lijst) {
      const naam = schoonNaam(b.naam);
      if (uit.length >= MAX_PER_BERICHT) {
        uit.push({ naam, soort: b.soort || null, bytes: b.bytes || 0, bewaard: false,
          waarom: 'een bericht draagt hooguit ' + MAX_PER_BERICHT + ' bijlagen; deze is niet bewaard' });
        continue;
      }
      if (b.inhoud.length > MAX_EEN) {
        uit.push({ naam, soort: b.soort || null, bytes: b.inhoud.length, bewaard: false,
          waarom: 'deze bijlage is groter dan 15 MB en is niet bewaard' });
        continue;
      }
      if (samen + b.inhoud.length > MAX_SAMEN) {
        uit.push({ naam, soort: b.soort || null, bytes: b.inhoud.length, bewaard: false,
          waarom: 'de bijlagen van dit bericht zijn samen groter dan 25 MB; deze is niet bewaard' });
        continue;
      }

      /* DE SCAN. Zonder scanner wordt er NIETS bewaard -- dat is dezelfde regel
         als voorheen, en hij staat hier zodat een verkeerde bedrading niet
         stilzwijgend de deur openzet. */
      if (!antivirus || typeof antivirus.verwerk !== 'function') {
        uit.push({ naam, soort: b.soort || null, bytes: b.inhoud.length, bewaard: false,
          waarom: 'er draait geen scanner; zonder scanner bewaart deze laag geen bijlage' });
        continue;
      }
      const oordeel = antivirus.verwerk(b.inhoud, { naam, mime: b.soort || '',
        bron: 'mail:' + ((meta && meta.van) || 'buiten') });
      if (oordeel.verdict !== 'schoon') {
        uit.push({ naam, soort: b.soort || null, bytes: b.inhoud.length, bewaard: false,
          verdict: oordeel.verdict, redenen: (oordeel.redenen || []).slice(0, 4),
          waarom: 'de scanner noemde deze bijlage ' + oordeel.verdict + ': ' + (oordeel.redenen || []).join('; ') });
        continue;
      }

      samen += b.inhoud.length;
      const rij = { id: crypto.randomBytes(6).toString('hex'), bericht: String(berichtId || ''),
        naam, soort: b.soort || 'application/octet-stream', bytes: b.inhoud.length,
        sha256: oordeel.sha256 || null, ref: bewaarBlob(b.inhoud), at: nu() };
      B().rijen.unshift(rij);
      uit.push({ id: rij.id, naam, soort: rij.soort, bytes: rij.bytes, bewaard: true, verdict: 'schoon' });
    }
    if (uit.some(x => x.bewaard)) save();
    return uit;
  }

  const bij = (berichtId) => B().rijen.filter(r => r.bericht === String(berichtId || ''))
    .map(r => ({ id: r.id, naam: r.naam, soort: r.soort, bytes: r.bytes, sha256: r.sha256, at: r.at }));

  /* Openen. De aanroeper heeft dan al vastgesteld dat deze lezer bij dit
     BERICHT mag; deze laag kent de post niet en oordeelt daar niet over. */
  function open(id) {
    const r = B().rijen.find(x => x.id === String(id || ''));
    if (!r) return { error: 'Die bijlage bestaat niet.' };
    const buf = leesBlob(r.ref);
    if (!buf) return { error: 'De bytes van deze bijlage zijn niet meer te lezen.' };
    return { ok: true, naam: r.naam, soort: r.soort, bytes: r.bytes, bericht: r.bericht, inhoud: buf };
  }

  /* Weghalen bij een vernietiging (kern/rtmail-bewaar.js): de bytes gaan echt
     van schijf. Geeft terug hoeveel er weg zijn, want een opruiming die
     stilzwijgend niets doet, laat iemand denken dat het gelukt is. */
  function weg(berichtIds) {
    const ids = new Set((berichtIds || []).map(String));
    const b = B();
    const gaan = b.rijen.filter(r => ids.has(r.bericht));
    for (const r of gaan) { try { fs.unlinkSync(path.join(OPSLAG, r.ref)); } catch (e) {} }
    b.rijen = b.rijen.filter(r => !ids.has(r.bericht));
    if (gaan.length) save();
    return gaan.length;
  }

  return { verwerk, bij, open, weg, MAX_PER_BERICHT, MAX_SAMEN, MAX_EEN };
};
