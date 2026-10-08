# Third-party material

Agent Signal code is MIT licensed; dependencies retain their own licenses.

The repository-local DevKit checks originate from the owner's DevKit 2.0.1. Version, original/current hashes and the comment-only local patch are recorded under `tools/devkit`; these checks are distributed under the project MIT license. No external DevKit service is used.

Service development dependencies are declared and locked at the repository root; the hook runtime has its own `clients/codex/package.json` and lockfile. Both lockfiles record integrity hashes. Installed packages carry their license notices. To inventory the locked dependency tree, run `npm sbom --sbom-format spdx --package-lock-only` at the root and `npm sbom --prefix clients/codex --sbom-format spdx --package-lock-only` for the hook; this command does not establish legal compatibility by itself. When distributing compiled artifacts or a container, retain applicable dependency notices with that artifact and review the resulting inventory. No bundled package, binary release or container is published by this repository's CI.

Recheck the current locked inventory when packaging native build tools. The MIT label applies to Agent Signal source and does not relicense dependencies. No Sites starter code is retained or shipped by this source revision.
