# afiliados-widget-sdk

CLI pra criar, buildar e publicar widgets standalone da plataforma KingPanda (overlays tipo
Fortuna do Panda) — sem precisar clonar o repo do server (`widgets`).

## Instalação

```bash
npm install -g afiliados-widget-sdk   # ou use via npx kp-widget <comando>
```

## Contrato de um widget

Pra uma dist ser portável e uploadável no CMS, o módulo precisa:

- Ser **self-contido**: `index.html` + `main.tsx` (+ `assets/` se precisar), sem imports pra
  fora da própria pasta.
- Falar **só** com a própria base de proxy `/<id>/__up` (HTTP/WS) — nunca com o upstream
  direto. O servidor injeta credenciais/JWT nessa borda.
- **Derivar a base do proxy em runtime**, a partir de `location.pathname` (nunca hardcoded
  nem via env de build) — assim a MESMA dist funciona em qualquer path/id:
  ```ts
  const BASE = location.pathname.replace(/\/(index\.html)?$/, "") + "/__up";
  ```

## Comandos

```bash
kp-widget create <id>            # scaffold em ./<id>/ (index.html + main.tsx)
kp-widget build <id>             # ./<id>/ -> dist/<id>/  (Vite, base relativa)
kp-widget pack <id>              # dist/<id>/ -> <id>.zip (pronto pro CMS)
kp-widget publish <id> --url <server> --password <senha>
                                  # builda+empacota+envia direto pro /__admin/widgets
```

Flags de `build`/`pack`/`publish`: `--src <dir>` (default `./<id>`), `--out`/`--dir <dir>`
(default `./dist/<id>`).

### Metadados (título/descrição/proxy)

Opcional: crie `<id>/widget.config.json` na pasta fonte —

```json
{
  "title": "Meu widget",
  "description": "O que ele faz.",
  "proxy": { "http": "https://meu-upstream.com", "auth": "rewards-jwt" }
}
```

O `build` lê esse arquivo e emite `dist/<id>/widget.json` (o manifesto que a dist carrega
consigo) — o upload no CMS, no modo **Automático**, usa esse manifesto pra preencher
título/proxy sem precisar digitar nada.

## Upload manual (sem `publish`)

1. `kp-widget build <id>` → `kp-widget pack <id>` → gera `<id>.zip`.
2. No CMS da plataforma (`/`), aba **Upload de widget** → arraste o `.zip` (ou a pasta
   `dist/<id>` inteira, o CMS zipa no client).
