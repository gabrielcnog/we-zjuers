# WeZJUers — a student platform for Zhejiang University

A free, bilingual (EN / 中文) platform where ZJU students list used items for
other students to buy. Built for international students first, open to everyone
on campus.

No payments, no fees, no paid tier, no escrow. The platform introduces buyer and
seller and then gets out of the way — money and goods change hands in person, on
campus. That single constraint keeps the product simple and keeps it out of
China's payment-licensing regime entirely.

**Status: foundation. Nothing is implemented.** These documents define what gets
built and why, so the first line of code isn't also the first decision.

| Document | What it settles |
|---|---|
| [docs/product-spec.md](docs/product-spec.md) | Who it's for, the pages, what ships in v1 and what waits |
| [docs/architecture.md](docs/architecture.md) | Stack, hosting, auth, images — and the China-specific constraints |
| [docs/ux-guidelines.md](docs/ux-guidelines.md) | Research-backed UX rules — the feed, filters, search, forms, mobile, accessibility |
| [docs/infrastructure.md](docs/infrastructure.md) | Engineering rules — database, security, performance, operations, privacy, build order |
| [docs/interface.md](docs/interface.md) | The language switch, light/dark, responsive and the performance budget |
| [docs/data-model.md](docs/data-model.md) | Entities, fields, relations |
| [docs/decisions.md](docs/decisions.md) | Decisions taken with their reasoning, and the questions still open |
| [design/](design/) | Design system v1.0 — tokens, components, and living documentation |
| `app/` | Application code — empty until the stack is confirmed |

## The one-line version

Kleinanzeigen shrunk to one campus: post an item, browse by category, contact
the seller.

## What makes it not-just-OLX

Three things follow from the audience and should shape every screen:

1. **Campus, not city.** ZJU is spread across seven campuses. "Which campus" is
   the filter that decides whether a deal happens; a city-wide feed is noise.
2. **Graduation is the season.** Supply spikes in June–July and January when
   students leave the country. Listings must expire and the feed must stay fresh
   without anyone tending it.
3. **Bilingual is the product, not a feature.** An international student and a
   Chinese student have to be able to use the same listing. Every label ships in
   both languages from day one, switchable in the header.
4. **Who can you talk to?** Sellers declare the languages they can do a deal in.
   On a campus where a transaction can fail purely on language, that is closer to
   the core of the product than price is.
