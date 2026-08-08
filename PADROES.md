# Padrões de programação — Meu PDF

Objetivo: código **explícito, previsível e barato de manter** (espírito Tesla/xAI: zero teatro,  
máxima clareza). Detalhe de deploy: `../LEIA-ME.md`. Fases: `../PLANO-FASES.md`.

## Arquitetura em uma frase

Shell (`index.html` + `style.css`) no Cloudflare Pages; motores das tools em `.js` versionados  
no GitHub e carregados via **jsDelivr `@VERSAO`**. Núcleo: `window.PDFTools` + `PDFTools.UI`.

## Regras duras

1. **Uma versão** — constante `PDFTools.VERSAO` (e a tag git) batem com todas as URLs CDN.  
2. **Uma fonte de ícones** — `PDFTools.ICONES_SVG` / `iconeSVG(id)`.  
3. **Rotação** — só via `posicaoRotacionada` / `dimensoesVisuais` (não reinventar).  
4. **Erros de carga de arquivo** — catálogo `PDFTools.erro(...)`; toast de UI com texto simples.  
5. **Nomes de arquivo na tela** — `textContent`, nunca HTML cru do nome.  
6. **Toast** — só texto (`textContent`); sem HTML.  
7. **montarUI** devolve **função de cleanup** se registrou listeners em `document`/`window`.  
8. **CSS de chrome de tool** — preferir classes **`.ft-*`** em `style.css` (tokens).  
   CSS só-da-tool: `PDFTools.UI.garantirCss('css-minha-tool', '...')` com variáveis, sem `#004494` / `#ccc` / `#eaffea`.  
9. **Sem Blogger** na produção. XML legado não é fonte de verdade.  
10. **Sem framework** novo sem pedido do dono do produto.

## Editores de página (`PDFTools.Editor`)

Arquivo: `page-editor.js` — carregado do **mesmo origin** do shell (`./page-editor.js` no Pages),
antes das tools no jsDelivr.

Usar para: `calcularEscalaAjuste`, miniaturas (`criarObserverMiniaturas` + `renderizarMiniaturaPdf`),
`abrirModalEditor` / `fecharModalEditor`, `ouvirArrastoDocumento`, `criarResizeEditor`,
`montarZoomENav`, `renderCanvasPagina`, `posicaoNoElemento`.

Não copiar IntersectionObserver / escala de modal / listeners de resize entre Editar, Assinar e Tarjar.

## Forma de uma ferramenta

```js
PDFTools.registrar({
  id: 'minha_tool',           // snake_case estável
  nome: 'Nome na UI',
  descricao: 'Para meta/SEO',
  precisa: ['pdf-lib'],       // e/ou 'pdfjs'
  montarUI(container, arquivoInicial) {
    // UI com classes .ft-* quando possível
    // if (arquivoInicial) abrir...
    return function cleanup() {
      // remove listeners document/window, observers, classes no body
    };
  }
});
// Lógica pura de exportação: funções no mesmo arquivo, fora do montarUI quando der
```

## Tokens CSS (sempre preferir)

| Token | Uso |
|--------|-----|
| `--texto`, `--texto-2`, `--sup`, `--sup-2`, `--borda` | superfície e texto |
| `--acento` / `--cor-primaria` | ação principal |
| `--acento-hover` | hover de ação |
| `--erro` / `--cor-erro` | perigo |
| `--sucesso` / `--cor-sucesso` / `--cor-sucesso-fundo` | ok |
| `--aviso`, `--aviso-fundo`, `--aviso-borda` | alertas amarelos |
| `--fonte`, `--raio-borda` | tipografia / raio |

## Kit de layout `.ft-*` (Fase 1+)

- `.ft-layout` / `.ft-col-main` / `.ft-col-side` — duas colunas  
- `.ft-painel` — card  
- `.ft-btn` / `.ft-btn-acao` — botões secundário / primário  
- `.ft-input` — input/select  
- `.ft-aviso` — faixa de atenção  
- `.ft-resultado` — bloco pós-sucesso  
- `.ft-lista` / `.ft-lista-item` — listas reordenáveis simples  

Novas tools **nascem** com esse kit. Tools antigas migram nas fases (piloto: Juntar).

## O que não fazer

- `innerHTML` com dados do PDF/usuário sem escape  
- `ignoreEncryption: true` sem mensagem clara quando o fluxo “finge” abrir  
- Duplicar modal/drag de página (Fase 2 existe para isso)  
- Promise que busca CDN extra em runtime (fflate, etc.)  
- Prometer offline sem SW real no origin  

## Service Worker / offline

- Arquivo: `sw.js` (mesmo origin). **Nunca** registrar SW via `Blob`/`createObjectURL`.
- Precache lista shell + `CDN@VERSAO`. Bump `VERSAO` em **index.html e sw.js** no mesmo release.

## Release (lembrete)

Ver `../LEIA-ME.md`: perguntar se há mais mudança → bump `VERSAO` (index + sw.js) + tag + URLs CDN + push.
