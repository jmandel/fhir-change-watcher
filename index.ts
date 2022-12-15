// deno-lint-ignore-file no-explicit-any

interface historyArgs {
  baseUrl?: string;
  since?: number;
  more?: string;
  entry?: any;
}

async function history({ baseUrl, since, more }: historyArgs) {
  const url = new URL(more || `${baseUrl}/_history`);
  if (since) {
    url.searchParams.set("_since", new Date(since).toISOString());
  }

  const res = await fetch(url);
  const json = await res.json();
  return [
    json.entry || [],
    (json.link || []).filter(
      (l: { relation: string }) => l.relation == "next"
    )[0]?.url || null,
  ];
}
async function entryHistory({ baseUrl, entry }: historyArgs) {
  const entryPath = entry.request.url.split("/");
  const entryVersion = parseInt(entryPath.slice(-1)[0]);
  const previousEntryPath =
    entryVersion > 1
      ? `${entryPath.slice(0, -1).join("/")}/${entryVersion - 1}`
      : null;
  const delta: { previous: any; current: any } = {
    previous: null,
    current: null,
  };

  if (previousEntryPath) {
    delta.previous = await (
      await fetch(`${baseUrl}/${previousEntryPath}`)
    ).json();
  }
  if (entry?.resource) {
    delta.current = entry?.resource;
  }

  return delta;
}

async function* trackHistory(
  baseUrl = "https://hapi.fhir.org/baseR4",
  startAt = null,
  pollingDelay = 10000,
  shortestDelay = 5000
) {
  let lastSweepResourceTime =
    startAt || new Date(Date.now() - 100 * pollingDelay).getTime();
  const newestEntryCache = new Map();
  while (true) {
    let allEntries: any[] = [];
    let newestEntryTime: null | number = null;
    let [entries, more] = await history({
      baseUrl,
      since: lastSweepResourceTime,
    });

    do {
      allEntries = [...allEntries, ...entries];
      if (entries.length && more) {
        await new Promise((resolve) => setTimeout(resolve, shortestDelay));
        [entries, more] = await history({ more });
      }
    } while (entries.length);

    const lastUpdated = (r) => new Date(r.meta.lastUpdated).getTime();
    const newEntries = allEntries.filter(
      (e) => !newestEntryCache.has(e.request.url)
    );

    newestEntryTime = Math.max(
      ...newEntries
        .map((e) =>
          e.resource ? lastUpdated(e.resource) : lastSweepResourceTime
        )
        .concat(lastSweepResourceTime)
    );

    let zipped = await Promise.all(
      newEntries.map((e) => entryHistory({ baseUrl, entry: e }))
    );

    if (newestEntryTime > lastSweepResourceTime) {
      console.log("Progress", lastSweepResourceTime, newestEntryTime);
      newestEntryCache.clear();
    }
    newEntries.forEach((e) =>
      newestEntryCache.set(e.request.url, newestEntryTime)
    );

    console.log("Yielding", newEntries.length, "entires", new Date());
    for (const e of zipped.toReversed()) {
      yield e;
    }
    lastSweepResourceTime = newestEntryTime!;
    await new Promise((resolve) => setTimeout(resolve, pollingDelay));
  }
}
// for await (const e of trackHistory()) {
//   console.log(`${e.current?.resourceType}/${e.current?.id}`);
//   console.log(e);
// }


import { Application, Router, ServerSentEvent } from "https://deno.land/x/oak@v11.1.0/mod.ts";

// Import trackHistory function from existing code

const app = new Application();
const router = new Router();

const sockets: any[] = []
const events = trackHistory();
router.get("/", (ctx) => {
  const target = ctx.sendEvents();
  sockets.push(target);
  target.dispatchMessage({"log": "Beginning SSE"});
});

app.use(router.routes());
console.log("Starting")
app.listen({ port: 8000 });

for await (const entry of trackHistory()) {
    console.log("Entry", entry);
    for (const target of sockets) {
        console.log("Delivering", target.closed)
        if (!target.closed) target.dispatchMessage(entry);
    }
}

