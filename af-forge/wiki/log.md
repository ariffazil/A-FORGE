# AF-FORGE Wiki Log

## [2026-04-09] bootstrap | initial forge wiki scaffold
- Established the first AF-FORGE wiki tree.
- Added early sections for operators, rituals, blueprints, cracks, temperatures, federation, and audits.
- Seeded pages for reconnect/recovery, memory stack, live status, and three-wiki mapping.

## [2026-04-10] normalize | proper AF-FORGE wiki established
- Upgraded AF-FORGE from a partial scaffold into a proper persistent wiki for VPS infrastructure and components.
- Expanded `SCHEMA.md` to define AF-FORGE as the infrastructure wiki using the raw/wiki/schema/index/log pattern.
- Copied core repo docs into `wiki/raw/` for grounding:
  - `README.md`
  - `MAP.md`
  - `ARCHITECTURE.md`
  - `VPS_NATIVE.md`
  - `ROADMAP.md`
  - `RUNTIME_POLICY.md`
  - `package.json`
- Added or refreshed core operational pages:
  - `10_RITUALS/Build.md`
  - `20_BLUEPRINTS/Stack_Components.md`
  - `20_BLUEPRINTS/Adapter_Bus.md`
  - `30_ALLOYS/Dependency_Surface.md`
  - `40_HAMMERS/Operational_Tooling.md`
  - `90_AUDITS/Memory_Manifest.md`
- Rewrote `index.md` so navigation reflects the actual live wiki tree.
- Filled missing links that previously pointed to pages that did not exist.
- Added frontmatter to `20_BLUEPRINTS/Memory_Stack.md` so it participates cleanly in the wiki schema.
