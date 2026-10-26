# Product specification

## Who it's for

**Primary:** international students at ZJU, who arrive with nothing, leave with
a dorm full of things, and currently sell via WeChat groups that scroll away.

**Secondary:** Chinese students at ZJU. Xianyu (闲鱼) exists and is excellent,
but it is nationwide, requires Alipay real-name binding, and assumes shipping. A
campus board competes on proximity, not on catalogue size.

**Not for:** dealers, businesses, anyone off-campus. No B2C listings.

## Why it exists

ZJU has no official channel for this. The substitutes all leak:

| Today | Where it fails |
|---|---|
| WeChat group chats | Posts scroll away in hours. No search, no categories, no history. |
| Xianyu (闲鱼) | Nationwide and shipping-first; needs Alipay + Chinese real-name ID, which many international students don't have. |
| Departure-season bulletin posts | One-shot, no discovery, no way to browse what's available now. |
| Physical noticeboards | Invisible to anyone not walking past. |

## Non-goals

State these plainly and defend them — every one of them is a thing that would
double the build:

- **No payments.** No escrow, no wallet, no Alipay/WeChat Pay integration.
- **No shipping or logistics.** Campus hand-off only.
- **No ratings or reputation scores** in v1. They need volume to mean anything,
  and they invite retaliation disputes with no staff to arbitrate.
- **No paid promotion, no ads, no premium tier.** Ever — this is the stated
  intent, and it should be visible on the About page.
- **No mobile app.** A responsive website, installable as a PWA.

## Pages

| # | Page | What it does |
|---|---|---|
| 1 | **Home** | Latest active listings, newest first. Category chips and a campus filter. This is the discovery surface — most visits should end here or one click away. |
| 2 | **Search results** | Query + filters: category, price range, campus, condition. Sort by newest / price. |
| 3 | **Listing detail** | Photo gallery, price, condition, description, campus, seller card, contact action. |
| 4 | **Create / edit listing** | One form, photos first. Should be completable on a phone in under 90 seconds. |
| 5 | **My listings** | Active / sold / expired tabs. Edit, mark sold, renew, delete. |
| 6 | **Messages** | Inbox of threads, each scoped to one listing. |
| 7 | **Public profile** | Display name, home campus, languages spoken, their active listings, member since. This is what a buyer checks before messaging a stranger. |
| 7b | **Settings** | Home campus, languages, WeChat ID (private), interface language, theme, account deletion. |
| 8 | **Sign in** | Email + 6-digit code. No password. |
| 9 | **Saved items** | Favourites. Cheap to build, and it's the signal that tells you which listings are working. |
| 10 | **Rules & safety** | Prohibited items, meet-in-public guidance, how to report. Static. |
| 11 | **Admin** | Report queue, hide a listing, suspend a user. Unstyled is fine. |

## Global page furniture

Present on every page, in this order:

1. **Disclaimer strip** — slim, persistent, bilingual: *an independent student
   project, not an official ZJU platform*. Wording and styling in
   [decisions.md](decisions.md). It is not dismissible, because most visitors
   will arrive on a single listing from a shared link and never see the homepage.
2. **Header** — own wordmark (not the ZJU seal), search bar, EN/中文 switch,
   theme switch, sign-in or avatar.
3. **Footer** — the full disclaimer sentence, rules and safety, about, contact.

## Categories

Ten, flat, no subcategories. More categories means emptier categories.

| Slug | EN | 中文 |
|---|---|---|
| `electronics` | Electronics | 电子产品 |
| `furniture` | Furniture | 家具 |
| `bikes` | Bicycles & E-scooters | 自行车 / 电动车 |
| `books` | Books & Study | 书籍 / 学习 |
| `clothing` | Clothing & Shoes | 服装鞋帽 |
| `kitchen` | Kitchen & Appliances | 厨房 / 电器 |
| `sports` | Sports & Outdoors | 运动 / 户外 |
| `household` | Dorm & Household | 宿舍 / 日用 |
| `free` | Free / Giveaway | 免费赠送 |
| `other` | Other | 其他 |

`free` earns its place: departing students give away more than they sell, and a
giveaway feed is the cheapest way to make the site feel alive in week one.

## Campuses

| Slug | EN | 中文 |
|---|---|---|
| `zijingang` | Zijingang | 紫金港校区 |
| `yuquan` | Yuquan | 玉泉校区 |
| `xixi` | Xixi | 西溪校区 |
| `huajiachi` | Huajiachi | 华家池校区 |
| `zhijiang` | Zhijiang | 之江校区 |
| `haining` | Haining International | 海宁国际校区 |
| `zhoushan` | Zhoushan | 舟山校区 |
| `off_campus` | Off-campus | 校外 |

Confirm this list against ZJU's current campus structure before building.

### Campus appears in two places, and they mean different things

- **On the seller's profile — their home campus.** Where they are based. It is
  the default for anything they list, and it tells a buyer roughly where this
  person is, in general.
- **On the listing — where the item is.** Pre-filled from the profile, but
  **always editable**. Someone moving out, storing a bike at a friend's, or
  selling from an internship in another city has an item that is not where they
  are. A campus field that can't be overridden produces confidently wrong data.

Both are shown. When a listing's campus differs from the seller's, show the
listing's — it's the one that decides whether the buyer can collect it.

**Where it surfaces:** a campus badge on every listing card, on the listing
detail near the price, on the seller card, and as a filter on Home and Search.

## Languages spoken

The field that makes this different from a generic classifieds board. Before
messaging a stranger about a fridge, an international student wants to know
whether the conversation is going to work at all.

**Framing: "Languages I can do a deal in."** Phrased that way, and with **no
proficiency levels** — self-reported CEFR grades are noise, they add a dimension
to every filter, and the only question that matters is binary: can you two
complete a transaction or not? The framing self-selects for adequate fluency
without a level picker.

**A curated list, not free text.** Free text fragments the filter instantly —
"Portuguese", "português", "PT-BR", "brazilian" all become separate values and
nothing matches. Starting list, to be tuned against actual ZJU enrolment:

Chinese (Mandarin) 中文 · English · Cantonese 粤语 · Korean 한국어 ·
Japanese 日本語 · Russian Русский · French Français · Spanish Español ·
Portuguese Português · German Deutsch · Italian Italiano · Arabic العربية ·
Urdu اردو · Hindi हिन्दी · Bengali বাংলা · Indonesian/Malay ·
Thai ไทย · Vietnamese Tiếng Việt · Persian فارسی · Turkish Türkçe ·
Other

**Where it surfaces:** chips on the public profile and on the seller card of a
listing. **Not on listing cards** — a 2-up mobile card that shows campus, price,
title *and* five language chips shows nothing at all.

**As a search filter: yes, but never on by default.** It's a genuine need, and
it also narrows an already-small market fast. Off by default, and framed as
"seller speaks…" rather than as a hard requirement.

*One note worth keeping in view:* language is adjacent to nationality, and a
language filter can be used as a proxy for one. It stays, because the practical
need in a bilingual marketplace is real — but that is the reason there is no
nationality or country field anywhere in this product, and there should not be.

**This is a distinct concept from interface language.** `locale` is which UI you
read; `spoken_languages` is who you can deal with. Someone may read the site in
English and negotiate in Chinese.

## Listing lifecycle

    draft → active (30 days) → expired
                 ↓         ↘
              sold        renewed (back to 30 days)
                 ↓
             removed (by owner or admin)

Auto-expiry at 30 days is not optional. Without it the feed fills with items
sold months ago and the whole thing stops being trustworthy — this is the single
most common failure of small classified sites. Email the owner at day 27:
*still available?* One click renews.

## Listing fields

- **Title** (required, ≤ 80 chars)
- **Category** (required)
- **Price** — fixed amount in CNY, or *Negotiable* 面议, or *Free* 免费
- **Condition** — New 全新 / Like new 几乎全新 / Good 良好 / Fair 一般 / For parts 配件
- **Description** (≤ 2000 chars)
- **Campus** (required, defaults to the seller's home campus, editable) +
  optional meet-up note ("east gate, evenings")
- **Photos** — 1 required, 6 maximum

## v1 scope

**In:**
sign-in, create/edit/delete listing, photo upload, home feed, category and
campus filter, search with filters, listing detail, public profile, my listings,
mark sold, 30-day auto-expiry with day-27 renew email, favourites, in-app
messaging, report, admin queue, EN/中文 switch, light/dark/system theme switch,
responsive down to 320px.

Home campus and languages spoken are captured at sign-up — two questions, both
skippable, both promptable later. Asking on the way in is the only moment anyone
fills in a profile.

**Deliberately out of v1:**
WeChat login, realtime chat, push notifications, "wanted" posts, price history,
saved searches with alerts, ratings, a native app.

**Definition of done for v1:** a student can list a desk lamp from their phone in
90 seconds, and another student can find it by browsing Home, filtering to their
campus, and messaging the seller — without either of them leaving the site or
reading instructions. It works the same in Chinese, in dark mode, on a 320px
screen.

See [interface.md](interface.md) for how the language switch, the theme switch,
and the responsive rules are specified.
