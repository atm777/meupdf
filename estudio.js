// "Editar" — edições pontuais na página que você está vendo (desenho, texto, marca, giro desta
// página). Operações em lote no documento (reordenar, girar/apagar várias) ficam no Organizar.
//
// INVARIANTE: a POSIÇÃO na lista (paginas[i]) não é a identidade da página.
// Conteúdo (tracos/itensTexto/giros) é sempre indexado por `paginas[i].id` estável. Nunca use o
// índice sozinho como chave de mapa — excluir/inserir página (fases seguintes) quebraria isso.
function montarEstudioUI(container, arquivoInicial, opts) {
    let fileOrig = null;
    let pdfDocJs = null;

    // Lista ordenada do documento COMO ESTÁ sendo editado.
    // { id, origem: 'pdf'|'branca', idxOriginal?, larguraPt?, alturaPt? }
    // ids 'p0','p1',... nunca reciclados (proximoIdPagina só sobe; desfazer NÃO regride o contador).
    let paginas = [];
    let proximoIdPagina = 0;
    let modoInicial = opts && opts.modo ? opts.modo : null;

    // Tamanhos padrão (pt) para página em branco — poucos, deliberadamente.
    const TAM_A4_R = { width: 595.28, height: 841.89 };
    const TAM_A4_P = { width: 841.89, height: 595.28 };
    const TAM_A5_R = { width: 419.53, height: 595.28 };
    const TAM_A5_P = { width: 595.28, height: 419.53 };

    // Conteúdo por id estável (não por índice de posição):
    // - tracos: lápis vetorial (pontos 0-1 + espessura pt + cor)
    // - itensTexto: caixas de texto e marcas (frações 0-1)
    // - giros: delta em graus (múltiplo de 90) por cima do /Rotate original
    let tracos = {};
    let itensTexto = {};
    let giros = {};
    let historico = [];
    // Índice de POSIÇÃO em `paginas` (não o id). Resolver id com idAtual().
    let paginaAtualModal = 0;

    function idAtual() {
      const p = paginas[paginaAtualModal];
      return p ? p.id : null;
    }
    function numPaginas() {
      return paginas.length;
    }
    function idEm(pos) {
      return paginas[pos] ? paginas[pos].id : null;
    }

    

    container.innerHTML = `
      <div id="est-tela-inicial"></div>
      <div id="est-tela-trabalho" style="display:none;">
        <div class="est-aviso">
          <strong>O que dá pra fazer aqui:</strong> edições pontuais na página que você está
          vendo — desenhar, texto, grifo, girar <em>esta</em> página ou excluí-la. Para reordenar
          ou apagar/girar <em>várias</em> de uma vez, use <strong>Organizar</strong>. Tarjar,
          comprimir e outras ações maiores têm botão próprio na barra do topo.
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="font-size:16px; font-weight:bold; color:var(--texto);">Clique numa página para editar:</div>
          <button class="est-btn-acao" id="btn-gerar" style="width:auto; padding:10px 20px;">Gerar PDF Editado</button>
        </div>
        <div class="est-grade" id="est-grade"></div>
        <div id="est-progresso-container" style="margin-top:16px;"></div>

      <!-- Modal: tamanho da página em branco -->
      <div id="est-modal-tamanho" class="est-modal-tamanho" style="display:none;">
        <div class="est-modal-tamanho-caixa" role="dialog" aria-label="Tamanho da página em branco">
          <h3>Página em branco</h3>
          <p style="font-size:13px; color:var(--texto-2); margin:0 0 12px;">Escolha o tamanho da folha nova:</p>
          <label><input type="radio" name="est-tam-branca" value="igual" checked> <span><strong>Igual à página de referência</strong> (recomendado)</span></label>
          <label><input type="radio" name="est-tam-branca" value="a4r"> <span>A4 retrato</span></label>
          <label><input type="radio" name="est-tam-branca" value="a4p"> <span>A4 paisagem</span></label>
          <label><input type="radio" name="est-tam-branca" value="a5r"> <span>A5 retrato</span></label>
          <label><input type="radio" name="est-tam-branca" value="a5p"> <span>A5 paisagem</span></label>
          <div class="est-modal-tamanho-acoes">
            <button type="button" class="est-btn" id="est-tam-cancelar">Cancelar</button>
            <button type="button" class="est-btn-acao" id="est-tam-ok" style="width:auto; padding:8px 16px;">Inserir</button>
          </div>
        </div>
      </div>
        <div id="est-resultado" style="display:none; margin-top:16px;">
          <div style="font-size:13px; color:var(--cor-sucesso); font-weight:bold; margin-bottom:8px;">✅ Concluído! Baixado automaticamente.</div>
          <button id="btn-est-baixar-novamente" class="pdf-btn-principal" style="margin-top:0;">Baixar Novamente</button>
          <div id="est-proximos-passos" style="margin-top:16px;"></div>
        </div>
      </div>

      <!-- Modal Editor de Página -->
      <div id="est-modal-editor" class="est-modal-overlay">
        <div class="est-modal-topbar">
          <div style="font-size:16px; font-weight:bold;">Editando Página <span id="est-modal-pagina"></span></div>
          <div id="est-zoom-slot"></div>
          <div style="display:flex; gap:8px; flex-wrap: wrap;">
            <button class="est-btn" id="btn-est-desfazer">Desfazer (Ctrl+Z)</button>
            <button class="est-btn" id="btn-aplicar-todas" style="background:var(--cor-primaria); color:white; border-color:var(--cor-primaria); display:inline-flex; align-items:center; gap:6px;">${window.PDFTools.iconeSVG('ui-aplicar-todas')}<span>Aplicar a Todas</span></button>
            <button class="est-btn" id="btn-est-fullscreen" style="display:inline-flex; align-items:center; gap:6px;">${window.PDFTools.iconeSVG('ui-tela-cheia')}<span>Tela Cheia</span></button>
            <button class="est-btn" style="background:var(--cor-primaria); color:white; border-color:var(--cor-primaria);" id="btn-est-fechar">Concluir Página</button>
          </div>
        </div>

        <div class="est-editor-layout">
          <aside class="pdf-paleta" aria-label="Paleta de ferramentas do editor">
            <div class="pdf-paleta-grupo" role="radiogroup" aria-label="Ferramentas">
              <div class="pdf-paleta-grupo-rotulo">ferramentas</div>
              <button type="button" class="pdf-paleta-btn est-modo-btn${modoInicial === 'mover' || !modoInicial ? ' ativo' : ''}" data-modo="mover" role="radio" aria-checked="${modoInicial === 'mover' || !modoInicial}" title="Mover (V)">${window.PDFTools.iconeSVG('ui-mover')}<span>Mover</span></button>
              <button type="button" class="pdf-paleta-btn est-modo-btn${modoInicial === 'lapis' ? ' ativo' : ''}" data-modo="lapis" role="radio" aria-checked="${modoInicial === 'lapis'}" title="Lápis (L)">${window.PDFTools.iconeSVG('ui-lapis')}<span>Lápis</span></button>
              <button type="button" class="pdf-paleta-btn est-modo-btn${modoInicial === 'texto' ? ' ativo' : ''}" data-modo="texto" role="radio" aria-checked="${modoInicial === 'texto'}" title="Texto (T)">${window.PDFTools.iconeSVG('ui-texto')}<span>Texto</span></button>
              <button type="button" class="pdf-paleta-btn est-modo-btn${modoInicial === 'marca' ? ' ativo' : ''}" data-modo="marca" role="radio" aria-checked="${modoInicial === 'marca'}" title="Marca (M)">${window.PDFTools.iconeSVG('ui-marca')}<span>Marca</span></button>
            </div>

            <div class="pdf-paleta-grupo" role="group" aria-label="Esta página">
              <div class="pdf-paleta-grupo-rotulo">esta página</div>
              <div class="pdf-paleta-acao-grupo">
                <button type="button" class="pdf-paleta-btn est-btn" id="btn-est-girar" title="Girar a página 90° no sentido horário">${window.PDFTools.iconeSVG('ui-girar')}<span>Girar</span></button>
                <button type="button" class="pdf-paleta-btn est-btn" id="btn-est-inserir-branca" title="Inserir página em branco depois desta">${window.PDFTools.iconeSVG('ui-inserir')}<span>Em branco</span></button>
                <button type="button" class="pdf-paleta-btn est-btn perigo est-btn-excluir-pagina" id="btn-est-excluir-pagina" title="Excluir esta página">${window.PDFTools.iconeSVG('ui-excluir')}<span>Excluir</span></button>
              </div>
            </div>

            <div class="est-sub-painel" id="est-painel-lapis" style="display:none;">
            <div class="est-desenho-grupo">
              <span class="est-desenho-grupo-label">Espessura:</span>
              <button type="button" class="est-lapis-tamanho" data-tamanho-pt="1.5"><span style="width:4px; height:4px;"></span></button>
              <button type="button" class="est-lapis-tamanho ativo" data-tamanho-pt="3"><span style="width:8px; height:8px;"></span></button>
              <button type="button" class="est-lapis-tamanho" data-tamanho-pt="6"><span style="width:14px; height:14px;"></span></button>
            </div>
            <div class="est-desenho-grupo" style="margin-top:8px;">
              <span class="est-desenho-grupo-label">Cor:</span>
              <button type="button" class="est-cor-swatch ativo" data-cor="#000000" style="background:#000000;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#ef4444" style="background:#ef4444;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#0a58ca" style="background:#0a58ca;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#10b981" style="background:#10b981;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#f59e0b" style="background:#f59e0b;"></button>
              <input type="color" id="est-lapis-cor-custom" class="est-cor-custom" value="#000000" title="Outra cor">
            </div>
            <div style="font-size:11px; color:var(--texto-2); margin-top:8px;">Desenhe com o mouse ou o dedo, direto sobre a página.</div>
          </div>

          <div class="est-sub-painel" id="est-painel-texto" style="display:none;">
            <label class="est-campo-label">Fonte</label>
            <select id="est-fonte-familia" class="est-select">
              <option value="helvetica">Helvetica</option>
              <option value="times">Times</option>
              <option value="courier">Courier</option>
            </select>
            <div style="display:flex; gap:6px; margin-top:8px; align-items:center;">
              <div style="flex:1;">
                <label class="est-campo-label">Tamanho (pt)</label>
                <input type="number" id="est-fonte-tamanho" class="est-input-num" style="width:100%;" value="16" min="6" max="120">
              </div>
              <button type="button" class="est-toggle-btn" id="est-fonte-negrito" title="Negrito"><b>N</b></button>
              <button type="button" class="est-toggle-btn" id="est-fonte-italico" title="Itálico"><i>I</i></button>
            </div>
            <div class="est-desenho-grupo" style="margin-top:8px;">
              <span class="est-desenho-grupo-label">Cor:</span>
              <button type="button" class="est-cor-swatch ativo" data-cor="#000000" style="background:#000000;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#ef4444" style="background:#ef4444;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#0a58ca" style="background:#0a58ca;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#10b981" style="background:#10b981;"></button>
              <button type="button" class="est-cor-swatch" data-cor="#f59e0b" style="background:#f59e0b;"></button>
              <input type="color" id="est-texto-cor-custom" class="est-cor-custom" value="#000000" title="Outra cor">
            </div>
            <div style="font-size:11px; color:var(--texto-2); margin-top:8px;">Clique na página pra incluir texto. Duplo clique num texto (modo Mover) pra editar.</div>
          </div>

          <div class="est-sub-painel" id="est-painel-marca" style="display:none;">
            <div class="est-desenho-grupo">
              <span class="est-desenho-grupo-label">Cor:</span>
              <button type="button" class="est-cor-swatch ativo" data-cor="#ffeb3b" style="background:#ffeb3b;" title="Amarelo"></button>
              <button type="button" class="est-cor-swatch" data-cor="#76ff03" style="background:#76ff03;" title="Verde fluorescente"></button>
              <button type="button" class="est-cor-swatch" data-cor="#ff4081" style="background:#ff4081;" title="Rosa"></button>
            </div>
            <div style="font-size:11px; color:var(--texto-2); margin-top:8px;">Clique e arraste sobre o texto — fica um grifo translúcido, sem esconder o que está embaixo.</div>
          </div>

          </aside>

        <div class="est-modal-body" id="est-modal-body">
          <div class="est-editor-area">
            <div id="est-nav-paginas-slot"></div>
            <div class="est-editor-wrapper" id="est-wrapper">
              <canvas class="est-editor-canvas" id="est-canvas"></canvas>
              <canvas class="est-editor-layer-canvas" id="est-traco-canvas"></canvas>
              <div class="est-editor-layer" id="est-layer"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const telaInicial = container.querySelector('#est-tela-inicial');
    const telaTrabalho = container.querySelector('#est-tela-trabalho');
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#est-progresso-container').appendChild(progresso.elemento);

    telaInicial.appendChild(PDFTools.UI.criarDropzone({
      multiplo: false,
      aceita: '.pdf, application/pdf',
      onArquivos: (arquivos) => abrirArquivo(arquivos[0])
    }));

    const Ed = PDFTools.Editor;
    function opcoesMiniatura() {
      return {
        containerSeletor: '.est-thumb-container',
        getPageNumber: (el, index) => {
          const d = paginas[index];
          return d && d.origem === 'pdf' ? (d.idxOriginal + 1) : 1;
        },
        getRotation: (index, page) => {
          const id = idEm(index);
          return ((((page.rotate || 0) + (giros[id] || 0)) % 360) + 360) % 360;
        }
      };
    }
    const visaoObserver = Ed.criarObserverMiniaturas((el) => {
      Ed.renderizarMiniaturaPdf(pdfDocJs, el, opcoesMiniatura());
    });

    async function abrirArquivo(file) {
      if (!(await PDFTools.ehPDF(file))) {
        telaInicial.innerHTML = PDFTools.erro('nao_e_pdf');
        return;
      }
      fileOrig = file;
      telaInicial.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--texto-2);">Carregando PDF...</div>';
      try {
        await PDFTools.carregarLib('pdfjs');
        const buffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: buffer }).promise;

        paginas = [];
        proximoIdPagina = 0;
        tracos = {}; itensTexto = {}; giros = {};
        for (let i = 0; i < pdfDocJs.numPages; i++) {
          const id = 'p' + (proximoIdPagina++);
          paginas.push({ id: id, origem: 'pdf', idxOriginal: i });
          tracos[id] = [];
          itensTexto[id] = [];
          giros[id] = 0;
        }
        paginaAtualModal = 0;
        historico = [JSON.stringify({ paginas: paginas, tracos: tracos, itensTexto: itensTexto, giros: giros })];

        telaInicial.style.display = 'none';
        telaTrabalho.style.display = 'block';
        renderizarGrade();
      } catch (err) {
        const cod = PDFTools.classificarErro(err);
        telaInicial.innerHTML = PDFTools.erro(cod, cod === 'desconhecido' ? (err && err.message) : null);
      }
    }

    function renderizarGrade() {
      const grade = container.querySelector('#est-grade');
      grade.innerHTML = '';
      visaoObserver.disconnect();
      const soUma = numPaginas() <= 1;

      for (let i = 0; i < numPaginas(); i++) {
        const el = document.createElement('div');
        el.className = 'est-pagina';
        el.dataset.index = String(i);
        el.dataset.pageId = paginas[i].id;
        el.innerHTML =
          '<div class="est-pagina-header">Página ' + (i + 1) + '</div>' +
          '<div class="est-thumb-container"></div>' +
          '<div class="est-badge">Editada</div>' +
          '<button type="button" class="est-badge-excluir" title="' +
            (soUma ? 'O documento precisa de pelo menos uma página' : 'Excluir página ' + (i + 1)) +
            '"' + (soUma ? ' disabled' : '') + '>✕</button>';
        el.onclick = (e) => {
          if (e.target.closest && e.target.closest('.est-badge-excluir')) return;
          abrirEditor(i);
        };
        const btnEx = el.querySelector('.est-badge-excluir');
        if (btnEx && !soUma) {
          btnEx.onclick = (e) => {
            e.stopPropagation();
            excluirPagina(i, { origem: 'grade' });
          };
        }
        grade.appendChild(el);
        if (paginas[i].origem === 'pdf') visaoObserver.observe(el);
        else renderizarMiniatura(el);
      }

      // Cartão "+" no fim: inserir página em branco no final do documento.
      const addEl = document.createElement('button');
      addEl.type = 'button';
      addEl.className = 'est-pagina-add';
      addEl.innerHTML = '<span class="est-pagina-add-plus" aria-hidden="true">+</span><span>Página em branco</span>';
      addEl.title = 'Inserir página em branco no fim';
      addEl.onclick = () => abrirModalTamanhoBranca({ insertAt: numPaginas(), refPos: numPaginas() - 1 });
      grade.appendChild(addEl);

      atualizarBadges();
      atualizarControlesExcluir();
    }

    /** Atualiza botão Excluir do modal (desabilitado se só resta 1 página). */
    function atualizarControlesExcluir() {
      const btn = container.querySelector('#btn-est-excluir-pagina');
      if (!btn) return;
      const soUma = numPaginas() <= 1;
      btn.disabled = soUma;
      btn.title = soUma
        ? 'O documento precisa de pelo menos uma página'
        : 'Excluir a página ' + (paginaAtualModal + 1) + ' (pode desfazer com Ctrl+Z)';
    }

    /**
     * Remove a página na posição `pos` (lista editada). Descarta conteúdo por id.
     * Confirmação obrigatória. Não apaga a última página.
     * Se o editor estiver na página excluída, navega para a vizinha (mesma posição ou a anterior).
     */
    function excluirPagina(pos, opcoes) {
      opcoes = opcoes || {};
      if (pos < 0 || pos >= numPaginas()) return;
      if (numPaginas() <= 1) {
        PDFTools.UI.mostrarToast('O documento precisa de pelo menos uma página.', 'info');
        return;
      }
      const numHumano = pos + 1;
      if (!confirm('Excluir a página ' + numHumano + '?\n\nAs anotações desta página saem junto. Dá para desfazer com Ctrl+Z.')) {
        return;
      }

      const modalEl = container.querySelector('#est-modal-editor');
      const modalAberto = modalEl && modalEl.style.display !== 'none';
      salvarEstado();

      const removida = paginas[pos];
      const id = removida.id;
      paginas.splice(pos, 1);
      delete tracos[id];
      delete itensTexto[id];
      delete giros[id];

      // Ajustar índice do editor: se apagou a atual, fica na mesma posição (agora a próxima)
      // ou na anterior se era a última; se apagou antes da atual, o índice desce 1.
      let novoIdx = paginaAtualModal;
      if (paginaAtualModal === pos) {
        novoIdx = Math.min(pos, numPaginas() - 1);
      } else if (paginaAtualModal > pos) {
        novoIdx = paginaAtualModal - 1;
      }
      paginaAtualModal = Math.max(0, novoIdx);
      idxEditando = null;

      renderizarGrade();

      if (modalAberto && typeof abrirEditor === 'function') {
        // Reabre o vizinho (ou a única página restante) — não deixa modal numa página fantasma.
        abrirEditor(paginaAtualModal);
      }

      PDFTools.UI.mostrarToast('Página ' + numHumano + ' excluída.', 'sucesso');
    }

    function atualizarBadges() {
      for (let i = 0; i < numPaginas(); i++) {
        const el = container.querySelector(`.est-pagina[data-index="${i}"]`);
        if (el) {
          const id = idEm(i);
          const temConteudo = (tracos[id] && tracos[id].length > 0) || (itensTexto[id] && itensTexto[id].length > 0) || (giros[id] && giros[id] !== 0);
          el.querySelector('.est-badge').style.display = temConteudo ? 'block' : 'none';
        }
      }
    }

    function desenharCanvasBranco(canvas, larguraPt, alturaPt, escala) {
      canvas.width = Math.max(1, Math.round(larguraPt * escala));
      canvas.height = Math.max(1, Math.round(alturaPt * escala));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    }

    /** Dimensões VISUAIS (pt) de um descritor, incluindo giro aplicado no editor. */
    function dimsVisuaisDesc(desc) {
      if (!desc) return { width: TAM_A4_R.width, height: TAM_A4_R.height };
      if (desc.origem === 'branca') {
        const g = ((giros[desc.id] || 0) % 360 + 360) % 360;
        return PDFTools.dimensoesVisuais(desc.larguraPt, desc.alturaPt, g);
      }
      // pdf: só o delta do editor em cima do que o pdf.js reporta — precisa da page async.
      return null;
    }

    function renderizarMiniatura(el) {
      const index = parseInt(el.dataset.index, 10);
      const desc = paginas[index];
      if (!desc) return Promise.resolve();
      if (desc.origem === 'branca') {
        if (el.dataset.rendered === 'true') return Promise.resolve();
        el.dataset.rendered = 'true';
        const box = el.querySelector('.est-thumb-container');
        if (!box) return Promise.resolve();
        const dims = dimsVisuaisDesc(desc);
        const canvas = document.createElement('canvas');
        // 120x150: o .est-thumb-container tem 160px de altura; a folga evita corte na borda.
        const escala = Math.min(120 / dims.width, 150 / dims.height);
        desenharCanvasBranco(canvas, dims.width, dims.height, escala);
        box.innerHTML = '';
        box.appendChild(canvas);
        return Promise.resolve();
      }
      return Ed.renderizarMiniaturaPdf(pdfDocJs, el, opcoesMiniatura());
    }

    // --- Inserir página em branco ---
    let _insertBrancaAt = 0;
    let _insertBrancaRefPos = 0;
    const modalTam = container.querySelector('#est-modal-tamanho');
    const a11yTam = PDFTools.UI.tornarModalAcessivel(modalTam, {
      rotulo: 'Tamanho da página em branco',
      botaoFechar: () => container.querySelector('#est-tam-cancelar')
    });

    async function dimsVisuaisPosAsync(pos) {
      if (pos < 0 || pos >= numPaginas()) return { width: TAM_A4_R.width, height: TAM_A4_R.height };
      const desc = paginas[pos];
      if (desc.origem === 'branca') return dimsVisuaisDesc(desc);
      try {
        const page = await pdfDocJs.getPage(desc.idxOriginal + 1);
        const ang = ((((page.rotate || 0) + (giros[desc.id] || 0)) % 360) + 360) % 360;
        const vp = page.getViewport({ scale: 1.0, rotation: ang });
        return { width: vp.width, height: vp.height };
      } catch (e) {
        return { width: TAM_A4_R.width, height: TAM_A4_R.height };
      }
    }

    function abrirModalTamanhoBranca(opcoes) {
      opcoes = opcoes || {};
      _insertBrancaAt = opcoes.insertAt != null ? opcoes.insertAt : numPaginas();
      _insertBrancaRefPos = opcoes.refPos != null ? opcoes.refPos : Math.max(0, numPaginas() - 1);
      const radioIgual = container.querySelector('input[name="est-tam-branca"][value="igual"]');
      if (radioIgual) radioIgual.checked = true;
      // Este modal também é position:fixed cobrindo a viewport (igual ao editor de página) e pode
      // abrir direto da grade, SEM o editor por trás — precisa da mesma classe que tira o
      // backdrop-filter do #workspace, senão fica preso dentro do #workspace em vez
      // de cobrir a tela toda.
      document.body.classList.add('pdf-editor-modal-aberto');
      modalTam.style.display = 'flex';
    }

    function fecharModalTamanhoBranca() {
      modalTam.style.display = 'none';
      // Só desliga o backdrop-filter de volta se o editor de página não estiver aberto por trás
      // (senão prendemos o fixed DELE, que também depende dessa classe). getComputedStyle (não
      // .style.display) porque modalEditor pode nunca ter sido aberto nesta sessão — aí o inline
      // style está vazio (''), não 'none', e o CSS base (.est-modal-overlay{display:none}) é quem
      // decide de fato.
      if (window.getComputedStyle(modalEditor).display === 'none') {
        document.body.classList.remove('pdf-editor-modal-aberto');
      }
    }

    container.querySelector('#est-tam-cancelar').onclick = fecharModalTamanhoBranca;
    container.querySelector('#est-tam-ok').onclick = async () => {
      const val = (container.querySelector('input[name="est-tam-branca"]:checked') || {}).value || 'igual';
      let dims;
      if (val === 'a4r') dims = TAM_A4_R;
      else if (val === 'a4p') dims = TAM_A4_P;
      else if (val === 'a5r') dims = TAM_A5_R;
      else if (val === 'a5p') dims = TAM_A5_P;
      else dims = await dimsVisuaisPosAsync(_insertBrancaRefPos);
      // Página nova em rotação 0 com tamanho JÁ visual (paisagem se a ref era /Rotate 90).
      fecharModalTamanhoBranca();
      inserirPaginaBranca(_insertBrancaAt, dims);
    };

    function inserirPaginaBranca(insertAt, dims) {
      if (!dims || !dims.width || !dims.height) dims = TAM_A4_R;
      const modalEl = container.querySelector('#est-modal-editor');
      const modalAberto = modalEl && modalEl.style.display !== 'none';
      salvarEstado();
      const id = 'p' + (proximoIdPagina++);
      const desc = {
        id: id,
        origem: 'branca',
        larguraPt: dims.width,
        alturaPt: dims.height
      };
      const at = Math.max(0, Math.min(insertAt, numPaginas()));
      paginas.splice(at, 0, desc);
      tracos[id] = [];
      itensTexto[id] = [];
      giros[id] = 0;
      idxEditando = null;
      renderizarGrade();
      if (modalAberto) {
        abrirEditor(at);
      }
      PDFTools.UI.mostrarToast('Página em branco inserida.', 'sucesso');
    }

    // --- EDITOR DE PÁGINA ---
    const modalEditor = container.querySelector('#est-modal-editor');
    const wrapper = container.querySelector('#est-wrapper');
    const layer = container.querySelector('#est-layer');
    const cvsEditor = container.querySelector('#est-canvas');
    const tracoCanvas = container.querySelector('#est-traco-canvas');

    // Acessibilidade do modal do editor (foco preso, Esc fecha, foco devolvido).
    const a11yEditor = window.PDFTools.UI.tornarModalAcessivel(modalEditor, {
      rotulo: 'Editor de página',
      botaoFechar: () => container.querySelector('#btn-est-fechar')
    });

    let modoAtual = 'mover'; // 'mover' | 'lapis' | 'texto'
    let idxEditando = null;
    // Quando um clique na página fecha (commita) uma caixa de texto que estava aberta, esse mesmo
    // clique NÃO deve também criar uma caixa nova — senão "clicar fora pra concluir" já plantava uma
    // caixa vazia fantasma. Ligado no mousedown (aoCliqueFora) e consumido no click do wrapper.
    let cliqueFechouEdicao = false;
    let paginaPdfAtual = null;
    let rotacaoBasePagina = 0; // /Rotate original da página aberta (o que o pdf.js reporta em .rotate)
    let escalaBase = 1;
    let visPageWidthPt = 1, visPageHeightPt = 1;

    // Ângulo VISUAL da página aberta = rotação original + giro que a pessoa aplicou aqui. É o que
    // o pdf.js usa pra renderizar (getViewport({rotation})) e o que a exportação usa pra converter
    // as frações visuais em coordenada bruta do PDF. Sempre 0/90/180/270.
    function anguloVisualAtual() {
      const id = idAtual();
      return (((rotacaoBasePagina + (giros[id] || 0)) % 360) + 360) % 360;
    }

    let lapisTamanhoPt = 3;
    let lapisCor = '#000000';
    let tracoEmAndamento = null;
    let desenhandoAgora = false;

    // Texto (configuração pro PRÓXIMO texto a ser criado; um item já criado guarda a própria)
    let fonteFamilia = 'helvetica';
    let fonteTamanhoPt = 16;
    let fonteCor = '#000000';
    let fonteNegrito = false;
    let fonteItalico = false;

    // Marca texto (grifo translúcido)
    let marcaCorAtual = '#ffeb3b';
    let marcaEmAndamento = null; // { elemento, startXFrac, startYFrac }

    // Zoom + nav via PDFTools.Editor (page-editor.js), compartilhado com Assinar e Tarjar.
    const modalBody = container.querySelector('#est-modal-body');
    const { controleZoom, navegadorPaginas } = Ed.montarZoomENav({
      modalBody,
      zoomSlot: container.querySelector('#est-zoom-slot'),
      navSlot: container.querySelector('#est-nav-paginas-slot'),
      aoMudarZoom: (fator) => {
        if (paginas[paginaAtualModal]) renderizarPaginaNoCanvas(fator);
      },
      aoNavegar: (novoIndice) => abrirEditor(novoIndice)
    });

    function obterEscalaAtual() {
      return escalaBase * controleZoom.obterZoom();
    }

    function viewportRefPaginaAtual() {
      const desc = paginas[paginaAtualModal];
      if (!desc) return { width: TAM_A4_R.width, height: TAM_A4_R.height };
      if (desc.origem === 'branca') {
        return PDFTools.dimensoesVisuais(desc.larguraPt, desc.alturaPt, anguloVisualAtual());
      }
      if (!paginaPdfAtual) return { width: TAM_A4_R.width, height: TAM_A4_R.height };
      return paginaPdfAtual.getViewport({ scale: 1.0, rotation: anguloVisualAtual() });
    }

    async function renderizarPaginaNoCanvas(fatorZoom) {
      const desc = paginas[paginaAtualModal];
      if (desc && desc.origem === 'branca') {
        const dims = PDFTools.dimensoesVisuais(desc.larguraPt, desc.alturaPt, anguloVisualAtual());
        const scale = escalaBase * fatorZoom;
        // Canvas de traço acompanha o tamanho da página branca.
        desenharCanvasBranco(cvsEditor, dims.width, dims.height, scale);
        if (tracoCanvas) {
          tracoCanvas.width = cvsEditor.width;
          tracoCanvas.height = cvsEditor.height;
        }
        redesenharTracos();
        renderizarItensEditor();
        return;
      }
      if (!paginaPdfAtual) return;
      await Ed.renderCanvasPagina(paginaPdfAtual, cvsEditor, escalaBase * fatorZoom, {
        rotation: anguloVisualAtual()
      });
      redesenharTracos();
      renderizarItensEditor();
    }

    async function abrirEditor(index) {
      if (index < 0 || index >= numPaginas()) return;
      paginaAtualModal = index;
      idxEditando = null;
      container.querySelector('#est-modal-pagina').textContent = index + 1;
      Ed.abrirModalEditor(modalEditor);
      layer.innerHTML = '';
      navegadorPaginas.atualizar(index, numPaginas());

      const desc = paginas[index];
      if (desc.origem === 'branca') {
        paginaPdfAtual = null;
        rotacaoBasePagina = 0;
        const viewportRef = viewportRefPaginaAtual();
        visPageWidthPt = viewportRef.width;
        visPageHeightPt = viewportRef.height;
        escalaBase = Ed.calcularEscalaAjuste(modalBody, viewportRef, {
          fatorMaximo: 1.5,
          navEl: navegadorPaginas.elemento
        });
      } else {
        const page = await pdfDocJs.getPage(desc.idxOriginal + 1);
        paginaPdfAtual = page;
        rotacaoBasePagina = (((page.rotate || 0) % 360) + 360) % 360;
        const viewportRef = page.getViewport({ scale: 1.0, rotation: anguloVisualAtual() });
        visPageWidthPt = viewportRef.width;
        visPageHeightPt = viewportRef.height;
        escalaBase = Ed.calcularEscalaAjuste(modalBody, viewportRef, {
          fatorMaximo: 1.5,
          navEl: navegadorPaginas.elemento
        });
      }

      definirModo(modoInicial || 'mover');
      modoInicial = null;
      controleZoom.definirZoom(1); // dispara renderizarPaginaNoCanvas(1) via aoMudarZoom
      atualizarControlesExcluir();
    }

    container.querySelector('#btn-est-excluir-pagina').onclick = () => {
      excluirPagina(paginaAtualModal, { origem: 'editor' });
    };
    container.querySelector('#btn-est-inserir-branca').onclick = () => {
      // Insere DEPOIS da pagina aberta (o botao esta dentro do editor, entao a referencia de
      // tamanho e a pagina que a pessoa esta vendo).
      abrirModalTamanhoBranca({
        insertAt: paginaAtualModal + 1,
        refPos: paginaAtualModal
      });
    };

    // Cursores em forma de emoji (lápis/marca-texto) via SVG embutido — sem precisar de nenhum
    // arquivo de imagem à parte. O "hotspot" (2 28) fica perto da ponta do emoji.
    function cursorEmoji(emoji) {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text y='26' font-size='26'>${emoji}</text></svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 28, crosshair`;
    }
    const CURSOR_LAPIS = cursorEmoji('✏️');
    const CURSOR_MARCA = cursorEmoji('🖍️');

    // Critério de divisão: paleta = o que age sobre o conteúdo ou sobre esta página; a barra do topo
    // age sobre a sessão de edição inteira.
    // --- MODO (Mover / Lápis / Texto / Marca) ---
    function definirModo(novoModo) {
      modoAtual = novoModo;
      container.querySelectorAll('.est-modo-btn').forEach(b => {
        const ativa = b.dataset.modo === novoModo;
        b.classList.toggle('ativo', ativa);
        b.setAttribute('aria-checked', String(ativa));
        b.tabIndex = ativa ? 0 : -1;
      });
      container.querySelector('#est-painel-lapis').style.display = novoModo === 'lapis' ? 'block' : 'none';
      container.querySelector('#est-painel-texto').style.display = novoModo === 'texto' ? 'block' : 'none';
      container.querySelector('#est-painel-marca').style.display = novoModo === 'marca' ? 'block' : 'none';
      tracoCanvas.style.pointerEvents = novoModo === 'lapis' ? 'auto' : 'none';
      wrapper.style.cursor = novoModo === 'lapis' ? CURSOR_LAPIS
        : novoModo === 'marca' ? CURSOR_MARCA
        : novoModo === 'texto' ? 'text'
        : 'default';
    }

    function buscarBotoesModo() {
      return Array.from(container.querySelectorAll('.est-modo-btn'));
    }

    function focarModoRelativo(delta) {
      const botoes = buscarBotoesModo();
      if (botoes.length === 0) return;
      const atual = botoes.findIndex(b => b === document.activeElement || b.getAttribute('aria-checked') === 'true');
      const proximo = ((atual >= 0 ? atual : 0) + delta + botoes.length) % botoes.length;
      const botao = botoes[proximo];
      if (botao) {
        botao.focus();
        definirModo(botao.dataset.modo);
      }
    }

    container.querySelectorAll('.est-modo-btn').forEach(btn => {
      btn.onclick = () => definirModo(btn.dataset.modo);
    });

    // --- GIRAR A PÁGINA ---------------------------------------------------------------------
    // Um botão só, sempre no sentido horário (90° por clique): quatro cliques dão a volta completa,
    // então dá pra chegar em qualquer uma das 4 orientações sem gastar um 2º botão — o seletor de
    // modo já fica apertado a 380px, e "desfazer um giro" é Ctrl+Z (ou 3 cliques). Menos superfície,
    // mesma capacidade.
    //
    // Remap das frações (0-1) do espaço visual ANTIGO pro NOVO — derivado e provado (identidades
    // 4×90=id, 90+90=180, 90+(-90)=id). Marca e traço são presos ao conteúdo (giram junto): a marca
    // usa a fórmula de caixa (w/h trocam) e vira alta/estreita sobre o texto que agora está de lado;
    // o traço remapeia cada ponto. TEXTO fica HORIZONTAL/legível: reancorado pelo CENTRO no mesmo
    // ponto do conteúdo, tamanho em pt preservado (sem re-quebra) — mesma convenção do resto do app,
    // que sempre desenha texto na horizontal do espaço visual (inclusive em páginas com /Rotate).
    function remapPontoFrac(fx, fy, d) {
      d = ((d % 360) + 360) % 360;
      if (d === 90) return { x: 1 - fy, y: fx };
      if (d === 270) return { x: fy, y: 1 - fx };
      if (d === 180) return { x: 1 - fx, y: 1 - fy };
      return { x: fx, y: fy };
    }
    function remapMarca(item, d) {
      d = ((d % 360) + 360) % 360;
      const { x, y, w, h } = item;
      if (d === 90) { item.x = 1 - y - h; item.y = x; item.w = h; item.h = w; }
      else if (d === 270) { item.x = y; item.y = 1 - x - w; item.w = h; item.h = w; }
      else if (d === 180) { item.x = 1 - x - w; item.y = 1 - y - h; }
    }
    // Texto: preserva o tamanho absoluto em pt (a página visual troca de dimensões no giro de 90°,
    // então a mesma largura em pt vira outra fração) e recentra no ponto de conteúdo remapeado.
    function remapTexto(item, d, oldVisW, oldVisH, newVisW, newVisH) {
      const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
      const c = remapPontoFrac(cx, cy, d);
      const wPt = item.w * oldVisW, hPt = item.h * oldVisH;
      item.w = wPt / newVisW;
      item.h = hPt / newVisH;
      item.x = Math.max(0, Math.min(c.x - item.w / 2, 1 - item.w));
      item.y = Math.max(0, Math.min(c.y - item.h / 2, 1 - item.h));
    }

    // Recalcula o "ajustar à tela" (escalaBase) e as dimensões visuais da página atual a partir do
    // ângulo visual corrente — retrato↔paisagem no giro de 90° muda largura/altura, então a escala
    // precisa ser refeita. Respeita a tela cheia (fatorMáximo 3 vs 1.5).
    function recalcularEscalaBase() {
      if (!paginas[paginaAtualModal]) return;
      const emTelaCheia = document.fullscreenElement === modalEditor;
      const viewportRef = viewportRefPaginaAtual();
      visPageWidthPt = viewportRef.width;
      visPageHeightPt = viewportRef.height;
      escalaBase = Ed.calcularEscalaAjuste(modalBody, viewportRef, {
        fatorMaximo: emTelaCheia ? 3 : 1.5,
        navEl: navegadorPaginas.elemento
      });
    }

    function girarPagina(delta) {
      const desc = paginas[paginaAtualModal];
      const id = idAtual();
      if (!desc || !id) return;
      // Página PDF precisa do objeto pdf.js; branca gira só com giros[] + canvas branco.
      if (desc.origem === 'pdf' && !paginaPdfAtual) return;
      const oldVisW = visPageWidthPt, oldVisH = visPageHeightPt;
      salvarEstado();

      const anguloNovo = (((rotacaoBasePagina + (giros[id] || 0) + delta) % 360) + 360) % 360;
      let newVisW, newVisH;
      if (desc.origem === 'branca') {
        const d = PDFTools.dimensoesVisuais(desc.larguraPt, desc.alturaPt, anguloNovo);
        newVisW = d.width; newVisH = d.height;
      } else {
        const vpNovo = paginaPdfAtual.getViewport({ scale: 1.0, rotation: anguloNovo });
        newVisW = vpNovo.width; newVisH = vpNovo.height;
      }

      (itensTexto[id] || []).forEach(item => {
        if (item.tipo === 'marca') remapMarca(item, delta);
        else remapTexto(item, delta, oldVisW, oldVisH, newVisW, newVisH);
      });
      (tracos[id] || []).forEach(tr => {
        tr.pontosNorm = (tr.pontosNorm || []).map(p => remapPontoFrac(p.x, p.y, delta));
      });

      giros[id] = (((giros[id] || 0) + delta) % 360 + 360) % 360;
      idxEditando = null;
      recalcularEscalaBase();
      renderizarPaginaNoCanvas(controleZoom.obterZoom());
    }
    container.querySelector('#btn-est-girar').onclick = () => girarPagina(90);

    // --- LÁPIS: desenho vetorial direto sobre a página ---
    container.querySelectorAll('#est-painel-lapis .est-lapis-tamanho').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('#est-painel-lapis .est-lapis-tamanho').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        lapisTamanhoPt = parseFloat(btn.dataset.tamanhoPt);
      };
    });
    container.querySelectorAll('#est-painel-lapis .est-cor-swatch').forEach(btn => {
      btn.onclick = () => {
        lapisCor = btn.dataset.cor;
        container.querySelectorAll('#est-painel-lapis .est-cor-swatch').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        aplicarCorLapisNaUI(lapisCor);
        sincronizarSwatchesAria('#est-painel-lapis');
      };
    });
    container.querySelector('#est-lapis-cor-custom').oninput = (e) => {
      lapisCor = e.target.value;
      container.querySelectorAll('#est-painel-lapis .est-cor-swatch').forEach(b => b.classList.remove('ativo'));
      aplicarCorLapisNaUI(lapisCor);
      sincronizarSwatchesAria('#est-painel-lapis');
    };

    // --- MARCA TEXTO: grifo translúcido, cores predefinidas ---
    container.querySelectorAll('#est-painel-marca .est-cor-swatch').forEach(btn => {
      btn.onclick = () => {
        marcaCorAtual = btn.dataset.cor;
        container.querySelectorAll('#est-painel-marca .est-cor-swatch').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        sincronizarSwatchesAria('#est-painel-marca');
      };
    });

    // Acessibilidade (aria-label/aria-pressed) + cor viva do ponto de espessura (paleta do Editar).
    const NOMES_COR = { '#000000': 'Preto', '#ef4444': 'Vermelho', '#0a58ca': 'Azul', '#10b981': 'Verde',
      '#f59e0b': 'Laranja', '#ffeb3b': 'Amarelo', '#76ff03': 'Verde fluorescente', '#ff4081': 'Rosa' };
    function sincronizarSwatchesAria(painelSel) {
      container.querySelectorAll(painelSel + ' .est-cor-swatch').forEach(b => {
        if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', NOMES_COR[(b.dataset.cor || '').toLowerCase()] || b.dataset.cor || 'Cor');
        b.setAttribute('aria-pressed', b.classList.contains('ativo') ? 'true' : 'false');
      });
    }
    function aplicarCorLapisNaUI(cor) { const p = container.querySelector('#est-painel-lapis'); if (p) p.style.setProperty('--lapis-cor', cor); }
    ['#est-painel-lapis', '#est-painel-texto', '#est-painel-marca'].forEach(sincronizarSwatchesAria);
    (function () {
      const nomes = ['Fino', 'Médio', 'Grosso'];
      container.querySelectorAll('#est-painel-lapis .est-lapis-tamanho').forEach((b, i) => b.setAttribute('aria-label', 'Espessura: ' + (nomes[i] || b.dataset.tamanhoPt)));
    })();
    aplicarCorLapisNaUI(lapisCor);

    function posRelativaCanvas(e, canvas) {
      const rect = canvas.getBoundingClientRect();
      let cx = e.clientX, cy = e.clientY;
      if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      const escalaX = canvas.width / rect.width;
      const escalaY = canvas.height / rect.height;
      return { x: (cx - rect.left) * escalaX, y: (cy - rect.top) * escalaY };
    }

    function iniciarTraco(e) {
      if (modoAtual !== 'lapis') return;
      e.preventDefault();
      desenhandoAgora = true;
      const p = posRelativaCanvas(e, tracoCanvas);
      tracoEmAndamento = { pontosPx: [p], corHex: lapisCor, larguraPt: lapisTamanhoPt };
      const ctx = tracoCanvas.getContext('2d');
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = lapisCor;
      ctx.lineWidth = lapisTamanhoPt * obterEscalaAtual();
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
    }
    function moverTraco(e) {
      if (!desenhandoAgora || !tracoEmAndamento) return;
      e.preventDefault();
      const p = posRelativaCanvas(e, tracoCanvas);
      const pontos = tracoEmAndamento.pontosPx;
      const last = pontos[pontos.length - 1];
      const xc = (last.x + p.x) / 2, yc = (last.y + p.y) / 2;
      const ctx = tracoCanvas.getContext('2d');
      ctx.quadraticCurveTo(last.x, last.y, xc, yc);
      ctx.stroke();
      pontos.push(p);
    }
    function finalizarTraco() {
      if (!desenhandoAgora) return;
      desenhandoAgora = false;
      if (tracoEmAndamento && tracoEmAndamento.pontosPx.length > 1) {
        salvarEstado();
        const w = tracoCanvas.width, h = tracoCanvas.height;
        const pontosNorm = tracoEmAndamento.pontosPx.map(p => ({ x: p.x / w, y: p.y / h }));
        tracos[idAtual()].push({ pontosNorm, corHex: tracoEmAndamento.corHex, larguraPt: tracoEmAndamento.larguraPt });
      }
      tracoEmAndamento = null;
    }

    tracoCanvas.addEventListener('mousedown', iniciarTraco);
    tracoCanvas.addEventListener('mousemove', moverTraco);
    tracoCanvas.addEventListener('mouseup', finalizarTraco);
    tracoCanvas.addEventListener('mouseleave', finalizarTraco);
    tracoCanvas.addEventListener('touchstart', iniciarTraco, { passive: false });
    tracoCanvas.addEventListener('touchmove', moverTraco, { passive: false });
    tracoCanvas.addEventListener('touchend', finalizarTraco);

    function redesenharTracos() {
      tracoCanvas.width = cvsEditor.width;
      tracoCanvas.height = cvsEditor.height;
      const ctx = tracoCanvas.getContext('2d');
      ctx.clearRect(0, 0, tracoCanvas.width, tracoCanvas.height);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const escala = obterEscalaAtual();
      const lista = tracos[idAtual()] || [];
      lista.forEach(tr => {
        if (!tr.pontosNorm || tr.pontosNorm.length < 2) return;
        ctx.strokeStyle = tr.corHex;
        ctx.lineWidth = tr.larguraPt * escala;
        ctx.beginPath();
        tr.pontosNorm.forEach((p, i) => {
          const px = p.x * tracoCanvas.width, py = p.y * tracoCanvas.height;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    }

    // --- TEXTO: fontes padrão + métricas (pdf-lib) ---
    let _fontesMetricasCache = null;
    async function obterFontesMetricas() {
      if (_fontesMetricasCache) return _fontesMetricasCache;
      await PDFTools.carregarLib('pdf-lib');
      const { PDFDocument, StandardFonts } = window.PDFLib;
      const scratch = await PDFDocument.create();
      const nomes = ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique',
                     'TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic',
                     'Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'];
      const fontes = {};
      for (const nome of nomes) fontes[nome] = await scratch.embedFont(StandardFonts[nome]);
      _fontesMetricasCache = fontes;
      return fontes;
    }

    function nomeFonteVariante(familia, negrito, italico) {
      const mapa = {
        helvetica: { r: 'Helvetica', b: 'HelveticaBold', i: 'HelveticaOblique', bi: 'HelveticaBoldOblique' },
        times: { r: 'TimesRoman', b: 'TimesRomanBold', i: 'TimesRomanItalic', bi: 'TimesRomanBoldItalic' },
        courier: { r: 'Courier', b: 'CourierBold', i: 'CourierOblique', bi: 'CourierBoldOblique' }
      };
      const g = mapa[familia] || mapa.helvetica;
      if (negrito && italico) return g.bi;
      if (negrito) return g.b;
      if (italico) return g.i;
      return g.r;
    }

    function obterFontFamilyCss(familia) {
      if (familia === 'times') return "'Times New Roman', Times, serif";
      if (familia === 'courier') return "'Courier New', Courier, monospace";
      return 'Helvetica, Arial, sans-serif';
    }

    function hexParaRgbFracao(hex) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!m) return { r: 0, g: 0, b: 0 };
      return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
    }

    // Quebra o texto em linhas que cabem em larguraMaxPt (uma palavra de cada vez), preservando
    // as quebras de linha (\n) que a pessoa digitou. Usada tanto na prévia quanto na exportação —
    // é o que garante que a tela mostra exatamente o que vai sair no PDF.
    function quebrarTextoEmLinhas(font, texto, tamanhoPt, larguraMaxPt) {
      const linhasFinais = [];
      const paragrafos = (texto || '').split('\n');
      for (const paragrafo of paragrafos) {
        if (paragrafo === '') { linhasFinais.push(''); continue; }
        const palavras = paragrafo.split(' ');
        let linhaAtual = '';
        for (const palavra of palavras) {
          const tentativa = linhaAtual ? linhaAtual + ' ' + palavra : palavra;
          if (!linhaAtual || font.widthOfTextAtSize(tentativa, tamanhoPt) <= larguraMaxPt) {
            linhaAtual = tentativa;
          } else {
            linhasFinais.push(linhaAtual);
            linhaAtual = palavra;
          }
        }
        linhasFinais.push(linhaAtual);
      }
      return linhasFinais;
    }

    function encontrarCaractereNaoSuportado(font, texto) {
      return PDFTools.encontrarCaractereNaoSuportado(font, texto);
    }

    // `larguraPaginaPt`/`alturaPaginaPt` são opcionais e existem só pro caso de a pessoa navegar
    // pra outra página (setas ▲/▼) enquanto ainda está commitando um texto da página anterior —
    // sem isso, o cálculo usaria as dimensões da página NOVA (já trocadas em visPageWidthPt/
    // visPageHeightPt) pra redimensionar o texto da página ANTIGA.
    async function recalcularCaixaTexto(item, usarLarguraPadrao, larguraPaginaPt, alturaPaginaPt) {
      const largPagina = larguraPaginaPt || visPageWidthPt;
      const altPagina = alturaPaginaPt || visPageHeightPt;
      const fontes = await obterFontesMetricas();
      const font = fontes[nomeFonteVariante(item.familia, item.negrito, item.italico)];

      // Nunca deixa a caixa passar da borda direita da página — senão o texto fica escondido
      // "fora" da página no PDF final (visualmente cortado, mesmo com o dado intacto no item).
      const espacoDisponivelPt = Math.max(largPagina - item.x * largPagina, item.tamanhoPt * 3);

      let larguraCaixaPt;
      if (usarLarguraPadrao) {
        const larguraTextoSemQuebra = font.widthOfTextAtSize((item.val || ' ').replace(/\n/g, ' ') || ' ', item.tamanhoPt);
        larguraCaixaPt = Math.min(larguraTextoSemQuebra + 10, largPagina * 0.6, espacoDisponivelPt);
        larguraCaixaPt = Math.max(larguraCaixaPt, item.tamanhoPt * 3);
      } else {
        larguraCaixaPt = Math.max(Math.min(item.w * largPagina, espacoDisponivelPt), item.tamanhoPt * 2);
      }

      const linhas = quebrarTextoEmLinhas(font, item.val, item.tamanhoPt, larguraCaixaPt);
      const alturaLinhaPt = item.tamanhoPt * 1.25;
      const alturaCaixaPt = Math.max(linhas.length, 1) * alturaLinhaPt + 6;

      item.w = larguraCaixaPt / largPagina;
      item.h = alturaCaixaPt / altPagina;
    }

    function aplicarEstiloFonteNoElemento(el, item, escala) {
      el.style.fontFamily = obterFontFamilyCss(item.familia);
      el.style.fontSize = (item.tamanhoPt * escala) + 'px';
      el.style.color = item.corHex;
      el.style.fontWeight = item.negrito ? 'bold' : 'normal';
      el.style.fontStyle = item.italico ? 'italic' : 'normal';
      el.style.lineHeight = '1.25';
    }

    // --- Controles de fonte na barra flutuante ---
    function sincronizarControlesFonte() {
      container.querySelector('#est-fonte-familia').value = fonteFamilia;
      container.querySelector('#est-fonte-tamanho').value = fonteTamanhoPt;
      container.querySelector('#est-fonte-negrito').classList.toggle('ativo', fonteNegrito);
      container.querySelector('#est-fonte-italico').classList.toggle('ativo', fonteItalico);
      container.querySelectorAll('#est-painel-texto .est-cor-swatch').forEach(b => b.classList.toggle('ativo', b.dataset.cor === fonteCor));
      sincronizarSwatchesAria('#est-painel-texto');
    }

    function aoMudarControleFonte() {
      if (idxEditando === null) return;
      const item = itensTexto[idAtual()][idxEditando];
      if (!item) return;
      item.tamanhoPt = fonteTamanhoPt; item.corHex = fonteCor; item.familia = fonteFamilia;
      item.negrito = fonteNegrito; item.italico = fonteItalico;
      const el = layer.children[idxEditando];
      const ta = el && el.querySelector('.est-texto-editando-area');
      if (ta) aplicarEstiloFonteNoElemento(ta, item, obterEscalaAtual());
    }

    container.querySelector('#est-fonte-familia').onchange = (e) => { fonteFamilia = e.target.value; aoMudarControleFonte(); };
    container.querySelector('#est-fonte-tamanho').oninput = (e) => {
      fonteTamanhoPt = Math.max(6, parseFloat(e.target.value) || 16);
      aoMudarControleFonte();
    };
    container.querySelector('#est-fonte-negrito').onclick = (e) => {
      fonteNegrito = !fonteNegrito;
      e.currentTarget.classList.toggle('ativo', fonteNegrito);
      aoMudarControleFonte();
    };
    container.querySelector('#est-fonte-italico').onclick = (e) => {
      fonteItalico = !fonteItalico;
      e.currentTarget.classList.toggle('ativo', fonteItalico);
      aoMudarControleFonte();
    };
    container.querySelectorAll('#est-painel-texto .est-cor-swatch').forEach(btn => {
      btn.onclick = () => {
        fonteCor = btn.dataset.cor;
        container.querySelectorAll('#est-painel-texto .est-cor-swatch').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        sincronizarSwatchesAria('#est-painel-texto');
        aoMudarControleFonte();
      };
    });
    container.querySelector('#est-texto-cor-custom').oninput = (e) => {
      fonteCor = e.target.value;
      container.querySelectorAll('#est-painel-texto .est-cor-swatch').forEach(b => b.classList.remove('ativo'));
      sincronizarSwatchesAria('#est-painel-texto');
      aoMudarControleFonte();
    };

    // --- Clique na página (modo Texto) cria uma caixa nova e já abre pra digitar ---
    wrapper.addEventListener('click', (e) => {
      // Se este clique acabou de fechar uma caixa em edição, ele não cria outra (consome o flag).
      const fechouEdicao = cliqueFechouEdicao; cliqueFechouEdicao = false;
      if (modoAtual !== 'texto') return;
      if (e.target.closest('.est-texto-editando-area')) return;
      // Clicar num item já existente (mesmo em modo Texto) seleciona/arrasta esse item — não cria
      // uma caixa nova por cima dele (era o que causava a perda do texto recém-digitado e a caixa
      // fantasma). Criar caixa nova continua valendo só ao clicar numa área vazia da página.
      if (e.target.closest('.est-item-arrastavel')) return;
      if (fechouEdicao) return;
      const rect = cvsEditor.getBoundingClientRect();
      const xFrac = (e.clientX - rect.left) / rect.width;
      const yFrac = (e.clientY - rect.top) / rect.height;
      if (xFrac < 0 || xFrac > 1 || yFrac < 0 || yFrac > 1) return;
      criarNovoItemTexto(xFrac, yFrac);
    });

    // --- Clique + arrasto na página (modo Marca) cria um grifo translúcido ---
    function posFracaoPagina(e) {
      const rect = cvsEditor.getBoundingClientRect();
      let cx = e.clientX, cy = e.clientY;
      if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      return { x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height };
    }

    function iniciarMarca(e) {
      if (modoAtual !== 'marca') return;
      if (e.target.closest('.est-texto-editando-area')) return;
      e.preventDefault();
      const p = posFracaoPagina(e);
      const el = document.createElement('div');
      el.className = 'est-marca-temp';
      el.style.background = marcaCorAtual;
      el.style.left = (p.x * cvsEditor.width) + 'px';
      el.style.top = (p.y * cvsEditor.height) + 'px';
      el.style.width = '0px';
      el.style.height = '0px';
      layer.appendChild(el);
      marcaEmAndamento = { elemento: el, startXFrac: p.x, startYFrac: p.y };
    }

    function moverMarca(e) {
      if (!marcaEmAndamento) return;
      e.preventDefault();
      const p = posFracaoPagina(e);
      const w = cvsEditor.width, h = cvsEditor.height;
      const x0 = marcaEmAndamento.startXFrac * w, y0 = marcaEmAndamento.startYFrac * h;
      const x1 = Math.max(0, Math.min(p.x, 1)) * w, y1 = Math.max(0, Math.min(p.y, 1)) * h;
      marcaEmAndamento.elemento.style.left = Math.min(x0, x1) + 'px';
      marcaEmAndamento.elemento.style.top = Math.min(y0, y1) + 'px';
      marcaEmAndamento.elemento.style.width = Math.abs(x1 - x0) + 'px';
      marcaEmAndamento.elemento.style.height = Math.abs(y1 - y0) + 'px';
    }

    function finalizarMarca() {
      if (!marcaEmAndamento) return;
      const el = marcaEmAndamento.elemento;
      const w = cvsEditor.width, h = cvsEditor.height;
      const xFrac = parseFloat(el.style.left) / w;
      const yFrac = parseFloat(el.style.top) / h;
      const wFrac = parseFloat(el.style.width) / w;
      let hFrac = parseFloat(el.style.height) / h;
      el.remove();
      marcaEmAndamento = null;

      // "!(wFrac >= 0.01)" (em vez de "wFrac < 0.01") também barra NaN — comparação com NaN é
      // sempre falsa, então um "<" comum deixaria passar um item quebrado (width/height nunca
      // definidos porque nenhum mousemove rodou entre o mousedown e o mouseup).
      if (!(wFrac >= 0.01) || !isFinite(xFrac) || !isFinite(yFrac)) return; // arrasto irrelevante ou inválido, ignora

      // Um arrasto quase só horizontal (a pessoa "passando o marcador" numa linha) ganha uma
      // altura mínima equivalente a uma linha de texto comum — senão o grifo fica fino demais
      // pra cobrir o texto de verdade.
      const alturaLinhaFrac = (16 * 1.3) / visPageHeightPt;
      if (hFrac < alturaLinhaFrac * 0.6) hFrac = alturaLinhaFrac;

      salvarEstado();
      itensTexto[idAtual()].push({ tipo: 'marca', x: xFrac, y: yFrac, w: wFrac, h: hFrac, corHex: marcaCorAtual });
      renderizarItensEditor();
    }

    wrapper.addEventListener('mousedown', iniciarMarca);
    wrapper.addEventListener('mousemove', moverMarca);
    wrapper.addEventListener('mouseup', finalizarMarca);
    wrapper.addEventListener('mouseleave', finalizarMarca);
    wrapper.addEventListener('touchstart', iniciarMarca, { passive: false });
    wrapper.addEventListener('touchmove', moverMarca, { passive: false });
    wrapper.addEventListener('touchend', finalizarMarca);

    function criarNovoItemTexto(xFrac, yFrac) {
      const linhaAlturaFrac = (fonteTamanhoPt * 1.25) / visPageHeightPt;
      const item = {
        tipo: 'texto', val: '', x: xFrac, y: yFrac, w: 0.3, h: linhaAlturaFrac,
        tamanhoPt: fonteTamanhoPt, corHex: fonteCor, familia: fonteFamilia,
        negrito: fonteNegrito, italico: fonteItalico
      };
      itensTexto[idAtual()].push(item);
      const idx = itensTexto[idAtual()].length - 1;
      renderizarItensEditor().then(() => abrirEdicaoTexto(idx));
    }

    async function abrirEdicaoTexto(idx) {
      idxEditando = idx;
      // Capturados agora: se a pessoa navegar pra outra página (setas ▲/▼) enquanto ainda está
      // editando este texto, o commit precisa continuar mirando a página/dimensões de ONDE o
      // texto está, não da página nova que passou a estar visível.
      const paginaDoItemIdx = paginaAtualModal;
      const paginaDoItemId = idAtual();
      const larguraPaginaDoItem = visPageWidthPt;
      const alturaPaginaDoItem = visPageHeightPt;
      const item = itensTexto[paginaDoItemId] && itensTexto[paginaDoItemId][idx];
      if (!item) return;

      fonteFamilia = item.familia; fonteTamanhoPt = item.tamanhoPt; fonteCor = item.corHex;
      fonteNegrito = item.negrito; fonteItalico = item.italico;
      sincronizarControlesFonte();
      if (modoAtual !== 'texto') definirModo('texto');

      await renderizarItensEditor();
      const el = layer.children[idx];
      if (!el) return;
      const txtDiv = el.querySelector('.txt');
      if (txtDiv) txtDiv.style.display = 'none';

      const ta = document.createElement('textarea');
      ta.className = 'est-texto-editando-area';
      ta.value = item.val;
      aplicarEstiloFonteNoElemento(ta, item, obterEscalaAtual());
      el.appendChild(ta);
      ta.focus();
      ta.select();

      const commit = async () => {
        const novoTexto = ta.value;
        const fontes = await obterFontesMetricas();
        const fonteTeste = fontes[nomeFonteVariante(fonteFamilia, fonteNegrito, fonteItalico)];
        const charRuim = novoTexto ? encontrarCaractereNaoSuportado(fonteTeste, novoTexto) : null;
        if (charRuim) {
          PDFTools.UI.mostrarToast(`O caractere "${charRuim}" não é suportado por essa fonte — tente removê-lo ou trocar a fonte.`, 'erro');
          return; // mantém a caixa aberta pra pessoa corrigir
        }

        document.removeEventListener('mousedown', aoCliqueFora, true);
        // Só limpa idxEditando se ele ainda apontar pra este item — um clique que cria uma caixa
        // nova enquanto esta ainda estava commitando (assíncrono) já pode ter avançado o índice.
        if (idxEditando === idx) idxEditando = null;
        salvarEstado();
        if (!novoTexto.trim()) {
          itensTexto[paginaDoItemId].splice(idx, 1);
        } else {
          item.val = novoTexto;
          item.tamanhoPt = fonteTamanhoPt; item.corHex = fonteCor; item.familia = fonteFamilia;
          item.negrito = fonteNegrito; item.italico = fonteItalico;
          const larguraJaAjustada = item._larguraManual === true;
          await recalcularCaixaTexto(item, !larguraJaAjustada, larguraPaginaDoItem, alturaPaginaDoItem);
        }
        // Só re-renderiza a camada se a página ainda for a mesma — se a pessoa já navegou pra
        // outra página, quem cuida da tela agora é o abrirEditor() que ela disparou.
        if (paginaAtualModal === paginaDoItemIdx) renderizarItensEditor();
      };

      // Não dá pra confiar só no "blur" da textarea: depois que o foco sai dela pela primeira vez
      // (ex: clicou no seletor de fonte), ele não volta sozinho — cliques seguintes em OUTROS
      // controles não disparam mais nenhum evento nela. Por isso ouvimos mousedown no document
      // inteiro (fase de captura, roda antes de qualquer outro clique): só NÃO commita se o clique
      // foi dentro da própria caixa de texto ou dentro do painel de fonte (ajustando as opções).
      function aoCliqueFora(e) {
        if (ta.contains(e.target)) return;
        if (e.target.closest && e.target.closest('#est-painel-texto')) return;
        // Só marca o flag quando o clique cai dentro da página (o único lugar que criaria uma caixa
        // nova); cliques na barra/painel commitam sem precisar suprimir criação nenhuma.
        if (wrapper.contains(e.target)) cliqueFechouEdicao = true;
        commit();
      }
      document.addEventListener('mousedown', aoCliqueFora, true);

      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); commit(); }
        e.stopPropagation(); // não deixa o Ctrl+Z global (desfazer da página) roubar teclas do textarea
      });
    }

    // --- APLICAR A TODAS ---
    container.querySelector('#btn-aplicar-todas').onclick = () => {
      const ts = tracos[idAtual()] || [];
      const its = itensTexto[idAtual()] || [];
      if (ts.length === 0 && its.length === 0) return alert('Inclua pelo menos um traço ou texto nesta página primeiro.');
      if (confirm('Replicar os traços e textos desta página para TODAS as páginas do documento? Isso sobrescreve a edição das outras. (O giro da página NÃO é replicado — cada página mantém a própria rotação.)')) {
        salvarEstado();
        const cloneTs = JSON.parse(JSON.stringify(ts));
        const cloneIts = JSON.parse(JSON.stringify(its));
        for (let i = 0; i < numPaginas(); i++) {
          const id = idEm(i);
          tracos[id] = JSON.parse(JSON.stringify(cloneTs));
          itensTexto[id] = JSON.parse(JSON.stringify(cloneIts));
        }
        redesenharTracos();
        renderizarItensEditor();
        PDFTools.UI.mostrarToast('Aplicado a todas as páginas com sucesso.', 'sucesso');
      }
    };

    // --- Renderização dos itens de texto (arrastáveis) ---
    async function renderizarItensEditor() {
      layer.innerHTML = '';
      const lista = itensTexto[idAtual()] || [];
      const w = cvsEditor.width, h = cvsEditor.height;
      const escala = obterEscalaAtual();
      const fontes = await obterFontesMetricas();

      lista.forEach((item, idx) => {
        const el = document.createElement('div');
        el.className = 'est-item-arrastavel';
        el.style.left = (item.x * w) + 'px';
        el.style.top = (item.y * h) + 'px';
        el.style.width = (item.w * w) + 'px';
        el.style.height = (item.h * h) + 'px';

        if (item.tipo === 'marca') {
          const fill = document.createElement('div');
          fill.className = 'marca-fill';
          fill.style.background = item.corHex;
          el.appendChild(fill);
        } else {
          const txt = document.createElement('div');
          txt.className = 'txt';
          aplicarEstiloFonteNoElemento(txt, item, escala);
          const font = fontes[nomeFonteVariante(item.familia, item.negrito, item.italico)];
          const linhas = quebrarTextoEmLinhas(font, item.val, item.tamanhoPt, Math.max(item.w * visPageWidthPt, 1));
          txt.textContent = linhas.join('\n');
          el.appendChild(txt);
        }

        const resizer = document.createElement('div'); resizer.className = 'est-resize-handle'; el.appendChild(resizer);
        const del = document.createElement('div'); del.className = 'est-delete-handle'; del.textContent = '✕'; el.appendChild(del);

        // Itens já criados podem ser manipulados em qualquer modo MENOS o Lápis (que precisa da
        // página livre pra desenhar) — assim, logo depois de digitar, clicar no item já move/edita
        // sem exigir troca manual pro modo Mover (era a causa do "clico e não move").
        el.onmousedown = (e) => { if (modoAtual !== 'lapis') startDrag(e, idx, el, item); };
        el.ontouchstart = (e) => { if (modoAtual !== 'lapis') startDrag(e, idx, el, item); };
        el.ondblclick = (e) => { if (modoAtual !== 'lapis' && item.tipo !== 'marca') { e.stopPropagation(); abrirEdicaoTexto(idx); } };
        resizer.onmousedown = (e) => { if (modoAtual !== 'lapis') startResize(e, idx, el, item); };
        resizer.ontouchstart = (e) => { if (modoAtual !== 'lapis') startResize(e, idx, el, item); };
        del.onclick = (e) => {
          if (modoAtual === 'lapis') return;
          e.stopPropagation(); salvarEstado();
          itensTexto[idAtual()].splice(idx, 1);
          renderizarItensEditor();
        };

        layer.appendChild(el);
      });
    }

    // --- DRAG E RESIZE (itens de texto) ---
    let draggingInfo = null;

    // draggingInfo guarda a REFERÊNCIA do elemento (el) e do item (não só o índice): se um
    // re-render assíncrono da camada acontecer no meio do gesto, reler layer.children[idx] pegaria
    // outro elemento (ou um índice já deslocado por um splice) — guardar a referência blinda contra
    // isso (hipóteses H2/H3 da investigação do bug de mover texto).
    function startDrag(e, idx, el, item) {
      if (e.target.classList.contains('est-resize-handle') || e.target.classList.contains('est-delete-handle') || e.target.classList.contains('est-texto-editando-area')) return;
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.est-item-arrastavel').forEach(el => el.classList.remove('ativo'));
      el.classList.add('ativo');
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      draggingInfo = { mode: 'drag', idx, el, item, startX: cx, startY: cy, initL: parseFloat(el.style.left), initT: parseFloat(el.style.top) };
    }

    function startResize(e, idx, el, item) {
      e.preventDefault(); e.stopPropagation();
      el.classList.add('ativo');
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      draggingInfo = { mode: 'resize', idx, el, item, startX: cx, startY: cy, initW: parseFloat(el.style.width), initH: parseFloat(el.style.height) };
    }

    function doMove(e) {
      if (!draggingInfo) return;
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - draggingInfo.startX;
      const dy = cy - draggingInfo.startY;
      const el = draggingInfo.el;
      if (!el) return;

      if (draggingInfo.mode === 'drag') {
        el.style.left = (draggingInfo.initL + dx) + 'px';
        el.style.top = (draggingInfo.initT + dy) + 'px';
      } else {
        el.style.width = Math.max(20, draggingInfo.initW + dx) + 'px';
        // Marca texto também redimensiona a altura no arrasto — diferente de texto, onde a
        // altura é sempre recalculada a partir da quebra de linha, não arrastada manualmente.
        if (draggingInfo.item && draggingInfo.item.tipo === 'marca') {
          el.style.height = Math.max(10, draggingInfo.initH + dy) + 'px';
        }
      }
    }

    function doEnd(e) {
      if (!draggingInfo) {
        if (e.target === layer) document.querySelectorAll('.est-item-arrastavel').forEach(el => el.classList.remove('ativo'));
        return;
      }
      const idx = draggingInfo.idx;
      const el = draggingInfo.el;
      const item = draggingInfo.item;
      const modo = draggingInfo.mode;

      // Um clique simples (sem arrastar de fato) passa por aqui também — sem isso, o próprio ato
      // de clicar num item já dispararia um re-render assíncrono da camada inteira, o que atrapalha
      // o duplo clique (o 2º clique pode cair no instante em que a camada está sendo reconstruída).
      const semMovimento = modo === 'drag'
        ? (parseFloat(el.style.left) === draggingInfo.initL && parseFloat(el.style.top) === draggingInfo.initT)
        : (parseFloat(el.style.width) === draggingInfo.initW && parseFloat(el.style.height) === draggingInfo.initH);
      draggingInfo = null;
      if (semMovimento) return;
      if (!el || !item) return;

      salvarEstado();
      const wCvs = cvsEditor.width, hCvs = cvsEditor.height;
      item.x = parseFloat(el.style.left) / wCvs;
      item.y = parseFloat(el.style.top) / hCvs;
      item.w = parseFloat(el.style.width) / wCvs;

      // O re-render reconstrói o DOM do zero, então perde a seleção (.ativo) de quem tinha
      // acabado de mover/redimensionar — reaplica pra não esconder os cabos logo depois do gesto.
      const reselecionar = () => { const el2 = layer.children[idx]; if (el2) el2.classList.add('ativo'); };

      if (modo === 'resize' && item.tipo === 'marca') {
        item.h = parseFloat(el.style.height) / hCvs;
        renderizarItensEditor().then(reselecionar);
      } else if (modo === 'resize') {
        item._larguraManual = true;
        recalcularCaixaTexto(item, false).then(renderizarItensEditor).then(reselecionar);
      } else {
        renderizarItensEditor().then(reselecionar);
      }
    }

    const arrastoDoc = Ed.ouvirArrastoDocumento({ onMove: doMove, onEnd: doEnd });
    layer.addEventListener('click', doEnd);

    // --- DESFAZER ---
    function salvarEstado() {
      // Snapshot inclui a lista de páginas (identidade + ordem). proximoIdPagina NÃO entra:
      // ids nunca são reaproveitados, mesmo após desfazer.
      historico.push(JSON.stringify({
        paginas: paginas,
        tracos: tracos,
        itensTexto: itensTexto,
        giros: giros
      }));
      if (historico.length > 20) historico.shift();
    }

    container.querySelector('#btn-est-desfazer').onclick = () => {
      if (historico.length > 1) {
        // O topo da pilha é o snapshot salvo bem antes da última mudança — usa ele direto como
        // novo estado (e remove da pilha), em vez de descartá-lo e pular pro que vem antes dele.
        const estado = JSON.parse(historico.pop());
        if (estado.paginas) paginas = estado.paginas;
        tracos = estado.tracos; itensTexto = estado.itensTexto;
        if (estado.giros) giros = estado.giros;
        if (paginaAtualModal >= numPaginas()) paginaAtualModal = Math.max(0, numPaginas() - 1);
        idxEditando = null;
        // Grade precisa acompanhar (desfazer de exclusão devolve página).
        renderizarGrade();
        const modalAberto = modalEditor.style.display !== 'none';
        if (modalAberto) {
          abrirEditor(paginaAtualModal);
        }
      }
    };

    function aoTecladoEstudio(e) {
      if (modalEditor.style.display === 'none') return;
      const foco = document.activeElement;
      const focoTag = foco && foco.tagName;
      const textoAtivo = foco && (focoTag === 'TEXTAREA' || focoTag === 'INPUT' || foco.isContentEditable);
      if (e.ctrlKey && e.key === 'z') {
        container.querySelector('#btn-est-desfazer').click();
        return;
      }
      if (textoAtivo) return;

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const mapaAtalhos = { v: 'mover', l: 'lapis', t: 'texto', m: 'marca' };
        const modo = mapaAtalhos[e.key.toLowerCase()];
        if (modo) {
          e.preventDefault();
          definirModo(modo);
          return;
        }
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const ativo = document.activeElement;
        if (ativo && ativo.classList && ativo.classList.contains('est-modo-btn')) {
          e.preventDefault();
          focarModoRelativo(e.key === 'ArrowDown' ? 1 : -1);
        }
      }
    }
    document.addEventListener('keydown', aoTecladoEstudio);

    container.querySelector('#btn-est-fechar').onclick = () => {
      if (document.fullscreenElement === modalEditor) document.exitFullscreen().catch(() => {});
      Ed.fecharModalEditor(modalEditor);
      // Re-renderiza a miniatura da página recém-editada pra refletir giro/conteúdo na grade.
      const elPag = container.querySelector(`.est-pagina[data-index="${paginaAtualModal}"]`);
      if (elPag) {
        const thumb = elPag.querySelector('.est-thumb-container');
        if (thumb) thumb.innerHTML = '';
        delete elPag.dataset.rendered;
        renderizarMiniatura(elPag);
      }
      atualizarBadges();
    };

    // --- TELA CHEIA (igual player de vídeo — usa a Fullscreen API, com fallback silencioso já
    // que o modal, mesmo fora da API, já cobre 100% da viewport via CSS) ---
    const btnFullscreen = container.querySelector('#btn-est-fullscreen');
    btnFullscreen.onclick = async () => {
      try {
        if (!document.fullscreenElement) {
          if (modalEditor.requestFullscreen) await modalEditor.requestFullscreen();
          else throw new Error('sem suporte');
        } else {
          await document.exitFullscreen();
        }
      } catch (e) {
        PDFTools.UI.mostrarToast('Tela cheia não disponível neste navegador.', 'info');
      }
    };

    function aoMudarFullscreenEstudio() {
      const emTelaCheia = document.fullscreenElement === modalEditor;
      btnFullscreen.innerHTML = window.PDFTools.iconeSVG('ui-tela-cheia') + '<span>' + (emTelaCheia ? 'Sair da Tela Cheia' : 'Tela Cheia') + '</span>';
      if (!paginas[paginaAtualModal]) return;
      recalcularEscalaBase();
      renderizarPaginaNoCanvas(controleZoom.obterZoom());
    }
    document.addEventListener('fullscreenchange', aoMudarFullscreenEstudio);

    const resizeEditor = Ed.criarResizeEditor({
      modalEl: modalEditor,
      modalBody,
      navEl: navegadorPaginas.elemento,
      getViewportRef: () => viewportRefPaginaAtual(),
      getFatorMaximo: () => (document.fullscreenElement === modalEditor ? 3 : 1.5),
      setEscalaBase: (n) => {
        escalaBase = n;
        const viewportRef = viewportRefPaginaAtual();
        visPageWidthPt = viewportRef.width;
        visPageHeightPt = viewportRef.height;
      },
      render: () => renderizarPaginaNoCanvas(controleZoom.obterZoom())
    });

    // --- GERAR PDF ---
    container.querySelector('#btn-gerar').onclick = async () => {
      const totalTracos = Object.values(tracos).flat().length;
      const totalTextos = Object.values(itensTexto).flat().length;
      const totalGiros = Object.values(giros).filter(g => g).length;
      const nPdf = paginas.filter(p => p.origem === 'pdf').length;
      const nOrig = pdfDocJs ? pdfDocJs.numPages : 0;
      const mudouEstrutura = paginas.some(p => p.origem === 'branca') || nPdf !== nOrig;
      if (totalTracos + totalTextos + totalGiros === 0 && !mudouEstrutura) {
        return alert('Você ainda não incluiu nada no documento.\n\nComo fazer:\n1. Clique numa página (ou em “+ Página em branco”).\n2. Desenhe, escreva, grife, gire ou exclua páginas.\n3. Clique em "Gerar PDF Editado".');
      }

      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;
      try {
        await PDFTools.carregarLib('pdf-lib');

        const blob = await aplicarEdicoesEstudio(fileOrig, paginas, tracos, itensTexto, giros, (pct, txt) => progresso.atualizar(pct, txt));
        PDFTools.UI.mostrarToast('PDF editado com sucesso!', 'sucesso');
        const nome = PDFTools.nomeSemExtensao(fileOrig.name) + '-editado.pdf';
        PDFTools.baixar(blob, nome);

        const resArea = container.querySelector('#est-resultado');
        resArea.style.display = 'block';
        container.querySelector('#btn-est-baixar-novamente').onclick = () => PDFTools.baixar(blob, nome);
        const proxContainer = container.querySelector('#est-proximos-passos');
        proxContainer.innerHTML = '';
        const prox = PDFTools.UI.criarProximosPassos({
          blob, nomeArquivo: nome, origemId: 'estudio_principal', tamanhoBytes: blob.size
        });
        if (prox) proxContainer.appendChild(prox);
        PDFTools.registrarAcaoSessao('Fez pequenas edições no documento');

      } catch (err) {
        PDFTools.UI.toastErro(err);
      } finally {
        progresso.esconder();
        btn.disabled = false;
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);

    // Cleanup chamado por index.html ao trocar de ferramenta ou voltar pra home: remove todos os
    // listeners que ficam no `document` (mesmas referências) e desliga o observer de miniaturas.
    return function limparEstudio() {
      try { arrastoDoc.destruir(); } catch (e) {}
      try { resizeEditor.destruir(); } catch (e) {}
      document.removeEventListener('keydown', aoTecladoEstudio);
      document.removeEventListener('fullscreenchange', aoMudarFullscreenEstudio);
      Ed.fecharModalEditor(modalEditor);
      try { fecharModalTamanhoBranca(); } catch (e) {}
      try { a11yEditor.destruir(); } catch (e) {}
      try { a11yTam.destruir(); } catch (e) {}
      try { visaoObserver.disconnect(); } catch (e) {}
    };
}

PDFTools.registrar({
  id: 'estudio_principal',
  nome: 'Pequenas Edições',
  descricao: 'Desenhe à mão livre ou inclua uma caixa de texto direto sobre a página — pequenas edições, sem precisar de outra ferramenta.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: (container, arquivoInicial, opts) => montarEstudioUI(container, arquivoInicial, opts)
});

// --- LÓGICA PURA (exportação) ---

// Mesma convenção de contra-rotação usada nas outras ferramentas (Assinar, Tarjar): a tela
// mostra a página já rotacionada (pdf.js aplica /Rotate sozinho); pontos e caixas guardados são
// fracionários (0-1) relativos a essa visão visual, então cada um precisa ser reconvertido pra
// coordenada bruta (não rotacionada) do PDF antes de desenhar.
function nomeFonteVarianteGlobal(familia, negrito, italico) {
  const mapa = {
    helvetica: { r: 'Helvetica', b: 'HelveticaBold', i: 'HelveticaOblique', bi: 'HelveticaBoldOblique' },
    times: { r: 'TimesRoman', b: 'TimesRomanBold', i: 'TimesRomanItalic', bi: 'TimesRomanBoldItalic' },
    courier: { r: 'Courier', b: 'CourierBold', i: 'CourierOblique', bi: 'CourierBoldOblique' }
  };
  const g = mapa[familia] || mapa.helvetica;
  if (negrito && italico) return g.bi;
  if (negrito) return g.b;
  if (italico) return g.i;
  return g.r;
}

function hexParaRgbFracaoGlobal(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 };
}

function quebrarTextoEmLinhasGlobal(font, texto, tamanhoPt, larguraMaxPt) {
  const linhasFinais = [];
  const paragrafos = (texto || '').split('\n');
  for (const paragrafo of paragrafos) {
    if (paragrafo === '') { linhasFinais.push(''); continue; }
    const palavras = paragrafo.split(' ');
    let linhaAtual = '';
    for (const palavra of palavras) {
      const tentativa = linhaAtual ? linhaAtual + ' ' + palavra : palavra;
      if (!linhaAtual || font.widthOfTextAtSize(tentativa, tamanhoPt) <= larguraMaxPt) {
        linhaAtual = tentativa;
      } else {
        linhasFinais.push(linhaAtual);
        linhaAtual = palavra;
      }
    }
    linhasFinais.push(linhaAtual);
  }
  return linhasFinais;
}

function encontrarCaractereNaoSuportadoGlobal(font, texto) {
  return PDFTools.encontrarCaractereNaoSuportado(font, texto);
}

function desenharTracoNoPdf(page, traco, rawW, rawH, angulo) {
  const R = (angulo % 360 + 360) % 360;
  const { rgb, LineCapStyle } = window.PDFLib;
  const { width: visW, height: visH } = PDFTools.dimensoesVisuais(rawW, rawH, R);
  const cor = hexParaRgbFracaoGlobal(traco.corHex);

  const pontosRaw = traco.pontosNorm.map(p => {
    const visX = p.x * visW, visYTopo = p.y * visH;
    const t = PDFTools.posicaoRotacionada(visX, visYTopo, 0, 0, rawW, rawH, R);
    return { x: t.x, y: t.y };
  });

  for (let i = 0; i < pontosRaw.length - 1; i++) {
    page.drawLine({
      start: pontosRaw[i],
      end: pontosRaw[i + 1],
      thickness: traco.larguraPt,
      color: rgb(cor.r, cor.g, cor.b),
      lineCap: LineCapStyle.Round
    });
  }
}

// Grifo translúcido: em vez de confiar na convenção exata de width/height + rotate do
// drawRectangle do pdf-lib, transforma os 4 cantos individualmente (mesmo pipeline confiável do
// desenharTracoNoPdf) e desenha o retângulo alinhado aos eixos que já sai correto — rotações
// múltiplas de 90° preservam o formato retangular, então isso é exato, não uma aproximação.
function desenharMarcaNoPdf(page, item, rawW, rawH, angulo) {
  const R = (angulo % 360 + 360) % 360;
  const { rgb } = window.PDFLib;
  const { width: visW, height: visH } = PDFTools.dimensoesVisuais(rawW, rawH, R);
  const cor = hexParaRgbFracaoGlobal(item.corHex);

  const visX0 = item.x * visW, visY0 = item.y * visH;
  const visX1 = visX0 + item.w * visW, visY1 = visY0 + item.h * visH;

  const cantos = [
    PDFTools.posicaoRotacionada(visX0, visY0, 0, 0, rawW, rawH, R),
    PDFTools.posicaoRotacionada(visX1, visY0, 0, 0, rawW, rawH, R),
    PDFTools.posicaoRotacionada(visX0, visY1, 0, 0, rawW, rawH, R),
    PDFTools.posicaoRotacionada(visX1, visY1, 0, 0, rawW, rawH, R)
  ];
  const xs = cantos.map(c => c.x), ys = cantos.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  // Marca-texto de verdade se comporta como tinta translúcida: o preto do texto continua preto
  // e só o fundo branco fica amarelo. Isso é o modo de mesclagem "Multiply" (multiplicação de
  // canais), não opacidade — opacidade clareia o texto junto com o fundo, deixando tudo oliva.
  const opcoesRet = {
    x: minX, y: minY,
    width: maxX - minX, height: maxY - minY,
    color: rgb(cor.r, cor.g, cor.b)
  };
  const BlendMode = window.PDFLib.BlendMode;
  if (BlendMode && BlendMode.Multiply) opcoesRet.blendMode = BlendMode.Multiply;
  else opcoesRet.opacity = 0.4; // fallback caso a versão do pdf-lib não suporte mesclagem
  page.drawRectangle(opcoesRet);
}

function desenharTextoMultilinhaNoPdf(page, item, font, rawW, rawH, angulo) {
  const R = (angulo % 360 + 360) % 360;
  const { degrees, rgb } = window.PDFLib;
  const { width: visW, height: visH } = PDFTools.dimensoesVisuais(rawW, rawH, R);
  const cor = hexParaRgbFracaoGlobal(item.corHex);

  const larguraCaixaPt = item.w * visW;
  const alturaLinhaPt = item.tamanhoPt * 1.25;
  const linhas = quebrarTextoEmLinhasGlobal(font, item.val, item.tamanhoPt, larguraCaixaPt);

  const visX = item.x * visW;
  const visYTopoCaixa = item.y * visH;

  linhas.forEach((linha, i) => {
    if (!linha) return;
    const visYTopoLinha = visYTopoCaixa + i * alturaLinhaPt;
    const t = PDFTools.posicaoRotacionada(visX, visYTopoLinha, larguraCaixaPt, alturaLinhaPt, rawW, rawH, R);
    page.drawText(linha, {
      x: t.x, y: t.y + (item.tamanhoPt * 0.2),
      size: item.tamanhoPt,
      font,
      color: rgb(cor.r, cor.g, cor.b),
      rotate: degrees(t.rotate)
    });
  });
}

/**
 * Exporta o PDF com as edições do Estúdio.
 * paginasLista: [{ id, origem: 'pdf'|'branca', idxOriginal?, larguraPt?, alturaPt? }]
 * Mapas de conteúdo por **id** estável.
 *
 * Sem reordenação de originais:
 *  1) removePage das originais excluídas — de trás pra frente
 *  2) insertPage das brancas nas posições finais — de frente pra trás
 *  ⇒ doc.getPage(j) ≡ paginasLista[j]
 */
async function aplicarEdicoesEstudio(fileOrig, paginasLista, tracosMap, itensTextoMap, girosMap, aoProgredir) {
  const buffer = await PDFTools.lerComoArrayBuffer(fileOrig);
  const { PDFDocument, StandardFonts, degrees } = window.PDFLib;
  const novoDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const lista = paginasLista || [];
  const total = Math.max(1, lista.length);

  aoProgredir(5, 'Ajustando páginas do documento...');
  await new Promise(r => setTimeout(r, 0));

  const sobreviventes = new Set(
    lista.filter(p => p.origem === 'pdf').map(p => p.idxOriginal)
  );
  for (let i = novoDoc.getPageCount() - 1; i >= 0; i--) {
    if (!sobreviventes.has(i)) novoDoc.removePage(i);
  }

  // Inserir brancas de frente pra trás (j já é a posição final).
  lista.forEach((p, j) => {
    if (p.origem === 'branca') {
      novoDoc.insertPage(j, [p.larguraPt, p.alturaPt]);
    }
  });

  const nomesUsados = new Set();
  Object.values(itensTextoMap || {}).flat()
    .filter(it => it && it.tipo !== 'marca')
    .forEach(it => nomesUsados.add(nomeFonteVarianteGlobal(it.familia, it.negrito, it.italico)));
  const fontesEmbutidas = {};
  for (const nome of nomesUsados) fontesEmbutidas[nome] = await novoDoc.embedFont(StandardFonts[nome]);

  for (let j = 0; j < lista.length; j++) {
    aoProgredir(10 + (j / total) * 85, 'Processando página ' + (j + 1) + ' de ' + total + '...');
    await new Promise(r => setTimeout(r, 0));

    const desc = lista[j];
    const id = desc.id;
    const page = novoDoc.getPage(j);
    const rawSize = page.getSize();
    const anguloOriginal = page.getRotation().angle;
    const delta = (girosMap && girosMap[id]) || 0;
    // Branca nasce com /Rotate 0; o giro do editor é o ângulo total.
    const anguloTotal = desc.origem === 'branca'
      ? (((delta % 360) + 360) % 360)
      : (((anguloOriginal + delta) % 360) + 360) % 360;
    if (anguloTotal !== anguloOriginal) page.setRotation(degrees(anguloTotal));
    else if (desc.origem === 'branca' && delta) page.setRotation(degrees(anguloTotal));

    const listaTracos = (tracosMap && tracosMap[id]) || [];
    listaTracos.forEach(tr => desenharTracoNoPdf(page, tr, rawSize.width, rawSize.height, anguloTotal));

    const listaTextos = (itensTextoMap && itensTextoMap[id]) || [];
    for (const item of listaTextos) {
      if (item.tipo === 'marca') {
        desenharMarcaNoPdf(page, item, rawSize.width, rawSize.height, anguloTotal);
        continue;
      }
      if (!item.val) continue;
      const font = fontesEmbutidas[nomeFonteVarianteGlobal(item.familia, item.negrito, item.italico)];
      const charRuim = encontrarCaractereNaoSuportadoGlobal(font, item.val);
      if (charRuim) {
        throw new Error('O texto da página ' + (j + 1) + ' contém o caractere "' + charRuim + '", que não é suportado pela fonte escolhida. Remova esse caractere ou troque a fonte antes de gerar o PDF.');
      }
      desenharTextoMultilinhaNoPdf(page, item, font, rawSize.width, rawSize.height, anguloTotal);
    }
  }

  aoProgredir(99, 'Salvando...');
  await new Promise(r => setTimeout(r, 0));
  const outBytes = await novoDoc.save({ useObjectStreams: true });
  return new Blob([outBytes], { type: 'application/pdf' });
}


