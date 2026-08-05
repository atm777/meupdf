function montarEstudioUI(container, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let plano = []; // Estado atual: [{ id, originalIndex, rotation, cropBox, selecionado }]
    let historico = [];
    let visaoObserver = null;
    let nomeOriginal = 'documento';
    let fileTamanho = 0;

    if (!document.getElementById('css-estudio')) {
      const style = document.createElement('style');
      style.id = 'css-estudio';
      style.textContent = `
        .est-layout { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px; }
        .est-main { flex: 1; min-width: 320px; display: flex; flex-direction: column; }
        .est-sidebar { width: 300px; flex-shrink: 0; }
        
        .est-grade-paginas { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; overflow-y: auto; max-height: 600px; padding: 12px; background: var(--sup-2); border-radius: 8px; border: 1px solid var(--borda); }
        .est-pagina { background: var(--sup); box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; position: relative; cursor: pointer; user-select: none; transition: transform 0.2s, box-shadow 0.2s; border: 2px solid transparent; }
        .est-pagina:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .est-pagina.selecionada { border-color: var(--cor-primaria); box-shadow: 0 0 0 2px rgba(10,88,202,0.2); }
        
        .est-pagina-header { font-size: 11px; padding: 6px; text-align: center; font-weight: bold; background: var(--sup-2); border-bottom: 1px solid var(--borda); color: var(--texto-2); border-radius: 2px 2px 0 0; }
        .est-pagina-thumb { width: 100%; height: 160px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: white; border-radius: 0 0 2px 2px; }
        .est-pagina-thumb canvas { max-width: 100%; max-height: 100%; object-fit: contain; transition: transform 0.3s ease; }
        .thumb-placeholder { font-size: 24px; color: #adb5bd; }
        
        .est-acoes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .est-btn-acao { background: var(--sup); border: 1px solid var(--borda); border-radius: 6px; padding: 12px 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.2s; color: var(--texto); }
        .est-btn-acao:hover { background: var(--sup-2); border-color: var(--cor-primaria); color: var(--cor-primaria); }
        .est-btn-acao .icon { font-size: 20px; }
        
        .est-btn { padding: 8px 16px; border: 1px solid var(--borda); border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; background: var(--sup); color: var(--texto); }
        .est-btn:hover { background: var(--sup-2); }
        .est-btn-primary { background: var(--cor-primaria); color: white; border: none; }
        .est-btn-primary:hover { background: #004494; }
        
        .est-historico-lista { list-style: none; padding: 0; margin: 0; font-size: 13px; color: var(--texto-2); line-height: 2; }
        .est-historico-lista li { display: flex; align-items: center; gap: 8px; }
        .est-historico-lista li::before { content: '✓'; color: var(--cor-sucesso); font-weight: bold; }
        
        .est-badge-remover { position: absolute; top: -10px; right: -10px; background: var(--cor-erro); color: white; border-radius: 50%; width: 24px; height: 24px; font-size: 14px; border: none; cursor: pointer; display: none; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10; }
        .est-pagina:hover .est-badge-remover { display: flex; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="est-tela-inicial"></div>
      <div id="est-tela-trabalho" style="display:none;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--borda);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 24px;">📄</div>
            <div>
              <h3 style="margin: 0; font-size: 18px;" id="est-titulo-arq">documento.pdf</h3>
              <div style="font-size: 13px; color: var(--texto-2); margin-top: 4px;" id="est-meta-arq">0 páginas · 0 MB</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="est-btn" id="btn-trocar">↺ Trocar</button>
            <button class="est-btn est-btn-primary" id="btn-baixar">↓ Baixar PDF Final</button>
          </div>
        </div>
        
        <div class="est-layout">
          <!-- Painel Esquerdo: Páginas -->
          <div class="est-main">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; color: var(--texto-2);">
              <span style="font-weight: 500; color: var(--texto);">Páginas</span>
              <span id="est-lbl-selecao">Nenhuma página selecionada</span>
            </div>
            <div class="est-grade-paginas" id="est-grade"></div>
            <div style="font-size:12px; color: var(--texto-2); margin-top: 8px; text-align: right;">Dica: Arraste as páginas para reordenar.</div>
          </div>

          <!-- Painel Direito: Ações -->
          <div class="est-sidebar">
            <div style="font-weight: bold; margin-bottom: 16px; color: var(--texto);">O que fazer</div>
            
            <div class="est-acoes-grid">
              <button class="est-btn-acao" id="btn-est-girar"><span class="icon">↻</span>Girar</button>
              <button class="est-btn-acao" id="btn-est-remover"><span class="icon">🗑️</span>Remover</button>
              <button class="est-btn-acao" id="btn-est-extrair"><span class="icon">📑</span>Extrair</button>
              <button class="est-btn-acao" id="btn-est-recortar"><span class="icon">✂️</span>Recortar</button>
              <button class="est-btn-acao" id="btn-est-tarjar"><span class="icon">⬛</span>Tarjar</button>
              <button class="est-btn-acao" id="btn-est-comprimir"><span class="icon">🗜️</span>Comprimir</button>
            </div>
            
            <div style="margin-top: 16px;">
               <select id="est-select-mais" class="est-btn" style="width: 100%; text-align: center; appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22gray%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M8%2011L3%206h10z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 12px center;">
                 <option value="" disabled selected>... Mais ferramentas</option>
                 <option value="assinar_pdf">Assinar Documento</option>
                 <option value="numerar_paginas">Numerar Páginas</option>
                 <option value="marca_dagua">Marca d'Água</option>
                 <option value="editar_metadados">Editar Metadados</option>
                 <option value="dividir_quantidade">Dividir (Quantidade)</option>
                 <option value="dividir_tamanho">Dividir (Tamanho)</option>
                 <option value="pdf_para_imagens">Exportar para Imagens</option>
                 <option value="extrair_texto">Extrair Texto</option>
                 <option value="preencher_form">Preencher Formulário</option>
                 <option value="inspecionar_pdf">Inspecionar Privacidade</option>
               </select>
            </div>
            
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--borda);">
               <div style="font-weight: bold; margin-bottom: 16px;">Nesta sessão</div>
               <ul id="est-historico-lista" class="est-historico-lista">
                 <!-- Itens do histórico entram aqui -->
               </ul>
               <button class="est-btn" id="btn-est-desfazer" style="margin-top: 16px; width: 100%;" disabled>↩ Desfazer última ação</button>
            </div>
          </div>
        </div>
        
        <!-- Modal Loading Progress -->
        <div id="est-loading-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 999; align-items: center; justify-content: center;">
           <div style="background: var(--sup); padding: 24px; border-radius: 8px; width: 400px; max-width: 90%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
              <h3 style="margin-top:0; margin-bottom:16px;">Processando...</h3>
              <div id="est-progresso-container"></div>
           </div>
        </div>
      </div>
    `;

    const telaInicial = container.querySelector('#est-tela-inicial');
    const telaTrabalho = container.querySelector('#est-tela-trabalho');
    const grade = container.querySelector('#est-grade');
    const progressoModal = container.querySelector('#est-loading-modal');
    
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#est-progresso-container').appendChild(progresso.elemento);

    telaInicial.appendChild(PDFTools.UI.criarDropzone({
      multiplo: false,
      aceita: '.pdf, application/pdf',
      onArquivos: (arquivos) => abrirArquivo(arquivos[0])
    }));

    visaoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          renderizarMiniatura(entry.target);
        }
      });
    }, { rootMargin: '200px' });

    async function abrirArquivo(file) {
      if (file.type !== 'application/pdf') return;
      fileOrig = file;
      nomeOriginal = PDFTools.nomeSemExtensao(file.name);
      fileTamanho = file.size;

      telaInicial.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--texto-2);">Carregando PDF no Estúdio...</div>';

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
            cropBox: null,
            selecionado: false
          });
        }
        
        // Limpar o histórico nativo da sessão anterior
        PDFTools.historicoSessao = [];

        salvarEstado();
        telaInicial.style.display = 'none';
        telaTrabalho.style.display = 'block';
        
        container.querySelector('#est-titulo-arq').textContent = file.name;
        
        renderizarGrade();
      } catch(err) {
        if (err.name === 'PasswordException') {
          telaInicial.innerHTML = PDFTools.erro('pdf_protegido');
        } else {
          telaInicial.innerHTML = PDFTools.erro('pdf_corrompido', err.message);
        }
      }
    }

    function atualizarMeta() {
       container.querySelector('#est-meta-arq').textContent = `${plano.length} páginas · ${PDFTools.formatarTamanho(fileTamanho)}`;
       const selCount = plano.filter(p => p.selecionado).length;
       container.querySelector('#est-lbl-selecao').textContent = selCount > 0 ? `${selCount} selecionada(s)` : 'Nenhuma selecionada';
       
       const listaHist = container.querySelector('#est-historico-lista');
       listaHist.innerHTML = '';
       if (PDFTools.historicoSessao && PDFTools.historicoSessao.length > 0) {
          PDFTools.historicoSessao.forEach(txt => {
             const li = document.createElement('li');
             li.textContent = txt;
             listaHist.appendChild(li);
          });
       } else {
          listaHist.innerHTML = '<li style="color:var(--texto-2); list-style:none;">Nenhuma modificação</li>';
       }
    }

    function salvarEstado(textoHistorico = null) {
      if (textoHistorico) {
         PDFTools.registrarAcaoSessao(textoHistorico);
      }
      historico.push(JSON.stringify(plano));
      if (historico.length > 20) historico.shift();
      container.querySelector('#btn-est-desfazer').disabled = historico.length <= 1;
    }

    container.querySelector('#btn-est-desfazer').onclick = () => {
      if (historico.length > 1) {
        historico.pop(); // tira o estado atual
        if (PDFTools.historicoSessao && PDFTools.historicoSessao.length > 0) {
           PDFTools.historicoSessao.pop(); // Desfaz a string do histórico visual
        }
        plano = JSON.parse(historico[historico.length - 1]);
        renderizarGrade();
      }
    };

    container.querySelector('#btn-trocar').onclick = () => {
       PDFTools.abrirFerramenta('estudio_principal');
    };

    let lastSelectedIndex = null;
    let draggedIdx = null;

    function renderizarGrade() {
      grade.innerHTML = '';
      visaoObserver.disconnect();

      plano.forEach((p, index) => {
        const el = document.createElement('div');
        el.className = 'est-pagina' + (p.selecionado ? ' selecionada' : '');
        el.dataset.id = p.id;
        el.dataset.originalIndex = p.originalIndex;
        el.draggable = true;

        el.innerHTML = `
          <div class="est-pagina-header">
            <span>${index + 1}</span>
          </div>
          <div class="est-pagina-thumb">
            <div class="thumb-placeholder">${p.originalIndex + 1}</div>
          </div>
          <button class="est-badge-remover" title="Remover página">✕</button>
        `;

        el.onclick = (e) => {
          if (e.target.classList.contains('est-badge-remover')) return;
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

        el.querySelector('.est-badge-remover').onclick = (e) => {
          e.stopPropagation();
          plano.splice(index, 1);
          salvarEstado('Removeu 1 página');
          renderizarGrade();
        };

        // Drag & Drop
        el.addEventListener('dragstart', (e) => {
          draggedIdx = index;
          e.dataTransfer.effectAllowed = 'move';
          el.style.opacity = '0.5';
        });
        el.addEventListener('dragend', () => {
          el.style.opacity = '1';
          document.querySelectorAll('.est-pagina').forEach(n => {
            n.style.borderTop = '';
            n.style.borderBottom = '';
          });
        });
        el.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = el.getBoundingClientRect();
          const pY = e.clientY - rect.top;
          if (pY < rect.height / 2) {
            el.style.borderTop = '2px solid var(--cor-primaria)';
            el.style.borderBottom = '';
          } else {
            el.style.borderTop = '';
            el.style.borderBottom = '2px solid var(--cor-primaria)';
          }
        });
        el.addEventListener('dragleave', () => {
          el.style.borderTop = '';
          el.style.borderBottom = '';
        });
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          el.style.borderTop = '';
          el.style.borderBottom = '';
          if (draggedIdx === null || draggedIdx === index) return;

          const rect = el.getBoundingClientRect();
          const pY = e.clientY - rect.top;
          let dropIdx = (pY < rect.height / 2) ? index : index + 1;

          if (draggedIdx < dropIdx) dropIdx--;

          const [movido] = plano.splice(draggedIdx, 1);
          plano.splice(dropIdx, 0, movido);
          salvarEstado('Reordenou as páginas');
          renderizarGrade();
        });

        grade.appendChild(el);
        visaoObserver.observe(el);
      });
      
      atualizarMeta();
    }

    async function renderizarMiniatura(el) {
      visaoObserver.unobserve(el);
      const originalIdx = parseInt(el.dataset.originalIndex);
      const pgData = plano.find(p => p.id === el.dataset.id);

      try {
        const page = await pdfDocJs.getPage(originalIdx + 1);
        const scale = 0.5;
        const viewport = page.getViewport({ scale, rotation: page.rotate + (pgData.rotation || 0) });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const thumbContainer = el.querySelector('.est-pagina-thumb');
        thumbContainer.innerHTML = '';
        thumbContainer.appendChild(canvas);
      } catch (err) {
        console.error('Erro thumb pág ' + originalIdx, err);
      }
    }

    // --- AÇÕES LOCAIS DO ESTÚDIO ---
    
    container.querySelector('#btn-est-girar').onclick = () => {
       let sel = plano.filter(p => p.selecionado);
       let alvo = sel.length > 0 ? sel : plano; // gira as selecionadas, ou todas se nao houver selecao
       alvo.forEach(p => p.rotation = (p.rotation + 90) % 360);
       salvarEstado(`Girou ${alvo.length} página(s)`);
       renderizarGrade();
    };
    
    container.querySelector('#btn-est-remover').onclick = () => {
       let sel = plano.filter(p => p.selecionado);
       if(sel.length === 0) return alert('Selecione pelo menos uma página para remover.');
       plano = plano.filter(p => !p.selecionado);
       salvarEstado(`Removeu ${sel.length} página(s)`);
       renderizarGrade();
    };
    
    container.querySelector('#btn-est-extrair').onclick = () => {
       let sel = plano.filter(p => p.selecionado);
       if(sel.length === 0) return alert('Selecione as páginas que deseja extrair (manter).');
       plano = plano.filter(p => p.selecionado);
       plano.forEach(p => p.selecionado = false); // limpa selecao pós extração
       salvarEstado(`Extraiu ${sel.length} página(s)`);
       renderizarGrade();
    };
    
    container.querySelector('#btn-est-recortar').onclick = () => dispararFerramenta('recortar_margens');
    container.querySelector('#btn-est-tarjar').onclick = () => dispararFerramenta('tarjar_pdf');
    container.querySelector('#btn-est-comprimir').onclick = () => dispararFerramenta('comprimir_pdf');
    
    container.querySelector('#est-select-mais').onchange = (e) => {
       const toolId = e.target.value;
       if(toolId) {
          dispararFerramenta(toolId);
          e.target.value = '';
       }
    };

    // Gera o PDF com o estado atual e envia para a ferramenta complexa
    async function dispararFerramenta(toolId) {
       progressoModal.style.display = 'flex';
       try {
         await PDFTools.carregarLib('pdf-lib');
         const partes = await aplicarEdicoes(fileOrig, plano, 'juntar', null, progresso.atualizar);
         const blobAtual = partes[0];
         progressoModal.style.display = 'none';
         PDFTools.abrirComArquivo(toolId, blobAtual, nomeOriginal + '.pdf');
       } catch (err) {
         progressoModal.style.display = 'none';
         alert('Erro ao processar: ' + err.message);
       }
    }

    container.querySelector('#btn-baixar').onclick = async () => {
      progressoModal.style.display = 'flex';
      try {
        await PDFTools.carregarLib('pdf-lib');
        const partes = await aplicarEdicoes(fileOrig, plano, 'juntar', null, progresso.atualizar);
        PDFTools.baixar(partes[0], nomeOriginal + '-meupdf.pdf');
        progressoModal.style.display = 'none';
      } catch (err) {
        progressoModal.style.display = 'none';
        alert('Erro ao exportar: ' + err.message);
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);
}

PDFTools.registrar({
  id: 'estudio_principal',
  nome: 'Modo Estúdio',
  descricao: 'Editor centralizado para Girar, Remover, Extrair, Tarjar e organizar seus PDFs.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: (container, arquivoInicial) => montarEstudioUI(container, arquivoInicial)
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

  async function copiarLote(indicesOriginais, paginasData) {
    const docParte = await PDFDocument.create();
    const paginasCopiadas = await docParte.copyPages(docOriginal, indicesOriginais);
    paginasCopiadas.forEach((page, i) => {
      aplicarTransformacoes(page, paginasData[i], degrees);
      docParte.addPage(page);
    });
    return docParte;
  }

  const novoDoc = await PDFDocument.create();
  const indicesOriginais = planoFinal.map(p => p.originalIndex);

  aoProgredir(30, "Construindo o novo documento...");
  await new Promise(r => setTimeout(r, 10));

  const paginasCopiadas = await novoDoc.copyPages(docOriginal, indicesOriginais);

  for (let i = 0; i < paginasCopiadas.length; i++) {
    aoProgredir(50 + (i/numTotal)*40, `Aplicando edições na página ${i+1}...`);
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));

    const pData = planoFinal[i];
    const page = paginasCopiadas[i];
    aplicarTransformacoes(page, pData, degrees);
    novoDoc.addPage(page);
  }

  aoProgredir(90, "Salvando arquivo final...");
  await new Promise(r => setTimeout(r, 0));
  partes.push(new Blob([await novoDoc.save()], { type: 'application/pdf' }));
  
  return partes;
}

function aplicarTransformacoes(page, pData, degreesFn) {
  if (pData.rotation) {
    const curRot = page.getRotation().angle;
    page.setRotation(degreesFn(curRot + pData.rotation));
  }
  if (pData.cropBox) {
    const cb = pData.cropBox;
    page.setCropBox(cb.xLeft, cb.yBottom, cb.xRight, cb.yTop);
  }
}