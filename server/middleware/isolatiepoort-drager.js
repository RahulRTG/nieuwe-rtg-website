/* Het PERSOONLIJKE been van de isolatiepoort. De hoofdmodule weegt eerst de
   huisstand; pas daarna mag deze laag een verklaarde uitgang openlaten. Zo kan
   een lagere drager nooit de noodstand van het huis neutraliseren. */
'use strict';

const { dragersVanSessie, losSessie: resolveSession } = require('../kern/isolatie/sessiedragers');
const openpaden = require('../kern/isolatie/openpaden');
const poortstand = require('./isolatiepoort-stand');
const { telling } = poortstand;

function moetDicht() {
  return poortstand.bijtHij() ||
    (process.env.NODE_ENV === 'production' && poortstand.afdwingenUitOmgeving(process.env));
}

function onzeker(req, fout) {
  poortstand.noteerOnzeker(fout, req.method + ' ' + req.path);
  if (!moetDicht()) return null;
  return { been: 'drager', antwoord: {
    error: 'Dit verzoek is gestopt omdat je beveiligingsstand niet betrouwbaar kon worden vastgesteld.',
    as: 'isolatie', reden: 'ISOLATIE_ONBEPAALD',
    uitweg: 'Probeer niet opnieuw te muteren; neem contact op met RTG zodat de opslag en sessiecontrole kunnen worden hersteld.'
  } };
}

function antwoordVoor(besluit) {
  return {
    error: 'Dit staat nu dicht door een beveiligingsstand op je account.',
    as: 'isolatie', reden: besluit.reden, regel: besluit.regel || null,
    waarom: besluit.uitleg,
    dragers: (besluit.dragers || []).map(d => d.drager),
    uitweg: 'Je kunt de stand opheffen via Mijn bescherming; die weg blijft altijd open.'
  };
}

function weeg(req) {
  const laag = poortstand.huidig();
  if (!laag) return moetDicht() ? onzeker(req, new Error('de isolatielaag is niet gemonteerd')) : null;

  /* De uitgangen gelden alleen tegen deze dragerlaag. De huisstand is al door
     de aanroeper gewogen en wint altijd. */
  if (openpaden.blijftOpen(req.path)) return null;

  let sess = req.session || null;
  const kop = (typeof req.get === 'function' ? req.get('authorization') : '') || '';
  const token = kop.startsWith('Bearer ') ? kop.slice(7) : null;
  if (!sess && !token) return null;

  let context;
  try {
    if (!sess) sess = resolveSession(token);
    if (!sess) return null;
    const { sleutels } = dragersVanSessie(sess, token);
    context = laag.context(sleutels);
    if (!Object.values(context.standen || {}).some(v => v && v !== 'normaal')) return null;
  } catch (e) { return onzeker(req, e); }

  let besluit;
  try { besluit = laag.besluit({ pad: req.path, methode: req.method, context }); }
  catch (e) { return onzeker(req, e); }
  telling.gewogen++;
  if (besluit.toegestaan) return null;
  telling.zouSluiten++;
  if (telling.paden.length < 20) telling.paden.push(req.method + ' ' + req.path);
  for (const d of (besluit.dragers || [])) {
    telling.dragers[d.drager] = (telling.dragers[d.drager] || 0) + 1;
  }
  if (!poortstand.bijtHij()) return null;
  return { been: 'drager', besluit, antwoord: antwoordVoor(besluit) };
}

module.exports = { weeg, antwoordVoor };
