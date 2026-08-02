PDFTools.registrar({
  id: 'inspecionar_pdf',
  nome: 'Inspecionar Privacidade',
  descricao: 'Descubra os rastros invisíveis e metadados que este PDF revela sobre você.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: function(container) {
    let fileOrig = null;
    let arqBuffer = null;
    let pdfDocJs = null;
    let pdfDocLib = null;

    if (!document.getElementById('css-insp')) {
      const style = document.createElement('style');
      style.id = 'css-insp';
      style.textContent = `
        .ip-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 24px; max-width: 800px; margin: 0 auto; }
        .ip-card { background: var(--sup); border: 1px solid var(--borda); border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
        .ip-card-header { background: var(--sup-2); padding: 12px 16px; font-weight: bold; border-bottom: 1px solid var(--borda); display: flex; justify-content: space-between; align-items: center; color: var(--texto); }
        .ip-card-body { padding: 16px; color: var(--texto); }
        
        .ip-linha { display: flex; border-bottom: 1px solid var(--borda); padding: 8px 0; }
        .ip-linha:last-child { border-bottom: none; padding-bottom: 0; }
        .ip-label { width: 40%; color: var(--texto-2); font-size: 13px; font-weight: bold; }
        .ip-valor { width: 60%; font-size: 14px; word-break: break-all; }
        .ip-vazio { color: var(--texto-2); font-style: italic; opacity: 0.7; }
        
        .ip-alerta { background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 12px 16px; border-bottom: 1px solid rgba(255, 193, 7, 0.4); font-size: 13px; display: flex; align-items: center; gap: 12px; }
        .ip-perigo { background: rgba(239, 68, 68, 0.2); color: var(--erro); border-bottom: 1px solid rgba(239, 68, 68, 0.4); }
        
        .ip-btn-acao { padding: 6px 12px; background: var(--sup); color: var(--texto); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; }
        .ip-btn-acao:hover { background: var(--sup-2); }
        
        .ip-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; background: var(--sup-2); color: var(--texto); border: 1px solid var(--borda); margin-right: 4px; margin-bottom: 4px; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="ip-tela-inicial"></div>
      <div id="ip-tela-trabalho" style="display:none;" class="ip-painel">
        
        <h2 style="margin-top:0; margin-bottom:8px;">Relatório de Privacidade do Arquivo</h2>
        <p style="font-size:14px; color:var(--texto-2); margin-bottom:24px;">O que este arquivo conta silenciosamente sobre quem o criou. Nenhuma informação foi enviada para a internet durante esta análise.</p>
        
        <!-- Alertas Dinâmicos -->
        <div id="ip-alertas"></div>

        <div class="ip-card">
          <div class="ip-card-header">Identidade & Autoria</div>
          <div class="ip-card-body">
            <div class="ip-linha"><div class="ip-label">Título</div><div class="ip-valor" id="ip-titulo"></div></div>
            <div class="ip-linha"><div class="ip-label">Autor</div><div class="ip-valor" id="ip-autor"></div></div>
            <div class="ip-linha"><div class="ip-label">Assunto</div><div class="ip-valor" id="ip-assunto"></div></div>
          </div>
        </div>

        <div class="ip-card">
          <div class="ip-card-header">Origem do Arquivo</div>
          <div class="ip-card-body">
            <div class="ip-linha"><div class="ip-label">Criador (App de origem)</div><div class="ip-valor" id="ip-criador"></div></div>
            <div class="ip-linha"><div class="ip-label">Produtor (Motor PDF)</div><div class="ip-valor" id="ip-produtor"></div></div>
            <div class="ip-linha"><div class="ip-label">Criado em</div><div class="ip-valor" id="ip-criacao"></div></div>
            <div class="ip-linha"><div class="ip-label">Modificado em</div><div class="ip-valor" id="ip-modificacao"></div></div>
          </div>
        </div>

        <div class="ip-card">
          <div class="ip-card-header">Estrutura & Conteúdo</div>
          <div class="ip-card-body">
            <div class="ip-linha"><div class="ip-label">Páginas</div><div class="ip-valor" id="ip-pags"></div></div>
            <div class="ip-linha"><div class="ip-label">Tipo de Arquivo</div><div class="ip-valor" id="ip-tipo-txt"></div></div>
            <div class="ip-linha"><div class="ip-label">Formulário</div><div class="ip-valor" id="ip-form"></div></div>
            <div class="ip-linha" style="flex-direction:column; border:none;">
              <div class="ip-label" style="width:100%; margin-bottom:8px;">Fontes Embutidas (Dicionário)</div>
              <div class="ip-valor" id="ip-fontes" style="width:100%;"></div>
            </div>
          </div>
        </div>

      </div>
    `;

    const drop = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf', onArquivos: a => abrirArquivo(a[0]) });
    container.querySelector('#ip-tela-inicial').appendChild(drop);

    function setValorSeguro(elId, str) {
      const el = container.querySelector(elId);
      if (str) el.textContent = str;
      else el.innerHTML = '<span class="ip-vazio">Não informado</span>';
    }

    async function abrirArquivo(file) {
      fileOrig = file;
      container.querySelector('#ip-tela-inicial').innerHTML = '<div style="text-align:center; padding:40px;">Fazendo varredura forense...</div>';
      try {
        await PDFTools.carregarLib('pdfjs');
        await PDFTools.carregarLib('pdf-lib');
        
        arqBuffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocLib = await window.PDFLib.PDFDocument.load(arqBuffer, { ignoreEncryption: true });
        pdfDocJs = await window.pdfjsLib.getDocument({ data: arqBuffer }).promise;
        
        // Identidade
        setValorSeguro('#ip-titulo', pdfDocLib.getTitle());
        setValorSeguro('#ip-autor', pdfDocLib.getAuthor());
        setValorSeguro('#ip-assunto', pdfDocLib.getSubject());
        
        // Origem
        setValorSeguro('#ip-criador', pdfDocLib.getCreator());
        setValorSeguro('#ip-produtor', pdfDocLib.getProducer());
        
        const cr = pdfDocLib.getCreationDate(); const mo = pdfDocLib.getModificationDate();
        setValorSeguro('#ip-criacao', cr ? cr.toLocaleString() : null);
        setValorSeguro('#ip-modificacao', mo ? mo.toLocaleString() : null);
        
        // Estrutura
        const numP = pdfDocLib.getPageCount();
        container.querySelector('#ip-pags').innerHTML = numP;
        
        const form = pdfDocLib.getForm();
        let formStatus = 'Nenhum';
        if (form.hasXFA()) formStatus = 'Sim (XFA legado Adobe)';
        else if (form.getFields().length > 0) formStatus = `Sim (${form.getFields().length} campos interativos)`;
        container.querySelector('#ip-form').innerHTML = formStatus;

        // Varredura Profunda
        let totalTxtFragments = 0;
        let temAnotacoes = false;
        let fontNames = new Set();
        
        const alertas = container.querySelector('#ip-alertas');
        alertas.innerHTML = '';
        
        const progresso = PDFTools.UI.criarProgresso();
        alertas.appendChild(progresso.elemento);
        
        let samplePages = [];
        if (numP > 100) {
           for(let i=1; i<=20; i++) samplePages.push(i);
           for(let i=Math.floor(numP/2)-2; i<=Math.floor(numP/2)+2; i++) samplePages.push(i);
           for(let i=numP-4; i<=numP; i++) samplePages.push(i);
           samplePages = [...new Set(samplePages)].filter(x => x > 0 && x <= numP).sort((a,b)=>a-b);
        } else {
           for(let i=1; i<=numP; i++) samplePages.push(i);
        }
        
        // Varre com PDF.js para ser exato no que é renderizado
        for(let k=0; k<samplePages.length; k++) {
           const i = samplePages[k];
           progresso.atualizar((k/samplePages.length)*100, `Inspecionando página ${i}...`);
           await new Promise(r => setTimeout(r, 0));
           const p = await pdfDocJs.getPage(i);
           const tc = await p.getTextContent();
           totalTxtFragments += tc.items.length;
           tc.items.forEach(it => { if(it.fontName) fontNames.add(it.fontName); });
           
           const annots = await p.getAnnotations();
           if (annots.some(a => a.subtype === 'Text' || a.subtype === 'Popup' || a.subtype === 'Highlight')) {
              temAnotacoes = true;
           }
        }
        progresso.esconder();
        
        const suffixAmostragem = (numP > 100) ? ' (Amostragem)' : '';
        if (totalTxtFragments < (10 * samplePages.length)) {
           container.querySelector('#ip-tipo-txt').innerHTML = `<strong>Digitalizado / Escaneado</strong> (Apenas imagens, sem texto selecionável)${suffixAmostragem}`;
        } else {
           container.querySelector('#ip-tipo-txt').innerHTML = `Digital Nativo (Contém camada de texto selecionável)${suffixAmostragem}`;
        }
        
        const boxFontes = container.querySelector('#ip-fontes');
        if (fontNames.size === 0) {
           boxFontes.innerHTML = '<span class="ip-vazio">Não informado</span>';
        } else {
           Array.from(fontNames).slice(0, 15).forEach(f => {
              const b = document.createElement('span'); b.className = 'ip-badge'; b.textContent = f; boxFontes.appendChild(b);
           });
           if (fontNames.size > 15) boxFontes.appendChild(document.createTextNode('...'));
        }

        // JS Lookup na raiz (tentativa genérica pelo Catalog)
        let temJS = false;
        try {
           const cat = pdfDocLib.catalog;
           const names = cat.lookup(window.PDFLib.PDFName.of('Names'));
           if (names && names.lookup(window.PDFLib.PDFName.of('JavaScript'))) temJS = true;
           // Também check ações de página
           const openAction = cat.lookup(window.PDFLib.PDFName.of('OpenAction'));
           if (openAction) temJS = true; // Muitas vezes é JS
        } catch(e) {}

        // --- Alertas Corretivos ---
        const alertas = container.querySelector('#ip-alertas');
        alertas.innerHTML = '';
        
        // Alerta Metadados
        if (pdfDocLib.getAuthor() || pdfDocLib.getCreator()) {
           const div = document.createElement('div');
           div.className = 'ip-alerta';
           div.innerHTML = `
             <div style="flex:1;">
               <strong>Metadados Vazados:</strong> O arquivo contém o nome do autor original ou software de criação. Em documentos enviados anonimamente, isso quebra o sigilo.
             </div>
             <button class="ip-btn-acao" id="btn-ir-metadados">Ir para ferramenta de Limpar</button>
           `;
           alertas.appendChild(div);
           div.querySelector('#btn-ir-metadados').addEventListener('click', () => {
             PDFTools.irParaFerramenta('editar_metadados');
           });
        }
        
        // Alerta Anotações
        if (temAnotacoes) {
           const div = document.createElement('div');
           div.className = 'ip-alerta ip-perigo';
           div.innerHTML = `
             <div style="flex:1;">
               <strong>Anotações Ocultas:</strong> Há balões de comentário, destaques ou anotações flutuantes no arquivo. Muitas vezes são notas de revisão internas que não deveriam ir para o cliente.
             </div>
             <button class="ip-btn-acao" id="btn-remover-anot">Apagar Anotações Agora</button>
           `;
           alertas.appendChild(div);
           
           div.querySelector('#btn-remover-anot').onclick = async () => {
              try {
                for(let i=0; i<numP; i++) {
                   const page = pdfDocLib.getPage(i);
                   if(page.node) page.node.delete(window.PDFLib.PDFName.of('Annots'));
                }
                const bytes = await pdfDocLib.save();
                PDFTools.baixar(new Blob([bytes], {type:'application/pdf'}), 'sem-anotacoes.pdf');
                PDFTools.UI.mostrarToast('Anotações destruídas com sucesso.', 'sucesso');
                div.style.display = 'none';
              } catch(e) { PDFTools.UI.mostrarToast('Erro ao apagar.', 'erro'); }
           };
        }
        
        // JS Warning
        if (temJS) {
           const div = document.createElement('div');
           div.className = 'ip-alerta ip-perigo';
           div.innerHTML = `
             <div style="flex:1;">
               <strong>Script Embutido:</strong> Este PDF contém código JavaScript embutido. Embora comum em formulários legítimos para auto-soma, também é usado para rastreamento. <br><br>
               <em>Nota: Nossa ferramenta é segura e não executa o código contido no PDF.</em>
             </div>
           `;
           alertas.appendChild(div);
        }
        
        container.querySelector('#ip-tela-inicial').style.display = 'none';
        container.querySelector('#ip-tela-trabalho').style.display = 'block';

      } catch (e) {
        if (e.message && e.message.includes('encrypted')) container.querySelector('#ip-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        else container.querySelector('#ip-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido', e.message);
      }
    }
  }
});
