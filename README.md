# fhir-watcher

Point to a server and generate a change feed of [previous, current] resource pairs for all server updates

# Examples

## Print to console

    deno run --allow-all  --watch examples/console.ts

## Spool to Server-Sent Events web endpoint

    npx sse-cat http://localhost:8000
    deno run --allow-all  --watch examples/server.ts
