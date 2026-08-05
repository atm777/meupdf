PDFTools.registrar({
  id: 'extrair_texto',
  nome: 'Extrair Texto (TXT/MD)',
  descricao: 'Extraia todo o texto das páginas para copiar ou salvar como arquivo.',
  precisa: ['pdfjs'],
  montarUI: function(container, arquivoInicial) {
    let fileOrig = null;
    let pdfDocJs = null;
    let numPages = 0;

    if (!document.getElementById('css-txt')) {
      const style = document.createElement('style');
      style.id = 'css-txt';
      style.textContent = `
        .tx-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .tx-main { flex: 1; min-width: 300px; display: flex; flex-direction: column; }
        .tx-sidebar { width: 300px; flex-shrink: 0; }
        .tx-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px; margin-bottom: 16px; display: flex; flex-direction: column; }
        
        .tx-campo { margin-bottom: 12px; }
        .tx-campo label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: var(--texto-2); }
        .tx-input { width: 100%; padding: 8px; border: 1px solid var(--borda); border-radius: 4px; font-size: 14px; box-sizing: border-box; background: var(--sup); color: var(--texto); }
        
        .tx-textarea { flex: 1; min-height: 400px; width: 100%; padding: 12px; border: 1px solid var(--borda); border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.5; resize: vertical; box-sizing: border-box; white-space: pre-wrap; background: var(--sup); color: var(--texto); }
        
        .tx-aviso-escaneado { background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 16px; border-radius: 4px; font-size: 14px; border: 1px solid rgba(255, 193, 7, 0.4); display: none; margin-bottom: 16px; }
        
        .tx-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; margin-bottom: 12px; }
        .tx-btn-acao:hover { background: var(--acento-hover); }
        .tx-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .tx-btn { padding: 8px 12px; background: var(--sup); color: var(--texto); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; width: 100%; margin-bottom: 8px; }
        .tx-btn:hover { background: var(--sup-2); }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="tx-tela-inicial"></div>
      <div id="tx-tela-trabalho" style="display:none;" class="tx-layout">
        <div class="tx-main">
          <div class="tx-aviso-escaneado" id="tx-alerta-scan">
            <strong>⚠️ Esse PDF parece ser digitalizado (escaneado).</strong><br><br>
            Ele contém apenas páginas como imagens (fotografias), sem uma camada de texto real embutida. 
            Para extrair texto de imagens seria necessário tecnologia OCR (Reconhecimento Óptico de Caracteres), 
            o que ainda não temos disponível nativamente no navegador aqui.<br><br>
            Por isso o resultado abaixo pode estar vazio.
          </div>
          
          <div class="tx-painel" style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h3 style="margin:0;">Resultado da Extração</h3>
              <button class="tx-btn" id="btn-copiar" style="width:auto; margin:0; border-color:var(--cor-primaria); color:var(--cor-primaria);">Copiar Tudo</button>
            </div>
            <textarea id="tx-resultado" class="tx-textarea" readonly placeholder="O texto aparecerá aqui..."></textarea>
          </div>
        </div>
        
        <div class="tx-sidebar">
          <div class="tx-painel">
            <h3 style="margin-top:0; border-bottom:1px solid var(--borda); padding-bottom:8px;">Opções</h3>
            
            <div class="tx-campo">
              <label>Páginas (ex: 1-5, 8)</label>
              <input type="text" id="tx-pags" class="tx-input" placeholder="Todas">
            </div>
            
            <div class="tx-campo">
              <label style="display:flex; align-items:center; gap:8px; font-weight:normal;">
                <input type="checkbox" id="tx-quebra-pag" checked>
                Preservar quebras de página
              </label>
            </div>
            
            <div class="tx-campo" style="margin-bottom:24px;">
              <label style="display:flex; align-items:center; gap:8px; font-weight:normal;">
                <input type="checkbox" id="tx-markdown" checked>
                Tentar detectar Títulos (Markdown)
              </label>
            </div>

            <button class="tx-btn-acao" id="btn-extrair">Extrair Texto</button>
            <div id="tx-progresso" style="margin-top:16px; margin-bottom:16px;"></div>
            
            <hr style="border:0; border-top:1px solid var(--borda); margin:16px 0;">
            <button class="tx-btn" id="btn-baixar-txt">Baixar como .TXT</button>
            <button class="tx-btn" id="btn-baixar-md">Baixar como .MD</button>
          </div>
        </div>
      </div>
    `;

    const drop = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf', onArquivos: a => abrirArquivo(a[0]) });
    container.querySelector('#tx-tela-inicial').appendChild(drop);
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#tx-progresso').appendChild(progresso.elemento);

    async function abrirArquivo(file) {
      fileOrig = file;
      container.querySelector('#tx-tela-inicial').innerHTML = '<div style="text-align:center; padding:40px;">Carregando e analisando PDF...</div>';
      try {
        await PDFTools.carregarLib('pdfjs');
        const buffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: buffer }).promise;
        numPages = pdfDocJs.numPages;
        
        container.querySelector('#tx-tela-inicial').style.display = 'none';
        container.querySelector('#tx-tela-trabalho').style.display = 'flex';
        
        // Auto-run na abertura
        container.querySelector('#btn-extrair').click();
      } catch (e) {
        if (e.name === 'PasswordException') container.querySelector('#tx-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        else container.querySelector('#tx-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido', e.message);
      }
    }

    container.querySelector('#btn-copiar').onclick = async () => {
      const area = container.querySelector('#tx-resultado');
      try {
        await navigator.clipboard.writeText(area.value);
        PDFTools.UI.mostrarToast('Texto copiado para a área de transferência.', 'sucesso');
      } catch (err) {
        // Fallback para navegadores antigos
        area.select();
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        PDFTools.UI.mostrarToast('Texto copiado para a área de transferência.', 'sucesso');
      }
    };

    container.querySelector('#btn-baixar-txt').onclick = () => baixarTxt('txt');
    container.querySelector('#btn-baixar-md').onclick = () => baixarTxt('md');

    function baixarTxt(ext) {
      const txt = container.querySelector('#tx-resultado').value;
      if (!txt) return;
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      PDFTools.baixar(blob, PDFTools.nomeSemExtensao(fileOrig.name) + '.' + ext);
    }

    container.querySelector('#btn-extrair').onclick = async () => {
      const btn = container.querySelector('#btn-extrair');
      btn.disabled = true;
      const resultadoArea = container.querySelector('#tx-resultado');
      resultadoArea.value = '';
      container.querySelector('#tx-alerta-scan').style.display = 'none';
      
      const qbPag = container.querySelector('#tx-quebra-pag').checked;
      const optMd = container.querySelector('#tx-markdown').checked;
      
      // Parse de intervalo (ex: 1-5, 8)
      let idxPraExtrair = [];
      const val = container.querySelector('#tx-pags').value.trim();
      if (!val) {
        for(let i=1; i<=numPages; i++) idxPraExtrair.push(i);
      } else {
        const partes = val.split(',');
        partes.forEach(p => {
          if (p.includes('-')) {
             const [ini, fim] = p.split('-').map(Number);
             if(ini && fim) for(let i=ini; i<=fim; i++) idxPraExtrair.push(i);
          } else {
             const v = Number(p);
             if(v) idxPraExtrair.push(v);
          }
        });
        idxPraExtrair = [...new Set(idxPraExtrair)].filter(i => i>0 && i<=numPages).sort((a,b)=>a-b);
      }

      let textoFinal = '';
      let totalFragments = 0;
      let totalPagsLidas = 0;
      
      // Amostragem para descobrir fonte mediana
      let todasFontes = [];

      try {
        for(let k=0; k<idxPraExtrair.length; k++) {
          const numP = idxPraExtrair[k];
          progresso.atualizar((k/idxPraExtrair.length)*100, `Lendo página ${numP}...`);
          await new Promise(r => setTimeout(r, 0));
          
          const page = await pdfDocJs.getPage(numP);
          const tc = await page.getTextContent();
          
          totalFragments += tc.items.length;
          totalPagsLidas++;
          
          if (tc.items.length === 0) {
             if (qbPag && k > 0) textoFinal += '\n\n--- [ Página ' + numP + ' Vazia/Imagens ] ---\n\n';
             continue;
          }

          if (qbPag && k > 0) textoFinal += '\n\n--- [ Página ' + numP + ' ] ---\n\n';

          // Recolhe fontes para descobrir a moda/mediana (para saber o que é título)
          tc.items.forEach(it => {
            const h = it.transform[0]; // Escala Y (aprox font size)
            if (h > 0) todasFontes.push(Math.round(h));
          });
          
          // Reconstrução de Layout
          // 1. Agrupar por Y
          // PDF.js Y cresce para CIMA. Vamos arredondar para o par mais próximo (snap de 2 pt)
          let linhasMap = {};
          tc.items.forEach(it => {
            if (!it.str.trim() && it.str !== ' ') return; // Pula vazios absolutos
            const y = Math.round(it.transform[5] / 2) * 2;
            if(!linhasMap[y]) linhasMap[y] = [];
            linhasMap[y].push(it);
          });

          const YsSorted = Object.keys(linhasMap).map(Number).sort((a,b)=>b-a); // Do topo (maior Y) para a base
          
          // Mediana das fontes desta página para heurística MD
          const fontSorted = [...todasFontes].sort((a,b)=>a-b);
          const medianFont = fontSorted.length > 0 ? fontSorted[Math.floor(fontSorted.length/2)] : 12;

          let lastY = null;
          let ultimaLinhaFoiQuebrada = false;

          for (const y of YsSorted) {
            const linhaItems = linhasMap[y].sort((a,b) => a.transform[4] - b.transform[4]); // Ordena X da esquerda pra direita
            
            let linhaStr = '';
            let lastXEnd = null;
            let heighestFontInLine = 0;
            
            for (const it of linhaItems) {
              const fH = Math.round(it.transform[0]);
              if (fH > heighestFontInLine) heighestFontInLine = fH;
              
              // Se a distância X for grande e não houver espaço na string, injeta um espaço
              if (lastXEnd !== null) {
                const dist = it.transform[4] - lastXEnd;
                // Uma distância maior que 20% do tamanho da fonte justifica um espaço
                if (dist > (medianFont * 0.25) && !linhaStr.endsWith(' ') && !it.str.startsWith(' ')) {
                   linhaStr += ' ';
                }
              }
              linhaStr += it.str;
              lastXEnd = it.transform[4] + it.width;
            }
            
            // Heurística de Parágrafo (salto vertical grande)
            let saltoParagrafo = false;
            if (lastY !== null) {
              const diffY = lastY - y;
              if (diffY > medianFont * 1.6) saltoParagrafo = true; // Salto maior que o entrelinha normal
            }
            
            // Heurística Markdown (Título)
            if (optMd && heighestFontInLine > medianFont * 1.3) {
              linhaStr = '## ' + linhaStr.trim();
              saltoParagrafo = true; // Título sempre quebra
            }

            // Heurística Hifenização no fim de linha
            // Se a última string do texto final termina com "-" sem espaço antes,
            // gruda a linhaStr nela sem pular linha.
            if (textoFinal.endsWith('-') && !textoFinal.endsWith(' -') && !saltoParagrafo) {
               textoFinal = textoFinal.slice(0, -1) + linhaStr; // tira o hífen e gruda
            } else {
               if (saltoParagrafo && textoFinal.length > 0) textoFinal += '\n\n';
               else if (lastY !== null && textoFinal.length > 0 && !textoFinal.endsWith('\n\n')) textoFinal += ' ';
               
               textoFinal += linhaStr;
            }
            
            lastY = y;
          }
        }
        
        // Detecção de PDF escaneado (Se leu várias páginas e quase não achou fragmento de texto)
        if (totalPagsLidas > 0 && totalFragments < 15 * totalPagsLidas) {
          container.querySelector('#tx-alerta-scan').style.display = 'block';
        }
        
        resultadoArea.value = textoFinal.trim() || "(Nenhum texto legível encontrado)";
        
      } catch(e) {
        console.error(e);
        PDFTools.UI.mostrarToast('Erro ao extrair: ' + e.message, 'erro');
      } finally {
        progresso.esconder();
        btn.disabled = false;
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);
  }
});
