'use strict';
// EMBER DECK — procedural art: an SVG icon set (cards, relics, statuses, intents, map) and canvas sprites.
(function (root) {
  const ED = root.ED;
  const A = ED.Art = {};

  // ---------------- SVG icons (24x24). class f = filled, a = accent fill ----------------
  const I = {
    sword: '<path d="M19.5 4.5 9 15"/><path d="M15 4h5v5"/><path d="M6.5 12.5l5 5M8 17l-3.5 3.5M5 15.5l3.5 3.5"/><path class="a" d="M19.5 4.5 10.5 13.5 9.5 12.5Z"/>',
    shield: '<path class="a" d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 7v10"/>',
    oar: '<path d="M5 19 15 9"/><path class="a" d="M15 9c1-3 3-5 5-5-0 2-2 4-5 5z"/><path d="M15 9c1-3 3-5 5-5 0 2-2 4-5 5z"/><path d="M4 20l2-2"/>',
    oar2: '<path d="M4 18 14 8M10 20 20 10"/><path class="a" d="M14 8c1-2.5 2.5-4 4.5-4.5C18 5.5 16.5 7 14 8zM20 10c-2.5 1-4 2.5-4.5 4.5 2-.5 3.5-2 4.5-4.5z"/>',
    club: '<path d="M6 20l7-7"/><path class="a" d="M12 12c-1-4 2-8 6-8 2 1 2 4 0 7-2 2-4 2-6 1z"/><path d="M12 12c-1-4 2-8 6-8 2 1 2 4 0 7-2 2-4 2-6 1z"/><circle class="f" cx="16" cy="8" r=".9"/>',
    sweep: '<path d="M3 15c4-7 14-7 18 0"/><path d="M5 19c4-4 10-4 14 0"/><path class="a" d="M17 9l4 6-6-1z"/>',
    sack: '<path class="a" d="M7 9h10l2 10H5z"/><path d="M7 9h10l2 10H5zM9 9 8 5h8l-1 4"/><path d="M8 14h8"/>',
    shieldbash: '<path class="a" d="M10 4 16 6.5v4.5c0 4-2.5 6.5-6 8-3.5-1.5-6-4-6-8V6.5z"/><path d="M10 4 16 6.5v4.5c0 4-2.5 6.5-6 8-3.5-1.5-6-4-6-8V6.5z"/><path d="M18 9l3-1M18 13h3M18 17l3 1"/>',
    fist: '<path class="a" d="M7 10V7a1.5 1.5 0 0 1 3 0v-1a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v5c0 4-3 6-6 6h-2c-3 0-5-2-5-5v-2a1.5 1.5 0 0 1 3 0"/><path d="M7 10V7a1.5 1.5 0 0 1 3 0v-1a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v5c0 4-3 6-6 6h-2c-3 0-5-2-5-5v-2a1.5 1.5 0 0 1 3 0"/>',
    coconut: '<circle class="a" cx="11" cy="13" r="7"/><circle cx="11" cy="13" r="7"/><circle class="f" cx="9" cy="11" r="1"/><circle class="f" cx="12.5" cy="10" r="1"/><circle class="f" cx="11" cy="13.5" r="1"/><path d="M18 5l2-2M19 8h3"/>',
    spark: '<path class="a" d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10z"/><path d="M12 2 14 10 22 12 14 14 12 22 10 14 2 12 10 10z"/>',
    tackle: '<path class="a" d="M4 13c0-4 3-7 7-7h3l5 6-5 6h-3c-4 0-7-2-7-5z"/><path d="M4 13c0-4 3-7 7-7h3l5 6-5 6h-3c-4 0-7-2-7-5z"/><path d="M20 6l2-2M21 12h2M20 18l2 2"/>',
    flare: '<path d="M12 22V12"/><path class="a" d="M12 12c-3-2-3-6 0-9 3 3 3 7 0 9z"/><path d="M12 12c-3-2-3-6 0-9 3 3 3 7 0 9z"/><path d="M5 7l2 1M19 7l-2 1M4 13h2M18 13h2"/>',
    hook: '<path d="M14 3v11a4 4 0 0 1-8 0v-2"/><path d="M6 12 4 14M6 12l2 2"/><circle class="a" cx="14" cy="3.5" r="1.8"/>',
    wave: '<path class="a" d="M2 16c3 0 3-3 6-3s3 3 6 3 3-3 6-3 2 2 2 2v6H2z"/><path d="M2 16c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/><path d="M5 10c2-4 7-6 11-3-3 0-4 2-3 4"/>',
    barnacle: '<path class="a" d="M4 18 7 10h4l2 8zM12 18l2.5-6h3.5l2 6z"/><path d="M4 18 7 10h4l2 8zM12 18l2.5-6h3.5l2 6zM2 20h20"/><path d="M8 6l1 2M15 7l.5 2"/>',
    anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8"/><path class="a" d="M4 14c0 4 4 7 8 7s8-3 8-7l-2 1 2-1 1 2"/><path d="M4 14c0 4 4 7 8 7s8-3 8-7M4 14l-1 2M4 14l2 1M20 14l-2 1M20 14l1 2"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
    wall: '<path class="a" d="M3 9h18v11H3z"/><path d="M3 9h18v11H3zM3 14.5h18M8 9v5.5M15 9v5.5M11.5 14.5V20M5 9V5h3v4M16 9V5h3v4"/>',
    parry: '<path d="M4 4l16 16M20 4 4 20"/><path class="a" d="M12 9.5 14.5 12 12 14.5 9.5 12z"/><path d="M3 7l4-4M17 3l4 4"/>',
    eye: '<path class="a" d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z"/><path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z"/><circle class="f" cx="12" cy="12" r="3"/>',
    horn: '<path class="a" d="M3 10l12-6v16L3 14z"/><path d="M3 10l12-6v16L3 14zM15 9c3 0 5 1.5 5 3s-2 3-5 3"/><path d="M6 14l1 6h3l-1-5"/>',
    fortress: '<path class="a" d="M3 21V9h3V6h3v3h6V6h3v3h3v12z"/><path d="M3 21V9h3V6h3v3h6V6h3v3h3v12zM10 21v-5a2 2 0 0 1 4 0v5"/>',
    crown: '<path class="a" d="M3 18 4 7l5 5 3-7 3 7 5-5 1 11z"/><path d="M3 18 4 7l5 5 3-7 3 7 5-5 1 11zM3 21h18"/>',
    crown2: '<path class="a" d="M3 18 4 7l5 5 3-7 3 7 5-5 1 11z"/><path d="M3 18 4 7l5 5 3-7 3 7 5-5 1 11z"/><path d="M12 2c-1 1.5-1 2.5 0 3.5 1-1 1-2 0-3.5z"/>',
    hull: '<path class="a" d="M2 13h20l-3 7H5z"/><path d="M2 13h20l-3 7H5zM12 13V3l7 8h-7"/><path d="M12 5 6 11h6"/>',
    mast: '<path d="M8 21 18 3"/><path class="a" d="M15 7c3 2 4 5 3 8l-6-3z"/><path d="M15 7c3 2 4 5 3 8l-6-3"/><path d="M3 21h10M6 18l3 3"/>',
    heart: '<path class="a" d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/><path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/>',
    spear: '<path d="M4 20 16 8"/><path class="a" d="M16 8l1-5 4 4-5 1z"/><path d="M16 8l1-5 4 4-5 1zM7 14l3 3"/>',
    flame: '<path class="a" d="M12 22c-4 0-7-3-7-7 0-5 5-7 5-12 3 2 5 5 5 8 1-1 2-2 2-4 2 2 3 5 3 8 0 4-4 7-8 7z"/><path d="M12 22c-4 0-7-3-7-7 0-5 5-7 5-12 3 2 5 5 5 8 1-1 2-2 2-4 2 2 3 5 3 8 0 4-4 7-8 7z"/><path d="M12 19c-2 0-3-1.5-3-3 0-2 2-3 2-5 2 1 4 3 4 5 0 2-1 3-3 3z"/>',
    flame2: '<path class="a" d="M8 22c-3 0-5-2-5-5 0-3 3-5 3-8 2 1 3 3 3 5 1-1 1-2 1-3 2 2 3 4 3 6 0 3-2 5-5 5zM17 20c-2 0-4-2-4-4 0-3 3-4 3-7 2 1 4 4 4 7 0 2-1 4-3 4z"/><path d="M8 22c-3 0-5-2-5-5 0-3 3-5 3-8 2 1 3 3 3 5 1-1 1-2 1-3 2 2 3 4 3 6 0 3-2 5-5 5zM17 20c-2 0-4-2-4-4 0-3 3-4 3-7 2 1 4 4 4 7 0 2-1 4-3 4z"/>',
    ash: '<path class="a" d="M4 20c1-3 4-4 8-4s7 1 8 4z"/><path d="M4 20c1-3 4-4 8-4s7 1 8 4zM9 13c-1-2 0-4 2-5M14 12c1-2 0-4-1-6M12 5V3"/><circle class="f" cx="7" cy="10" r=".8"/><circle class="f" cx="17" cy="9" r=".8"/>',
    whip: '<path d="M4 20l4-4"/><path class="a" d="M8 16c2-2 3-5 6-6s5 1 6 3-1 4-3 4"/><path d="M8 16c2-2 3-5 6-6s5 1 6 3-1 4-3 4"/><path d="M17 17c-1-2 0-3 1-4"/>',
    blaze: '<path class="a" d="M12 2c2 4 6 5 6 11a6 6 0 0 1-12 0c0-3 2-4 2-6 1 1 2 2 2 4 1-3 2-5 2-9z"/><path d="M12 2c2 4 6 5 6 11a6 6 0 0 1-12 0c0-3 2-4 2-6 1 1 2 2 2 4 1-3 2-5 2-9z"/><path d="M3 21h18"/>',
    smoke: '<path class="a" d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9-2 4 4 0 0 1 4 6 3 3 0 0 1-2 4z"/><path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9-2 4 4 0 0 1 4 6 3 3 0 0 1-2 4z"/><path d="M8 21h8"/>',
    fan: '<path class="a" d="M12 20 3 9a12 12 0 0 1 18 0z"/><path d="M12 20 3 9a12 12 0 0 1 18 0zM12 20 8 5M12 20l4-15M12 20V4"/>',
    steam: '<path d="M8 20c-2-3 2-4 0-7s2-4 0-7M12 20c-2-3 2-4 0-7s2-4 0-7M16 20c-2-3 2-4 0-7s2-4 0-7"/><path class="a" d="M4 21h16v1H4z"/>',
    twigs: '<path d="M4 20 18 6M8 20 20 10M3 15l13-9"/><path d="M14 9l3 0M11 13l1-3"/><path class="a" d="M17 4c1 1 2 1 3 0-1 2-1 3 0 4-2-1-3 0-3 0z"/>',
    bolt: '<path class="a" d="M13 2 4 14h7l-1 8 9-12h-7z"/><path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    hand: '<path class="a" d="M7 12V6a1.5 1.5 0 0 1 3 0v4V4a1.5 1.5 0 0 1 3 0v6V5a1.5 1.5 0 0 1 3 0v7l1-2a1.5 1.5 0 0 1 2.6 1.4L17 17c-1 3-3 4-6 4-3 0-5-2-5-5z"/><path d="M7 12V6a1.5 1.5 0 0 1 3 0v4V4a1.5 1.5 0 0 1 3 0v6V5a1.5 1.5 0 0 1 3 0v7l1-2a1.5 1.5 0 0 1 2.6 1.4L17 17c-1 3-3 4-6 4-3 0-5-2-5-5z"/>',
    boom: '<path class="a" d="M12 2l2 6 6-3-3 6 5 2-6 2 2 6-6-3-3 5-1-6-6 1 4-5-4-4 6 0z"/><path d="M12 2l2 6 6-3-3 6 5 2-6 2 2 6-6-3-3 5-1-6-6 1 4-5-4-4 6 0z"/>',
    heartflame: '<path class="a" d="M12 21s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/><path d="M12 21s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/><path d="M12 17c-2 0-3-1-3-3 0-2 2-2 2-4 2 1 4 2 4 4 0 2-1 3-3 3z"/>',
    shieldflame: '<path class="a" d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 17c-2 0-3-1-3-3 0-2 2-3 2-5 2 1 4 3 4 5 0 2-1 3-3 3z"/>',
    drop: '<path class="a" d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    embers: '<circle class="a" cx="7" cy="16" r="3"/><circle class="a" cx="15" cy="10" r="2.5"/><circle class="a" cx="17" cy="18" r="2"/><circle cx="7" cy="16" r="3"/><circle cx="15" cy="10" r="2.5"/><circle cx="17" cy="18" r="2"/><path d="M10 6l1-3M19 5l1-2M5 9l-1-2"/>',
    brand: '<path d="M4 20l8-8"/><path class="a" d="M12 6h8v8h-8z"/><path d="M12 6h8v8h-8zM16 6v8M12 10h8"/>',
    phoenix: '<path class="a" d="M12 21c-1-4-1-6 0-9-3 0-7-2-9-7 3 1 6 1 9 4-1-3 0-6 0-7 1 1 1 4 0 7 3-3 6-3 9-4-2 5-6 7-9 7 1 3 1 5 0 9z"/><path d="M12 21c-1-4-1-6 0-9-3 0-7-2-9-7 3 1 6 1 9 4-1-3 0-6 0-7 1 1 1 4 0 7 3-3 6-3 9-4-2 5-6 7-9 7 1 3 1 5 0 9z"/>',
    pyre: '<path d="M3 21l18-4M3 17l18 4"/><path class="a" d="M12 16c-3 0-5-2-5-5 0-3 3-4 3-7 2 1 3 3 3 5 1-1 2-2 2-3 2 2 2 4 2 5 0 3-2 5-5 5z"/><path d="M12 16c-3 0-5-2-5-5 0-3 3-4 3-7 2 1 3 3 3 5 1-1 2-2 2-3 2 2 2 4 2 5 0 3-2 5-5 5z"/>',
    comet: '<circle class="a" cx="16" cy="8" r="4"/><circle cx="16" cy="8" r="4"/><path d="M13 11 3 21M12 8 4 14M16 12l-5 8"/>',
    dart: '<path d="M3 21 15 9"/><path class="a" d="M15 9l2-6 4 4-6 2z"/><path d="M15 9l2-6 4 4-6 2zM5 16l3 3M3 18l3 3"/>',
    daggers: '<path d="M5 19 14 6M10 20l9-13"/><path class="a" d="M14 6l1-3 1 4zM19 7l1-3 1 4z"/><path d="M3 15l4 2M8 16l4 2"/>',
    dagger: '<path class="a" d="M17 3l4 0 0 4-10 10-4-4z"/><path d="M17 3l4 0 0 4-10 10-4-4zM6 12l6 6M7 17l-4 4"/>',
    jelly: '<path class="a" d="M4 12a8 8 0 0 1 16 0z"/><path d="M4 12a8 8 0 0 1 16 0zM6 12c0 3-1 4 0 8M10 12c0 3 1 5 0 9M14 12c0 3-1 5 0 9M18 12c0 3 1 4 0 8"/>',
    cloak: '<path class="a" d="M12 3c3 0 5 2 5 5l3 13H4L7 8c0-3 2-5 5-5z"/><path d="M12 3c3 0 5 2 5 5l3 13H4L7 8c0-3 2-5 5-5zM9 8c1 1 5 1 6 0"/>',
    flip: '<path d="M4 12a8 8 0 0 1 14-5"/><path d="M18 3v4h-4"/><path d="M20 12a8 8 0 0 1-14 5"/><path d="M6 21v-4h4"/>',
    cards: '<rect class="a" x="8" y="4" width="11" height="15" rx="2" transform="rotate(10 13 12)"/><rect x="8" y="4" width="11" height="15" rx="2" transform="rotate(10 13 12)"/><rect x="4" y="5" width="11" height="15" rx="2" transform="rotate(-8 10 12)"/>',
    skulldagger: '<path class="a" d="M6 10a6 6 0 0 1 12 0c0 3-2 4-2 6h-8c0-2-2-3-2-6z"/><path d="M6 10a6 6 0 0 1 12 0c0 3-2 4-2 6h-8c0-2-2-3-2-6zM9 16v4h6v-4"/><circle class="f" cx="9.5" cy="10" r="1.5"/><circle class="f" cx="14.5" cy="10" r="1.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle class="a" cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="5"/><circle class="f" cx="12" cy="12" r="1.5"/>',
    fumes: '<path class="a" d="M5 17a4 4 0 0 1 1-8 6 6 0 0 1 11 1 3.5 3.5 0 0 1 1 7z"/><path d="M5 17a4 4 0 0 1 1-8 6 6 0 0 1 11 1 3.5 3.5 0 0 1 1 7z"/><circle class="f" cx="9" cy="13" r="1"/><circle class="f" cx="14" cy="12" r="1.3"/><path d="M8 20h2M13 21h3"/>',
    flask: '<path class="a" d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/><path d="M9 3h6M10 3v6l-5 10a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3M7 15h10"/>',
    boot: '<path class="a" d="M7 3h6v9l6 3c1 1 1 2 1 3v2H4V3z"/><path d="M7 3h6v9l6 3c1 1 1 2 1 3v2H4V3h3M4 17h16"/>',
    rope: '<path d="M3 17c3-6 6 0 9-6s6 0 9-6"/><path class="a" d="M2 20h20v1H2z"/><circle cx="3" cy="17" r="1.5"/>',
    claws: '<path d="M5 3c2 6 2 12 0 18M11 3c2 6 2 12 0 18M17 3c2 6 2 12 0 18"/><path class="a" d="M4 4l2 2M10 4l2 2M16 4l2 2"/>',
    shark: '<path class="a" d="M2 15c5-2 9-6 11-12 2 5 4 8 9 12-6 3-14 3-20 0z"/><path d="M2 15c5-2 9-6 11-12 2 5 4 8 9 12-6 3-14 3-20 0z"/><path d="M2 20c3-1 5 1 7 0s4-1 6 0 4 1 7 0"/>',
    energy: '<circle class="a" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M13 5 8 13h4l-1 6 5-8h-4z"/>',
    ghost: '<path class="a" d="M5 21V11a7 7 0 0 1 14 0v10l-2.5-2-2.5 2-2-2-2 2-2.5-2z"/><path d="M5 21V11a7 7 0 0 1 14 0v10l-2.5-2-2.5 2-2-2-2 2-2.5-2z"/><circle class="f" cx="9.5" cy="11" r="1.3"/><circle class="f" cx="14.5" cy="11" r="1.3"/>',
    glass: '<path class="a" d="M14 3l7 0-11 11-3-3z"/><path d="M14 3l7 0-11 11-3-3zM7 11l-4 4 3 3 4-4M3 21l2-2"/><path d="M15 5l2 2"/>',
    whirl: '<path d="M12 12a2 2 0 1 1 2 2 4 4 0 1 1-4-4 6 6 0 1 1 6 6 8 8 0 1 1-8-8"/>',
    star: '<path class="a" d="M12 2l3 7 7 .5-5.5 4.5 2 7.5L12 17l-6.5 4.5 2-7.5L2 9.5 9 9z"/><path d="M12 2l3 7 7 .5-5.5 4.5 2 7.5L12 17l-6.5 4.5 2-7.5L2 9.5 9 9z"/>',
    coin: '<circle class="a" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M12 9v6"/>',
    wound: '<path class="a" d="M4 20 20 4"/><path d="M4 20 20 4M8 12l4 4M12 8l4 4M6 9l1 1M15 18l1-1"/>',
    daze: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2"/><circle class="a" cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="3"/>',
    slime: '<path class="a" d="M3 19c0-5 4-11 9-11s9 6 9 11z"/><path d="M3 19c0-5 4-11 9-11s9 6 9 11zM6 19v2M11 19v3M16 19v2"/><circle class="f" cx="9.5" cy="14" r="1.2"/><circle class="f" cx="14.5" cy="14" r="1.2"/>',
    skull: '<path class="a" d="M5 11a7 7 0 0 1 14 0c0 3-2 4-2 6H7c0-2-2-3-2-6z"/><path d="M5 11a7 7 0 0 1 14 0c0 3-2 4-2 6H7c0-2-2-3-2-6zM9 17v4h6v-4M12 17v4"/><circle class="f" cx="9" cy="11" r="1.7"/><circle class="f" cx="15" cy="11" r="1.7"/>',
    // relic-only
    charm: '<path d="M12 2v5"/><path class="a" d="M7 12c0-3 2-5 5-5s5 2 5 5-2 9-5 9-5-6-5-9z"/><path d="M7 12c0-3 2-5 5-5s5 2 5 5-2 9-5 9-5-6-5-9zM9.5 11c1 2 4 2 5 0M10 15c1 1 3 1 4 0"/>',
    locket: '<path d="M8 3c0 3 8 3 8 0"/><circle class="a" cx="12" cy="14" r="6"/><circle cx="12" cy="14" r="6"/><path d="M12 17c-1.5 0-2.5-1-2.5-2.5 0-1.5 1.5-2 1.5-3.5 1.5.8 3 2 3 3.5 0 1.5-.8 2.5-2 2.5z"/>',
    lantern: '<path d="M9 4h6M12 2v2"/><path class="a" d="M7 7h10l-1 12H8z"/><path d="M7 7h10l-1 12H8zM6 21h12"/><path d="M12 15c-1 0-1.6-.8-1.6-1.6 0-1 1-1.4 1-2.4 1 .6 2.2 1.4 2.2 2.4 0 .9-.6 1.6-1.6 1.6z"/>',
    pebbles: '<ellipse class="a" cx="8" cy="15" rx="5" ry="4"/><ellipse class="a" cx="16" cy="11" rx="4" ry="3.5"/><ellipse cx="8" cy="15" rx="5" ry="4"/><ellipse cx="16" cy="11" rx="4" ry="3.5"/><ellipse cx="16" cy="18" rx="2.5" ry="2"/>',
    tooth: '<path class="a" d="M5 4h14l-7 18z"/><path d="M5 4h14l-7 18zM9 4l3 8 3-8"/>',
    urchin: '<circle class="a" cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5"/>',
    vial: '<path d="M10 3h4M10 3v5l-3 4v7a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3v-7l-3-4V3"/><path class="a" d="M7 14h10v5a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z"/>',
    whetstone: '<path class="a" d="M3 15 15 5l6 4-12 10z"/><path d="M3 15 15 5l6 4-12 10zM3 15l6 4"/><path d="M14 13l3 3M17 11l2 2"/>',
    sun: '<circle class="a" cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    plate: '<path class="a" d="M4 6h16v8c0 4-4 6-8 7-4-1-8-3-8-7z"/><path d="M4 6h16v8c0 4-4 6-8 7-4-1-8-3-8-7z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><circle cx="12" cy="16" r="1.5"/>',
    fig: '<path class="a" d="M12 6c4 0 7 4 7 8s-3 7-7 7-7-3-7-7 3-8 7-8z"/><path d="M12 6c4 0 7 4 7 8s-3 7-7 7-7-3-7-7 3-8 7-8zM12 6V3M12 4c2-2 4-1 5 0"/>',
    belt: '<path class="a" d="M2 9h20v6H2z"/><path d="M2 9h20v6H2z"/><path d="M6 9v-3h3v3M11 9v-4h3v4M16 9v-3h3v3"/>',
    pillow: '<path class="a" d="M3 8c3-2 15-2 18 0 1 3 1 6 0 8-3 2-15 2-18 0-1-2-1-5 0-8z"/><path d="M3 8c3-2 15-2 18 0 1 3 1 6 0 8-3 2-15 2-18 0-1-2-1-5 0-8z"/><path d="M8 12h8"/>',
    chain: '<rect x="2" y="9" width="9" height="6" rx="3"/><rect class="a" x="8" y="9" width="8" height="6" rx="3"/><rect x="13" y="9" width="9" height="6" rx="3"/>',
    needle: '<path d="M4 20 18 6"/><path class="a" d="M17 7a2.5 2.5 0 1 1 3-3 2.5 2.5 0 0 1-3 3z"/><path d="M17 7a2.5 2.5 0 1 1 3-3"/><path d="M6 12c3 0 4 2 4 4s1 4 4 4"/>',
    cork: '<path class="a" d="M8 4h8l2 16H6z"/><path d="M8 4h8l2 16H6zM7 10h10M7 14h10"/>',
    shell: '<path class="a" d="M12 21 3 9c2-4 5-6 9-6s7 2 9 6z"/><path d="M12 21 3 9c2-4 5-6 9-6s7 2 9 6zM12 21 7 5M12 21 17 5M12 21V3"/>',
    idol: '<circle class="a" cx="12" cy="7" r="4"/><circle cx="12" cy="7" r="4"/><path class="a" d="M7 21l1-8h8l1 8z"/><path d="M7 21l1-8h8l1 8zM10 7h.01M14 7h.01"/>',
    eel: '<path class="a" d="M3 15c3-5 6 1 9-4s6-3 9 0c-3 4-6 1-9 5s-6 3-9-1z"/><path d="M3 15c3-5 6 1 9-4s6-3 9 0c-3 4-6 1-9 5s-6 3-9-1z"/><circle class="f" cx="18" cy="11" r="1"/>',
    ink: '<path class="a" d="M7 10h10l2 11H5z"/><path d="M7 10h10l2 11H5zM9 10V6h6v4"/><path d="M14 2l-2 4"/>',
    brazier: '<path class="a" d="M4 12h16l-3 6H7z"/><path d="M4 12h16l-3 6H7zM8 18l-2 4M16 18l2 4"/><path d="M12 11c-2 0-3-1.5-3-3 0-2 2-3 2-5 2 1 4 3 4 5 0 1.5-1 3-3 3z"/>',
    book: '<path class="a" d="M4 4h7c1 0 1 1 1 2v15c0-1-1-2-2-2H4zM20 4h-7c-1 0-1 1-1 2v15c0-1 1-2 2-2h6z"/><path d="M4 4h7c1 0 1 1 1 2v15c0-1-1-2-2-2H4zM20 4h-7c-1 0-1 1-1 2v15c0-1 1-2 2-2h6z"/>',
    spine: '<path class="a" d="M12 2 15 20 12 22 9 20z"/><path d="M12 2 15 20 12 22 9 20zM12 6v12"/>',
    chime: '<path d="M4 4h16"/><path d="M7 4v6M12 4v9M17 4v7"/><path class="a" d="M5.5 10h3v6h-3zM10.5 13h3v6h-3zM15.5 11h3v6h-3z"/>',
    pouch: '<path class="a" d="M6 9c-2 3-2 8 0 11h12c2-3 2-8 0-11z"/><path d="M6 9c-2 3-2 8 0 11h12c2-3 2-8 0-11zM6 9l3-2h6l3 2M10 3l-1 4M14 3l1 4"/>',
    spyglass: '<path class="a" d="M3 16 15 4l5 5L8 21z"/><path d="M3 16 15 4l5 5L8 21zM9 10l5 5M13 6l5 5"/>',
    branch: '<path d="M5 21C8 15 10 9 18 4M9 14c-2-1-4-1-5 0M12 10c1-2 3-3 5-3"/><path class="a" d="M18 4c1 1 2 1 3 0-1 2-1 3 0 4-2-1-3 0-3 0z"/>',
    jar: '<path class="a" d="M7 6h10v2c2 1 3 3 3 6v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4c0-3 1-5 3-6z"/><path d="M7 6h10v2c2 1 3 3 3 6v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4c0-3 1-5 3-6zM6 3h12v3H6z"/><path d="M14 11a3 3 0 1 0 0 5 3.5 3.5 0 0 1 0-5z"/>',
    top: '<path class="a" d="M12 21 4 12l8-4 8 4z"/><path d="M12 21 4 12l8-4 8 4zM12 8V3M10 3h4"/>',
    seal: '<circle class="a" cx="12" cy="10" r="6"/><circle cx="12" cy="10" r="6"/><path d="M9 15l-2 7 5-3 5 3-2-7"/><path d="M10 10l1.5 1.5L14.5 8.5"/>',
    mask: '<path class="a" d="M3 6c6-2 12-2 18 0 0 8-4 14-9 14S3 14 3 6z"/><path d="M3 6c6-2 12-2 18 0 0 8-4 14-9 14S3 14 3 6z"/><path d="M7 10c1-1 2-1 3 0M14 10c1-1 2-1 3 0M8 14c2 2 6 2 8 0"/>',
    blind: '<path class="a" d="M2 9h20v5H2z"/><path d="M2 9h20v5H2zM6 14c-1 3-1 5 0 7M18 14c1 3 1 5 0 7"/>',
    pearl: '<circle class="a" cx="12" cy="13" r="6"/><circle cx="12" cy="13" r="6"/><circle class="f" cx="10" cy="11" r="1.5"/><path d="M3 9c2-4 6-6 9-6s7 2 9 6"/>',
    shrine: '<path class="a" d="M5 21V10l7-6 7 6v11z"/><path d="M5 21V10l7-6 7 6v11zM3 21h18"/><path d="M12 17c-1.5 0-2.5-1-2.5-2.5 0-1.5 1.5-2 1.5-3.5 1.5.8 3 2 3 3.5 0 1.5-.8 2.5-2 2.5z"/>',
    whale: '<path class="a" d="M2 13c2-5 8-6 13-5 3 1 5 3 6 5 0 3-3 6-9 6-6 0-9-2-10-6z"/><path d="M2 13c2-5 8-6 13-5 3 1 5 3 6 5 0 3-3 6-9 6-6 0-9-2-10-6zM21 13l2-4M21 13l2 2"/><circle class="f" cx="7" cy="12" r="1"/><path d="M10 6c0-2 1-3 2-3"/>',
    mermaid: '<circle class="a" cx="12" cy="5" r="3"/><circle cx="12" cy="5" r="3"/><path class="a" d="M9 10h6c0 5-1 8-3 11-2-3-3-6-3-11z"/><path d="M9 10h6c0 5-1 8-3 11-2-3-3-6-3-11zM9 21h6"/>',
    camp: '<path d="M3 21h18M5 21l7-12 7 12M12 9V4"/><path class="a" d="M12 21c-2 0-3-1.5-3-3 0-2 2-2.5 2-4.5 2 1 4 2.5 4 4.5 0 1.5-1 3-3 3z"/>',
    well: '<path class="a" d="M5 13h14v8H5z"/><path d="M5 13h14v8H5zM4 13h16M6 13V6M18 13V6M4 6h16l-8-4z"/><path d="M12 6v4"/>',
    crab: '<path class="a" d="M6 14c0-3 3-5 6-5s6 2 6 5-3 5-6 5-6-2-6-5z"/><path d="M6 14c0-3 3-5 6-5s6 2 6 5-3 5-6 5-6-2-6-5zM6 13 3 9l1-4 3 3M18 13l3-4-1-4-3 3M7 18l-3 3M17 18l3 3"/><circle class="f" cx="10" cy="12" r="1"/><circle class="f" cx="14" cy="12" r="1"/>',
    fog: '<path d="M3 8h14M6 12h15M3 16h12M8 20h10"/><path class="a" d="M17 4c2 0 3 1 3 2.5"/>',
    pirate: '<path class="a" d="M4 9c3-3 13-3 16 0l-2 2H6z"/><path d="M4 9c3-3 13-3 16 0l-2 2H6zM7 11c0 5 2 9 5 9s5-4 5-9"/><path d="M9 14h2M14 13l2 2M10 17c1 1 3 1 4 0"/>',
    pool: '<ellipse class="a" cx="12" cy="15" rx="9" ry="5"/><ellipse cx="12" cy="15" rx="9" ry="5"/><path d="M8 15c1-1 2-1 3 0M13 13c1-1 2-1 3 0"/><path d="M15 6l1 3M18 7l-1 2"/>',
    lighthouse: '<path class="a" d="M9 8h6l2 13H7z"/><path d="M9 8h6l2 13H7zM9 8l1-4h4l1 4M8 13h8M7.5 17h9"/><path d="M15 5l6-2M15 6h6"/>',
    // intents & statuses
    atk: '<path class="a" d="M19.5 4.5 9 15l-1.5-1.5L18 3z"/><path d="M19.5 4.5 9 15"/><path d="M15 4h5v5"/><path d="M6.5 12.5l5 5M8 17l-3.5 3.5"/>',
    block: '<path class="a" d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
    buff: '<path class="a" d="M12 3 20 12h-5v9H9v-9H4z"/><path d="M12 3 20 12h-5v9H9v-9H4z"/>',
    debuff: '<path class="a" d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><path d="M9 14l6 0"/>',
    summon: '<circle class="a" cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="8"/><path d="M12 7v10M7 12h10"/>',
    split: '<path class="a" d="M3 18c0-4 2-7 5-7s5 3 5 7zM11 18c0-4 2-7 5-7s5 3 5 7z"/><path d="M3 18c0-4 2-7 5-7s5 3 5 7zM11 18c0-4 2-7 5-7s5 3 5 7zM12 3v5M10 6l2 2 2-2"/>',
    escape: '<path d="M12 3a9 9 0 1 0 0 18"/><path class="a" d="M14 7l5 5-5 5z"/><path d="M8 12h11"/>',
    unknown: '<circle class="a" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7v.5"/><circle class="f" cx="12" cy="17" r="1"/>',
    str: '<path class="a" d="M12 2l3 4v9h-6V6z"/><path d="M12 2l3 4v9h-6V6zM7 15h10M12 15v5M10 21h4"/>',
    dex: '<path class="a" d="M7 3h6v9l6 3c1 1 1 2 1 3v2H4V3z"/><path d="M7 3h6v9l6 3c1 1 1 2 1 3v2H4V3h3"/><path d="M14 6h6M15 9h5"/>',
    vuln: '<path class="a" d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM12 6l-2 5 4 1-2 5"/>',
    weak: '<path class="a" d="M19.5 4.5 9 15l-1.5-1.5L18 3z"/><path d="M19.5 4.5 9 15M6.5 12.5l5 5M8 17l-3.5 3.5"/><path d="M14 14l6 6M20 14l-6 6"/>',
    frail: '<path class="a" d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M8 9l3 3-2 3 3 3M15 8l-2 4 3 2"/>',
    poison: '<path class="a" d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><path d="M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z"/><circle class="f" cx="10" cy="14" r="1.2"/><circle class="f" cx="14" cy="16" r="1"/>',
    burn: '<path class="a" d="M12 22c-4 0-7-3-7-7 0-5 5-7 5-12 3 2 5 5 5 8 1-1 2-2 2-4 2 2 3 5 3 8 0 4-4 7-8 7z"/><path d="M12 22c-4 0-7-3-7-7 0-5 5-7 5-12 3 2 5 5 5 8 1-1 2-2 2-4 2 2 3 5 3 8 0 4-4 7-8 7z"/>',
    thorns: '<path class="a" d="M12 5l2 4 4-2-1 4 4 1-4 2 2 4-4-1-1 4-2-3-2 3-1-4-4 1 2-4-4-2 4-1-1-4 4 2z"/><path d="M12 5l2 4 4-2-1 4 4 1-4 2 2 4-4-1-1 4-2-3-2 3-1-4-4 1 2-4-4-2 4-1-1-4 4 2z"/>',
    plating: '<path class="a" d="M4 6h16v8c0 4-4 6-8 7-4-1-8-3-8-7z"/><path d="M4 6h16v8c0 4-4 6-8 7-4-1-8-3-8-7zM4 11h16"/>',
    rage: '<path class="a" d="M12 2l2 6 6-1-4 5 4 5-6-1-2 6-2-6-6 1 4-5-4-5 6 1z"/><path d="M12 2l2 6 6-1-4 5 4 5-6-1-2 6-2-6-6 1 4-5-4-5 6 1z"/>',
    regen: '<path class="a" d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/><path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11zM12 9v6M9 12h6"/>',
    artifact: '<path class="a" d="M12 2l8 5v10l-8 5-8-5V7z"/><path d="M12 2l8 5v10l-8 5-8-5V7zM12 7l4 2.5v5L12 17l-4-2.5v-5z"/>',
    strdown: '<path class="a" d="M10 2l3 4v9H7V6z"/><path d="M10 2l3 4v9H7V6zM5 15h10M10 15v5M8 21h4M19 4v7M17 9l2 2 2-2"/>',
    spore: '<path class="a" d="M4 12a8 7 0 0 1 16 0z"/><path d="M4 12a8 7 0 0 1 16 0zM10 12v8h4v-8"/><circle class="f" cx="9" cy="8" r="1"/><circle class="f" cx="14" cy="7" r="1.2"/>',
    minion: '<circle class="a" cx="12" cy="9" r="4"/><circle cx="12" cy="9" r="4"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>',
    draw: '<rect class="a" x="6" y="3" width="12" height="17" rx="2"/><rect x="6" y="3" width="12" height="17" rx="2"/><path d="M12 8v7M9 12l3 3 3-3"/>',
    nodraw: '<rect x="6" y="3" width="12" height="17" rx="2"/><path d="M4 4l16 16"/>',
    // map
    fight: '<path d="M4 4l11 11M20 4 9 15"/><path class="a" d="M4 4h3l10 10-2 2L5 6zM20 4h-3L7 14l2 2L19 6z"/><path d="M6 15l3 3M18 15l-3 3M5 19l2-2M19 19l-2-2"/>',
    elite: '<path class="a" d="M5 11a7 7 0 0 1 14 0c0 3-2 4-2 6H7c0-2-2-3-2-6z"/><path d="M5 11a7 7 0 0 1 14 0c0 3-2 4-2 6H7c0-2-2-3-2-6zM9 17v4h6v-4M5 8 2 3l5 3M19 8l3-5-5 3"/><circle class="f" cx="9" cy="11" r="1.7"/><circle class="f" cx="15" cy="11" r="1.7"/>',
    rest: '<path d="M4 21l16-4M4 17l16 4"/><path class="a" d="M12 17c-3 0-5-2-5-5 0-3 3-4 3-7 2 1 3 3 3 5 1-1 2-2 2-3 2 2 2 4 2 5 0 3-2 5-5 5z"/><path d="M12 17c-3 0-5-2-5-5 0-3 3-4 3-7 2 1 3 3 3 5 1-1 2-2 2-3 2 2 2 4 2 5 0 3-2 5-5 5z"/>',
    shop: '<path class="a" d="M6 8c-2 3-2 9 0 12h12c2-3 2-9 0-12z"/><path d="M6 8c-2 3-2 9 0 12h12c2-3 2-9 0-12zM6 8l3-3h6l3 3M12 11v6M10 12.5c0-1 4-1 4 .5s-4 1-4 2.5 4 1.5 4 .5"/>',
    event: '<circle class="a" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7v.5"/><circle class="f" cx="12" cy="17" r="1"/>',
    treasure: '<path class="a" d="M3 10h18v10H3z"/><path d="M3 10h18v10H3zM3 10c0-3 2-5 5-5h8c3 0 5 2 5 5M3 14h18"/><path d="M11 12h2v4h-2z"/>',
    boss: '<path class="a" d="M4 12a8 8 0 0 1 16 0c0 3-2 5-3 7H7c-1-2-3-4-3-7z"/><path d="M4 12a8 8 0 0 1 16 0c0 3-2 5-3 7H7c-1-2-3-4-3-7zM4 9 2 2l6 4M20 9l2-7-6 4M8 19v2h8v-2"/><path class="f" d="M7 11l3 2-3 1zM17 11l-3 2 3 1z"/>',
    deck: '<rect class="a" x="7" y="3" width="12" height="16" rx="2"/><rect x="7" y="3" width="12" height="16" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h9"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    map: '<path class="a" d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
    gold: '<circle class="a" cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10c0-1.5 5-1.5 5 0s-5 1.5-5 3 5 1.5 5 0"/>',
    hp: '<path class="a" d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/><path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/>',
    potion: '<path class="a" d="M10 8V3h4v5c3 1 5 4 5 7a7 7 0 0 1-14 0c0-3 2-6 5-7z"/><path d="M10 8V3h4v5c3 1 5 4 5 7a7 7 0 0 1-14 0c0-3 2-6 5-7zM9 3h6"/>',
    lock: '<rect class="a" x="5" y="11" width="14" height="10" rx="2"/><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="M12 4v16M5 11l7-7 7 7"/>',
  };
  A.ICONS = I;
  A.icon = function (k, cls) { return '<svg viewBox="0 0 24 24" class="ic ' + (cls || '') + '" aria-hidden="true">' + (I[k] || I.unknown) + '</svg>'; };
  A.has = (k) => !!I[k];

  // ---------------- canvas sprites ----------------
  const TAU = Math.PI * 2;
  function shade(hex, f) { // f -1..1
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  A.shade = shade;
  const OUT = '#120c16';
  function body(g, path, col, x0, y0, x1, y1, lw) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.45));
    g.fillStyle = gr; path(); g.fill();
    g.lineWidth = lw || 3; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round'; path(); g.stroke();
  }
  function eye(g, x, y, r, glow, pupil) {
    if (glow) { g.save(); g.shadowColor = glow; g.shadowBlur = r * 3; g.fillStyle = glow; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore(); return; }
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y, r, r * 1.15, 0, 0, TAU); g.fill();
    g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = pupil || '#1a1020'; g.beginPath(); g.arc(x + r * 0.15, y + r * 0.2, r * 0.55, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * 0.1, y - r * 0.15, r * 0.2, 0, TAU); g.fill();
  }
  function shadow(g, x, y, w) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, w, w * 0.22, 0, 0, TAU); g.fill(); }
  function glowCircle(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col.replace('A', String(a))); gr.addColorStop(1, col.replace('A', '0'));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // Every sprite draws in a 100x100 box, feet near y=92.
  const SP = {};
  SP.slime = (g, c) => {
    shadow(g, 50, 92, 36);
    body(g, () => { g.beginPath(); g.moveTo(14, 90); g.bezierCurveTo(8, 60, 28, 30, 50, 30); g.bezierCurveTo(72, 30, 92, 60, 86, 90); g.closePath(); }, c, 20, 30, 80, 92);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(36, 46, 9, 5, -0.6, 0, TAU); g.fill();
    eye(g, 40, 62, 7); eye(g, 60, 62, 7);
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.arc(50, 74, 6, 0.2, Math.PI - 0.2); g.stroke();
  };
  SP.crab = (g, c) => {
    shadow(g, 50, 92, 38);
    g.strokeStyle = OUT; g.lineWidth = 4;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(50 + s * 20, 76 + i * 3); g.lineTo(50 + s * (34 + i * 4), 84 + i * 2); g.lineTo(50 + s * (38 + i * 4), 92); g.stroke(); }
    for (const s of [-1, 1]) {
      body(g, () => { g.beginPath(); g.moveTo(50 + s * 18, 66); g.quadraticCurveTo(50 + s * 34, 50, 50 + s * 34, 36); g.lineTo(50 + s * 30, 36); g.stroke(); }, c, 0, 30, 0, 70, 6);
      body(g, () => { g.beginPath(); g.moveTo(50 + s * 34, 40); g.quadraticCurveTo(50 + s * 48, 22, 50 + s * 38, 12); g.lineTo(50 + s * 32, 26); g.lineTo(50 + s * 24, 18); g.quadraticCurveTo(50 + s * 22, 34, 50 + s * 34, 40); g.closePath(); }, c, 0, 10, 0, 42);
    }
    body(g, () => { g.beginPath(); g.ellipse(50, 70, 26, 16, 0, 0, TAU); }, c, 30, 54, 70, 88);
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(43, 56); g.lineTo(41, 46); g.moveTo(57, 56); g.lineTo(59, 46); g.stroke();
    eye(g, 41, 44, 5); eye(g, 59, 44, 5);
  };
  SP.pirate = (g, c) => {
    shadow(g, 50, 92, 26);
    body(g, () => { g.beginPath(); g.moveTo(32, 92); g.lineTo(36, 56); g.quadraticCurveTo(50, 48, 64, 56); g.lineTo(68, 92); g.closePath(); }, c, 32, 50, 70, 92);
    g.fillStyle = '#2a1d24'; g.fillRect(36, 70, 28, 5);
    body(g, () => { g.beginPath(); g.arc(50, 40, 13, 0, TAU); }, '#e8b48a', 40, 28, 60, 54);
    body(g, () => { g.beginPath(); g.moveTo(30, 34); g.quadraticCurveTo(50, 12, 70, 34); g.quadraticCurveTo(50, 28, 30, 34); g.closePath(); }, '#2b2233', 30, 12, 70, 34);
    g.fillStyle = '#e8d07a'; g.beginPath(); g.arc(50, 25, 2.5, 0, TAU); g.fill();
    g.fillStyle = OUT; g.fillRect(41, 38, 8, 4); eye(g, 56, 40, 3.5);
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(44, 48); g.lineTo(56, 47); g.stroke();
    // cutlass
    g.strokeStyle = '#d9e2ef'; g.lineWidth = 4; g.beginPath(); g.moveTo(70, 66); g.quadraticCurveTo(86, 46, 82, 26); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#d8a23a'; g.fillRect(64, 64, 10, 5);
  };
  SP.drowned = (g, c) => {
    shadow(g, 50, 92, 26);
    body(g, () => { g.beginPath(); g.moveTo(30, 92); g.quadraticCurveTo(28, 58, 40, 48); g.quadraticCurveTo(54, 42, 64, 50); g.quadraticCurveTo(74, 62, 70, 92); g.closePath(); }, c, 30, 44, 70, 92);
    body(g, () => { g.beginPath(); g.ellipse(52, 36, 14, 15, 0.15, 0, TAU); }, shade(c, 0.2), 38, 22, 66, 52);
    g.strokeStyle = '#3d7a4a'; g.lineWidth = 3;
    for (const x of [40, 47, 56, 63]) { g.beginPath(); g.moveTo(x, 24); g.quadraticCurveTo(x - 4, 40, x + 2, 54); g.stroke(); }
    eye(g, 46, 36, 3.6, '#c6fff5'); eye(g, 58, 36, 3.6, '#c6fff5');
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(28, 64); g.quadraticCurveTo(18, 70, 20, 80); g.moveTo(72, 64); g.quadraticCurveTo(84, 70, 80, 82); g.stroke();
  };
  SP.jelly = (g, c) => {
    glowCircle(g, 50, 46, 44, 'rgba(197,156,255,A)', 0.35);
    g.strokeStyle = shade(c, 0.3); g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const x = 28 + i * 9; g.beginPath(); g.moveTo(x, 50); g.bezierCurveTo(x - 6, 64, x + 6, 74, x - 2, 90); g.stroke(); }
    g.globalAlpha = 0.85;
    body(g, () => { g.beginPath(); g.moveTo(20, 52); g.bezierCurveTo(18, 18, 82, 18, 80, 52); g.quadraticCurveTo(50, 60, 20, 52); g.closePath(); }, c, 30, 18, 70, 56);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(38, 32, 8, 4, -0.5, 0, TAU); g.fill();
    eye(g, 42, 42, 4, '#fff6ff'); eye(g, 58, 42, 4, '#fff6ff');
  };
  SP.gull = (g, c) => {
    shadow(g, 50, 92, 22);
    body(g, () => { g.beginPath(); g.moveTo(8, 40); g.quadraticCurveTo(30, 34, 46, 56); g.quadraticCurveTo(30, 52, 8, 40); g.closePath(); }, '#c9d1dd', 8, 34, 46, 56);
    body(g, () => { g.beginPath(); g.moveTo(92, 40); g.quadraticCurveTo(70, 34, 54, 56); g.quadraticCurveTo(70, 52, 92, 40); g.closePath(); }, '#c9d1dd', 54, 34, 92, 56);
    body(g, () => { g.beginPath(); g.ellipse(50, 62, 16, 12, 0, 0, TAU); }, c, 34, 50, 66, 74);
    body(g, () => { g.beginPath(); g.arc(50, 46, 10, 0, TAU); }, c, 40, 36, 60, 56);
    g.fillStyle = '#ffb347'; g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(47, 49); g.lineTo(50, 58); g.lineTo(53, 49); g.closePath(); g.fill(); g.stroke();
    eye(g, 45, 44, 2.5, null); eye(g, 55, 44, 2.5, null);
    g.strokeStyle = '#ffb347'; g.lineWidth = 3; g.beginPath(); g.moveTo(46, 74); g.lineTo(44, 90); g.moveTo(54, 74); g.lineTo(56, 90); g.stroke();
  };
  SP.brute = (g, c) => {
    shadow(g, 50, 93, 40);
    body(g, () => { g.beginPath(); g.moveTo(18, 92); g.quadraticCurveTo(10, 48, 30, 32); g.quadraticCurveTo(50, 20, 70, 32); g.quadraticCurveTo(90, 48, 82, 92); g.closePath(); }, c, 18, 22, 82, 92);
    g.fillStyle = shade(c, -0.25);
    for (const [x, y] of [[30, 50], [62, 44], [44, 70], [70, 72], [26, 76]]) { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
    body(g, () => { g.beginPath(); g.ellipse(50, 34, 16, 12, 0, 0, TAU); }, shade(c, 0.15), 34, 22, 66, 46);
    eye(g, 43, 32, 3.5, '#ffe36b'); eye(g, 57, 32, 3.5, '#ffe36b');
    g.fillStyle = '#f2ead0'; g.strokeStyle = OUT; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(50 + s * 6, 40); g.lineTo(50 + s * 8, 32); g.lineTo(50 + s * 10, 40); g.fill(); g.stroke(); }
    body(g, () => { g.beginPath(); g.ellipse(14, 70, 10, 14, 0.3, 0, TAU); }, c, 4, 56, 24, 84);
    body(g, () => { g.beginPath(); g.ellipse(86, 70, 10, 14, -0.3, 0, TAU); }, c, 76, 56, 96, 84);
  };
  SP.totem = (g, c) => {
    shadow(g, 50, 93, 22);
    for (let i = 0; i < 3; i++) {
      const y = 70 - i * 24;
      body(g, () => { g.beginPath(); g.rect(30 + i * 2, y, 40 - i * 4, 22); }, shade(c, -i * 0.1), 30, y, 70, y + 22);
    }
    eye(g, 43, 34, 4, '#9ff4ff'); eye(g, 57, 34, 4, '#9ff4ff');
    g.strokeStyle = '#9ff4ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 58); g.lineTo(50, 52); g.lineTo(60, 58); g.lineTo(50, 64); g.closePath(); g.stroke();
    glowCircle(g, 50, 16, 14, 'rgba(159,244,255,A)', 0.6);
    g.fillStyle = '#dffcff'; g.beginPath(); g.moveTo(50, 6); g.lineTo(56, 16); g.lineTo(50, 24); g.lineTo(44, 16); g.closePath(); g.fill();
  };
  SP.captain = (g, c) => {
    shadow(g, 50, 93, 34);
    body(g, () => { g.beginPath(); g.moveTo(24, 92); g.lineTo(28, 50); g.quadraticCurveTo(50, 40, 72, 50); g.lineTo(76, 92); g.closePath(); }, c, 24, 40, 76, 92);
    g.strokeStyle = '#e8c35a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(50, 50); g.lineTo(50, 90); g.stroke();
    for (const y of [58, 68, 78]) { g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(46, y, 1.8, 0, TAU); g.arc(54, y, 1.8, 0, TAU); g.fill(); }
    body(g, () => { g.beginPath(); g.ellipse(50, 36, 14, 15, 0, 0, TAU); }, '#8fb7b0', 36, 22, 64, 52);
    g.strokeStyle = '#5c8a72'; g.lineWidth = 3; g.beginPath(); g.moveTo(38, 44); g.quadraticCurveTo(50, 58, 62, 44); g.stroke();
    body(g, () => { g.beginPath(); g.moveTo(22, 28); g.quadraticCurveTo(50, 2, 78, 28); g.lineTo(70, 30); g.quadraticCurveTo(50, 22, 30, 30); g.closePath(); }, '#2a2236', 22, 4, 78, 30);
    g.fillStyle = '#efe6d0'; g.beginPath(); g.arc(50, 18, 4, 0, TAU); g.fill();
    eye(g, 44, 36, 3.5, '#9ff4ff'); eye(g, 56, 36, 3.5, '#9ff4ff');
    // anchor
    g.strokeStyle = '#9aa5b5'; g.lineWidth = 5; g.beginPath(); g.moveTo(86, 30); g.lineTo(86, 84); g.moveTo(78, 38); g.lineTo(94, 38); g.moveTo(74, 76); g.quadraticCurveTo(86, 92, 98, 76); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#9aa5b5'; g.beginPath(); g.arc(86, 26, 4, 0, TAU); g.fill();
  };
  SP.kelp = (g, c) => {
    shadow(g, 50, 93, 34);
    for (let i = 0; i < 7; i++) {
      const x = 22 + i * 9.5, h = 54 + (i % 3) * 12;
      body(g, () => { g.beginPath(); g.moveTo(x - 5, 92); g.bezierCurveTo(x - 12, 92 - h * 0.4, x + 10, 92 - h * 0.7, x, 92 - h); g.bezierCurveTo(x + 14, 92 - h * 0.6, x + 2, 92 - h * 0.3, x + 6, 92); g.closePath(); }, shade(c, (i % 2) * 0.12), x - 8, 92 - h, x + 8, 92, 2.5);
    }
    eye(g, 40, 50, 5, '#ffef7a'); eye(g, 58, 46, 6, '#ffef7a'); eye(g, 50, 64, 3.5, '#ffef7a');
  };
  SP.lantern = (g, c) => {
    shadow(g, 50, 93, 18);
    glowCircle(g, 50, 40, 44, 'rgba(199,240,122,A)', 0.4);
    g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(50, 92); g.quadraticCurveTo(44, 70, 50, 50); g.stroke();
    g.strokeStyle = '#d8d0b0'; g.lineWidth = 4; g.stroke();
    body(g, () => { g.beginPath(); g.moveTo(18, 48); g.bezierCurveTo(18, 14, 82, 14, 82, 48); g.quadraticCurveTo(50, 40, 18, 48); g.closePath(); }, c, 30, 16, 70, 50);
    g.fillStyle = '#fbffd8';
    for (const [x, y, r] of [[36, 32, 4], [52, 26, 5], [66, 36, 3.5], [44, 42, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    eye(g, 44, 60, 3, '#fbffd8'); eye(g, 56, 60, 3, '#fbffd8');
  };
  SP.golem = (g, c) => {
    shadow(g, 50, 93, 40);
    const rock = (x, y, w, h, col) => body(g, () => { g.beginPath(); g.moveTo(x + w * 0.2, y); g.lineTo(x + w * 0.85, y + h * 0.05); g.lineTo(x + w, y + h * 0.6); g.lineTo(x + w * 0.7, y + h); g.lineTo(x + w * 0.1, y + h * 0.9); g.lineTo(x, y + h * 0.35); g.closePath(); }, col, x, y, x + w, y + h);
    rock(26, 44, 48, 48, c); rock(8, 46, 22, 30, shade(c, -0.1)); rock(70, 46, 22, 30, shade(c, -0.1)); rock(34, 16, 32, 30, shade(c, 0.1));
    g.fillStyle = '#ffd1e6';
    for (const [x, y] of [[36, 60], [60, 72], [50, 50], [18, 56], [80, 60]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 7); g.lineTo(x + 6, y); g.fill(); }
    eye(g, 44, 30, 3.5, '#7ff7ff'); eye(g, 56, 30, 3.5, '#7ff7ff');
  };
  SP.siren = (g, c) => {
    shadow(g, 50, 93, 24);
    body(g, () => { g.beginPath(); g.moveTo(40, 56); g.quadraticCurveTo(30, 76, 44, 88); g.quadraticCurveTo(54, 94, 70, 86); g.quadraticCurveTo(58, 82, 56, 56); g.closePath(); }, '#3fa7b5', 30, 56, 70, 92);
    body(g, () => { g.beginPath(); g.moveTo(66, 84); g.lineTo(84, 74); g.lineTo(80, 90); g.closePath(); }, '#3fa7b5', 66, 74, 84, 90);
    body(g, () => { g.beginPath(); g.moveTo(38, 58); g.quadraticCurveTo(48, 40, 58, 58); g.closePath(); }, '#d9b8a0', 38, 40, 58, 58);
    body(g, () => { g.beginPath(); g.arc(48, 34, 10, 0, TAU); }, '#d9b8a0', 38, 24, 58, 44);
    g.strokeStyle = c; g.lineWidth = 5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(40 + i * 4, 26); g.bezierCurveTo(30 + i * 4, 40, 40 + i * 5, 56, 32 + i * 6, 70); g.stroke(); }
    eye(g, 45, 34, 2.4, '#ffffff'); eye(g, 52, 34, 2.4, '#ffffff');
  };
  SP.bloat = (g, c) => {
    shadow(g, 50, 92, 28);
    g.strokeStyle = OUT; g.lineWidth = 3;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; g.beginPath(); g.moveTo(50 + Math.cos(a) * 26, 54 + Math.sin(a) * 26); g.lineTo(50 + Math.cos(a) * 36, 54 + Math.sin(a) * 36); g.stroke(); }
    body(g, () => { g.beginPath(); g.arc(50, 54, 28, 0, TAU); }, c, 26, 30, 74, 82);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(40, 42, 8, 5, -0.6, 0, TAU); g.fill();
    eye(g, 40, 52, 6); eye(g, 60, 52, 6);
    g.fillStyle = OUT; g.beginPath(); g.ellipse(50, 68, 5, 4, 0, 0, TAU); g.fill();
  };
  SP.ghoul = (g, c) => {
    shadow(g, 50, 93, 28);
    body(g, () => { g.beginPath(); g.moveTo(26, 92); g.quadraticCurveTo(22, 54, 46, 46); g.quadraticCurveTo(72, 42, 76, 66); g.lineTo(80, 92); g.closePath(); }, c, 26, 42, 80, 92);
    body(g, () => { g.beginPath(); g.ellipse(46, 40, 15, 13, -0.2, 0, TAU); }, shade(c, 0.12), 32, 28, 60, 52);
    g.fillStyle = '#f0ecd8'; g.strokeStyle = OUT; g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(36 + i * 5, 46); g.lineTo(38 + i * 5, 52); g.lineTo(40 + i * 5, 46); g.fill(); g.stroke(); }
    eye(g, 40, 38, 3.5, '#d6ff6b'); eye(g, 52, 36, 3.5, '#d6ff6b');
    g.strokeStyle = OUT; g.lineWidth = 3;
    for (const s of [0, 1]) { const x = 22 + s * 56; g.beginPath(); g.moveTo(x, 62); g.lineTo(x - 6 + s * 12, 80); g.moveTo(x - 6 + s * 12, 80); g.lineTo(x - 10 + s * 20, 84); g.stroke(); }
  };
  SP.polyp = (g, c) => {
    shadow(g, 50, 92, 22);
    body(g, () => { g.beginPath(); g.moveTo(34, 92); g.quadraticCurveTo(30, 60, 50, 50); g.quadraticCurveTo(70, 60, 66, 92); g.closePath(); }, c, 30, 50, 70, 92);
    g.strokeStyle = shade(c, 0.3); g.lineWidth = 4;
    for (let i = 0; i < 6; i++) { const a = -Math.PI + (i / 5) * Math.PI; g.beginPath(); g.moveTo(50, 52); g.quadraticCurveTo(50 + Math.cos(a) * 14, 40 + Math.sin(a) * 8, 50 + Math.cos(a) * 22, 32 + Math.sin(a) * 10); g.stroke(); }
    eye(g, 44, 70, 3.5); eye(g, 56, 70, 3.5);
  };
  SP.tentacle = (g, c) => {
    shadow(g, 50, 93, 18);
    body(g, () => { g.beginPath(); g.moveTo(36, 92); g.bezierCurveTo(30, 60, 70, 50, 54, 14); g.bezierCurveTo(64, 30, 84, 58, 64, 92); g.closePath(); }, c, 36, 14, 70, 92);
    g.fillStyle = '#f7c3e6'; g.strokeStyle = OUT; g.lineWidth = 1.5;
    for (const [x, y, r] of [[52, 80, 4], [56, 66, 3.5], [60, 52, 3], [60, 40, 2.5], [58, 30, 2]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); }
  };
  SP.matron = (g, c) => {
    glowCircle(g, 50, 44, 48, 'rgba(255,122,200,A)', 0.35);
    g.strokeStyle = shade(c, 0.25); g.lineWidth = 4;
    for (let i = 0; i < 8; i++) { const x = 18 + i * 9; g.beginPath(); g.moveTo(x, 50); g.bezierCurveTo(x - 8, 66, x + 8, 76, x - 2, 94); g.stroke(); }
    body(g, () => { g.beginPath(); g.moveTo(10, 52); g.bezierCurveTo(8, 6, 92, 6, 90, 52); g.quadraticCurveTo(50, 62, 10, 52); g.closePath(); }, c, 30, 6, 70, 56);
    body(g, () => { g.beginPath(); g.moveTo(34, 18); g.lineTo(38, 6); g.lineTo(44, 14); g.lineTo(50, 2); g.lineTo(56, 14); g.lineTo(62, 6); g.lineTo(66, 18); g.closePath(); }, '#ffd27a', 34, 2, 66, 18);
    eye(g, 40, 36, 5, '#fff2fb'); eye(g, 60, 36, 5, '#fff2fb');
  };
  SP.kraken = (g, c) => {
    shadow(g, 50, 94, 44);
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 14.4, dir = i < 3 ? -1 : 1;
      body(g, () => { g.beginPath(); g.moveTo(x - 6, 70); g.bezierCurveTo(x - 4 + dir * 4, 84, x + dir * 12, 88, x + dir * 14, 94); g.bezierCurveTo(x + dir * 4, 92, x + 8, 84, x + 6, 70); g.closePath(); }, c, x - 6, 70, x + 6, 94, 2.5);
    }
    body(g, () => { g.beginPath(); g.moveTo(14, 74); g.bezierCurveTo(4, 30, 30, 4, 50, 4); g.bezierCurveTo(70, 4, 96, 30, 86, 74); g.quadraticCurveTo(50, 84, 14, 74); g.closePath(); }, c, 20, 4, 80, 80);
    g.fillStyle = shade(c, -0.25);
    for (const [x, y, r] of [[34, 22, 4], [62, 18, 5], [72, 34, 3], [28, 40, 3]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    eye(g, 36, 54, 7, null, '#ffcf3a'); eye(g, 64, 54, 7, null, '#ffcf3a');
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(28, 44); g.lineTo(42, 48); g.moveTo(72, 44); g.lineTo(58, 48); g.stroke();
  };
  SP.eye = (g, c) => {
    glowCircle(g, 50, 46, 46, 'rgba(255,93,115,A)', 0.3);
    g.strokeStyle = '#4a2a52'; g.lineWidth = 5;
    for (let i = 0; i < 6; i++) { const a = Math.PI * 0.15 + (i / 5) * Math.PI * 0.7; g.beginPath(); g.moveTo(50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20); g.bezierCurveTo(50 + Math.cos(a) * 34, 60 + Math.sin(a) * 30, 50 + Math.cos(a) * 20, 70 + Math.sin(a) * 30, 50 + Math.cos(a) * 30, 92); g.stroke(); }
    body(g, () => { g.beginPath(); g.arc(50, 44, 28, 0, TAU); }, '#5a2f63', 22, 16, 78, 72);
    g.fillStyle = '#fff3e6'; g.beginPath(); g.ellipse(50, 44, 22, 16, 0, 0, TAU); g.fill();
    const gr = g.createRadialGradient(50, 44, 1, 50, 44, 11); gr.addColorStop(0, '#ffef9a'); gr.addColorStop(0.5, c); gr.addColorStop(1, '#5a0f22');
    g.fillStyle = gr; g.beginPath(); g.arc(50, 44, 11, 0, TAU); g.fill();
    g.fillStyle = OUT; g.beginPath(); g.ellipse(50, 44, 3, 9, 0, 0, TAU); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.ellipse(50, 44, 22, 16, 0, 0, TAU); g.stroke();
  };
  SP.leech = (g, c) => {
    shadow(g, 50, 93, 30);
    body(g, () => { g.beginPath(); g.moveTo(14, 90); g.bezierCurveTo(10, 60, 40, 70, 44, 50); g.bezierCurveTo(48, 28, 70, 16, 80, 30); g.bezierCurveTo(90, 44, 70, 52, 66, 66); g.bezierCurveTo(62, 82, 50, 92, 14, 90); g.closePath(); }, c, 14, 16, 86, 92);
    g.strokeStyle = shade(c, -0.35); g.lineWidth = 2;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(46 + i * 4, 60 - i * 6, 14, 0.6, 1.8); g.stroke(); }
    g.fillStyle = '#2a0f30'; g.beginPath(); g.arc(78, 30, 8, 0, TAU); g.fill();
    g.fillStyle = '#ff9ad5'; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.arc(78 + Math.cos(a) * 6, 30 + Math.sin(a) * 6, 1.4, 0, TAU); g.fill(); }
    eye(g, 66, 26, 2.5, '#f3d0ff'); eye(g, 72, 18, 2.5, '#f3d0ff');
  };
  SP.acolyte = (g, c) => {
    shadow(g, 50, 93, 26);
    glowCircle(g, 50, 40, 34, 'rgba(92,124,250,A)', 0.35);
    body(g, () => { g.beginPath(); g.moveTo(24, 92); g.quadraticCurveTo(30, 50, 36, 34); g.quadraticCurveTo(50, 10, 64, 34); g.quadraticCurveTo(70, 50, 76, 92); g.closePath(); }, '#2d2b55', 24, 10, 76, 92);
    g.fillStyle = '#0b0a18'; g.beginPath(); g.ellipse(50, 38, 10, 13, 0, 0, TAU); g.fill();
    eye(g, 45, 38, 2.6, '#9fb4ff'); eye(g, 55, 38, 2.6, '#9fb4ff');
    g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.moveTo(40, 60); g.lineTo(50, 52); g.lineTo(60, 60); g.lineTo(50, 72); g.closePath(); g.stroke();
    g.strokeStyle = '#c2a36b'; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 92); g.lineTo(84, 24); g.stroke();
    glowCircle(g, 84, 22, 10, 'rgba(160,190,255,A)', 0.9);
  };
  SP.eel = (g, c) => {
    shadow(g, 50, 93, 30);
    body(g, () => { g.beginPath(); g.moveTo(10, 86); g.bezierCurveTo(30, 96, 40, 60, 54, 62); g.bezierCurveTo(70, 64, 60, 36, 72, 26); g.bezierCurveTo(84, 18, 94, 30, 86, 40); g.bezierCurveTo(78, 48, 80, 74, 60, 78); g.bezierCurveTo(44, 82, 38, 100, 10, 86); g.closePath(); }, c, 10, 18, 92, 96);
    g.strokeStyle = shade(c, 0.4); g.lineWidth = 2; g.beginPath(); g.moveTo(20, 88); g.bezierCurveTo(40, 86, 48, 68, 60, 70); g.stroke();
    eye(g, 80, 30, 3.5, '#eaffd0');
    g.fillStyle = '#f2f2e0'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(84 + i * 2, 38); g.lineTo(85 + i * 2, 42); g.lineTo(86 + i * 2, 38); g.fill(); }
  };
  SP.knight = (g, c) => {
    shadow(g, 50, 93, 32);
    body(g, () => { g.beginPath(); g.moveTo(26, 92); g.lineTo(30, 48); g.lineTo(70, 48); g.lineTo(74, 92); g.closePath(); }, '#3a4060', 26, 48, 74, 92);
    body(g, () => { g.beginPath(); g.moveTo(22, 52); g.quadraticCurveTo(50, 36, 78, 52); g.lineTo(74, 60); g.lineTo(26, 60); g.closePath(); }, c, 22, 36, 78, 60);
    body(g, () => { g.beginPath(); g.moveTo(36, 46); g.lineTo(36, 22); g.quadraticCurveTo(50, 8, 64, 22); g.lineTo(64, 46); g.closePath(); }, c, 36, 8, 64, 46);
    g.fillStyle = '#0c0b18'; g.fillRect(40, 28, 20, 5);
    eye(g, 45, 30.5, 2.2, '#ff5d73'); eye(g, 55, 30.5, 2.2, '#ff5d73');
    g.strokeStyle = '#ff5d73'; g.lineWidth = 3; g.beginPath(); g.moveTo(50, 8); g.quadraticCurveTo(58, 0, 66, 4); g.stroke();
    // greatsword
    g.strokeStyle = '#cdd6ea'; g.lineWidth = 6; g.beginPath(); g.moveTo(84, 90); g.lineTo(84, 14); g.stroke(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = '#8a7a52'; g.lineWidth = 5; g.beginPath(); g.moveTo(76, 74); g.lineTo(92, 74); g.stroke();
  };
  SP.god = (g, c) => {
    glowCircle(g, 50, 46, 50, 'rgba(255,90,42,A)', 0.38);
    for (let i = 0; i < 8; i++) {
      const x = 10 + i * 11.5;
      body(g, () => { g.beginPath(); g.moveTo(x - 4, 74); g.bezierCurveTo(x - 10, 84, x + 8, 88, x - 2, 96); g.bezierCurveTo(x + 10, 92, x + 6, 82, x + 5, 74); g.closePath(); }, '#2b1d3a', x - 6, 74, x + 6, 96, 2);
    }
    body(g, () => { g.beginPath(); g.moveTo(14, 78); g.bezierCurveTo(4, 36, 26, 14, 50, 14); g.bezierCurveTo(74, 14, 96, 36, 86, 78); g.quadraticCurveTo(50, 90, 14, 78); g.closePath(); }, '#3a2550', 20, 14, 80, 84);
    body(g, () => { g.beginPath(); g.moveTo(24, 24); g.lineTo(30, 2); g.lineTo(40, 16); g.lineTo(50, 0); g.lineTo(60, 16); g.lineTo(70, 2); g.lineTo(76, 24); g.quadraticCurveTo(50, 16, 24, 24); g.closePath(); }, '#d9a441', 24, 0, 76, 24);
    g.fillStyle = c; g.beginPath(); g.arc(50, 12, 3.5, 0, TAU); g.fill();
    eye(g, 36, 46, 6, '#ffb36b'); eye(g, 64, 46, 6, '#ffb36b'); eye(g, 50, 34, 4, '#ffe0a0');
    g.fillStyle = '#12081a'; g.beginPath(); g.moveTo(30, 62); g.quadraticCurveTo(50, 80, 70, 62); g.quadraticCurveTo(50, 70, 30, 62); g.fill();
    g.fillStyle = '#f5e8d0'; for (let i = 0; i < 7; i++) { const x = 33 + i * 5.5; g.beginPath(); g.moveTo(x, 63 + Math.sin(i / 6 * Math.PI) * 4); g.lineTo(x + 2.5, 69 + Math.sin(i / 6 * Math.PI) * 4); g.lineTo(x + 5, 63 + Math.sin(i / 6 * Math.PI) * 4); g.fill(); }
  };
  // ----- player characters -----
  SP.cast = (g) => {
    shadow(g, 50, 93, 26);
    // oar
    g.strokeStyle = '#8a5a32'; g.lineWidth = 5; g.beginPath(); g.moveTo(22, 90); g.lineTo(34, 18); g.stroke(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
    body(g, () => { g.beginPath(); g.ellipse(35, 14, 6, 12, 0.15, 0, TAU); }, '#b07a46', 29, 2, 41, 26);
    body(g, () => { g.beginPath(); g.moveTo(32, 92); g.lineTo(34, 56); g.quadraticCurveTo(50, 46, 66, 56); g.lineTo(68, 92); g.closePath(); }, '#3f7fa8', 32, 46, 68, 92);
    g.strokeStyle = '#e8f2ff'; g.lineWidth = 3; for (const y of [62, 70, 78, 86]) { g.beginPath(); g.moveTo(35, y); g.lineTo(65, y); g.stroke(); }
    body(g, () => { g.beginPath(); g.arc(50, 40, 12, 0, TAU); }, '#e8b48a', 38, 28, 62, 52);
    body(g, () => { g.beginPath(); g.ellipse(50, 30, 22, 6, 0, 0, TAU); }, '#e6c36a', 28, 24, 72, 36);
    body(g, () => { g.beginPath(); g.ellipse(50, 26, 11, 8, 0, Math.PI, TAU); g.closePath(); }, '#e6c36a', 40, 18, 60, 28);
    g.fillStyle = '#c0392b'; g.fillRect(39, 26, 22, 3);
    eye(g, 45, 40, 2.6); eye(g, 55, 40, 2.6);
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.arc(50, 45, 4, 0.3, Math.PI - 0.3); g.stroke();
  };
  SP.witch = (g) => {
    shadow(g, 50, 93, 26);
    glowCircle(g, 72, 52, 18, 'rgba(255,138,61,A)', 0.8);
    body(g, () => { g.beginPath(); g.moveTo(26, 92); g.quadraticCurveTo(34, 60, 38, 44); g.lineTo(62, 44); g.quadraticCurveTo(66, 60, 74, 92); g.closePath(); }, '#7a2c3a', 26, 44, 74, 92);
    body(g, () => { g.beginPath(); g.arc(50, 42, 11, 0, TAU); }, '#efc7a8', 39, 31, 61, 53);
    g.fillStyle = '#2a1430'; g.beginPath(); g.moveTo(38, 42); g.quadraticCurveTo(36, 62, 42, 66); g.lineTo(44, 44); g.fill(); g.beginPath(); g.moveTo(62, 42); g.quadraticCurveTo(64, 62, 58, 66); g.lineTo(56, 44); g.fill();
    body(g, () => { g.beginPath(); g.moveTo(24, 36); g.quadraticCurveTo(50, 28, 76, 36); g.quadraticCurveTo(50, 40, 24, 36); g.closePath(); }, '#3a1d3f', 24, 28, 76, 40);
    body(g, () => { g.beginPath(); g.moveTo(36, 34); g.quadraticCurveTo(46, 14, 64, 2); g.quadraticCurveTo(58, 18, 64, 34); g.closePath(); }, '#3a1d3f', 36, 2, 64, 34);
    g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(54, 30, 2.5, 0, TAU); g.fill();
    eye(g, 45, 42, 2.4, '#ffb36b'); eye(g, 55, 42, 2.4, '#ffb36b');
    g.fillStyle = '#ffdf9a'; g.beginPath(); g.moveTo(72, 60); g.quadraticCurveTo(64, 50, 70, 42); g.quadraticCurveTo(72, 48, 74, 46); g.quadraticCurveTo(80, 52, 72, 60); g.fill();
  };
  SP.rogue = (g) => {
    shadow(g, 50, 93, 26);
    body(g, () => { g.beginPath(); g.moveTo(28, 92); g.lineTo(32, 54); g.quadraticCurveTo(50, 44, 68, 54); g.lineTo(72, 92); g.closePath(); }, '#245a4a', 28, 44, 72, 92);
    g.fillStyle = '#4fe0a8'; g.fillRect(32, 70, 36, 4);
    body(g, () => { g.beginPath(); g.moveTo(34, 50); g.quadraticCurveTo(34, 20, 50, 20); g.quadraticCurveTo(66, 20, 66, 50); g.quadraticCurveTo(50, 56, 34, 50); g.closePath(); }, '#1c3f3a', 34, 20, 66, 56);
    g.fillStyle = '#e1b892'; g.beginPath(); g.ellipse(50, 40, 9, 10, 0, 0, TAU); g.fill();
    g.fillStyle = '#17302c'; g.fillRect(41, 42, 18, 8);
    eye(g, 46, 37, 2.2, '#c6fff0'); eye(g, 54, 37, 2.2, '#c6fff0');
    for (const s of [-1, 1]) { g.strokeStyle = '#dfe7f2'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(50 + s * 20, 72); g.lineTo(50 + s * 34, 56); g.stroke(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#8a5a32'; g.fillRect(50 + s * 20 - 3, 70, 6, 6); }
  };
  A.SPRITES = SP;
  A.drawSprite = function (cv, art, col, px) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = Math.round(px * dpr); cv.height = Math.round(px * dpr);
    cv.style.width = px + 'px'; cv.style.height = px + 'px';
    const g = cv.getContext('2d');
    g.setTransform((px * dpr) / 100, 0, 0, (px * dpr) / 100, 0, 0);
    g.clearRect(0, 0, 100, 100);
    (SP[art] || SP.slime)(g, col || '#888888');
  };

  // ---------------- backgrounds ----------------
  A.drawBackground = function (cv, act, w, h) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let rs = 1234 + act * 77;
    const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
    const sky = g.createLinearGradient(0, 0, 0, h);
    if (act === 1) { sky.addColorStop(0, '#0c1230'); sky.addColorStop(0.55, '#1b1b3d'); sky.addColorStop(1, '#2a1e2a'); }
    else if (act === 2) { sky.addColorStop(0, '#051a1f'); sky.addColorStop(0.5, '#0b2c33'); sky.addColorStop(1, '#0a1a1c'); }
    else { sky.addColorStop(0, '#0b0612'); sky.addColorStop(0.5, '#1d0b22'); sky.addColorStop(1, '#2a0d12'); }
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    if (act === 1) {
      for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + rnd() * 0.6) + ')'; g.fillRect(rnd() * w, rnd() * h * 0.45, 1.5, 1.5); }
      const mx = w * 0.78, my = h * 0.12;
      glowCircle(g, mx, my, 90, 'rgba(255,230,180,A)', 0.25);
      g.fillStyle = '#f6ecd0'; g.beginPath(); g.arc(mx, my, 22, 0, TAU); g.fill();
      const sea = h * 0.42;
      g.fillStyle = '#121c3e'; g.fillRect(0, sea, w, h);
      g.strokeStyle = 'rgba(160,190,255,0.12)'; g.lineWidth = 2;
      for (let i = 0; i < 9; i++) { const y = sea + 10 + i * 14; g.beginPath(); for (let x = 0; x <= w; x += 20) g.lineTo(x, y + Math.sin(x / 40 + i) * 3); g.stroke(); }
      g.fillStyle = 'rgba(255,236,180,0.12)'; g.fillRect(mx - 18, sea, 36, h * 0.2);
      // wreck silhouette
      g.fillStyle = '#0a0f22'; g.beginPath(); g.moveTo(w * 0.05, sea + 6); g.lineTo(w * 0.28, sea + 2); g.lineTo(w * 0.24, sea + 18); g.lineTo(w * 0.08, sea + 18); g.fill();
      g.fillRect(w * 0.15, sea - 50, 3, 52); g.beginPath(); g.moveTo(w * 0.15 + 3, sea - 46); g.lineTo(w * 0.15 + 26, sea - 30); g.lineTo(w * 0.15 + 3, sea - 14); g.fill();
      const sand = g.createLinearGradient(0, h * 0.62, 0, h);
      sand.addColorStop(0, '#3a2f3a'); sand.addColorStop(1, '#1a141c');
      g.fillStyle = sand; g.beginPath(); g.moveTo(0, h * 0.66); g.quadraticCurveTo(w * 0.5, h * 0.6, w, h * 0.68); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    } else if (act === 2) {
      for (let i = 0; i < 26; i++) { const x = rnd() * w, y = rnd() * h, r = 1 + rnd() * 3; glowCircle(g, x, y, r * 6, 'rgba(120,255,220,A)', 0.25); g.fillStyle = 'rgba(190,255,240,0.8)'; g.beginPath(); g.arc(x, y, r * 0.6, 0, TAU); g.fill(); }
      g.fillStyle = '#04110f';
      g.beginPath(); g.moveTo(0, 0); for (let x = 0; x <= w; x += w / 10) g.lineTo(x, 30 + rnd() * 60); g.lineTo(w, 0); g.fill();
      g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.7); for (let x = 0; x <= w; x += w / 8) g.lineTo(x, h * (0.66 + rnd() * 0.08)); g.lineTo(w, h); g.fill();
      for (let i = 0; i < 6; i++) { const x = rnd() * w; g.fillStyle = 'rgba(80,255,200,0.07)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x + 120, h); g.lineTo(x + 60, h); g.fill(); }
    } else {
      for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h; glowCircle(g, x, y, 10 + rnd() * 20, 'rgba(255,90,42,A)', 0.08 + rnd() * 0.1); }
      g.fillStyle = '#07040b';
      g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.72); for (let x = 0; x <= w; x += w / 12) g.lineTo(x, h * (0.68 + rnd() * 0.1)); g.lineTo(w, h); g.fill();
      for (let i = 0; i < 5; i++) { const x = (i + 0.5) * w / 5 + (rnd() - 0.5) * 40; g.fillStyle = '#0d0714'; g.beginPath(); g.moveTo(x - 10, h * 0.75); g.lineTo(x - 3, h * (0.35 + rnd() * 0.15)); g.lineTo(x + 4, h * 0.75); g.fill(); }
    }
    const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  };
})(typeof window !== 'undefined' ? window : globalThis);
