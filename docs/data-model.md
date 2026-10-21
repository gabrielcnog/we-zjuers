# Data model

PostgreSQL. Snake case, `id` as UUID, timestamps in UTC with time zone.
Money is stored as **integer cents of CNY** — never a float.

## Entities

    user ──< listing ──< listing_image
     │         │
     │         ├──< favorite >── user
     │         │
     │         └──< conversation ──< message
     │                   │
     └───────────────────┘
    report ──> (listing | user | message)

### user

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `email` | citext unique | Never exposed to other users |
| `email_verified_at` | timestamptz | |
| `is_zju_verified` | boolean | Derived from email domain at verification time |
| `display_name` | text | |
| `avatar_key` | text null | R2 object key |
| `home_campus` | text null | Where they're based. Default for new listings, shown on the profile |
| `spoken_languages` | text[] | Curated codes, e.g. `{en,zh,pt}`. GIN index for the filter. No proficiency level — see product-spec.md |
| `wechat_id` | text null | **Private.** Revealed only by explicit action in a thread |
| `locale` | text | `en` \| `zh`. **Interface + email language only** — not the same thing as `spoken_languages`. A user may read English and deal in Chinese |
| `role` | text | `user` \| `admin` |
| `status` | text | `active` \| `suspended` |
| `created_at`, `last_seen_at` | timestamptz | |

No `theme` column, deliberately: theme is per-device (dark on the phone, light on
a laptop) and has to apply before first paint, which a database round-trip cannot
do. It lives in `localStorage`. `locale` *is* stored, because emails need to know
which language to use.

No nationality or country column, also deliberately — see product-spec.md.

### session

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk | |
| `token_hash` | text | Store the hash, never the token |
| `expires_at` | timestamptz | 30 days, sliding |
| `user_agent`, `ip` | text | For the user's own session list |

### login_code

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `email` | citext | |
| `code_hash` | text | |
| `expires_at` | timestamptz | 10 minutes |
| `attempts` | int | Lock after 5 — otherwise a 6-digit code is brute-forceable |
| `consumed_at` | timestamptz null | |

### category

Seeded, not user-created. `id`, `slug`, `name_en`, `name_zh`, `icon`,
`sort_order`. A nullable `parent_id` costs nothing now and leaves room for
subcategories later.

### campus, language

Both seeded reference tables, same shape: `code`, `name_en`, `name_zh`,
`sort_order`. They are tables rather than string enums because **every label on
this site has to exist in two languages**, and an enum forces that mapping into
application code where it drifts. `listing.campus` and `user.home_campus` store
the `code`.

### listing

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk | |
| `category_id` | uuid fk | |
| `title` | text | ≤ 80 chars |
| `description` | text | ≤ 2000 chars |
| `price_type` | text | `fixed` \| `negotiable` \| `free` |
| `price_cents` | int null | Null unless `fixed` |
| `condition` | text | `new` \| `like_new` \| `good` \| `fair` \| `parts` |
| `campus` | text | Where the **item** is. Defaults from `user.home_campus`, always editable |
| `meetup_note` | text null | |
| `status` | text | `draft` \| `active` \| `sold` \| `expired` \| `removed` |
| `published_at` | timestamptz null | |
| `expires_at` | timestamptz null | `published_at + 30 days` |
| `bumped_at` | timestamptz null | Feed sorts on this, not `created_at`, so renewing works |
| `view_count` | int | Denormalised; increment async |
| `search_vector` | tsvector / trigram idx | See architecture.md on Chinese tokenisation |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | Soft delete |

Indexes: `(status, bumped_at desc)` for the feed —
`(status, category_id, bumped_at desc)` and `(status, campus, bumped_at desc)`
for the filters. These three carry almost every query on the site. The
seller-language filter joins through `user.spoken_languages` (GIN); it is the
rarest filter, so it does not get its own composite index.

### listing_image

`id`, `listing_id` fk, `storage_key`, `width`, `height`, `blurhash`,
`sort_order`, `created_at`. Position 0 is the cover.

### favorite

Composite pk `(user_id, listing_id)` + `created_at`. Nothing more.

### conversation

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `listing_id` | uuid fk | A thread is always about one item |
| `buyer_id`, `seller_id` | uuid fk | |
| `last_message_at` | timestamptz | Inbox sorts on this |
| `buyer_wechat_shared`, `seller_wechat_shared` | boolean | Consent is per-side and per-thread |

Unique on `(listing_id, buyer_id)` — one thread per person per item, so a
follow-up question lands in the existing conversation.

### message

`id`, `conversation_id` fk, `sender_id` fk, `body` (≤ 2000), `created_at`,
`read_at`. Unread count is `read_at is null and sender_id <> me`.

### report

`id`, `reporter_id`, `target_type` (`listing` \| `user` \| `message`),
`target_id`, `reason` (enum), `note`, `status` (`open` \| `actioned` \|
`dismissed`), `created_at`, `resolved_by`, `resolved_at`.

## Scheduled jobs

Three, all trivial, all necessary:

1. **Expire listings** — hourly: `active` and past `expires_at` → `expired`.
2. **Expiry reminder** — daily: email owners at day 27 with a one-click renew.
3. **Purge** — monthly: delete images of listings soft-deleted over 90 days ago.

## What is deliberately absent

`price_history`, `saved_search`, `rating`, `review`, `transaction`, `payment`,
`nationality`, `theme`, `listing_translation`.
Each is a real feature and none belongs in v1. They are named here so that
"we forgot" is never mistaken for "we decided against".
