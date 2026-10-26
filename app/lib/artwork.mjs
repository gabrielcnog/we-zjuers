/* ============================================================
   Seed artwork — flat item illustrations, drawn as SVG.

   Generated locally, so there is no network fetch, no stock
   licence to track, and every picture matches its listing. They
   read as deliberate placeholder art rather than as fake
   photography, which is the honest thing for a prototype.

   Production replaces these with real uploads (see app/README).
   ============================================================ */

/* Each item gets its own ground tone so a grid of them looks
   varied rather than like one repeated template. */
const GROUNDS = [
  ['#E8EEF6', '#CFDCEC'], ['#F0EAE2', '#DDCFBE'], ['#E6EFEA', '#C9DED3'],
  ['#F1E9EF', '#DCC9D8'], ['#EAEDF2', '#D2D8E2'], ['#F2EDE4', '#E0D3C0'],
  ['#E7EEF0', '#C9DCE0'], ['#EFE9E9', '#DCC9C9'],
];

const shadow = (cx = 200, cy = 246, rx = 92, ry = 13) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#0E1319" opacity=".12"/>`;

/* --- the drawings. Each returns a group centred around (200,165). --- */
const ART = {
  lamp: (c) => `
    <ellipse cx="200" cy="243" rx="52" ry="9" fill="${c.dark}" opacity=".35"/>
    <rect x="176" y="232" width="48" height="10" rx="5" fill="${c.dark}"/>
    <rect x="196" y="150" width="8" height="86" fill="${c.main}"/>
    <path d="M200 152 L152 108" stroke="${c.main}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M118 74 L186 116 L166 138 L104 96 Z" fill="${c.main}"/>
    <path d="M118 74 L186 116 L176 127 L110 85 Z" fill="${c.light}"/>
    <circle cx="140" cy="122" r="9" fill="#FFF3C4"/>
    <circle cx="140" cy="122" r="20" fill="#FFF3C4" opacity=".28"/>`,
  desk: (c) => `
    <rect x="86" y="150" width="228" height="16" rx="4" fill="${c.main}"/>
    <rect x="86" y="150" width="228" height="6" rx="3" fill="${c.light}"/>
    <rect x="98" y="166" width="12" height="78" fill="${c.dark}"/>
    <rect x="290" y="166" width="12" height="78" fill="${c.dark}"/>
    <rect x="98" y="196" width="204" height="8" fill="${c.dark}" opacity=".55"/>`,
  bike: (c) => `
    <circle cx="128" cy="206" r="42" fill="none" stroke="${c.dark}" stroke-width="7"/>
    <circle cx="272" cy="206" r="42" fill="none" stroke="${c.dark}" stroke-width="7"/>
    <circle cx="128" cy="206" r="6" fill="${c.dark}"/><circle cx="272" cy="206" r="6" fill="${c.dark}"/>
    <path d="M128 206 L182 206 L214 140 L246 206 M182 206 L214 140 M214 140 L200 140" 
      stroke="${c.main}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M246 206 L272 206 M246 206 L262 142" stroke="${c.main}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M250 136 L280 136" stroke="${c.dark}" stroke-width="7" stroke-linecap="round"/>
    <path d="M172 148 L204 148" stroke="${c.dark}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="200" cy="206" r="11" fill="none" stroke="${c.dark}" stroke-width="5"/>`,
  monitor: (c) => `
    <rect x="98" y="82" width="204" height="128" rx="7" fill="${c.dark}"/>
    <rect x="106" y="90" width="188" height="104" rx="3" fill="${c.light}"/>
    <rect x="106" y="90" width="188" height="104" rx="3" fill="${c.main}" opacity=".35"/>
    <rect x="186" y="210" width="28" height="26" fill="${c.dark}"/>
    <rect x="150" y="234" width="100" height="11" rx="5" fill="${c.dark}"/>`,
  books: (c) => `
    <rect x="112" y="206" width="176" height="26" rx="3" fill="${c.main}"/>
    <rect x="112" y="206" width="176" height="7" fill="${c.light}"/>
    <rect x="122" y="180" width="158" height="26" rx="3" fill="${c.dark}"/>
    <rect x="122" y="180" width="158" height="7" fill="${c.main}"/>
    <rect x="106" y="154" width="184" height="26" rx="3" fill="${c.accent}"/>
    <rect x="106" y="154" width="184" height="7" fill="${c.light}"/>
    <rect x="130" y="128" width="142" height="26" rx="3" fill="${c.main}"/>
    <rect x="130" y="128" width="142" height="7" fill="${c.light}"/>
    <rect x="140" y="134" width="4" height="14" fill="${c.dark}" opacity=".5"/>
    <rect x="132" y="160" width="4" height="14" fill="${c.dark}" opacity=".4"/>`,
  kettle: (c) => `
    <path d="M148 128 h104 l-10 106 a12 12 0 0 1 -12 10 h-60 a12 12 0 0 1 -12 -10 Z" fill="${c.main}"/>
    <path d="M148 128 h34 l-8 116 h-16 a12 12 0 0 1 -12 -10 Z" fill="${c.light}" opacity=".55"/>
    <rect x="142" y="118" width="116" height="14" rx="7" fill="${c.dark}"/>
    <rect x="192" y="104" width="16" height="16" rx="5" fill="${c.dark}"/>
    <path d="M252 146 q34 8 30 46 q-3 26 -22 30" stroke="${c.dark}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M148 150 q-26 14 -18 40" stroke="${c.dark}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  pots: (c) => `
    <path d="M96 158 h104 l-8 78 h-88 Z" fill="${c.main}"/>
    <rect x="90" y="150" width="116" height="12" rx="6" fill="${c.dark}"/>
    <path d="M206 176 h74 l-6 60 h-62 Z" fill="${c.accent}"/>
    <rect x="200" y="168" width="86" height="11" rx="5" fill="${c.dark}"/>
    <circle cx="243" cy="160" r="8" fill="${c.dark}"/>
    <path d="M286 190 q26 6 22 32" stroke="${c.dark}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <circle cx="148" cy="142" r="9" fill="${c.dark}"/>`,
  coat: (c) => `
    <path d="M200 96 q-26 0 -40 12 l-44 26 l20 40 l22 -12 l0 82 h84 l0 -82 l22 12 l20 -40 l-44 -26 q-14 -12 -40 -12 Z" fill="${c.main}"/>
    <path d="M200 96 q-26 0 -40 12 l-44 26 l20 40 l22 -12 l0 82 h42 Z" fill="${c.light}" opacity=".4"/>
    <path d="M176 106 q24 26 48 0" stroke="${c.dark}" stroke-width="6" fill="none"/>
    <circle cx="200" cy="164" r="5" fill="${c.dark}"/><circle cx="200" cy="196" r="5" fill="${c.dark}"/>
    <circle cx="200" cy="228" r="5" fill="${c.dark}"/>`,
  racket: (c) => `
    <ellipse cx="176" cy="132" rx="54" ry="64" fill="none" stroke="${c.dark}" stroke-width="9"/>
    <g stroke="${c.light}" stroke-width="2.5" opacity=".85">
      <path d="M146 80 v104 M162 74 v116 M178 72 v120 M194 74 v116 M210 80 v104"/>
      <path d="M126 106 h100 M124 122 h104 M124 138 h104 M126 154 h100 M132 170 h88"/>
    </g>
    <path d="M186 194 l30 54" stroke="${c.dark}" stroke-width="9" stroke-linecap="round"/>
    <rect x="206" y="228" width="20" height="42" rx="9" transform="rotate(-28 216 249)" fill="${c.main}"/>`,
  cooker: (c) => `
    <path d="M118 148 h164 v72 a20 20 0 0 1 -20 20 h-124 a20 20 0 0 1 -20 -20 Z" fill="${c.main}"/>
    <path d="M118 148 h44 v92 h-24 a20 20 0 0 1 -20 -20 Z" fill="${c.light}" opacity=".45"/>
    <rect x="110" y="132" width="180" height="18" rx="9" fill="${c.dark}"/>
    <rect x="186" y="116" width="28" height="18" rx="8" fill="${c.dark}"/>
    <rect x="196" y="184" width="62" height="30" rx="6" fill="${c.dark}" opacity=".85"/>
    <circle cx="212" cy="199" r="5" fill="${c.accent}"/><circle cx="230" cy="199" r="5" fill="${c.light}" opacity=".7"/>`,
  chair: (c) => `
    <path d="M156 92 h88 a14 14 0 0 1 14 14 v56 a14 14 0 0 1 -14 14 h-88 a14 14 0 0 1 -14 -14 v-56 a14 14 0 0 1 14 -14 Z" fill="${c.main}"/>
    <path d="M156 92 h44 v84 h-44 a14 14 0 0 1 -14 -14 v-56 a14 14 0 0 1 14 -14 Z" fill="${c.light}" opacity=".4"/>
    <rect x="132" y="176" width="136" height="22" rx="10" fill="${c.dark}"/>
    <rect x="194" y="198" width="12" height="32" fill="${c.dark}"/>
    <path d="M200 230 L146 250 M200 230 L254 250 M200 230 L200 254" stroke="${c.dark}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="144" cy="252" r="7" fill="${c.dark}"/><circle cx="256" cy="252" r="7" fill="${c.dark}"/>
    <circle cx="200" cy="256" r="7" fill="${c.dark}"/>`,
  stationery: (c) => `
    <path d="M148 168 h72 l-8 76 h-56 Z" fill="${c.main}"/>
    <path d="M148 168 h24 l-6 76 h-10 Z" fill="${c.light}" opacity=".5"/>
    <rect x="158" y="112" width="9" height="58" rx="4" fill="${c.accent}"/>
    <path d="M158 112 l4.5 -14 l4.5 14 Z" fill="${c.dark}"/>
    <rect x="178" y="100" width="9" height="70" rx="4" fill="${c.dark}"/>
    <path d="M178 100 l4.5 -14 l4.5 14 Z" fill="${c.light}"/>
    <rect x="198" y="120" width="9" height="50" rx="4" fill="${c.light}"/>
    <rect x="232" y="196" width="76" height="50" rx="4" fill="${c.accent}"/>
    <rect x="232" y="196" width="14" height="50" fill="${c.dark}"/>
    <g stroke="${c.dark}" stroke-width="2" opacity=".35">
      <path d="M256 212 h38 M256 222 h38 M256 232 h24"/></g>`,
  suitcase: (c) => `
    <rect x="120" y="112" width="160" height="124" rx="14" fill="${c.main}"/>
    <rect x="120" y="112" width="52" height="124" rx="14" fill="${c.light}" opacity=".4"/>
    <rect x="120" y="158" width="160" height="14" fill="${c.dark}" opacity=".7"/>
    <rect x="168" y="86" width="64" height="10" rx="5" fill="${c.dark}"/>
    <rect x="168" y="86" width="8" height="28" fill="${c.dark}"/><rect x="224" y="86" width="8" height="28" fill="${c.dark}"/>
    <rect x="188" y="150" width="24" height="30" rx="4" fill="${c.dark}"/>
    <circle cx="146" cy="244" r="9" fill="${c.dark}"/><circle cx="254" cy="244" r="9" fill="${c.dark}"/>`,
  keyboard: (c) => `
    <path d="M92 168 h216 a10 10 0 0 1 10 10 v50 a10 10 0 0 1 -10 10 h-216 a10 10 0 0 1 -10 -10 v-50 a10 10 0 0 1 10 -10 Z" fill="${c.dark}"/>
    <g fill="${c.main}">
      ${Array.from({ length: 14 }, (_, i) => `<rect x="${94 + i * 15.5}" y="178" width="12" height="12" rx="2.5"/>`).join('')}
      ${Array.from({ length: 13 }, (_, i) => `<rect x="${100 + i * 15.5}" y="194" width="12" height="12" rx="2.5"/>`).join('')}
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${106 + i * 15.5}" y="210" width="12" height="12" rx="2.5"/>`).join('')}
    </g>
    <rect x="150" y="226" width="100" height="10" rx="2.5" fill="${c.light}"/>`,
  fan: (c) => `
    <circle cx="200" cy="146" r="62" fill="none" stroke="${c.dark}" stroke-width="7"/>
    <circle cx="200" cy="146" r="46" fill="none" stroke="${c.dark}" stroke-width="2.5" opacity=".5"/>
    <circle cx="200" cy="146" r="30" fill="none" stroke="${c.dark}" stroke-width="2.5" opacity=".5"/>
    <g fill="${c.main}">
      <path d="M200 146 q34 -14 30 -40 q-22 -6 -30 40 Z"/>
      <path d="M200 146 q10 34 36 32 q8 -22 -36 -32 Z"/>
      <path d="M200 146 q-34 14 -30 40 q22 6 30 -40 Z"/>
      <path d="M200 146 q-10 -34 -36 -32 q-8 22 36 32 Z"/>
    </g>
    <circle cx="200" cy="146" r="10" fill="${c.dark}"/>
    <rect x="194" y="208" width="12" height="34" fill="${c.dark}"/>
    <rect x="162" y="240" width="76" height="10" rx="5" fill="${c.dark}"/>`,
  yoga: (c) => `
    <rect x="118" y="132" width="164" height="96" rx="48" fill="${c.main}"/>
    <ellipse cx="118" cy="180" rx="20" ry="48" fill="${c.dark}"/>
    <ellipse cx="118" cy="180" rx="10" ry="26" fill="${c.light}" opacity=".6"/>
    <path d="M170 132 v96 M214 132 v96" stroke="${c.dark}" stroke-width="7" opacity=".5"/>
    <path d="M170 118 q22 -16 44 0" stroke="${c.accent}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  shelf: (c) => `
    <rect x="106" y="106" width="188" height="140" rx="5" fill="${c.main}"/>
    <rect x="118" y="118" width="76" height="52" fill="${c.light}" opacity=".55"/>
    <rect x="206" y="118" width="76" height="52" fill="${c.light}" opacity=".35"/>
    <rect x="118" y="182" width="76" height="52" fill="${c.light}" opacity=".35"/>
    <rect x="206" y="182" width="76" height="52" fill="${c.light}" opacity=".55"/>
    <rect x="126" y="128" width="10" height="42" fill="${c.accent}"/>
    <rect x="140" y="134" width="10" height="36" fill="${c.dark}"/>
    <rect x="216" y="192" width="42" height="42" rx="4" fill="${c.dark}" opacity=".6"/>`,
  dryer: (c) => `
    <path d="M112 118 h84 a44 44 0 0 1 0 88 h-84 a12 12 0 0 1 -12 -12 v-64 a12 12 0 0 1 12 -12 Z" fill="${c.main}"/>
    <rect x="88" y="132" width="20" height="60" rx="8" fill="${c.dark}"/>
    <path d="M170 200 l16 58 a10 10 0 0 1 -10 12 h-14 a10 10 0 0 1 -10 -12 l10 -58 Z" fill="${c.dark}"/>
    <circle cx="196" cy="162" r="30" fill="${c.light}" opacity=".55"/>
    <circle cx="196" cy="162" r="16" fill="${c.dark}" opacity=".45"/>
    <rect x="124" y="150" width="30" height="8" rx="4" fill="${c.accent}"/>`,
  helmet: (c) => `
    <path d="M116 178 a84 78 0 0 1 168 0 l0 14 a10 10 0 0 1 -10 10 h-148 a10 10 0 0 1 -10 -10 Z" fill="${c.main}"/>
    <path d="M116 178 a84 78 0 0 1 84 -78 l0 102 h-74 a10 10 0 0 1 -10 -10 Z" fill="${c.light}" opacity=".4"/>
    <g fill="${c.dark}" opacity=".7">
      <rect x="152" y="126" width="16" height="34" rx="8"/><rect x="192" y="118" width="16" height="42" rx="8"/>
      <rect x="232" y="126" width="16" height="34" rx="8"/></g>
    <path d="M136 202 q18 40 64 40 q46 0 64 -40" stroke="${c.dark}" stroke-width="5" fill="none" opacity=".8"/>`,
  bedding: (c) => `
    <rect x="96" y="176" width="208" height="66" rx="16" fill="${c.main}"/>
    <rect x="96" y="176" width="208" height="18" rx="9" fill="${c.light}"/>
    <path d="M112 186 h176" stroke="${c.dark}" stroke-width="2" opacity=".3"/>
    <rect x="128" y="130" width="88" height="50" rx="18" fill="${c.light}"/>
    <rect x="128" y="130" width="88" height="50" rx="18" fill="${c.accent}" opacity=".35"/>
    <path d="M172 130 v50" stroke="${c.dark}" stroke-width="2" opacity=".25"/>`,
  pot: (c) => `
    <rect x="126" y="130" width="148" height="112" rx="18" fill="${c.main}"/>
    <rect x="126" y="130" width="46" height="112" rx="18" fill="${c.light}" opacity=".4"/>
    <rect x="118" y="118" width="164" height="18" rx="9" fill="${c.dark}"/>
    <rect x="188" y="102" width="24" height="18" rx="8" fill="${c.dark}"/>
    <rect x="150" y="164" width="100" height="42" rx="7" fill="${c.dark}" opacity=".85"/>
    <circle cx="172" cy="185" r="7" fill="${c.accent}"/>
    <rect x="190" y="180" width="46" height="10" rx="5" fill="${c.light}" opacity=".65"/>`,
  shoes: (c) => `
    <path d="M96 216 q0 -18 18 -22 l40 -10 l34 -34 q10 -10 22 -2 l10 8 l52 30 q26 14 26 30 l0 8 a10 10 0 0 1 -10 10 h-182 a10 10 0 0 1 -10 -10 Z" fill="${c.main}"/>
    <path d="M96 220 h202 l0 6 a10 10 0 0 1 -10 10 h-182 a10 10 0 0 1 -10 -10 Z" fill="${c.dark}"/>
    <path d="M190 150 l-28 30 M212 162 l-26 28 M234 176 l-24 26" stroke="${c.light}" stroke-width="6" stroke-linecap="round" opacity=".8"/>
    <path d="M150 186 q34 -6 62 12" stroke="${c.accent}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  hob: (c) => `
    <rect x="106" y="150" width="188" height="86" rx="12" fill="${c.dark}"/>
    <rect x="114" y="158" width="172" height="58" rx="8" fill="${c.main}"/>
    <circle cx="188" cy="187" r="40" fill="none" stroke="${c.accent}" stroke-width="5" opacity=".9"/>
    <circle cx="188" cy="187" r="24" fill="none" stroke="${c.accent}" stroke-width="4" opacity=".6"/>
    <circle cx="188" cy="187" r="9" fill="${c.accent}" opacity=".8"/>
    <circle cx="262" cy="172" r="8" fill="${c.light}"/><circle cx="262" cy="202" r="8" fill="${c.light}" opacity=".6"/>
    <rect x="126" y="224" width="60" height="6" rx="3" fill="${c.light}" opacity=".4"/>`,
  dumbbell: (c) => `
    <rect x="160" y="176" width="80" height="16" rx="6" fill="${c.dark}"/>
    <rect x="128" y="152" width="34" height="64" rx="10" fill="${c.main}"/>
    <rect x="238" y="152" width="34" height="64" rx="10" fill="${c.main}"/>
    <rect x="104" y="162" width="28" height="44" rx="10" fill="${c.dark}"/>
    <rect x="268" y="162" width="28" height="44" rx="10" fill="${c.dark}"/>
    <rect x="136" y="164" width="8" height="40" rx="4" fill="${c.light}" opacity=".5"/>
    <rect x="256" y="164" width="8" height="40" rx="4" fill="${c.light}" opacity=".5"/>`,
  camera: (c) => `
    <path d="M104 140 h48 l16 -20 h64 l16 20 h48 a14 14 0 0 1 14 14 v76 a14 14 0 0 1 -14 14 h-192 a14 14 0 0 1 -14 -14 v-76 a14 14 0 0 1 14 -14 Z" fill="${c.dark}"/>
    <circle cx="200" cy="192" r="46" fill="${c.main}"/>
    <circle cx="200" cy="192" r="32" fill="${c.light}" opacity=".5"/>
    <circle cx="200" cy="192" r="18" fill="${c.dark}"/>
    <circle cx="190" cy="182" r="6" fill="${c.light}" opacity=".8"/>
    <rect x="112" y="150" width="26" height="12" rx="4" fill="${c.accent}"/>
    <circle cx="272" cy="158" r="7" fill="${c.light}" opacity=".7"/>`,
  scooter: (c) => `
    <circle cx="118" cy="212" r="30" fill="none" stroke="${c.dark}" stroke-width="9"/>
    <circle cx="282" cy="212" r="30" fill="none" stroke="${c.dark}" stroke-width="9"/>
    <path d="M118 212 h34 l0 -12 h108 l0 12 h22" stroke="${c.main}" stroke-width="12" fill="none" stroke-linejoin="round"/>
    <rect x="150" y="188" width="116" height="14" rx="6" fill="${c.main}"/>
    <path d="M262 200 L268 104" stroke="${c.dark}" stroke-width="10" stroke-linecap="round"/>
    <path d="M240 100 h56" stroke="${c.dark}" stroke-width="10" stroke-linecap="round"/>
    <rect x="256" y="118" width="26" height="16" rx="4" fill="${c.accent}"/>`,
  translate: (c) => `
    <rect x="74" y="96" width="122" height="146" rx="8" fill="${c.light}"/>
    <rect x="74" y="96" width="122" height="146" rx="8" fill="none" stroke="${c.dark}" stroke-width="3" opacity=".35"/>
    <g stroke="${c.dark}" stroke-width="5" stroke-linecap="round" opacity=".45">
      <path d="M94 128h82M94 148h82M94 168h58"/></g>
    <text x="128" y="216" font-size="44" font-weight="700" fill="${c.main}">A</text>
    <rect x="204" y="96" width="122" height="146" rx="8" fill="${c.main}"/>
    <g stroke="${c.light}" stroke-width="5" stroke-linecap="round" opacity=".6">
      <path d="M224 128h82M224 148h82M224 168h58"/></g>
    <text x="252" y="218" font-size="46" font-weight="700" fill="${c.light}">文</text>
    <path d="M186 186l28 0" stroke="${c.accent}" stroke-width="6" stroke-linecap="round"/>
    <path d="M206 178l10 8-10 8" fill="none" stroke="${c.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  tutoring: (c) => `
    <rect x="72" y="80" width="256" height="150" rx="10" fill="${c.dark}"/>
    <rect x="84" y="92" width="232" height="126" rx="5" fill="${c.main}"/>
    <g stroke="${c.light}" stroke-width="5" stroke-linecap="round" opacity=".85">
      <path d="M110 124h64M110 146h96M110 168h48"/></g>
    <text x="228" y="170" font-size="52" font-weight="700" fill="${c.accent}">∑</text>
    <rect x="150" y="230" width="100" height="9" rx="4" fill="${c.dark}"/>
    <rect x="194" y="239" width="12" height="22" fill="${c.dark}"/>`,
  webdev: (c) => `
    <rect x="70" y="82" width="260" height="152" rx="9" fill="${c.dark}"/>
    <rect x="70" y="82" width="260" height="26" rx="9" fill="${c.main}"/>
    <circle cx="88" cy="95" r="4.5" fill="${c.accent}"/><circle cx="104" cy="95" r="4.5" fill="${c.light}" opacity=".8"/>
    <circle cx="120" cy="95" r="4.5" fill="${c.light}" opacity=".5"/>
    <g stroke="${c.light}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M150 140l-22 22 22 22"/><path d="M250 140l22 22-22 22"/><path d="M196 132l8 60"/></g>
    <rect x="150" y="240" width="100" height="9" rx="4" fill="${c.dark}"/>`,
  cvdesign: (c) => `
    <rect x="112" y="70" width="176" height="176" rx="9" fill="${c.light}"/>
    <rect x="112" y="70" width="176" height="176" rx="9" fill="none" stroke="${c.dark}" stroke-width="3" opacity=".3"/>
    <circle cx="152" cy="112" r="20" fill="${c.main}"/>
    <g stroke="${c.main}" stroke-width="7" stroke-linecap="round">
      <path d="M186 104h72M186 122h50"/></g>
    <g stroke="${c.dark}" stroke-width="5" stroke-linecap="round" opacity=".4">
      <path d="M136 158h128M136 178h128M136 198h92"/></g>
    <rect x="136" y="216" width="56" height="10" rx="5" fill="${c.accent}"/>`,
  repair: (c) => `
    <path d="M228 96a34 34 0 0 0-46 42l-64 64a14 14 0 0 0 20 20l64-64a34 34 0 0 0 42-46l-24 24-18-4-4-18Z"
      fill="${c.main}" stroke="${c.dark}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="130" cy="212" r="6" fill="${c.light}"/>
    <path d="M96 116l44 44" stroke="${c.dark}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="92" cy="112" r="14" fill="none" stroke="${c.accent}" stroke-width="8"/>`,
  gift: (c) => `
    <rect x="112" y="152" width="176" height="90" rx="8" fill="${c.main}"/>
    <rect x="112" y="152" width="176" height="24" rx="6" fill="${c.light}"/>
    <rect x="182" y="152" width="36" height="90" fill="${c.accent}"/>
    <path d="M200 152 q-40 -8 -40 -30 q0 -14 16 -14 q22 0 24 44 Z" fill="${c.accent}"/>
    <path d="M200 152 q40 -8 40 -30 q0 -14 -16 -14 q-22 0 -24 44 Z" fill="${c.accent}"/>
    <circle cx="200" cy="122" r="10" fill="${c.dark}"/>`,
  box: (c) => `
    <path d="M200 108 L308 146 L308 220 L200 258 L92 220 L92 146 Z" fill="${c.main}"/>
    <path d="M200 108 L308 146 L200 184 L92 146 Z" fill="${c.light}"/>
    <path d="M200 184 L308 146 L308 220 L200 258 Z" fill="${c.dark}" opacity=".45"/>
    <path d="M200 184 v74" stroke="${c.dark}" stroke-width="2" opacity=".3"/>
    <rect x="176" y="130" width="48" height="14" rx="4" fill="${c.accent}" opacity=".9"/>`,
};

/* Item palettes — muted, so a grid of them reads as a set. */
const PALETTES = {
  lamp:      { main: '#DCE3EA', light: '#F4F7FA', dark: '#7C8894', accent: '#0A6BD1' },
  desk:      { main: '#C89B6E', light: '#E4C39B', dark: '#7C5A38', accent: '#0A6BD1' },
  bike:      { main: '#2E7D6B', light: '#5FB3A1', dark: '#2C3742', accent: '#B01F24' },
  monitor:   { main: '#6FA8F5', light: '#DCE8F8', dark: '#2C3742', accent: '#0A6BD1' },
  books:     { main: '#7A5EA8', light: '#B79FD8', dark: '#3E5C8A', accent: '#B85C6E' },
  kettle:    { main: '#C9D2DA', light: '#EDF1F5', dark: '#5B6572', accent: '#0A6BD1' },
  pots:      { main: '#9AA6B2', light: '#D3DBE3', dark: '#454F5A', accent: '#C2410C' },
  coat:      { main: '#3E5C8A', light: '#7C9AC4', dark: '#22334D', accent: '#B01F24' },
  racket:    { main: '#B01F24', light: '#EDF1F5', dark: '#2C3742', accent: '#0A6BD1' },
  cooker:    { main: '#E2E7EC', light: '#F6F8FA', dark: '#5B6572', accent: '#B01F24' },
  chair:     { main: '#4A5560', light: '#828E9B', dark: '#2C3742', accent: '#0A6BD1' },
  stationery:{ main: '#D8B26A', light: '#F0DCA8', dark: '#5B6572', accent: '#B01F24' },
  suitcase:  { main: '#2F5FA8', light: '#7C9AC4', dark: '#1D3A66', accent: '#D8B26A' },
  keyboard:  { main: '#D3DBE3', light: '#F4F7FA', dark: '#39424D', accent: '#0A6BD1' },
  fan:       { main: '#CFD8E0', light: '#EDF1F5', dark: '#5B6572', accent: '#0A6BD1' },
  yoga:      { main: '#5AA9A0', light: '#9FD4CD', dark: '#316E68', accent: '#D8B26A' },
  shelf:     { main: '#B98C5E', light: '#E0C49C', dark: '#7A5636', accent: '#2E7D6B' },
  dryer:     { main: '#C86E8E', light: '#EFC2D3', dark: '#5B6572', accent: '#F0DCA8' },
  helmet:    { main: '#D8443C', light: '#F09189', dark: '#2C3742', accent: '#EDF1F5' },
  bedding:   { main: '#8FA8C4', light: '#E4EDF6', dark: '#4A5560', accent: '#C86E8E' },
  pot:       { main: '#D3DBE3', light: '#F4F7FA', dark: '#454F5A', accent: '#B01F24' },
  shoes:     { main: '#E4E9EE', light: '#FFFFFF', dark: '#39424D', accent: '#B01F24' },
  hob:       { main: '#39424D', light: '#C9D2DA', dark: '#22282F', accent: '#E8722C' },
  dumbbell:  { main: '#5B6572', light: '#A8B2BE', dark: '#2C3742', accent: '#0A6BD1' },
  camera:    { main: '#4A5560', light: '#A8B2BE', dark: '#22282F', accent: '#B01F24' },
  scooter:   { main: '#4A5560', light: '#A8B2BE', dark: '#2C3742', accent: '#B01F24' },
  translate: { main: '#3E5C8A', light: '#EDF1F5', dark: '#22334D', accent: '#B01F24' },
  tutoring:  { main: '#1E5548', light: '#E8F2EE', dark: '#123A31', accent: '#D8B26A' },
  webdev:    { main: '#0A6BD1', light: '#DCE8F8', dark: '#22282F', accent: '#4ADE80' },
  cvdesign:  { main: '#7A5EA8', light: '#F4F1F8', dark: '#3E2E58', accent: '#D8B26A' },
  repair:    { main: '#C2410C', light: '#F6E4D8', dark: '#5B2A08', accent: '#0A6BD1' },
  gift:      { main: '#2E7D6B', light: '#6FBFAC', dark: '#1E5548', accent: '#D8B26A' },
  box:       { main: '#C89B6E', light: '#E4C39B', dark: '#7C5A38', accent: '#B01F24' },
};

export const ART_KINDS = Object.keys(ART);

/* Variants stand in for "more photos of the same item" until real photographs
   are wired up: a closer crop, a wider shot, a mirrored angle. Enough visible
   difference that paging the carousel reads as several pictures rather than
   the same one repeated. */
const VARIANTS = [
  { t: '',                                              g: 0 },
  { t: 'translate(200 168) scale(1.38) translate(-200 -168)', g: 3 },
  { t: 'translate(200 160) scale(.84) rotate(-7) translate(-200 -160)', g: 5 },
  { t: 'translate(400 0) scale(-1 1)',                  g: 2 },
];

export function itemArt(kind, seed = 0, variant = 0) {
  const draw = ART[kind] || ART.box;
  const pal = PALETTES[kind] || PALETTES.box;
  const v = VARIANTS[variant % VARIANTS.length];
  const [g1, g2] = GROUNDS[(seed + v.g) % GROUNDS.length];
  const body = `${shadow()}\n${draw(pal)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></linearGradient>
<clipPath id="fr"><rect width="400" height="300"/></clipPath></defs>
<rect width="400" height="300" fill="url(#bg)"/>
<circle cx="${44 + (seed * 53 + variant * 91) % 312}" cy="${52 + (seed * 31 + variant * 37) % 60}" r="${34 + (seed * 17) % 40}" fill="#FFFFFF" opacity=".28"/>
<g clip-path="url(#fr)">${v.t ? `<g transform="${v.t}">${body}</g>` : body}</g>
</svg>`;
}
