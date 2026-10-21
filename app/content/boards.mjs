/* ---------- Community boards ----------
   Reference data, not seed data. The board list is the shape of the forum, so
   it lives here rather than inside seed-community.mjs: the seed wipes every
   post, and a board list that can only change by wiping posts is a board list
   that never changes. migrate() upserts this on every boot (db.mjs), so adding
   a board is adding a line here and restarting the server — existing posts,
   votes and comments are untouched.

   Removing a line does NOT drop the board: posts reference it, and a board
   that disappears would take its threads with it. Retiring one is a deliberate
   migration, not a deletion here.

   [slug, name_en, name_zh, desc_en, desc_zh, icon] — array order is sort order. */
export const BOARDS = [
  ['campus-life', 'Campus life', '校园生活',
   'Day-to-day life on and around campus.', '校园内外的日常。', '🏫'],
  ['housing', 'Housing & dorms', '住宿',
   'Dorms, renting off campus, roommates, moving.', '宿舍、校外租房、室友、搬家。', '🏠'],
  ['paperwork', 'Visas & paperwork', '签证与手续',
   'Residence permits, registration, banking, phones. Always confirm with the official office.',
   '居留许可、登记、银行、手机卡。请务必以官方部门信息为准。', '🛂'],
  ['study', 'Study & courses', '学习与课程',
   'Courses, professors, exams, study groups.', '课程、老师、考试、学习小组。', '📚'],
  ['food', 'Food & Hangzhou', '美食与杭州',
   'Where to eat, what to see, weekend trips.', '吃什么、去哪玩、周末出行。', '🍜'],
  /* Events used to claim sports and clubs as well. Both outgrew it: one is
     people looking for a fourth player this afternoon, the other is societies
     recruiting for a year. What is left here is the one-off gathering. */
  ['events', 'Events & meetups', '活动与聚会',
   'Parties, trips, markets and one-off gatherings. Meet in public places.',
   '聚会、出游、市集等一次性活动。请在公共场所见面。', '🎉'],
  ['sports', 'Sports & fitness', '运动与健身',
   'Find people to play with — ping pong, basketball, football, tennis, running, the gym.',
   '找人一起运动——乒乓球、篮球、足球、网球、跑步、健身。', '⚽'],
  ['clubs', 'Clubs & societies', '社团',
   'Club activities, open sessions and recruiting. Say what your club actually does.',
   '社团活动、开放日与招新。请说清楚社团具体做什么。', '👥'],
  ['language', 'Language exchange', '语言交换',
   'Find a partner to practise Chinese, English or anything else.', '找语伴，练中文、英文或其他语言。', '🗣'],
  ['careers', 'Internships & careers', '实习与求职',
   'Internships, part-time rules, CVs, interviews.', '实习、兼职规定、简历、面试。', '💼'],
];
