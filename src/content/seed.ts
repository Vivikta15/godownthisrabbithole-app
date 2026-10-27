// SAMPLE CONTENT. Hand-written, then compared claim by claim against the fetched Wikipedia text (revisions recorded in `checked`) on 2026-10-27.
// This is a single-source manual check, not independent verification. Replace with generated content run through src/content/pipeline.ts later.
export interface Beat { q: string; a: string }
export interface Seed { id: string; title: string; tags: string[]; hook: string; beats: Beat[]; shortKeep?: number[]; sources: { label: string; url: string }[]; checked?: { revisions: { page: string; revid: number }[]; date: string; method: string } }

export const SEED: Seed[] = [
  { id: 'honey', checked: { revisions: [{ page: 'Honey', revid: 1380415835 }], date: '2026-10-27', method: 'hand comparison of each claim against the fetched en.wikipedia.org text' }, title: 'The honey that outlasts everything', tags: ['food', 'science', 'history'],
    hook: 'Honey samples found in archaeological digs have been edible after thousands of years.',
    beats: [
      { q: 'Why does honey last so long?', a: 'Honey is very low in water and very high in sugar, so most microbes cannot grow in it. It is also slightly acidic.' },
      { q: 'What do bees add?', a: 'Bees add an enzyme, glucose oxidase. It produces gluconic acid and hydrogen peroxide, which partly explain the acidity and the slowing of bacterial growth.' },
      { q: 'Is it truly forever?', a: 'Not if it takes on water. Sealed and dry honey keeps for a very long time, but open jars in damp places can ferment.' },
    ], shortKeep: [0, 2], sources: [{ label: 'Wikipedia: Honey', url: 'https://en.wikipedia.org/wiki/Honey' }] },
  { id: 'octopus', checked: { revisions: [{ page: 'Octopus', revid: 1376790243 }], date: '2026-10-27', method: 'hand comparison of each claim against the fetched en.wikipedia.org text' }, title: 'Three hearts, blue blood', tags: ['animals', 'science'],
    hook: 'An octopus has more hearts than you have, and its blood is not red.',
    beats: [
      { q: 'How many hearts?', a: 'Three: two pump blood through the gills and one pumps it to the rest of the body.' },
      { q: 'Why blue blood?', a: 'Octopus blood carries oxygen with a copper-based protein called hemocyanin, which gives the blood a bluish colour.' },
      { q: 'What is the catch?', a: 'In cold, low-oxygen water haemocyanin carries oxygen more efficiently than haemoglobin. But it makes the blood thick and hard to pump, and jet swimming drains energy fast, so octopuses mostly crawl.' },
    ], shortKeep: [0, 1], sources: [{ label: 'Wikipedia: Octopus', url: 'https://en.wikipedia.org/wiki/Octopus' }] },
  { id: 'emu-war', checked: { revisions: [{ page: 'Emu_War', revid: 1369023440 }], date: '2026-10-27', method: 'hand comparison of each claim against the fetched en.wikipedia.org text' }, title: 'The year Australia lost to birds', tags: ['history', 'animals'],
    hook: 'In 1932, soldiers with machine guns were sent against emus. It did not go as planned.',
    beats: [
      { q: 'What happened?', a: 'In late 1932 in Western Australia, farmers asked for help with thousands of emus damaging crops, and soldiers were sent with machine guns.' },
      { q: 'Why did it fail?', a: 'The birds split into small groups and were hard to target. After press reports that only a few emus had died, the defence minister withdrew the soldiers and guns on 8 November.' },
      { q: 'Why is it remembered?', a: 'It is known as the Emu War or the Great Emu War, and it was a wildlife-culling operation by the Australian Army.' },
    ], shortKeep: [0, 1], sources: [{ label: 'Wikipedia: Emu War', url: 'https://en.wikipedia.org/wiki/Emu_War' }] },
  { id: 'venus-day', checked: { revisions: [{ page: 'Venus', revid: 1381544099 }], date: '2026-10-27', method: 'hand comparison of each claim against the fetched en.wikipedia.org text' }, title: 'A day on Venus is longer than its year', tags: ['space', 'science'],
    hook: 'Venus spins so slowly that its day is longer than its year.',
    beats: [
      { q: 'How slowly does Venus spin?', a: 'Venus turns once in about 243 Earth days, and it spins backwards compared with most planets.' },
      { q: 'How long is its year?', a: 'It circles the Sun in about 225 Earth days, which is shorter than one spin.' },
      { q: 'What does that do to a Venus sunrise?', a: 'Because of the backward spin and the orbit together, one sunrise to the next takes about 117 Earth days.' },
    ], sources: [{ label: 'Wikipedia: Venus', url: 'https://en.wikipedia.org/wiki/Venus' }] },
  { id: 'oxford-aztec', checked: { revisions: [{ page: 'University_of_Oxford', revid: 1381713214 },{ page: 'Tenochtitlan', revid: 1381591256 }], date: '2026-10-27', method: 'hand comparison of each claim against the fetched en.wikipedia.org text' }, title: 'Older than the Aztec capital', tags: ['history'],
    hook: 'Oxford was already teaching before the Aztec capital was founded.',
    beats: [
      { q: 'How old is Oxford?', a: 'There is evidence of teaching at Oxford as early as 1096, which makes it the oldest university in the English-speaking world.' },
      { q: 'And Tenochtitlan?', a: 'The Aztec capital Tenochtitlan was founded in 1325 by tradition. The exact date is unclear.' },
      { q: 'So?', a: 'On those dates Oxford was teaching for more than two centuries before that city was founded.' },
    ], sources: [{ label: 'Wikipedia: University of Oxford', url: 'https://en.wikipedia.org/wiki/University_of_Oxford' }, { label: 'Wikipedia: Tenochtitlan', url: 'https://en.wikipedia.org/wiki/Tenochtitlan' }] },
  { id: 'wombat', checked: { revisions: [{ page: 'Wombat', revid: 1379677697 }], date: '2026-10-27', method: 'hand comparison of each claim against the fetched en.wikipedia.org text' }, title: 'The animal that poops cubes', tags: ['animals', 'science'],
    hook: 'Wombats leave cube-shaped droppings, and how they form is still not fully understood.',
    beats: [
      { q: 'Is it real?', a: 'Yes. Common wombats produce cube-shaped droppings.' },
      { q: 'How?', a: 'It is believed the intestine stretches more at the walls, with two flexible and two stiff areas, which shapes the droppings.' },
      { q: 'Why bother?', a: 'Wombats arrange droppings to mark territory and attract mates. The cube shape is believed to make them stack and not roll.' },
    ], shortKeep: [0, 2], sources: [{ label: 'Wikipedia: Wombat', url: 'https://en.wikipedia.org/wiki/Wombat' }] },
];
export const TOPIC_TAGS = ['animals', 'history', 'science', 'space', 'food'];
export const FORMATS = [
  { id: 'narrative', label: 'A flowing story' },
  { id: 'qa', label: 'Questions and answers' },
  { id: 'steps', label: 'Step by step' },
];
