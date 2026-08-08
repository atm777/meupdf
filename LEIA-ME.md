# Meu PDF

Ferramentas de PDF gratuitas e que rodam **100% no navegador**: juntar, dividir, comprimir,
assinar, tarjar, numerar, colocar marca d'água, converter imagens ↔ PDF,
inspecionar privacidade, entre outras. Nenhum arquivo é enviado para servidor: todo o
processamento acontece no próprio navegador, no seu aparelho. Site:
[meupdf.app](https://meupdf.app/) — hospedado no **Cloudflare Pages** (não é mais Blogger).

> **Ops / deploy / release / regra “perguntar antes de fechar”:** ver o
> [`LEIA-ME.md` na pasta raiz `Pdf/`](../LEIA-ME.md). Este arquivo foca em ferramentas e changelog.

> **Offline (Fase 5):** Service Worker real em `./sw.js` (mesmo origin do Pages). Após a
> **primeira visita online**, shell + libs + tools da tag entram em cache e o app abre offline.
> O processamento do PDF continua 100% no aparelho. Em cada release: bump `VERSAO` em
> `index.html` **e** em `sw.js` (precache).

## Estrutura do projeto

```
Pdf/
├── LEIA-ME.md / PLANO-FASES.md   ← ops e fases (pasta raiz)
├── pdftools-theme.xml           ← LEGADO Blogger (não é produção)
└── meupdf/                      ← repo GitHub atm777/meupdf → Cloudflare Pages
    ├── index.html, style.css, sw.js, page-editor.js  ← shell no origin
    ├── PADROES.md, LEIA-ME.md
    ├── *.js (tools) + pdf-*.min.js                   ← tag → jsDelivr
```

### Produção: Cloudflare Pages (variante A) + JS no GitHub/jsDelivr

> Ops/release: **[`Pdf/LEIA-ME.md`](../LEIA-ME.md)**. Fases: **[`Pdf/PLANO-FASES.md`](../PLANO-FASES.md)**.

- **Host:** Cloudflare Pages (`meupdf.app` / pages.dev) — Git `atm777/meupdf`, `main`, sem Worker.
- **Shell:** `index.html`, `style.css`, `sw.js`, `page-editor.js` no origin do Pages.
- **Tools/libs:** jsDelivr `@VERSAO` (bump index + sw.js + tag no release).
- **`pdftools-theme.xml`:** legado — não publicar.

**Núcleo (`window.PDFTools` no `index.html`):** helpers compartilhados — carga de libs, leitura de
arquivo, rotação (`posicaoRotacionada`/`dimensoesVisuais`), `VERSAO`/`assetUrl`, erros
(`classificarErro`/`toastErro`), ícones (`ICONES_SVG`/`iconeSVG`) e `PDFTools.UI` (dropzone, zoom,
nav de páginas, modal a11y, próximos passos). Editores de página usam também `PDFTools.Editor`
(`page-editor.js`).

## Ferramentas (verbo na barra do topo → arquivo → id interno)

O rótulo do botão é uma palavra (`verbo`) ou duas em duas linhas (`verbo` / `verbo2`) quando uma só
deixava a ação ambígua — ex: "Exportar" sozinho não diz pra quê.

| Verbo (linha 2)         | Arquivo               | id                    |
|-------------------------|------------------------|-----------------------|
| Editar                  | estudio.js             | estudio_principal     |
| Organizar               | organizar.js           | organizar_paginas     |
| Juntar                  | juntar.js               | juntar_pdfs           |
| Converter               | imagens-para-pdf.js     | imagens_para_pdf      |
| Reduzir / Tamanho       | comprimir.js            | comprimir_pdf         |
| Tarjar                  | tarjar.js               | tarjar_pdf            |
| Assinar                 | assinar.js              | assinar_pdf           |
| Numerar                 | carimbar.js             | numerar_paginas       |
| Timbrar                 | carimbar.js             | marca_dagua           |
| Inspecionar / Metadados | inspecionar.js          | inspecionar_pdf       |
| Exportar / Imagem       | pdf-para-imagens.js     | pdf_para_imagens      |
| Extrair / Txt           | extrair-texto.js        | extrair_texto         |
| Dividir                 | organizar.js            | dividir_pdf           |

**"Editar" não é mais o Modo Estúdio** — não remove nem reordena páginas, não tem atalhos pra
Recortar/Tarjar/Comprimir (cada uma dessas tem botão próprio na barra). Agora é uma ferramenta
dedicada a pequenas edições, com um seletor de modo (Mover / Lápis / Texto / Marca — ícones SVG da
fonte única `PDFTools.ICONES_SVG`, não mais emoji) direto sobre a página, mais um botão **Girar**
que rotaciona a página aberta 90° por clique:
- **Girar**: um botão só, sempre no sentido horário (quatro cliques dão a volta completa). O giro é
  por página (navegar e voltar preserva), entra no Desfazer (Ctrl+Z) e é gravado no PDF final
  (`page.setRotation`). Os itens já colocados (traço/marca/texto) **giram junto com a página** — a
  marca e o traço ficam presos ao conteúdo (a marca vira alta/estreita sobre o texto que passou a
  ficar de lado); o texto é reancorado pelo centro no mesmo ponto do conteúdo e mantido na
  horizontal/legível (mesma convenção do resto do app, que sempre desenha texto na horizontal do
  espaço visual, inclusive em páginas que já vêm com `/Rotate`). "Aplicar a Todas" replica traços e
  textos, mas **não** o giro (cada página mantém a própria rotação).
- **Lápis**: desenho vetorial (não rasterizado) direto em cima da página — os traços são guardados
  como lista de pontos normalizados (0-1) + espessura em pt, então ficam nítidos em qualquer zoom e
  são exportados como operadores de linha reais do PDF (`page.drawLine`, ponta arredondada), não
  como imagem. Cursor do mouse vira um lápis (emoji via SVG embutido) enquanto esse modo tá ativo.
- **Texto**: clique no ponto da página pra abrir uma caixa e digitar ali mesmo (nada de modal
  separado); duplo clique (em qualquer modo exceto Lápis) reabre pra editar. Fonte (Helvetica/Times/Courier,
  negrito/itálico, tamanho em pt, cor) é ajustada ao vivo na barra lateral enquanto edita, com
  quebra de linha automática e WYSIWYG de verdade — a mesma função de quebra roda tanto na prévia
  quanto na exportação, então as linhas nunca ficam diferentes entre tela e PDF final. Caracteres
  fora do WinAnsi (que a fonte escolhida não suporta) bloqueiam a confirmação da caixa com um aviso
  específico, em vez de gerar um PDF com texto quebrado.
- **Marca (grifo/highlighter)**: clique e arraste sobre o texto pra grifar, 3 cores predefinidas
  (amarelo, verde fluorescente, rosa). O grifo é um retângulo de verdade desenhado com
  **`BlendMode.Multiply`** (opacidade cheia; o `opacity: 0.4` sobrou só como fallback pra versões do
  pdf-lib sem suporte a mesclagem), não uma imagem opaca por cima — multiplicação mantém o texto
  preto legível por baixo, enquanto opacidade lavava o texto junto com o fundo. O texto embaixo
  continua selecionável/extraível no PDF final, só fica visualmente marcado, igual um marca-texto
  físico. Um arrasto quase só horizontal ganha uma altura mínima de "uma linha de texto" pra não
  ficar fino demais. Item resultante é arrastável/redimensionável/apagável como qualquer outro (em
  qualquer modo exceto Lápis), só que sem o duplo-clique-pra-editar (não tem o que editar, é só cor).
- Zoom (mesmo controle compartilhado das outras ferramentas de página), navegador de páginas
  (setas ▲/▼, ver changelog) e um botão real de **Tela Cheia** (Fullscreen API do navegador, não só
  CSS cobrindo a viewport).

O Editar gira uma página por vez (acima); para remover/reordenar páginas, tarjar, comprimir etc.,
cada uma já tem seu próprio botão na barra.

**Ferramenta "Recortar Margens" removida** — código todo apagado de `organizar.js` (detecção
automática de margem por varredura de pixels, botão, badge "Recortada"), preservando intacto
`dividir_pdf` no mesmo arquivo (as duas nunca compartilharam nada). Também removida do `icones` e
do `FERRAMENTAS_HOME` em `index.html`/`pdftools-theme.xml`.

Não existe mais um botão "Preencher" (Preencher Formulário) — `formularios.js` foi apagado do
repositório.

Não existe mais um botão "Limpar" separado — limpar/editar metadados agora é feito dentro de
"Inspecionar" (card "Editar ou Limpar Metadados" na própria tela de inspeção). Também não existem
mais botões "Dividir" e "Fatiar" separados — um único "Dividir" (`dividir_pdf`) tem um seletor
"Por quantidade de páginas" / "Por tamanho (MB)" dentro da própria ferramenta.

Fluxo da home: a pessoa pode carregar um PDF na Mesa de Trabalho central (dropzone) primeiro, que
vira uma prévia (miniatura da 1ª página) e é herdado por qualquer ferramenta escolhida depois — ou
pode clicar direto num botão da barra sem carregar nada antes. Todos os botões ficam sempre ativos;
sem PDF na Mesa, a ferramenta escolhida abre na própria tela de upload dela (todo `montarUI` já
trata `arquivoInicial` ausente dessa forma).

## Regra de trabalho

> **Fonte canônica de processo:** [`Pdf/LEIA-ME.md`](../LEIA-ME.md) (secções 3 e 4).

Resumo obrigatório:

1. **Antes de tag/commit de release/push:** perguntar se ainda haverá mais alterações nesta rodada.
2. Código em `index.html` / `style.css` / `*.js` (repo `meupdf/`). **Não** atualizar Blogger/XML para produção.
3. Mudou `.js` → **tag nova** + bump de todas as URLs jsDelivr e `CACHE_NAME` no `index.html` → commit → push `main` + push da tag.
4. Mudou só shell (HTML/CSS) sem JS → push em `main` basta (Pages); tag só se quiser alinhar versão.
5. Registrar no changelog abaixo.
6. Smoke em https://meupdf.app / https://meupdf.pages.dev

## Changelog

> Histórico a partir desta sessão de trabalho — versões anteriores (`v1.0.0` a `v1.0.9`) não estão
> documentadas aqui.

- **Cloudflare Pages (variante A) + Git + domínio — Blogger fora de produção.** Projeto Pages
  `meupdf`; domínios `meupdf.app`, `www.meupdf.app`, `meupdf.pages.dev`; Git `atm777/meupdf`
  com auto-deploy (build vazio, saída `/`). JS via jsDelivr `@vX.Y.Z`. Doc operacional na raiz:
  [`Pdf/LEIA-ME.md`](../LEIA-ME.md) — inclui regra de **perguntar se há mais alterações** antes
  de fechar release (tag + index/css com jsDelivr + push). `pdftools-theme.xml` = legado.
  `gh` autenticado como `atm777`. Shell no `main` desde `44938d4`.
- **Fase 1 (padrões / rails):** ver [`Pdf/PLANO-FASES.md`](../PLANO-FASES.md) e
  [`PADROES.md`](./PADROES.md). Núcleo com `VERSAO`/`assetUrl`; kit CSS `.ft-*`; piloto
  `juntar.js` sem hex de tema claro. *(Local até release.)*
- **Fase 2 (PageEditor):** `page-editor.js` (`PDFTools.Editor`) no origin do Pages; Editar,
  Assinar e Tarjar usam escala/modal/thumbs/drag/resize compartilhados. *(Local até release.)*
- **Fase 3 (Organizar páginas):** id `organizar_paginas` em `organizar.js` — reordenar (drag),
  remover, girar; rota `#/organizar`; barra e home. *(Local até release.)*
- **Fase 4 (Robustez):** `classificarErro`/`toastErro`; `ehPDF` nas aberturas; compressão com
  UI honesta e fallbacks **sem** alterar o pipeline DCT/maxPx (eficiência preservada).
  *(Local até release.)*
- **Fase 5 (PWA offline real):** `sw.js` no Pages (não blob); precache shell + jsDelivr `@VERSAO`;
  rodapé com offline honesto (“depois da primeira visita”). *(Local até release.)*
- **Fase 6 polish (sem manual):** SEO/OG/Twitter/manifest; hero alinhado ao offline; tokens CSS
  nas tools que ainda tinham hex de tema claro. Manual do usuário **adiado**.
- **v1.0.21 — Release das fases 1–6a (Cloudflare Pages + padrões + PageEditor + Organizar +
  robustez + PWA offline + polish).** Tag `v1.0.21` no GitHub; `VERSAO` em `index.html` e `sw.js`;
  todas as URLs jsDelivr `@v1.0.21`. Inclui: `page-editor.js`, `sw.js`, `PADROES.md`,
  `organizar_paginas`, kit `.ft-*`, `toastErro`/`classificarErro`, SEO. Manual ainda fora.

> **Correção (auditoria, achado B1):** as entradas antigas abaixo dizem que as tags `v1.0.14`,
> `v1.0.16` e `v1.0.17` "ainda não existem no GitHub". Isso está **desatualizado** — a auditoria
> confirmou que as três tags existem no jsDelivr (HTTP 200) e que `@v1.0.17` é **byte-idêntico**
> ao conteúdo local (ex.: `estudio.js`, 66919 bytes nos dois). Produção reflete o local. Os avisos
> "⚠️ … ainda não existe" nas entradas seguintes ficam mantidos como registro histórico, mas não
> valem mais.

> **Correção (mesmo caso do B1, agora pra `v1.0.19`):** a entrada da `v1.0.19` abaixo diz "Criar a
> tag `v1.0.19` no GitHub" como se estivesse pendente. **Está desatualizado** — verificado nesta
> sessão que `@v1.0.19` responde no jsDelivr (HTTP 200) e serve `estudio.js`/`assinar.js`/`tarjar.js`
> com exatamente os tamanhos do local pré-`v1.0.20` (72059 / 50501 / 27071 bytes). A `v1.0.19` está
> publicada e bate com o local; produção reflete o que estava no repositório.

- **v1.0.20 — Ajuste fino pós-v1.0.19: Girar no Editar + acessibilidade dos modais + reduzir
  movimento + ícones de controle (Editar/Assinar/Tarjar + núcleo mudaram, ENTÃO gera tag nova).**
  Todas as URLs `@vX.Y.Z` do jsDelivr no XML e o `CACHE_NAME` (XML + `index.html`) atualizados de
  `v1.0.19` pra `v1.0.20`. **Criar a tag `v1.0.20` no GitHub** (commit + tag + push, ou upload
  manual) — o jsDelivr `@v1.0.20` só existe depois disso. Colar o `pdftools-theme.xml` atualizado no
  editor de tema do Blogger. Itens:
  1. **Botão "Girar" no Editor de página (`estudio.js`).** Um botão só, sempre horário, 90° por
     clique (quatro cliques = volta completa; desfazer um giro é Ctrl+Z ou 3 cliques — economiza a
     largura que um 2º botão custaria no seletor apertado a 380px). Giro **por página** (persiste ao
     navegar e voltar), entra no `salvarEstado()`/Desfazer e é gravado no PDF final
     (`page.setRotation(anguloOriginal + delta)`), desenhando os itens com o ângulo TOTAL (não o
     original). **Itens giram junto com a página:** marca e traço ficam presos ao conteúdo (fórmulas
     de remap derivadas e provadas: 4×90=identidade, 90+90=180, 90+(−90)=identidade); o texto é
     reancorado pelo centro no mesmo ponto do conteúdo e mantido horizontal/legível (mesma convenção
     que o app já usa pra `/Rotate`) — **decisão própria a conferir**: não fiz o texto virar de lado
     (exigiria render + hit-testing de item rotacionado no DOM, bem além de "ajuste fino"). "Aplicar
     a Todas" replica traços/textos mas **não** o giro (avisado no confirm). Escala "ajustar à tela"
     recalculada após girar (retrato↔paisagem). Miniatura da grade reflete o giro. **Não implementei**
     a troca automática pra Mover ao clicar num item (você decidiu contra). **Validação (Puppeteer +
     pdf.js, código real):** exportei e RENDERIZEI, conferindo por pixel que marca/traço/texto
     continuam sobre o mesmo trecho do conteúdo em giros 0/90/180/270 e em páginas que já vinham com
     `/Rotate 90` e `/Rotate 270` (12+ casos), com controle NEGATIVO (giro sem remap → falha,
     dist=0.59) provando que o teste discrimina; na UI real: girar→navegar→voltar preserva, Desfazer
     reverte, PDF gerado com pág.1=180° e pág.2=0° (giro por página). Zero erro de console.
  2. **Acessibilidade dos 5 modais (achado M5): `#est-modal-editor`, `#as-modal-editor`, `#tj-modal`,
     `#as-modal-criar`, `#as-modal-desenho`.** Utilitário único no núcleo,
     `PDFTools.UI.tornarModalAcessivel(el, {rotulo, botaoFechar})` (index.html + XML): `role="dialog"`
     + `aria-modal` + `aria-label`, foco movido pra dentro ao abrir (1º controle útil, nunca o
     canvas) e devolvido à origem ao fechar, foco **preso** (Tab/Shift+Tab só circulam no modal do
     topo — pilha global cobre o "desenho livre" abrindo por cima do editor no Assinar), e **Esc**
     fechando. Precedência do Esc respeitada: listener em fase *bubble*, então a caixa de texto do
     Editar (que faz `stopPropagation` e trata Esc como "confirmar") commita no 1º Esc e só o 2º
     fecha o modal; em tela cheia o Esc é do navegador (`document.fullscreenElement`) e é ignorado
     aqui, sem fechar o modal junto. Aplicado detectando abrir/fechar via `MutationObserver` do
     próprio `style` (chamado uma vez por modal) e desmontado no cleanup de cada ferramenta.
     **Validação (Puppeteer):** nos 5 modais, 20 Tabs seguidos sem o foco sair, Esc fecha, foco volta
     à origem; pilha ok (fechar o desenho volta ao editor ainda aberto); precedência do Esc do
     textarea confirmada (1º commita/salva "teste", 2º fecha). 26 asserções, zero erro.
  3. **`prefers-reduced-motion` (não existia no projeto).** Bloco `@media (prefers-reduced-motion:
     reduce)` em `style.css` e `<b:skin>` zerando durações de animação/transição e o scroll suave;
     como isso só mata a *duração*, os hovers de elevação (`translateY`) foram neutralizados um a um
     (`.toolbar-btn`, `.pdf-dropzone-botao`, `.pdf-btn-principal`, `.pdf-proximo-btn`,
     `.hero-tool-card`) — **de propósito não usei `transform: none` global**, que quebraria o
     `.pdf-toast` (depende de `translateX(-50%)` pra centralizar). O cartão de página do Editar
     (`.est-pagina:hover`) foi neutralizado dentro do próprio `<style>` injetado por `estudio.js`
     (que venceria a regra global por ordem de cascata).
  4. **Emojis do seletor de modo do Editar → SVG (parte do achado dos ícones).** `🖐️/✏️/📝/🖍️` viraram
     ícones SVG da fonte única — 5 ícones de interface novos no `ICONES_SVG` (`ui-mover`, `ui-lapis`,
     `ui-texto`, `ui-marca`, `ui-girar`, prefixo `ui-` pra não colidir com ids de ferramenta),
     consumidos por `PDFTools.iconeSVG()`. O botão Girar nasceu já como SVG. Escopo limitado ao
     seletor de modo do Editar: emojis de texto corrido (⚠️, ✨, ↺, ✕, 🔒) e os **cursores** de
     lápis/marca (que continuam sendo emoji-via-SVG de cursor, não ícones de controle) ficaram como
     estão, de propósito. Confirmado por Puppeteer: 4 botões de modo com 1 SVG cada, zero emoji, e o
     botão Girar com SVG.
  5. **Documentação do "Editar" no topo do LEIA-ME atualizada** (não só o changelog): grifo agora
     descrito como `BlendMode.Multiply` (opacidade cheia; `opacity:0.4` só fallback) com o porquê;
     arrasto/duplo-clique valem "em qualquer modo exceto Lápis" (não mais "no modo Mover"); seletor
     de modo descrito como SVG, não emoji; adicionado o botão Girar; e uma seção "Núcleo" descrevendo
     `PDFTools.ICONES_SVG`/`iconeSVG()` como fonte única de ícones e `tornarModalAcessivel`.
  - **Validação final (Puppeteer):** as 12 ferramentas abrem sem erro de console; Editar gera PDF
    **com página girada** + marca, e Tarjar gera, sem erro; home nos dois temas (escuro/claro) em
    380/768/1280 sem overflow horizontal e sem erro de console (21 asserções). Sincronia
    index.html↔XML conferida (configLibs do XML segue em jsDelivr — 3 libs; regiões espelhadas
    idênticas). `v1.0.19` confirmada viva no jsDelivr antes do bump.

- **v1.0.19 — Lote de correções visuais + espaço do editor + bug de mover texto (Editar/Assinar/
  Tarjar mudaram, ENTÃO gera tag nova).** Todas as URLs `@vX.Y.Z` do jsDelivr no XML e o
  `CACHE_NAME` (XML + `index.html`) atualizados de `v1.0.18` pra `v1.0.19`. **Criar a tag `v1.0.19`
  no GitHub** (commit + tag + push, ou upload manual) — o jsDelivr `@v1.0.19` só existe depois
  disso. Colar o `pdftools-theme.xml` atualizado no editor de tema do Blogger. Itens:
  - **Lote visual (Itens 1–5, só CSS/HTML/script de página — não exigiam tag por si; entram nesta
    tag porque `.js` de ferramenta também mudaram nos itens 6/7).** Aplicado em `index.html`,
    `style.css` e `<b:skin>`/includables do `pdftools-theme.xml`, mantidos em sincronia.
    1. **Barra do topo inalcançável no celular (crítico).** `.toolbar-ferramentas` ganhou
       `justify-content: safe center` (com `center` antes como fallback). Sem `safe`, o `center`
       distribuía o transbordo dos dois lados e a parte da esquerda (Editar/Juntar/Converter) ficava
       presa (scrollLeft não pode ser negativo). Medido em 380×800: `scrollWidth=714 clientWidth=310`,
       `scrollLeft=0`, "Editar" com left=0 dentro da área rolável (alcançável); idem em 320px; em
       1280px a barra continua centralizada (Editar left=195, sem overflow). O fade de rolagem
       (`.rola-esq`/`.rola-dir`) passou a aparecer no lado certo automaticamente (scrollLeft=0 = 1ª
       ferramenta), validado nos dois extremos.
    2. **Foco de teclado visível.** Regra global `:where(button,a,[tabindex],input,select,textarea):
       focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }` em `style.css` e
       `<b:skin>`. Medido: outline 2px sólido no acento de cada tema (escuro `rgb(56,189,248)`, claro
       `rgb(14,165,233)`) navegando por Tab sobre a barra e os cartões.
    3. **12 emojis → 12 ícones SVG inline** (24×24, traço 1.5, `stroke=currentColor`/`fill=none`) —
       herdam a cor do texto e funcionam nos dois temas. **Fonte ÚNICA de verdade**: `PDFTools.ICONES_SVG`
       + `PDFTools.iconeSVG(id)` no núcleo, usada pela barra (`renderizarToolbar`), pelos cartões da
       home (spans `.hero-tool-icone` preenchidos por JS a partir do `data-ferramenta`) e pelo bloco
       "E agora?" (`criarProximosPassos`) — o objeto `icones` e o `ICONES_PROXIMOS_PASSOS` (emojis)
       foram removidos, sem duplicar SVG. Tarjar (barra sólida sobre linha de texto), Timbrar (carimbo,
       não mais círculo+risco que lia como "proibido") e Numerar ("1" no rodapé) resolvidos. Peso extra
       no XML: ~2,5 KB (aceitável). Ícones renderizados 22px na barra / 24px nos cartões, sem emoji
       restante, zero erro.
    4. **Hierarquia da home.** Dropzone agora é o elemento mais pesado: `max-width` 460→600px, versão
       de destaque com botão sólido "Escolher PDF" (`criarDropzone` ganhou `textoBotao`/`dica`,
       retrocompatível — as outras ferramentas seguem na versão compacta) e uma linha do que aceita
       (PDF; Converter aceita JPG/PNG/WebP; Juntar aceita vários). O recolhimento da grade (6 cartões +
       "Ver todas as 12 ferramentas") passou a valer também no desktop — a regra `.recolhido
       :nth-child(n+7){display:none}` e o `.hero-ver-todas{display:block}` saíram do `@media(max-width:
       700px)` para a base. Medido: dropzone 600×337, 6 cartões visíveis recolhido → 12 ao expandir.
       Textos dos cartões não mexidos.
    5. **`<h1>`/`<h2>` e resíduo de offline.** O `<h1>` do cabeçalho (título do blog, escondido por
       `clip`) virou `<div aria-label='Meu pdf'>` (sem semântica de heading); o título do hero
       ("Ferramentas de PDF grátis, direto no navegador") foi promovido de `<h2>` a `<h1>` — a home
       passa a ter exatamente UM `<h1>`, com as palavras buscadas. O `<h2>` "Ferramenta" do
       `#workspace` virou `<div id='workspace-title'>` (não polui o outline de headings antes do
       conteúdo real), com CSS preservando o peso visual. Removido `pdf offline` do `meta keywords`.
  - **Item 6 — Espaço vertical do editor de página (Editar/Assinar/Tarjar).** Investigado por medição
    (não por palpite). **Causa real = H1**: o `backdrop-filter: blur(12px)` do `#workspace` cria um
    *containing-block* que prende o `position: fixed` do modal DENTRO do workspace (não da viewport) —
    medido: em 1280×620 o overlay ficava 958×530 em (92,161); removendo o filtro dinamicamente,
    passou a 1280×620 em (0,0). Correção: classe `body.pdf-editor-modal-aberto` liga
    `#workspace{backdrop-filter:none}` enquanto o modal está aberto (invisível, pois o modal cobre
    tudo), ligada/desligada no abrir/fechar de cada um dos três editores. Somados os fatores H2
    (padding 24→8px e topbar compacta em telas baixas/estreitas via `@media`; a constante `padding=48`
    de `calcularEscalaAjuste` deixou de ser fixa e passa a ler o padding real do modal-body; e
    `calcularEscalaAjuste` agora é rechamado em `resize`/`orientationchange`). **Ganho medido**: página
    (canvas) 299×424 → **394×558** no desktop 1280×620 (+32%) e 226×319 → **300×424** no celular
    380×800 (+33%). No desktop a sobra vertical caiu para 16px (só padding); no celular a página é
    retrato e fica limitada pela LARGURA (preenche os ~300px úteis dos 380 de tela) — só ficaria mais
    alta ultrapassando a largura da tela, é o limite físico. Aplicado nos três (`estudio.js`,
    `assinar.js`, `tarjar.js`).
  - **Item 7 — Bug "mover a caixa de texto não funciona logo depois de digitar" (Editar).** Reproduzido
    por Puppeteer (cenários a–d). **Causa = H1 (afordância)**, não H2/H3: ao terminar de digitar a
    pessoa segue no modo Texto, onde o arrasto era bloqueado (`if modoAtual==='mover'`) — "não move" —
    e, pior, o clique em modo Texto disparava a criação de uma caixa nova por cima e o re-render
    descartava o `textarea` não-commitado, **perdendo o texto**. H2 (corrida do commit) é risco latente
    que não reproduziu com timing normal; H3 não ocorreu. Correções em `estudio.js`: (1) clicar num
    item existente em modo Texto seleciona/arrasta esse item em vez de criar caixa nova; (2) itens
    passam a ser arrastáveis/redimensionáveis em qualquer modo exceto Lápis (não precisa mais trocar
    pra Mover); (3) um clique que fecha (commita) uma caixa aberta não cria outra caixa (flag
    `cliqueFechouEdicao`) — some a "caixa fantasma"; (4) `doMove`/`doEnd` guardam a REFERÊNCIA do
    elemento e do item (não o índice) — blindagem contra H2/H3. Validado: fluxo "digitar → concluir →
    arrastar a caixa ainda em modo Texto" move de fato; sem perda de texto; sem caixa fantasma;
    duplo-clique-para-editar e arrasto saindo da área do item (bugs do changelog v1.0.16) não
    regrediram; zero erro de console. **Proposta em aberto (você pediu para propor antes): trocar
    automaticamente para o modo Mover ao clicar num item existente** — deixaria o gesto ainda mais
    natural; não implementado sem seu aval.
  - Validação final: as 12 ferramentas abrem sem erro; resultado gerado em Editar, Tarjar e Juntar;
    home sem erro e sem overflow horizontal nos dois temas em 380/768/1280; **zero requisição de rede
    nova** (único host externo é `blogger.googleusercontent.com`, do logo/favicon/og-image já
    existentes; os 12 ícones são SVG inline). Sintaxe dos 3 blocos de script do XML e dos `.js`
    conferida.

- **v1.0.18 — Lote de correções de baixo risco da auditoria (vários `.js` de ferramenta mudaram,
  ENTÃO gera tag nova).** Todas as URLs `@vX.Y.Z` do jsDelivr no XML e o `CACHE_NAME` (XML +
  `index.html`) atualizados de `v1.0.17` pra `v1.0.18`. **Criar a tag `v1.0.18` no GitHub** (commit
  + tag + push, ou upload manual) — o jsDelivr `@v1.0.18` só existe depois disso. Itens:
  - **A3 — Cleanup de listeners.** `assinar.js`, `estudio.js`, `tarjar.js` e `organizar.js` agora
    retornam do `montarUI` uma função de cleanup que remove exatamente os listeners que ficam no
    `document` (mesmas referências — os handlers anônimos de `keydown`/`fullscreenchange` viraram
    funções nomeadas pra poder removê-los) e desliga o `IntersectionObserver` de miniaturas. O
    encanamento que chama o cleanup já existia em `index.html` (`abrirFerramenta`/`mostrarHome`).
    Testado instrumentando a contagem de listeners do `document`: net 0 após 5 ciclos abrir/voltar.
  - **M2 — fflate fora do caminho de rede.** `comprimir.js` não busca mais `unpkg.com` em tempo de
    execução. Quando o navegador não tem `DecompressionStream` nativo, a imagem Flate+DCT é pulada
    (degradação graciosa, entra na contagem de "não tratadas"), em vez de baixar biblioteca externa
    — zero requisição de rede nova, e some o risco de a Promise ficar pendurada offline.
  - **M3 — Não ignorar arquivo em silêncio.** `tarjar.js`, `organizar.js` e `comprimir.js` passaram
    a validar pelo header `%PDF` (`PDFTools.ehPDF`) em vez do `file.type`, mostrando
    `PDFTools.erro('nao_e_pdf')` quando não é PDF. Um `.pdf` com MIME vazio/estranho agora abre
    normalmente; um não-PDF mostra mensagem em vez de não reagir.
  - **M4 — Mensagens de erro no carregamento.** Padronizadas as duas ferramentas que estavam fora
    do padrão (`carimbar.js` e `inspecionar.js`): agora todas usam o catálogo `PDFTools.erro`
    (`pdf_protegido` detectado por `PasswordException`/`encrypted`; senão `pdf_corrompido` com a
    `err.message` só dentro do `<details>` de detalhes técnicos), com `console.error` mantido.
  - **M8 — Vazamentos menores.** `imagens-para-pdf.js` revoga no cleanup os object URLs das
    miniaturas (antes só o botão de remover item revogava). E o `window.__activePdfDocs` deixou de
    acumular docs já destruídos: `doc.destroy()` agora tira o doc da lista, e o `limparMemoriaPDF`
    copia-e-zera antes de destruir.
  - **B5 — Toast seguro.** `mostrarToast` usa `textContent` (não `innerHTML`); os dois chamadores
    que passavam HTML (`juntar.js`, `imagens-para-pdf.js`) passaram a mandar texto simples do
    catálogo.
  - **B3 — Nome de arquivo com acento.** `juntar.js` e `imagens-para-pdf.js` exibem o nome via
    `textContent` (preserva "Relatório Anual.pdf" e é seguro contra HTML). `sanitizarNome` continua
    valendo só para o nome do arquivo de download.
  - **B4 — Variável CSS faltando.** Definida `--cor-sucesso-fundo: rgba(16, 185, 129, 0.15)` no
    `:root` (`style.css` + `<b:skin>`) — usada no painel "Honestidade na Assinatura" do
    `assinar.js`. Translúcida de propósito, funciona nos dois temas sem redefinir. (Mudança de CSS,
    mas entra na mesma tag porque os `.js` já mudaram.)
  - **B2 — Opção morta removida.** Tirada a opção "Preservar marcadores" do `juntar.js` (era lida e
    nunca usada). Não foi implementada cópia de outline — só removida a opção.
  - **B6 — `share_target` órfão removido.** Retirado do manifest (data URL) em `index.html` e no XML,
    já que não havia handler lendo os parâmetros. `file_handlers` continua ausente (não estava em
    escopo).
  - **Fora de escopo (proposital, avisado):** os 8 toasts de *geração* que ainda mostram
    `'Erro: ' + err.message` NÃO foram reescritos — vários carregam mensagens amigáveis e
    localizadas (ex.: o aviso de caractere não suportado do Editar, "Nenhuma imagem válida…" do
    Converter), e um toast não comporta o bloco `<details>`; trocar tudo é mais amplo/arriscado que
    o combinado "baixo risco". Fica para uma decisão sua. Os erros de *carregamento* (senha/
    corrompido/não-é-PDF), que eram os que vazavam stack trace, já estão no catálogo.
  - Testado localmente (Puppeteer): contagem de listeners (A3), arquivo silencioso (M3), corrompido
    + senha (M4), e regressão abrindo e gerando resultado nas 12 ferramentas com zero erro de
    console. Ver relatório da tarefa.

- **Home informativa + rotas por hash + afordância na barra (só CSS/HTML/script de página — NÃO
  gera tag nova; nenhum `.js` de ferramenta mudou).** Aplicado em `index.html`, `style.css` e
  `pdftools-theme.xml`, mantidos em sincronia.
  - **Home informativa:** quando não há PDF carregado, `#hero-mesa` agora mostra, além da dropzone
    (que continua sendo o elemento de maior peso), um bloco `#hero-info` **estático no HTML** (para
    o buscador): título + proposta, passo-a-passo de 3 passos, um cartão por ferramenta (as 12 do
    `FERRAMENTAS_HOME`, com ícone/nome/uma frase do que faz) e uma linha de privacidade. Os cartões
    são clicáveis e abrem a ferramenta pelo mesmo caminho do botão da barra. Ao carregar um PDF o
    bloco some e dá lugar à prévia; "Trocar arquivo" traz de volta. Mobile: cartões em 2 colunas e
    botão "Ver todas as 12 ferramentas" que recolhe/expande a grade (só no celular). Os textos dos
    cartões foram escritos a partir do que cada `.js` realmente faz — **sem prometer OCR** (não
    existe) nem "preservar marcadores" (opção que hoje não faz nada, achado B2).
  - **Rota por ferramenta (hash `#/slug`):** tabela única `ROTAS` (slug em português → id interno).
    Abrir uma ferramenta empilha no histórico; o botão voltar do navegador (e o "← Voltar") retorna
    à home; carregar a página já com `#/tarjar` abre direto na tela de upload da ferramenta (arquivo
    nunca vai na URL); `pdftools:ir-para` também atualiza a URL; hash desconhecido cai na home sem
    erro. `<title>`/meta description mudam por rota. O caminho de volta pra home usa a mesma função
    de saída (`mostrarHome`) que o botão "← Voltar" — sem duplicar o cleanup (achado A3: as
    ferramentas ainda não devolvem cleanup próprio; isso não foi alterado aqui).
  - **Afordância de rolagem da barra (achado M5, parte):** a barra de 12 botões agora esmaece (fade
    via `mask-image`) o lado que ainda tem ferramenta fora da vista, ligado por um listener de
    scroll (classes `.rola-esq`/`.rola-dir`). Só CSS + JS, sem biblioteca.
  - **Frases de privacidade corrigidas (achado C1):** a promessa de offline ("desligue a internet")
    foi trocada por uma afirmação verdadeira de privacidade no rodapé (`index.html` + XML) e na 1ª
    frase deste LEIA-ME. Nenhum texto novo afirma funcionamento offline — isso volta quando C1 for
    corrigido.
  - Testado localmente com Puppeteer (ver relatório): home informativa visível e dropzone funcional,
    prévia ao carregar PDF e volta ao trocar, cartões abrindo a ferramenta certa, rotas (abrir
    `#/tarjar` direto, navegar entre 3 ferramentas e voltar pela seta do navegador, hash inválido,
    título mudando), viewport de 380px sem estouro horizontal com a afordância aparecendo/sumindo, e
    **zero requisição de rede nova** além das que já existiam.
- **⚠️ v1.0.17 — XML atualizado, ainda não commitada/publicada no GitHub.** Bump de versão pedido
  pelo usuário após alterações adicionais no código (detalhe ainda não registrado aqui — avisar
  o que mudou pra completar este item). Todas as URLs `@vX.Y.Z` do jsDelivr no XML e o
  `CACHE_NAME` (XML + `index.html`) atualizados de `v1.0.16` pra `v1.0.17`. **Tag `v1.0.17` ainda
  não existe no GitHub.**
- **⚠️ v1.0.16 — XML atualizado, ainda não commitada/publicada no GitHub.** Novo modo **"🖍️ Marca"**
  (grifo/highlighter) no Editar — ver descrição atualizada da ferramenta acima. Também um ajuste
  fino pedido junto: cursor do mouse vira um lápis de verdade (emoji, via SVG embutido) no modo
  Lápis (e um marcador no modo Marca), em vez do crosshair genérico de antes.
  - **Três bugs reais encontrados testando o novo modo, corrigidos em `estudio.js`** (itens 1, 2
    e 4 abaixo — o item 3 é só um ajuste de UX, não um bug):
    1. Arrastar ou redimensionar um item (texto OU marca) só funcionava enquanto o mouse
       continuava exatamente em cima do item — assim que o arrasto saía da área dele, o gesto
       "travava" (o listener de `mousemove`/`mouseup` estava preso ao `#est-layer`, que é
       `pointer-events: none` fora dos itens, então parava de receber eventos assim que o ponteiro
       saía da área pointer-events:auto do item). Corrigido movendo esses listeners pro
       `document` inteiro. **O mesmo bug existia em `assinar.js`** (idêntico, mesmo padrão de
       código) — corrigido lá também. `tarjar.js` não tinha o problema (o layer dele não usa
       `pointer-events: none`).
    2. Desfazer (Ctrl+Z) pulava uma mudança a mais do que devia — o botão descartava o topo da
       pilha de histórico e restaurava o que vinha *antes* dele, em vez de restaurar o próprio
       topo. Corrigido usando o valor que sai do `pop()` diretamente como o estado a restaurar.
       Esse bug era só do `estudio.js` (reescrito nesta sessão) — `tarjar.js`/`assinar.js` já
       faziam certo.
    3. Pequeno ajuste de UX encontrado no caminho: mover ou redimensionar um item, no Editar,
       desmarcava a seleção (o re-render reconstrói o DOM do zero e perde a classe `.ativo`),
       escondendo os cabos de redimensionar/apagar logo depois do gesto — reaplicada a seleção
       depois do re-render.
    4. **Bug encontrado em teste manual do usuário (2026-08-06):** um clique no modo Marca sem
       nenhum arrasto de fato (ou um clique perdido logo depois de um arrasto) criava um item de
       grifo quebrado — `width`/`height` só eram definidos dentro do `mousemove`, então sem esse
       evento rodar entre o mousedown e o mouseup eles ficavam como string vazia,
       `parseFloat('') = NaN`. A checagem que devia descartar cliques minúsculos (`wFrac < 0.01`)
       não pegava esse caso porque qualquer comparação com `NaN` é sempre falsa em JS — o item
       quebrado entrava na lista e só estourava depois, ao clicar em "Gerar PDF Editado"
       (`options.x must be of type number... was NaN` do pdf-lib). Corrigido inicializando
       `width`/`height` do elemento temporário em `0px` já no mousedown, e trocando a checagem
       para `!(wFrac >= 0.01) || !isFinite(xFrac) || !isFinite(yFrac)` (barra NaN também, não só
       valores pequenos).
  - Testado localmente (Playwright): criar marca por arrasto, arrasto quase-horizontal virando
    altura mínima de uma linha, arrastar/redimensionar/apagar/desfazer um item existente, geração
    do PDF final com o retângulo translúcido de verdade (conferido: texto continua extraível por
    baixo do grifo, e o render da página mostra o texto legível através da cor), zero erros de
    console em todos os cenários.
  - Todas as URLs `@vX.Y.Z` do jsDelivr no XML e o `CACHE_NAME` (XML + `index.html`) foram
    atualizados de `v1.0.14` pra `v1.0.16` (pulou `v1.0.15` — nunca chegou a virar tag, o bug do
    item 4 foi achado antes de publicar). **Tag `v1.0.16` ainda não existe no GitHub.**
- **⚠️ v1.0.14 — XML atualizado, ainda não commitada/publicada no GitHub.** Navegador de páginas
  (setas ▲/▼ + número da página) nos três editores de página que abrem uma página por vez
  (Assinar, Tarjar, Editar) — a pessoa pode ir pra próxima/anterior sem sair do editor e sem
  precisar fechar e reabrir pela grade de miniaturas. Componente novo e compartilhado,
  `PDFTools.UI.criarNavegadorPaginas` (`index.html`, junto do `criarControleZoom`), usado pelos
  três arquivos via `aoNavegar: (i) => abrirEditor(i)` — como o modal nunca fecha ao trocar de
  página, zoom e (no Editar) tela cheia continuam do jeito que estavam. Fica como um item à
  esquerda da própria página dentro do modal (não no topo), desabilitando a seta ▲ na primeira
  página e ▼ na última. `carimbar.js` (Timbrar/Numerar) ficou de fora de propósito — não tem esse
  padrão de modal por página, é uma tela única com prévia e campo de número.
  - **Bug de corrida corrigido no Editar**: como agora dá pra navegar de página com um texto ainda
    sendo digitado (sem ter clicado em outro lugar pra confirmar antes), o `commit()` da caixa de
    texto usava `paginaAtualModal`/`visPageWidthPt`/`visPageHeightPt` "ao vivo" — se a pessoa já
    tivesse navegado, o texto podia ser salvo na página errada ou redimensionado com as dimensões
    da página nova. Corrigido capturando página e dimensões no momento em que a edição começa
    (`abrirEdicaoTexto`), e usando essa captura em vez das variáveis ao vivo dentro do `commit()`.
    Testado especificamente: digitar texto, clicar ▼ direto sem confirmar, voltar — o texto está
    salvo certo na página original, e a página nova não ganhou nada indevido.
  - **Aproveitei a mexida pra corrigir a mesma "página maior que a tela" do Tarjar e do Assinar**
    que já tinha corrigido no Editar numa rodada anterior — os dois calculavam a escala de "ajustar
    à tela" com frações fixas de `window.innerWidth/innerHeight`, sem descontar a barra do topo de
    verdade nem (agora) a faixa do navegador. Trocado pelo mesmo `calcularEscalaAjuste` baseado no
    espaço real de `#tj-modal-body`/`#as-modal-body`.
  - Testado localmente (Playwright) nos três: abrir página 1, navegar pra 2 e voltar pra 1 sem o
    modal fechar/reabrir, checagem de tela cheia preservada no Editar, zero erros de console.
  - Todas as URLs `@vX.Y.Z` do jsDelivr no XML e o `CACHE_NAME` (XML + `index.html`) foram
    atualizados de `v1.0.13` pra `v1.0.14`. **Tag `v1.0.14` ainda não existe no GitHub** — só
    depois que existir (via commit+tag+push, ou upload manual como da vez passada) é que o
    jsDelivr vai servir o conteúdo novo nessa URL.
- **Botões da barra do topo não ficam mais desabilitados/translúcidos sem PDF carregado** — o
  usuário notou que "Converter" (`imagens_para_pdf`) exigia carregar um PDF qualquer na Mesa de
  Trabalho primeiro pra depois poder escolher a imagem, mesmo essa ferramenta não usando PDF
  nenhum. Investigando, todo `montarUI` das 12 ferramentas já trata `arquivoInicial` ausente
  mostrando a própria tela de upload (`if (arquivoInicial) abrirArquivo(...)`) — o bloqueio era só
  uma camada de CSS/JS por cima (classe `.desabilitada`, `pointer-events: none`), sem necessidade
  real por trás. Removida essa camada inteira: `renderizarToolbar()` não marca mais os botões como
  `desabilitada`, e as funções `ativarFerramentas`/`desativarFerramentas` (e todas as chamadas a
  elas) foram apagadas de `index.html` e do XML, junto com a regra CSS correspondente em
  `style.css`/`<b:skin>`. Continua igual quando JÁ tem PDF na Mesa (a ferramenta abre com ele
  pré-carregado); sem PDF, agora qualquer botão cai direto na tela de upload da própria ferramenta.
  Testado localmente (Playwright): clique em "Converter" e "Tarjar" sem PDF carregado, e em
  "Tarjar" com PDF já carregado — os três cenários funcionam sem erro de console. Alteração só de
  CSS/HTML/script de página (nenhum `.js` de ferramenta mudou), então não gera tag nova.
- **✅ v1.0.13 publicada** — o usuário subiu o conteúdo direto pelo GitHub (tela de "upload files"),
  não por um `git push` normal. Isso criou um commit novo (`4b231f5`) direto na `main` do GitHub,
  divergente do histórico local deste repositório (que tinha um commit `c6a7e29` diferente pra
  "v1.0.12"). A tag `v1.0.13` existe no GitHub e o jsDelivr já serve o conteúdo certo — confirmado
  via `git ls-remote`/`git show origin/main:...` e testando a URL do jsDelivr direto. **Atenção**:
  o repositório git local (pasta `meupdf`) e o GitHub real podem seguir divergentes depois disso —
  antes de assumir que um `git log`/`git diff` local reflete produção, confira direto no GitHub.
  Resumo do que mudou nessa versão:
  - **Alinhamento do logo/barra corrigido no Blogger** — o Blogger embrulha `<b:section id="header">`
    e o `<b:widget>` de dentro em divs próprias (`.section`, `.widget`, `.widget-content`), o que
    quebrava o flex de `.topo-toolbar` só em produção (nunca reproduzia local, já que o
    `index.html` não passa por esse envelopamento). Corrigido com
    `#header, #header .widget, #header .widget-content { display: contents; }`, aplicado em
    `style.css` e no `<b:skin>` do XML — **ainda não verificado ao vivo no Blogger** (não tenho
    acesso); confira na prévia do tema antes de publicar de vez.
  - **"Editar" (`estudio.js`) reescrito por completo** — ver descrição atualizada da ferramenta
    acima na tabela. Troquei o desenho por um modal separado por um seletor de modo (Mover/Lápis/
    Texto) direto sobre a página, com traços vetoriais (não mais PNG rasterizado), texto
    clique-para-inserir com WYSIWYG real (fonte/tamanho/cor iguais na tela e no PDF, quebra de
    linha automática, checagem de caractere não suportado) e tela cheia de verdade (Fullscreen
    API). Testado localmente com Playwright: desenho, zoom, tela cheia, texto (inserir, editar
    fonte ao vivo, reabrir com duplo clique), geração do PDF final e abertura do resultado pra
    conferir o conteúdo (texto extraído + render da página).
  - **Bug real encontrado e corrigido durante o teste**: uma caixa de texto criada perto da borda
    direita da página podia ficar mais larga que o espaço disponível até a borda, fazendo o texto
    (ou parte dele) ser desenhado fora da página — visível ao renderizar o PDF, mesmo com o dado
    intacto no item. Corrigido limitando a largura automática (e o redimensionamento manual) ao
    espaço realmente disponível até a borda direita, em `recalcularCaixaTexto` (`estudio.js`).
  - **Outro bug corrigido**: o cálculo de "ajustar à tela" do editor usava uma fração fixa de
    `window.innerHeight`, sem descontar a altura real da barra superior do modal (que pode ocupar
    1 ou 2 linhas dependendo da largura da tela) — em telas mais estreitas a página renderizava
    parcialmente atrás da barra, inacessível a clique/toque. Trocado por uma medição do espaço
    realmente disponível em `#est-modal-body` (`clientWidth`/`clientHeight`), tanto na abertura do
    editor quanto ao entrar/sair da tela cheia.
  - **Decisão própria a conferir**: no lápis, usei `page.drawLine()` (com `LineCapStyle.Round`) em
    vez de `page.drawSvgPath()` como foi aprovado inicialmente — decidi na hora por reaproveitar o
    mesmo pipeline de rotação (`posicaoRotacionada`) já testado no resto do código, evitando um
    risco de convenção de coordenadas do SVG que eu não tinha verificado. Visualmente e na
    exportação ficou correto nos testes (inclusive com páginas rotacionadas), mas vale conferir.
  - **Ferramenta "Recortar Margens" removida** — código apagado de `organizar.js` (detecção
    automática por varredura de pixels, botão, badge "Recortada"), preservando `dividir_pdf`
    intacto no mesmo arquivo. Removida do `icones`/`FERRAMENTAS_HOME` em `index.html` e no XML.
    Testado que "Dividir" continua funcionando normalmente depois da remoção.
  - **3 ajustes pequenos**: ícone 🧰 do `estudio_principal` que faltava em `ICONES_PROXIMOS_PASSOS`
    (`index.html` e XML); comentário desatualizado do `criarControleZoom`/CSS de zoom que ainda
    citava "Preencher Formulário" (ferramenta que já não existe) corrigido para "Assinar, Tarjar,
    Editar"; conferido que `.pdf-proximo-nome` não precisa de regra própria (a herança já resolve).
  - Todas as URLs `@vX.Y.Z` do jsDelivr no XML (11 scripts de ferramenta + as 3 libs de terceiros)
    e o `CACHE_NAME` (XML + `index.html`) foram atualizados de `v1.0.12` para `v1.0.13`, já que
    `estudio.js` mudou. Verificação de sincronia CSS/script-núcleo/script-da-home entre o XML e o
    `index.html` local: idênticos, exceto a diferença esperada do `configLibs` (jsDelivr no XML vs.
    `./arquivo.js` local).
- **Domínio trocado de `meupdf.torbr.com` para `meupdf.app`** — atualizado nas referências
  hardcoded do `index.html` (`og:url` e `<link rel="canonical">`) e na descrição do projeto aqui
  no `LEIA-ME.md`. **Não mexe no `pdftools-theme.xml`**: lá o domínio já é dinâmico
  (`expr:content='data:blog.canonicalUrl'` / `expr:href='data:blog.canonicalUrl'`), controlado
  pela configuração de domínio personalizado no próprio painel do Blogger — só precisa apontar o
  domínio novo lá, o tema acompanha sozinho. Ajuste só de documentação/local; **não gera tag nova
  no GitHub** (nenhum `.js` de ferramenta mudou).
- **⚠️ v1.0.12 commitada e taggeada localmente, push pendente** — commit `c6a7e29` e a tag
  `v1.0.12` já existem no repositório git local com tudo desta entrada + as anteriores (unificação
  Dividir/Inspecionar, margem de segurança, zoom nos editores, "Editar" reformulado, Preencher
  removido). O `pdftools-theme.xml` já foi atualizado pra apontar pro jsDelivr `@v1.0.12` e o
  `CACHE_NAME` também foi atualizado. **Falta só o `git push origin main --tags`** — não consigo
  autenticar no GitHub a partir deste ambiente (mesmo problema de outras vezes), então o usuário
  precisa rodar esse push manualmente antes do XML valer alguma coisa em produção (o jsDelivr
  `@v1.0.12` só existe depois que a tag for enviada).
- **"Editar" deixou de ser o Modo Estúdio** (`estudio.js` reescrito) — não organiza mais páginas
  (sem girar/remover/reordenar/atalhos pra Recortar/Tarjar/Comprimir — cada uma já tem botão
  próprio na barra). Agora é uma ferramenta de pequenas edições: escolher uma página mostra um
  aviso explicando o escopo, depois "✏️ Lápis" (mesmo motor de desenho livre do Assinar — tamanhos
  e paleta de cores) ou "📝 Caixa de Texto" (digitar, clicar "Incluir", depois arrastar/redimensionar
  onde quiser). Ganhou o mesmo controle de zoom dos outros editores de página e um botão "Aplicar a
  Todas". Nome interno do card mudou pra "Pequenas Edições" (o botão da barra continua "Editar").
- **Botão "Preencher" removido** — `preencher_form`/`formularios.js` foi apagado do repositório
  (considerado desnecessário).
- **Zoom nos editores de página (Assinar, Tarjar, Preencher Formulário)** — as três ferramentas
  que abrem uma página para edição direta (assinar/tarjar/preencher) ganharam um controle de zoom
  compartilhado (`PDFTools.UI.criarControleZoom`, novo em `index.html`/`ui.js`): botões `−`/`+`/🔍
  (ajustar à tela) na barra superior do editor, além de pinça de dois dedos no celular. O zoom
  multiplica a escala de "ajustar à tela" já calculada por cada ferramenta e re-renderiza a página
  e os itens posicionados nela (assinatura, tarja, texto) na escala nova — o corpo do modal já
  tinha `overflow: auto`, então dá pra arrastar/rolar quando a página fica maior que a tela.
  **Correção no processo**: ao re-sincronizar o script principal do `PDFTools` inteiro pro XML,
  o bloco `configLibs` (URLs do `pdf-lib.min.js`/`pdf.min.js`/`pdf.worker.min.js`) quase foi
  sobrescrito com os caminhos locais (`./pdf-lib.min.js`) que o `index.html` usa para rodar aqui no
  PC — no XML esses três precisam continuar apontando pro jsDelivr, sempre. Revertido antes de
  seguir. Aproveitando a conferência, também encontrei e removi uma tag `<script>` do
  `metadados.js` que tinha sobrado no XML da fusão Dividir/Inspecionar anterior (o arquivo já não
  existe mais, e o `index.html` já não o referenciava).
- **Prévia do Timbrar/Numerar atualiza sozinha ao trocar de página** — nas ferramentas "Timbrar"
  e "Numerar Páginas" (mesmo motor, `carimbar.js`), mudar o número em "Visualizar página:" não
  atualizava a prévia sem clicar em "Atualizar Pré-visualização". Adicionado um listener no campo
  de página que chama a prévia automaticamente — trocar de página é uma ação discreta (diferente de
  digitar o texto do timbre), então não precisa do clique manual. O botão "Atualizar
  Pré-visualização" continua existindo para as outras mudanças (texto, imagem, posição, etc.).
- **Explicação da ferramenta "Recortar Margens"** — adicionado um parágrafo "Como funciona"
  dentro da própria tela da ferramenta, explicando que ela detecta automaticamente onde termina o
  conteúdo e começa a margem em branco de uma página, e que o corte é aplicado a partir da página
  selecionada (replicado nas demais selecionadas, ou em todas se só uma estiver marcada).
- **Rótulos de dois botões renomeados / com segunda linha** — para desambiguar ações que um
  verbo só não deixava claras: "Exportar" → "Exportar / Imagem", "Extrair" → "Extrair / Txt",
  "Inspecionar" → "Inspecionar / Metadados", e "Comprimir" virou "Reduzir / Tamanho" (nome mais
  direto pro que a ferramenta faz).
- **Rodapé sem desalinhamento** — a frase de privacidade tinha um `max-width: 480px` que a
  deixava visivelmente puxada pra esquerda em relação às outras duas linhas do rodapé. Removido:
  agora as três linhas dividem a mesma largura e o mesmo centro.
- **"Dividir" e "Fatiar" unificados em um só botão "Dividir PDF"** (`dividir_pdf`, em
  `organizar.js`) — dentro da ferramenta, um seletor "Por quantidade de páginas" / "Por tamanho
  (MB)" alterna qual campo aparece; o motor por baixo (`aplicarEdicoes`) continua o mesmo para os
  dois modos.
- **"Inspecionar" e "Limpar" unificados** — o botão "Limpar" (`editar_metadados`, em
  `metadados.js`) deixou de existir. Toda a edição/limpeza de metadados (título, autor, assunto,
  palavras-chave, criador, produtor) agora vive dentro de "Inspecionar Privacidade"
  (`inspecionar.js`), num card "Editar ou Limpar Metadados" com os mesmos campos e botões de
  antes. O alerta "Metadados Vazados" do relatório de privacidade, que antes navegava para a
  ferramenta separada, agora limpa na hora sem sair da tela. `metadados.js` foi apagado do
  repositório (funcionalidade toda migrada, nada ficou duplicado).
- **Margem de segurança de 2,5% no tamanho-alvo** (`organizar.js` "Dividir por Tamanho" e
  `comprimir.js` "Comprimir PDF") — um testador reportou arquivo maior que o limite escolhido
  (ex: pediu 10 MB, saiu um pouco acima). Causa: o Windows exibe tamanho de arquivo em unidades de
  1024 (MiB rotulado como "MB"), o que deixa pouca folga perto do limite. Agora o valor digitado é
  tratado internamente como 2,5% menor (`param * 1024 * 1024 * 0.975`) antes de qualquer cálculo —
  a tela continua mostrando o número que a pessoa digitou, só o processamento interno mira um pouco
  abaixo para garantir margem.
- **Logo na mesma linha, prévia gigante, rodapé uniforme** — `.topo-toolbar` ganhou
  `flex-wrap: nowrap` explícito e `.toolbar-ferramentas` ganhou `min-width: 0` (defensivo contra
  navegadores que quebram a linha do logo quando o flex item não pode encolher). A miniatura do PDF
  na Mesa de Trabalho deixou de ter um tamanho fixo pequeno (200px) e agora renderiza na maior
  altura que a tela permitir (68% da altura da janela, multiplicado pelo devicePixelRatio pra não
  ficar borrada em tela retina), com a largura seguindo proporcional automaticamente — o container
  da dropzone parou de limitar a largura da prévia (o limite de 460px ficou só na dropzone em si).
  No rodapé, a frase de privacidade parou de ter fonte/opacidade diferentes das outras duas linhas
  e todo `<p>` do rodapé ficou com `margin: 0`, então as três linhas ficam juntas, com a mesma
  formatação, sem espaçamento extra entre elas.
- **Sincronização XML ↔ index.html revisada (pente fino)** — conferência linha a linha encontrou
  dois pontos que tinham ficado defasados no `pdftools-theme.xml` desde a v1.0.11 (o bump de versão
  anterior só trocou as URLs do jsDelivr, sem re-copiar o CSS/script de página): o gap do logo até o
  botão "Editar" ainda estava em `14px` (deveria ser `6px`) e o verbo do botão de marca d'água ainda
  estava como "Marcar" (deveria ser "Carimbar"). Corrigido re-sincronizando o `<b:skin>` e o script
  da barra de ferramentas por inteiro a partir do `style.css`/`index.html` atuais, em vez de editar
  linha por linha.
- **v1.0.11** — Recurso de desenho livre (lápis) em *Assinar e Preencher*: ao editar uma página,
  botão "✏️ Desenho Livre" abre um quadro para desenhar à mão livre (mouse/touch) com 3 espessuras
  de traço e paleta de 5 cores + seletor livre; o desenho vira um item arrastável/redimensionável
  na página, igual à assinatura (corrigido também um bug de z-index onde esse modal abria atrás do
  editor de página e os cliques não respondiam). Verbo do botão de marca d'água trocado de "Marcar"
  para "Carimbar" (evita repetir "Editar", já usado pelo Modo Estúdio). Logo do topo aproximado do
  botão "Editar" (mesmo espaçamento usado entre os botões da barra).
- **v1.0.10** — Adicionado `estudio.js` ao repositório GitHub (o Modo Estúdio estava referenciado
  no tema do Blogger via jsDelivr mas o arquivo nunca tinha sido enviado — 404 em produção).
  Corrigido `pdf_para_imagens`, `extrair_texto` e `inspecionar_pdf`, que ignoravam o PDF já
  carregado pela Mesa de Trabalho e pediam para selecionar o arquivo de novo.
- **Redesenho da home (várias iterações antes da v1.0.10)** — Grade com as 16 ferramentas visíveis
  na home desde o início (antes só apareciam 2), desabilitadas/translúcidas até carregar um PDF →
  virou uma barra compacta no topo (estilo programa de computador, ícones pequenos) → depois uma
  fila única com ícone + verbo (uma palavra) por botão, tamanhos maiores, logo maior → banner
  "Gostou do App? Instale" removido e frase de privacidade movida para o rodapé → todos os botões
  (incluindo Juntar/Converter) passaram a exigir PDF carregado → barra centralizada com o logo →
  Mesa de Trabalho ganhou prévia (miniatura) do PDF carregado antes de escolher a ferramenta.
- **`LEIA-ME.md` criado** (antes não existia nenhum arquivo de documentação no projeto), com esta
  estrutura, a tabela de ferramentas e a regra de trabalho acima. Renomeado de `README.md` para
  `LEIA-ME.md` a pedido do usuário — manter esse nome, não trocar de volta para inglês.
