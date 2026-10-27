// SAMPLE CONTENT. Written by hand from well-known facts; the cited pages have NOT yet been fetched and claim-checked by the app's
// verification pipeline. The UI labels these "sample story, source check pending". Replace with generated+verified content later.
export interface Beat { q: string; a: string }
export interface Seed { id: string; title: string; tags: string[]; hook: string; beats: Beat[]; sources: { label: string; url: string }[] }

export const SEED: Seed[] = [
  { id: 'honey', title: 'The honey that outlasts everything', tags: ['food', 'science', 'history'],
    hook: 'Jars of honey have been found in ancient tombs. Some say it was still edible.',
    beats: [
      { q: 'Why does honey last so long?', a: 'Honey is very low in water and very high in sugar, so most microbes cannot grow in it. It is also slightly acidic.' },
      { q: 'What do bees add?', a: 'Bees add an enzyme that makes small amounts of hydrogen peroxide, which helps keep it protected.' },
      { q: 'Is it truly forever?', a: 'Not if it takes on water. Sealed and dry honey keeps for a very long time, but open jars in damp places can ferment.' },
    ], sources: [{ label: 'Wikipedia: Honey', url: 'https://en.wikipedia.org/wiki/Honey' }] },
  { id: 'octopus', title: 'Three hearts, blue blood', tags: ['animals', 'science'],
    hook: 'An octopus has more hearts than you have, and its blood is not red.',
    beats: [
      { q: 'How many hearts?', a: 'Three: two pump blood through the gills and one pumps it to the rest of the body.' },
      { q: 'Why blue blood?', a: 'Octopus blood carries oxygen with a copper-based protein called hemocyanin, which looks blue when oxygenated.' },
      { q: 'What is the catch?', a: 'Hemocyanin works well in cold, low-oxygen water but carries less oxygen than our haemoglobin, so swimming hard is costly.' },
    ], sources: [{ label: 'Wikipedia: Octopus', url: 'https://en.wikipedia.org/wiki/Octopus' }] },
  { id: 'emu-war', title: 'The year Australia lost to birds', tags: ['history', 'animals'],
    hook: 'In 1932, soldiers with machine guns were sent against emus. It did not go as planned.',
    beats: [
      { q: 'What happened?', a: 'In late 1932 in Western Australia, farmers asked for help with thousands of emus damaging crops, and soldiers were sent with machine guns.' },
      { q: 'Why did it fail?', a: 'The birds scattered in small groups and were hard to hit, so the operation was widely seen as a failure and was soon withdrawn.' },
      { q: 'Why is it remembered?', a: 'It is usually called the Great Emu War, a nickname more than an official name, and it still gets retold as a lesson in underestimating wildlife.' },
    ], sources: [{ label: 'Wikipedia: Emu War', url: 'https://en.wikipedia.org/wiki/Emu_War' }] },
  { id: 'venus-day', title: 'A day on Venus is longer than its year', tags: ['space', 'science'],
    hook: 'On Venus, the sun can rise twice before a day has passed, and still the year is shorter.',
    beats: [
      { q: 'How slowly does Venus spin?', a: 'Venus turns once in about 243 Earth days, and it spins backwards compared with most planets.' },
      { q: 'How long is its year?', a: 'It circles the Sun in about 225 Earth days, which is shorter than one spin.' },
      { q: 'What does that do to a Venus sunrise?', a: 'Because of the backward spin and the orbit together, one sunrise to the next takes about 117 Earth days.' },
    ], sources: [{ label: 'Wikipedia: Venus', url: 'https://en.wikipedia.org/wiki/Venus' }] },
  { id: 'oxford-aztec', title: 'Older than the Aztec capital', tags: ['history'],
    hook: 'Oxford was already teaching students before Tenochtitlan existed.',
    beats: [
      { q: 'How old is Oxford?', a: 'Teaching at Oxford is recorded from 1096, which makes it the oldest university in the English-speaking world.' },
      { q: 'And Tenochtitlan?', a: 'The Aztec capital Tenochtitlan is traditionally dated to 1325.' },
      { q: 'So?', a: 'Oxford was teaching for more than two centuries before that city was founded.' },
    ], sources: [{ label: 'Wikipedia: University of Oxford', url: 'https://en.wikipedia.org/wiki/University_of_Oxford' }, { label: 'Wikipedia: Tenochtitlan', url: 'https://en.wikipedia.org/wiki/Tenochtitlan' }] },
  { id: 'wombat', title: 'The animal that poops cubes', tags: ['animals', 'science'],
    hook: 'Wombats leave small cube-shaped droppings, and scientists worked out how.',
    beats: [
      { q: 'Is it real?', a: 'Yes. Common wombats produce cube-shaped droppings.' },
      { q: 'How?', a: 'Research found that the intestine has regions of different stiffness, which shapes the droppings as they form.' },
      { q: 'Why bother?', a: 'Wombats use droppings to mark territory, and cubes are thought to stay put on rocks and logs instead of rolling away.' },
    ], sources: [{ label: 'Wikipedia: Wombat', url: 'https://en.wikipedia.org/wiki/Wombat' }] },
];
export const TOPIC_TAGS = ['animals', 'history', 'science', 'space', 'food'];
export const FORMATS = [
  { id: 'narrative', label: 'A flowing story' },
  { id: 'qa', label: 'Questions and answers' },
  { id: 'steps', label: 'Step by step' },
];
