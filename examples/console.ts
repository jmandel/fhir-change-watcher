import trackHistory from "../index.ts"

console.log("Watching hx")
for await (const e of trackHistory()) {
  console.log(`${e.current?.resourceType}/${e.current?.id}`);
  console.log(e);
}