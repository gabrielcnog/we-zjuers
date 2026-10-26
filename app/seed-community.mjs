/* ============================================================
   Dummy content for the Community prototype.

     node seed-community.mjs

   Touches only the community tables (boards, posts, comments, votes), so it
   is safe to re-run without losing marketplace listings or their photos.
   Authors are the seeded marketplace users.

   Scores are synthetic: ten demo accounts cannot produce a post with 60
   upvotes, so the seed writes `score` directly and records no vote rows.
   Real votes then move the number by one, as they would in production.

   Content is written to sound like students, and deliberately avoids stating
   visa, housing or university rules as fact — answers point people to the
   official office, which is what the real product should do too.
   ============================================================ */
import { pathToFileURL } from 'node:url';
import { pool, q, tx, migrate, uid } from './db.mjs';
/* The board list is reference data and lives with the other content;
   migrate() has already upserted it by the time this runs. */
import { BOARDS } from './content/boards.mjs';


/* [board, authorIdx, kind, hoursAgo, score, campus|null, title, body, listingTitle|null, comments]
   comments: [authorIdx, hoursAfterPost, score, body, replies[]] */
const POSTS = [
  ['paperwork', 3, 'question', 5, 42, null,
   'Residence permit renewal — how early did you start?',
   'Mine expires at the end of next month. The checklist I got in orientation is two years old and I am not sure it is still current.\n\nHow far ahead did you start, and was there anything that surprised you?',
   null,
   [[2, 1, 18, 'I started about six weeks before. The International Student Office sends an email with the current checklist each semester, so I would go by that rather than the old one.', [
      [3, 2, 6, 'Found it in my university inbox, thanks. It had changed.', []],
    ]],
    [6, 3, 11, 'Bring more passport photos than you think you need. I had to go back once.', [
      [0, 4, 3, 'Same. Also make copies of every passport page with a stamp.', []],
    ]],
    [8, 4, 4, 'Book the appointment as soon as the slots open, they fill up near the end of the semester.', []]]],

  ['food', 1, 'tip', 20, 61, 'zijingang',
   'Best cheap lunch within 10 minutes of Zijingang?',
   'Starting a thread so new students have one place to look. Under ¥30, walkable, go.',
   null,
   [[5, 1, 22, 'The noodle place by the north gate. Ask for less chilli if you are new to it, "shao la" works.', [
      [2, 2, 9, 'Can confirm, and they have a picture menu.', []],
      [7, 3, 5, '少辣 is the magic word 😄', []],
    ]],
    [4, 2, 14, 'Canteen 2 upstairs does a decent set meal. Not exciting, very reliable.', []],
    [9, 5, 7, '食堂的麻辣香锅性价比很高，中午人多建议早点去。', []]]],

  ['housing', 4, 'question', 9, 27, 'haining',
   'Moving off campus next semester — what should I check before signing?',
   'First time renting in China. Landlord seems nice but the contract is only in Chinese. What do people usually check, and is there somewhere I can get the contract looked at?',
   null,
   [[9, 1, 15, 'Ask whether the landlord will help with the accommodation registration — you usually need to register your address after moving. Confirm the exact steps with the International Student Office.', [
      [4, 2, 4, 'Did not know about that at all, thank you.', []],
    ]],
    [1, 3, 9, 'Photograph every room and every existing scratch before you move in, and send the photos to the landlord in WeChat so there is a timestamp.', []],
    [6, 6, 3, 'Check who pays for water, electricity and internet, and how the deposit is returned. Get it written in the contract.', []]]],

  ['study', 7, 'discussion', 30, 38, null,
   'Study group for Linear Algebra final — anyone?',
   'Thinking twice a week in the library, working through past problem sets together. English or Chinese both fine.',
   null,
   [[0, 2, 8, 'In. Tuesdays work best for me.', []],
    [5, 4, 6, '我也想参加，可以帮忙讲中文的部分。', [
      [7, 5, 4, 'Perfect, that is exactly what we need 🙏', []],
    ]],
    [3, 8, 2, 'Is this for the international section or the regular course?', [
      [7, 9, 1, 'International section, but anyone is welcome.', []],
    ]]]],

  ['language', 5, 'discussion', 14, 33, 'yuquan',
   '中英语言交换 · 找一位英语母语的语伴',
   '我是玉泉校区的研二学生，想练口语。可以帮你练中文（普通话），每周一到两次，校内咖啡店见面。\n\nLooking for an English speaker to swap an hour of English for an hour of Mandarin.',
   null,
   [[2, 1, 12, 'Hi! I am at Zijingang but happy to meet on Yuquan on Fridays. My Chinese is HSK 3-ish.', [
      [5, 2, 5, '太好了，已经加你微信 👍', []],
    ]],
    [8, 3, 4, 'Is there space for a second person? French native, decent English.', []]]],

  ['campus-life', 0, 'tip', 48, 74, null,
   'Things I wish I knew in my first month at ZJU',
   '1. Get a local phone number early, a lot of apps need it.\n2. The campus shuttle schedule is worth screenshotting.\n3. Say yes to the first club fair, even if you only go once.\n4. Keep digital copies of your passport and visa pages.\n5. When in doubt about official rules, ask the International Student Office, not a group chat.\n\nWhat would you add?',
   null,
   [[4, 3, 26, 'Buy a proper winter coat before December, not after. I learned this the hard way.', [
      [6, 5, 8, 'Hangzhou winters are damp, the cold gets in. Layers.', []],
    ]],
    [2, 6, 17, 'Learn to use the delivery apps with a friend the first time. Life-changing.', []],
    [9, 10, 12, '欢迎大家有问题随时问中国同学，大部分人都很乐意帮忙！', [
      [0, 11, 9, 'This is genuinely true. Thank you 🙏', []],
    ]],
    [1, 14, 5, 'Number 5 should be number 1.', []]]],

  ['sports', 6, 'event', 3, 19, 'zijingang',
   'Saturday badminton — 4 more players needed',
   'We have two courts booked this Saturday afternoon at the Zijingang sports centre. All levels welcome, bring your own racket if you have one.\n\nComment if you are coming so I know numbers.',
   null,
   [[3, 1, 5, 'Count me in, intermediate-ish.', []],
    [7, 1, 4, 'Coming with a friend, is that ok?', [
      [6, 2, 3, 'Of course!', []],
    ]]]],

  ['sports', 3, 'discussion', 11, 26, 'yuquan',
   'Ping pong before class — looking for a regular partner',
   'The tables in the Yuquan gym building are usually free before 9am. I am somewhere between beginner and bad, so there is no level to live up to here.\n\nComment if you want to fix a regular morning and we can sort out which days.',
   null,
   [[7, 2, 9, 'I am in on Tuesdays and Thursdays. Fair warning, I played in a school team, but I promise to go easy.', [
      [3, 3, 5, 'That is exactly the partner I need. See you Tuesday.', []],
    ]],
    [5, 5, 6, '我也经常早上去那边打，确实没什么人。可以一起。', []]]],

  ['sports', 2, 'event', 26, 31, 'zijingang',
   'Sunday football at Zijingang — mixed levels, always short a keeper',
   'We play most Sundays at 4pm. Usually a mix of international and Chinese students, usually about twelve of us, almost always missing a goalkeeper.\n\nNo need to commit to every week — come when you can.',
   null,
   [[0, 3, 12, 'Is this full pitch or small sided? Asking so I know how much embarrassment to prepare for.', [
      [2, 4, 8, 'Small sided, five or six a side. Nobody is embarrassing themselves, trust me.', []],
    ]],
    [8, 6, 7, 'Does anyone here play rugby or ultimate? Those are the ones I can never find numbers for.', [
      [2, 7, 5, 'Start a thread for it on this board — I know at least three people who would turn up.', []],
    ]]]],

  ['clubs', 4, 'question', 40, 37, null,
   'Which clubs actually take international students?',
   'Not which ones say they are open — which ones did you join and feel welcome in? My Chinese is still basic and I would rather hear it from someone who has done it.',
   null,
   [[9, 4, 19, '其实大部分社团都欢迎留学生，只是很少有人主动来问。建议直接去活动现场看看，比在群里发消息有用得多。', [
      [4, 6, 7, 'That is encouraging, thank you. I think I was overthinking it.', []],
    ]],
    [2, 7, 14, 'Photography, badminton and the volunteer societies all had someone who switched to English the moment I turned up. The academic ones were harder going.', []],
    [1, 12, 9, 'The club fair at the start of each semester is the easy way in: everyone is recruiting at once, and nobody minds you asking basic questions.', []]]],

  ['clubs', 7, 'event', 8, 22, 'zijingang',
   'Photography society open session on Thursday — no camera needed',
   'Thursday evening is an open session, so you can come without joining anything. A phone is fine; half the people bring nothing at all and just walk with us.\n\nComment if you are coming and I will message you the meeting point.',
   null,
   [[6, 1, 8, 'Coming. Do people shoot film too, or digital only?', [
      [7, 2, 6, 'A few shoot film — there is a darkroom session about once a month.', []],
    ]],
    [8, 4, 4, 'Is it alright to join halfway through the semester?', [
      [7, 5, 4, 'Any time. People come and go all year.', []],
    ]]]],

  ['clubs', 5, 'discussion', 18, 19, 'yuquan',
   '街舞社招新，欢迎留学生同学',
   '每周三、周日晚上在玉泉体育馆排练，零基础也可以来，前两次是免费体验。\n\nStreet dance club is recruiting — Wednesday and Sunday evenings, complete beginners welcome, first two sessions free.',
   null,
   [[6, 3, 7, 'Do I need to understand Chinese to follow the class?', [
      [5, 4, 6, '不用，跟着动作做就行，我们也会用英文讲一遍。Not at all — we explain it in English as well.', []],
    ]],
    [0, 9, 3, 'Signed up. First club post I have understood both halves of 😄', []]]],

  ['events', 8, 'event', 48, 28, 'yuquan',
   'International potluck next Friday — one dish from home each',
   'Someone organised this last year and it was the best evening of the semester. One dish each, and write what is in it on a card beside it so people know what they are eating.\n\nThe common room is booked from 6pm. Comment if you are bringing something, so we do not end up with nine desserts.',
   null,
   [[0, 5, 11, 'Brazilian here — I will bring pão de queijo. Easy to make in quantity and it disappears fast.', []],
    [9, 8, 9, '我带饺子，想学的话可以提前一起包。', [
      [8, 9, 6, 'Yes please. Can we make that part of the evening?', []],
    ]],
    [4, 20, 5, 'Nine desserts sounds fine to me, honestly.', []]]],

  ['careers', 2, 'question', 70, 29, null,
   'Part-time work or internships as an international student — what is allowed?',
   'I have heard different things from different people. Some say internships are fine with approval, some say not at all. Has anyone actually gone through the process?',
   null,
   [[9, 4, 21, 'Please do not rely on a forum for this one — ask the International Student Office directly. The rules depend on your visa type and whether the university approves it, and getting it wrong can affect your permit.', [
      [2, 6, 7, 'Fair. I will book a meeting with them.', []],
    ]],
    [0, 8, 6, 'I did an on-campus research assistant role with the department. The office handled the paperwork. Worth asking your supervisor about.', []]]],

  ['housing', 8, 'tip', 26, 45, null,
   'Setting up a dorm room on a budget',
   'Most of what you need is already on the Marketplace from students who are moving out. I got a desk, lamp and bedding for under ¥300 total.\n\nLinking the lamp I am passing on since I just got a better one.',
   'IKEA desk lamp, white — barely used',
   [[4, 2, 10, 'The marketplace + community combo is exactly how this should work.', []],
    [1, 5, 6, 'Also: a small power strip with a switch. Plugs are never where you want them.', []]]],

  ['study', 9, 'question', 52, 16, 'zhijiang',
   '有没有同学选过「国际商法」？考试难吗？',
   '下学期想选这门课，想了解一下考核方式和课程压力。英文授课的班级有什么需要注意的吗？',
   null,
   [[5, 3, 7, '我去年选过，平时作业占比比较高，期末是开卷。英文阅读量不小。', []],
    [2, 6, 3, 'Took the English section. Reading-heavy but the professor is very clear about what is on the exam.', []]]],

  ['food', 3, 'discussion', 96, 52, null,
   'West Lake on a weekday morning is a completely different place',
   'Went at 7am on a Wednesday. Almost empty, mist on the water, locals doing tai chi. If you have only been on a weekend you have not really seen it.',
   null,
   [[8, 5, 13, 'Bike around the whole lake early, then breakfast. Perfect morning.', []],
    [5, 10, 9, '推荐北山街，早上散步特别舒服。', []],
    [7, 20, 4, 'Adding this to my list, thanks.', []]]],

  ['campus-life', 7, 'question', 12, 11, 'zijingang',
   'Is there a quiet place to study late at night?',
   'The main library closes before I am done most days. Where do people go?',
   null,
   [[0, 2, 6, 'Some of the teaching buildings have classrooms open in the evening. Quiet and nobody minds.', []],
    [6, 3, 2, 'Check your college, some have their own study rooms with longer hours.', []]]],

  ['paperwork', 1, 'tip', 120, 58, null,
   'Opening a bank account — what made it easier for me',
   'Took me two tries. What worked the second time: going on a weekday morning, bringing passport + residence permit + student card + a local phone number, and having a Chinese-speaking friend come along.\n\nRequirements vary by bank and branch, so call ahead if you can.',
   null,
   [[4, 6, 19, 'The phone number part is key. They would not open it without one.', []],
    [3, 9, 8, 'Some branches near campus are used to international students, worth asking seniors which one.', [
      [1, 10, 5, 'Good point — ask in your college group, people usually know.', []],
    ]]]],

  ['events', 5, 'event', 30, 24, null,
   '周末去杭州植物园拍照，有人一起吗？',
   '周六上午出发，地铁过去，大概半天。欢迎带相机或者手机都行，主要是散步和拍照。\n\nPhotography walk at the botanical garden on Saturday morning, everyone welcome.',
   null,
   [[2, 2, 6, 'I would love to come! Meeting point?', [
      [5, 3, 4, '地铁站出口集合，我在群里发具体位置。', []],
    ]]]],

  ['study', 0, 'tip', 150, 40, null,
   'Free tools that got me through my first semester of courses in Chinese',
   'A pop-up dictionary browser extension for course websites, a flashcard app for the technical vocabulary of each course, and asking one Chinese classmate per course if I could compare notes after lectures.\n\nThe last one helped the most by far.',
   null,
   [[9, 5, 14, '很乐意帮国际同学对笔记，大家可以大胆开口问！', []],
    [7, 9, 7, 'Also: record lectures if the professor allows it. Ask first.', []]]],

  ['language', 2, 'question', 40, 13, 'zijingang',
   'Looking for a Mandarin speaking partner — Arabic or English in return',
   'HSK 4, want to get better at everyday conversation, not exam Chinese. Happy to teach Arabic or practise English.',
   null,
   [[9, 4, 5, '我对阿拉伯语很感兴趣！可以约时间聊聊。', []]]],

  ['careers', 6, 'discussion', 200, 21, null,
   'CV format for Chinese companies vs European ones',
   'Noticed Chinese job postings often expect a photo and more personal details on the CV, which is the opposite of what I was taught at home. How do people handle this?',
   null,
   [[5, 10, 11, '国内简历一般会放照片和基本信息，但也要看公司，外企会更接近国际格式。', []],
    [8, 20, 5, 'I keep two versions and pick based on the company. Only share what you are comfortable with.', []]]],

  ['housing', 9, 'question', 7, 8, 'zhijiang',
   '之江校区附近有推荐的短租吗？',
   '暑假有一个月需要留在杭州，宿舍不能住，想找一个短租的地方。',
   null,
   [[1, 2, 3, '可以问问学长学姐，暑假有不少人转租，但一定要确认房东同意并签书面协议。', []]]],

  ['campus-life', 4, 'discussion', 80, 35, 'haining',
   'Haining campus appreciation post 🌿',
   'Smaller than the Hangzhou campuses but honestly the most beautiful. The lake at sunset is unreal.',
   null,
   [[0, 5, 12, 'Biased because I live here, but yes.', []],
    [3, 12, 3, 'Visiting next month, any must-sees?', [
      [4, 13, 5, 'The library building and the walk around the lake. Go at sunset.', []],
    ]]]],

  ['study', 3, 'question', 2, 3, null,
   'Where do people find past exam papers?',
   'Some courses seem to have them floating around, some do not. Is there an official place?',
   null,
   []],
];

async function main() {
  await migrate();
  const users = await q('SELECT id FROM "user" ORDER BY created_at');
  if (users.length < 10) { console.error('Run seed.mjs first (needs the 10 demo users).'); process.exit(1); }
  const listingByTitle = Object.fromEntries(
    (await q('SELECT id, title FROM listing WHERE deleted_at IS NULL')).map((r) => [r.title, r.id]));

  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  let posts = 0, comments = 0;

  await tx(async (c) => {
    /* Posts, comments and votes are re-seeded; the boards are not. They are
       reference data that migrate() keeps in step with content/boards.mjs, and
       deleting them here would renumber every board id for no reason. */
    await c.query('DELETE FROM comment_vote; DELETE FROM post_vote; DELETE FROM comment; DELETE FROM post;');
    const boardIds = Object.fromEntries(
      (await c.query('SELECT slug, id FROM board')).rows.map((r) => [r.slug, r.id]));
    for (const [slug] of BOARDS) {
      if (!boardIds[slug]) throw new Error(`board "${slug}" is missing — did migrate() run?`);
    }

    for (const row of POSTS) {
      if (row.length !== 10) throw new Error(`post row has ${row.length} fields: ${row[6]}`);
      const [board, author, kind, hoursAgo, score, campus, title, body, listingTitle, tree] = row;
      const postId = uid();
      const count = (list) => list.reduce((n, cm) => n + 1 + count(cm[4]), 0);
      await c.query(
        `INSERT INTO post (id, board_id, user_id, kind, title, body, campus, listing_id, score, comment_count, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [postId, boardIds[board], users[author].id, kind, title, body, campus,
         listingTitle ? listingByTitle[listingTitle] || null : null, score, count(tree), ago(hoursAgo)]);
      posts++;
      const insert = async (list, parentId) => {
        for (const [who, after, cscore, text, replies] of list) {
          const id = uid();
          await c.query(
            `INSERT INTO comment (id, post_id, parent_id, user_id, body, score, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [id, postId, parentId, users[who].id, text, cscore, ago(Math.max(0.1, hoursAgo - after))]);
          comments++;
          await insert(replies, id);
        }
      };
      await insert(tree, null);
    }
  });
  console.log(`Seeded ${BOARDS.length} boards, ${posts} posts, ${comments} comments.`);
  await pool.end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
