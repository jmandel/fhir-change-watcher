import trackHistory from "../index.ts"
import fhirpath from "https://esm.sh/fhirpath";

addEventListener("fhirDelta", onData);
function onData(e) {
  console.log("Got data", e.detail);
}

const fhirpathExpressions = ["%current.resourceType != 'AuditEvent'"];
for await (const delta of trackHistory()) {
  const detail = {
    raw: delta,
    expressions: Object.fromEntries(
      fhirpathExpressions.map((fp) => [fp, fhirpath.evaluate({}, fp, delta)])
    ),
  };
  const event = new CustomEvent("fhirDelta", { detail });
  dispatchEvent(event);
}