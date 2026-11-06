# Notice

This repository is the ZoneScene studio, a fork of [OpenReel Video](https://github.com/Augani/openreel-video)
(MIT, see `LICENSE`). ZoneScene's changes are released under the same MIT licence.

Third-party components shipped in the studio build:

- **ffmpeg.wasm core** (`@ffmpeg/core` 0.12.6, single-thread): built with `--enable-gpl`
  (libx264, libx265), so the binary is GPL. Its exact corresponding source and rebuild steps:
  https://github.com/narsixlive/ffmpeg-wasm-source (release `core-0.12.6`).
- **ONNX Runtime Web** (MIT), shipped by `@huggingface/transformers` (Apache-2.0).
- **Whisper small** (`onnx-community/whisper-small`, MIT), served from the host's storage, not this repo.
- **Bricolage Grotesque** and **Instrument Sans** fonts (SIL Open Font License 1.1, texts in
  `apps/web/src/zonescene/fonts/`).
