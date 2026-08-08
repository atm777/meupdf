PDFTools.registrar({
  id: 'juntar_pdfs',
  nome: 'Juntar PDFs',
  descricao: 'Combine vários arquivos em um só. Preserve a ordem e mantenha a qualidade original.',
  precisa: ['pdf-lib'],
  montarUI: function(container, arquivoInicial) {
    let itens = [];

    // Chrome de UI via kit global .ft-* (style.css) — sem CSS injetado com hex de tema claro.
    const grid = PDFTools.UI.criarElemento('div', ['ft-layout']);
    const colEsq = PDFTools.UI.criarElemento('div', ['ft-col-main']);
    const colDir = PDFTools.UI.criarElemento('div', ['ft-col-side']);
    grid.appendChild(colEsq);
    grid.appendChild(colDir);

    async function processarNovosArquivos(arquivos) {
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
            // A contagem usa ignoreEncryption:true e "funciona" para PDF protegido; mas o juntarPDFs
            // usa load() sem a flag e falha na hora de gerar. Marcamos aqui p/ avisar na lista (C4).
            item.protegido = !!doc.isEncrypted;
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

    const areaDrop = PDFTools.UI.criarDropzone({
      multiplo: true,
      aceita: '.pdf, application/pdf',
      onArquivos: processarNovosArquivos
    });
    colEsq.appendChild(areaDrop);

    const ordenacao = PDFTools.UI.criarElemento('div', ['ft-toolbar-mini']);
    ordenacao.style.display = 'none';
    const btnOrdNome = PDFTools.UI.criarElemento('button', ['ft-btn'], 'Ordenar por Nome');
    btnOrdNome.type = 'button';
    btnOrdNome.onclick = () => { itens.sort((a, b) => a.file.name.localeCompare(b.file.name)); renderLista(); };
    ordenacao.appendChild(btnOrdNome);
    colEsq.appendChild(ordenacao);

    const grade = PDFTools.UI.criarElemento('div', ['ft-lista']);
    colEsq.appendChild(grade);

    const resumo = PDFTools.UI.criarElemento('div', ['ft-resumo']);
    resumo.style.display = 'none';
    colEsq.appendChild(resumo);

    const avisoBox = PDFTools.UI.criarElemento('div', ['ft-aviso']);
    avisoBox.style.display = 'none';
    colEsq.appendChild(avisoBox);

    colDir.innerHTML = `
      <div class="ft-opcoes-grupo">
        <label>
          <input type="checkbox" id="jt-opt-branco">
          <div>
            <strong>Página em branco</strong>
            <span class="dica">Insere separador entre documentos (útil para impressão frente e verso).</span>
          </div>
        </label>
      </div>
      <div class="ft-opcoes-grupo">
        <label>
          <input type="checkbox" id="jt-opt-metadados" checked>
          <div>
            <strong>Limpar metadados</strong>
            <span class="dica">Remove autor e dados do documento. Evita que dados do 1º arquivo vazem para o resultado.</span>
          </div>
        </label>
      </div>
      <div class="ft-opcoes-grupo">
        <label>
          <strong>Nome do Arquivo</strong>
        </label>
        <input type="text" id="jt-opt-nome" class="ft-input" value="juntado-${new Date().toISOString().split('T')[0]}">
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
          paginaEmBranco: container.querySelector('#jt-opt-branco').checked,
          limparMetadados: container.querySelector('#jt-opt-metadados').checked
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
          avisoBox.innerHTML = '<strong>Observações:</strong><br>';
          const avisosContainer = document.createElement("div");
          avisosContainer.innerHTML = avisosHtml.join("<br>");
          avisoBox.appendChild(avisosContainer);
          avisoBox.style.display = 'block';
        }

        const nome = container.querySelector('#jt-opt-nome').value.trim() || 'documento';
        const nomeFinal = nome.endsWith('.pdf') ? nome : nome + '.pdf';
        
        areaResultado.style.display = 'block';
        areaResultado.querySelector('.res-tamanho').textContent = PDFTools.formatarTamanho(resultado.blob.size);
        areaResultado.querySelector('.res-paginas').textContent = `${resultado.totalPaginas} páginas`;
        
        const btnBaixar = areaResultado.querySelector('button');
        btnBaixar.onclick = () => PDFTools.baixar(resultado.blob, nomeFinal);

        btnBaixar.click();

        const proxSlot = areaResultado.querySelector('.prox-passos-slot');
        proxSlot.innerHTML = '';
        const prox = PDFTools.UI.criarProximosPassos({
          blob: resultado.blob, nomeArquivo: nomeFinal, origemId: 'juntar_pdfs', tamanhoBytes: resultado.blob.size
        });
        if (prox) proxSlot.appendChild(prox);
        PDFTools.registrarAcaoSessao('Juntou os PDFs');

      } catch (err) {
        PDFTools.UI.toastErro(err);
      } finally {
        progresso.esconder();
        btnGerar.disabled = false;
      }
    });
    colDir.appendChild(btnGerar);

    const areaResultado = PDFTools.UI.criarElemento('div', ['ft-resultado']);
    areaResultado.innerHTML = `
      <p>PDF Pronto!</p>
      <div style="font-size:14px; margin-bottom:4px;">Tamanho final: <strong class="res-tamanho"></strong></div>
      <div style="font-size:14px; margin-bottom:12px;">Total de páginas: <strong class="res-paginas"></strong></div>
      <button type="button" class="ft-btn-acao" style="min-height:40px; margin-top:0;">Baixar Novamente</button>
      <div class="prox-passos-slot"></div>
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

        const el = PDFTools.UI.criarElemento('div', ['ft-lista-item']);
        el.draggable = true;

        const txtPaginas = (item.carregando ? 'Calculando...' : (item.numPages === '?' ? 'Erro' : `${item.numPages} pág(s)`)) + (item.protegido ? ' · protegido (senha)' : '');

        el.innerHTML = `
          <div style="font-size:24px;line-height:1" aria-hidden="true">📄</div>
          <div class="ft-lista-item-info">
            <div class="ft-lista-item-title"></div>
            <div class="ft-lista-item-meta">${PDFTools.formatarTamanho(item.file.size)} • ${txtPaginas}</div>
          </div>
          <div class="ft-lista-acoes">
            <button type="button" class="ft-btn btn-up" aria-label="Mover para cima">↑</button>
            <button type="button" class="ft-btn btn-down" aria-label="Mover para baixo">↓</button>
            <button type="button" class="ft-btn del" aria-label="Remover">✕</button>
          </div>
        `;
        // Nome exibido via textContent: preserva acentos e é seguro contra HTML no nome.
        const tituloEl = el.querySelector('.ft-lista-item-title');
        tituloEl.textContent = item.file.name;
        tituloEl.title = item.file.name;

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
          grade.querySelectorAll('.ft-lista-item').forEach(n => n.classList.remove('drag-over'));
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

    if (arquivoInicial) processarNovosArquivos([arquivoInicial]);
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
      throw new Error(`Falha ao ler o arquivo "${PDFTools.sanitizarNome(file.name)}".`);
    }

    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(buffer);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('encrypted')) {
         throw new Error(`O arquivo "${PDFTools.sanitizarNome(file.name)}" está protegido por senha.`);
      }
      throw new Error(`O arquivo "${PDFTools.sanitizarNome(file.name)}" parece estar corrompido.`);
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
