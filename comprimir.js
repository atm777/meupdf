PDFTools.registrar({
  id: 'comprimir_pdf',
  nome: 'Comprimir PDF',
  descricao: 'Reduza o tamanho do arquivo informando o limite máximo que você precisa.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: function(container) {
    let fileOrig = null;
    let arqBuffer = null;
    
    if (!document.getElementById('css-comprimir')) {
      const style = document.createElement('style');
      style.id = 'css-comprimir';
      style.textContent = `
        .comp-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .comp-col-esq { flex: 1; min-width: 300px; }
        .comp-col-dir { width: 320px; flex-shrink: 0; }
        .comp-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .comp-painel h3 { margin-top: 0; margin-bottom: 16px; font-size: 16px; border-bottom: 1px solid var(--borda); padding-bottom: 8px; }
        .comp-aviso { background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 12px; border-radius: 4px; border: 1px solid rgba(255, 193, 7, 0.4); font-size: 13px; margin-top: 16px; }
        .comp-btn { padding: 6px 12px; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; cursor: pointer; font-size: 13px; }
        .comp-btn:hover { background: var(--sup-2); }
        .comp-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; }
        .comp-btn-acao:hover { background: #004494; }
        .comp-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .comp-input { padding: 8px; border: 1px solid var(--borda); border-radius: 4px; font-size: 14px; width: 100%; box-sizing: border-box; }
        .res-tabela { width: 100%; font-size: 15px; }
        .res-tabela td { padding: 8px 0; border-bottom: 1px solid var(--borda); }
        .res-tabela td:last-child { text-align: right; font-weight: bold; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div class="comp-layout">
        <div class="comp-col-esq">
          <div id="comp-dropzone"></div>
          
          <div id="comp-info" class="comp-painel" style="display:none;">
            <h3>Arquivo Selecionado</h3>
            <div style="font-weight:bold; font-size:15px; word-break:break-all;" id="comp-nome-arq"></div>
            <div style="color: var(--texto-2); font-size:14px; margin-top:4px;" id="comp-meta-arq"></div>
            <div id="comp-analise-aviso" class="comp-aviso" style="display:none;"></div>
          </div>
        </div>

        <div class="comp-col-dir comp-painel" id="comp-opcoes" style="opacity:0.5; pointer-events:none;">
          <h3>Modo de Compressão</h3>
          <div style="margin-bottom:16px;">
            <label style="display:block; margin-bottom:8px; cursor:pointer;">
              <input type="radio" name="comp-modo" value="alvo" checked> 
              <strong>Tamanho Alvo</strong> (Recomendado)
            </label>
            <label style="display:block; cursor:pointer;">
              <input type="radio" name="comp-modo" value="fixa"> 
              Qualidade Fixa
            </label>
          </div>
          
          <div id="bloco-alvo">
            <label style="display:block; font-size:14px; margin-bottom:4px; font-weight:bold;">Tamanho Máximo (MB)</label>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
               <input type="number" id="input-alvo" step="0.1" value="2.0" class="comp-input" style="flex:1;">
            </div>
            <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
               <button class="comp-btn" onclick="document.getElementById('input-alvo').value='0.5'">500 KB</button>
               <button class="comp-btn" onclick="document.getElementById('input-alvo').value='1.0'">1 MB</button>
               <button class="comp-btn" onclick="document.getElementById('input-alvo').value='2.0'">2 MB</button>
               <button class="comp-btn" onclick="document.getElementById('input-alvo').value='5.0'">5 MB</button>
            </div>
            <small style="color: var(--texto-2); display:block; line-height:1.4;">A ferramenta fará uma busca inteligente (até 6 tentativas) para encontrar a melhor qualidade visual que não ultrapasse esse tamanho.</small>
          </div>

          <div id="bloco-fixa" style="display:none;">
            <label style="display:block; font-size:14px; margin-bottom:4px; font-weight:bold;">Qualidade JPEG (%)</label>
            <input type="range" id="input-qualidade" min="10" max="90" value="50" style="width:100%;">
            <div id="lbl-qualidade" style="text-align:center; font-weight:bold; margin-top:8px;">50%</div>
          </div>

          <button id="btn-comprimir" class="comp-btn-acao" style="width:100%; margin-top:24px;">Comprimir PDF</button>
          <div id="comp-progresso-container" style="margin-top:16px;"></div>
        </div>
      </div>

      <div id="comp-resultado" class="comp-painel" style="display:none; border-color:var(--cor-sucesso); margin-top:0;">
        <h3 style="color:var(--cor-sucesso);">PDF Processado</h3>
        <div id="comp-resultado-msg" style="margin-bottom:16px; font-size:14px;"></div>
        
        <div style="display:flex; gap:24px; flex-wrap:wrap;">
          <div style="flex:1; min-width:250px;">
            <table class="res-tabela">
              <tr><td>Original</td><td id="res-orig"></td></tr>
              <tr><td>Final</td><td id="res-final" style="color:var(--cor-primaria);"></td></tr>
              <tr><td>Redução</td><td id="res-reducao" style="color:var(--cor-sucesso);"></td></tr>
            </table>
            
            <button id="btn-baixar-comp" class="comp-btn-acao" style="width:100%; margin-top:24px;">Baixar PDF Comprimido</button>
            <button id="btn-manter-orig" class="comp-btn" style="width:100%; margin-top:8px; display:none; border-color:var(--cor-erro); color:var(--cor-erro);">Manter o Original</button>
          </div>
          <div style="width: 250px; text-align:center; display:flex; flex-direction:column; background:var(--sup-2); padding:8px; border-radius:4px;">
            <div style="font-size:12px; margin-bottom:8px; color: var(--texto-2); font-weight:bold;">Pré-visualização (página 1)</div>
            <div id="comp-preview" style="background: var(--sup); box-shadow:0 1px 3px rgba(0,0,0,0.2); flex-grow:1; display:flex; align-items:center; justify-content:center; overflow:hidden;"></div>
          </div>
        </div>
      </div>
    `;

    const dropzone = PDFTools.UI.criarDropzone({
      multiplo: false,
      aceita: '.pdf, application/pdf',
      onArquivos: (arquivos) => abrirArquivo(arquivos[0])
    });
    container.querySelector('#comp-dropzone').appendChild(dropzone);

    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#comp-progresso-container').appendChild(progresso.elemento);

    // Radios
    const radios = container.querySelectorAll('input[name="comp-modo"]');
    const blocoAlvo = container.querySelector('#bloco-alvo');
    const blocoFixa = container.querySelector('#bloco-fixa');
    radios.forEach(r => r.addEventListener('change', () => {
      if (r.value === 'alvo') { blocoAlvo.style.display = 'block'; blocoFixa.style.display = 'none'; }
      else { blocoAlvo.style.display = 'none'; blocoFixa.style.display = 'block'; }
    }));
    
    // Slider
    const inputQ = container.querySelector('#input-qualidade');
    const lblQ = container.querySelector('#lbl-qualidade');
    inputQ.addEventListener('input', () => lblQ.textContent = inputQ.value + '%');

    async function abrirArquivo(file) {
      if (file.type !== 'application/pdf') return;
      fileOrig = file;
      
      container.querySelector('#comp-dropzone').style.display = 'none';
      container.querySelector('#comp-info').style.display = 'block';
      container.querySelector('#comp-nome-arq').textContent = file.name;
      container.querySelector('#comp-meta-arq').textContent = PDFTools.formatarTamanho(file.size) + ' • Analisando...';
      
      const painelOpcoes = container.querySelector('#comp-opcoes');
      const avisoBox = container.querySelector('#comp-analise-aviso');
      
      try {
        await PDFTools.carregarLib('pdf-lib');
        await PDFTools.carregarLib('pdfjs');
        
        const analise = await analisarPDF(file);
        arqBuffer = analise.buffer;
        
        container.querySelector('#comp-meta-arq').textContent = `${PDFTools.formatarTamanho(file.size)} • ${analise.paginas} páginas`;
        
        if (analise.tipo === 'texto') {
          avisoBox.innerHTML = `<strong>Atenção:</strong> Esse PDF parece ser de texto puro (não contém imagens escaneadas). A redução possível é pequena (5–15%). O modo de tamanho alvo pode não alcançar resultados muito agressivos.`;
          avisoBox.style.display = 'block';
        } else {
          avisoBox.style.display = 'none';
        }

        if (file.size > 150 * 1024 * 1024) { // >150MB
          avisoBox.innerHTML += `<br><br><strong>Arquivo pesado:</strong> O processamento pode deixar o aparelho lento. Recomenda-se fechar outras abas.`;
          avisoBox.style.display = 'block';
        }

        painelOpcoes.style.opacity = '1';
        painelOpcoes.style.pointerEvents = 'auto';

      } catch (err) {
        if (err.name === 'PasswordException' || (err.message && err.message.includes('encrypted'))) {
          avisoBox.innerHTML = PDFTools.erro('pdf_protegido');
        } else {
          avisoBox.innerHTML = PDFTools.erro('pdf_corrompido', err.message);
        }
        avisoBox.style.display = 'block';
      }
    }

    container.querySelector('#btn-comprimir').onclick = async () => {
      if (!arqBuffer) return;
      const btn = container.querySelector('#btn-comprimir');
      const resultadoDiv = container.querySelector('#comp-resultado');
      
      btn.disabled = true;
      resultadoDiv.style.display = 'none';
      
      const modo = container.querySelector('input[name="comp-modo"]:checked').value;
      const params = {};
      if (modo === 'alvo') {
        const mb = parseFloat(container.querySelector('#input-alvo').value) || 2;
        params.alvoBytes = mb * 1024 * 1024;
      } else {
        params.qualidadeFixa = parseInt(container.querySelector('#input-qualidade').value) / 100;
      }

      try {
        const result = await comprimirLogica(arqBuffer, params, (pct, txt) => progresso.atualizar(pct, txt));
        
        // Exibir resultados
        resultadoDiv.style.display = 'block';
        
        const sizeOrig = fileOrig.size;
        const sizeFinal = result.tamanho;
        let pReducao = ((sizeOrig - sizeFinal) / sizeOrig) * 100;
        
        container.querySelector('#res-orig').textContent = PDFTools.formatarTamanho(sizeOrig);
        container.querySelector('#res-final').textContent = PDFTools.formatarTamanho(sizeFinal);
        
        const btnManterOrig = container.querySelector('#btn-manter-orig');
        const btnBaixar = container.querySelector('#btn-baixar-comp');
        const msgDiv = container.querySelector('#comp-resultado-msg');
        
        if (sizeFinal >= sizeOrig) {
          container.querySelector('#res-reducao').textContent = 'Nenhuma (Arquivo aumentou)';
          container.querySelector('#res-reducao').style.color = 'var(--cor-erro)';
          msgDiv.innerHTML = `<strong>A compressão não foi efetiva.</strong> O arquivo original já estava altamente otimizado ou não continha imagens que pudessem ser reduzidas.`;
          btnManterOrig.style.display = 'block';
          btnManterOrig.onclick = () => PDFTools.baixar(fileOrig, fileOrig.name);
        } else {
          container.querySelector('#res-reducao').textContent = `-${pReducao.toFixed(1)}%`;
          container.querySelector('#res-reducao').style.color = 'var(--cor-sucesso)';
          btnManterOrig.style.display = 'none';
          
          if (modo === 'alvo' && sizeFinal > params.alvoBytes) {
            msgDiv.innerHTML = `Consegui chegar a <strong>${PDFTools.formatarTamanho(sizeFinal)}</strong> em ${result.tentativas} tentativas. Abaixo disso o documento ficaria ilegível.<br><small style="color: var(--texto-2);">Dica: Se precisa reduzir mais, use a ferramenta "Organizar Páginas" para remover páginas ou dividir o arquivo.</small>`;
          } else {
            msgDiv.innerHTML = `Compressão finalizada com sucesso após ${result.tentativas} iteração(ões)!`;
          }
        }

        const nome = PDFTools.nomeSemExtensao(fileOrig.name) + '-comprimido.pdf';
        btnBaixar.onclick = () => PDFTools.baixar(result.blob, nome);

        // Preview da primeira página do resultado
        const previewDiv = container.querySelector('#comp-preview');
        previewDiv.innerHTML = '<span style="color:#999; font-size:12px;">Carregando...</span>';
        
        const resBuffer = await result.blob.arrayBuffer();
        const docJs = await window.pdfjsLib.getDocument({ data: resBuffer }).promise;
        const page = await docJs.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.objectFit = 'contain';
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        
        previewDiv.innerHTML = '';
        previewDiv.appendChild(canvas);

        if (result.imagensIgnoradas > 0) {
           msgDiv.innerHTML += `<br><small style="color:#ffc107;">Aviso: ${result.imagensIgnoradas} imagem(ns) estava(m) num formato nativo que não pôde ser recomprimido no navegador.</small>`;
        }

      } catch (err) {
        console.error(err);
        PDFTools.UI.mostrarToast('Erro ao processar: ' + err.message, 'erro');
      } finally {
        progresso.esconder();
        btn.disabled = false;
      }
    };
  }
});

// --- LÓGICA PURA ---

async function analisarPDF(file) {
  const buffer = await PDFTools.lerComoArrayBuffer(file);
  const { PDFDocument, PDFName, PDFRawStream } = window.PDFLib;
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  
  let totalImagens = 0;
  let imagensJpg = 0;

  doc.context.enumerateIndirectObjects().forEach(([ref, pdfObject]) => {
    if (pdfObject instanceof PDFRawStream) {
      const subtype = pdfObject.dict.lookup(PDFName.of('Subtype'));
      if (subtype === PDFName.of('Image')) {
        totalImagens++;
        const filter = pdfObject.dict.lookup(PDFName.of('Filter'));
        let isJpg = false;
        if (filter === PDFName.of('DCTDecode')) isJpg = true;
        else if (filter && filter.name === 'DCTDecode') isJpg = true;
        else if (Array.isArray(filter) && filter.length > 0 && filter[0].name === 'DCTDecode') isJpg = true;
        
        if (isJpg) imagensJpg++;
      }
    }
  });

  const numPages = doc.getPageCount();
  const tipo = (totalImagens === 0) ? 'texto' : (totalImagens < numPages ? 'misto' : 'escaneado');

  return { tipo, paginas: numPages, totalImagens, imagensJpg, buffer };
}

async function comprimirLogica(bufferOriginal, params, aoProgredir) {
  const { PDFDocument, PDFName, PDFRawStream } = window.PDFLib;
  const { alvoBytes, qualidadeFixa } = params;
  
  let melhorBlob = null;
  let melhorTamanho = Infinity;
  let tentativas = 0;
  let imgIgnoradasStats = 0;

  let qMin = 0.15; // Não descer abaixo de 15% senão vira borrão irrecuperável
  let qMax = 0.85; 
  
  const numTentativas = alvoBytes ? 6 : 1;
  let ultimaQualidadeUsada = 0;
  
  for (let t = 0; t < numTentativas; t++) {
    tentativas++;
    let q = alvoBytes ? (qMin + qMax) / 2 : qualidadeFixa;
    ultimaQualidadeUsada = q;
    
    aoProgredir((t / numTentativas) * 100, `Tentativa ${t+1} de ${numTentativas} (Teste a ${Math.round(q*100)}%)...`);
    await new Promise(r => setTimeout(r, 10));

    const doc = await PDFDocument.load(bufferOriginal, { ignoreEncryption: true });
    
    // Limpar Metadados pesados
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator('');

    const refs = doc.context.enumerateIndirectObjects();
    let imgTotal = 0, imgProc = 0;

    for (let i = 0; i < refs.length; i++) {
      const [ref, pdfObject] = refs[i];
      if (pdfObject instanceof PDFRawStream) {
        const subtype = pdfObject.dict.lookup(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Image')) {
           imgTotal++;
           const filter = pdfObject.dict.lookup(PDFName.of('Filter'));
           let isJpg = false;
           if (filter === PDFName.of('DCTDecode') || (filter && filter.name === 'DCTDecode') || (Array.isArray(filter) && filter.length > 0 && filter[0].name === 'DCTDecode')) {
             isJpg = true;
           }
           
           if (isJpg) {
             try {
               const imgBytes = pdfObject.contents;
               const novoJpgBytes = await recomprimirJpeg(imgBytes, q);
               const newImage = await doc.embedJpg(novoJpgBytes);
               doc.context.assign(ref, doc.context.lookup(newImage.ref));
               imgProc++;
             } catch(e) {
               // Falha ao ler a imagem (pode estar com headers corrompidos, ignora)
             }
           }
        }
      }
    }
    
    imgIgnoradasStats = imgTotal - imgProc; // Imagens flate/JBIG2 ou erros

    aoProgredir((t / numTentativas) * 100 + (100 / numTentativas) * 0.8, `Salvando arquivo da tentativa...`);
    await new Promise(r => setTimeout(r, 0));

    const finalBytes = await doc.save({ useObjectStreams: true });
    const atualTamanho = finalBytes.length;
    
    if (alvoBytes) {
      if (atualTamanho <= alvoBytes) {
        // Encontrou um que cabe. Guarda como melhor.
        melhorBlob = new Blob([finalBytes], { type: 'application/pdf' });
        melhorTamanho = atualTamanho;
        qMin = q; // Agora tenta melhorar a qualidade
        
        // Se ficou entre 90% e 100%, paramos (já está excelente)
        if (atualTamanho >= alvoBytes * 0.90) break;
      } else {
        // Ficou grande demais, precisa reduzir qualidade
        qMax = q;
        // Se for a última tentativa e não salvamos nada ainda, salva esse como melhor esforço
        if (t === numTentativas - 1 && !melhorBlob) {
           melhorBlob = new Blob([finalBytes], { type: 'application/pdf' });
           melhorTamanho = atualTamanho;
        }
      }
    } else {
      // Modo qualidade fixa - salva e para
      melhorBlob = new Blob([finalBytes], { type: 'application/pdf' });
      melhorTamanho = atualTamanho;
      break;
    }
  }

  // Se mesmo reduzindo tudo nunca bateu a meta, entrega o melhor (que será a última iteração onde qMin era quase qMax)
  return { blob: melhorBlob, tentativas, tamanho: melhorTamanho, imagensIgnoradas: imgIgnoradasStats };
}

async function recomprimirJpeg(imgBytes, qualidade) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([imgBytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let w = img.width;
      let h = img.height;
      
      let maxPx = 3000;
      if (qualidade < 0.5) maxPx = 1754; // A4 150dpi
      if (qualidade < 0.3) maxPx = 1170; // A4 100dpi
      
      if (w > maxPx || h > maxPx) {
        const p = Math.min(maxPx/w, maxPx/h);
        w = Math.round(w * p);
        h = Math.round(h * p);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      
      canvas.toBlob(async (newBlob) => {
        if (!newBlob) return reject(new Error('toBlob falhou'));
        const buf = await newBlob.arrayBuffer();
        resolve(new Uint8Array(buf));
      }, 'image/jpeg', qualidade);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao decodificar JPEG no navegador'));
    };
    img.src = url;
  });
}
