# Gamble With Your Friends — Research Reference

Purpose: reference for re-skinning a first-person co-op survival roguelike (Muck-like, WebGL)
to borrow the look/feel of *Gamble With Your Friends* and add a gambling mechanic.

Note on the name/date: the Steam title is **"Gamble With Your Friends"** (GWYF), Steam app 3892270,
released **1 May 2026** (not 2025), $7.99, developer **TEAM GWYF** (SkyBrave, blazitt, Gevizz, Kiwick
Studios), publisher **TENSTACK**. "Gamble With Friends" on Google Play is an unrelated mobile app.
Sold 500k copies in 3 days and 1M in its first week; ~88% positive of ~11k Steam reviews.
Engine: **Unity** (inferred with high confidence: BepInEx 5.4 mod loader, dnSpy decompiles, saves in
`AppData/LocalLow`). Steam tags: Multiplayer, Online Co-Op, Gambling, Comedy, **Physics**,
**First-Person**, Adventure, Exploration, 3D, Atmospheric, Indie, Casual.

Research caveat: the network proxy blocked every direct page fetch (Steam, SteamDB, wikis, reviews);
everything below comes from search-engine summaries of those pages. Anything not confirmed by at
least one summary is marked **unconfirmed**.

---

## 1. Art style

**Overall.** Reviewers consistently describe it as "stylized, exaggerated", "colorful, somewhat
caricatured", "intentionally goofy character models", "animations that frequently lean into slapstick
comedy", "wacky visuals", "not visual fidelity but flair for absurdity". A July 2026 YouTube essay
("Stylized Art Direction: A 'Gamble with your friends' Study") frames it as TENSTACK's house style for
comedic co-op. It sits squarely in the "friendslop" visual family (Lethal Company / Content Warning /
R.E.P.O. lineage): low-detail, chunky, readable silhouettes, humour over polish.

**Characters (confirmed facts).**
- Simple humanoid with separately removable **eye(s), mouth, and legs** (body parts are a game
  resource, see §4). Losing an eye gives a blind spot; losing the mouth mutes voice chat (emotes
  only); losing legs makes you **roll around** instead of walk. So: a body built from discrete
  detachable pieces, physics-capable.
- Base body colour is a free **paint-bath** pick (a bathtub of paint plus a colour panel in the hub
  bathroom; jump in to recolour). So the base skin is a single flat tint, with cosmetics layered on.
- Players spawn inside a **cardboard box** and press E to climb out.
- Ambient NPC casino patrons wander the floors and physically bump into players; floor NPCs/dealers
  are costumed to match each floor's theme.
- **Unconfirmed**: exact proportions (head:body ratio), eye style. Given detachable eye/mouth and the
  caricature description, assume big simple eyes and a big mouth on a rounded, stubby body.

**Shading / rendering.** Described only as "stylized" / "cartoonish". Cel-banding, outline pass and
texture resolution are **unconfirmed** — no source specifies the shader. Treat "flat-ish colour,
soft stylized lighting, low texture detail, saturated" as the safe reading.

**Environment / palette.**
- A casino **tower** with 4 themed floors, connected by an elevator (there is an "Elevator Song"
  track). Floor themes from the OST track names: Floor 1 "Welcome to Casino" (classic casino),
  Floor 2 **"Piña Colada Land"** (tropical/tiki), Floor 3 **"In the Club"** (nightclub; has a
  dancefloor track), Floor 4 **"High Rollers Only"** (VIP/luxury). Boss room for the finale.
- Hub is a shared suburban **neighbourhood**: your house, "Nibor Second Hand Store" (cosmetics),
  an item shop ("Shady Deals"), a limousine that drives everyone to the casino, a loan-shark phone,
  a body-restoration booth, and (post-launch) a basketball court.
- Games are physical machines/tables you walk up to; a **keypad** per table sets bets; friend wins
  spawn floating money pop-ups.
- **Unconfirmed**: specific hex palette. Reviewers say "colorful"; theme names imply
  red/gold/green-felt (F1), teal/orange/pink tropical (F2), magenta/cyan/UV club neon (F3),
  black/gold/white luxury (F4).

**UI.** Shared bank total and daily quota are always on screen with a 5-minute countdown; a mod
"better money display" implies large numeric readouts. Money pop-ups appear when friends win. Emote
wheel. Font/iconography **unconfirmed**.

**Camera.** **First-person** (Steam tag; a photo-mode mod *adds* third-person/selfie/freecam, which
confirms first-person is the default).

**Animation.** Slapstick physics: ragdoll-ish rolling when legless, being shot, thrown items,
scoring baskets with a friend's head, getting stuffed into the limo. Emotes via wheel.

## 2. Cosmetics / items

- **212 cosmetics** across **7 clothing slots** (one item per slot): hats, hairstyles, outfits,
  glasses/accessories, plushies etc. Colour is a separate free paint-bath choice.
- Bought at **Nibor Second Hand Store** with **Tickets**; stock is **randomised each lobby load**;
  prices ~2–6 tickets. Pick up one item, place it in the sale area, press BUY. Equip from a wardrobe
  in the house (page through with the wardrobe doors, E to equip).
- Purchases are **account-wide and permanent**, surviving a lost run (a fresh save also starts with
  15 tickets, which players exploit to farm cosmetics).
- Design tension reviewers praise: cosmetics and gameplay items share the same Ticket currency, so
  "silly hat vs. Holy Statue" arguments happen in-group.
- No loot drops, no real-money purchases, no Steam inventory items.

## 3. Movement & player feel

- First-person, WASD/mouse; interact/climb-out/equip is **E**. Rebindable actions include
  Throw Item, Use Item, Emote Wheel, Skip Cutscene, Pause; input categories include placement,
  interact, confirm/cancel, item use, inventory, voice, menu. Sprint/jump/crouch keys **unconfirmed**
  (search summaries returned generic Shift/Space, not GWYF-specific).
- **Proximity voice chat** built in, with a selectable mode (push-to-talk vs open — video exists).
- **Emote wheel** with "many emotes" (list unconfirmed).
- Held items with throw/drop; physics tag; players can be shot (Quota Gun), tasered, and body parts
  removed; legless players roll.
- Tables/machines are used standing; interaction is a mouse-raycast click on the machine (a known
  annoyance is NPCs blocking the click ray), with a keypad for bet amounts. No evidence of a
  sit-down animation — **unconfirmed**.
- Controller support is partial (Xbox works, Steam Deck "Playable" but no default layout).

## 4. Gambling games & mechanics

**Run structure.** 1–6 players share **one bank account and one debt** to loan shark **Jeff Booth**
("Jeff Booth's Paradise"). **12 days**, **4 floors** (F1 days 1–3, F2 4–6, F3 7–9, F4 10–12).
Each day: hub (shop, challenges) → limo → casino → **5-minute timer** to push the shared bank
above the day's **quota** (quota, min bets and payouts scale up each day/floor). Miss quota = run
over. Each entry picks **4 machines** from the floor's pool at random layout positions.

**Games (16 named of "17"):** Roulette, Wheel of Fortune, Money Wheel, Blackjack, Baccarat,
1-Player Poker, Penguin Cross (Chicken-Cross style climb multiplier), Keno, Crash (rocket
multiplier, cash out), Dragon Tower (climb rows avoiding dragon eyes), Plinko, Duck Race, Slots,
HiLo, Street Craps, Mine Sweeper (more mines = higher multiplier). Final boss room = one
**double-or-nothing coin flip**.

**Odds.** Not a real-casino sim: no traditional house edge (Vegas Aces review). A decompile
(build 1.0.11) ranked games by RTP: **Slots and Duck Race favour the player**, Crash is the worst.
Dragon Tower is save-scummable (eye positions are memorisable). Community advice: 50/50 roulette
bets, stand on 15+ in blackjack, cash out Crash at ~1.5x, cash out climbers at ~3x, one min bet
to test a new table.

**Currencies.** *Cash* (shared bank, spent on bets, lost on run fail). *Tickets* (meta currency,
persistent across the run): earned by completing **loan-shark challenges** — 5 offered per day,
tied to the machines present that day; **reroll costs 1 ticket, escalating** per reroll. One
source also says tickets come from ending a night in profit (single source). New save = 15 tickets.

**Items (15, bought with tickets at the item shop; "sketchy items" that rig odds):**

| Item | Tix | Effect |
|---|---|---|
| Angel's Reel | 3 | chance to refund your last loss |
| Devil's Reel | 3 | triple your last win or zero it |
| Golden Chip | 4 | one free all-in bet |
| Taser | 4 | zap a table keypad to raise its max bet |
| Mystery Box | 4 | random item from the pool |
| Drink | 5 | more profit while drunk (screen effect) |
| Quota Gun | 5 | shoot a body part off a friend: +33% of today's quota each |
| Camera | 6 | photograph a winning player for bonus profit |
| Microphone | 6 | sing: nearby players earn more |
| Stake Holder | 6 | passive: amplifies your other items (not Time Machine) |
| Holy Statue | 7 | while held+active, prevents money loss nearby |
| Insurance | 7 | reduces money lost on failed bets |
| Time Machine | ? | reverses every result from the last minute (wins too) |
| Gambler's Confidence | ? | passive: more money per win |
| Bonus Draw | 8 | wins also grant bonus tickets |

**Body-part economy.** Sell your own eye/mouth/legs at the **Body Shredder** for cash, or get shot
by the Quota Gun; buy parts back at a booth next to the loan-shark phone for tickets. Debuffs are
real (blind spot, mute, rolling).

**Endings (3):** pay the debt ("quit gambling and start a new life"), gamble and win the coin flip
(money doubles, "New Management"), gamble and lose ("I Gambled So Hard"). Loading screens and
shark dialogue keep warning about chasing wins.

**Why it works with friends.** One shared wallet + one timer + loud proximity VOIP = constant
negotiation, blame, and "who bet the whole bank on red". Items are social weapons (taser, gun,
camera, mic). Body parts make failure funny and visible on the avatar. Cosmetics compete with
power for the same currency. Runs are ~1 hour; reviewers say novelty fades after a few runs.

## 5. Multiplayer

- **1–6 players**, online only, **friends-only**; host clicks **+** in the main menu to invite
  Steam friends; a toggle switches **Friends / Invite Only**. No public matchmaking, no room codes
  (invites are Steam overlay). A mod raises the cap beyond 6.
- **Peer-to-peer, host-authoritative**: lobby creator is host; guidance is "best connection hosts".
- Lobby is the hub neighbourhood; everyone spawns in boxes; run starts when the group boards the
  limo. Cutscenes are skippable.

## 6. Design translation for a WebGL first-person survival roguelike

Keep survival/crafting/bosses untouched; change the skin and add a gambling layer.

1. **Toon shading, 2–3 bands + outline.** Custom lit shader: `NdotL` stepped into 3 bands
   (0.0 / 0.55 / 1.0) with a slight ramp blur, specular off, plus an inverted-hull outline
   (~0.02 world units, black or dark tint of base colour). This matches the "flat, caricatured"
   read even though GWYF's exact shader is unconfirmed.
2. **Saturated palette.** Push albedo saturation to 0.8–1.0. Biome/day palette: felt green `#0f7a3a`,
   casino red `#c8102e`, gold `#f2b632`, cream `#f3e9d2`. Night = "In the Club" palette: magenta
   `#ff2fa0`, cyan `#19d3ff`, violet `#7a3cff` on near-black `#0b0b14`.
3. **Neon point lights at night.** 3–6 coloured point lights around the camp/dealer station
   (magenta/cyan, range 8–12 m, intensity pulsing 0.8–1.2 at ~1 Hz). Add cheap bloom to sell it.
4. **Chunky avatar.** Rounded capsule body, oversized head (~1.6× normal), big simple eyes and a
   wide mouth as separate meshes so they can be "lost"; flat body tint chosen from a paint palette.
   Hats/glasses parent to the head bone; outfit slots (7 max) as mesh swaps.
5. **Bouncy animation.** Idle bob 3–4 cm at 1 Hz, exaggerated run arm-swing, squash-stretch on
   jump/land (scale 1.1/0.9 over 0.1 s), and an emote wheel (radial menu on a held key) with
   4–8 loops. Ragdoll on death; optional "legless roll" as a curse state.
6. **Casino-styled HUD.** Coins rendered as stacked poker chips (edge stripes, denomination colours:
   white 1, red 5, green 25, black 100, purple 500). Big bold numeric counter with money pop-ups on
   gains. Round pill buttons, felt-texture panels with gold trim. Font: a chunky rounded sans.
7. **Dealer station** (new craftable/found structure). Walk up, click to bet **coins** on a mini
   game; rewards are **skills/boons** rather than raw coins so survival balance stays intact:
   win = pick 1 of 3 boons; lose = coins gone. Start with 2–3 games only: Roulette (red/black 2×,
   single colour slot 5×), HiLo, Slots. Implement odds as data-driven RTP (~0.9–1.1).
8. **Keypad bet entry.** Min/max bet per station that scales with day number; min bet ×1.5 per
   day mirrors GWYF's escalating quota pressure.
9. **"Sketchy items" as one-shot consumables** dropped or bought: Angel's Reel (refund last loss),
   Devil's Reel (3× or 0 last win), Golden Chip (free all-in), Holy Statue (no loss for 30 s
   nearby), Insurance (halve losses). Keep them co-op-visible (held in hand, glowing).
10. **Social chaos items.** Camera (photograph a teammate to grant a buff), Microphone (nearby
    teammates earn +25% coins while "singing"), Taser (raise a station's max bet). Cheap, funny,
    and they encourage clustering, which suits proximity VOIP.
11. **Body-part stakes (optional, high impact).** Let players wager an eye (vignette/blind spot),
    mouth (mute VOIP, emotes only), or legs (slow roll) for a big boon; buy back at a "shredder"
    booth. Visually detach the mesh so the loss is readable to friends.
12. **Daily quota flavour, not gate.** A "loan shark" NPC posts an optional daily coin quota with a
    ticket-style meta-currency reward that buys cosmetics only, keeping the roguelike's own
    progression intact. Randomise the cosmetic shop stock each session and make purchases
    account-permanent (localStorage / server profile).
13. **Casino set dressing over the survival map.** Felt-covered crafting tables, chip-stack
    resource piles, slot-machine chests, an elevator door as the boss-arena entrance, and a limo as
    the run-start trigger. Ambient NPC "patrons" are optional flavour near the dealer station.

## Sources

Steam store: https://store.steampowered.com/app/3892270/Gamble_With_Your_Friends/
Steam community/reviews: https://steamcommunity.com/app/3892270
SteamDB: https://steamdb.info/app/3892270/ ; patch notes https://steamdb.info/patchnotes/23172976/
Metacritic details: https://www.metacritic.com/game/gamble-with-your-friends/details/
Wikis: https://gamblewithyourfriends.wiki.gg/ ; https://gamblewithyourfriends.fandom.com/wiki/Gamble_With_Your_Friends ; https://gamblewithyourfriends.net/
Reviews: https://gamedaily.com/games/gamble-with-your-friends-review ; https://www.noobfeed.com/reviews/gamble-with-your-friends-review ; https://www.ngohq.com/2026/06/16/gamble-with-your-friends-review/ ; https://game8.co/reviews/gamble-with-your-friends/gamble-with-your-friends-review ; https://finalweapon.net/2026/05/18/gamble-with-your-friends-review/ ; https://www.vegas-aces.com/articles/casino-experts-review-gamble-with-your-friends/
Sales/press: https://www.gamesradar.com/games/co-op/another-friendslop-hit-prints-money-on-steam-as-gamble-with-your-friends-sells-500k-copies-in-3-days-speechless/ ; https://games.gg/news/gamble-with-your-friends-million-sales/ ; https://www.destructoid.com/this-indie-game-that-combined-friendslop-with-gambling-just-sold-over-a-million-copies/
Guides (games/items/floors): https://www.thegamer.com/gamble-with-your-friends-casino-games-floors-unlock-guide/ ; https://games.gg/gamble-with-your-friends/guides/gamble-with-your-friends-items-breakdown/ ; https://games.gg/gamble-with-your-friends/guides/every-casino-game-in-gamble-with-your-friends/ ; https://www.whisperofthehouse.com/gamble-with-your-friends/tickets-items-body-parts ; https://www.whisperofthehouse.com/gamble-with-your-friends/beginner-guide ; https://gamerant.com/gamble-with-your-friends-all-best-item-tier-list/ ; https://gamerant.com/gamble-with-your-friends-best-tips-tricks-strategies/ ; https://www.neonlightsmedia.com/blog/gamble-with-your-friends-best-items-games
Cosmetics: https://www.thegamer.com/gamble-with-your-friends-customization-outfits-accessories-guide/ ; https://gamerant.com/gamble-with-your-friends-how-get-unlock-cosmetics-clothes-fast/ ; https://www.nexusmods.com/gamblewithyourfriends/mods/30 ; https://www.nexusmods.com/gamblewithyourfriends/mods/32
Challenges/endings: https://www.thegamer.com/gamble-with-your-friends-challenge-loan-shark-guide/ ; https://www.destructoid.com/all-challenges-in-gamble-with-your-friends-and-how-to-complete-them/ ; https://deltiasgaming.com/gamble-with-your-friends-all-endings-explained/ ; https://gamblewithyourfriends.net/endings/
Multiplayer/controls: https://www.thegamer.com/gamble-with-your-friends-multiplayer-invite-guide/ ; https://gamblewithyourfriends.blog/multiplayer-guide/ ; https://www.nexusmods.com/gamblewithyourfriends/mods/23 ; https://www.nexusmods.com/gamblewithyourfriends/mods/10 ; https://steamcommunity.com/app/3892270/discussions/0/845131323417856701/ ; https://www.youtube.com/watch?v=EamETWkXyNM
Odds analysis: https://justinbecker.dev/blog/2026/05/30/gamble-with-your-friends-casino-analysis/
Art direction essay: https://www.youtube.com/watch?v=L646-N9boo0
Soundtrack (floor names): https://karlflodin.bandcamp.com/album/gamble-with-your-friends-original-soundtrack ; https://store.steampowered.com/app/4635620/Gamble_With_Your_Friends_Soundtrack/
Modding/engine: https://thunderstore.io/c/gamble-with-your-friends/ ; https://gamblewithyourfriends.net/mods/
