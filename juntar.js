PDFTools.registrar({
  id: 'juntar_pdfs',
  nome: 'Juntar PDFs',
  descricao: 'Combine vários arquivos em um só. Preserve a ordem e mantenha a qualidade original.',
  precisa: ['pdf-lib'],
  montarUI: function(container) {
    let itens = []; 
    
    if (!document.getElementById('css-juntar-pdf')) {
      const style = document.createElement('style');
      style.id = 'css-juntar-pdf';
      style.textContent = `
        .ferramenta-grid { display: flex; gap: 24px; flex-wrap: wrap; }
        .ferramenta-col-esq { flex: 1; min-width: 300px; }
        .ferramenta-col-dir { width: 300px; flex-shrink: 0; background: var(--sup-2); padding: 16px; border-radius: 8px; border: 1px solid var(--borda); }
        .pdf-grade { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; max-height: 400px; overflow-y: auto; padding: 4px; }
        .pdf-item { border: 1px solid var(--borda); border-radius: 4px; padding: 12px; background: var(--sup); cursor: grab; display: flex; align-items: center; gap: 12px; }
        .pdf-item:active { cursor: grabbing; }
        .pdf-item.dragging { opacity: 0.5; }
        .pdf-item.drag-over { border-color: var(--cor-primaria); box-shadow: 0 0 0 2px var(--cor-primaria); }
        .pdf-item-icone { font-size: 24px; }
        .pdf-item-info { flex-grow: 1; overflow: hidden; }
        .pdf-item-title { font-weight: bold; font-size: 14px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pdf-item-meta { font-size: 12px; color: var(--texto-2); }
        .pdf-acoes { display: flex; gap: 4px; }
        .pdf-acoes button { background: var(--sup-2); border: 1px solid #ced4da; border-radius: 4px; cursor: pointer; padding: 6px 12px; font-size: 14px; }
        .pdf-acoes button:hover { background: #dde0e3; }
        .pdf-acoes button.del { color: var(--cor-erro); font-weight: bold; }
        .ordenacao-acoes { display: flex; gap: 8px; margin-top: 16px; }
        .ordenacao-acoes button { font-size: 12px; padding: 6px 12px; cursor: pointer; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; }
        .ordenacao-acoes button:hover { background: #f0f0f0; }
        .resumo-box { background: var(--sup-2); padding: 12px; border-radius: 4px; margin-top: 16px; font-size: 14px; text-align: center; font-weight: bold; }
        .aviso-box { background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 12px; border-radius: 4px; margin-top: 16px; font-size: 13px; display: none; border: 1px solid rgba(255, 193, 7, 0.4); }
        .opcoes-grupo { margin-bottom: 16px; }
        .opcoes-grupo label { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; cursor: pointer; }
        .opcoes-grupo input[type="checkbox"] { margin-top: 4px; }
        .opcoes-grupo .dica { display: block; font-size: 12px; color: var(--texto-2); font-weight: normal; margin-top: 4px; }
        .opcoes-grupo input[type="text"] { width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--borda); font-size: 14px; box-sizing: border-box; margin-top: 4px; }
        .area-resultado { margin-top: 24px; padding: 16px; border: 1px solid var(--cor-sucesso); border-radius: 8px; background: #eaffea; display: none; }
        .area-resultado p { margin: 0 0 12px 0; font-weight: bold; color: var(--cor-sucesso); }
      `;
      document.head.appendChild(style);
    }

    const grid = PDFTools.UI.criarElemento('div', ['ferramenta-grid']);
    const colEsq = PDFTools.UI.criarElemento('div', ['ferramenta-col-esq']);
    const colDir = PDFTools.UI.criarElemento('div', ['ferramenta-col-dir']);
    grid.appendChild(colEsq);
    grid.appendChild(colDir);

    const areaDrop = PDFTools.UI.criarDropzone({
      multiplo: true,
      aceita: '.pdf, application/pdf',
      onArquivos: async (arquivos) => {
        let ignorados = 0;
        let aceitos = [];
        for (const file of arquivos) {
          if (await PDFTools.ehPDF(file)) {
            aceitos.push(file);
          } else {
            ignorados++;
          }
        }
        
        if (ignorados > 0) {
          PDFTools.UI.mostrarToast(`${ignorados} arquivo(s) ignorado(s) por não serem PDFs válidos.`, 'erro');
        }

        if (aceitos.length > 0) {
          await PDFTools.carregarLib('pdf-lib');
          
          aceitos.forEach(file => {
            const item = {
              id: Math.random().toString(36).substring(2, 9),
              file: file,
              numPages: null,
              carregando: true
            };
            itens.push(item);
            
            // Carregar contagem de páginas em background
            PDFTools.lerComoArrayBuffer(file).then(buf => {
              return window.PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
            }).then(doc => {
              item.numPages = doc.getPageCount();
              item.carregando = false;
              renderLista();
            }).catch(e => {
              item.numPages = '?';
              item.carregando = false;
              renderLista();
            });
          });
          renderLista();
        }
      }
    });
    colEsq.appendChild(areaDrop);

    const ordenacao = PDFTools.UI.criarElemento('div', ['ordenacao-acoes']);
    ordenacao.style.display = 'none';
    const btnOrdNome = PDFTools.UI.criarElemento('button', [], 'Ordenar por Nome');
    btnOrdNome.onclick = () => { itens.sort((a, b) => a.file.name.localeCompare(b.file.name)); renderLista(); };
    ordenacao.appendChild(btnOrdNome);
    colEsq.appendChild(ordenacao);

    const grade = PDFTools.UI.criarElemento('div', ['pdf-grade']);
    colEsq.appendChild(grade);

    const resumo = PDFTools.UI.criarElemento('div', ['resumo-box']);
    resumo.style.display = 'none';
    colEsq.appendChild(resumo);
    
    const avisoBox = PDFTools.UI.criarElemento('div', ['aviso-box']);
    colEsq.appendChild(avisoBox);

    colDir.innerHTML = `
      <div class="opcoes-grupo">
        <label>
          <input type="checkbox" id="opt-marcadores" checked>
          <div>
            <strong>Preservar marcadores</strong>
            <span class="dica">Mantém o índice de cada arquivo original (quando possível).</span>
          </div>
        </label>
      </div>
      <div class="opcoes-grupo">
        <label>
          <input type="checkbox" id="opt-branco">
          <div>
            <strong>Página em branco</strong>
            <span class="dica">Insere separador entre documentos (útil para impressão frente e verso).</span>
          </div>
        </label>
      </div>
      <div class="opcoes-grupo">
        <label>
          <input type="checkbox" id="opt-metadados" checked>
          <div>
            <strong>Limpar metadados</strong>
            <span class="dica">Remove autor e dados do documento. Evita que dados do 1º arquivo vazem para o resultado.</span>
          </div>
        </label>
      </div>
      <div class="opcoes-grupo">
        <label>
          <strong>Nome do Arquivo</strong>
        </label>
        <input type="text" id="opt-nome" value="juntado-${new Date().toISOString().split('T')[0]}">
      </div>
    `;

    const progresso = PDFTools.UI.criarProgresso();
    colDir.appendChild(progresso.elemento);

    const btnGerar = PDFTools.UI.criarBotaoPrincipal('Juntar PDFs', async () => {
      if (itens.length === 0) return;
      
      const totalMb = itens.reduce((acc, i) => acc + i.file.size, 0) / (1024 * 1024);
      if (totalMb > 150) {
        if (!confirm(`Você está prestes a processar ${totalMb.toFixed(1)} MB de PDF. Isso pode demorar e travar celulares. Deseja continuar?`)) {
          return;
        }
      }

      btnGerar.disabled = true;
      areaResultado.style.display = 'none';
      avisoBox.style.display = 'none';
      
      try {
        await PDFTools.carregarLib('pdf-lib');
        
        const opcoes = {
          marcadores: document.getElementById('opt-marcadores').checked,
          paginaEmBranco: document.getElementById('opt-branco').checked,
          limparMetadados: document.getElementById('opt-metadados').checked
        };

        const arquivos = itens.map(i => i.file);
        
        const resultado = await juntarPDFs(arquivos, opcoes, (pct, txt) => {
          progresso.atualizar(pct, txt);
        });

        PDFTools.UI.mostrarToast('PDF gerado com sucesso!', 'sucesso');
        
        // Exibir avisos de form/tamanho se houver
        let avisosHtml = [];
        if (resultado.avisos.tamanhosDiferentes) avisosHtml.push('• Páginas com tamanhos diferentes foram mantidas no formato original.');
        if (resultado.avisos.temFormulario) avisosHtml.push('• Formulários detectados (AcroForm) podem não funcionar perfeitamente no arquivo final.');
        
        if (avisosHtml.length > 0) {
          avisoBox.innerHTML = '<strong>Observações:</strong><br>' + avisosHtml.join('<br>');
          avisoBox.style.display = 'block';
        }

        const nome = document.getElementById('opt-nome').value.trim() || 'documento';
        const nomeFinal = nome.endsWith('.pdf') ? nome : nome + '.pdf';
        
        areaResultado.style.display = 'block';
        areaResultado.querySelector('.res-tamanho').textContent = PDFTools.formatarTamanho(resultado.blob.size);
        areaResultado.querySelector('.res-paginas').textContent = `${resultado.totalPaginas} páginas`;
        
        const btnBaixar = areaResultado.querySelector('button');
        btnBaixar.onclick = () => PDFTools.baixar(resultado.blob, nomeFinal);
        
        btnBaixar.click();

      } catch (err) {
        console.error(err);
        
        // Tratamento de erros específicos
        let codErro = 'desconhecido';
        if (err.message.includes('protegido por senha')) codErro = 'pdf_protegido';
        else if (err.message.includes('corrompido')) codErro = 'pdf_corrompido';

        const el = document.createElement('div');
        el.innerHTML = PDFTools.erro(codErro, err.message);
        PDFTools.UI.mostrarToast(el.innerHTML, 'erro');
      } finally {
        progresso.esconder();
        btnGerar.disabled = false;
      }
    });
    colDir.appendChild(btnGerar);

    const areaResultado = PDFTools.UI.criarElemento('div', ['area-resultado']);
    areaResultado.innerHTML = `
      <p>PDF Pronto!</p>
      <div style="font-size:14px; margin-bottom:4px;">Tamanho final: <strong class="res-tamanho"></strong></div>
      <div style="font-size:14px; margin-bottom:12px;">Total de páginas: <strong class="res-paginas"></strong></div>
      <button class="pdf-btn-principal" style="min-height:40px; margin-top:0;">Baixar Novamente</button>
    `;
    colDir.appendChild(areaResultado);

    container.appendChild(grid);

    let draggedIndex = null;

    function renderLista() {
      grade.innerHTML = '';
      if (itens.length === 0) {
        grade.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: var(--texto-2); padding:20px;">Nenhum arquivo adicionado. Arraste PDFs para começar.</div>';
        ordenacao.style.display = 'none';
        resumo.style.display = 'none';
        btnGerar.disabled = true;
        return;
      }

      ordenacao.style.display = 'flex';
      resumo.style.display = 'block';
      btnGerar.disabled = false;
      
      let totalTamanho = 0;
      let totalPags = 0;
      let paginasProntas = true;

      itens.forEach((item, index) => {
        totalTamanho += item.file.size;
        if (item.numPages === null || item.numPages === '?') paginasProntas = false;
        else totalPags += item.numPages;

        const el = PDFTools.UI.criarElemento('div', ['pdf-item']);
        el.draggable = true;
        
        const txtPaginas = item.carregando ? 'Calculando...' : (item.numPages === '?' ? 'Erro' : `${item.numPages} pág(s)`);
        
        el.innerHTML = `
          <div class="pdf-item-icone">📄</div>
          <div class="pdf-item-info">
            <div class="pdf-item-title" title="${item.file.name}">${item.file.name}</div>
            <div class="pdf-item-meta">${PDFTools.formatarTamanho(item.file.size)} • ${txtPaginas}</div>
          </div>
          <div class="pdf-acoes">
            <button class="btn-up" aria-label="Mover para cima">↑</button>
            <button class="btn-down" aria-label="Mover para baixo">↓</button>
            <button class="del" aria-label="Remover">✕</button>
          </div>
        `;

        el.querySelector('.btn-up').onclick = () => moverItem(index, -1);
        el.querySelector('.btn-down').onclick = () => moverItem(index, 1);
        el.querySelector('.del').onclick = () => {
          itens.splice(index, 1);
          renderLista();
        };

        el.addEventListener('dragstart', (e) => {
          draggedIndex = index;
          e.dataTransfer.effectAllowed = 'move';
          setTimeout(() => el.classList.add('dragging'), 0);
        });
        el.addEventListener('dragend', () => {
          el.classList.remove('dragging');
          grade.querySelectorAll('.pdf-item').forEach(e => e.classList.remove('drag-over'));
        });
        el.addEventListener('dragover', (e) => {
          e.preventDefault();
          el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
        el.addEventListener('drop', (e) => {
          e.preventDefault();
          if (draggedIndex !== null && draggedIndex !== index) {
            const temp = itens.splice(draggedIndex, 1)[0];
            itens.splice(index, 0, temp);
            renderLista();
          }
        });

        grade.appendChild(el);
      });

      const txtPags = paginasProntas ? `${totalPags} páginas` : `Calculando páginas...`;
      resumo.textContent = `${itens.length} arquivos · ${txtPags} · ${PDFTools.formatarTamanho(totalTamanho)}`;
    }

    function moverItem(index, dir) {
      if (dir === -1 && index > 0) {
        const temp = itens[index];
        itens[index] = itens[index-1];
        itens[index-1] = temp;
        renderLista();
      } else if (dir === 1 && index < itens.length - 1) {
        const temp = itens[index];
        itens[index] = itens[index+1];
        itens[index+1] = temp;
        renderLista();
      }
    }
  }
});

// -- LÓGICA PURA SEPARADA --

async function juntarPDFs(arquivos, opcoes, aoProgredir) {
  const { PDFDocument } = window.PDFLib;
  const docSaida = await PDFDocument.create();
  
  if (opcoes.limparMetadados) {
    docSaida.setTitle('');
    docSaida.setAuthor('');
    docSaida.setSubject('');
    docSaida.setKeywords([]);
    docSaida.setProducer('');
    docSaida.setCreator('');
  }

  let totalPaginas = 0;
  let tamanhosDiferentes = false;
  let temFormulario = false;
  let pWidth = null;
  let pHeight = null;

  for (let i = 0; i < arquivos.length; i++) {
    const file = arquivos[i];
    
    await new Promise(r => setTimeout(r, 0));
    aoProgredir(((i) / arquivos.length) * 100, `Processando arquivo ${i+1} de ${arquivos.length}...`);

    let buffer;
    try {
      buffer = await PDFTools.lerComoArrayBuffer(file);
    } catch(e) {
      throw new Error(`Falha ao ler o arquivo "${file.name}".`);
    }

    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(buffer);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('encrypted')) {
         throw new Error(`O arquivo "${file.name}" está protegido por senha.`);
      }
      throw new Error(`O arquivo "${file.name}" parece estar corrompido.`);
    }

    const form = pdfDoc.getForm();
    if (form && form.getFields().length > 0) {
      temFormulario = true;
    }

    const pages = pdfDoc.getPages();
    if (pages.length === 0) continue;

    const copiedPages = await docSaida.copyPages(pdfDoc, pdfDoc.getPageIndices());
    
    for (const page of copiedPages) {
      const { width, height } = page.getSize();
      if (pWidth === null) {
        pWidth = width;
        pHeight = height;
      } else if (Math.abs(width - pWidth) > 1 || Math.abs(height - pHeight) > 1) {
        tamanhosDiferentes = true;
      }
      docSaida.addPage(page);
    }

    totalPaginas += pages.length;

    if (opcoes.paginaEmBranco && i < arquivos.length - 1) {
      docSaida.addPage();
      totalPaginas++;
    }
  }

  aoProgredir(100, `Finalizando o documento...`);
  await new Promise(r => setTimeout(r, 0));

  const pdfBytes = await docSaida.save();
  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    totalPaginas,
    avisos: {
      tamanhosDiferentes,
      temFormulario
    }
  };
}
