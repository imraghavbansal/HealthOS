// One-off: verify the deployed parse-record Edge Function can reach
// Anthropic using the ANTHROPIC_API_KEY secret, without ever seeing that
// key from here. Builds a minimal valid 1x1 PNG by hand (no deps) so the
// function takes the "image" path and actually calls the Anthropic API —
// content is trivial, so extraction will be empty, but a clean 200 proves
// the secret + deployment + auth plumbing all work end to end.
import { createClient } from "@supabase/supabase-js";
import zlib from "node:zlib";

const URL = process.env["VITE_SUPABASE_URL"];
const ANON_KEY = process.env["VITE_SUPABASE_ANON_KEY"];
if (!URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function buildMinimalPng() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type: RGB
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const raw = Buffer.from([0, 255, 255, 255]); // filter byte + 1 white pixel
  const idatData = zlib.deflateSync(raw);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

async function main() {
  const email = `raag-verify-parse-${Math.random().toString(36).slice(2, 8)}@mailinator.com`;
  const password = `Pw!${Math.random().toString(36).slice(2, 10)}`;
  const client = createClient(URL, ANON_KEY);

  console.log("── sign up test user ───────────────────────────────");
  const { data: signUp, error: signUpErr } = await client.auth.signUp({ email, password });
  if (signUpErr || !signUp.session) {
    console.error("Sign-up failed or needs email confirmation (turn it off temporarily):", signUpErr?.message);
    process.exit(1);
  }
  console.log("  ok   signed up:", email);

  const { data: subject } = await client.from("health_subjects").select("id").eq("kind", "self").single();
  const path = `${subject.id}/${Date.now()}-verify.png`;

  console.log("── upload minimal test image ───────────────────────");
  const png = buildMinimalPng();
  const { error: uploadErr } = await client.storage.from("medical-records").upload(path, png, { contentType: "image/png" });
  if (uploadErr) {
    console.error("  FAIL storage upload:", uploadErr.message);
    process.exit(1);
  }
  console.log("  ok   uploaded to Storage");

  const { data: doc, error: insertErr } = await client
    .from("source_documents")
    .insert({
      subject_id: subject.id,
      storage_path: path,
      original_filename: "verify.png",
      mime_type: "image/png",
      size_kb: 1,
      document_type: "Other",
      title: "Edge function verification",
      ocr_status: "pending",
      uploaded_by: subject.id,
    })
    .select()
    .single();
  if (insertErr) {
    console.error("  FAIL source_documents insert:", insertErr.message);
    process.exit(1);
  }
  console.log("  ok   source_documents row created:", doc.id);

  console.log("── invoke parse-record ─────────────────────────────");
  const { data: fnResult, error: fnErr } = await client.functions.invoke("parse-record", { body: { documentId: doc.id } });
  if (fnErr) {
    console.error("  function invoke returned an error status — checking what the function itself recorded:", fnErr.message);
    if (fnErr.context) {
      try {
        console.error("  response body:", await fnErr.context.text());
      } catch {
        // ignore
      }
    }
  }
  console.log("  ok   function responded:", JSON.stringify(fnResult));

  const { data: finalDoc } = await client.from("source_documents").select("ocr_status, ocr_error").eq("id", doc.id).single();
  console.log("── result ───────────────────────────────────────────");
  console.log("  ocr_status:", finalDoc.ocr_status);
  if (finalDoc.ocr_status === "done") {
    console.log("  ANTHROPIC_API_KEY is reachable from the Edge Function — secret access confirmed.");
  } else if (finalDoc.ocr_status === "failed") {
    console.log("  ocr_error:", finalDoc.ocr_error);
    console.log("  Function ran but failed — likely the secret isn't set correctly, or an Anthropic API error.");
  }

  console.log(`\nTest account (safe to delete): ${email}`);
}

main().catch((e) => {
  console.error("Script error:", e);
  process.exit(1);
});
