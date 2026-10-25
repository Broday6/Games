'use strict';
// LUCKY REELS — static game data: symbols, items, rent schedule, landlords, starting sets, stakes.
// Shared by the browser and by the node test/sim harness (attaches to a global LR namespace).
(function (LR) {
  // rarity: c common, u uncommon, r rare, v very rare.  pool:false = only made by other symbols.
  // tags: fruit flower plant animal bird insect human sea ore gem night food egg money classic weather explosive
  const S = [
    // ---------------- COMMON ----------------
    ['coin', 'Coin', 'c', 1, 'money', 'A shiny coin. Pays 1.'],
    ['cherry', 'Cherry', 'c', 1, 'fruit classic', 'Classic slot fruit. Pays 1.'],
    ['pearl', 'Pearl', 'c', 1, 'sea gem', 'Pays 1. Oysters make Pearls pay x3.'],
    ['flower', 'Flower', 'c', 1, 'flower plant', 'Pays 1. Bees, Rain and the Sun make Flowers pay more.'],
    ['cat', 'Cat', 'c', 1, 'animal', 'Eats adjacent Milk (+9 each) and Fish (+7 each).'],
    ['milk', 'Milk', 'c', 1, 'food', 'Pays 1. A Cat next to it drinks it for +9.'],
    ['ore', 'Ore', 'c', 1, 'ore', 'Pays 1. Miners dig it for +12. When destroyed, 1 in 2 chance to add a random Gem.'],
    ['bee', 'Bee', 'c', 1, 'insect animal', 'Adjacent Flowers pay x2. +1 for each adjacent Flower.'],
    ['seed', 'Seed', 'c', 1, 'plant', '1 in 4 chance each spin to sprout into a Flower, Rose or Sunflower.'],
    ['egg', 'Egg', 'c', 1, 'egg', '1 in 10 chance each spin to hatch into a Chick.'],
    ['dog', 'Dog', 'c', 1, 'animal', '+2 for each adjacent Human.'],
    ['clover', 'Clover', 'c', 1, 'plant', 'Pays 1. While you own it, rarer symbols show up more often.'],
    ['die', 'Die', 'c', 0, 'classic', 'Rolls and pays 1 to 3 each spin.'],
    ['shell', 'Shell', 'c', 1, 'sea', '+1 for each other adjacent Sea symbol.'],
    ['fish', 'Fish', 'c', 1, 'sea food animal', 'Pays 1. A Cat next to it eats it for +7.'],
    ['owl', 'Owl', 'c', 1, 'night bird animal', 'Grows +1 permanently every 5 spins in play (up to +3). The Moon makes it pay x3.'],
    ['bat', 'Bat', 'c', 1, 'night animal', '+1 for each adjacent Night symbol.'],
    ['candle', 'Candle', 'c', 1, 'night', 'Adjacent Night symbols pay +1.'],
    ['banana', 'Banana', 'c', 1, 'fruit', 'Pays 1. A Monkey next to it eats it for +8.'],
    ['pumpkin', 'Pumpkin', 'c', 1, 'plant night', 'After 6 spins in play, carves itself into a Lantern.'],
    ['bubble', 'Bubble', 'c', 2, 'sea', 'Pays 2. Pops after 3 spins.'],
    ['mouse', 'Mouse', 'c', 1, 'animal', 'Eats adjacent Cheese for +15 each.'],
    ['coal', 'Coal', 'c', 0, 'ore', 'Pays 0. After 15 spins in play, it is pressed into a Diamond.'],
    ['caterpillar', 'Caterpillar', 'c', 1, 'insect animal', 'After 5 spins in play, becomes a Butterfly.'],
    // ---------------- UNCOMMON ----------------
    ['miner', 'Miner', 'u', 1, 'human', 'Digs adjacent Ore (+12 each) and Big Ore (+18 each), destroying them.'],
    ['bigore', 'Big Ore', 'u', 2, 'ore', 'Pays 2. When destroyed, adds 2 random Gems.'],
    ['cow', 'Cow', 'u', 2, 'animal', '1 in 4 chance each spin to add a Milk.'],
    ['cheese', 'Cheese', 'u', 2, 'food', 'Pays 2. A Mouse next to it eats it for +15.'],
    ['rose', 'Rose', 'u', 2, 'flower plant', 'A pretty Flower. Pays 2.'],
    ['sunflower', 'Sunflower', 'u', 2, 'flower plant', 'A Flower. +1 for each adjacent Bee.'],
    ['honey', 'Honey', 'u', 3, 'food', 'Pays 3. A Bear next to it eats it for +40.'],
    ['bear', 'Bear', 'u', 2, 'animal', 'Eats adjacent Honey for +40 each.'],
    ['oyster', 'Oyster', 'u', 1, 'sea', 'Adjacent Pearls pay x3. 1 in 5 chance each spin to add a Pearl.'],
    ['crab', 'Crab', 'u', 1, 'sea animal', '+3 for each adjacent Sea symbol.'],
    ['wolf', 'Wolf', 'u', 2, 'night animal', '+2 for each other adjacent Wolf. The Moon makes it pay x3.'],
    ['thief', 'Thief', 'u', 0, 'human', 'Steals 1 from each adjacent symbol (they pay 1 less) and pays 2 for each coin stolen.'],
    ['magpie', 'Magpie', 'u', 0, 'bird animal', 'Pays 0, but every 4th spin in play pays 10.'],
    ['bomb', 'Bomb', 'u', 0, 'explosive', 'Explodes: destroys every adjacent symbol and itself. +4 for each symbol destroyed.'],
    ['luckydie', 'Lucky Die', 'u', 0, 'classic', 'Rolls and pays 1 to 6 each spin.'],
    ['bell', 'Bell', 'u', 2, 'classic', '+1 for each adjacent Cherry.'],
    ['bar', 'Bar', 'u', 3, 'classic', 'Adjacent Bells and Cherries pay x2.'],
    ['monkey', 'Monkey', 'u', 1, 'animal', 'Eats adjacent Bananas (+8 each) and Coconuts (+14 each).'],
    ['coconut', 'Coconut', 'u', 2, 'fruit', 'Pays 2. A Monkey next to it cracks it for +14.'],
    ['chick', 'Chick', 'u', 1, 'bird animal', '1 in 10 chance each spin to grow into a Chicken.'],
    ['fox', 'Fox', 'u', 2, 'animal', 'Snatches adjacent Eggs (+6 each) and Chicks (+10 each).'],
    ['key', 'Key', 'u', 1, 'money', 'Unlocks adjacent Treasure Chests and Safes (destroying them), then breaks.'],
    ['piggy', 'Piggy Bank', 'u', 0, 'money', 'Pays 0 and saves 2 each spin. After 8 spins it smashes and pays everything saved.'],
    ['star', 'Star', 'u', 1, 'night', 'All adjacent symbols pay +1.'],
    ['ghost', 'Ghost', 'u', 4, 'night', 'Pays 4. Vanishes after 5 spins.'],
    ['lantern', 'Lantern', 'u', 3, 'night', 'Pays 3. Adjacent Night symbols pay +2.', false],
    ['farmer', 'Farmer', 'u', 1, 'human', 'Adjacent Fruit pay x2. Adjacent Seeds always sprout.'],
    ['diver', 'Diver', 'u', 1, 'human sea', 'Collects adjacent Shells (destroying them) and grows +1 permanently for each.'],
    ['cop', 'Cop', 'u', 1, 'human', 'Arrests adjacent Thieves for +20 each.'],
    ['purse', 'Purse', 'u', 1, 'money', '+1 for each adjacent Coin.'],
    ['horseshoe', 'Horseshoe', 'u', 1, 'classic', 'Adjacent Dice always roll their highest number.'],
    ['rain', 'Rain Cloud', 'u', 1, 'weather', 'Adjacent Flowers pay x2. Adjacent Seeds always sprout.'],
    ['butterfly', 'Butterfly', 'u', 3, 'insect animal', 'Pays 3. Adjacent Flowers pay +1.'],
    ['orange', 'Orange', 'u', 2, 'fruit', 'Juicy fruit. Pays 2.'],
    ['sapphire', 'Sapphire', 'u', 2, 'gem', 'A blue Gem. Pays 2.'],
    // ---------------- RARE ----------------
    ['moon', 'Moon', 'r', 3, 'night', 'Adjacent Owls, Wolves and Bats pay x3.'],
    ['sun', 'Sun', 'r', 3, 'weather', 'Adjacent Flowers pay x5.'],
    ['witch', 'Witch', 'r', 2, 'human night', 'Each spin, turns 1 adjacent Common symbol into a random Uncommon. Adjacent Cats pay x3.'],
    ['beehive', 'Beehive', 'r', 3, 'insect', 'Adjacent Bees pay x3. 1 in 6 chance each spin to add Honey.'],
    ['chicken', 'Chicken', 'r', 3, 'bird animal', '1 in 6 chance each spin to lay an Egg. 1 in 40 chance to lay a Golden Egg.'],
    ['goldegg', 'Golden Egg', 'r', 6, 'egg money', 'Solid gold. Pays 6.'],
    ['chest', 'Treasure Chest', 'r', 2, 'money', 'Pays 2. When destroyed (by a Key, Pirate or Bomb), pays 40.'],
    ['seven', 'Lucky 7', 'r', 7, 'classic', 'Pays 7. +7 for each other Lucky 7 on the machine.'],
    ['amethyst', 'Amethyst', 'r', 1, 'gem', 'A Gem that grows +1 permanently every spin it is in play (up to +15).'],
    ['emerald', 'Emerald', 'r', 3, 'gem', 'A Gem. +1 for each other Gem on the machine.'],
    ['ruby', 'Ruby', 'r', 3, 'gem', 'A Gem. +2 for each adjacent Gem.'],
    ['joker', 'Joker', 'r', 0, 'classic', 'Copies the payout of the best adjacent symbol.'],
    ['pirate', 'Pirate', 'r', 2, 'human sea', 'Plunders adjacent Treasure Chests (destroying them) and Pearls (+5 each).'],
    ['banker', 'Banker', 'r', 2, 'human money', '+1 for each Coin you own.'],
    ['safe', 'Safe', 'r', 0, 'money', 'Pays 0 and stores 5 each spin. When destroyed (by a Key or Bomb), pays everything stored.'],
    // ---------------- VERY RARE ----------------
    ['diamond', 'Diamond', 'v', 6, 'gem', 'A Gem. +2 for each other Diamond on the machine.'],
    ['crown', 'Crown', 'v', 4, 'money', 'All adjacent symbols pay x2.'],
    ['dragon', 'Dragon', 'v', 10, 'animal', 'Pays 10. Adjacent Coins and Gems pay x3.'],
    ['genie', 'Genie', 'v', 3, 'night', 'Each spin: 1 in 3 chance to grant a Reroll token, 1 in 8 chance a Removal token.'],
    ['midas', 'King Midas', 'v', 2, 'human', 'Adjacent Coins pay x4.'],
    ['goose', 'Golden Goose', 'v', 4, 'bird animal', '1 in 4 chance each spin to lay a Golden Egg.'],
    ['leprechaun', 'Leprechaun', 'v', 3, 'human', 'Every 7th spin in play, pays 77.'],
  ];
  const SYMBOLS = {};
  const SYM_ORDER = [];
  for (const row of S) {
    const [id, name, rar, value, tags, desc, pool] = row;
    SYMBOLS[id] = { id, name, rar, value, tags: tags.split(' '), desc, pool: pool !== false };
    SYM_ORDER.push(id);
  }
  // human-readable family name for tooltips
  const TAG_NAMES = {
    fruit: 'Fruit', flower: 'Flower', plant: 'Plant', animal: 'Animal', bird: 'Bird', insect: 'Insect', human: 'Human',
    sea: 'Sea', ore: 'Ore', gem: 'Gem', night: 'Night', food: 'Food', egg: 'Egg', money: 'Money', classic: 'Classic',
    weather: 'Weather', explosive: 'Explosive',
  };

  // ---------------- ITEMS (permanent passives) ----------------
  const I = [
    ['coffee', 'Coffee', 'c', 'Cats pay +1 each spin.'],
    ['magnet', 'Coin Magnet', 'c', 'Coins pay +1.'],
    ['fruitbasket', 'Fruit Basket', 'c', 'Fruit pay +1.'],
    ['watering', 'Watering Can', 'c', 'Flowers pay +1. Seeds sprout twice as often.'],
    ['net', 'Fishing Net', 'c', 'Sea symbols pay +1.'],
    ['nightlight', 'Night Light', 'c', 'Night symbols pay +1.'],
    ['beehat', 'Beekeeper Hat', 'c', 'Bees pay +2.'],
    ['tipjar', 'Tip Jar', 'c', '+1 coin each spin for every empty slot on the machine.'],
    ['wishbone', 'Wishbone', 'c', 'Skipping a symbol pick gives 4 coins.'],
    ['milkjug', 'Milk Jug', 'u', 'Cats get +5 more for each Milk or Fish they eat.'],
    ['pickaxe', 'Pickaxe', 'u', 'Miners get +8 more for each Ore or Big Ore they dig.'],
    ['loaded', 'Loaded Dice', 'u', 'Dice roll twice and keep the higher number.'],
    ['dynamite', 'Dynamite', 'u', 'Bombs get +4 more for each symbol destroyed.'],
    ['birdfeeder', 'Bird Feeder', 'u', 'Birds pay +1. Magpies pay every 3rd spin instead of every 4th.'],
    ['jewelbox', 'Jewelry Box', 'u', 'Gems pay +2.'],
    ['oysterknife', 'Oyster Knife', 'u', 'Oysters add Pearls twice as often.'],
    ['honeypot', 'Honey Pot', 'u', 'Honey pays +2. Beehives add Honey twice as often.'],
    ['henhouse', 'Hen House', 'u', 'Eggs hatch and Chicks grow twice as often.'],
    ['badge', 'Name Badge', 'u', 'Humans pay +1.'],
    ['swearjar', 'Swear Jar', 'u', '+2 coins every time a symbol is destroyed.'],
    ['eraser', 'Eraser', 'u', '+2 Removal tokens now and after every rent.'],
    ['gloves', 'Lucky Gloves', 'u', '+2 Reroll tokens now and after every rent.'],
    ['guild', "Thieves' Guild", 'r', 'Thieves steal 2 from each neighbour instead of 1.'],
    ['moonstone', 'Moonstone', 'r', 'The Moon boosts x4 instead of x3.'],
    ['pointyhat', 'Pointy Hat', 'r', 'Witches transform 2 symbols each spin.'],
    ['cauldron', 'Cauldron', 'r', 'Ghosts and Witches pay x2.'],
    ['map', 'Treasure Map', 'r', 'Symbols in the 4 corners pay x2.'],
    ['spotlight', 'Spotlight', 'r', 'The 6 centre symbols pay +1.'],
    ['pockets', 'Deep Pockets', 'r', 'Choose from 4 symbols instead of 3.'],
    ['rabbitfoot', "Rabbit's Foot", 'r', 'Rarer symbols show up much more often.'],
    ['ledger', 'Savings Ledger', 'r', 'After paying rent, earn 10% interest on leftover coins (max 100).'],
    ['rentcontrol', 'Rent Control', 'v', 'All future rent is 15% lower.'],
    ['hourglass', 'Hourglass', 'v', '+1 spin before every rent payment.'],
    ['lastcall', 'Last Call', 'v', 'The final spin before each rent pays x2.'],
    ['jackpotbell', 'Jackpot Bell', 'v', 'Every 7th spin is a Lucky Spin: all payouts x2.'],
  ];
  const ITEMS = {};
  const ITEM_ORDER = [];
  for (const [id, name, rar, desc] of I) { ITEMS[id] = { id, name, rar, desc }; ITEM_ORDER.push(id); }

  const RAR = {
    c: { name: 'Common', col: '#b9c0d6' },
    u: { name: 'Uncommon', col: '#4ee08a' },
    r: { name: 'Rare', col: '#5aa8ff' },
    v: { name: 'Very Rare', col: '#ffc83d' },
  };

  // ---------------- RENT ----------------
  const RENTS = [25, 50, 100, 150, 225, 300, 350, 425, 575, 625, 675, 777, 1000];
  const SPINS = [5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8];

  // ---------------- LANDLORDS ----------------
  const LANDLORDS = [
    { id: 'grimsby', name: 'Mr. Grimsby', title: 'The Landlord', col: '#ffc83d', desc: 'The original. No tricks, just rent.', rent: 1, unlock: null },
    { id: 'bloom', name: 'Baroness Bloom', title: 'Greenhouse Heiress', col: '#ff6fb5', desc: 'Flowers, Plants and Insects are offered twice as often. Rent +10%.', rent: 1.1, bias: { flower: 2, plant: 2, insect: 2 }, unlock: { floor: 5, text: 'Reach floor 5' } },
    { id: 'brine', name: 'Captain Brine', title: 'Harbour Master', col: '#3ed6d0', desc: 'Sea symbols pay +1 and are offered more often. Rent +25%.', rent: 1.25, bias: { sea: 2.5 }, seaBonus: 1, unlock: { floor: 8, text: 'Reach floor 8' } },
    { id: 'vex', name: 'Madame Vex', title: 'Fortune Teller', col: '#b07bff', desc: 'Rarer symbols show up far more often. Rent +30%.', rent: 1.3, luck: 4, unlock: { wins: 1, text: 'Beat the Landlord once' } },
    { id: 'tycoon', name: 'The Tycoon', title: 'Penthouse Owner', col: '#ff8a3d', desc: 'Pick 2 items after every rent. Rent +40%.', rent: 1.4, itemPicks: 2, unlock: { stake: 2, text: 'Win on Stake 2' } },
  ];

  // ---------------- STARTING SETS ----------------
  const STARTS = [
    { id: 'classic', name: 'Classic', syms: ['coin', 'cherry', 'pearl', 'flower', 'cat'], unlock: null },
    { id: 'dig', name: "Miner's Kit", syms: ['miner', 'ore', 'coin', 'cherry', 'flower'], unlock: { floor: 3, text: 'Reach floor 3' } },
    { id: 'farm', name: 'Farmhand', syms: ['seed', 'seed', 'egg', 'cow', 'cat'], unlock: { floor: 6, text: 'Reach floor 6' } },
    { id: 'night', name: 'Night Owl', syms: ['owl', 'candle', 'pumpkin', 'cherry', 'coin'], unlock: { floor: 9, text: 'Reach floor 9' } },
    { id: 'sea', name: 'Sea Dog', syms: ['oyster', 'pearl', 'shell', 'fish', 'coin'], unlock: { codex: 40, text: 'Discover 40 symbols' } },
    { id: 'gambler', name: 'High Roller', syms: ['die', 'die', 'luckydie', 'coin', 'clover'], unlock: { wins: 1, text: 'Beat the Landlord once' } },
  ];

  // ---------------- STAKES (difficulty) ----------------
  const STAKES = [
    { n: 0, name: 'Stake 0', desc: 'The standard lease.' },
    { n: 1, name: 'Stake 1', desc: 'Rent +10%.' },
    { n: 2, name: 'Stake 2', desc: 'Rent +10%. Start with no tokens.' },
    { n: 3, name: 'Stake 3', desc: 'Rent +10%. No starting tokens. Rarer symbols appear less often.' },
    { n: 4, name: 'Stake 4', desc: 'Rent +25%. No starting tokens. Rarer symbols appear less often.' },
    { n: 5, name: 'Stake 5', desc: 'Rent +25%. No starting tokens. Rarer symbols less often. 1 fewer spin per rent from floor 5.' },
  ];

  LR.SYMBOLS = SYMBOLS; LR.SYM_ORDER = SYM_ORDER; LR.TAG_NAMES = TAG_NAMES;
  LR.ITEMS = ITEMS; LR.ITEM_ORDER = ITEM_ORDER; LR.RAR = RAR;
  LR.RENTS = RENTS; LR.SPINS = SPINS; LR.LANDLORDS = LANDLORDS; LR.STARTS = STARTS; LR.STAKES = STAKES;
  LR.COLS = 5; LR.ROWS = 4; LR.CELLS = 20;
})(typeof window !== 'undefined' ? (window.LR = window.LR || {}) : (global.LR = global.LR || {}));
