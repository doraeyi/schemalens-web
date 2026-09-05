# Vendored packages

`schema-core`, `schema-parser`, `schema-graph`, `schema-layout`, `schema-renderer`,
`schema-serializer` are copied from `D:\project\schemaLen\packages\*` (the SchemaLens /
DBSchema VS Code extension monorepo) on 2026-09-05.

They are framework-agnostic and have no VS Code dependency, so they're reused as-is to
keep the diagram rendering logic identical between the VS Code extension and this web app.

This is a **manual copy, not a live link**. If schemaLen's core packages change (bug fixes,
new features), re-copy the relevant package's `src/` here by hand — there is no automated
sync script yet.
