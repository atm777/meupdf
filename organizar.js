// Motor compartilhado de edição de páginas, sempre focado em UMA tarefa por vez.
// Registrado como ferramentas separadas mais abaixo (hoje só "Dividir PDF"), cada uma com
// seu próprio botão na tela inicial — em vez de um único "Organizar Páginas" com tudo junto.
function montarOrganizarUI(container, foco, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let plano = []; // Estado atual: [{ id, originalIndex, rotation, selecionado }]
    let historico = [];
    let visaoObserver = null;
    let nomeOriginal = 'documento';

    if (!document.getElementById('css-organizar')) {
      const style = document.createElement('style');
      style.id = 'css-organizar';
      style.textContent = `
        .org-grid-layout { display: flex; gap: 20px; flex-wrap: wrap; }
        .org-sidebar { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }
        .org-main { flex: 1; min-width: 300px; display: flex; flex-direction: column; }
        .org-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px; }
        .org-grade-paginas { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; overflow-y: auto; max-height: 600px; padding: 8px; background: var(--sup-2); border-radius: 8px; }
        .org-pagina { background: var(--sup); box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; position: relative; cursor: pointer; user-select: none; transition: transform 0.2s; }
        .org-pagina.selecionada { box-shadow: 0 0 0 3px var(--cor-primaria) !important; }
        .org-pagina-header { font-size: 11px; padding: 4px; text-align: center; font-weight: bold; background: var(--sup-2); border-bottom: 1px solid var(--borda); color: var(--texto-2); display: flex; justify-content: space-between; }
        .org-pagina-thumb-container { width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; background: var(--sup-2); }
        .org-pagina-thumb-container canvas { max-width: 100%; max-height: 100%; object-fit: contain; transition: transform 0.3s ease; }
        .thumb-placeholder { width: 100%; height: 100%; background: var(--sup-2); display: flex; align-items: center; justify-content: center; color: #adb5bd; font-size: 24px; }
        .org-selecao-bar { display: flex; gap: 8px; padding: 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 8px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
        .org-btn { padding: 6px 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 13px; }
        .org-btn:hover { background: var(--sup-2); }
        .org-btn-acao { padding: 10px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; text-align: center; }
        .org-btn-acao:hover:not(:disabled) { background: var(--cor-primaria-hover, var(--acento-hover)); }
        .org-btn-acao:disabled { opacity: 0.45; cursor: not-allowed; background: var(--sup-2); color: var(--texto-2); }
        .org-input { padding: 6px 8px; border: 1px solid var(--borda); border-radius: 4px; font-size: 14px; background: var(--sup); color: var(--texto); }
        .org-grupo-opcoes { margin-bottom: 16px; }
        .org-grupo-opcoes label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: var(--texto); }
        .org-badge-remover { position: absolute; top: -8px; right: -8px; background: var(--cor-erro); color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; border: none; cursor: pointer; display: none; }
        .org-pagina:hover .org-badge-remover { display: block; }
        .org-pagina .org-orig { font-weight: normal; color: var(--texto-2); }
      `;
      document.head.appendChild(style);
    }

    const mostrarEdicao = foco.mostrarGirar || foco.mostrarRemover;

    const painelEdicaoHTML = mostrarEdicao ? `
      <div class="org-painel">
        <h3 style="margin-top:0; margin-bottom:16px; font-size:16px;">Edição de Páginas</h3>
        ${foco.mostrarGirar ? `
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <button class="org-btn" style="flex:1;" id="btn-girar-esq" title="Girar Anti-horário">↺ Girar Esq</button>
          <button class="org-btn" style="flex:1;" id="btn-girar-dir" title="Girar Horário">↻ Girar Dir</button>
        </div>` : ''}
        ${foco.mostrarRemover ? `
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <button class="org-btn" style="flex:1; color:var(--cor-erro);" id="btn-remover">🗑️ Remover</button>
        </div>` : ''}
        <button class="org-btn" id="btn-desfazer" style="width:100%; margin-bottom:16px;" disabled>↩️ Desfazer (Ctrl+Z)</button>
        <div style="font-size:12px; color: var(--texto-2); text-align:center;">Dica: Arraste as páginas para reordenar.</div>
      </div>
    ` : `
      <div class="org-painel">
        <button class="org-btn" id="btn-desfazer" style="width:100%;" disabled>↩️ Desfazer (Ctrl+Z)</button>
      </div>
    `;

    const explicacaoHTML = foco.explicacao ? `
      <div class="org-painel" style="margin-bottom:16px; font-size:13px; color:var(--texto-2); line-height:1.5;">
        <strong style="color:var(--texto);">Como funciona:</strong> ${foco.explicacao}
      </div>
    ` : '';

    const selecaoBarHTML = foco.mostrarSelecao ? `
      <div class="org-selecao-bar">
        <span style="font-weight:bold; font-size:14px; margin-right:8px;">Seleção:</span>
        <button class="org-btn" id="btn-sel-todas">Todas</button>
        <button class="org-btn" id="btn-sel-inv">Inverter</button>
        <button class="org-btn" id="btn-sel-par">Pares</button>
        <button class="org-btn" id="btn-sel-impar">Ímpares</button>
        <input type="text" id="input-intervalo" class="org-input" placeholder="Ex: 1-5, 8, 12" style="width: 150px;">
        <div style="flex-grow:1;"></div>
        <span id="contador-selecionadas" style="font-size:13px; font-weight:bold; color:var(--cor-primaria);">0 selecionadas</span>
      </div>
    ` : '';

    const escolhaDivisaoHTML = foco.mostrarEscolhaDivisao ? `
      <div class="org-grupo-opcoes">
        <label>Como dividir?</label>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="display:flex; align-items:center; gap:8px; font-weight:normal; font-size:13px;">
            <input type="radio" name="org-modo-divisao" id="org-modo-qtd" value="quantidade" checked>
            Por quantidade de páginas
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-weight:normal; font-size:13px;">
            <input type="radio" name="org-modo-divisao" id="org-modo-mb" value="tamanho">
            Por tamanho (MB)
          </label>
        </div>
      </div>
    ` : '';

    const paramBlocoHTML = foco.mostrarEscolhaDivisao ? `
      <div class="org-grupo-opcoes" id="org-param-qtd-wrap">
        <label>Qtd de páginas por arquivo</label>
        <input type="number" id="input-param-qtd" class="org-input" min="1" value="5">
      </div>
      <div class="org-grupo-opcoes" id="org-param-mb-wrap" style="display:none;">
        <label>Tamanho máximo (MB)</label>
        <input type="number" id="input-param-mb" class="org-input" min="1" value="10">
      </div>
    ` : (foco.paramLabel ? `
      <div class="org-grupo-opcoes">
        <label>${foco.paramLabel}</label>
        <input type="number" id="input-param" class="org-input" min="1" value="${foco.paramValor}">
      </div>
    ` : '');

    const checkUmPorPagHTML = foco.mostrarCheckUmPorPagina ? `
      <div class="org-grupo-opcoes" style="margin-top:12px;">
        <label style="display:flex; align-items:center; gap:8px; font-weight:normal; font-size: 13px;">
          <input type="checkbox" id="check-um-por-pagina">
          Gerar um arquivo por página
        </label>
      </div>
    ` : '';

    const boxZipHTML = `
      <div id="org-box-zip" style="display:none; background: var(--sup); padding:12px; border-radius:4px; margin-bottom:16px; border: 1px solid var(--borda);">
        <div style="font-size:13px; font-weight:bold; margin-bottom:8px;">Isso vai gerar <span id="org-qtd-arquivos">0</span> arquivos.</div>
        <label style="display:block; font-size:13px; margin-bottom:6px;">
          <input type="radio" name="org_saida" id="org_saida_zip" value="zip" checked> Baixar em um .zip (recomendado)
        </label>
        <label style="display:block; font-size:13px;">
          <input type="radio" name="org_saida" id="org_saida_sep" value="separados"> Baixar separados
        </label>
        <div id="org-aviso-separados" style="font-size:11px; color: var(--cor-erro); margin-top:6px; display:none;">
          O navegador vai pedir permissão e pode bloquear os últimos arquivos.
        </div>
      </div>
    `;

    container.innerHTML = `
      <div id="org-tela-inicial"></div>
      <div id="org-tela-trabalho" style="display:none;" class="org-grid-layout">
        <div class="org-main">
          ${explicacaoHTML}
          ${selecaoBarHTML}
          <div class="org-grade-paginas" id="org-grade"></div>
        </div>
        <div class="org-sidebar">
          ${painelEdicaoHTML}
          <div class="org-painel">
            <h3 style="margin-top:0; margin-bottom:16px; font-size:16px;">Exportar</h3>
            ${escolhaDivisaoHTML}
            ${paramBlocoHTML}
            ${checkUmPorPagHTML}
            ${boxZipHTML}
            <button class="org-btn-acao" id="btn-gerar" style="width:100%;">${foco.labelBotao}</button>
            <div id="org-progresso-container" style="margin-top:16px;"></div>
            <div id="org-resultado" style="display:none; margin-top:16px;">
              <div style="font-size:13px; color:var(--cor-sucesso); font-weight:bold; margin-bottom:8px;">✅ Concluído! Baixado automaticamente.</div>
              <button id="btn-org-baixar-novamente" class="pdf-btn-principal" style="margin-top:0;">Baixar Novamente</button>
              <div id="org-proximos-passos" style="margin-top:16px;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const telaInicial = container.querySelector('#org-tela-inicial');
    const telaTrabalho = container.querySelector('#org-tela-trabalho');
    const grade = container.querySelector('#org-grade');
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#org-progresso-container').appendChild(progresso.elemento);

    telaInicial.appendChild(PDFTools.UI.criarDropzone({
      multiplo: false,
      aceita: '.pdf, application/pdf',
      onArquivos: (arquivos) => abrirArquivo(arquivos[0])
    }));

    // --- LÓGICA DA INTERFACE ---

    visaoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          renderizarMiniatura(entry.target);
        }
      });
    }, { rootMargin: '200px' });

    async function abrirArquivo(file) {
      // Valida pelo header %PDF (ehPDF), não pelo file.type — um .pdf pode chegar com MIME vazio
      // ou não-padrão (compartilhar/arrastar), e antes isso era ignorado em silêncio.
      if (!(await PDFTools.ehPDF(file))) {
        telaInicial.innerHTML = PDFTools.erro('nao_e_pdf');
        return;
      }
      fileOrig = file;
      nomeOriginal = PDFTools.nomeSemExtensao(file.name);

      telaInicial.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--texto-2);">Carregando PDF e processando miniaturas...<br>Isso pode levar alguns segundos em PDFs grandes.</div>';

      try {
        await PDFTools.carregarLib('pdfjs');
        const buffer = await PDFTools.lerComoArrayBuffer(file);

        pdfDocJs = await window.pdfjsLib.getDocument({ data: buffer }).promise;

        plano = [];
        for (let i = 0; i < pdfDocJs.numPages; i++) {
          plano.push({
            id: 'p' + Math.random().toString(36).substr(2, 6),
            originalIndex: i,
            rotation: 0,
            selecionado: false
          });
        }

        salvarEstado();
        telaInicial.style.display = 'none';
        telaTrabalho.style.display = 'flex';
        renderizarGrade();

      } catch(err) {
        const cod = PDFTools.classificarErro(err);
        telaInicial.innerHTML = PDFTools.erro(cod, cod === 'desconhecido' ? (err && err.message) : null);
      }
    }

    function salvarEstado() {
      historico.push(JSON.stringify(plano));
      if (historico.length > 20) historico.shift();
      container.querySelector('#btn-desfazer').disabled = historico.length <= 1;
    }

    container.querySelector('#btn-desfazer').onclick = () => {
      if (historico.length > 1) {
        historico.pop(); // tira o estado atual
        plano = JSON.parse(historico[historico.length - 1]);
        renderizarGrade();
      }
    };

    // Ferramenta única "Dividir PDF": qual modo (quantidade x tamanho) está ativo agora,
    // e o parâmetro correspondente — usado tanto na estimativa quanto na geração final.
    function obterAcaoAtual() {
      if (!foco.mostrarEscolhaDivisao) return foco.acaoFixa;
      const radioMb = container.querySelector('#org-modo-mb');
      return (radioMb && radioMb.checked) ? 'dividir-tamanho' : 'dividir-n';
    }
    function obterParamAtual() {
      if (!foco.mostrarEscolhaDivisao) {
        const el = container.querySelector('#input-param');
        return el ? parseFloat(el.value) : null;
      }
      const el = container.querySelector(obterAcaoAtual() === 'dividir-tamanho' ? '#input-param-mb' : '#input-param-qtd');
      return el ? parseFloat(el.value) : null;
    }

    if (foco.mostrarEscolhaDivisao) {
      const radioQtd = container.querySelector('#org-modo-qtd');
      const radioMb = container.querySelector('#org-modo-mb');
      const wrapQtd = container.querySelector('#org-param-qtd-wrap');
      const wrapMb = container.querySelector('#org-param-mb-wrap');
      function aoMudarModoDivisao() {
        const ehMb = radioMb.checked;
        wrapQtd.style.display = ehMb ? 'none' : 'block';
        wrapMb.style.display = ehMb ? 'block' : 'none';
        atualizarEstimativaSaida();
      }
      radioQtd.onchange = aoMudarModoDivisao;
      radioMb.onchange = aoMudarModoDivisao;

      const inputQtd = container.querySelector('#input-param-qtd');
      if (inputQtd) inputQtd.addEventListener('input', atualizarEstimativaSaida);
    }

    const inputParam = container.querySelector('#input-param');
    const inputParamMb = container.querySelector('#input-param-mb');
    const inputTamanhoMB = foco.mostrarEscolhaDivisao ? inputParamMb : (foco.acaoFixa === 'dividir-tamanho' ? inputParam : null);
    if (inputTamanhoMB) {
      const btnManter = document.createElement('button');
      btnManter.textContent = 'Manter valor original';
      btnManter.className = 'org-btn';
      btnManter.style.display = 'none';
      btnManter.style.marginLeft = '8px';
      btnManter.style.fontSize = '12px';

      // Não mexe no display do wrap pai: no modo unificado ele também controla se o campo
      // de tamanho está visível (alternando com o de quantidade), e input+button já ficam
      // lado a lado por padrão (ambos inline-block) sem precisar forçar flex aqui.
      inputTamanhoMB.parentNode.appendChild(btnManter);

      let valorOriginal = inputTamanhoMB.value;

      inputTamanhoMB.addEventListener('focus', () => {
         valorOriginal = inputTamanhoMB.value;
      });

      inputTamanhoMB.addEventListener('blur', () => {
         if (inputTamanhoMB.value !== valorOriginal) {
            btnManter.style.display = 'inline-block';
            atualizarEstimativaSaida();
         }
      });

      btnManter.addEventListener('click', () => {
         inputTamanhoMB.value = valorOriginal;
         btnManter.style.display = 'none';
         atualizarEstimativaSaida();
      });
    }


    function aoTecladoOrganizar(e) {
      if (e.ctrlKey && e.key === 'z' && telaTrabalho.style.display !== 'none') {
        container.querySelector('#btn-desfazer').click();
      }
    }
    document.addEventListener('keydown', aoTecladoOrganizar);

    let lastSelectedIndex = null;
    let draggedIdx = null;

    function renderizarGrade() {
      grade.innerHTML = '';
      visaoObserver.disconnect();

      let selCount = 0;

      plano.forEach((p, index) => {
        if (p.selecionado) selCount++;

        const el = document.createElement('div');
        el.className = 'org-pagina' + (p.selecionado ? ' selecionada' : '');
        el.dataset.id = p.id;
        el.dataset.originalIndex = p.originalIndex;
        el.draggable = true;

        el.innerHTML = `
          <div class="org-pagina-header">
            <span>#${index + 1} <span class="org-orig">(orig ${p.originalIndex + 1})</span></span>
          </div>
          <div class="org-pagina-thumb-container">
            <div class="thumb-placeholder">${p.originalIndex + 1}</div>
          </div>
          ${foco.mostrarRemover ? '<button type="button" class="org-badge-remover" title="Remover página">✕</button>' : ''}
        `;

        if (foco.mostrarSelecao) {
          el.onclick = (e) => {
            if (e.target.classList.contains('org-badge-remover')) return;
            if (e.shiftKey && lastSelectedIndex !== null) {
              const min = Math.min(index, lastSelectedIndex);
              const max = Math.max(index, lastSelectedIndex);
              for(let i = min; i <= max; i++) plano[i].selecionado = true;
            } else {
              p.selecionado = !p.selecionado;
              lastSelectedIndex = index;
            }
            renderizarGrade();
          };
        }

        const btnRem = el.querySelector('.org-badge-remover');
        if (btnRem) {
          btnRem.onclick = (e) => {
            e.stopPropagation();
            if (plano.length <= 1) {
              return PDFTools.UI.mostrarToast('O PDF precisa de pelo menos uma página.', 'info');
            }
            salvarEstado();
            plano.splice(index, 1);
            renderizarGrade();
          };
        }

        // DRAG AND DROP (sempre disponível, independente do foco)
        el.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed='move'; draggedIdx = index; setTimeout(()=>el.style.opacity=0.5,0); });
        el.addEventListener('dragend', () => { el.style.opacity=1; grade.querySelectorAll('.org-pagina').forEach(el=>el.style.border=''); });
        el.addEventListener('dragover', e => { e.preventDefault(); el.style.borderTop = '4px solid var(--cor-primaria)'; });
        el.addEventListener('dragleave', () => { el.style.borderTop = ''; });
        el.addEventListener('drop', e => {
          e.preventDefault(); el.style.borderTop = '';
          if (draggedIdx !== null && draggedIdx !== index) {
            salvarEstado();
            const temp = plano.splice(draggedIdx, 1)[0];
            plano.splice(index, 0, temp);
            renderizarGrade();
          }
        });

        grade.appendChild(el);
        visaoObserver.observe(el);
        atualizarTransformacao(el, p);
      });

      const contadorEl = container.querySelector('#contador-selecionadas');
      if (contadorEl) contadorEl.textContent = `${selCount} selecionadas`;
      sincronizarInputIntervalo();
      atualizarEstimativaSaida();
    }

    async function renderizarMiniatura(el) {
      if (el.dataset.rendered) return;
      el.dataset.rendered = "true";
      const pData = plano.find(p => p.id === el.dataset.id);
      if (!pData) return;

      try {
        const page = await pdfDocJs.getPage(pData.originalIndex + 1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const thumbContainer = el.querySelector('.org-pagina-thumb-container');
        thumbContainer.innerHTML = '';
        thumbContainer.appendChild(canvas);
        atualizarTransformacao(el, pData);
      } catch (e) {
        console.error(e);
      }
    }

    function atualizarTransformacao(el, pData) {
      const canvas = el.querySelector('canvas');
      if (canvas) {
        canvas.style.transform = `rotate(${pData.rotation}deg)`;
      }
    }

    // --- SELEÇÃO ---
    if (foco.mostrarSelecao) {
      container.querySelector('#btn-sel-todas').onclick = () => { plano.forEach(p => p.selecionado = true); renderizarGrade(); };
      container.querySelector('#btn-sel-inv').onclick = () => { plano.forEach(p => p.selecionado = !p.selecionado); renderizarGrade(); };
      container.querySelector('#btn-sel-par').onclick = () => { plano.forEach((p,i) => p.selecionado = (i % 2 !== 0)); renderizarGrade(); };
      container.querySelector('#btn-sel-impar').onclick = () => { plano.forEach((p,i) => p.selecionado = (i % 2 === 0)); renderizarGrade(); };

      container.querySelector('#input-intervalo').addEventListener('change', (e) => {
        plano.forEach(p => p.selecionado = false);
        const parts = e.target.value.split(',');
        parts.forEach(part => {
          const val = part.trim();
          if (val.includes('-')) {
            const [start, end] = val.split('-').map(n => parseInt(n));
            if (!isNaN(start) && !isNaN(end)) {
              for(let i = start; i <= end; i++) {
                if (plano[i-1]) plano[i-1].selecionado = true;
              }
            }
          } else {
            const n = parseInt(val);
            if (!isNaN(n) && plano[n-1]) plano[n-1].selecionado = true;
          }
        });
        renderizarGrade();
      });
    }

    function sincronizarInputIntervalo() {
      const el = container.querySelector('#input-intervalo');
      if (el) el.value = '';
    }

    const radioZip = container.querySelector('#org_saida_zip');
    const radioSep = container.querySelector('#org_saida_sep');
    const avisoSep = container.querySelector('#org-aviso-separados');
    if (radioZip && radioSep) {
      function aoMudarSaida() {
        avisoSep.style.display = (radioSep.checked && parseInt(container.querySelector('#org-qtd-arquivos').textContent) >= 6) ? 'block' : 'none';
      }
      radioZip.onchange = aoMudarSaida;
      radioSep.onchange = aoMudarSaida;
    }

    function atualizarEstimativaSaida() {
      const boxZip = container.querySelector('#org-box-zip');
      if (!boxZip) return;

      let qtdArquivos = 1;
      let ativadorZip = false;

      let alvoPlan = plano;
      if (foco.acaoFixa === 'extrair') alvoPlan = plano.filter(p => p.selecionado);

      if (alvoPlan.length === 0) {
        boxZip.style.display = 'none';
        return;
      }

      const acaoAtualEstimativa = obterAcaoAtual();

      if (acaoAtualEstimativa === 'dividir-n') {
        const param = Math.max(1, obterParamAtual() || 1);
        qtdArquivos = Math.ceil(alvoPlan.length / param);
        ativadorZip = qtdArquivos > 1;
      } else if (acaoAtualEstimativa === 'dividir-tamanho') {
        const param = obterParamAtual() || 10;
        if (fileOrig) {
           qtdArquivos = Math.max(1, Math.ceil((fileOrig.size / (1024*1024)) / param));
           if (qtdArquivos > 1) ativadorZip = true;
        }
      } else if (foco.acaoFixa === 'extrair') {
        const chkUmPorPag = container.querySelector('#check-um-por-pagina');
        if (chkUmPorPag && chkUmPorPag.checked) {
           qtdArquivos = alvoPlan.length;
           ativadorZip = qtdArquivos > 1;
        }
      }

      if (ativadorZip) {
        boxZip.style.display = 'block';
        container.querySelector('#org-qtd-arquivos').textContent = qtdArquivos + (acaoAtualEstimativa === 'dividir-tamanho' ? ' (est)' : '');
        if (qtdArquivos >= 6) { if(radioZip) radioZip.checked = true; }
        else { if(radioSep) radioSep.checked = true; }
        if (radioZip && radioZip.onchange) radioZip.onchange();
      } else {
        boxZip.style.display = 'none';
      }
    }

    const paramElChange = container.querySelector('#input-param');
    if (paramElChange && !foco.mostrarEscolhaDivisao) {
       paramElChange.addEventListener('input', atualizarEstimativaSaida);
    }
    const checkUmPorPagChange = container.querySelector('#check-um-por-pagina');
    if (checkUmPorPagChange) checkUmPorPagChange.addEventListener('change', atualizarEstimativaSaida);

    // --- OPERAÇÕES ---
    if (foco.mostrarGirar) {
      container.querySelector('#btn-girar-esq').onclick = () => girar(-90);
      container.querySelector('#btn-girar-dir').onclick = () => girar(90);
    }

    function girar(graus) {
      salvarEstado();
      const temSel = plano.some(p => p.selecionado);
      plano.forEach(p => {
        if (!temSel || p.selecionado) {
          p.rotation = (p.rotation + graus) % 360;
        }
      });
      renderizarGrade();
    }

    if (foco.mostrarRemover) {
      container.querySelector('#btn-remover').onclick = () => {
        const sels = plano.filter(p => p.selecionado);
        if (sels.length === 0) return PDFTools.UI.mostrarToast('Selecione ao menos uma página para remover.', 'info');
        if (sels.length === plano.length) return alert('Você não pode remover todas as páginas do PDF.');

        salvarEstado();
        plano = plano.filter(p => !p.selecionado);
        renderizarGrade();
      };
    }

    // --- AÇÃO FINAL ---
    container.querySelector('#btn-gerar').onclick = async () => {
      let acao = obterAcaoAtual();
      let planoTrabalho = [...plano];

      if (planoTrabalho.length === 0) return alert("O PDF final ficaria sem páginas.");

      let acaoAtual = acao;
      if (acao === 'extrair') {
        planoTrabalho = planoTrabalho.filter(p => p.selecionado);
        if (planoTrabalho.length === 0) return alert("Selecione as páginas que deseja extrair.");

        const chk = container.querySelector('#check-um-por-pagina');
        if (chk && chk.checked) {
           acaoAtual = 'dividir-n';
        }
      }

      const param = obterParamAtual();
      const paramFinal = acaoAtual === 'dividir-n' && acao === 'extrair' ? 1 : param;


      const btnGerar = container.querySelector('#btn-gerar');
      btnGerar.disabled = true;
      try {
        await PDFTools.carregarLib('pdf-lib');
        const partes = await aplicarEdicoes(fileOrig, planoTrabalho, acaoAtual, paramFinal, (pct, txt) => progresso.atualizar(pct, txt));

        const radioZipOut = container.querySelector('#org_saida_zip');
        const usarZip = radioZipOut && radioZipOut.checked && partes.length > 1;

        if (partes.length === 1) {
          const nomeFinal = `${nomeOriginal}${foco.sufixoArquivo}.pdf`;
          PDFTools.baixar(partes[0], nomeFinal);
          PDFTools.UI.mostrarToast('Documento gerado com sucesso!', 'sucesso');

          if (foco.mostrarProximosPassos) {
            const resArea = container.querySelector('#org-resultado');
            resArea.style.display = 'block';
            container.querySelector('#btn-org-baixar-novamente').onclick = () => PDFTools.baixar(partes[0], nomeFinal);
            const proxContainer = container.querySelector('#org-proximos-passos');
            proxContainer.innerHTML = '';
            const prox = PDFTools.UI.criarProximosPassos({
              blob: partes[0], nomeArquivo: nomeFinal, origemId: foco.id, tamanhoBytes: partes[0].size
            });
            if (prox) proxContainer.appendChild(prox);
            PDFTools.registrarAcaoSessao(foco.acaoSessaoTexto || foco.nome);
          }
        } else if (usarZip) {
          progresso.atualizar(95, 'Montando arquivo ZIP...');
          await new Promise(r => setTimeout(r, 50));
          const arrBlobs = partes.map((b, i) => ({ nome: `${nomeOriginal}-parte-${String(i+1).padStart(3,'0')}.pdf`, blob: b }));
          const zipBlob = await PDFTools.gerarZip(arrBlobs, (pct, txt) => progresso.atualizar(95 + (pct*0.05), txt));
          PDFTools.baixar(zipBlob, `${nomeOriginal}-partes.zip`);
          PDFTools.UI.mostrarToast('ZIP gerado com sucesso!', 'sucesso');
        } else {
          PDFTools.UI.mostrarToast(`Gerados ${partes.length} arquivos. O download iniciará em sequência.`, 'sucesso');
          for(let i=0; i<partes.length; i++) {
            PDFTools.baixar(partes[i], `${nomeOriginal}-parte-${i+1}.pdf`);
            await new Promise(r => setTimeout(r, 800)); // Pequena pausa para o navegador não bloquear
          }
        }
      } catch (e) {
        PDFTools.UI.toastErro(e);
      } finally {
        progresso.esconder();
        btnGerar.disabled = false;
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);

    // Cleanup chamado por index.html ao trocar de ferramenta ou voltar pra home.
    return function limparOrganizar() {
      document.removeEventListener('keydown', aoTecladoOrganizar);
      try { if (visaoObserver) visaoObserver.disconnect(); } catch (e) {}
    };
}

// --- REGISTRO: um botão por tarefa humana, todos usando o mesmo motor acima ---

const FOCOS_ORGANIZAR = [
  {
    id: 'organizar_paginas',
    nome: 'Organizar Páginas',
    descricao: 'Reordene, remova e gire páginas do PDF — tudo no navegador, sem upload.',
    mostrarSelecao: true,
    mostrarGirar: true,
    mostrarRemover: true,
    mostrarEscolhaDivisao: false,
    mostrarProximosPassos: true,
    acaoFixa: 'juntar', // um único PDF com o plano (ordem + giros + remoções)
    labelBotao: 'Salvar PDF Organizado',
    sufixoArquivo: '-organizado',
    paramLabel: null,
    paramValor: null,
    explicacao: 'Arraste as miniaturas para reordenar. Clique para selecionar (Shift para intervalo). Use Girar ou Remover na barra lateral — ou o ✕ em cada página. Depois salve o PDF.',
    acaoSessaoTexto: 'Organizou as páginas'
  },
  {
    id: 'dividir_pdf', nome: 'Dividir PDF',
    descricao: 'Divida o PDF em vários arquivos menores — por quantidade de páginas ou por tamanho máximo em MB.',
    mostrarSelecao: false, mostrarGirar: false, mostrarRemover: false,
    mostrarEscolhaDivisao: true,
    mostrarProximosPassos: true,
    acaoFixa: null, labelBotao: 'Dividir e Baixar', sufixoArquivo: '-parte',
    paramLabel: null, paramValor: null,
    acaoSessaoTexto: 'Dividiu o PDF'
  }
];

FOCOS_ORGANIZAR.forEach(foco => {
  PDFTools.registrar({
    id: foco.id,
    nome: foco.nome,
    descricao: foco.descricao,
    precisa: ['pdf-lib', 'pdfjs'],
    montarUI: (container, arquivoInicial) => montarOrganizarUI(container, foco, arquivoInicial)
  });
});

// --- LÓGICA PURA ---

async function aplicarEdicoes(fileOrig, planoFinal, acao, param, aoProgredir) {
  const buffer = await PDFTools.lerComoArrayBuffer(fileOrig);
  const { PDFDocument, degrees } = window.PDFLib;

  const docOriginal = await PDFDocument.load(buffer, { ignoreEncryption: true });

  const numTotal = planoFinal.length;
  let partes = [];

  aoProgredir(5, "Carregando documento original...");
  await new Promise(r => setTimeout(r, 0));

  // Copia um lote de páginas em UMA ÚNICA chamada a copyPages(). O pdf-lib cria um
  // PDFObjectCopier novo (com cache de objetos já copiados vazio) a cada chamada de
  // copyPages — então copiar página por página faz cada página reembutir do zero
  // qualquer recurso compartilhado com as demais (fontes, a logo do cabeçalho etc.),
  // em vez de reaproveitar a cópia já feita. Copiar o lote inteiro de uma vez evita isso.
  async function copiarLote(indicesOriginais, paginasData) {
    const docParte = await PDFDocument.create();
    const paginasCopiadas = await docParte.copyPages(docOriginal, indicesOriginais);
    paginasCopiadas.forEach((page, i) => {
      aplicarTransformacoes(page, paginasData[i], degrees);
      docParte.addPage(page);
    });
    return docParte;
  }

  if (acao === 'dividir-tamanho') {
    // Margem de segurança de 2,5%: o Windows exibe tamanho de arquivo em unidades de 1024
    // (MiB rotulado como "MB"), mas isso ainda deixa pouca folga perto do limite escolhido —
    // por isso tratamos o alvo internamente como um pouco menor do que o valor digitado, sem
    // mudar o que aparece na tela para quem está usando a ferramenta.
    let maxBytes = param * 1024 * 1024 * 0.975;
    let startIdx = 0;

    while (startIdx < numTotal) {
      aoProgredir(10 + (startIdx/numTotal)*80, `Montando parte a partir da página ${startIdx+1} de ${numTotal}...`);
      await new Promise(r => setTimeout(r, 0));

      // Busca binária pelo maior número de páginas (a partir de startIdx) que cabe em maxBytes.
      // Cada tentativa copia o lote candidato inteiro em uma só chamada (copiarLote), então
      // nunca duplica fontes/imagens compartilhadas entre as páginas do próprio lote.
      let lo = 1, hi = numTotal - startIdx;
      let melhorBytes = null, melhorCount = 1;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const fatia = planoFinal.slice(startIdx, startIdx + mid);
        const docTeste = await copiarLote(fatia.map(p => p.originalIndex), fatia);
        const bytes = await docTeste.save();

        if (bytes.length <= maxBytes || mid === 1) {
          melhorBytes = bytes;
          melhorCount = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      partes.push(new Blob([melhorBytes], { type: 'application/pdf' }));
      startIdx += melhorCount;
    }

  } else if (acao === 'dividir-n') {
    const quebra = Math.max(1, param || 1);

    for (let startIdx = 0; startIdx < numTotal; startIdx += quebra) {
      aoProgredir(10 + (startIdx/numTotal)*80, `Montando parte a partir da página ${startIdx+1} de ${numTotal}...`);
      await new Promise(r => setTimeout(r, 0));

      const fatia = planoFinal.slice(startIdx, startIdx + quebra);
      const docParte = await copiarLote(fatia.map(p => p.originalIndex), fatia);
      partes.push(new Blob([await docParte.save()], { type: 'application/pdf' }));
    }

  } else {
    // Juntar / Extrair (mesma lógica: pegar o plano final e aplicar num arquivo só)
    const novoDoc = await PDFDocument.create();
    const indicesOriginais = planoFinal.map(p => p.originalIndex);

    aoProgredir(30, "Copiando páginas estruturalmente (isso pode levar um tempo em arquivos muito grandes)...");
    await new Promise(r => setTimeout(r, 10));

    // Copia tudo de uma vez (MUITO mais rápido no pdf-lib do que página por página)
    const paginasCopiadas = await novoDoc.copyPages(docOriginal, indicesOriginais);

    for (let i = 0; i < paginasCopiadas.length; i++) {
      aoProgredir(50 + (i/numTotal)*40, `Aplicando edições na página ${i+1}...`);
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 0)); // Respiro

      const pData = planoFinal[i];
      const page = paginasCopiadas[i];
      aplicarTransformacoes(page, pData, degrees);
      novoDoc.addPage(page);
    }

    aoProgredir(90, "Salvando arquivo final...");
    await new Promise(r => setTimeout(r, 0));
    partes.push(new Blob([await novoDoc.save()], { type: 'application/pdf' }));
  }

  return partes;
}

function aplicarTransformacoes(page, pData, degreesFn) {
  if (pData.rotation) {
    const curRot = page.getRotation().angle;
    page.setRotation(degreesFn(curRot + pData.rotation));
  }
}
