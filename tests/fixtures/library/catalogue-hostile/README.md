# A hostile sample library

For fmIDE's tests (group 25, the catalogue): one pack, saved by fmIDE, with markup, quotes,
`&` and `<script>` in every text the catalogue shows — the title, author, description and tags,
and each item's name, group, description, change note, plugs, sockets and formula description.
The catalogue must show all of it as plain text. Its records were written by
`node tools/check-pack.js --library … --write-records --account eve-sample --account-id 1004 --date 2026-10-01`.
