// "Editar" — ferramenta de pequenas edições: a pessoa escolhe uma página e desenha à mão livre
// ou inclui caixas de texto diretamente sobre o conteúdo do PDF. Não é um editor completo — para
// girar/remover/reordenar páginas, tarjar, comprimir, dividir etc. há um botão específico pra
// cada uma na barra de ferramentas do topo.
function montarEstudioUI(container, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let numPages = 0;

    // Duas categorias de conteúdo por página, guardadas separadas porque se comportam diferente:
    // - tracos: traços de lápis à mão livre, vetoriais (pontos normalizados 0-1 + espessura em pt
    //   + cor). Desenhados direto sobre a página, não são "itens" arrastáveis depois de prontos.
    // - itensTexto: caixas de texto, com posição/tamanho fracionários (0-1) — essas sim continuam
    //   arrastáveis/redimensionáveis/apagáveis, e dá pra reabrir pra editar com duplo clique.
    let tracos = {};
    let itensTexto = {};
    let historico = [];
    let paginaAtualModal = 0;

    if (!document.getElementById('css-estudio')) {
      const style = document.createElement('style');
      style.id = 'css-estudio';
      style.textContent = `
        .est-aviso { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; font-size: 14px; color: var(--texto-2); line-height: 1.5; }
        .est-aviso strong { color: var(--texto); }

        .est-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; }
        .est-pagina { background: var(--sup); box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; position: relative; cursor: pointer; transition: transform 0.2s; }
        .est-pagina:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .est-pagina-header { font-size: 12px; padding: 4px; text-align: center; font-weight: bold; background: var(--sup-2); border-bottom: 1px solid var(--borda); color: var(--texto-2); }
        .est-thumb-container { width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--sup); }
        .est-thumb-container canvas { max-width: 100%; max-height: 100%; object-fit: contain; }
        .est-badge { position: absolute; bottom: 4px; right: 4px; background: var(--cor-sucesso); color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; display: none; }

        .est-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; }
        .est-btn-acao:hover { background: #004494; }
        .est-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .est-btn { padding: 6px 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 13px; color: var(--texto); }
        .est-btn:hover { background: var(--sup-2); }

        .est-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; flex-direction: column; }
        .est-modal-topbar { background: var(--cor-primaria); color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .est-modal-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; position: relative; }

        .est-editor-wrapper { position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: inline-block; background: var(--sup); }
        .est-editor-canvas { display: block; }
        .est-editor-layer-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        .est-editor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }

        .est-item-arrastavel { position: absolute; border: 1px dashed transparent; cursor: move; pointer-events: auto; }
        .est-item-arrastavel:hover, .est-item-arrastavel.ativo { border-color: var(--cor-primaria); background: rgba(0, 123, 255, 0.05); }
        .est-item-arrastavel .txt { width: 100%; height: 100%; overflow: hidden; white-space: pre; pointer-events: none; }

        .est-resize-handle { position: absolute; bottom: -5px; right: -5px; width: 14px; height: 14px; background: var(--cor-primaria); border-radius: 50%; cursor: se-resize; display: none; }
        .est-item-arrastavel.ativo .est-resize-handle { display: block; }
        .est-delete-handle { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: var(--cor-erro); color: white; border-radius: 50%; text-align: center; line-height: 20px; font-size: 12px; font-weight: bold; cursor: pointer; display: none; }
        .est-item-arrastavel.ativo .est-delete-handle { display: block; }

        .est-texto-editando-area { width: 100%; height: 100%; border: 1px solid var(--cor-primaria); background: rgba(255,255,255,0.92); resize: none; padding: 2px; margin: 0; outline: none; box-sizing: border-box; }

        .est-ferramentas-flutuante { position: absolute; top: 80px; left: 24px; background: var(--sup); padding: 12px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 4px; z-index: 10; width: 220px; max-height: calc(100% - 100px); overflow-y: auto; }

        .est-modo-grupo { display: flex; gap: 4px; margin-bottom: 8px; }
        .est-modo-btn { flex: 1; padding: 8px 2px; font-size: 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; color: var(--texto); }
        .est-modo-btn.ativo { background: var(--cor-primaria); color: #fff; border-color: var(--cor-primaria); }

        .est-sub-painel { background: var(--sup-2); border-radius: 6px; padding: 10px; margin-bottom: 8px; }
        .est-campo-label { display: block; font-size: 11px; font-weight: bold; color: var(--texto-2); margin-bottom: 3px; }
        .est-select { width: 100%; padding: 6px; border: 1px solid var(--borda); border-radius: 4px; font-size: 13px; background: var(--sup); color: var(--texto); }
        .est-input-num { width: 56px; padding: 6px; border: 1px solid var(--borda); border-radius: 4px; font-size: 13px; background: var(--sup); color: var(--texto); }
        .est-toggle-btn { width: 28px; height: 28px; border: 1px solid var(--borda); border-radius: 4px; background: var(--sup); cursor: pointer; color: var(--texto); }
        .est-toggle-btn.ativo { background: var(--cor-primaria); color: #fff; border-color: var(--cor-primaria); }

        .est-desenho-grupo { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .est-desenho-grupo-label { font-size: 11px; font-weight: bold; color: var(--texto-2); margin-right: 2px; }
        .est-lapis-tamanho { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--borda); background: var(--sup); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
        .est-lapis-tamanho.ativo { border-color: var(--cor-primaria); }
        .est-lapis-tamanho span { border-radius: 50%; background: #000; display: block; }
        .est-cor-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; box-shadow: 0 0 0 1px var(--borda); }
        .est-cor-swatch.ativo { border-color: var(--cor-primaria); }
        .est-cor-custom { width: 24px; height: 24px; border-radius: 50%; border: none; padding: 0; cursor: pointer; background: none; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="est-tela-inicial"></div>
      <div id="est-tela-trabalho" style="display:none;">
        <div class="est-aviso">
          <strong>O que dá pra fazer aqui:</strong> pequenas edições numa página — desenhar à mão
          livre com o lápis (tamanhos e cores) ou incluir uma caixa de texto, clicando direto sobre
          o conteúdo do PDF. Para reorganizar, girar ou remover páginas, apagar informações
          sensíveis, comprimir ou outras alterações maiores, use a ferramenta específica na barra
          do topo.
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="font-size:16px; font-weight:bold; color:var(--texto);">Clique numa página para editar:</div>
          <button class="est-btn-acao" id="btn-gerar" style="width:auto; padding:10px 20px;">Gerar PDF Editado</button>
        </div>
        <div class="est-grade" id="est-grade"></div>
        <div id="est-progresso-container" style="margin-top:16px;"></div>
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
          <div style="display:flex; gap:8px;">
            <button class="est-btn" id="btn-est-desfazer">Desfazer (Ctrl+Z)</button>
            <button class="est-btn" id="btn-est-fullscreen">⛶ Tela Cheia</button>
            <button class="est-btn" style="background:var(--cor-primaria); color:white; border-color:var(--cor-primaria);" id="btn-est-fechar">Concluir Página</button>
          </div>
        </div>

        <div class="est-ferramentas-flutuante">
          <div class="est-modo-grupo">
            <button type="button" class="est-modo-btn ativo" data-modo="mover" title="Mover e editar itens">🖐️ Mover</button>
            <button type="button" class="est-modo-btn" data-modo="lapis" title="Desenhar à mão livre">✏️ Lápis</button>
            <button type="button" class="est-modo-btn" data-modo="texto" title="Incluir caixa de texto">📝 Texto</button>
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

          <hr style="border:0; border-top: 1px solid var(--borda); margin:8px 0;">
          <button class="est-btn" id="btn-aplicar-todas" style="text-align:left; color:var(--cor-primaria);">✨ Aplicar a Todas</button>
        </div>

        <div class="est-modal-body" id="est-modal-body">
          <div class="est-editor-wrapper" id="est-wrapper">
            <canvas class="est-editor-canvas" id="est-canvas"></canvas>
            <canvas class="est-editor-layer-canvas" id="est-traco-canvas"></canvas>
            <div class="est-editor-layer" id="est-layer"></div>
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

    let visaoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) renderizarMiniatura(entry.target); });
    }, { rootMargin: '200px' });

    async function abrirArquivo(file) {
      fileOrig = file;
      telaInicial.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--texto-2);">Carregando PDF...</div>';
      try {
        await PDFTools.carregarLib('pdfjs');
        const buffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        numPages = pdfDocJs.numPages;

        tracos = {}; itensTexto = {};
        for (let i = 0; i < numPages; i++) { tracos[i] = []; itensTexto[i] = []; }
        historico = [JSON.stringify({ tracos, itensTexto })];

        telaInicial.style.display = 'none';
        telaTrabalho.style.display = 'block';
        renderizarGrade();
      } catch (err) {
        if (err.name === 'PasswordException') telaInicial.innerHTML = PDFTools.erro('pdf_protegido');
        else telaInicial.innerHTML = PDFTools.erro('pdf_corrompido', err.message);
      }
    }

    function renderizarGrade() {
      const grade = container.querySelector('#est-grade');
      grade.innerHTML = '';
      visaoObserver.disconnect();

      for (let i = 0; i < numPages; i++) {
        const el = document.createElement('div');
        el.className = 'est-pagina';
        el.dataset.index = i;
        el.innerHTML = `<div class="est-pagina-header">Página ${i + 1}</div><div class="est-thumb-container"></div><div class="est-badge">Editada</div>`;
        el.onclick = () => abrirEditor(i);
        grade.appendChild(el);
        visaoObserver.observe(el);
      }
      atualizarBadges();
    }

    function atualizarBadges() {
      for (let i = 0; i < numPages; i++) {
        const el = container.querySelector(`.est-pagina[data-index="${i}"]`);
        if (el) {
          const temConteudo = (tracos[i] && tracos[i].length > 0) || (itensTexto[i] && itensTexto[i].length > 0);
          el.querySelector('.est-badge').style.display = temConteudo ? 'block' : 'none';
        }
      }
    }

    async function renderizarMiniatura(el) {
      if (el.dataset.rendered) return;
      el.dataset.rendered = "true";
      const index = parseInt(el.dataset.index);
      try {
        const page = await pdfDocJs.getPage(index + 1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        el.querySelector('.est-thumb-container').appendChild(canvas);
      } catch (e) {}
    }

    // --- EDITOR DE PÁGINA ---
    const modalEditor = container.querySelector('#est-modal-editor');
    const wrapper = container.querySelector('#est-wrapper');
    const layer = container.querySelector('#est-layer');
    const cvsEditor = container.querySelector('#est-canvas');
    const tracoCanvas = container.querySelector('#est-traco-canvas');

    let modoAtual = 'mover'; // 'mover' | 'lapis' | 'texto'
    let idxEditando = null;
    let paginaPdfAtual = null;
    let escalaBase = 1;
    let visPageWidthPt = 1, visPageHeightPt = 1;

    // Lápis
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

    // Zoom do editor: `escalaBase` é o "ajustar à tela" calculado ao abrir cada página (ou ao
    // entrar/sair da tela cheia); o fator do controle de zoom multiplica em cima disso. Lupa/
    // botões no desktop, pinça de dois dedos no celular (ver criarControleZoom em ui.js).
    const modalBody = container.querySelector('#est-modal-body');
    const controleZoom = window.PDFTools.UI.criarControleZoom({
      superficieToque: modalBody,
      aoMudarZoom: (fator) => { if (paginaPdfAtual) renderizarPaginaNoCanvas(fator); }
    });
    container.querySelector('#est-zoom-slot').appendChild(controleZoom.elemento);

    function obterEscalaAtual() {
      return escalaBase * controleZoom.obterZoom();
    }

    // Usa o espaço realmente disponível dentro de #est-modal-body (já descontada a barra do topo,
    // que pode ocupar 1 ou 2 linhas dependendo da largura da tela) em vez de um chute em cima de
    // window.innerHeight — senão a página "ajustada à tela" fica mais alta do que cabe de verdade
    // e a parte de cima acaba renderizada atrás da barra do topo (inacessível a cliques/toque).
    function calcularEscalaAjuste(viewportRef, fatorMaximo) {
      const padding = 48; // 24px de padding de cada lado (ver .est-modal-body)
      const maxWidth = Math.max(100, modalBody.clientWidth - padding);
      const maxHeight = Math.max(100, modalBody.clientHeight - padding);
      return Math.min(maxWidth / viewportRef.width, maxHeight / viewportRef.height, fatorMaximo);
    }

    async function renderizarPaginaNoCanvas(fatorZoom) {
      const viewport = paginaPdfAtual.getViewport({ scale: escalaBase * fatorZoom });
      cvsEditor.width = viewport.width; cvsEditor.height = viewport.height;

      const ctx = cvsEditor.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cvsEditor.width, cvsEditor.height);
      await paginaPdfAtual.render({ canvasContext: ctx, viewport }).promise;

      redesenharTracos();
      renderizarItensEditor();
    }

    async function abrirEditor(index) {
      paginaAtualModal = index;
      idxEditando = null;
      container.querySelector('#est-modal-pagina').textContent = index + 1;
      modalEditor.style.display = 'flex';
      layer.innerHTML = '';

      const page = await pdfDocJs.getPage(index + 1);
      paginaPdfAtual = page;
      const viewportRef = page.getViewport({ scale: 1.0 });
      visPageWidthPt = viewportRef.width;
      visPageHeightPt = viewportRef.height;

      escalaBase = calcularEscalaAjuste(viewportRef, 1.5);

      definirModo('mover');
      controleZoom.definirZoom(1); // dispara renderizarPaginaNoCanvas(1) via aoMudarZoom
    }

    // --- MODO (Mover / Lápis / Texto) ---
    function definirModo(novoModo) {
      modoAtual = novoModo;
      container.querySelectorAll('.est-modo-btn').forEach(b => b.classList.toggle('ativo', b.dataset.modo === novoModo));
      container.querySelector('#est-painel-lapis').style.display = novoModo === 'lapis' ? 'block' : 'none';
      container.querySelector('#est-painel-texto').style.display = novoModo === 'texto' ? 'block' : 'none';
      tracoCanvas.style.pointerEvents = novoModo === 'lapis' ? 'auto' : 'none';
      wrapper.style.cursor = novoModo === 'lapis' ? 'crosshair' : (novoModo === 'texto' ? 'text' : 'default');
    }
    container.querySelectorAll('.est-modo-btn').forEach(btn => {
      btn.onclick = () => definirModo(btn.dataset.modo);
    });

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
      };
    });
    container.querySelector('#est-lapis-cor-custom').oninput = (e) => {
      lapisCor = e.target.value;
      container.querySelectorAll('#est-painel-lapis .est-cor-swatch').forEach(b => b.classList.remove('ativo'));
    };

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
        tracos[paginaAtualModal].push({ pontosNorm, corHex: tracoEmAndamento.corHex, larguraPt: tracoEmAndamento.larguraPt });
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
      const lista = tracos[paginaAtualModal] || [];
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
      for (const ch of texto) {
        if (ch === '\n') continue;
        try { font.widthOfTextAtSize(ch, 10); } catch (e) { return ch; }
      }
      return null;
    }

    async function recalcularCaixaTexto(item, usarLarguraPadrao) {
      const fontes = await obterFontesMetricas();
      const font = fontes[nomeFonteVariante(item.familia, item.negrito, item.italico)];

      // Nunca deixa a caixa passar da borda direita da página — senão o texto fica escondido
      // "fora" da página no PDF final (visualmente cortado, mesmo com o dado intacto no item).
      const espacoDisponivelPt = Math.max(visPageWidthPt - item.x * visPageWidthPt, item.tamanhoPt * 3);

      let larguraCaixaPt;
      if (usarLarguraPadrao) {
        const larguraTextoSemQuebra = font.widthOfTextAtSize((item.val || ' ').replace(/\n/g, ' ') || ' ', item.tamanhoPt);
        larguraCaixaPt = Math.min(larguraTextoSemQuebra + 10, visPageWidthPt * 0.6, espacoDisponivelPt);
        larguraCaixaPt = Math.max(larguraCaixaPt, item.tamanhoPt * 3);
      } else {
        larguraCaixaPt = Math.max(Math.min(item.w * visPageWidthPt, espacoDisponivelPt), item.tamanhoPt * 2);
      }

      const linhas = quebrarTextoEmLinhas(font, item.val, item.tamanhoPt, larguraCaixaPt);
      const alturaLinhaPt = item.tamanhoPt * 1.25;
      const alturaCaixaPt = Math.max(linhas.length, 1) * alturaLinhaPt + 6;

      item.w = larguraCaixaPt / visPageWidthPt;
      item.h = alturaCaixaPt / visPageHeightPt;
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
    }

    function aoMudarControleFonte() {
      if (idxEditando === null) return;
      const item = itensTexto[paginaAtualModal][idxEditando];
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
        aoMudarControleFonte();
      };
    });
    container.querySelector('#est-texto-cor-custom').oninput = (e) => {
      fonteCor = e.target.value;
      container.querySelectorAll('#est-painel-texto .est-cor-swatch').forEach(b => b.classList.remove('ativo'));
      aoMudarControleFonte();
    };

    // --- Clique na página (modo Texto) cria uma caixa nova e já abre pra digitar ---
    wrapper.addEventListener('click', (e) => {
      if (modoAtual !== 'texto') return;
      if (e.target.closest('.est-texto-editando-area')) return;
      const rect = cvsEditor.getBoundingClientRect();
      const xFrac = (e.clientX - rect.left) / rect.width;
      const yFrac = (e.clientY - rect.top) / rect.height;
      if (xFrac < 0 || xFrac > 1 || yFrac < 0 || yFrac > 1) return;
      criarNovoItemTexto(xFrac, yFrac);
    });

    function criarNovoItemTexto(xFrac, yFrac) {
      const linhaAlturaFrac = (fonteTamanhoPt * 1.25) / visPageHeightPt;
      const item = {
        tipo: 'texto', val: '', x: xFrac, y: yFrac, w: 0.3, h: linhaAlturaFrac,
        tamanhoPt: fonteTamanhoPt, corHex: fonteCor, familia: fonteFamilia,
        negrito: fonteNegrito, italico: fonteItalico
      };
      itensTexto[paginaAtualModal].push(item);
      const idx = itensTexto[paginaAtualModal].length - 1;
      renderizarItensEditor().then(() => abrirEdicaoTexto(idx));
    }

    async function abrirEdicaoTexto(idx) {
      idxEditando = idx;
      const item = itensTexto[paginaAtualModal][idx];
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
          itensTexto[paginaAtualModal].splice(idx, 1);
        } else {
          item.val = novoTexto;
          item.tamanhoPt = fonteTamanhoPt; item.corHex = fonteCor; item.familia = fonteFamilia;
          item.negrito = fonteNegrito; item.italico = fonteItalico;
          const larguraJaAjustada = item._larguraManual === true;
          await recalcularCaixaTexto(item, !larguraJaAjustada);
        }
        renderizarItensEditor();
      };

      // Não dá pra confiar só no "blur" da textarea: depois que o foco sai dela pela primeira vez
      // (ex: clicou no seletor de fonte), ele não volta sozinho — cliques seguintes em OUTROS
      // controles não disparam mais nenhum evento nela. Por isso ouvimos mousedown no document
      // inteiro (fase de captura, roda antes de qualquer outro clique): só NÃO commita se o clique
      // foi dentro da própria caixa de texto ou dentro do painel de fonte (ajustando as opções).
      function aoCliqueFora(e) {
        if (ta.contains(e.target)) return;
        if (e.target.closest && e.target.closest('#est-painel-texto')) return;
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
      const ts = tracos[paginaAtualModal] || [];
      const its = itensTexto[paginaAtualModal] || [];
      if (ts.length === 0 && its.length === 0) return alert('Inclua pelo menos um traço ou texto nesta página primeiro.');
      if (confirm('Replicar tudo desta página (traços e textos) para TODAS as páginas do documento? Isso sobrescreve a edição das outras.')) {
        salvarEstado();
        const cloneTs = JSON.parse(JSON.stringify(ts));
        const cloneIts = JSON.parse(JSON.stringify(its));
        for (let i = 0; i < numPages; i++) {
          tracos[i] = JSON.parse(JSON.stringify(cloneTs));
          itensTexto[i] = JSON.parse(JSON.stringify(cloneIts));
        }
        redesenharTracos();
        renderizarItensEditor();
        PDFTools.UI.mostrarToast('Aplicado a todas as páginas com sucesso.', 'sucesso');
      }
    };

    // --- Renderização dos itens de texto (arrastáveis) ---
    async function renderizarItensEditor() {
      layer.innerHTML = '';
      const lista = itensTexto[paginaAtualModal] || [];
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

        const txt = document.createElement('div');
        txt.className = 'txt';
        aplicarEstiloFonteNoElemento(txt, item, escala);
        const font = fontes[nomeFonteVariante(item.familia, item.negrito, item.italico)];
        const linhas = quebrarTextoEmLinhas(font, item.val, item.tamanhoPt, Math.max(item.w * visPageWidthPt, 1));
        txt.textContent = linhas.join('\n');
        el.appendChild(txt);

        const resizer = document.createElement('div'); resizer.className = 'est-resize-handle'; el.appendChild(resizer);
        const del = document.createElement('div'); del.className = 'est-delete-handle'; del.textContent = '✕'; el.appendChild(del);

        el.onmousedown = (e) => { if (modoAtual === 'mover') startDrag(e, idx, el); };
        el.ontouchstart = (e) => { if (modoAtual === 'mover') startDrag(e, idx, el); };
        el.ondblclick = (e) => { if (modoAtual === 'mover') { e.stopPropagation(); abrirEdicaoTexto(idx); } };
        resizer.onmousedown = (e) => { if (modoAtual === 'mover') startResize(e, idx, el); };
        resizer.ontouchstart = (e) => { if (modoAtual === 'mover') startResize(e, idx, el); };
        del.onclick = (e) => {
          if (modoAtual !== 'mover') return;
          e.stopPropagation(); salvarEstado();
          itensTexto[paginaAtualModal].splice(idx, 1);
          renderizarItensEditor();
        };

        layer.appendChild(el);
      });
    }

    // --- DRAG E RESIZE (itens de texto) ---
    let draggingInfo = null;

    function startDrag(e, idx, el) {
      if (e.target.classList.contains('est-resize-handle') || e.target.classList.contains('est-delete-handle') || e.target.classList.contains('est-texto-editando-area')) return;
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.est-item-arrastavel').forEach(el => el.classList.remove('ativo'));
      el.classList.add('ativo');
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      draggingInfo = { mode: 'drag', idx, startX: cx, startY: cy, initL: parseFloat(el.style.left), initT: parseFloat(el.style.top) };
    }

    function startResize(e, idx, el) {
      e.preventDefault(); e.stopPropagation();
      el.classList.add('ativo');
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      draggingInfo = { mode: 'resize', idx, startX: cx, startY: cy, initW: parseFloat(el.style.width), initH: parseFloat(el.style.height) };
    }

    function doMove(e) {
      if (!draggingInfo) return;
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - draggingInfo.startX;
      const dy = cy - draggingInfo.startY;
      const idx = draggingInfo.idx;
      const el = layer.children[idx];
      if (!el) return;

      if (draggingInfo.mode === 'drag') {
        el.style.left = (draggingInfo.initL + dx) + 'px';
        el.style.top = (draggingInfo.initT + dy) + 'px';
      } else {
        el.style.width = Math.max(20, draggingInfo.initW + dx) + 'px';
      }
    }

    function doEnd(e) {
      if (!draggingInfo) {
        if (e.target === layer) document.querySelectorAll('.est-item-arrastavel').forEach(el => el.classList.remove('ativo'));
        return;
      }
      const idx = draggingInfo.idx;
      const el = layer.children[idx];
      const modo = draggingInfo.mode;

      // Um clique simples (sem arrastar de fato) passa por aqui também — sem isso, o próprio ato
      // de clicar num item já dispararia um re-render assíncrono da camada inteira, o que atrapalha
      // o duplo clique (o 2º clique pode cair no instante em que a camada está sendo reconstruída).
      const semMovimento = modo === 'drag'
        ? (parseFloat(el.style.left) === draggingInfo.initL && parseFloat(el.style.top) === draggingInfo.initT)
        : (parseFloat(el.style.width) === draggingInfo.initW);
      draggingInfo = null;
      if (semMovimento) return;

      salvarEstado();
      const wCvs = cvsEditor.width, hCvs = cvsEditor.height;
      const item = itensTexto[paginaAtualModal][idx];
      item.x = parseFloat(el.style.left) / wCvs;
      item.y = parseFloat(el.style.top) / hCvs;
      item.w = parseFloat(el.style.width) / wCvs;

      if (modo === 'resize') {
        item._larguraManual = true;
        recalcularCaixaTexto(item, false).then(renderizarItensEditor);
      } else {
        renderizarItensEditor();
      }
    }

    layer.addEventListener('mousemove', doMove); layer.addEventListener('mouseup', doEnd); layer.addEventListener('mouseleave', doEnd);
    layer.addEventListener('touchmove', doMove, { passive: false }); layer.addEventListener('touchend', doEnd); layer.addEventListener('click', doEnd);

    // --- DESFAZER ---
    function salvarEstado() {
      historico.push(JSON.stringify({ tracos, itensTexto }));
      if (historico.length > 20) historico.shift();
    }

    container.querySelector('#btn-est-desfazer').onclick = () => {
      if (historico.length > 1) {
        historico.pop();
        const estado = JSON.parse(historico[historico.length - 1]);
        tracos = estado.tracos; itensTexto = estado.itensTexto;
        idxEditando = null;
        redesenharTracos();
        renderizarItensEditor();
      }
    };

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z' && modalEditor.style.display !== 'none') {
        container.querySelector('#btn-est-desfazer').click();
      }
    });

    container.querySelector('#btn-est-fechar').onclick = () => {
      if (document.fullscreenElement === modalEditor) document.exitFullscreen().catch(() => {});
      modalEditor.style.display = 'none';
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

    document.addEventListener('fullscreenchange', () => {
      const emTelaCheia = document.fullscreenElement === modalEditor;
      btnFullscreen.textContent = emTelaCheia ? '⤡ Sair da Tela Cheia' : '⛶ Tela Cheia';
      if (!paginaPdfAtual) return;
      const viewportRef = paginaPdfAtual.getViewport({ scale: 1.0 });
      escalaBase = calcularEscalaAjuste(viewportRef, emTelaCheia ? 3 : 1.5);
      renderizarPaginaNoCanvas(controleZoom.obterZoom());
    });

    // --- GERAR PDF ---
    container.querySelector('#btn-gerar').onclick = async () => {
      const totalTracos = Object.values(tracos).flat().length;
      const totalTextos = Object.values(itensTexto).flat().length;
      if (totalTracos + totalTextos === 0) {
        return alert('Você ainda não incluiu nada no documento.\n\nComo fazer:\n1. Clique em uma das páginas.\n2. No editor que abrir, escolha "✏️ Lápis" (desenhe direto na página) ou "📝 Texto" (clique onde quer escrever).\n3. Clique em "Concluir Página" e depois em "Gerar PDF Editado".');
      }

      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;
      try {
        await PDFTools.carregarLib('pdf-lib');

        const blob = await aplicarEdicoesEstudio(fileOrig, tracos, itensTexto, (pct, txt) => progresso.atualizar(pct, txt));
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
        console.error(err);
        PDFTools.UI.mostrarToast('Erro: ' + err.message, 'erro');
      } finally {
        progresso.esconder();
        btn.disabled = false;
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);
}

PDFTools.registrar({
  id: 'estudio_principal',
  nome: 'Pequenas Edições',
  descricao: 'Desenhe à mão livre ou inclua uma caixa de texto direto sobre a página — pequenas edições, sem precisar de outra ferramenta.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: (container, arquivoInicial) => montarEstudioUI(container, arquivoInicial)
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
  for (const ch of texto) {
    if (ch === '\n') continue;
    try { font.widthOfTextAtSize(ch, 10); } catch (e) { return ch; }
  }
  return null;
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

async function aplicarEdicoesEstudio(fileOrig, tracosMap, itensTextoMap, aoProgredir) {
  const buffer = await PDFTools.lerComoArrayBuffer(fileOrig);
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const novoDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const numPages = novoDoc.getPageCount();

  // Embute só as variantes de fonte realmente usadas no documento.
  const nomesUsados = new Set();
  Object.values(itensTextoMap).flat().forEach(it => nomesUsados.add(nomeFonteVarianteGlobal(it.familia, it.negrito, it.italico)));
  const fontesEmbutidas = {};
  for (const nome of nomesUsados) fontesEmbutidas[nome] = await novoDoc.embedFont(StandardFonts[nome]);

  for (let i = 0; i < numPages; i++) {
    aoProgredir((i / numPages) * 100, `Processando página ${i + 1} de ${numPages}...`);
    await new Promise(r => setTimeout(r, 0));

    const page = novoDoc.getPage(i);
    const rawSize = page.getSize();
    const anguloOriginal = page.getRotation().angle;

    const listaTracos = tracosMap[i] || [];
    listaTracos.forEach(tr => desenharTracoNoPdf(page, tr, rawSize.width, rawSize.height, anguloOriginal));

    const listaTextos = itensTextoMap[i] || [];
    for (const item of listaTextos) {
      if (!item.val) continue;
      const font = fontesEmbutidas[nomeFonteVarianteGlobal(item.familia, item.negrito, item.italico)];
      const charRuim = encontrarCaractereNaoSuportadoGlobal(font, item.val);
      if (charRuim) {
        throw new Error(`O texto da página ${i + 1} contém o caractere "${charRuim}", que não é suportado pela fonte escolhida. Remova esse caractere ou troque a fonte antes de gerar o PDF.`);
      }
      desenharTextoMultilinhaNoPdf(page, item, font, rawSize.width, rawSize.height, anguloOriginal);
    }
  }

  aoProgredir(99, 'Salvando...');
  await new Promise(r => setTimeout(r, 0));
  const outBytes = await novoDoc.save({ useObjectStreams: true });
  return new Blob([outBytes], { type: 'application/pdf' });
}
