# Third-party material

Agent Signal code is MIT licensed; dependencies retain their own licenses.

The repository-local DevKit checks originate from the owner's DevKit 2.0.1. Version and original file hashes are recorded under `tools/devkit`; these checks are distributed under the project MIT license. No external DevKit service is used.

Runtime and build dependencies are listed in `package.json` and locked, with integrity hashes, in `package-lock.json`. Installed packages carry their license notices. To inventory the locked dependency tree, run `npm sbom --sbom-format spdx --package-lock-only` after `npm ci`; this command does not establish legal compatibility by itself. When distributing compiled artifacts or a container, retain applicable dependency notices with that artifact and review the resulting inventory. No bundled package, binary release or container is published by this repository's CI.

Recheck the current locked inventory when packaging native build tools. The MIT label applies to Agent Signal source and does not relicense dependencies. No Sites starter code is retained or shipped by this source revision.
