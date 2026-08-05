PDFTools.registrar({
  id: 'preencher_form',
  nome: 'Preencher Formulário',
  descricao: 'Preencha PDFs interativos (AcroForm) ou digite livremente por cima de qualquer documento.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: function(container, arquivoInicial) {
    let fileOrig = null;
    let arqBuffer = null;
    let pdfDocJs = null;
    let pdfDocLib = null;
    let numPages = 0;
    let hasXfa = false;
    let hasAcro = false;
    let camposAcro = [];

    // Estado modo livre
    let anotacoesLivre = {}; // { 0: [{txt, x, y, size, cor}], 1: [...] }
    let paginaAtualModal = 0;

    if (!document.getElementById('css-form')) {
      const style = document.createElement('style');
      style.id = 'css-form';
      style.textContent = `
        .fm-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .fm-main { flex: 1; min-width: 300px; display: flex; flex-direction: column; }
        .fm-sidebar { width: 340px; flex-shrink: 0; }
        .fm-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px; margin-bottom:16px; }
        .fm-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; overflow-y: auto; max-height: 500px; padding: 8px; background: var(--sup-2); border-radius: 8px; }
        .fm-pagina { background: var(--sup); box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; position: relative; cursor: pointer; transition: transform 0.2s; }
        .fm-pagina:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        .fm-pagina-header { font-size: 12px; padding: 4px; text-align: center; font-weight: bold; background: var(--sup-2); border-bottom: 1px solid var(--borda); color: var(--texto-2); }
        .fm-thumb-container { width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--sup); }
        .fm-thumb-container canvas { max-width: 100%; max-height: 100%; object-fit: contain; }
        
        .fm-badge { position: absolute; bottom: 4px; right: 4px; background: var(--cor-primaria); color: white; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; display: none; }
        
        .fm-campo-acro { margin-bottom: 16px; background: var(--sup); padding: 12px; border: 1px solid var(--borda); border-radius: 4px; }
        .fm-campo-acro label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: var(--texto-2); overflow: hidden; text-overflow: ellipsis; }
        .fm-input { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
        
        .fm-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; }
        .fm-btn-acao:hover { background: #004494; }
        .fm-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .fm-btn { padding: 6px 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 13px; }
        
        .fm-aviso-xfa { background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 12px; border-radius: 4px; font-size: 13px; border: 1px solid rgba(255, 193, 7, 0.4); margin-bottom: 16px; }
        
        /* Modal Livre */
        .fm-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: none; flex-direction: column; }
        .fm-modal-topbar { background: var(--cor-primaria); color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
        .fm-modal-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: auto; position: relative; }
        .fm-editor-wrapper { position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: inline-block; background: var(--sup); }
        .fm-editor-canvas { display: block; }
        .fm-editor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        
        .fm-item-livre { position: absolute; border: 1px dashed transparent; cursor: move; display: flex; align-items: center; font-family: Helvetica, sans-serif; }
        .fm-item-livre:hover, .fm-item-livre.ativo { border-color: var(--cor-primaria); background: rgba(0, 123, 255, 0.05); }
        .fm-del { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: var(--cor-erro); color: white; border-radius: 50%; text-align: center; line-height: 20px; font-size: 12px; font-weight: bold; cursor: pointer; display: none; }
        .fm-item-livre.ativo .fm-del { display: block; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="fm-tela-inicial"></div>
      <div id="fm-tela-trabalho" style="display:none;" class="fm-layout">
        <div class="fm-main">
          
          <div id="fm-aviso-xfa" class="fm-aviso-xfa" style="display:none;">
            <strong>Aviso: Formulário XFA detectado.</strong><br>
            Este é um formato antigo da Adobe (LiveCycle) que não é totalmente suportado por leitores modernos fora do Acrobat. 
            Você não poderá preencher os campos estruturados, mas pode usar o modo "escrever por cima" clicando nas páginas abaixo.
          </div>
          
          <div id="fm-aviso-livre" class="fm-painel" style="display:none; background:#eaffea; color:#28a745; border-color:#b3e6b3;">
            <strong style="font-size:15px;">Modo "Escrever por Cima"</strong><br>
            <span style="font-size:14px;">Este PDF não possui campos interativos próprios. Mas não tem problema: <strong>clique em qualquer página abaixo</strong> para digitar o texto livremente onde quiser.</span>
          </div>

          <div class="fm-grade" id="fm-grade"></div>
        </div>
        
        <div class="fm-sidebar">
          <div class="fm-painel" id="fm-painel-campos" style="display:none; max-height: 600px; overflow-y: auto;">
            <h3 style="margin-top:0; border-bottom: 1px solid var(--borda); padding-bottom:8px; position:sticky; top:0; background:var(--sup-2);">Campos do PDF</h3>
            <div id="fm-lista-campos"></div>
          </div>

          <div class="fm-painel">
            <h3 style="margin-top:0; border-bottom: 1px solid var(--borda); padding-bottom:8px;">Finalizar</h3>
            
            <div id="box-achatar" style="margin-bottom:16px; display:none;">
              <label style="display:flex; gap:8px; font-weight:bold; font-size:14px; align-items:center;">
                <input type="checkbox" id="fm-achatar" checked>
                Achatar Formulário (Recomendado)
              </label>
              <div style="font-size:11px; color: var(--texto-2); margin-top:4px;">
                Converte os campos em texto fixo. Impede que outra pessoa modifique o que você preencheu.
              </div>
            </div>

            <button class="fm-btn-acao" id="btn-gerar">Salvar Documento</button>
            <div id="fm-progresso" style="margin-top:16px;"></div>
            <div id="fm-resultado" style="display:none; margin-top:16px;">
              <div style="font-size:13px; color:var(--cor-sucesso); font-weight:bold; margin-bottom:8px;">✅ Concluído! Baixado automaticamente.</div>
              <button id="btn-fm-baixar-novamente" class="pdf-btn-principal" style="margin-top:0;">Baixar Novamente</button>
              <div id="fm-proximos-passos" style="margin-top:16px;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Modo Livre -->
      <div id="fm-modal" class="fm-modal-overlay">
        <div class="fm-modal-topbar">
          <div style="font-size:16px; font-weight:bold;">Preenchendo Página <span id="fm-modal-pagina"></span></div>
          <div style="display:flex; gap:16px; align-items:center;">
            <select id="fm-cor-livre" class="fm-input" style="width:auto; padding:4px;">
              <option value="#000000">Tinta Preta</option>
              <option value="#0000FF">Tinta Azul</option>
            </select>
            <button class="fm-btn" id="btn-fm-add-txt">📝 Adicionar Texto</button>
            <button class="fm-btn" id="btn-fm-add-x">❌ Marcar X</button>
            <button class="fm-btn" id="btn-fm-add-v">✔️ Marcar ✓</button>
            <button class="fm-btn" style="background:var(--cor-primaria); color:white; border-color:var(--cor-primaria);" id="btn-fm-fechar">Concluir</button>
          </div>
        </div>
        <div class="fm-modal-body" id="fm-modal-body">
          <div class="fm-editor-wrapper" id="fm-wrapper">
            <canvas class="fm-editor-canvas" id="fm-canvas"></canvas>
            <div class="fm-editor-layer" id="fm-layer"></div>
          </div>
        </div>
      </div>
    `;

    const drop = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf', onArquivos: a => abrirArquivo(a[0]) });
    container.querySelector('#fm-tela-inicial').appendChild(drop);
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#fm-progresso').appendChild(progresso.elemento);

    let visaoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) renderizarMiniatura(entry.target); });
    }, { rootMargin: '200px' });

    async function abrirArquivo(file) {
      fileOrig = file;
      container.querySelector('#fm-tela-inicial').innerHTML = '<div style="text-align:center; padding:40px;">Carregando estrutura...</div>';
      try {
        await PDFTools.carregarLib('pdfjs');
        await PDFTools.carregarLib('pdf-lib');
        
        arqBuffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: arqBuffer.slice(0) }).promise;
        numPages = pdfDocJs.numPages;
        pdfDocLib = await window.PDFLib.PDFDocument.load(arqBuffer, { ignoreEncryption: true });
        
        anotacoesLivre = {};
        for(let i=0; i<numPages; i++) anotacoesLivre[i] = [];

        const form = pdfDocLib.getForm();
        hasXfa = form.hasXFA();
        camposAcro = form.getFields();
        hasAcro = camposAcro.length > 0 && !hasXfa;

        container.querySelector('#fm-tela-inicial').style.display = 'none';
        container.querySelector('#fm-tela-trabalho').style.display = 'flex';
        
        if (hasXfa) container.querySelector('#fm-aviso-xfa').style.display = 'block';
        
        if (hasAcro) {
          container.querySelector('#fm-painel-campos').style.display = 'block';
          container.querySelector('#box-achatar').style.display = 'block';
          montarFormularioAcro(form);
        } else {
          container.querySelector('#fm-aviso-livre').style.display = 'block';
        }
        
        renderizarGrade();
      } catch (e) {
        if (e.message && e.message.includes('encrypted')) container.querySelector('#fm-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        else container.querySelector('#fm-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido', e.message);
      }
    }

    function escapeHTML(str) {
      if (!str) return '';
      return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[tag] || tag));
    }

    function montarFormularioAcro(form) {
      const { PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFOptionList } = window.PDFLib;
      const box = container.querySelector('#fm-lista-campos');
      box.innerHTML = '';
      
      camposAcro.forEach((campo, i) => {
        const div = document.createElement('div');
        div.className = 'fm-campo-acro';
        const nomeOrig = campo.getName();
        const nome = escapeHTML(nomeOrig);
        const readOnly = campo.isReadOnly();
        
        let labelHTML = `<label title="${nome}">${nome} ${readOnly ? '(Somente Leitura)' : ''}</label>`;
        let inputHTML = '';
        
        if (campo instanceof PDFTextField) {
          const val = escapeHTML(campo.getText() || '');
          const multi = campo.isMultiline();
          if (multi) inputHTML = `<textarea class="fm-input" id="fm-c-${i}" rows="3" ${readOnly?'disabled':''}>${val}</textarea>`;
          else inputHTML = `<input type="text" class="fm-input" id="fm-c-${i}" value="${val}" ${readOnly?'disabled':''}>`;
        } 
        else if (campo instanceof PDFCheckBox) {
          const isCheck = campo.isChecked();
          inputHTML = `<label><input type="checkbox" id="fm-c-${i}" ${isCheck?'checked':''} ${readOnly?'disabled':''}> Marcado</label>`;
        }
        else if (campo instanceof PDFDropdown || campo instanceof PDFOptionList) {
          const opcoes = campo.getOptions();
          const sel = campo.getSelected();
          inputHTML = `<select class="fm-input" id="fm-c-${i}" ${readOnly?'disabled':''}>`;
          inputHTML += `<option value="">(Selecione)</option>`;
          opcoes.forEach(opt => {
             const optEsc = escapeHTML(opt);
             // sel.includes(opt) is safe as opt is the original value
             inputHTML += `<option value="${optEsc}" ${sel.includes(opt)?'selected':''}>${optEsc}</option>`;
          });
          inputHTML += `</select>`;
        }
        else if (campo instanceof PDFRadioGroup) {
          const opcoes = campo.getOptions();
          const sel = campo.getSelected();
          inputHTML = `<div style="display:flex; flex-direction:column; gap:4px;">`;
          opcoes.forEach((opt, idx) => {
            const optEsc = escapeHTML(opt);
            inputHTML += `<label><input type="radio" name="fm-r-${i}" value="${optEsc}" ${opt===sel?'checked':''} ${readOnly?'disabled':''}> ${optEsc}</label>`;
          });
          inputHTML += `</div>`;
        }
        
        div.innerHTML = labelHTML + inputHTML;
        box.appendChild(div);
      });
    }

    // -- Modo Livre UI --
    function renderizarGrade() {
      const grade = container.querySelector('#fm-grade');
      grade.innerHTML = '';
      visaoObserver.disconnect();
      for(let i=0; i<numPages; i++) {
        const el = document.createElement('div');
        el.className = 'fm-pagina';
        el.dataset.index = i;
        el.innerHTML = `<div class="fm-pagina-header">Página ${i + 1}</div><div class="fm-thumb-container"></div><div class="fm-badge">Editada</div>`;
        el.onclick = () => abrirEditorLivre(i);
        grade.appendChild(el);
        visaoObserver.observe(el);
      }
      atualizarBadges();
    }

    function atualizarBadges() {
      for(let i=0; i<numPages; i++) {
        const el = container.querySelector(`.fm-pagina[data-index="${i}"]`);
        if(el) el.querySelector('.fm-badge').style.display = (anotacoesLivre[i] && anotacoesLivre[i].length > 0) ? 'block' : 'none';
      }
    }

    async function renderizarMiniatura(el) {
      if (el.dataset.rendered) return;
      el.dataset.rendered = "true";
      const index = parseInt(el.dataset.index);
      try {
        const page = await pdfDocJs.getPage(index + 1);
        const viewport = page.getViewport({ scale: 0.25 }); 
        const cvs = document.createElement('canvas');
        cvs.width = viewport.width; cvs.height = viewport.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport }).promise;
        el.querySelector('.fm-thumb-container').appendChild(cvs);
      } catch(e){}
    }

    const modal = container.querySelector('#fm-modal');
    const layer = container.querySelector('#fm-layer');
    const cvsEditor = container.querySelector('#fm-canvas');

    async function abrirEditorLivre(index) {
      paginaAtualModal = index;
      container.querySelector('#fm-modal-pagina').textContent = index + 1;
      modal.style.display = 'flex';
      layer.innerHTML = '';
      
      const page = await pdfDocJs.getPage(index + 1);
      const viewportRef = page.getViewport({ scale: 1.0 });
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.8;
      const scale = Math.min(maxWidth/viewportRef.width, maxHeight/viewportRef.height, 1.5);
      
      const viewport = page.getViewport({ scale });
      cvsEditor.width = viewport.width; cvsEditor.height = viewport.height;
      const ctx = cvsEditor.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,cvsEditor.width, cvsEditor.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      
      renderizarItensLivre();
    }

    function renderizarItensLivre() {
      layer.innerHTML = '';
      const lista = anotacoesLivre[paginaAtualModal] || [];
      const w = cvsEditor.width, h = cvsEditor.height;
      
      lista.forEach((item, idx) => {
        const el = document.createElement('div');
        el.className = 'fm-item-livre';
        el.style.left = (item.x * w) + 'px';
        el.style.top = (item.y * h) + 'px';
        el.style.fontSize = (item.s * h) + 'px'; // size em percentual
        el.style.color = item.c;
        el.textContent = item.txt;
        
        const del = document.createElement('div'); del.className = 'fm-del'; del.textContent = '✕';
        del.onclick = (e) => { e.stopPropagation(); anotacoesLivre[paginaAtualModal].splice(idx,1); renderizarItensLivre(); };
        el.appendChild(del);
        
        // Drag
        el.onmousedown = (e) => startDragLivre(e, idx, el);
        el.ontouchstart = (e) => startDragLivre(e, idx, el);
        
        layer.appendChild(el);
      });
    }

    let dragLivre = null;
    function startDragLivre(e, idx, el) {
      if (e.target.classList.contains('fm-del')) return;
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.fm-item-livre').forEach(el=>el.classList.remove('ativo'));
      el.classList.add('ativo');
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      dragLivre = { idx, startX: cx, startY: cy, initL: parseFloat(el.style.left), initT: parseFloat(el.style.top) };
    }
    
    layer.onmousemove = (e) => {
      if (!dragLivre) return;
      e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const el = layer.children[dragLivre.idx];
      el.style.left = dragLivre.initL + (cx - dragLivre.startX) + 'px';
      el.style.top = dragLivre.initT + (cy - dragLivre.startY) + 'px';
    };
    layer.ontouchmove = layer.onmousemove;
    
    function endDragLivre(e) {
      if (!dragLivre) {
        if(e.target === layer) document.querySelectorAll('.fm-item-livre').forEach(el=>el.classList.remove('ativo'));
        return;
      }
      const el = layer.children[dragLivre.idx];
      anotacoesLivre[paginaAtualModal][dragLivre.idx].x = parseFloat(el.style.left) / cvsEditor.width;
      anotacoesLivre[paginaAtualModal][dragLivre.idx].y = parseFloat(el.style.top) / cvsEditor.height;
      dragLivre = null;
    }
    layer.onmouseup = endDragLivre; layer.onmouseleave = endDragLivre; layer.ontouchend = endDragLivre; layer.onclick = endDragLivre;

    container.querySelector('#btn-fm-add-txt').onclick = () => {
      const txt = prompt('Digite o texto:');
      if (txt) {
        anotacoesLivre[paginaAtualModal].push({ txt, x: 0.4, y: 0.5, s: 0.02, c: container.querySelector('#fm-cor-livre').value });
        renderizarItensLivre();
      }
    };
    container.querySelector('#btn-fm-add-x').onclick = () => {
      anotacoesLivre[paginaAtualModal].push({ txt: 'X', x: 0.4, y: 0.5, s: 0.03, c: container.querySelector('#fm-cor-livre').value });
      renderizarItensLivre();
    };
    container.querySelector('#btn-fm-add-v').onclick = () => {
      anotacoesLivre[paginaAtualModal].push({ txt: '✓', x: 0.4, y: 0.5, s: 0.03, c: container.querySelector('#fm-cor-livre').value });
      renderizarItensLivre();
    };
    container.querySelector('#btn-fm-fechar').onclick = () => {
      modal.style.display = 'none';
      atualizarBadges();
    };

    // --- GERAR FINAL ---
    container.querySelector('#btn-gerar').onclick = async () => {
      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;
      try {
        const { PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, StandardFonts, rgb, degrees } = window.PDFLib;
        const form = pdfDocLib.getForm();
        
        // Aplica os valores dos inputs do AcroForm
        if (hasAcro) {
          camposAcro.forEach((campo, i) => {
            if (campo.isReadOnly()) return;
            try {
              if (campo instanceof PDFTextField) {
                const el = container.querySelector(`#fm-c-${i}`);
                if(el) campo.setText(el.value);
              } else if (campo instanceof PDFCheckBox) {
                const el = container.querySelector(`#fm-c-${i}`);
                if(el) { if(el.checked) campo.check(); else campo.uncheck(); }
              } else if (campo instanceof PDFDropdown) {
                const el = container.querySelector(`#fm-c-${i}`);
                if(el && el.value) campo.select(el.value);
              } else if (campo instanceof PDFRadioGroup) {
                const els = container.querySelectorAll(`input[name="fm-r-${i}"]:checked`);
                if(els.length > 0) campo.select(els[0].value);
              }
            } catch(ex) { console.warn('Erro ao setar campo', campo.getName(), ex); }
          });
          
          if (container.querySelector('#fm-achatar').checked) form.flatten();
        }

        // Aplica o Modo Livre
        let hasModoLivre = Object.values(anotacoesLivre).flat().length > 0;
        if (hasModoLivre) {
          const font = await pdfDocLib.embedFont(StandardFonts.Helvetica);
          
          for (let i = 0; i < numPages; i++) {
            const itens = anotacoesLivre[i];
            if (!itens || itens.length === 0) continue;
            
            const page = pdfDocLib.getPage(i);
            const rawSize = page.getSize();
            const R = (page.getRotation().angle % 360 + 360) % 360;
            // O canvas do editor vem do pdf.js, que já leva /Rotate em conta: item.x/y são
            // frações da dimensão VISUAL da página, não da bruta.
            const { width: visW, height: visH } = PDFTools.dimensoesVisuais(rawSize.width, rawSize.height, R);

            for (const item of itens) {
              const crgb = hexToRgb(item.c);
              const visX = item.x * visW;
              const visYTopo = item.y * visH;
              const fSize = item.s * visH;

              const t = PDFTools.posicaoRotacionada(visX, visYTopo, 0, fSize, rawSize.width, rawSize.height, R);

              page.drawText(item.txt, {
                x: t.x, y: t.y + (fSize * 0.2), // baseline
                size: fSize,
                font,
                color: rgb(crgb.r, crgb.g, crgb.b),
                rotate: degrees(t.rotate)
              });
            }
          }
        }
        
        progresso.atualizar(90, 'Salvando...');
        await new Promise(r=>setTimeout(r,50));
        
        // Limpar meta é lei
        pdfDocLib.setTitle(''); pdfDocLib.setAuthor(''); pdfDocLib.setCreator(''); pdfDocLib.setProducer('');
        
        const bytes = await pdfDocLib.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const nome = PDFTools.nomeSemExtensao(fileOrig.name) + '-preenchido.pdf';
        PDFTools.baixar(blob, nome);
        PDFTools.UI.mostrarToast('Formulário salvo com sucesso!', 'sucesso');

        const resArea = container.querySelector('#fm-resultado');
        resArea.style.display = 'block';
        container.querySelector('#btn-fm-baixar-novamente').onclick = () => PDFTools.baixar(blob, nome);
        const proxContainer = container.querySelector('#fm-proximos-passos');
        proxContainer.innerHTML = '';
        const prox = PDFTools.UI.criarProximosPassos({
          blob, nomeArquivo: nome, origemId: 'preencher_form', tamanhoBytes: blob.size
        });
        if (prox) proxContainer.appendChild(prox);
        PDFTools.registrarAcaoSessao('Preencheu o formulário');

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

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : {r:0,g:0,b:0};
}
