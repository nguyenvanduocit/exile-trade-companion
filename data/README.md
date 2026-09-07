# PoE2 tier data

`poe2-tiers.json` is an unchanged copy of TierFill's `assets/data-snapshot.json` at
[0481fee0bfa26b60c060521bfb5ae0f9a90c0852](https://github.com/Sknoww/tierfill/tree/0481fee0bfa26b60c060521bfb5ae0f9a90c0852)
(June 17, 2026), imported September 5, 2026.

SHA-256: `6f667dc639889369b5788b694c2d80ecc7b22ca8f461a434ebce0d904ee4ee60`.

The snapshot contains community mod ladders derived from PoE2DB through
[poe-trade-official-site-enhancer](https://github.com/ghostscript3r/poe-trade-official-site-enhancer),
joined with GGG trade stat IDs. The MIT notice is in `public/licenses/TierFill.txt`
and ships with both browser builds. No upstream application code is bundled.

To update, review TierFill's current snapshot and its data corrections, replace
the JSON, record the new commit and checksum here, then run `bun run check`.
`lib/tier-filter.test.ts` validates every identified explicit ladder and checks
representative thresholds; review changed breakpoints before updating expectations.
Verify the picker against a current PoE2 search form after changing data or selectors.

The picker matches exact explicit stat IDs. Entries without an ID are ignored.
Category IDs restrict candidate families and their displayed type labels. A selected
base item or unique further narrows those types using its exact base name. Name-only
unique searches resolve through the trade site's `static_.knownItems` catalogue.
Unknown selected items and conflicting categories show no picker. Without any item
context, the dropdown uses compact family labels.
T1 denotes the best tier in each bundled ladder. MIN uses the tier floor, averaging
both rolls for flat damage. Inverted stats use MAX at the tier ceiling. Numeric
filters cannot guarantee an affix tier when rolls overlap or several mods add to
the same stat. These are snapshot thresholds, not live game-data validation.

## Base item categories

`poe2-base-types.json` maps 1,721 base names to the item types used by the tier data.
It is derived from [RePoE's PoE2 base item export](https://repoe-fork.github.io/poe2/base_items.json),
retrieved September 5, 2026. Source SHA-256:
`99a4a4090d350a09700af8d1cdc062e5859825f54635107931ace322951e3e98`.
The generator retains exact names and item classes, with Warstaff → quarterstaff
and UtilityFlask → charm. It does not infer item classes from words in item names.

Download a fresh export, then run
`node scripts/build-poe2-base-types.mjs /path/to/base_items.json` and `bun run check`.
Recheck Svalinn → Crucible Tower Shield → Shield on the trade form after updating.
Unique selection identifies the category; the bundled affix ladders are not
unique-specific roll ranges.
