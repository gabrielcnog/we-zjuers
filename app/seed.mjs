/* Dummy data. Deliberately includes one seller who posts eight books in a row,
   so the diversity sort has something real to fix on the home feed. */
import { pool, tx, migrate, uid, now } from './db.mjs';
import { clearRefCache } from './lib/queries.mjs';
import { pathToFileURL } from 'node:url';
import { itemArt } from './lib/artwork.mjs';

const iso = (daysAgo, h = 0) => new Date(Date.now() - daysAgo * 864e5 - h * 36e5).toISOString();

const CAMPUSES = [
  ['zijingang','Zijingang','紫金港校区',1], ['yuquan','Yuquan','玉泉校区',2],
  ['xixi','Xixi','西溪校区',3], ['huajiachi','Huajiachi','华家池校区',4],
  ['zhijiang','Zhijiang','之江校区',5], ['haining','Haining International','海宁国际校区',6],
  ['zhoushan','Zhoushan','舟山校区',7], ['off_campus','Off-campus','校外',8],
];
const CATEGORIES = [
  ['electronics','Electronics','电子产品','💻',1,'#0A6BD1'],
  ['furniture','Furniture','家具','🪑',2,'#8A5A2B'],
  ['bikes','Bicycles & E-scooters','自行车 / 电动车','🚲',3,'#1B7F4B'],
  ['books','Books & Study','书籍 / 学习','📚',4,'#7A3E9D'],
  ['clothing','Clothing & Shoes','服装鞋帽','🧥',5,'#B01F24'],
  ['kitchen','Kitchen & Appliances','厨房 / 电器','🍳',6,'#C2410C'],
  ['sports','Sports & Outdoors','运动 / 户外','🏸',7,'#0E7490'],
  ['household','Dorm & Household','宿舍 / 日用','🧺',8,'#4B5563'],
  ['free','Free / Giveaway','免费赠送','🎁',9,'#166534'],
  ['services','Services','技能服务','🛠',10,'#7A5EA8'],
  ['other','Other','其他','📦',11,'#5B6572'],
];
const LANGUAGES = [
  ['zh','Chinese (Mandarin)','中文',1], ['en','English','英语',2], ['yue','Cantonese','粤语',3],
  ['ko','Korean','韩语',4], ['ja','Japanese','日语',5], ['ru','Russian','俄语',6],
  ['fr','French','法语',7], ['es','Spanish','西班牙语',8], ['pt','Portuguese','葡萄牙语',9],
  ['de','German','德语',10], ['it','Italian','意大利语',11], ['ar','Arabic','阿拉伯语',12],
  ['ur','Urdu','乌尔都语',13], ['hi','Hindi','印地语',14], ['bn','Bengali','孟加拉语',15],
  ['id','Indonesian / Malay','印尼语 / 马来语',16], ['th','Thai','泰语',17],
  ['vi','Vietnamese','越南语',18], ['fa','Persian','波斯语',19], ['tr','Turkish','土耳其语',20],
];

const USERS = [
  ['Gabriel N.','demo@we-zjuers.com','haining',['en','pt','zh','es'],'gabriel_n_zjuers_demo',1],
  ['Mei L.','meil@example.com','zijingang',['zh','en'],'mei_l_zjuers_demo',1],
  ['Aisha R.','aisha@example.com','zijingang',['en','ur','ar'],'aisha_r_zjuers_demo',1],
  ['Kenji T.','kenji@example.com','yuquan',['ja','en','zh'],'kenji_t_zjuers_demo',1],
  ['Sofia M.','sofia@example.com','haining',['es','en','pt'],'sofia_m_zjuers_demo',1],
  ['Wang Hao','wanghao@example.com','yuquan',['zh','yue'],'hao_w_zjuers_demo',1],
  ['Dmitri K.','dmitri@example.com','xixi',['ru','en'],'dmitri_k_zjuers_demo',1],
  ['Ji-woo P.','jiwoo@example.com','zijingang',['ko','en','zh'],'jiwoo_p_zjuers_demo',1],
  ['Nadia B.','nadia@example.com','off_campus',['fr','ar','en'],'nadia_b_zjuers_demo',0],
  ['Chen Yu','chenyu@example.com','zhijiang',['zh','en'],'yu_c_zjuers_demo',1],
];

/* [title_en, category, price(¥ or 'free'/'neg'), condition, campus, sellerIdx, daysAgo, desc] */
const LISTINGS = [
  ['IKEA desk lamp, white — barely used','electronics',80,'like_new','zijingang',1,0,'Bought last September, used maybe twice. Works perfectly, warm light. Collection from the east gate any evening.'],
  ['宜家 MALM 书桌 · 140x65','furniture',280,'good','zijingang',5,0,'搬家出售，桌面有轻微使用痕迹，结构很稳。需要自己搬走，我可以帮忙抬到楼下。'],
  ['Giant ATX 660 bicycle, 26"','bikes',350,'good','yuquan',3,1,'Two years old, recently serviced — new brake pads and chain. Lock and lights included. Riding it until it sells.'],
  ['Moving out — kitchen things, all must go','free','free','good','yuquan',5,1,'Pots, pans, plates, a wok, cutlery, a chopping board. All clean and working. Take everything or take one thing.'],
  ['Dell U2419H 24" monitor','electronics',620,'like_new','haining',0,2,'IPS, 1080p, height adjustable. HDMI and DisplayPort cables included. No dead pixels — happy to show you before you buy.'],
  ['Chinese textbook set (HSK 1–4)','books',120,'good','zijingang',2,2,'Complete set with workbooks. Some pencil notes in HSK 1 and 2, the rest are clean. Great if you are starting Chinese.'],
  ['Xiaomi electric kettle 1.5L','kitchen',45,'like_new','zijingang',7,3,'Boils fast, keeps warm. Just replaced it with a bigger one.'],
  ['Winter coat, men\'s L — very warm','clothing',180,'good','yuquan',3,3,'Survived two Hangzhou winters. Down filled, hood detaches. No stains or tears.'],
  ['Badminton racket + case (Yonex)','sports',90,'good','zijingang',7,4,'Restrung in September. Comes with a case and three shuttles.'],
  ['折叠桌 · 宿舍适用','furniture',60,'good','xixi',6,4,'折叠后很薄，可以塞进床底。放笔记本和书正好。'],
  ['Rice cooker, 3 cup — Zojirushi','kitchen',150,'like_new','haining',4,5,'Japanese brand, makes excellent rice. Manual is in Japanese but the buttons are obvious.'],
  ['Study chair with lumbar support','furniture',220,'good','zijingang',1,5,'Comfortable for long sessions. Height and tilt both adjust. Small scuff on one armrest.'],
  ['Free: assorted stationery and folders','free','free','fair','zijingang',2,6,'Leftovers from two years of coursework. Notebooks with a few pages used, folders, highlighters.'],
  ['Suitcase 28" — one trip only','other',260,'like_new','haining',4,6,'Hard shell, four wheels, TSA lock. Bought for one flight and then I stopped travelling.'],
  ['Mechanical keyboard, brown switches','electronics',300,'good','yuquan',9,7,'87 keys, USB-C, PBT keycaps. Quiet enough for a shared room.'],
  ['电风扇 · 静音','household',55,'good','yuquan',5,7,'夏天用了一季，很安静。三档风速。'],
  ['Yoga mat + resistance bands','sports','neg',null,'zijingang',2,8,'Barely used. Make me an offer, I just want it gone before I fly.'],
  ['Desk organiser and shelf set','household',40,'good','xixi',6,8,'Fits a standard dorm desk. Keeps everything off the surface.'],
  ['Hair dryer, 1800W','household',35,'good','zijingang',7,9,'Two heat settings, folds for packing.'],
  ['Road bike helmet, size M','bikes',70,'like_new','yuquan',3,9,'Never crashed in it. Adjustable strap, good ventilation.'],
  ['Mattress topper, single','household',90,'good','haining',0,10,'Makes the dorm mattress genuinely comfortable. Washed and ready.'],
  ['Instant Pot 5L','kitchen',280,'like_new','zijingang',1,10,'Used maybe ten times. Pressure cooker, rice, yoghurt. All parts present.'],
  ['小米台灯 · 可调色温','electronics',65,'good','zhijiang',9,11,'护眼台灯，色温可调。用了一年，功能都正常。'],
  ['Running shoes, EU 42 — Asics','clothing',150,'good','yuquan',3,11,'About 200km on them. Still plenty of cushioning left.'],
  ['Portable induction hob','kitchen',110,'good','xixi',6,12,'Single ring, good for a dorm kitchen. Works with the pan I am also selling.'],
  ['Dumbbells 2x5kg','sports',80,'good','zijingang',7,12,'Rubber coated, no rust. Heavy to post, so campus pickup only.'],
  ['Free: half a bookshelf of novels','free','free','fair','xixi',6,13,'English and Chinese, mixed. Take what you like, no need to take all.'],
  ['Canon EOS 200D + kit lens','electronics','neg','good','haining',4,13,'Shutter count around 8,000. Bag, strap, two batteries and a charger.'],
  ['Winter duvet, 200x230','household',120,'like_new','zijingang',2,14,'Warm enough for January here. Washed, stored in a vacuum bag.'],
  ['Electric scooter — Ninebot','bikes',900,'good','yuquan',9,15,'Range about 25km. Legal for campus paths. Charger included.'],
];

/* Eight books from one seller on the same day. Newest-first would put all of
   them at the top of the feed; the diversity sort is what stops that. */
/* Services. Deliberately all things a student can legitimately offer: teaching,
   translating, building, fixing. Nothing that does someone's coursework for
   them — see the note on the rules page. */
const SERVICES = [
  ['Chinese ⇄ English document translation','services','neg','na','zijingang',1,0,
   'Native Chinese, C1 English. Certificates, transcripts, rental contracts, official letters. ¥60 per page as a guide, less for longer jobs. Usually same-day.'],
  ['Maths & physics tutoring — first-year courses','services',80,'na','yuquan',3,1,
   'Second-year engineering student. Calculus, linear algebra, mechanics. ¥80 an hour, in the library or online. First session free so you can see whether it helps.'],
  ['Website & landing page development','services','neg','na','haining',0,1,
   'I build small sites for student clubs and side projects — portfolio, event page, simple shop. HTML/CSS/JS or WordPress. Show me what you need and I will quote.'],
  ['CV and cover letter design','services',120,'na','zijingang',4,2,
   'Layout, typography and structure — not writing your experience for you. Good for internship applications. You send the content, I make it read well on one page. Two rounds of edits.'],
  ['Bike repair and tune-up','services',50,'na','yuquan',5,3,
   'Brakes, gears, punctures, chains. ¥50 for a full tune-up, ¥20 for a puncture. I come to you on campus — bring the bike to the east gate.'],
  ['Portrait & graduation photos','services',200,'na','zijingang',7,4,
   'Graduation, visa photos, LinkedIn portraits. One hour, around 30 edited shots. I bring my own camera and lights.'],
  ['视频剪辑 · 短片与 Vlog','services','neg','na','xixi',9,5,
   '剪辑、调色、字幕（中英双语）。社团活动、毕业视频、Vlog 都可以。按项目报价，先看素材再谈。'],
  ['IELTS speaking practice partner','services',60,'na','haining',2,6,
   'Band 8 speaking. Timed part 2 and part 3 practice with feedback afterwards. ¥60 an hour. Practice only — not a substitute for a course.'],
];

const BOOK_DUMP = [
  'Principles of Economics (Mankiw), 8th ed','Linear Algebra and Its Applications',
  'Organic Chemistry (Clayden)','International Business (Hill)',
  'Introduction to Machine Learning','汉语教程 第二册','Statistics for Business and Economics',
  'Cross-Cultural Management (Hofstede reader)',
];

const ART_RULES = [
  /* Services first: several mention an object ("bike repair", "document
     translation") that a later rule would otherwise claim. */
  [/translat|翻译/i,                              'translate'],
  [/tutor|tutoring|lesson|ielts|辅导|口语/i,        'tutoring'],
  [/website|web design|landing page|建站|网站/i,    'webdev'],
  [/\bcv\b|resume|cover letter|简历/i,            'cvdesign'],
  [/repair|tune-up|fixing|维修/i,                 'repair'],
  [/video edit|剪辑/i,                            'camera'],
  [/portrait|photograph|摄影/i,                   'camera'],
  [/helmet/i,                                   'helmet'],
  [/lamp|台灯/i,                                 'lamp'],
  [/monitor|display/i,                          'monitor'],
  [/keyboard/i,                                 'keyboard'],
  [/canon|eos|camera/i,                         'camera'],
  [/scooter|ninebot/i,                          'scooter'],
  [/textbook|\bbooks?\b|novel|hsk|教程|economics|algebra|chemistry|machine learning|statistics|management|reading list/i, 'books'],
  [/shelf|organiser|organizer|bookshelf/i,      'shelf'],
  [/bicycle|\bbike\b|自行车/i,                   'bike'],
  [/kettle|水壶/i,                               'kettle'],
  [/rice cooker|cooker/i,                       'cooker'],
  [/instant pot/i,                              'pot'],
  [/induction|\bhob\b/i,                        'hob'],
  [/kitchen|pots|pans|锅/i,                      'pots'],
  [/coat|jacket/i,                              'coat'],
  [/racket|badminton/i,                         'racket'],
  [/chair/i,                                    'chair'],
  [/stationery|folder|文具/i,                     'stationery'],
  [/suitcase|luggage/i,                         'suitcase'],
  [/\bfan\b|电风扇/i,                            'fan'],
  [/yoga|resistance band/i,                     'yoga'],
  [/dryer|hair/i,                               'dryer'],
  [/duvet|mattress|topper|bedding|被/i,          'bedding'],
  [/shoes|sneaker|asics|running/i,              'shoes'],
  [/dumbbell|weights/i,                         'dumbbell'],
  [/desk|table|书桌|折叠桌/i,                      'desk'],
  [/giveaway|free:/i,                           'gift'],
];
const CATEGORY_ART = {
  electronics:'monitor', furniture:'desk', bikes:'bike', books:'books',
  clothing:'coat', kitchen:'pots', sports:'dumbbell', household:'box',
  free:'gift', services:'tutoring', other:'box',
};
export function artKindFor(title, slug) {
  for (const [re, kind] of ART_RULES) if (re.test(title)) return kind;
  return CATEGORY_ART[slug] || 'box';
}

export async function seed() {
  await migrate();
  await tx(async (c) => {
    // Order matters: children first, or the foreign keys refuse.
    for (const t of ['message','conversation','favorite','listing_image','listing',
                     'user_language','session','login_code','report','"user"',
                     'category','campus','language'])
      await c.query(`DELETE FROM ${t}`);

    for (const [code, en, zh, o] of CAMPUSES)
      await c.query('INSERT INTO campus VALUES ($1,$2,$3,$4)', [code, en, zh, o]);
    for (const [code, en, zh, o] of LANGUAGES)
      await c.query('INSERT INTO language VALUES ($1,$2,$3,$4)', [code, en, zh, o]);

    const catId = {};
    for (const [slug, en, zh, icon, o] of CATEGORIES) {
      const id = uid(); catId[slug] = id;
      await c.query('INSERT INTO category VALUES ($1,$2,$3,$4,$5,$6)', [id, slug, en, zh, icon, o]);
    }

    const userIds = [];
    for (const [i, [name, email, campus, langs, wechat, verified]] of USERS.entries()) {
      const id = uid(); userIds.push(id);
      await c.query(`INSERT INTO "user" (id,email,email_verified_at,is_zju_verified,display_name,
        home_campus,wechat_id,locale,created_at,last_seen_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, email, iso(200), !!verified, name, campus, wechat,
         ['zh','yue'].includes(langs[0]) ? 'zh' : 'en', iso(200 - i * 12), iso(0, i)]);
      for (const l of langs)
        await c.query('INSERT INTO user_language VALUES ($1,$2)', [id, l]);
    }

    let n = 0;
    const PHOTO_COUNTS = [1, 3, 2, 4, 1, 2, 3, 1, 4, 2];
    const insert = async (title, slug, price, cond, campus, sellerIdx, daysAgo, desc) => {
      const id = uid();
      const priceType = price === 'free' ? 'free' : price === 'neg' ? 'negotiable' : 'fixed';
      const cents = priceType === 'fixed' ? price * 100 : null;
      const ts = iso(daysAgo, (n * 7) % 24);
      await c.query(`INSERT INTO listing (id,user_id,category_id,title,description,price_type,price_cents,
        condition,campus,meetup_note,status,published_at,expires_at,bumped_at,view_count,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12,$13,$14,$15,$16)`,
        [id, userIds[sellerIdx], catId[slug], title, desc || '', priceType, cents,
         cond === 'na' ? null : (cond || 'good'), campus, null, ts,
         new Date(Date.now() + (30 - daysAgo) * 864e5).toISOString(), ts,
         (n * 13) % 90, ts, ts]);
      const kind = artKindFor(title, slug);
      const shots = PHOTO_COUNTS[n % PHOTO_COUNTS.length];
      for (let v = 0; v < shots; v++)
        await c.query(`INSERT INTO listing_image (id,listing_id,mime,data,width,height,sort_order,created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uid(), id, 'image/svg+xml', itemArt(kind, n, v), 400, 300, v, ts]);
      n++;
      return id;
    };

    LISTINGS.forEach((l, i) => {
      if (l.length !== 8) throw new Error(`Seed row ${i} ("${l[0]}") has ${l.length} fields, expected 8`);
    });
    LISTINGS.concat(SERVICES).forEach((l, i) => {
      if (l.length !== 8) throw new Error(`Seed row ${i} ("${l[0]}") has ${l.length} fields, expected 8`);
    });
    const listingIds = [];
    for (const l of LISTINGS) listingIds.push(await insert(...l));
    for (const l of SERVICES) listingIds.push(await insert(...l));
    for (const title of BOOK_DUMP)
      listingIds.push(await insert(title, 'books', 30 + listingIds.length * 10, 'good', 'zijingang', 2, 0,
        'Selling my whole course reading list before I graduate. Message me if you want several — happy to do a deal.'));

    const soldId = await insert('Kettle (sold)', 'kitchen', 40, 'good', 'haining', 0, 20, 'Went quickly.');
    await c.query("UPDATE listing SET status='sold' WHERE id = $1", [soldId]);
    const expId = await insert('Old office chair', 'furniture', 100, 'fair', 'haining', 0, 40, 'Nobody wanted it.');
    await c.query("UPDATE listing SET status='expired', expires_at=$1 WHERE id = $2", [iso(5), expId]);

    const convo = async (listingId, buyerIdx, sellerIdx, msgs) => {
      const id = uid(), start = iso(1, 6);
      await c.query(`INSERT INTO conversation (id,listing_id,buyer_id,seller_id,created_at,last_message_at)
                     VALUES ($1,$2,$3,$4,$5,$5)`, [id, listingId, userIds[buyerIdx], userIds[sellerIdx], start]);
      for (const [i, [who, body]] of msgs.entries()) {
        const ts = new Date(Date.parse(start) + i * 9e5).toISOString();
        await c.query('INSERT INTO message (id,conversation_id,sender_id,body,created_at,read_at) VALUES ($1,$2,$3,$4,$5,$6)',
          [uid(), id, userIds[who], body, ts, i < msgs.length - 1 ? ts : null]);
        await c.query('UPDATE conversation SET last_message_at = $1 WHERE id = $2', [ts, id]);
      }
    };
    await convo(listingIds[0], 0, 1, [[0,'Hi! Is the lamp still available?'],[1,'Yes it is — I am at Zijingang most evenings this week.'],[0,'Great. Could we meet Thursday around 7?'],[1,'Thursday 7 works. East gate?']]);
    await convo(listingIds[4], 2, 0, [[2,'Would you take ¥550 for the monitor?'],[0,'I could do ¥580 if you can collect this weekend.']]);
    await convo(listingIds[3], 7, 5, [[7,'是不是还有锅可以拿？'],[5,'还有一个炒锅和两个小锅，你什么时候方便？']]);

    for (const [u, l] of [[0,2],[0,5],[0,9],[2,0],[3,4]])
      await c.query('INSERT INTO favorite (user_id,listing_id,created_at) VALUES ($1,$2,$3)',
        [userIds[u], listingIds[l], now()]);

    seedResult = { users: userIds.length, listings: n, demoEmail: USERS[0][1] };
  });
  clearRefCache();
  return seedResult;
}
let seedResult = null;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then((r) => {
      console.log(`Seeded ${r.users} sellers and ${r.listings} listings.`);
      console.log(`Demo sign-in: ${r.demoEmail}`);
      return pool.end();
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
