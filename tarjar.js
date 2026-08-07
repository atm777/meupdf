PDFTools.registrar({
  id: 'tarjar_pdf',
  nome: 'Tarjar Documento',
  descricao: 'Censure dados sensíveis com segurança absoluta. O texto é destruído e substituído por pixels irreversíveis.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: function(container, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let numPages = 0;
    
    // Estado principal
    // tarjas: { 0: [{x,y,w,h}], 1: [...] } - em percentual 0 a 1
    let tarjas = {};
    let historico = [];
    
    let paginaAtualModal = 0;

    if (!document.getElementById('css-tarjar')) {
      const style = document.createElement('style');
      style.id = 'css-tarjar';
      style.textContent = `
        .tj-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .tj-main { flex: 1; min-width: 300px; display: flex; flex-direction: column; }
        .tj-sidebar { width: 300px; flex-shrink: 0; }
        .tj-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px; margin-bottom:16px; }
        .tj-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; overflow-y: auto; max-height: 500px; padding: 8px; background: var(--sup-2); border-radius: 8px; }
        .tj-pagina { background: var(--sup); box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; position: relative; cursor: pointer; transition: transform 0.2s; }
        .tj-pagina:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .tj-pagina-header { font-size: 12px; padding: 4px; text-align: center; font-weight: bold; background: var(--sup-2); border-bottom: 1px solid var(--borda); color: var(--texto-2); }
        .tj-thumb-container { width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--sup); position: relative; }
        .tj-thumb-container canvas { max-width: 100%; max-height: 100%; object-fit: contain; }
        .tj-badge-tarja { position: absolute; bottom: 4px; right: 4px; background: var(--cor-primaria); color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; display: none; }
        .tj-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; }
        .tj-btn-acao:hover { background: #000; }
        .tj-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .tj-btn { padding: 6px 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 13px; }
        .tj-btn:hover { background: var(--sup-2); }
        
        /* Modal Editor */
        .tj-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; flex-direction: column; }
        .tj-modal-topbar { background: var(--cor-primaria); color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
        .tj-modal-body { flex: 1; display: flex; align-items: center; justify-content: center; gap: 16px; padding: 24px; overflow: auto; position: relative; }
        @media (max-height: 720px), (max-width: 500px) {
          .tj-modal-body { padding: 8px; gap: 8px; }
          .tj-modal-topbar { padding: 6px 12px; }
        }
        
        .tj-editor-wrapper { position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: inline-block; }
        .tj-editor-canvas { display: block; }
        .tj-editor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
        
        .tarja-block { position: absolute; background: rgba(0,0,0,0.9); border: 1px solid #fff; }
        .tarja-temp { position: absolute; background: rgba(0,0,0,0.5); border: 1px dashed #fff; pointer-events: none; }
        .tarja-delete { position: absolute; top: -10px; right: -10px; background: var(--cor-erro); color: white; border-radius: 50%; width: 20px; height: 20px; text-align: center; line-height: 20px; font-size: 12px; cursor: pointer; z-index: 10; font-weight:bold; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="tj-tela-inicial"></div>
      <div id="tj-tela-trabalho" style="display:none;" class="tj-layout">
        <div class="tj-main">
          <div class="tj-painel" style="background:rgba(255, 193, 7, 0.2); color:#ffc107; border-color:rgba(255, 193, 7, 0.4);">
            <strong style="font-size:15px;">⚠️ Como a tarja segura funciona:</strong><br>
            <span style="font-size:14px;">As páginas com tarja são convertidas inteiramente em imagens. <strong>O texto por baixo é destruído de verdade</strong> — é isso que torna a tarja impossível de ser revertida por invasores. As páginas não tarjadas continuarão com o texto original selecionável.</span>
          </div>
          <div class="tj-grade" id="tj-grade"></div>
        </div>
        <div class="tj-sidebar">
          <div class="tj-painel">
            <h3 style="margin-top:0; border-bottom: 1px solid var(--borda); padding-bottom:8px;">Exportar</h3>
            <label style="display:block; font-size:13px; font-weight:bold; margin-bottom:8px;">Resolução de Rasterização (Páginas Tarjadas)</label>
            <select id="tj-dpi" class="org-input" style="width:100%; margin-bottom:16px;">
              <option value="150" selected>150 DPI (Padrão, mais leve)</option>
              <option value="300">300 DPI (Alta qualidade, gera arquivo mais pesado)</option>
            </select>
            <label style="display:block; font-size:12px; color: var(--texto-2); margin-bottom:16px;">
              Metadados do PDF (como autor e título) serão apagados automaticamente por segurança.
            </label>
            <button class="tj-btn-acao" id="btn-gerar">Gerar PDF Protegido</button>
            <div id="tj-progresso-container" style="margin-top:16px;"></div>
            <div id="tj-resultado" style="display:none; margin-top:16px;">
              <div style="font-size:13px; color:var(--cor-sucesso); font-weight:bold; margin-bottom:8px;">✅ Concluído! Baixado automaticamente.</div>
              <button id="btn-tj-baixar-novamente" class="pdf-btn-principal" style="margin-top:0;">Baixar Novamente</button>
              <div id="tj-proximos-passos" style="margin-top:16px;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal do Editor -->
      <div id="tj-modal" class="tj-modal-overlay">
        <div class="tj-modal-topbar">
          <div style="font-size:16px; font-weight:bold;">Editor de Tarjas - Página <span id="tj-modal-pagina"></span></div>
          <div id="tj-zoom-slot"></div>
          <div style="display:flex; gap:8px;">
            <button class="tj-btn" id="btn-tj-todas" title="Aplica as tarjas desta página a todas as páginas do documento">Aplicar a Todas as Páginas</button>
            <button class="tj-btn" id="btn-tj-desfazer">Desfazer (Ctrl+Z)</button>
            <button class="tj-btn" style="background:var(--cor-primaria); color:white; border-color:var(--cor-primaria);" id="btn-tj-fechar">Concluir</button>
          </div>
        </div>
        <div class="tj-modal-body" id="tj-modal-body">
          <div id="tj-nav-paginas-slot"></div>
          <div class="tj-editor-wrapper" id="tj-wrapper">
            <canvas class="tj-editor-canvas" id="tj-canvas"></canvas>
            <div class="tj-editor-layer" id="tj-layer"></div>
          </div>
        </div>
      </div>
    `;

    const dropzone = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf, application/pdf', onArquivos: (a) => abrirArquivo(a[0]) });
    container.querySelector('#tj-tela-inicial').appendChild(dropzone);
    
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#tj-progresso-container').appendChild(progresso.elemento);

    let visaoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) renderizarMiniatura(entry.target);
      });
    }, { rootMargin: '200px' });

    async function abrirArquivo(file) {
      // Valida pelo header %PDF (ehPDF), não pelo file.type — um .pdf pode chegar com MIME vazio
      // ou não-padrão (compartilhar/arrastar), e antes isso era ignorado em silêncio.
      if (!(await PDFTools.ehPDF(file))) {
        container.querySelector('#tj-tela-inicial').innerHTML = PDFTools.erro('nao_e_pdf');
        return;
      }
      fileOrig = file;
      container.querySelector('#tj-tela-inicial').innerHTML = '<div style="text-align:center; padding: 40px; color: var(--texto-2);">Preparando documento...</div>';
      
      try {
        await PDFTools.carregarLib('pdfjs');
        const buffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        numPages = pdfDocJs.numPages;
        
        tarjas = {};
        for(let i=0; i<numPages; i++) tarjas[i] = [];
        historico = [JSON.stringify(tarjas)];

        container.querySelector('#tj-tela-inicial').style.display = 'none';
        container.querySelector('#tj-tela-trabalho').style.display = 'flex';
        
        renderizarGrade();
      } catch (err) {
        if (err.name === 'PasswordException') container.querySelector('#tj-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        else container.querySelector('#tj-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido', err.message);
      }
    }

    function renderizarGrade() {
      const grade = container.querySelector('#tj-grade');
      grade.innerHTML = '';
      visaoObserver.disconnect();
      
      for(let i=0; i<numPages; i++) {
        const el = document.createElement('div');
        el.className = 'tj-pagina';
        el.dataset.index = i;
        el.innerHTML = `
          <div class="tj-pagina-header">Página ${i + 1}</div>
          <div class="tj-thumb-container"></div>
          <div class="tj-badge-tarja">Tarjado</div>
        `;
        el.onclick = () => abrirEditor(i);
        grade.appendChild(el);
        visaoObserver.observe(el);
      }
      atualizarBadgesNaGrade();
    }

    function atualizarBadgesNaGrade() {
      const grade = container.querySelector('#tj-grade');
      for(let i=0; i<numPages; i++) {
        const el = grade.querySelector(`[data-index="${i}"]`);
        if(el) {
          const badge = el.querySelector('.tj-badge-tarja');
          badge.style.display = (tarjas[i] && tarjas[i].length > 0) ? 'block' : 'none';
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
        const container = el.querySelector('.tj-thumb-container');
        container.appendChild(canvas);
      } catch(e) {}
    }

    // --- EDITOR ---
    const modal = container.querySelector('#tj-modal');
    const layer = container.querySelector('#tj-layer');
    const cvsEditor = container.querySelector('#tj-canvas');
    let isDrawing = false;
    let startX=0, startY=0, currentRectTemp=null;

    // Zoom do editor: `escalaBase` é o "ajustar à tela" calculado ao abrir cada página;
    // o fator do controle de zoom multiplica em cima disso. Lupa/botões no desktop, pinça de
    // dois dedos no celular (ver criarControleZoom em ui.js).
    let paginaPdfAtual = null;
    let escalaBase = 1;
    const modalBody = container.querySelector('#tj-modal-body');
    const controleZoom = window.PDFTools.UI.criarControleZoom({
      superficieToque: modalBody,
      aoMudarZoom: (fator) => { if (paginaPdfAtual) renderizarPaginaNoCanvas(fator); }
    });
    container.querySelector('#tj-zoom-slot').appendChild(controleZoom.elemento);

    // Setas ▲/▼ do lado da página pra trocar de página sem sair do editor.
    const navegadorPaginas = window.PDFTools.UI.criarNavegadorPaginas({
      aoNavegar: (novoIndice) => abrirEditor(novoIndice)
    });
    container.querySelector('#tj-nav-paginas-slot').appendChild(navegadorPaginas.elemento);

    // Usa o espaço realmente disponível dentro de #tj-modal-body (já descontada a barra do topo
    // e a faixa do navegador de páginas) em vez de um chute em cima de window.innerHeight —
    // senão a página "ajustada à tela" fica maior do que cabe de verdade.
    function calcularEscalaAjuste(viewportRef, fatorMaximo) {
      // Padding real do .tj-modal-body (muda por media query em telas baixas) em vez de fixo.
      const cs = getComputedStyle(modalBody);
      const padH = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const larguraNav = navegadorPaginas.elemento.offsetWidth ? navegadorPaginas.elemento.offsetWidth + 16 : 0;
      const maxWidth = Math.max(100, modalBody.clientWidth - padH - larguraNav);
      const maxHeight = Math.max(100, modalBody.clientHeight - padV);
      return Math.min(maxWidth / viewportRef.width, maxHeight / viewportRef.height, fatorMaximo);
    }

    async function renderizarPaginaNoCanvas(fatorZoom) {
      const viewport = paginaPdfAtual.getViewport({ scale: escalaBase * fatorZoom });
      cvsEditor.width = viewport.width;
      cvsEditor.height = viewport.height;

      const ctx = cvsEditor.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,cvsEditor.width, cvsEditor.height);
      await paginaPdfAtual.render({ canvasContext: ctx, viewport }).promise;

      renderizarTarjasEditor();
    }

    async function abrirEditor(index) {
      paginaAtualModal = index;
      container.querySelector('#tj-modal-pagina').textContent = index + 1;
      modal.style.display = 'flex';
      // Neutraliza o backdrop-filter do #workspace enquanto o modal está aberto (ver regra CSS
      // body.pdf-editor-modal-aberto #workspace): sem isso o filtro prende o position:fixed do
      // modal dentro do workspace em vez da viewport, e a página fica menor do que caberia.
      document.body.classList.add('pdf-editor-modal-aberto');
      layer.innerHTML = '';
      navegadorPaginas.atualizar(index, numPages);

      const page = await pdfDocJs.getPage(index + 1);
      paginaPdfAtual = page;

      const viewportRef = page.getViewport({ scale: 1.0 });
      escalaBase = calcularEscalaAjuste(viewportRef, 1.5);

      controleZoom.definirZoom(1); // dispara renderizarPaginaNoCanvas(1) via aoMudarZoom
    }

    // Recalcula o "ajustar à tela" ao mudar o tamanho da janela / girar o celular.
    let _resizeRafTj = null;
    function aoRedimensionarTarjar() {
      if (modal.style.display === 'none' || !paginaPdfAtual) return;
      if (_resizeRafTj) cancelAnimationFrame(_resizeRafTj);
      _resizeRafTj = requestAnimationFrame(() => {
        const viewportRef = paginaPdfAtual.getViewport({ scale: 1.0 });
        escalaBase = calcularEscalaAjuste(viewportRef, 1.5);
        renderizarPaginaNoCanvas(controleZoom.obterZoom());
      });
    }
    window.addEventListener('resize', aoRedimensionarTarjar);
    window.addEventListener('orientationchange', aoRedimensionarTarjar);

    function renderizarTarjasEditor() {
      layer.innerHTML = '';
      const lista = tarjas[paginaAtualModal] || [];
      const w = cvsEditor.width;
      const h = cvsEditor.height;
      
      lista.forEach((t, idx) => {
        const el = document.createElement('div');
        el.className = 'tarja-block';
        el.style.left = (t.x * w) + 'px';
        el.style.top = (t.y * h) + 'px';
        el.style.width = (t.w * w) + 'px';
        el.style.height = (t.h * h) + 'px';
        
        const btnDel = document.createElement('div');
        btnDel.className = 'tarja-delete';
        btnDel.textContent = '✕';
        btnDel.onclick = (e) => {
          e.stopPropagation();
          salvarHistorico();
          tarjas[paginaAtualModal].splice(idx, 1);
          renderizarTarjasEditor();
        };
        el.appendChild(btnDel);
        layer.appendChild(el);
      });
    }

    // Handlers Desenho
    function getEventPos(e) {
      const rect = layer.getBoundingClientRect();
      let cx, cy;
      if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      else if (e.changedTouches && e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; }
      else { cx = e.clientX; cy = e.clientY; }
      return { x: cx - rect.left, y: cy - rect.top, wBox: rect.width, hBox: rect.height };
    }

    function onStart(e) {
      if (e.target.classList.contains('tarja-delete')) return;
      // Previne comportamento padrão de touch (scroll/zoom) enquanto desenha
      if (e.cancelable) e.preventDefault(); 
      isDrawing = true;
      const pos = getEventPos(e);
      startX = pos.x; startY = pos.y;
      currentRectTemp = document.createElement('div');
      currentRectTemp.className = 'tarja-temp';
      currentRectTemp.style.left = startX + 'px';
      currentRectTemp.style.top = startY + 'px';
      layer.appendChild(currentRectTemp);
    }
    
    function onMove(e) {
      if (!isDrawing) return;
      if (e.cancelable) e.preventDefault();
      const pos = getEventPos(e);
      const curX = Math.min(Math.max(pos.x, 0), pos.wBox);
      const curY = Math.min(Math.max(pos.y, 0), pos.hBox);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);
      currentRectTemp.style.left = Math.min(curX, startX) + 'px';
      currentRectTemp.style.top = Math.min(curY, startY) + 'px';
      currentRectTemp.style.width = w + 'px';
      currentRectTemp.style.height = h + 'px';
    }

    function onEnd(e) {
      if (!isDrawing) return;
      isDrawing = false;
      const pos = getEventPos(e);
      const l = parseFloat(currentRectTemp.style.left) / pos.wBox;
      const t = parseFloat(currentRectTemp.style.top) / pos.hBox;
      const w = parseFloat(currentRectTemp.style.width) / pos.wBox;
      const h = parseFloat(currentRectTemp.style.height) / pos.hBox;
      
      currentRectTemp.remove();
      
      if (w > 0.01 && h > 0.01) {
        salvarHistorico();
        tarjas[paginaAtualModal].push({x:l, y:t, w, h});
        renderizarTarjasEditor();
      }
    }

    layer.addEventListener('mousedown', onStart);
    layer.addEventListener('mousemove', onMove);
    layer.addEventListener('mouseup', onEnd);
    layer.addEventListener('mouseleave', (e) => { if (isDrawing) onEnd(e); });
    
    layer.addEventListener('touchstart', onStart, {passive:false});
    layer.addEventListener('touchmove', onMove, {passive:false});
    layer.addEventListener('touchend', onEnd);

    function salvarHistorico() {
      historico.push(JSON.stringify(tarjas));
      if(historico.length > 30) historico.shift();
    }

    container.querySelector('#btn-tj-desfazer').onclick = () => {
      if(historico.length > 0) {
        tarjas = JSON.parse(historico.pop());
        renderizarTarjasEditor();
      }
    };

    container.querySelector('#btn-tj-todas').onclick = () => {
      const ts = tarjas[paginaAtualModal];
      if (!ts || ts.length === 0) return alert('Desenhe pelo menos uma tarja nesta página primeiro.');
      if (confirm('Aplicar a exata posição destas tarjas para TODAS as páginas do documento? Isso sobrescreverá tarjas existentes em outras páginas.')) {
        salvarHistorico();
        const clone = JSON.parse(JSON.stringify(ts));
        for(let i=0; i<numPages; i++) tarjas[i] = JSON.parse(JSON.stringify(clone));
        PDFTools.UI.mostrarToast('Aplicado a todas as páginas com sucesso.', 'sucesso');
      }
    };

    container.querySelector('#btn-tj-fechar').onclick = () => {
      modal.style.display = 'none';
      document.body.classList.remove('pdf-editor-modal-aberto');
      atualizarBadgesNaGrade();
    };

    // Teclado (referência nomeada pra poder remover no cleanup)
    function aoTecladoTarjar(e) {
      if (modal.style.display === 'flex' && e.ctrlKey && e.key === 'z') {
        container.querySelector('#btn-tj-desfazer').click();
      }
    }
    document.addEventListener('keydown', aoTecladoTarjar);

    // --- GERAR ---
    container.querySelector('#btn-gerar').onclick = async () => {
      const totalTarjadas = Object.values(tarjas).filter(t => t && t.length > 0).length;
      if (totalTarjadas === 0) return alert('Nenhuma tarja foi desenhada no documento. Clique em uma página para desenhar.');
      
      const dpi = parseInt(container.querySelector('#tj-dpi').value) || 150;
      
      if (totalTarjadas > 10 && dpi >= 300) {
         if(!confirm(`Atenção: Você vai rasterizar ${totalTarjadas} páginas em 300 DPI. Isso consome muita memória e pode travar no celular. Deseja prosseguir mesmo assim? (Se travar, tente 150 DPI)`)) return;
      }

      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;

      try {
        await PDFTools.carregarLib('pdf-lib');
        
        const blob = await aplicarTarjasLogica(fileOrig, pdfDocJs, tarjas, dpi, (pct, txt) => progresso.atualizar(pct, txt));
        
        PDFTools.UI.mostrarToast('Documento tarjado com sucesso!', 'sucesso');
        const nome = PDFTools.nomeSemExtensao(fileOrig.name) + '-tarjado.pdf';
        PDFTools.baixar(blob, nome);

        const resArea = container.querySelector('#tj-resultado');
        resArea.style.display = 'block';
        container.querySelector('#btn-tj-baixar-novamente').onclick = () => PDFTools.baixar(blob, nome);
        const proxContainer = container.querySelector('#tj-proximos-passos');
        proxContainer.innerHTML = '';
        const prox = PDFTools.UI.criarProximosPassos({
          blob, nomeArquivo: nome, origemId: 'tarjar_pdf', tamanhoBytes: blob.size
        });
        if (prox) proxContainer.appendChild(prox);
        PDFTools.registrarAcaoSessao('Tarjou o documento');

      } catch (err) {
        console.error(err);
        PDFTools.UI.mostrarToast('Erro: ' + err.message, 'erro');
      } finally {
        progresso.esconder();
        btn.disabled = false;
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);

    // Cleanup chamado por index.html ao trocar de ferramenta ou voltar pra home.
    return function limparTarjar() {
      document.removeEventListener('keydown', aoTecladoTarjar);
      window.removeEventListener('resize', aoRedimensionarTarjar);
      window.removeEventListener('orientationchange', aoRedimensionarTarjar);
      document.body.classList.remove('pdf-editor-modal-aberto');
      try { visaoObserver.disconnect(); } catch (e) {}
    };
  }
});

// --- LÓGICA PURA ---

async function aplicarTarjasLogica(fileOrig, docJs, tarjasMap, dpi, aoProgredir) {
  const buffer = await PDFTools.lerComoArrayBuffer(fileOrig);
  const { PDFDocument } = window.PDFLib;
  
  const docOriginal = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const novoDoc = await PDFDocument.create();

  // A REGRA INEGOCIÁVEL: Remover metadados
  novoDoc.setTitle(''); novoDoc.setAuthor(''); novoDoc.setSubject(''); novoDoc.setKeywords([]); novoDoc.setProducer(''); novoDoc.setCreator('');

  const numPages = docOriginal.getPageCount();
  const scale = dpi / 72; // Converte DPI para escala do viewport do PDFJS (onde 1.0 = 72 DPI)

  for (let i = 0; i < numPages; i++) {
    aoProgredir((i / numPages) * 100, `Processando página ${i + 1} de ${numPages}...`);
    await new Promise(r => setTimeout(r, 0)); // respiro

    const tarjas = tarjasMap[i];

    if (!tarjas || tarjas.length === 0) {
      // Página sem tarja: copia intacta
      const [copiedPage] = await novoDoc.copyPages(docOriginal, [i]);
      novoDoc.addPage(copiedPage);
    } else {
      // PÁGINA TARJADA: Rasterização destrutiva irreversível
      const pageJs = await docJs.getPage(i + 1);
      const viewport = pageJs.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      
      // Fundo branco obrigatório antes de desenhar o PDF (evita PDF com transparência ficando preto)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Renderiza a página
      await pageJs.render({ canvasContext: ctx, viewport }).promise;

      // Desenha as tarjas
      ctx.fillStyle = '#000000';
      for (const t of tarjas) {
        // Usa as coordenadas percentuais multiplicadas pelas dimensões reais do canvas renderizado
        const rx = t.x * canvas.width;
        const ry = t.y * canvas.height;
        const rw = t.w * canvas.width;
        const rh = t.h * canvas.height;
        ctx.fillRect(rx, ry, rw, rh);
      }

      // Exporta irreversivelmente como JPEG
      const jpgData = await new Promise(res => {
         canvas.toBlob(async blob => {
            const arr = await blob.arrayBuffer();
            res(new Uint8Array(arr));
         }, 'image/jpeg', 0.95); // Qualidade alta pra não destruir a leitura
      });

      // Embutir no novo PDF
      const img = await novoDoc.embedJpg(jpgData);
      
      // Cria página nova nas dimensões originais corrigidas da rotação
      // O width/height em pontos é o tamanho do canvas dividido pela escala (retornando a 72 DPI)
      const pw = viewport.width / scale;
      const ph = viewport.height / scale;
      const newPage = novoDoc.addPage([pw, ph]);
      
      newPage.drawImage(img, {
        x: 0,
        y: 0,
        width: pw,
        height: ph
      });
      
      // Força garbage collection
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  aoProgredir(99, 'Salvando arquivo...');
  await new Promise(r => setTimeout(r, 0));
  
  const outBytes = await novoDoc.save({ useObjectStreams: true });
  return new Blob([outBytes], { type: 'application/pdf' });
}
