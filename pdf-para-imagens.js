PDFTools.registrar({
  id: 'pdf_para_imagens',
  nome: 'PDF para Imagens',
  descricao: 'Transforme páginas em arquivos JPG ou PNG para enviar no WhatsApp, redes sociais ou gráficas.',
  precisa: ['pdfjs'],
  montarUI: function(container, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let numPages = 0;
    
    // Set de páginas selecionadas. Padrão: todas.
    let pagsSelecionadas = new Set();
    let dimsBase = []; // {w, h} em 72 DPI para cada página

    if (!document.getElementById('css-img')) {
      const style = document.createElement('style');
      style.id = 'css-img';
      style.textContent = `
        .im-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .im-main { flex: 1; min-width: 300px; }
        .im-sidebar { width: 320px; flex-shrink: 0; }
        .im-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        
        .im-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 12px; overflow-y: auto; max-height: 500px; padding: 8px; background: var(--sup-2); border-radius: 8px; }
        .im-pagina { background: var(--sup); box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; position: relative; cursor: pointer; transition: transform 0.2s; border: 2px solid transparent; }
        .im-pagina.sel { border-color: var(--cor-primaria); background: #f0f7ff; }
        .im-pagina-header { font-size: 12px; padding: 4px; text-align: center; font-weight: bold; background: var(--sup-2); border-bottom: 1px solid var(--borda); color: var(--texto-2); }
        .im-thumb { width: 100%; height: 140px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .im-thumb canvas { max-width: 100%; max-height: 100%; object-fit: contain; }
        .im-badge { position: absolute; top: 4px; right: 4px; background: var(--cor-primaria); color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; font-weight: bold; display: none; align-items:center; justify-content:center; }
        .im-pagina.sel .im-badge { display: flex; }

        .im-campo { margin-bottom: 12px; }
        .im-campo label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: var(--texto-2); }
        .im-input { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
        
        .im-aviso { background: #eaffea; color: #28a745; padding: 12px; border-radius: 4px; font-size: 12px; border: 1px solid #b3e6b3; margin-top: 16px; }
        .im-alerta { background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 12px; border-radius: 4px; font-size: 12px; border: 1px solid rgba(255, 193, 7, 0.4); margin-top: 8px; display:none; }
        
        .im-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; }
        .im-btn-acao:hover { background: #004494; }
        .im-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .im-btn-link { background: none; border: none; color: var(--cor-primaria); cursor: pointer; font-size: 13px; text-decoration: underline; padding: 0; margin-bottom: 12px; }
        .im-btn-link-sm { background: none; border: none; color: var(--cor-primaria); cursor: pointer; font-size: 12px; text-decoration: underline; padding: 0; margin-left: 6px; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="im-tela-inicial"></div>
      <div id="im-tela-trabalho" style="display:none;" class="im-layout">
        <div class="im-main">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0;">Páginas para Exportar</h3>
            <div>
              <button class="im-btn-link" id="btn-im-sel-todas" style="margin-right:12px;">Selecionar Todas</button>
              <button class="im-btn-link" id="btn-im-sel-nenhuma">Desmarcar Todas</button>
            </div>
          </div>
          <div class="im-grade" id="im-grade"></div>
        </div>
        
        <div class="im-sidebar">
          <div class="im-painel">
            <h3 style="margin-top:0; border-bottom: 1px solid var(--borda); padding-bottom:8px;">Formato</h3>
            
            <div class="im-campo">
              <label>Tipo de Arquivo</label>
              <select id="im-formato" class="im-input">
                <option value="image/jpeg" selected>JPG (Menor, padrão)</option>
                <option value="image/png">PNG (Sem perda, gráfico/texto)</option>
                <option value="image/webp">WebP (Moderno, leve)</option>
              </select>
            </div>
            
            <div class="im-campo" id="box-qualidade">
              <label>Qualidade JPG/WebP</label>
              <input type="range" id="im-qualidade" min="10" max="100" value="90" style="width:100%;">
            </div>

            <div class="im-campo">
              <label>Resolução (DPI)</label>
              <select id="im-dpi" class="im-input">
                <option value="72">72 DPI (Rápido, apenas tela)</option>
                <option value="150" selected>150 DPI (Bom equilíbrio)</option>
                <option value="300">300 DPI (Alta qualidade, impressão)</option>
              </select>
              <div id="im-estimativa" style="font-size:12px; color: var(--texto-2); margin-top:4px; font-weight:bold;">Tamanho base: calculando...</div>
            </div>
            
            <div class="im-campo" style="margin-top:16px;">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="im-modo-unica">
                Gerar Imagem Única Longa
              </label>
              <div style="font-size:11px; color: var(--texto-2); font-weight:normal;">Junta as páginas verticalmente (ótimo para chat/rede social).</div>
            </div>
            
            <div id="im-alerta-canvas" class="im-alerta">
              ⚠️ <strong>Muitas páginas em alta resolução.</strong><br>
              O navegador travará ao gerar uma imagem tão gigante de uma vez. O arquivo será dividido em blocos de segurança automaticamente.
            </div>
            
            <div id="im-alerta-memoria" class="im-alerta" style="margin-top:16px; margin-bottom: 8px;"></div>

            <div id="box-saida-multipla" style="display:none; background: var(--sup); padding:12px; border-radius:4px; margin-top:16px; margin-bottom:8px; border: 1px solid var(--borda);">
              <div style="font-size:13px; font-weight:bold; margin-bottom:8px;">Isso vai gerar <span id="im-qtd-arquivos">0</span> arquivos.</div>
              <label style="display:block; font-size:13px; margin-bottom:6px;">
                <input type="radio" name="im_saida" id="im_saida_zip" value="zip" checked> Baixar em um .zip (recomendado)
              </label>
              <label style="display:block; font-size:13px;">
                <input type="radio" name="im_saida" id="im_saida_sep" value="separados"> Baixar separados
              </label>
              <div id="im-aviso-separados" style="font-size:11px; color: #d32f2f; margin-top:6px; display:none;">
                O navegador vai pedir permissão e pode bloquear os últimos arquivos.
              </div>
            </div>

            <hr style="border:0; border-top: 1px solid var(--borda); margin:16px 0;">
            <button class="im-btn-acao" id="btn-gerar">Baixar Imagens</button>
            <div id="im-progresso" style="margin-top:16px;"></div>
          </div>
        </div>
      </div>
    `;

    const drop = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf', onArquivos: a => abrirArquivo(a[0]) });
    container.querySelector('#im-tela-inicial').appendChild(drop);
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#im-progresso').appendChild(progresso.elemento);

    let visaoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) renderizarMiniatura(entry.target); });
    }, { rootMargin: '200px' });

    async function abrirArquivo(file) {
      fileOrig = file;
      container.querySelector('#im-tela-inicial').innerHTML = '<div style="text-align:center; padding:40px;">Carregando...</div>';
      try {
        await PDFTools.carregarLib('pdfjs');
        const buffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        numPages = pdfDocJs.numPages;
        
        pagsSelecionadas = new Set();
        dimsBase = [];
        
        // Pega as dimensões base 72 DPI de todas as páginas rápido
        for(let i=1; i<=numPages; i++) {
          pagsSelecionadas.add(i-1);
          const p = await pdfDocJs.getPage(i);
          const vp = p.getViewport({scale:1});
          dimsBase.push({w: vp.width, h: vp.height});
        }
        
        container.querySelector('#im-tela-inicial').style.display = 'none';
        container.querySelector('#im-tela-trabalho').style.display = 'flex';
        renderizarGrade();
        atualizarEstimativa();
      } catch (e) {
        if (e.name === 'PasswordException') container.querySelector('#im-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        else container.querySelector('#im-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido', e.message);
      }
    }

    function renderizarGrade() {
      const grade = container.querySelector('#im-grade');
      grade.innerHTML = '';
      visaoObserver.disconnect();
      
      for(let i=0; i<numPages; i++) {
        const el = document.createElement('div');
        el.className = 'im-pagina sel';
        el.dataset.index = i;
        el.innerHTML = `
          <div class="im-pagina-header">Página ${i + 1}</div>
          <div class="im-thumb"></div>
          <div class="im-badge">✓</div>
        `;
        el.onclick = () => {
          if (pagsSelecionadas.has(i)) { pagsSelecionadas.delete(i); el.classList.remove('sel'); }
          else { pagsSelecionadas.add(i); el.classList.add('sel'); }
          atualizarEstimativa();
        };
        grade.appendChild(el);
        visaoObserver.observe(el);
      }
    }

    async function renderizarMiniatura(el) {
      if (el.dataset.rendered) return;
      el.dataset.rendered = "true";
      const index = parseInt(el.dataset.index);
      try {
        const page = await pdfDocJs.getPage(index + 1);
        const viewport = page.getViewport({ scale: 0.25 }); 
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        el.querySelector('.im-thumb').appendChild(canvas);
      } catch(e) {}
    }

    container.querySelector('#btn-im-sel-todas').onclick = () => {
      for(let i=0; i<numPages; i++) pagsSelecionadas.add(i);
      container.querySelectorAll('.im-pagina').forEach(el => el.classList.add('sel'));
      atualizarEstimativa();
    };
    container.querySelector('#btn-im-sel-nenhuma').onclick = () => {
      pagsSelecionadas.clear();
      container.querySelectorAll('.im-pagina').forEach(el => el.classList.remove('sel'));
      atualizarEstimativa();
    };

    container.querySelector('#im-formato').onchange = (e) => {
      container.querySelector('#box-qualidade').style.display = e.target.value === 'image/png' ? 'none' : 'block';
      atualizarEstimativa();
    };

    container.querySelector('#im-dpi').onchange = atualizarEstimativa;
    container.querySelector('#im-modo-unica').onchange = atualizarEstimativa;
    
    const radioZip = container.querySelector('#im_saida_zip');
    const radioSep = container.querySelector('#im_saida_sep');
    const avisoSep = container.querySelector('#im-aviso-separados');
    
    function aoMudarSaida() {
      avisoSep.style.display = (radioSep.checked && pagsSelecionadas.size >= 6 && !container.querySelector('#im-modo-unica').checked) ? 'block' : 'none';
    }
    radioZip.onchange = aoMudarSaida;
    radioSep.onchange = aoMudarSaida;

    window.selecionarLotePgs = function(inicio, fim) {
      pagsSelecionadas.clear();
      container.querySelectorAll('.im-pagina').forEach(el => el.classList.remove('sel'));
      for(let i=inicio-1; i<fim && i<numPages; i++) {
        pagsSelecionadas.add(i);
        const el = container.querySelector(`.im-pagina[data-index="${i}"]`);
        if(el) el.classList.add('sel');
      }
      atualizarEstimativa();
    };

    function atualizarEstimativa() {
      if(pagsSelecionadas.size === 0) {
        container.querySelector('#im-estimativa').textContent = 'Nenhuma página selecionada.';
        container.querySelector('#im-alerta-canvas').style.display = 'none';
        container.querySelector('#im-alerta-memoria').style.display = 'none';
        container.querySelector('#box-saida-multipla').style.display = 'none';
        return;
      }
      
      const dpi = parseInt(container.querySelector('#im-dpi').value);
      const scale = dpi / 72;
      const fst = Array.from(pagsSelecionadas)[0];
      const exW = Math.round(dimsBase[fst].w * scale);
      const exH = Math.round(dimsBase[fst].h * scale);
      
      const formato = container.querySelector('#im-formato').value;
      const fator = formato === 'image/jpeg' ? 0.15 : (formato === 'image/webp' ? 0.1 : 0.4);
      const totalBytes = exW * exH * 4 * pagsSelecionadas.size * fator;
      const totalMb = (totalBytes / (1024*1024)).toFixed(1);
      
      container.querySelector('#im-estimativa').textContent = `${dpi} DPI ≈ ${exW} × ${exH} px (${totalMb} MB total)`;
      
      const modoLonga = container.querySelector('#im-modo-unica').checked;
      
      let avisoHTML = '';
      let travar = false;
      if (pagsSelecionadas.size > 50) {
         avisoHTML += `<div style="margin-bottom:8px;">Este PDF tem <strong>${numPages}</strong> páginas. Em <strong>${dpi} DPI</strong> o resultado terá cerca de <strong>${totalMb} MB</strong> no total. A renderização é feita pelo seu navegador e pode levar alguns minutos.</div>`;
      }
      if (pagsSelecionadas.size > 300) {
         avisoHTML += `<div>Documentos deste tamanho podem consumir muita memória, principalmente em celular. Considere converter um intervalo de páginas por vez. <button class="im-btn-link-sm" onclick="selecionarLotePgs(1, 100)">Selecionar 1-100</button></div>`;
      }
      if (totalBytes > 500 * 1024 * 1024) { 
         avisoHTML = `⚠️ <strong>Risco de travamento!</strong> A exportação de ${pagsSelecionadas.size} páginas consumirá mais de 500MB de memória e fechará a aba do navegador. <br><br><button class="im-btn-link-sm" onclick="selecionarLotePgs(1, 100)">Selecione apenas as primeiras 100 páginas para prosseguir</button>`;
         travar = true;
      }
      
      const elAvisoMem = container.querySelector('#im-alerta-memoria');
      if (avisoHTML && !modoLonga) {
        elAvisoMem.innerHTML = avisoHTML;
        elAvisoMem.style.display = 'block';
      } else {
        elAvisoMem.style.display = 'none';
      }
      
      container.querySelector('#btn-gerar').disabled = travar;
      
      if (!modoLonga && pagsSelecionadas.size > 1) {
         container.querySelector('#box-saida-multipla').style.display = 'block';
         container.querySelector('#im-qtd-arquivos').textContent = pagsSelecionadas.size;
         if (pagsSelecionadas.size >= 6) {
            radioZip.checked = true;
         } else {
            radioSep.checked = true;
         }
         aoMudarSaida();
      } else {
         container.querySelector('#box-saida-multipla').style.display = 'none';
      }

      if (modoLonga) {
        let totalH = 0;
        Array.from(pagsSelecionadas).forEach(i => totalH += Math.round(dimsBase[i].h * scale));
        if (totalH > 15000) container.querySelector('#im-alerta-canvas').style.display = 'block';
        else container.querySelector('#im-alerta-canvas').style.display = 'none';
      } else {
        container.querySelector('#im-alerta-canvas').style.display = 'none';
      }
    }

    // Gerador
    container.querySelector('#btn-gerar').onclick = async () => {
      if (pagsSelecionadas.size === 0) return alert('Selecione pelo menos uma página.');
      
      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;
      const formato = container.querySelector('#im-formato').value;
      const ext = formato.split('/')[1] === 'jpeg' ? 'jpg' : formato.split('/')[1];
      const qual = parseFloat(container.querySelector('#im-qualidade').value) / 100;
      const dpi = parseInt(container.querySelector('#im-dpi').value);
      const scale = dpi / 72;
      const modoLonga = container.querySelector('#im-modo-unica').checked;
      const nomeArq = PDFTools.nomeSemExtensao(fileOrig.name);
      
      const pIdx = Array.from(pagsSelecionadas).sort((a,b)=>a-b);
      
      try {
        if (!modoLonga) {
          // Exportação Individual ou ZIP
          const querZip = radioZip.checked && pagsSelecionadas.size > 1;
          const blobsArr = [];

          for(let k=0; k<pIdx.length; k++) {
            const i = pIdx[k];
            progresso.atualizar((k/pIdx.length)*100, querZip ? `Renderizando página ${i+1} de ${pIdx.length}...` : `Baixando ${k+1} de ${pIdx.length}...`);
            await new Promise(r => setTimeout(r, 50)); // respiro pro navegador
            
            const page = await pdfDocJs.getPage(i + 1);
            const vp = page.getViewport({ scale });
            const cvs = document.createElement('canvas');
            cvs.width = vp.width; cvs.height = vp.height;
            const ctx = cvs.getContext('2d');
            
            // Fundo branco (PDF não tem fundo em páginas padrão)
            if(formato === 'image/jpeg') { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,cvs.width,cvs.height); }
            
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            
            const blob = await new Promise(r => cvs.toBlob(b => r(b), formato, qual));
            cvs.width = 0; cvs.height = 0; // libera memória urgente!
            
            const pagFormatada = String(i+1).padStart(numPages.toString().length > 1 ? 2 : 1, '0');
            const nm = `${nomeArq}-pagina-${pagFormatada}.${ext}`;
            
            if (querZip) {
              blobsArr.push({ nome: nm, blob: blob });
            } else {
              PDFTools.baixar(blob, nm);
            }
          }
          
          if (querZip) {
            const zipBlob = await PDFTools.gerarZip(blobsArr, (pct, txt) => progresso.atualizar(pct, txt));
            PDFTools.baixar(zipBlob, `${nomeArq}-paginas.zip`);
          }
        } else {
          // Imagem Única Longa (com split de segurança)
          const SAFE_H = 15000;
          let blocoCvs = null, ctx = null;
          let atualH = 0, totalH = 0;
          let blocoIdx = 1;
          
          for(let k=0; k<pIdx.length; k++) {
            const i = pIdx[k];
            progresso.atualizar((k/pIdx.length)*100, `Pintando página ${i+1} no bloco...`);
            await new Promise(r => setTimeout(r, 50));
            
            const page = await pdfDocJs.getPage(i + 1);
            const vp = page.getViewport({ scale });
            
            if (!blocoCvs) {
              blocoCvs = document.createElement('canvas');
              blocoCvs.width = Math.round(Math.max(...pIdx.map(idx => dimsBase[idx].w * scale)));
              // Calcula altura desse bloco até SAFE_H ou fim
              let hRestante = 0;
              for(let z=k; z<pIdx.length; z++) {
                hRestante += Math.round(dimsBase[pIdx[z]].h * scale);
                if (hRestante > SAFE_H) break;
              }
              blocoCvs.height = Math.min(hRestante, SAFE_H);
              ctx = blocoCvs.getContext('2d');
              if(formato === 'image/jpeg') { ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,blocoCvs.width,blocoCvs.height); }
            }
            
            // Se passar da altura do bloco, salva e recomeça (k-1 para renderizar a mesma folha no próximo bloco)
            if (atualH + vp.height > blocoCvs.height + 10) { // +10 folga
              progresso.atualizar(100, `Baixando parte ${blocoIdx}...`);
              const blob = await new Promise(r => blocoCvs.toBlob(b => r(b), formato, qual));
              PDFTools.baixar(blob, `${nomeArq}-completo-parte${blocoIdx}.${ext}`);
              blocoCvs.width = 0; blocoCvs.height = 0; blocoCvs = null;
              atualH = 0; blocoIdx++; k--;
              continue;
            }
            
            // Desenha a página
            const tempCvs = document.createElement('canvas');
            tempCvs.width = vp.width; tempCvs.height = vp.height;
            const tempCtx = tempCvs.getContext('2d');
            if(formato === 'image/jpeg') { tempCtx.fillStyle='#ffffff'; tempCtx.fillRect(0,0,tempCvs.width,tempCvs.height); }
            await page.render({ canvasContext: tempCtx, viewport: vp }).promise;
            
            // Centraliza no bloco
            const offsetX = (blocoCvs.width - vp.width) / 2;
            ctx.drawImage(tempCvs, offsetX, atualH);
            atualH += vp.height;
            
            tempCvs.width = 0; tempCvs.height = 0;
          }
          
          if (blocoCvs && atualH > 0) {
            progresso.atualizar(100, 'Baixando bloco final...');
            const finalCvs = document.createElement('canvas');
            finalCvs.width = blocoCvs.width; finalCvs.height = atualH; // corta excesso
            const fCtx = finalCvs.getContext('2d');
            if(formato === 'image/jpeg') { fCtx.fillStyle='#ffffff'; fCtx.fillRect(0,0,finalCvs.width,finalCvs.height); }
            fCtx.drawImage(blocoCvs, 0, 0);
            
            const blob = await new Promise(r => finalCvs.toBlob(b => r(b), formato, qual));
            const nm = blocoIdx > 1 ? `${nomeArq}-completo-parte${blocoIdx}.${ext}` : `${nomeArq}-longa.${ext}`;
            PDFTools.baixar(blob, nm);
            blocoCvs.width = 0; finalCvs.width = 0;
          }
        }
        
        PDFTools.UI.mostrarToast('Imagens geradas!', 'sucesso');
        
      } catch(e) {
        console.error(e);
        PDFTools.UI.mostrarToast('Erro: ' + e.message, 'erro');
      } finally {
        progresso.esconder();
        btn.disabled = false;
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);
  }
});
