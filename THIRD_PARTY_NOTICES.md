# Third-party material

Agent Signal code is MIT licensed; dependencies retain their own licenses.

The Sites starter's vendored `build/sites-vite-plugin.ts` comes from `@openai/sites-vite-plugin` 0.2.0 (openai/sites#9), copyright 2026 OpenAI, MIT. Its full license is retained in `build/sites-vite-plugin.LICENSE`.

The repository-local DevKit checks originate from the owner's DevKit 2.0.1. Version and original file hashes are recorded under `tools/devkit`; these checks are distributed under the project MIT license. No external DevKit service is used.

Runtime and build dependencies are listed in `package.json` and locked, with integrity hashes, in `package-lock.json`. Installed packages carry their license notices. To inventory the locked dependency tree, run `npm sbom --sbom-format spdx --package-lock-only` after `npm ci`; this command does not establish legal compatibility by itself. When distributing compiled artifacts or a container, retain applicable dependency notices with that artifact and review the resulting inventory. No bundled package, binary release or container is published by this repository's CI.

The 2026-10-07 lockfile SPDX inventory includes LGPL-licensed libvips/Sharp native tooling, MPL-licensed runtime tooling and a CC-BY-licensed dependency, alongside permissive licenses. The MIT label applies to Agent Signal's own source; it does not relicense dependencies. The Sites archive contains compiled application output, not the installed native toolchain. Recheck artifact contents and retain applicable notices if packaging that toolchain or adding binary/container releases.
