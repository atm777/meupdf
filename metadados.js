PDFTools.registrar({
  id: 'editar_metadados',
  nome: 'Editar Metadados',
  descricao: 'Limpe ou altere informações ocultas do PDF, como autor e data de criação.',
  precisa: ['pdf-lib'],
  montarUI: function(container) {
    let fileOrig = null;
    let pdfDoc = null;
    let arqBuffer = null;

    if (!document.getElementById('css-metadados')) {
      const style = document.createElement('style');
      style.id = 'css-metadados';
      style.textContent = `
        .md-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .md-main { flex: 1; min-width: 300px; }
        .md-sidebar { width: 300px; flex-shrink: 0; }
        .md-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        
        .md-campo label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: var(--texto-2); }
        .md-input { width: 100%; padding: 10px; border: 1px solid var(--borda); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--sup); color: var(--texto); }
        
        .md-aviso { background: var(--cor-sucesso-fundo); color: var(--cor-sucesso); padding: 12px; border-radius: 4px; font-size: 13px; border: 1px solid var(--cor-sucesso); margin-bottom: 20px; }
        .md-alerta { background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 12px; border-radius: 4px; font-size: 13px; border: 1px solid rgba(255, 193, 7, 0.4); margin-top: 16px; }
        .md-btn-acao { padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; width: 100%; margin-bottom: 8px; }
        .md-btn-limpar { background: var(--cor-erro); color: white; }
        .md-btn-limpar:hover { background: #c82333; }
        .md-btn-salvar { background: var(--cor-primaria); color: white; }
        .md-btn-salvar:hover { background: #004494; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="md-tela-inicial"></div>
      <div id="md-tela-trabalho" style="display:none;" class="md-layout">
        <div class="md-main">
          <div class="md-painel">
            <h3 style="margin-top:0;">Propriedades do Documento</h3>
            <div class="md-aviso">
              Estas são as informações ocultas gravadas dentro do seu PDF.
            </div>
            
            <div class="md-campo"><label>Título</label><input type="text" id="md-titulo" class="md-input"></div>
            <div class="md-campo"><label>Autor</label><input type="text" id="md-autor" class="md-input"></div>
            <div class="md-campo"><label>Assunto</label><input type="text" id="md-assunto" class="md-input"></div>
            <div class="md-campo"><label>Palavras-chave (separadas por espaço)</label><input type="text" id="md-palavras" class="md-input"></div>
            <div class="md-campo"><label>Criador (Software/App)</label><input type="text" id="md-criador" class="md-input"></div>
            <div class="md-campo"><label>Produtor (Motor PDF)</label><input type="text" id="md-produtor" class="md-input"></div>
            
            <div style="display:flex; gap:16px;">
              <div class="md-campo" style="flex:1;"><label>Data de Criação original</label><input type="text" id="md-criacao" class="md-input" readonly style="background:var(--sup-2);"></div>
              <div class="md-campo" style="flex:1;"><label>Modificação original</label><input type="text" id="md-modificacao" class="md-input" readonly style="background:var(--sup-2);"></div>
            </div>
            
            <div class="md-alerta">
              <strong>Seja honesto:</strong> Limpar metadados remove os dados desta lista, mas <strong>NÃO</strong> remove textos sensíveis que estejam visíveis nas páginas do PDF, nem tarjas falsas. Para destruir textos visíveis, use a ferramenta "Tarjar Documento".
            </div>
          </div>
        </div>
        
        <div class="md-sidebar">
          <div class="md-painel">
            <h3 style="margin-top:0;">Ações</h3>
            <button id="btn-md-limpar" class="md-btn-acao md-btn-limpar">Limpar Tudo e Baixar</button>
            <div style="text-align:center; margin-bottom:8px; font-size:12px; color:var(--texto-2);">(O caso de uso mais comum)</div>
            <hr style="border:0; border-top:1px solid var(--borda); margin:16px 0;">
            <button id="btn-md-salvar" class="md-btn-acao md-btn-salvar">Salvar Alterações</button>
            <div id="md-progresso" style="margin-top:16px;"></div>
          </div>
        </div>
      </div>
    `;

    const dropzone = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf', onArquivos: (a) => abrirArquivo(a[0]) });
    container.querySelector('#md-tela-inicial').appendChild(dropzone);
    
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#md-progresso').appendChild(progresso.elemento);

    async function abrirArquivo(file) {
      fileOrig = file;
      container.querySelector('#md-tela-inicial').innerHTML = '<div style="text-align:center; padding: 40px;">Lendo metadados...</div>';
      
      try {
        await PDFTools.carregarLib('pdf-lib');
        arqBuffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDoc = await window.PDFLib.PDFDocument.load(arqBuffer, { updateMetadata: false });
        
        container.querySelector('#md-titulo').value = pdfDoc.getTitle() || '';
        container.querySelector('#md-autor').value = pdfDoc.getAuthor() || '';
        container.querySelector('#md-assunto').value = pdfDoc.getSubject() || '';
        container.querySelector('#md-palavras').value = (pdfDoc.getKeywords() || []).join(' ');
        container.querySelector('#md-criador').value = pdfDoc.getCreator() || '';
        container.querySelector('#md-produtor').value = pdfDoc.getProducer() || '';
        
        const dCriacao = pdfDoc.getCreationDate();
        const dMod = pdfDoc.getModificationDate();
        container.querySelector('#md-criacao').value = dCriacao ? dCriacao.toLocaleString() : 'Não informada';
        container.querySelector('#md-modificacao').value = dMod ? dMod.toLocaleString() : 'Não informada';

        container.querySelector('#md-tela-inicial').style.display = 'none';
        container.querySelector('#md-tela-trabalho').style.display = 'flex';
      } catch (e) {
        if (e.message && e.message.includes('encrypted')) {
          container.querySelector('#md-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        } else {
          container.querySelector('#md-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido');
        }
      }
    }

    container.querySelector('#btn-md-limpar').onclick = async () => {
      container.querySelector('#md-titulo').value = '';
      container.querySelector('#md-autor').value = '';
      container.querySelector('#md-assunto').value = '';
      container.querySelector('#md-palavras').value = '';
      container.querySelector('#md-criador').value = '';
      container.querySelector('#md-produtor').value = '';
      await salvar(true);
    };

    container.querySelector('#btn-md-salvar').onclick = async () => {
      await salvar(false);
    };

    async function salvar(isLimpeza) {
      progresso.atualizar(10, 'Aplicando metadados...');
      try {
        pdfDoc.setTitle(container.querySelector('#md-titulo').value);
        pdfDoc.setAuthor(container.querySelector('#md-autor').value);
        pdfDoc.setSubject(container.querySelector('#md-assunto').value);
        
        const kw = container.querySelector('#md-palavras').value.split(' ').filter(k => k.trim() !== '');
        pdfDoc.setKeywords(kw);
        
        pdfDoc.setCreator(container.querySelector('#md-criador').value);
        pdfDoc.setProducer(container.querySelector('#md-produtor').value);
        
        if (isLimpeza) {
          const agora = new Date();
          pdfDoc.setCreationDate(agora);
          pdfDoc.setModificationDate(agora);
        } else {
          pdfDoc.setModificationDate(new Date());
        }

        progresso.atualizar(60, 'Salvando...');
        await new Promise(r => setTimeout(r, 0));
        
        const bytes = await pdfDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        const nomeFinal = PDFTools.nomeSemExtensao(fileOrig.name) + (isLimpeza ? '-limpo.pdf' : '-meta.pdf');
        PDFTools.baixar(blob, nomeFinal);
        PDFTools.UI.mostrarToast('Metadados atualizados com sucesso!', 'sucesso');
        
      } catch(e) {
        console.error(e);
        PDFTools.UI.mostrarToast('Erro ao salvar.', 'erro');
      } finally {
        progresso.esconder();
      }
    }
  }
});
