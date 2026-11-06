// Build the editor for ZoneScene: served under /studio/, with every runtime asset self-hosted
// (ffmpeg core, ONNX runtime, Whisper model) so the page's CSP can keep connect-src to 'self'.
//
//   node apps/web/scripts/build-studio.mjs
//
// Output: apps/web/dist. Vendored assets land in apps/web/public/{ffmpeg,ort,models} (gitignored).
// BRAND_NAME (e.g. from the ZoneScene env) labels the « ← Retour » link; never hardcoded here.
// Set STUDIO_MODEL_CACHE to a folder holding onnx-community/whisper-small/... to skip the download.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(WEB, "../..");
const PUBLIC = path.join(WEB, "public");

const MODEL = "onnx-community/whisper-small";
const MODEL_FILES = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/encoder_model_q4.onnx",
  "onnx/decoder_model_merged_q4.onnx",
];

const exists = (p) => stat(p).then(() => true, () => false);

async function copyInto(dir, files) {
  await mkdir(dir, { recursive: true });
  for (const file of files) await copyFile(file, path.join(dir, path.basename(file)));
}

async function vendorFfmpeg() {
  const dist = path.join(ROOT, "node_modules/@ffmpeg/core/dist/esm");
  await copyInto(path.join(PUBLIC, "ffmpeg"), ["ffmpeg-core.js", "ffmpeg-core.wasm"].map((f) => path.join(dist, f)));
}

async function vendorOnnxRuntime() {
  // transformers.js ships the ORT build it was compiled against; use exactly that one.
  const dist = path.join(WEB, "node_modules/@huggingface/transformers/dist");
  await copyInto(
    path.join(PUBLIC, "ort"),
    ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"].map((f) => path.join(dist, f)),
  );
}

async function vendorModel() {
  const cache = process.env.STUDIO_MODEL_CACHE;
  for (const file of MODEL_FILES) {
    const target = path.join(PUBLIC, "models", MODEL, file);
    if (await exists(target)) continue;
    await mkdir(path.dirname(target), { recursive: true });
    const cached = cache && path.join(cache, MODEL, file);
    if (cached && (await exists(cached))) {
      await copyFile(cached, target);
      continue;
    }
    const url = `https://huggingface.co/${MODEL}/resolve/main/${file}`;
    console.log(`downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
}

// VITE_STUDIO_MODELS_URL (e.g. https://media.example.com/models/): the model is served from there
// (upload public/models/ to it once) and left out of the build — it never changes between releases.
const modelsUrl = process.env.VITE_STUDIO_MODELS_URL ?? "";

await vendorFfmpeg();
await vendorOnnxRuntime();
await vendorModel();

execSync("pnpm build", { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_BASE: "/studio/", VITE_BRAND_NAME: process.env.BRAND_NAME ?? "", VITE_STUDIO_MODELS_URL: modelsUrl } });

const DIST = path.join(WEB, "dist");
// Cloudflare Pages / PWA leftovers: ZoneScene serves headers itself and registers no worker.
for (const file of ["_headers", "_redirects", "sw.js", "manifest.json", ...(modelsUrl ? ["models"] : [])]) {
  await rm(path.join(DIST, file), { recursive: true, force: true });
}
console.log(`studio build ready: ${DIST}${modelsUrl ? ` (model from ${modelsUrl})` : ""}`);

// --pack: release tarball for the host's deploy (content at the archive root) + its SHA-256.
if (process.argv.includes("--pack")) {
  const archive = path.join(WEB, "studio-dist.tar.gz");
  // Relative paths from WEB: GNU tar (Git Bash) reads « C: » in an absolute Windows path as a remote host.
  execSync(`tar -czf "${path.relative(WEB, archive)}" -C "${path.relative(WEB, DIST)}" .`, { stdio: "inherit", cwd: WEB });
  const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
  console.log(`packed ${archive}\nsha256 ${sha256}`);
}
