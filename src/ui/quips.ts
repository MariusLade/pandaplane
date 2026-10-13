import type { ShopCategory } from '../game/upgrades';

/** The panda's running commentary. Picked at random, never the same line twice in a row. */
const LINES = {
  hangarFirst: [
    "Pandas can't fly? Watch me.",
    'Step one: slide. Step two: ??? Step three: fly!',
    "I've been eating bamboo for strength. Lots of bamboo.",
  ],
  hangar: [
    'Today is the day. I can feel it in my fluff.',
    'Is it possible to be too aerodynamic? Asking for me.',
    'Mum said I was born to roll. Mum was wrong.',
    'Somewhere out there is a bamboo shoot with my name on it.',
    "If I squint, that cloud looks like a snack.",
    'One more upgrade and I am basically a bird.',
    'Professional fliers call this "training". I call it falling.',
  ],
  broke: [
    "I'll need more bamboo bucks for that.",
    'My piggy bank is a very small piggy.',
    'Maybe tomorrow. Or the day after. Or…',
  ],
  buy: {
    ramp: ['Bigger ramp, bigger dreams.', 'More hill! MORE HILL!', 'This ramp has excellent slidey vibes.'],
    sled: ['Ooh, slippery.', 'Zoom zoom, says my bottom.', 'Finally, a sled worthy of my posterior.'],
    glider: ['Wings! I have WINGS!', 'Look at me. I am the captain now.', 'I feel lighter already. Emotionally.'],
    rocket: ['What could possibly go wrong?', 'Strapping a rocket to myself. Totally normal.', 'Fire goes out the back, right?'],
    fuel: ['Mmm, fuel. Not for drinking.', 'More boom juice!', 'This tank sloshes with potential.'],
    sensor: ['Ooh, a gadget!', 'Science! In my cockpit!', 'Now I know things. Flying things.'],
  } satisfies Record<ShopCategory, string[]>,
  equip: ['Swapping gear. Very tactical.', 'New day, new build.', 'I have a plan. Sort of.'],
  unequip: ['Who needs instruments anyway?', 'Flying by feel. Bold.', 'Less clutter, more fluff.'],
  results: {
    record: ['Did you SEE that?!', 'New record! Write it in the bamboo!', 'I am the fastest, highest, flyingest panda!'],
    meh: ['That was a warm-up.', 'The wind was against me. Definitely the wind.', 'I meant to land there.'],
    short: ['…we do not talk about that one.', 'I tripped. On the sky.', 'Ow. Again tomorrow!'],
  },
  launch: ['Wheeee!', 'Here I gooo!', 'Bamboo-zaaa!', 'Cowabunga!'],
  boost: ['ROCKET TIME!', 'Zoooom!', 'Hold onto your fluff!'],
  crash: ['Oof!', 'Ouch!', 'My fluff!', 'Bonk!'],
  coin: ['Shiny!', 'Ka-ching!', 'Mine!'],
  ring: ['Wooosh!', 'Speed ring!'],
  balloon: ['Pop!', 'Boing!'],
  splash: ['SPLOOSH!', 'Skippy skip!', 'Pandas can swim, right?'],
  lastFlap: ['Arms… so… tired…', 'That was my last flap!'],
  done: ['Again! Again!', 'Nailed it. Mostly.', 'Where am I?'],
  goal: ['PARADISE! I made it!', 'So… much… bamboo!'],
};

export type QuipKey = Exclude<keyof typeof LINES, 'buy' | 'results'>;

let last = '';

function pick(list: readonly string[]): string {
  if (list.length === 1) return list[0];
  let line = list[Math.floor(Math.random() * list.length)];
  if (line === last) line = list[(list.indexOf(line) + 1) % list.length];
  last = line;
  return line;
}

export const quip = (key: QuipKey): string => pick(LINES[key]);
export const buyQuip = (c: ShopCategory): string => pick(LINES.buy[c]);
export const resultQuip = (kind: keyof typeof LINES.results): string => pick(LINES.results[kind]);
