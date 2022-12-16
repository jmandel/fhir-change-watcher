// deno-lint-ignore-file no-explicit-any
import { Application, Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import trackHistory from "../index.ts"

const app = new Application();
const router = new Router();

const sockets: any[] = []

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
