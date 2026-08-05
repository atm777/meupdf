PDFTools.registrar({
  id: 'assinar_pdf',
  nome: 'Assinar e Preencher',
  descricao: 'Assine documentos, adicione data e nome sem enviar seu arquivo para nenhum servidor.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: function(container, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let numPages = 0;
    
    // Estado principal
    // assinaturas: { 0: [{tipo: 'img'|'texto', val, x, y, w, h}], ... }
    let assinaturas = {};
    let historico = [];
    let paginaAtualModal = 0;
    
    // Assinatura Salva localmente
    let assinaturaSalva = localStorage.getItem('assinatura_salva') || null;

    if (!document.getElementById('css-assinar')) {
      const style = document.createElement('style');
      style.id = 'css-assinar';
      style.textContent = `
        .as-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .as-main { flex: 1; min-width: 300px; display: flex; flex-direction: column; }
        .as-sidebar { width: 300px; flex-shrink: 0; }
        .as-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px; margin-bottom:16px; }
        .as-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; overflow-y: auto; max-height: 500px; padding: 8px; background: var(--sup-2); border-radius: 8px; }
        .as-pagina { background: var(--sup); box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; position: relative; cursor: pointer; transition: transform 0.2s; }
        .as-pagina:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .as-pagina-header { font-size: 12px; padding: 4px; text-align: center; font-weight: bold; background: var(--sup-2); border-bottom: 1px solid var(--borda); color: var(--texto-2); }
        .as-thumb-container { width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--sup); position: relative; }
        .as-thumb-container canvas { max-width: 100%; max-height: 100%; object-fit: contain; }
        .as-badge { position: absolute; bottom: 4px; right: 4px; background: var(--cor-sucesso); color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; display: none; }
        .as-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; }
        .as-btn-acao:hover { background: #004494; }
        .as-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .as-btn { padding: 6px 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 13px; }
        .as-btn:hover { background: var(--sup-2); }
        
        .as-aviso { background: #eaffea; color: #28a745; padding: 12px; border-radius: 4px; font-size: 13px; border: 1px solid #b3e6b3; margin-bottom: 16px; }
        
        /* Modal Assinatura Base */
        .as-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; flex-direction: column; }
        #as-modal-desenho { z-index: 10000; }
        .as-modal-topbar { background: var(--cor-primaria); color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
        .as-modal-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; position: relative; }
        
        /* Criação de Assinatura */
        .as-cria-painel { background: var(--sup); border-radius: 8px; padding: 24px; width: 500px; max-width: 90%; }
        .as-cria-abas { display: flex; border-bottom: 1px solid var(--borda); margin-bottom: 16px; }
        .as-cria-aba { padding: 8px 16px; cursor: pointer; border-bottom: 2px solid transparent; font-weight: bold; color: var(--texto-2); }
        .as-cria-aba.ativa { border-bottom-color: var(--cor-primaria); color: var(--cor-primaria); }
        .as-draw-canvas { border: 1px solid var(--borda); border-radius: 4px; width: 100%; height: 200px; touch-action: none; background: #fafafa; cursor: crosshair; }

        /* Desenho Livre (lápis) */
        .as-desenho-canvas { border: 1px solid var(--borda); border-radius: 4px; width: 100%; height: 260px; touch-action: none; background: #fafafa; cursor: crosshair; }
        .as-desenho-barra { display: flex; align-items: center; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
        .as-desenho-grupo { display: flex; align-items: center; gap: 6px; }
        .as-desenho-grupo-label { font-size: 12px; font-weight: bold; color: var(--texto-2); margin-right: 2px; }
        .as-lapis-tamanho { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--borda); background: var(--sup); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
        .as-lapis-tamanho.ativo { border-color: var(--cor-primaria); }
        .as-lapis-tamanho span { border-radius: 50%; background: #000; display: block; }
        .as-cor-swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; box-shadow: 0 0 0 1px var(--borda); }
        .as-cor-swatch.ativo { border-color: var(--cor-primaria); }
        .as-cor-custom { width: 26px; height: 26px; border-radius: 50%; border: none; padding: 0; cursor: pointer; background: none; }
        
        /* Editor de Página */
        .as-editor-wrapper { position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: inline-block; background: var(--sup); }
        .as-editor-canvas { display: block; }
        .as-editor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        
        .as-item-arrastavel { position: absolute; border: 1px dashed transparent; cursor: move; }
        .as-item-arrastavel:hover, .as-item-arrastavel.ativo { border-color: var(--cor-primaria); background: rgba(0, 123, 255, 0.05); }
        .as-item-arrastavel img { width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
        .as-item-arrastavel .txt { width: 100%; height: 100%; display:flex; align-items:center; font-family: sans-serif; font-size: 16px; color: #000; pointer-events: none; }
        
        .as-resize-handle { position: absolute; bottom: -5px; right: -5px; width: 14px; height: 14px; background: var(--cor-primaria); border-radius: 50%; cursor: se-resize; display: none; }
        .as-item-arrastavel.ativo .as-resize-handle { display: block; }
        .as-delete-handle { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: var(--cor-erro); color: white; border-radius: 50%; text-align: center; line-height: 20px; font-size: 12px; font-weight: bold; cursor: pointer; display: none; }
        .as-item-arrastavel.ativo .as-delete-handle { display: block; }
        
        .as-ferramentas-flutuante { position: absolute; top: 80px; left: 24px; background: var(--sup); padding: 12px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 8px; z-index: 10; width: 200px; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="as-tela-inicial"></div>
      <div id="as-tela-trabalho" style="display:none;" class="as-layout">
        <div class="as-main">
          <div class="as-painel" style="background:var(--cor-sucesso-fundo); color:var(--cor-sucesso); border-color:var(--cor-sucesso);">
            <strong style="font-size:15px;">🛡️ Honestidade na Assinatura:</strong><br>
            <span style="font-size:14px;">Esta é uma <strong>assinatura visual</strong>, com o mesmo valor prático de imprimir, assinar à caneta e escanear de volta. Ela <strong>não rasteriza o PDF</strong>, mantendo os textos pesquisáveis. Para assinaturas digitais oficiais ICP-Brasil, utilize o portal Gov.br.</span>
          </div>
          
          <div style="font-size:16px; font-weight:bold; margin-bottom:8px; color:var(--texto);">Clique em uma página abaixo para assinar:</div>
          <div class="as-grade" id="as-grade"></div>
        </div>
        <div class="as-sidebar">
          <div class="as-painel" id="painel-assinatura-base">
            <h3 style="margin-top:0; border-bottom: 1px solid var(--borda); padding-bottom:8px;">Sua Assinatura</h3>
            <div id="box-sem-assinatura">
              <p style="font-size:13px; color: var(--texto-2);">Você ainda não criou uma assinatura neste aparelho.</p>
              <button class="as-btn" id="btn-criar-ass" style="width:100%; border-color:var(--cor-primaria); color:var(--cor-primaria); font-weight:bold;">Criar Nova Assinatura</button>
            </div>
            <div id="box-com-assinatura" style="display:none; text-align:center;">
              <div style="background:var(--sup-2); border:1px dashed #ccc; border-radius:4px; padding:16px; margin-bottom:8px; height:80px; display:flex; align-items:center; justify-content:center;">
                <img id="img-assinatura-salva" style="max-width:100%; max-height:100%;">
              </div>
              <button class="as-btn" id="btn-apagar-ass" style="width:100%; color:var(--cor-erro); border-color:var(--cor-erro);">Apagar Assinatura do Aparelho</button>
              <p style="font-size:11px; color: var(--texto-2); margin-top:8px; text-align:left;">Sua assinatura fica salva apenas no armazenamento local deste navegador. Nunca é enviada para servidores.</p>
            </div>
          </div>

          <div class="as-painel">
            <h3 style="margin-top:0; border-bottom: 1px solid var(--borda); padding-bottom:8px;">Exportar</h3>
            <button class="as-btn-acao" id="btn-gerar">Gerar PDF Assinado</button>
            <div id="as-progresso-container" style="margin-top:16px;"></div>
            <div id="as-resultado" style="display:none; margin-top:16px;">
              <div style="font-size:13px; color:var(--cor-sucesso); font-weight:bold; margin-bottom:8px;">✅ Concluído! Baixado automaticamente.</div>
              <button id="btn-as-baixar-novamente" class="pdf-btn-principal" style="margin-top:0;">Baixar Novamente</button>
              <div id="as-proximos-passos" style="margin-top:16px;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Criar Assinatura -->
      <div id="as-modal-criar" class="as-modal-overlay">
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          <div class="as-cria-painel">
            <h3 style="margin-top:0;">Criar Assinatura</h3>
            <div class="as-cria-abas">
              <div class="as-cria-aba ativa" data-modo="desenhar">Desenhar</div>
              <div class="as-cria-aba" data-modo="imagem">Enviar Imagem</div>
            </div>
            
            <div id="aba-desenhar">
              <canvas id="as-draw" class="as-draw-canvas"></canvas>
              <div style="display:flex; justify-content:space-between; margin-top:8px;">
                <button class="as-btn" id="btn-limpar-desenho">Limpar</button>
                <div style="font-size:12px; color: var(--texto-2); margin-top:4px;">As bordas vazias serão cortadas automaticamente.</div>
              </div>
            </div>

            <div id="aba-imagem" style="display:none;">
              <input type="file" id="as-file-img" accept="image/*" style="margin-bottom:16px; width:100%;">
              <div style="margin-bottom:8px;">
                <label style="font-size:13px; font-weight:bold;">Remover Fundo Branco</label>
                <input type="range" id="as-range-fundo" min="0" max="255" value="230" style="width:100%;">
                <div style="font-size:11px; color: var(--texto-2);">Ajuste para tornar o papel transparente.</div>
              </div>
              <div style="height:100px; background:var(--sup-2); border: 1px solid var(--borda); display:flex; align-items:center; justify-content:center; overflow:hidden;">
                <canvas id="as-preview-img" style="max-height:100%; max-width:100%;"></canvas>
              </div>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:24px;">
              <button class="as-btn" id="btn-cancelar-cria">Cancelar</button>
              <button class="as-btn-acao" id="btn-salvar-cria" style="width:auto; padding:8px 16px;">Salvar Assinatura</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Desenho Livre (lápis à mão livre) -->
      <div id="as-modal-desenho" class="as-modal-overlay">
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          <div class="as-cria-painel">
            <h3 style="margin-top:0;">Desenho Livre</h3>
            <canvas id="as-draw-livre" class="as-desenho-canvas"></canvas>
            <div class="as-desenho-barra">
              <div class="as-desenho-grupo">
                <span class="as-desenho-grupo-label">Espessura:</span>
                <button type="button" class="as-lapis-tamanho" data-tamanho="2"><span style="width:4px; height:4px;"></span></button>
                <button type="button" class="as-lapis-tamanho ativo" data-tamanho="5"><span style="width:8px; height:8px;"></span></button>
                <button type="button" class="as-lapis-tamanho" data-tamanho="10"><span style="width:14px; height:14px;"></span></button>
              </div>
              <div class="as-desenho-grupo">
                <span class="as-desenho-grupo-label">Cor:</span>
                <button type="button" class="as-cor-swatch ativo" data-cor="#000000" style="background:#000000;"></button>
                <button type="button" class="as-cor-swatch" data-cor="#ef4444" style="background:#ef4444;"></button>
                <button type="button" class="as-cor-swatch" data-cor="#0a58ca" style="background:#0a58ca;"></button>
                <button type="button" class="as-cor-swatch" data-cor="#10b981" style="background:#10b981;"></button>
                <button type="button" class="as-cor-swatch" data-cor="#f59e0b" style="background:#f59e0b;"></button>
                <input type="color" id="as-cor-livre-custom" class="as-cor-custom" value="#000000" title="Outra cor">
              </div>
              <button class="as-btn" id="btn-limpar-desenho-livre" style="margin-left:auto;">Limpar</button>
            </div>
            <div style="font-size:12px; color: var(--texto-2); margin-top:8px;">Desenhe com o mouse ou o dedo. Dá para arrastar e redimensionar depois de adicionar à página.</div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
              <button class="as-btn" id="btn-cancelar-desenho">Cancelar</button>
              <button class="as-btn-acao" id="btn-salvar-desenho" style="width:auto; padding:8px 16px;">Adicionar à Página</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Editor de Página -->
      <div id="as-modal-editor" class="as-modal-overlay">
        <div class="as-modal-topbar">
          <div style="font-size:16px; font-weight:bold;">Assinando Página <span id="as-modal-pagina"></span></div>
          <div id="as-zoom-slot"></div>
          <div style="display:flex; gap:8px;">
            <button class="as-btn" id="btn-as-desfazer">Desfazer (Ctrl+Z)</button>
            <button class="as-btn" style="background:var(--cor-primaria); color:white; border-color:var(--cor-primaria);" id="btn-as-fechar">Concluir Página</button>
          </div>
        </div>
        
        <div class="as-ferramentas-flutuante">
          <div style="font-size:13px; font-weight:bold; margin-bottom:8px;">Adicionar à página:</div>
          <button class="as-btn" id="btn-add-ass" style="text-align:left;">✒️ Assinatura Salva</button>
          <button class="as-btn" id="btn-add-data" style="text-align:left;">📅 Data de Hoje</button>
          <button class="as-btn" id="btn-add-txt" style="text-align:left;">📝 Texto Livre</button>
          <button class="as-btn" id="btn-add-desenho" style="text-align:left;">✏️ Desenho Livre</button>

          <hr style="border:0; border-top: 1px solid var(--borda); margin:8px 0;">
          <button class="as-btn" id="btn-aplicar-todas" style="text-align:left; color:var(--cor-primaria);">✨ Aplicar a Todas</button>
        </div>

        <div class="as-modal-body" id="as-modal-body">
          <div class="as-editor-wrapper" id="as-wrapper">
            <canvas class="as-editor-canvas" id="as-canvas"></canvas>
            <div class="as-editor-layer" id="as-layer"></div>
          </div>
        </div>
      </div>
    `;

    const drop = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf, application/pdf', onArquivos: a => abrirArquivo(a[0]) });
    container.querySelector('#as-tela-inicial').appendChild(drop);
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#as-progresso-container').appendChild(progresso.elemento);

    atualizarPainelAssinatura();

    // --- CRIAÇÃO DE ASSINATURA ---
    const modalCria = container.querySelector('#as-modal-criar');
    const drawCanvas = container.querySelector('#as-draw');
    const ctxDraw = drawCanvas.getContext('2d', { willReadFrequently: true });
    
    // Fix resolution
    function resizeDrawCanvas() {
      const rect = drawCanvas.getBoundingClientRect();
      drawCanvas.width = rect.width * 2;
      drawCanvas.height = rect.height * 2;
      ctxDraw.scale(2, 2);
      ctxDraw.lineCap = 'round';
      ctxDraw.lineJoin = 'round';
      ctxDraw.lineWidth = 4;
      ctxDraw.strokeStyle = '#000000';
    }

    container.querySelector('#btn-criar-ass').onclick = () => {
      modalCria.style.display = 'flex';
      setTimeout(resizeDrawCanvas, 50);
    };
    container.querySelector('#btn-cancelar-cria').onclick = () => { modalCria.style.display = 'none'; };

    container.querySelectorAll('.as-cria-aba').forEach(aba => {
      aba.onclick = () => {
        container.querySelectorAll('.as-cria-aba').forEach(a => a.classList.remove('ativa'));
        aba.classList.add('ativa');
        const modo = aba.dataset.modo;
        container.querySelector('#aba-desenhar').style.display = modo === 'desenhar' ? 'block' : 'none';
        container.querySelector('#aba-imagem').style.display = modo === 'imagem' ? 'block' : 'none';
        if (modo === 'desenhar') resizeDrawCanvas();
      };
    });

    // Lógica Desenho
    let isDrawing = false, lastX=0, lastY=0;
    
    function getDrawPos(e) {
      const rect = drawCanvas.getBoundingClientRect();
      let cx = e.clientX, cy = e.clientY;
      if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      return { x: cx - rect.left, y: cy - rect.top };
    }

    function startDraw(e) {
      e.preventDefault(); isDrawing = true;
      const p = getDrawPos(e); lastX = p.x; lastY = p.y;
      ctxDraw.beginPath(); ctxDraw.moveTo(lastX, lastY);
    }
    function moveDraw(e) {
      if (!isDrawing) return;
      e.preventDefault(); const p = getDrawPos(e);
      // Suavização quadrática simples
      const xc = (lastX + p.x) / 2; const yc = (lastY + p.y) / 2;
      ctxDraw.quadraticCurveTo(lastX, lastY, xc, yc); ctxDraw.stroke();
      lastX = p.x; lastY = p.y;
    }
    function stopDraw() { isDrawing = false; }

    drawCanvas.addEventListener('mousedown', startDraw); drawCanvas.addEventListener('mousemove', moveDraw); drawCanvas.addEventListener('mouseup', stopDraw); drawCanvas.addEventListener('mouseleave', stopDraw);
    drawCanvas.addEventListener('touchstart', startDraw, {passive:false}); drawCanvas.addEventListener('touchmove', moveDraw, {passive:false}); drawCanvas.addEventListener('touchend', stopDraw);

    container.querySelector('#btn-limpar-desenho').onclick = () => {
      ctxDraw.clearRect(0,0, drawCanvas.width, drawCanvas.height);
    };

    // Lógica Imagem e Fundo Branco
    const imgPreviewCvs = container.querySelector('#as-preview-img');
    const imgPreviewCtx = imgPreviewCvs.getContext('2d', { willReadFrequently: true });
    let originalImgData = null;

    container.querySelector('#as-file-img').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { const p = Math.min(MAX/w, MAX/h); w*=p; h*=p; }
        imgPreviewCvs.width = w; imgPreviewCvs.height = h;
        imgPreviewCtx.drawImage(img, 0, 0, w, h);
        originalImgData = imgPreviewCtx.getImageData(0,0,w,h);
        aplicarFiltroFundo();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    };

    container.querySelector('#as-range-fundo').oninput = aplicarFiltroFundo;

    function aplicarFiltroFundo() {
      if (!originalImgData) return;
      const limiar = parseInt(container.querySelector('#as-range-fundo').value);
      const idata = imgPreviewCtx.createImageData(originalImgData);
      idata.data.set(originalImgData.data);
      const d = idata.data;
      for (let i=0; i<d.length; i+=4) {
        if (d[i] > limiar && d[i+1] > limiar && d[i+2] > limiar) d[i+3] = 0; // Transparente
      }
      imgPreviewCtx.putImageData(idata, 0, 0);
    }

    container.querySelector('#btn-salvar-cria').onclick = () => {
      const modo = container.querySelector('.as-cria-aba.ativa').dataset.modo;
      let targetCvs = modo === 'desenhar' ? drawCanvas : imgPreviewCvs;
      
      // Auto crop
      const w = targetCvs.width, h = targetCvs.height;
      if (w === 0) return;
      const ctx = targetCvs.getContext('2d');
      const d = ctx.getImageData(0,0,w,h).data;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      let hasPixels = false;
      
      for(let y=0; y<h; y++) {
        for(let x=0; x<w; x++) {
          if (d[(y*w+x)*4+3] > 10) { // alpha > 10
             if(x < minX) minX = x;
             if(x > maxX) maxX = x;
             if(y < minY) minY = y;
             if(y > maxY) maxY = y;
             hasPixels = true;
          }
        }
      }
      
      if (!hasPixels) return alert('A assinatura está vazia.');
      
      const pad = 10;
      minX = Math.max(0, minX-pad); minY = Math.max(0, minY-pad);
      maxX = Math.min(w, maxX+pad); maxY = Math.min(h, maxY+pad);
      
      const cropCvs = document.createElement('canvas');
      cropCvs.width = maxX - minX; cropCvs.height = maxY - minY;
      cropCvs.getContext('2d').putImageData(ctx.getImageData(minX, minY, cropCvs.width, cropCvs.height), 0, 0);
      
      assinaturaSalva = cropCvs.toDataURL('image/png');
      localStorage.setItem('assinatura_salva', assinaturaSalva);
      atualizarPainelAssinatura();
      modalCria.style.display = 'none';
      
      ctxDraw.clearRect(0,0, drawCanvas.width, drawCanvas.height);
      originalImgData = null;
      imgPreviewCtx.clearRect(0,0, imgPreviewCvs.width, imgPreviewCvs.height);
    };

    function atualizarPainelAssinatura() {
      const bxSem = container.querySelector('#box-sem-assinatura');
      const bxCom = container.querySelector('#box-com-assinatura');
      if (assinaturaSalva) {
        bxSem.style.display = 'none';
        bxCom.style.display = 'block';
        container.querySelector('#img-assinatura-salva').src = assinaturaSalva;
      } else {
        bxSem.style.display = 'block';
        bxCom.style.display = 'none';
      }
    }

    container.querySelector('#btn-apagar-ass').onclick = () => {
      localStorage.removeItem('assinatura_salva');
      assinaturaSalva = null;
      atualizarPainelAssinatura();
    };

    // --- DESENHO LIVRE (lápis à mão livre, para marcar/anotar a página) ---
    const modalDesenho = container.querySelector('#as-modal-desenho');
    const drawLivreCanvas = container.querySelector('#as-draw-livre');
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

    container.querySelector('#btn-add-desenho').onclick = () => {
      modalDesenho.style.display = 'flex';
      setTimeout(resizeDrawLivreCanvas, 50);
    };
    container.querySelector('#btn-cancelar-desenho').onclick = () => { modalDesenho.style.display = 'none'; };

    container.querySelectorAll('.as-lapis-tamanho').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('.as-lapis-tamanho').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        lapisTamanho = parseInt(btn.dataset.tamanho);
        ctxDrawLivre.lineWidth = lapisTamanho;
      };
    });

    function selecionarCorLivre(cor) {
      lapisCor = cor;
      ctxDrawLivre.strokeStyle = lapisCor;
      container.querySelectorAll('.as-cor-swatch').forEach(b => b.classList.toggle('ativo', b.dataset.cor === cor));
    }
    container.querySelectorAll('.as-cor-swatch').forEach(btn => {
      btn.onclick = () => selecionarCorLivre(btn.dataset.cor);
    });
    container.querySelector('#as-cor-livre-custom').oninput = (e) => {
      container.querySelectorAll('.as-cor-swatch').forEach(b => b.classList.remove('ativo'));
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

    container.querySelector('#btn-salvar-desenho').onclick = () => {
      // Auto crop nas bordas transparentes, igual à criação de assinatura
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

      if (!hasPixels) return alert('Desenhe algo antes de adicionar à página.');

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
      assinaturas[paginaAtualModal].push({ tipo: 'img', val: dataUrl, x: 0.35, y: 0.4, w: wFrac, h: wFrac * ratio });
      renderizarItensEditor();

      modalDesenho.style.display = 'none';
      ctxDrawLivre.clearRect(0, 0, drawLivreCanvas.width, drawLivreCanvas.height);
    };

    // --- LEITURA DO ARQUIVO ---
    let visaoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) renderizarMiniatura(entry.target); });
    }, { rootMargin: '200px' });

    async function abrirArquivo(file) {
      fileOrig = file;
      container.querySelector('#as-tela-inicial').innerHTML = '<div style="text-align:center; padding:40px;">Lendo arquivo...</div>';
      try {
        await PDFTools.carregarLib('pdfjs');
        const buffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        numPages = pdfDocJs.numPages;
        assinaturas = {};
        for(let i=0; i<numPages; i++) assinaturas[i] = [];
        historico = [JSON.stringify(assinaturas)];
        
        container.querySelector('#as-tela-inicial').style.display = 'none';
        container.querySelector('#as-tela-trabalho').style.display = 'flex';
        renderizarGrade();
      } catch(e) {
        if (e.name === 'PasswordException') container.querySelector('#as-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        else container.querySelector('#as-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido', e.message);
      }
    }

    function renderizarGrade() {
      const grade = container.querySelector('#as-grade');
      grade.innerHTML = '';
      visaoObserver.disconnect();
      
      for(let i=0; i<numPages; i++) {
        const el = document.createElement('div');
        el.className = 'as-pagina';
        el.dataset.index = i;
        el.innerHTML = `<div class="as-pagina-header">Página ${i + 1}</div><div class="as-thumb-container"></div><div class="as-badge">Assinada</div>`;
        el.onclick = () => abrirEditor(i);
        grade.appendChild(el);
        visaoObserver.observe(el);
      }
      atualizarBadges();
    }

    function atualizarBadges() {
      for(let i=0; i<numPages; i++) {
        const el = container.querySelector(`.as-pagina[data-index="${i}"]`);
        if(el) {
          el.querySelector('.as-badge').style.display = (assinaturas[i] && assinaturas[i].length > 0) ? 'block' : 'none';
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
        el.querySelector('.as-thumb-container').appendChild(canvas);
      } catch(e) {}
    }

    // --- EDITOR ---
    const modalEditor = container.querySelector('#as-modal-editor');
    const layer = container.querySelector('#as-layer');
    const cvsEditor = container.querySelector('#as-canvas');
    let itemAtivo = null;

    // Zoom do editor: `escalaBase` é o "ajustar à tela" calculado ao abrir cada página;
    // o fator do controle de zoom multiplica em cima disso. Lupa/botões no desktop, pinça de
    // dois dedos no celular (ver criarControleZoom em ui.js).
    let paginaPdfAtual = null;
    let escalaBase = 1;
    const controleZoom = window.PDFTools.UI.criarControleZoom({
      superficieToque: container.querySelector('#as-modal-body'),
      aoMudarZoom: (fator) => { if (paginaPdfAtual) renderizarPaginaNoCanvas(fator); }
    });
    container.querySelector('#as-zoom-slot').appendChild(controleZoom.elemento);

    async function renderizarPaginaNoCanvas(fatorZoom) {
      const viewport = paginaPdfAtual.getViewport({ scale: escalaBase * fatorZoom });
      cvsEditor.width = viewport.width; cvsEditor.height = viewport.height;

      const ctx = cvsEditor.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,cvsEditor.width, cvsEditor.height);
      await paginaPdfAtual.render({ canvasContext: ctx, viewport }).promise;

      renderizarItensEditor();
    }

    async function abrirEditor(index) {
      paginaAtualModal = index;
      container.querySelector('#as-modal-pagina').textContent = index + 1;
      modalEditor.style.display = 'flex';
      layer.innerHTML = '';

      const page = await pdfDocJs.getPage(index + 1);
      paginaPdfAtual = page;
      const viewportRef = page.getViewport({ scale: 1.0 });
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.75;
      escalaBase = Math.min(maxWidth/viewportRef.width, maxHeight/viewportRef.height, 1.5);

      controleZoom.definirZoom(1); // dispara renderizarPaginaNoCanvas(1) via aoMudarZoom
    }

    function renderizarItensEditor() {
      layer.innerHTML = '';
      const lista = assinaturas[paginaAtualModal] || [];
      const w = cvsEditor.width, h = cvsEditor.height;
      
      lista.forEach((item, idx) => {
        const el = document.createElement('div');
        el.className = 'as-item-arrastavel';
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
        
        const resizer = document.createElement('div'); resizer.className = 'as-resize-handle'; el.appendChild(resizer);
        const del = document.createElement('div'); del.className = 'as-delete-handle'; del.textContent = '✕'; el.appendChild(del);
        
        // Interações
        el.onmousedown = (e) => startDrag(e, idx, el);
        el.ontouchstart = (e) => startDrag(e, idx, el);
        
        resizer.onmousedown = (e) => startResize(e, idx, el);
        resizer.ontouchstart = (e) => startResize(e, idx, el);
        
        del.onclick = (e) => { e.stopPropagation(); salvarEstado(); assinaturas[paginaAtualModal].splice(idx,1); renderizarItensEditor(); };
        
        layer.appendChild(el);
      });
    }

    // Ferramentas Adicionar
    container.querySelector('#btn-add-ass').onclick = () => {
      if (!assinaturaSalva) return alert('Você precisa criar ou enviar uma assinatura primeiro.');
      salvarEstado();
      // Assinatura padrão ~25% da largura da tela, no meio
      assinaturas[paginaAtualModal].push({ tipo: 'img', val: assinaturaSalva, x: 0.35, y: 0.4, w: 0.25, h: 0.1 });
      renderizarItensEditor();
    };

    container.querySelector('#btn-add-data').onclick = () => {
      salvarEstado();
      const d = new Date().toLocaleDateString('pt-BR');
      assinaturas[paginaAtualModal].push({ tipo: 'texto', val: d, x: 0.4, y: 0.5, w: 0.15, h: 0.05 });
      renderizarItensEditor();
    };

    container.querySelector('#btn-add-txt').onclick = () => {
      const txt = prompt('Digite o texto:');
      if (txt) {
        salvarEstado();
        assinaturas[paginaAtualModal].push({ tipo: 'texto', val: txt, x: 0.4, y: 0.6, w: 0.2, h: 0.05 });
        renderizarItensEditor();
      }
    };

    container.querySelector('#btn-aplicar-todas').onclick = () => {
      const ts = assinaturas[paginaAtualModal];
      if (!ts || ts.length === 0) return alert('Adicione pelo menos um item nesta página primeiro.');
      if (confirm('Replicar todos os itens e posições atuais para TODAS as páginas do documento? Isso sobrescreve a edição das outras.')) {
        salvarEstado();
        const clone = JSON.parse(JSON.stringify(ts));
        for(let i=0; i<numPages; i++) assinaturas[i] = JSON.parse(JSON.stringify(clone));
        PDFTools.UI.mostrarToast('Aplicado a todas as páginas com sucesso.', 'sucesso');
      }
    };

    // Drag e Resize simples
    let draggingInfo = null;
    
    function startDrag(e, idx, el) {
      if (e.target.classList.contains('as-resize-handle') || e.target.classList.contains('as-delete-handle')) return;
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.as-item-arrastavel').forEach(el=>el.classList.remove('ativo'));
      el.classList.add('ativo');
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = el.getBoundingClientRect();
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
      
      if (draggingInfo.mode === 'drag') {
        let nL = draggingInfo.initL + dx; let nT = draggingInfo.initT + dy;
        el.style.left = nL + 'px'; el.style.top = nT + 'px';
      } else {
        // resize proporcional
        const maxD = Math.max(dx, dy);
        el.style.width = Math.max(20, draggingInfo.initW + maxD) + 'px';
        el.style.height = Math.max(10, draggingInfo.initH + (maxD * (draggingInfo.initH/draggingInfo.initW))) + 'px';
      }
    }
    
    function doEnd(e) {
      if (!draggingInfo) {
        // Clica fora desmarca
        if(e.target === layer) document.querySelectorAll('.as-item-arrastavel').forEach(el=>el.classList.remove('ativo'));
        return;
      }
      const idx = draggingInfo.idx;
      const el = layer.children[idx];
      salvarEstado();
      const wCvs = cvsEditor.width, hCvs = cvsEditor.height;
      assinaturas[paginaAtualModal][idx].x = parseFloat(el.style.left) / wCvs;
      assinaturas[paginaAtualModal][idx].y = parseFloat(el.style.top) / hCvs;
      assinaturas[paginaAtualModal][idx].w = parseFloat(el.style.width) / wCvs;
      assinaturas[paginaAtualModal][idx].h = parseFloat(el.style.height) / hCvs;
      draggingInfo = null;
    }

    layer.addEventListener('mousemove', doMove); layer.addEventListener('mouseup', doEnd); layer.addEventListener('mouseleave', doEnd);
    layer.addEventListener('touchmove', doMove, {passive:false}); layer.addEventListener('touchend', doEnd); layer.addEventListener('click', doEnd);

    function salvarEstado() {
      historico.push(JSON.stringify(assinaturas));
      if (historico.length > 20) historico.shift();
    }
    
    container.querySelector('#btn-as-desfazer').onclick = () => {
      if (historico.length > 0) { assinaturas = JSON.parse(historico.pop()); renderizarItensEditor(); }
    };
    
    container.querySelector('#btn-as-fechar').onclick = () => {
      modalEditor.style.display = 'none';
      atualizarBadges();
    };

    // --- GERAR PDF ---
    container.querySelector('#btn-gerar').onclick = async () => {
      const total = Object.values(assinaturas).flat().length;
      if (total === 0) {
        return alert('Você ainda não adicionou sua assinatura ao documento.\n\nComo fazer:\n1. Clique em uma das páginas no centro da tela.\n2. No editor que abrir, clique em "Assinatura Salva" e posicione onde desejar.\n3. Clique em "Concluir Página" e depois em Gerar.');
      }
      
      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;
      try {
        await PDFTools.carregarLib('pdf-lib');
        
        const blob = await assinarLote(fileOrig, assinaturas, (pct, txt) => progresso.atualizar(pct, txt));
        PDFTools.UI.mostrarToast('Documento assinado com sucesso!', 'sucesso');
        const nome = PDFTools.nomeSemExtensao(fileOrig.name) + '-assinado.pdf';
        PDFTools.baixar(blob, nome);

        const resArea = container.querySelector('#as-resultado');
        resArea.style.display = 'block';
        container.querySelector('#btn-as-baixar-novamente').onclick = () => PDFTools.baixar(blob, nome);
        const proxContainer = container.querySelector('#as-proximos-passos');
        proxContainer.innerHTML = '';
        const prox = PDFTools.UI.criarProximosPassos({
          blob, nomeArquivo: nome, origemId: 'assinar_pdf', tamanhoBytes: blob.size
        });
        if (prox) proxContainer.appendChild(prox);
        PDFTools.registrarAcaoSessao('Assinou o documento');

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
});

// --- LÓGICA PURA ---

async function assinarLote(fileOrig, assinaturasMap, aoProgredir) {
  const buffer = await PDFTools.lerComoArrayBuffer(fileOrig);
  const { PDFDocument, StandardFonts, rgb, degrees } = window.PDFLib;
  
  const novoDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  
  // Limpar metadados é praxe
  novoDoc.setTitle(''); novoDoc.setAuthor(''); novoDoc.setSubject(''); novoDoc.setKeywords([]); novoDoc.setProducer(''); novoDoc.setCreator('');

  const numPages = novoDoc.getPageCount();
  const font = await novoDoc.embedFont(StandardFonts.Helvetica);
  
  // Cache de imagens embutidas para não embutir o mesmo PNG 50 vezes e inchar o PDF
  const imgCache = {};

  for (let i = 0; i < numPages; i++) {
    aoProgredir((i / numPages) * 100, `Processando página ${i + 1} de ${numPages}...`);
    await new Promise(r => setTimeout(r, 0));

    const itens = assinaturasMap[i];
    const page = novoDoc.getPage(i);

    if (itens && itens.length > 0) {
      // page.getSize() retorna sempre as dimensões BRUTAS do MediaBox (não muda com /Rotate).
      const rawSize = page.getSize();
      const anguloOriginal = page.getRotation().angle;

      for (const item of itens) {
        if (item.tipo === 'img') {
          if (!imgCache[item.val]) imgCache[item.val] = await novoDoc.embedPng(item.val);
          const pdfImg = imgCache[item.val];

          desenharRotacionado(page, pdfImg, null, item.x, item.y, item.w, item.h, rawSize.width, rawSize.height, anguloOriginal);

        } else {
          // Texto
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

// Contra-rotação para PDFLib usando o utilitário compartilhado de core.js.
// A tela visualiza a página já rotacionada (o canvas do editor vem do pdf.js, que já leva
// /Rotate em conta). O usuário desenha caixas percentuais relativas a essa visão VISUAL.
// Precisamos converter essas porcentagens para a coordenada bruta (não rotacionada) do PDF.
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
    // Escala o tamanho da fonte para caber na altura pedida da caixa (aproximadamente)
    const fontSize = boxH * 0.8;
    page.drawText(txtObj.txt, {
      x: t.x, y: t.y + (fontSize * 0.2), // ajuste fino de baseline
      size: fontSize,
      font: txtObj.font,
      color: txtObj.color,
      rotate: degrees(t.rotate)
    });
  }
}
