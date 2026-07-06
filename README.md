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
- **Reveal-on-ready (obrigatório)**: o widget é um GRÁFICO de overlay — nasce invisível
  (`#root{opacity:0}`, sem transition) e só entra em cena com **fade-in** quando TUDO está
  renderizado: 1º dado real + `document.fonts.ready` + todas as imagens decodificadas
  (`img.decode()`). Sem dado → permanece invisível. O `template/main.tsx` já traz o padrão.
- **Gráfico puro, sem interação**: nada de `href`/redirect/hover; `user-select: none`;
  toda `<img>` com `width`/`height` intrínsecos e assets **bundlados** (nunca hotlink de CDN).
- **`index.html` tem que ficar pequeno — nunca inline algo grande nele.** No host afiliados,
  `index.html` é o único arquivo da dist servido sem streaming (o servidor bufferiza ele
  inteiro pra injetar `<base href>`); todo o resto (JS/CSS/imagens) é streamado. Um
  `index.html` normal (poucos KB) não tem problema nenhum — mas um base64 grande colado
  direto no HTML (em vez de importado como asset, que o Vite separa e hasheia
  automaticamente) vira exatamente o tipo de bufferização síncrona pesada que trava sob
  CPU throttling do Kubernetes em produção (visto ao vivo: ~10s pra servir um JS de 161KB
  bufferizado, contra ~0.1s depois de trocar pra streaming — index.html sempre ficou rápido
  justamente por ser pequeno). Sempre importe imagens/fontes/dados grandes como assets
  normais; nunca cole base64 direto no HTML.

## Comandos

```bash
kp-widget create <id>            # scaffold em ./<id>/ (index.html + main.tsx)
kp-widget dev <id> --proxy <url> # dev server (Vite+HMR) servindo a FONTE; /__up (HTTP+WS)
                                  # proxyado pro alvo (ex.: http://localhost:8787/jackpot/__up)
kp-widget build <id>             # ./<id>/ -> dist/<id>/  (Vite, base relativa)
kp-widget preview <id>           # serve dist/<id>/ localmente — olha/testa ANTES de subir
kp-widget pack <id>              # dist/<id>/ -> dist/<id>.zip (pronto pro CMS)
kp-widget publish <id> --url <server> --password <senha>
                                  # builda+empacota+envia direto pro /__admin/widgets
```

Flags de `build`/`pack`/`preview`/`publish`: `--src <dir>` (default `./<id>`), `--out`/`--dir <dir>`
(default `./dist/<id>`). `preview` aceita também `--port` (default `4173`).

### `preview` — testar antes de subir

`kp-widget preview <id>` sobe um servidor estático local só com Node (sem dependência nova)
servindo exatamente os arquivos que `pack`/`publish` vão empacotar — abre
`http://localhost:4173` e confere layout/estilo/assets antes de mandar pra qualquer lugar.

**Limitação esperada**: só serve arquivos estáticos. Chamadas de dado ao vivo (`fetch`,
`EventSource` pra `/__up` ou `/api/widgets/*`) não respondem — esses endpoints só existem
quando a dist está de fato hospedada atrás do server (`widgets`) ou do app (`afiliados`).
`preview` valida "o bundle builda e carrega certo", não "os dados ao vivo funcionam".

### Metadados (título/descrição/proxy/perAffiliate/scenes)

Opcional: crie `<id>/widget.config.json` na pasta fonte —

```json
{
  "title": "Meu widget",
  "description": "O que ele faz.",
  "proxy": { "http": "https://meu-upstream.com", "auth": "rewards-jwt" },
  "perAffiliate": false,
  "scenes": [
    { "key": "jackpot", "label": "Ticker Jackpot", "defaultDwellMs": 15000 },
    { "key": "arena", "label": "Rank Arena (por período)", "defaultDwellMs": 8000 },
    { "key": "qr", "label": "QR", "defaultDwellMs": 15000 }
  ]
}
```

O `build` lê esse arquivo e emite `dist/<id>/widget.json` (o manifesto que a dist carrega
consigo) — o upload no CMS, no modo **Automático**, usa esse manifesto pra preencher
título/proxy sem precisar digitar nada.

**`perAffiliate`** — declare `true` se o widget lê `?aff=&dest=&mode=` da própria URL
(`location.search`) pra montar um link rastreado por afiliado (mesmo contrato de
`qrcode`/`rotator` neste repo). Quem sabe se um widget precisa disso é quem escreve o
`main.tsx`, não quem faz o upload depois — declare aqui em vez de depender de alguém
lembrar de marcar um checkbox manualmente no admin. Default `false` (link fixo, sem
parâmetro nenhum — o caso comum pra widgets sem dado por-afiliado, tipo jackpot/arena).

**`scenes`** — só faz sentido pra um widget que internamente compõe sub-cenas com timing
próprio (os casos de `rotator` e `rotator-special`). Cada entrada
`{key, label, defaultDwellMs}` deixa o painel de admin do host montar um card de tempos
POR DIST automaticamente (dwell por cena + crossfade) — sem isso, o host teria que
hardcodar de antemão quais cenas (e quais labels) o bundle tem. `key` é o identificador
que a própria dist espera receber de volta via
`GET /api/widgets/rotator-config?id=<distId>` (sem `id` = `rotator`, compat; o bundle
faz poll e cai nos próprios defaults se 404/offline). O `<distId>` é DERIVADO em runtime
do pathname do embed (`/widgets/overlay/<id>/` ou `/api/widgets/dist/<id>/`) — o mesmo
zip enviado sob outro nome obedece ao próprio card, sem id de build; `label` é só texto pro admin;
`defaultDwellMs` é o valor inicial antes de qualquer configuração manual. Widgets sem
sub-cenas (a maioria) simplesmente omitem o campo. As CENAS em si são fixas no bundle —
a config só ajusta tempos.

## Upload manual (sem `publish`)

1. `kp-widget build <id>` → `kp-widget pack <id>` → gera `dist/<id>.zip`.
2. No CMS da plataforma (`/`), aba **Upload de widget** → arraste o `.zip` (ou a pasta
   `dist/<id>` inteira, o CMS zipa no client).
