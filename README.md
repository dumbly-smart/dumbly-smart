<div align="center">

<img width="100%" src="./assets/hero.svg" alt="dumbly-smart" />

<img width="760" src="./assets/typing.svg" alt="Defensive security, reverse engineering, systems, and self-hosted infrastructure" />

[![Profile views](https://komarev.com/ghpvc/?username=dumbly-smart&style=for-the-badge&color=00d9e9&label=PROFILE+VIEWS)](https://github.com/dumbly-smart)
[![Followers](https://img.shields.io/github/followers/dumbly-smart?style=for-the-badge&label=FOLLOWERS&color=00d9e9&labelColor=11151b)](https://github.com/dumbly-smart?tab=followers)
[![Stars](https://img.shields.io/github/stars/dumbly-smart?affiliations=OWNER%2CCOLLABORATOR&style=for-the-badge&label=STARS&color=f4b942&labelColor=11151b)](https://github.com/dumbly-smart?tab=repositories)

[`PROJECTS`](#-selected-projects) · [`LIVE DATA`](#-live-commit-data) · [`STACK`](#-working-stack) · [`CONTACT`](#-open-a-channel)

</div>

## `whoami`

```yaml
handle: dumbly-smart
interests:
  - defensive security and malware behaviour
  - reverse engineering and binary exploitation
  - applied cryptography
  - self-hosted infrastructure
currently_building:
  - safe tools for understanding hostile code
  - local-first software with explicit threat models
off_screen:
  - manga
  - breaking and rebuilding my Linux setup
```

I care about software that explains its decisions, fails safely, and does not hide important boundaries behind marketing language.

## ⚡ Selected projects

<details open>
<summary><b>PhantomCircuit — behavioural shellcode emulator</b></summary>
<br>

Dependency-free x86-64 emulation for defensive triage. It classifies shellcode intent without executing the sample, touching the host filesystem, or opening a real socket.

```console
$ phantom-circuit --file sample.bin --json
verdict: reverse_shell · confidence: 92% · native_execution: false
```

**Python · emulation · malware analysis** — [source](https://github.com/dumbly-smart/phantom-circuit)

</details>

<details>
<summary><b>Eternal Vault — local-first password manager</b></summary>
<br>

An experimental vault using XChaCha20-Poly1305, Argon2id, atomic writes, and a documented threat model. No account, cloud service, telemetry, or background sync.

**Rust · applied cryptography · local-first** — [source](https://github.com/dumbly-smart/eternal-vault) · [threat model](https://github.com/dumbly-smart/eternal-vault/blob/main/docs/threat-model.md)

</details>

<details>
<summary><b>Farlands — managed game-server infrastructure</b></summary>
<br>

Realtime application and infrastructure engineering around Kubernetes orchestration, persistent storage, backups, and server lifecycle management.

**TypeScript · Kubernetes · WebSockets** — [source](https://github.com/dumbly-smart/farlands)

</details>

<details>
<summary><b>GS1 Voice CTF — security challenge</b></summary>
<br>

A challenge exploring the unusual attack surface where voice workflows, physical identifiers, and software meet.

**CTF · protocols · security research** — [source](https://github.com/dumbly-smart/gs1-voice-ctf)

</details>

## ◉ Live commit data

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./generated/commit-page-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./generated/commit-page-light.svg">
  <img width="100%" alt="Live GitHub commit dashboard" src="./generated/commit-page-light.svg">
</picture>

<div align="center">

`updated daily by GitHub Actions` · [`raw activity.json`](./generated/activity.json) · [`inspect the generator`](./scripts/render-commits.mjs)

</div>

## ⛓ Working stack

<div align="center">

**Languages**

[![Languages](https://skillicons.dev/icons?i=rust,py,ts,js,bash,c,cpp&theme=dark)](https://github.com/dumbly-smart?tab=repositories)

**Systems and tooling**

[![Tools](https://skillicons.dev/icons?i=linux,docker,kubernetes,git,github,postgres,redis&theme=dark)](https://github.com/dumbly-smart?tab=repositories)

</div>

<details>
<summary><b>Security working set</b></summary>
<br>

`Ghidra` · `GDB/pwndbg` · `Burp Suite` · `Wireshark` · `pwntools` · `Linux namespaces` · `x86-64` · `ELF`

This is a working set, not a wall of “mastered” badges. The repositories above are the evidence.

</details>

## ↗ Open a channel

Have an interesting system, security problem, project, or manga recommendation?

<div align="center">

[![Start a discussion](https://img.shields.io/badge/START_A_DISCUSSION-00d9e9?style=for-the-badge&logo=github&logoColor=11151b)](https://github.com/dumbly-smart/dumbly-smart/issues/new?template=signal.yml)
[![Browse repositories](https://img.shields.io/badge/BROWSE_REPOSITORIES-20262e?style=for-the-badge&logo=github&logoColor=white)](https://github.com/dumbly-smart?tab=repositories)

<sub>Readable interfaces. Inspectable systems.</sub>

</div>
