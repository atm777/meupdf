// "Editar" — ferramenta de pequenas edições: a pessoa escolhe uma página e inclui um rabisco
// à mão livre (lápis, com tamanhos e cores) ou uma caixa de texto. Não é um editor completo —
// para girar/remover/reordenar páginas, tarjar, comprimir, dividir etc. há um botão específico
// para cada uma na barra de ferramentas do topo.
function montarEstudioUI(container, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let numPages = 0;

    // itens: { 0: [{tipo:'img'|'texto', val, x, y, w, h}], 1: [...], ... } — mesmo modelo de
    // item usado em Assinar (coordenadas fracionárias 0-1 relativas ao tamanho da página).
    let itens = {};
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

        /* Modal overlay (compartilhado pelos modais Lápis, Caixa de Texto e Editor de Página) */
        .est-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; flex-direction: column; }
        #est-modal-lapis, #est-modal-texto { z-index: 10000; }
        .est-modal-topbar { background: var(--cor-primaria); color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .est-modal-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; position: relative; }

        .est-editor-wrapper { position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: inline-block; background: var(--sup); }
        .est-editor-canvas { display: block; }
        .est-editor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

        .est-item-arrastavel { position: absolute; border: 1px dashed transparent; cursor: move; }
        .est-item-arrastavel:hover, .est-item-arrastavel.ativo { border-color: var(--cor-primaria); background: rgba(0, 123, 255, 0.05); }
        .est-item-arrastavel img { width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
        .est-item-arrastavel .txt { width: 100%; height: 100%; display:flex; align-items:center; font-family: sans-serif; font-size: 16px; color: #000; pointer-events: none; white-space: nowrap; }

        .est-resize-handle { position: absolute; bottom: -5px; right: -5px; width: 14px; height: 14px; background: var(--cor-primaria); border-radius: 50%; cursor: se-resize; display: none; }
        .est-item-arrastavel.ativo .est-resize-handle { display: block; }
        .est-delete-handle { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: var(--cor-erro); color: white; border-radius: 50%; text-align: center; line-height: 20px; font-size: 12px; font-weight: bold; cursor: pointer; display: none; }
        .est-item-arrastavel.ativo .est-delete-handle { display: block; }

        .est-ferramentas-flutuante { position: absolute; top: 80px; left: 24px; background: var(--sup); padding: 12px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 8px; z-index: 10; width: 200px; }

        /* Modal Lápis / Caixa de Texto (painel de criação, mesmo tamanho pros dois) */
        .est-cria-painel { background: var(--sup); border-radius: 8px; padding: 24px; width: 500px; max-width: 90%; margin: auto; }
        .est-desenho-canvas { border: 1px solid var(--borda); border-radius: 4px; width: 100%; height: 260px; touch-action: none; background: #fafafa; cursor: crosshair; }
        .est-desenho-barra { display: flex; align-items: center; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
        .est-desenho-grupo { display: flex; align-items: center; gap: 6px; }
        .est-desenho-grupo-label { font-size: 12px; font-weight: bold; color: var(--texto-2); margin-right: 2px; }
        .est-lapis-tamanho { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--borda); background: var(--sup); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
        .est-lapis-tamanho.ativo { border-color: var(--cor-primaria); }
        .est-lapis-tamanho span { border-radius: 50%; background: #000; display: block; }
        .est-cor-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; box-shadow: 0 0 0 1px var(--borda); }
        .est-cor-swatch.ativo { border-color: var(--cor-primaria); }
        .est-cor-custom { width: 26px; height: 26px; border-radius: 50%; border: none; padding: 0; cursor: pointer; background: none; }
        .est-texto-input { width: 100%; padding: 10px; border: 1px solid var(--borda); border-radius: 4px; font-size: 16px; box-sizing: border-box; min-height: 90px; resize: vertical; background: var(--sup); color: var(--texto); font-family: sans-serif; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="est-tela-inicial"></div>
      <div id="est-tela-trabalho" style="display:none;">
        <div class="est-aviso">
          <strong>O que dá pra fazer aqui:</strong> pequenas edições e inclusões numa página —
          escrever à mão livre com o lápis (tamanhos e cores) ou incluir uma caixa de texto. Depois
          de incluir, arraste e redimensione onde quiser antes de gerar o PDF. Para reorganizar,
          girar ou remover páginas, apagar informações sensíveis, comprimir ou outras alterações
          maiores, use a ferramenta específica na barra do topo.
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

      <!-- Modal Lápis (desenho livre à mão) -->
      <div id="est-modal-lapis" class="est-modal-overlay">
        <div class="est-modal-body">
          <div class="est-cria-painel">
            <h3 style="margin-top:0;">Desenho Livre</h3>
            <canvas id="est-draw-livre" class="est-desenho-canvas"></canvas>
            <div class="est-desenho-barra">
              <div class="est-desenho-grupo">
                <span class="est-desenho-grupo-label">Espessura:</span>
                <button type="button" class="est-lapis-tamanho" data-tamanho="2"><span style="width:4px; height:4px;"></span></button>
                <button type="button" class="est-lapis-tamanho ativo" data-tamanho="5"><span style="width:8px; height:8px;"></span></button>
                <button type="button" class="est-lapis-tamanho" data-tamanho="10"><span style="width:14px; height:14px;"></span></button>
              </div>
              <div class="est-desenho-grupo">
                <span class="est-desenho-grupo-label">Cor:</span>
                <button type="button" class="est-cor-swatch ativo" data-cor="#000000" style="background:#000000;"></button>
                <button type="button" class="est-cor-swatch" data-cor="#ef4444" style="background:#ef4444;"></button>
                <button type="button" class="est-cor-swatch" data-cor="#0a58ca" style="background:#0a58ca;"></button>
                <button type="button" class="est-cor-swatch" data-cor="#10b981" style="background:#10b981;"></button>
                <button type="button" class="est-cor-swatch" data-cor="#f59e0b" style="background:#f59e0b;"></button>
                <input type="color" id="est-cor-livre-custom" class="est-cor-custom" value="#000000" title="Outra cor">
              </div>
              <button class="est-btn" id="btn-limpar-desenho-livre" style="margin-left:auto;">Limpar</button>
            </div>
            <div style="font-size:12px; color: var(--texto-2); margin-top:8px;">Desenhe com o mouse ou o dedo. Dá para arrastar e redimensionar depois de incluir.</div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
              <button class="est-btn" id="btn-cancelar-lapis">Cancelar</button>
              <button class="est-btn-acao" id="btn-incluir-lapis" style="width:auto; padding:8px 16px;">Incluir</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Caixa de Texto -->
      <div id="est-modal-texto" class="est-modal-overlay">
        <div class="est-modal-body">
          <div class="est-cria-painel">
            <h3 style="margin-top:0;">Caixa de Texto</h3>
            <textarea id="est-texto-livre" class="est-texto-input" placeholder="Digite o texto..."></textarea>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
              <button class="est-btn" id="btn-cancelar-texto">Cancelar</button>
              <button class="est-btn-acao" id="btn-incluir-texto" style="width:auto; padding:8px 16px;">Incluir</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Editor de Página -->
      <div id="est-modal-editor" class="est-modal-overlay">
        <div class="est-modal-topbar">
          <div style="font-size:16px; font-weight:bold;">Editando Página <span id="est-modal-pagina"></span></div>
          <div id="est-zoom-slot"></div>
          <div style="display:flex; gap:8px;">
            <button class="est-btn" id="btn-est-desfazer">Desfazer (Ctrl+Z)</button>
            <button class="est-btn" style="background:var(--cor-primaria); color:white; border-color:var(--cor-primaria);" id="btn-est-fechar">Concluir Página</button>
          </div>
        </div>

        <div class="est-ferramentas-flutuante">
          <div style="font-size:13px; font-weight:bold; margin-bottom:8px;">Incluir na página:</div>
          <button class="est-btn" id="btn-add-lapis" style="text-align:left;">✏️ Lápis (mão livre)</button>
          <button class="est-btn" id="btn-add-texto" style="text-align:left;">📝 Caixa de Texto</button>

          <hr style="border:0; border-top: 1px solid var(--borda); margin:8px 0;">
          <button class="est-btn" id="btn-aplicar-todas" style="text-align:left; color:var(--cor-primaria);">✨ Aplicar a Todas</button>
        </div>

        <div class="est-modal-body" id="est-modal-body">
          <div class="est-editor-wrapper" id="est-wrapper">
            <canvas class="est-editor-canvas" id="est-canvas"></canvas>
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

        itens = {};
        for (let i = 0; i < numPages; i++) itens[i] = [];
        historico = [JSON.stringify(itens)];

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
        if (el) el.querySelector('.est-badge').style.display = (itens[i] && itens[i].length > 0) ? 'block' : 'none';
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
    const layer = container.querySelector('#est-layer');
    const cvsEditor = container.querySelector('#est-canvas');

    // Zoom do editor: `escalaBase` é o "ajustar à tela" calculado ao abrir cada página; o fator
    // do controle de zoom multiplica em cima disso. Lupa/botões no desktop, pinça de dois dedos
    // no celular (ver criarControleZoom em ui.js).
    let paginaPdfAtual = null;
    let escalaBase = 1;
    const controleZoom = window.PDFTools.UI.criarControleZoom({
      superficieToque: container.querySelector('#est-modal-body'),
      aoMudarZoom: (fator) => { if (paginaPdfAtual) renderizarPaginaNoCanvas(fator); }
    });
    container.querySelector('#est-zoom-slot').appendChild(controleZoom.elemento);

    async function renderizarPaginaNoCanvas(fatorZoom) {
      const viewport = paginaPdfAtual.getViewport({ scale: escalaBase * fatorZoom });
      cvsEditor.width = viewport.width; cvsEditor.height = viewport.height;

      const ctx = cvsEditor.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cvsEditor.width, cvsEditor.height);
      await paginaPdfAtual.render({ canvasContext: ctx, viewport }).promise;

      renderizarItensEditor();
    }

    async function abrirEditor(index) {
      paginaAtualModal = index;
      container.querySelector('#est-modal-pagina').textContent = index + 1;
      modalEditor.style.display = 'flex';
      layer.innerHTML = '';

      const page = await pdfDocJs.getPage(index + 1);
      paginaPdfAtual = page;
      const viewportRef = page.getViewport({ scale: 1.0 });
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.75;
      escalaBase = Math.min(maxWidth / viewportRef.width, maxHeight / viewportRef.height, 1.5);

      controleZoom.definirZoom(1); // dispara renderizarPaginaNoCanvas(1) via aoMudarZoom
    }

    function renderizarItensEditor() {
      layer.innerHTML = '';
      const lista = itens[paginaAtualModal] || [];
      const w = cvsEditor.width, h = cvsEditor.height;

      lista.forEach((item, idx) => {
        const el = document.createElement('div');
        el.className = 'est-item-arrastavel';
        el.style.left = (item.x * w) + 'px';
        el.style.top = (item.y * h) + 'px';
        el.style.width = (item.w * w) + 'px';
        el.style.height = (item.h * h) + 'px';

        if (item.tipo === 'img') {
          const img = document.createElement('img');
          img.src = item.val;
          el.appendChild(img);
        } else {
          const txt = document.createElement('div');
          txt.className = 'txt';
          txt.textContent = item.val;
          el.appendChild(txt);
        }

        const resizer = document.createElement('div'); resizer.className = 'est-resize-handle'; el.appendChild(resizer);
        const del = document.createElement('div'); del.className = 'est-delete-handle'; del.textContent = '✕'; el.appendChild(del);

        el.onmousedown = (e) => startDrag(e, idx, el);
        el.ontouchstart = (e) => startDrag(e, idx, el);
        resizer.onmousedown = (e) => startResize(e, idx, el);
        resizer.ontouchstart = (e) => startResize(e, idx, el);
        del.onclick = (e) => { e.stopPropagation(); salvarEstado(); itens[paginaAtualModal].splice(idx, 1); renderizarItensEditor(); };

        layer.appendChild(el);
      });
    }

    // --- LÁPIS (desenho livre à mão) ---
    const modalLapis = container.querySelector('#est-modal-lapis');
    const drawLivreCanvas = container.querySelector('#est-draw-livre');
    const ctxDrawLivre = drawLivreCanvas.getContext('2d', { willReadFrequently: true });
    let lapisTamanho = 5;
    let lapisCor = '#000000';

    function resizeDrawLivreCanvas() {
      const rect = drawLivreCanvas.getBoundingClientRect();
      drawLivreCanvas.width = rect.width * 2;
      drawLivreCanvas.height = rect.height * 2;
      ctxDrawLivre.scale(2, 2);
      ctxDrawLivre.lineCap = 'round';
      ctxDrawLivre.lineJoin = 'round';
      ctxDrawLivre.lineWidth = lapisTamanho;
      ctxDrawLivre.strokeStyle = lapisCor;
    }

    container.querySelector('#btn-add-lapis').onclick = () => {
      modalLapis.style.display = 'flex';
      setTimeout(resizeDrawLivreCanvas, 50);
    };
    container.querySelector('#btn-cancelar-lapis').onclick = () => { modalLapis.style.display = 'none'; };

    container.querySelectorAll('.est-lapis-tamanho').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('.est-lapis-tamanho').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        lapisTamanho = parseInt(btn.dataset.tamanho);
        ctxDrawLivre.lineWidth = lapisTamanho;
      };
    });

    function selecionarCorLivre(cor) {
      lapisCor = cor;
      ctxDrawLivre.strokeStyle = lapisCor;
      container.querySelectorAll('.est-cor-swatch').forEach(b => b.classList.toggle('ativo', b.dataset.cor === cor));
    }
    container.querySelectorAll('.est-cor-swatch').forEach(btn => {
      btn.onclick = () => selecionarCorLivre(btn.dataset.cor);
    });
    container.querySelector('#est-cor-livre-custom').oninput = (e) => {
      container.querySelectorAll('.est-cor-swatch').forEach(b => b.classList.remove('ativo'));
      lapisCor = e.target.value;
      ctxDrawLivre.strokeStyle = lapisCor;
    };

    let isDrawingLivre = false, lastLX = 0, lastLY = 0;
    function getDrawLivrePos(e) {
      const rect = drawLivreCanvas.getBoundingClientRect();
      let cx = e.clientX, cy = e.clientY;
      if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      return { x: cx - rect.left, y: cy - rect.top };
    }
    function startDrawLivre(e) {
      e.preventDefault(); isDrawingLivre = true;
      const p = getDrawLivrePos(e); lastLX = p.x; lastLY = p.y;
      ctxDrawLivre.beginPath(); ctxDrawLivre.moveTo(lastLX, lastLY);
    }
    function moveDrawLivre(e) {
      if (!isDrawingLivre) return;
      e.preventDefault(); const p = getDrawLivrePos(e);
      const xc = (lastLX + p.x) / 2; const yc = (lastLY + p.y) / 2;
      ctxDrawLivre.quadraticCurveTo(lastLX, lastLY, xc, yc); ctxDrawLivre.stroke();
      lastLX = p.x; lastLY = p.y;
    }
    function stopDrawLivre() { isDrawingLivre = false; }

    drawLivreCanvas.addEventListener('mousedown', startDrawLivre);
    drawLivreCanvas.addEventListener('mousemove', moveDrawLivre);
    drawLivreCanvas.addEventListener('mouseup', stopDrawLivre);
    drawLivreCanvas.addEventListener('mouseleave', stopDrawLivre);
    drawLivreCanvas.addEventListener('touchstart', startDrawLivre, {passive:false});
    drawLivreCanvas.addEventListener('touchmove', moveDrawLivre, {passive:false});
    drawLivreCanvas.addEventListener('touchend', stopDrawLivre);

    container.querySelector('#btn-limpar-desenho-livre').onclick = () => {
      ctxDrawLivre.clearRect(0, 0, drawLivreCanvas.width, drawLivreCanvas.height);
    };

    container.querySelector('#btn-incluir-lapis').onclick = () => {
      const w = drawLivreCanvas.width, h = drawLivreCanvas.height;
      if (w === 0) return;
      const d = ctxDrawLivre.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      let hasPixels = false;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            hasPixels = true;
          }
        }
      }

      if (!hasPixels) return alert('Desenhe algo antes de incluir.');

      const pad = 10;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(w, maxX + pad); maxY = Math.min(h, maxY + pad);

      const cropCvs = document.createElement('canvas');
      cropCvs.width = maxX - minX; cropCvs.height = maxY - minY;
      cropCvs.getContext('2d').putImageData(ctxDrawLivre.getImageData(minX, minY, cropCvs.width, cropCvs.height), 0, 0);

      const dataUrl = cropCvs.toDataURL('image/png');
      const ratio = cropCvs.height / cropCvs.width;
      const wFrac = 0.3;

      salvarEstado();
      itens[paginaAtualModal].push({ tipo: 'img', val: dataUrl, x: 0.35, y: 0.4, w: wFrac, h: wFrac * ratio });
      renderizarItensEditor();

      modalLapis.style.display = 'none';
      ctxDrawLivre.clearRect(0, 0, drawLivreCanvas.width, drawLivreCanvas.height);
    };

    // --- CAIXA DE TEXTO ---
    const modalTexto = container.querySelector('#est-modal-texto');
    const inputTextoLivre = container.querySelector('#est-texto-livre');

    container.querySelector('#btn-add-texto').onclick = () => {
      inputTextoLivre.value = '';
      modalTexto.style.display = 'flex';
      setTimeout(() => inputTextoLivre.focus(), 50);
    };
    container.querySelector('#btn-cancelar-texto').onclick = () => { modalTexto.style.display = 'none'; };

    container.querySelector('#btn-incluir-texto').onclick = () => {
      const txt = inputTextoLivre.value.trim();
      if (!txt) return alert('Digite um texto antes de incluir.');

      salvarEstado();
      const largura = Math.min(0.6, 0.08 + txt.length * 0.012);
      itens[paginaAtualModal].push({ tipo: 'texto', val: txt, x: 0.35, y: 0.45, w: largura, h: 0.05 });
      renderizarItensEditor();

      modalTexto.style.display = 'none';
    };

    // --- APLICAR A TODAS ---
    container.querySelector('#btn-aplicar-todas').onclick = () => {
      const ts = itens[paginaAtualModal];
      if (!ts || ts.length === 0) return alert('Inclua pelo menos um item nesta página primeiro.');
      if (confirm('Replicar todos os itens e posições atuais para TODAS as páginas do documento? Isso sobrescreve a edição das outras.')) {
        salvarEstado();
        const clone = JSON.parse(JSON.stringify(ts));
        for (let i = 0; i < numPages; i++) itens[i] = JSON.parse(JSON.stringify(clone));
        PDFTools.UI.mostrarToast('Aplicado a todas as páginas com sucesso.', 'sucesso');
      }
    };

    // --- DRAG E RESIZE ---
    let draggingInfo = null;

    function startDrag(e, idx, el) {
      if (e.target.classList.contains('est-resize-handle') || e.target.classList.contains('est-delete-handle')) return;
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
        const maxD = Math.max(dx, dy);
        el.style.width = Math.max(20, draggingInfo.initW + maxD) + 'px';
        el.style.height = Math.max(10, draggingInfo.initH + (maxD * (draggingInfo.initH / draggingInfo.initW))) + 'px';
      }
    }

    function doEnd(e) {
      if (!draggingInfo) {
        if (e.target === layer) document.querySelectorAll('.est-item-arrastavel').forEach(el => el.classList.remove('ativo'));
        return;
      }
      const idx = draggingInfo.idx;
      const el = layer.children[idx];
      salvarEstado();
      const wCvs = cvsEditor.width, hCvs = cvsEditor.height;
      itens[paginaAtualModal][idx].x = parseFloat(el.style.left) / wCvs;
      itens[paginaAtualModal][idx].y = parseFloat(el.style.top) / hCvs;
      itens[paginaAtualModal][idx].w = parseFloat(el.style.width) / wCvs;
      itens[paginaAtualModal][idx].h = parseFloat(el.style.height) / hCvs;
      draggingInfo = null;
    }

    layer.addEventListener('mousemove', doMove); layer.addEventListener('mouseup', doEnd); layer.addEventListener('mouseleave', doEnd);
    layer.addEventListener('touchmove', doMove, {passive:false}); layer.addEventListener('touchend', doEnd); layer.addEventListener('click', doEnd);

    function salvarEstado() {
      historico.push(JSON.stringify(itens));
      if (historico.length > 20) historico.shift();
    }

    container.querySelector('#btn-est-desfazer').onclick = () => {
      if (historico.length > 1) {
        historico.pop();
        itens = JSON.parse(historico[historico.length - 1]);
        renderizarItensEditor();
      }
    };

    container.querySelector('#btn-est-fechar').onclick = () => {
      modalEditor.style.display = 'none';
      atualizarBadges();
    };

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z' && modalEditor.style.display !== 'none') {
        container.querySelector('#btn-est-desfazer').click();
      }
    });

    // --- GERAR PDF ---
    container.querySelector('#btn-gerar').onclick = async () => {
      const total = Object.values(itens).flat().length;
      if (total === 0) {
        return alert('Você ainda não incluiu nada no documento.\n\nComo fazer:\n1. Clique em uma das páginas.\n2. No editor que abrir, clique em "✏️ Lápis" ou "📝 Caixa de Texto" e posicione onde desejar.\n3. Clique em "Concluir Página" e depois em "Gerar PDF Editado".');
      }

      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;
      try {
        await PDFTools.carregarLib('pdf-lib');

        const blob = await aplicarItensNoPdf(fileOrig, itens, (pct, txt) => progresso.atualizar(pct, txt));
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
  descricao: 'Escreva à mão livre ou inclua uma caixa de texto em qualquer página — pequenas edições e inclusões, sem precisar de outra ferramenta.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: (container, arquivoInicial) => montarEstudioUI(container, arquivoInicial)
});

// --- LÓGICA PURA ---

async function aplicarItensNoPdf(fileOrig, itensMap, aoProgredir) {
  const buffer = await PDFTools.lerComoArrayBuffer(fileOrig);
  const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;

  const novoDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const numPages = novoDoc.getPageCount();
  const font = await novoDoc.embedFont(StandardFonts.Helvetica);

  // Cache de imagens embutidas para não embutir o mesmo PNG várias vezes e inchar o PDF
  const imgCache = {};

  for (let i = 0; i < numPages; i++) {
    aoProgredir((i / numPages) * 100, `Processando página ${i + 1} de ${numPages}...`);
    await new Promise(r => setTimeout(r, 0));

    const lista = itensMap[i];
    const page = novoDoc.getPage(i);

    if (lista && lista.length > 0) {
      // page.getSize() retorna sempre as dimensões BRUTAS do MediaBox (não muda com /Rotate).
      const rawSize = page.getSize();
      const anguloOriginal = page.getRotation().angle;

      for (const item of lista) {
        if (item.tipo === 'img') {
          if (!imgCache[item.val]) imgCache[item.val] = await novoDoc.embedPng(item.val);
          const pdfImg = imgCache[item.val];
          desenharRotacionado(page, pdfImg, null, item.x, item.y, item.w, item.h, rawSize.width, rawSize.height, anguloOriginal);
        } else {
          desenharRotacionado(page, null, { txt: item.val, font, color: rgb(0,0,0) }, item.x, item.y, item.w, item.h, rawSize.width, rawSize.height, anguloOriginal);
        }
      }
    }
  }

  aoProgredir(99, 'Salvando...');
  await new Promise(r => setTimeout(r, 0));

  const outBytes = await novoDoc.save({ useObjectStreams: true });
  return new Blob([outBytes], { type: 'application/pdf' });
}

// Contra-rotação para PDFLib. A tela visualiza a página já rotacionada (o canvas do editor vem
// do pdf.js, que já leva /Rotate em conta). As caixas são percentuais relativas a essa visão
// visual — aqui convertemos para a coordenada bruta (não rotacionada) do PDF.
function desenharRotacionado(page, imgObj, txtObj, pctX, pctY, pctW, pctH, rawW, rawH, angulo) {
  const R = (angulo % 360 + 360) % 360;
  const { degrees } = window.PDFLib;
  const { width: visW, height: visH } = PDFTools.dimensoesVisuais(rawW, rawH, R);

  const visX = pctX * visW;
  const visYTopo = pctY * visH;
  const boxW = pctW * visW;
  const boxH = pctH * visH;

  const t = PDFTools.posicaoRotacionada(visX, visYTopo, boxW, boxH, rawW, rawH, R);

  if (imgObj) {
    page.drawImage(imgObj, { x: t.x, y: t.y, width: t.width, height: t.height, rotate: degrees(t.rotate) });
  } else if (txtObj) {
    const fontSize = boxH * 0.8;
    page.drawText(txtObj.txt, {
      x: t.x, y: t.y + (fontSize * 0.2),
      size: fontSize,
      font: txtObj.font,
      color: txtObj.color,
      rotate: degrees(t.rotate)
    });
  }
}
