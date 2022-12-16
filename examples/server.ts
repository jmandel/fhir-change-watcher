// deno-lint-ignore-file no-explicit-any
import fhirpath from "https://esm.sh/fhirpath";
import { Application, Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import trackHistory from "../index.ts";

const app = new Application();
const router = new Router();

let clients: { target: any; expression: string }[] = [];

router.get("/filtered", (ctx) => {
  const target = ctx.sendEvents();
  const expression = ctx.request.url.searchParams.get("expression")!;
  let logline = `Start listening on \"${expression}\"`;
  console.log(logline);
  clients.push({ target, expression });
  target.dispatchMessage({ log: logline });
});

app.use(router.routes());
console.log("Starting");
app.listen({ port: 8000 });

for await (const delta of trackHistory()) {
  console.log("Change", delta);
  for (const { target, expression } of clients) {
    if (target.closed) {
      clients = clients.filter((c) => c.target !== target);
      continue;
    }
    console.log(expression);
    let result: any[] = fhirpath.evaluate({}, expression, delta);
    console.log("Result", expression, result);
    if (result.some((e) => e === true)) {
      target.dispatchMessage(delta);
    }
  }
}
