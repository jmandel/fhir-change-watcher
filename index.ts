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
  try {
    const res = await fetch(url);
    const json = await res.json();
    return [
      json.entry || [],
      (json.link || []).filter(
        (l: { relation: string }) => l.relation == "next"
      )[0]?.url || null,
    ];
  } catch (e) {
    console.log(e);
    return [[], null];
  }
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

export default async function* trackHistory(
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

    const lastUpdated = (r: any) => new Date(r.meta.lastUpdated).getTime();
    const newEntries = allEntries.filter(
      (e) => !newestEntryCache.has(e.request.url)
    );

    const newestEntryTime = Math.max(
      ...newEntries
        .map((e) =>
          e.resource ? lastUpdated(e.resource) : lastSweepResourceTime
        )
        .concat(lastSweepResourceTime)
    );
    lastSweepResourceTime = newestEntryTime!;

    const zipped = await Promise.all(
      newEntries.map((e) => entryHistory({ baseUrl, entry: e }))
    );

    newestEntryCache.clear();
    allEntries.forEach((e) =>
      newestEntryCache.set(e.request.url, newestEntryTime)
    );

    console.log("Yielding", newEntries.length, "entries", new Date());
    for (const e of zipped.toReversed()) {
      yield e;
    }
    await new Promise((resolve) => setTimeout(resolve, pollingDelay));
  }
}
