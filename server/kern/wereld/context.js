/* Saloon-context zonder verborgen score. Een lens filtert op expliciete bron,
   soort of woorden die de maker zelf deelde. De sectie volgt alleen uit type,
   tijd, plaats en bron; binnen elke sectie blijft de feed chronologisch. */
'use strict';

const LENS_CONTEXT = Object.freeze({
  all: { naam: 'Alles', titel: 'Wat er in uw wereld gebeurt.',
    uitleg: 'Mensen, plekken, communities en gebeurtenissen in één rustige lijn.', url: '/apps/wereld.html' },
  friends: { naam: 'Friends', titel: 'Mensen om iets mee te beleven.',
    uitleg: 'Momenten, plannen en communities uit uw eigen kring.', url: '/apps/sociaal.html' },
  dating: { naam: 'Dating', titel: 'Ontmoeten vanuit gedeelde context.',
    uitleg: 'Alleen wederzijdse en doelgebonden signalen horen hier. Geen eindeloze profielen.', url: '/apps/rendezvous.html' },
  business: { naam: 'Business', titel: 'Mensen en organisaties in beweging.',
    uitleg: 'Zakelijke momenten, partnerpublicaties en concrete mogelijkheden.', url: '/apps/zakelijk.html' },
  travel: { naam: 'Travel', titel: 'Wie en wat met uw reis meebeweegt.',
    uitleg: 'Reismomenten, plannen en plekken zonder uw reisgegevens openbaar te maken.', url: '/apps/reizen.html' },
  events: { naam: 'Events', titel: 'Wat er gebeurt, voor, tijdens en erna.',
    uitleg: 'Bijeenkomsten, live-momenten en aanbiedingen rond een gebeurtenis.', url: '/apps/avond.html' }
});

const SECTIES = Object.freeze([
  { id: 'nu', naam: 'Nu' }, { id: 'vandaag', naam: 'Vandaag' },
  { id: 'mensen', naam: 'Uw mensen' }, { id: 'plekken', naam: 'Uw plekken' },
  { id: 'communities', naam: 'Uw communities' }, { id: 'binnenkort', naam: 'Binnenkort' }
]);

const tijd = x => new Date(x || 0).getTime() || 0;
const tekstVan = i => (String(i.tekst || '') + ' ' + (i.onderwerpen || []).join(' ')).toLowerCase();
const reisSignaal = i => ['travel', 'place', 'plan'].includes(i.type)
  || /\b(reis|travel|trip|ibiza|hotel|vlucht|bestemming)\b/.test(tekstVan(i));
const eventSignaal = i => ['event', 'activity', 'live', 'offer'].includes(i.type)
  || /\b(event|festival|concert|feest|bijeenkomst|tickets?)\b/.test(tekstVan(i));

function doorLens(items, lens) {
  if (lens === 'all') return items;
  if (lens === 'friends') return items.filter(i => i.bron !== 'zakelijk');
  if (lens === 'dating') return items.filter(i => i.type === 'dating');
  if (lens === 'business') return items.filter(i => i.bron === 'zakelijk' || i.partner || i.type === 'offer');
  if (lens === 'travel') return items.filter(reisSignaal);
  if (lens === 'events') return items.filter(eventSignaal);
  return [];
}

function sectieVan(i) {
  const nu = Date.now();
  const vandaag = new Date().toISOString().slice(0, 10);
  const begint = i.begint ? new Date(i.begint).getTime() : 0;
  if (i.type === 'live' || (i.type === 'story' && nu - tijd(i.at) <= 6 * 3600000)) return 'nu';
  if ((i.begint && String(i.begint).slice(0, 10) === vandaag)
    || (!i.begint && String(i.at || '').slice(0, 10) === vandaag)) return 'vandaag';
  if (begint > nu && ['event', 'travel', 'plan', 'activity'].includes(i.type)) return 'binnenkort';
  if (i.bron === 'genootschap' || i.type === 'community') return 'communities';
  if (i.plaats) return 'plekken';
  return 'mensen';
}

module.exports = { LENS_CONTEXT, SECTIES, doorLens, sectieVan };
