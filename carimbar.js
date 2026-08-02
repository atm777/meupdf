// Motor compartilhado: monta a UI de carimbo já focada em UMA tarefa (numerar OU marca d'água).
// Registrado como duas ferramentas separadas mais abaixo, cada uma com seu próprio botão.
function montarCarimboUI(container, modoFixo) {
    let fileOrig = null;
    let arqBuffer = null;
    let pdfDocJs = null;

    if (!document.getElementById('css-carimbo')) {
      const style = document.createElement('style');
      style.id = 'css-carimbo';
      style.textContent = `
        .cr-layout { display: flex; gap: 24px; flex-wrap: wrap; }
        .cr-main { flex: 1; min-width: 300px; display: flex; flex-direction: column; }
        .cr-sidebar { width: 320px; flex-shrink: 0; }
        .cr-painel { background: var(--sup-2); border: 1px solid var(--borda); border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .cr-aba-nav { display: flex; border-bottom: 1px solid var(--borda); margin-bottom: 16px; }
        .cr-aba { padding: 8px 16px; cursor: pointer; border-bottom: 2px solid transparent; font-weight: bold; color: var(--texto-2); }
        .cr-aba.ativa { border-bottom-color: var(--cor-primaria); color: var(--cor-primaria); }
        .cr-campo { margin-bottom: 12px; }
        .cr-campo label { display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: var(--texto-2); }
        .cr-input { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
        .cr-preview-container { background: var(--sup-2); display: flex; align-items: center; justify-content: center; min-height: 400px; border-radius: 8px; overflow: hidden; padding: 16px; }
        .cr-preview-container canvas { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: var(--sup); }
        .cr-btn-acao { padding: 12px; background: var(--cor-primaria); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; }
        .cr-btn-acao:hover { background: #004494; }
        .cr-btn-acao:disabled { background: #ccc; cursor: not-allowed; }
        .cr-btn-preview { background: var(--sup); border: 1px solid var(--cor-primaria); color: var(--cor-primaria); font-weight: bold; padding: 8px; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 16px; }
        .cr-btn-preview:hover { background: #e6f0fa; }
        .cr-aviso-marca { font-size: 12px; color: #ffc107; background: rgba(255, 193, 7, 0.2); padding: 8px; border-radius: 4px; margin-top: 16px; }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div id="cr-tela-inicial"></div>
      <div id="cr-tela-trabalho" style="display:none;" class="cr-layout">
        <div class="cr-main">
          <div class="cr-painel" style="flex: 1; display: flex; flex-direction: column;">
            <h3 style="margin-top:0;">Pré-visualização (Página de Teste)</h3>
            <div style="display:flex; gap:8px; margin-bottom:12px; align-items:center;">
              <span style="font-size:13px; font-weight:bold;">Visualizar página:</span>
              <input type="number" id="cr-preview-pag" value="1" min="1" class="cr-input" style="width:70px; padding:4px;">
              <button id="btn-atualizar-prev" class="cr-btn-preview" style="width:auto; margin:0;">Atualizar Pré-visualização</button>
            </div>
            <div class="cr-preview-container" id="cr-preview-box"></div>
          </div>
        </div>

        <div class="cr-sidebar">
          <div class="cr-painel">
            <div id="aba-num">
              <div class="cr-campo">
                <label>Posição</label>
                <select id="nm-posicao" class="cr-input">
                  <option value="rodape-centro">Rodapé Centro</option>
                  <option value="rodape-direita">Rodapé Direita</option>
                  <option value="rodape-esquerda">Rodapé Esquerda</option>
                  <option value="cabecalho-centro">Cabeçalho Centro</option>
                  <option value="cabecalho-direita">Cabeçalho Direita</option>
                  <option value="cabecalho-esquerda">Cabeçalho Esquerda</option>
                </select>
              </div>
              <div class="cr-campo">
                <label>Formato</label>
                <select id="nm-formato" class="cr-input">
                  <option value="1">1, 2, 3...</option>
                  <option value="1 de N">1 de 20</option>
                  <option value="Pagina 1 de N">Página 1 de 20</option>
                  <option value="- 1 -">- 1 -</option>
                </select>
              </div>
              <div style="display:flex; gap:8px;">
                <div class="cr-campo" style="flex:1;"><label>Iniciar na pág</label><input type="number" id="nm-iniciar-pag" class="cr-input" value="1" min="1" title="Pula a capa se começar em 2"></div>
                <div class="cr-campo" style="flex:1;"><label>Nº Inicial</label><input type="number" id="nm-iniciar-num" class="cr-input" value="1" min="1"></div>
              </div>
              <div style="display:flex; gap:8px;">
                <div class="cr-campo" style="flex:1;"><label>Tamanho</label><input type="number" id="nm-tamanho" class="cr-input" value="12"></div>
                <div class="cr-campo" style="flex:1;"><label>Cor</label><input type="color" id="nm-cor" class="cr-input" value="#000000" style="padding:4px;"></div>
              </div>
            </div>

            <div id="aba-marca" style="display:none;">
              <div class="cr-campo">
                <label>Texto da Marca (Acentos suportados)</label>
                <input type="text" id="mc-texto" class="cr-input" value="CÓPIA NÃO AUTORIZADA">
              </div>
              <div class="cr-campo">
                <label>Posição</label>
                <select id="mc-posicao" class="cr-input">
                  <option value="centro">Centralizada no documento</option>
                  <option value="repetida">Lado a lado (Padrão repetido)</option>
                </select>
              </div>
              <div style="display:flex; gap:8px;">
                <div class="cr-campo" style="flex:1;"><label>Tamanho</label><input type="number" id="mc-tamanho" class="cr-input" value="60"></div>
                <div class="cr-campo" style="flex:1;"><label>Rotação (graus)</label><input type="number" id="mc-rotacao" class="cr-input" value="45"></div>
              </div>
              <div style="display:flex; gap:8px;">
                <div class="cr-campo" style="flex:1;"><label>Cor</label><input type="color" id="mc-cor" class="cr-input" value="#ff0000" style="padding:4px;"></div>
                <div class="cr-campo" style="flex:1;"><label>Opacidade (%)</label><input type="number" id="mc-opacidade" class="cr-input" value="20" min="5" max="100"></div>
              </div>
              
              <div class="cr-aviso-marca">
                <strong>Honestidade:</strong> Marca d'água é uma sinalização visual. Ela não impede que alguém mal intencionado a remova usando editores avançados. Não é criptografia.
              </div>
            </div>

            <hr style="border:0; border-top: 1px solid var(--borda); margin:16px 0;">
            <button id="btn-gerar" class="cr-btn-acao">Gerar PDF</button>
            <div id="cr-progresso" style="margin-top:16px;"></div>
          </div>
        </div>
      </div>
    `;

    const drop = PDFTools.UI.criarDropzone({ multiplo: false, aceita: '.pdf', onArquivos: a => abrirArquivo(a[0]) });
    container.querySelector('#cr-tela-inicial').appendChild(drop);
    const progresso = PDFTools.UI.criarProgresso();
    container.querySelector('#cr-progresso').appendChild(progresso.elemento);

    const modoAtual = modoFixo; // 'num' ou 'marca' — fixo, cada botão da tela inicial abre só um modo
    container.querySelector('#aba-num').style.display = modoAtual === 'num' ? 'block' : 'none';
    container.querySelector('#aba-marca').style.display = modoAtual === 'marca' ? 'block' : 'none';

    async function abrirArquivo(file) {
      fileOrig = file;
      container.querySelector('#cr-tela-inicial').innerHTML = '<div style="text-align:center; padding:40px;">Lendo arquivo...</div>';
      try {
        await PDFTools.carregarLib('pdf-lib');
        await PDFTools.carregarLib('pdfjs');
        arqBuffer = await PDFTools.lerComoArrayBuffer(file);
        pdfDocJs = await window.pdfjsLib.getDocument({ data: arqBuffer }).promise;
        
        container.querySelector('#cr-tela-inicial').style.display = 'none';
        container.querySelector('#cr-tela-trabalho').style.display = 'flex';
        
        gerarPreview();
      } catch (e) {
        if (e.message && e.message.includes('encrypted')) container.querySelector('#cr-tela-inicial').innerHTML = PDFTools.erro('pdf_protegido');
        else container.querySelector('#cr-tela-inicial').innerHTML = PDFTools.erro('pdf_corrompido');
      }
    }

    container.querySelector('#btn-atualizar-prev').onclick = gerarPreview;

    function lerConfiguracao() {
      if (modoAtual === 'num') {
        return {
          modo: 'num',
          posicao: container.querySelector('#nm-posicao').value,
          formato: container.querySelector('#nm-formato').value,
          iniciarPag: parseInt(container.querySelector('#nm-iniciar-pag').value) || 1,
          iniciarNum: parseInt(container.querySelector('#nm-iniciar-num').value) || 1,
          tamanho: parseInt(container.querySelector('#nm-tamanho').value) || 12,
          cor: hexToRgb(container.querySelector('#nm-cor').value)
        };
      } else {
        return {
          modo: 'marca',
          texto: container.querySelector('#mc-texto').value,
          posicao: container.querySelector('#mc-posicao').value,
          tamanho: parseInt(container.querySelector('#mc-tamanho').value) || 60,
          rotacao: parseInt(container.querySelector('#mc-rotacao').value) || 0,
          cor: hexToRgb(container.querySelector('#mc-cor').value),
          opacidade: (parseInt(container.querySelector('#mc-opacidade').value) || 20) / 100
        };
      }
    }

    async function gerarPreview() {
      const pagPreview = parseInt(container.querySelector('#cr-preview-pag').value) || 1;
      const box = container.querySelector('#cr-preview-box');
      box.innerHTML = 'Renderizando preview...';
      
      try {
        const conf = lerConfiguracao();
        
        // Aplica a edição em memória apenas para a página selecionada
        const docTemp = await window.PDFLib.PDFDocument.load(arqBuffer.slice(0), { ignoreEncryption:true });
        const numTotal = docTemp.getPageCount();
        
        const idxPag = Math.max(0, Math.min(pagPreview - 1, numTotal - 1));
        await aplicarCarimbo(docTemp, [idxPag], conf, numTotal);
        
        const tempBytes = await docTemp.save();
        const tempDocJs = await window.pdfjsLib.getDocument({ data: tempBytes }).promise;
        const page = await tempDocJs.getPage(idxPag + 1);
        
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        
        box.innerHTML = '';
        box.appendChild(canvas);
      } catch (e) {
        console.error(e);
        box.innerHTML = '<span style="color:var(--cor-erro);">Erro ao gerar preview.</span>';
      }
    }

    container.querySelector('#btn-gerar').onclick = async () => {
      const btn = container.querySelector('#btn-gerar');
      btn.disabled = true;
      try {
        const conf = lerConfiguracao();
        const doc = await window.PDFLib.PDFDocument.load(arqBuffer, { ignoreEncryption:true });
        const numTotal = doc.getPageCount();
        
        // Array com todos os índices
        const todasAsPag = Array.from({length: numTotal}, (_, i) => i);
        
        progresso.atualizar(20, 'Aplicando carimbos...');
        await aplicarCarimbo(doc, todasAsPag, conf, numTotal);
        
        progresso.atualizar(80, 'Salvando...');
        const bytes = await doc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        const sufixo = modoAtual === 'num' ? '-numerado.pdf' : '-marca-dagua.pdf';
        PDFTools.baixar(blob, PDFTools.nomeSemExtensao(fileOrig.name) + sufixo);
        PDFTools.UI.mostrarToast('Concluído!', 'sucesso');
      } catch(e) {
         console.error(e);
         PDFTools.UI.mostrarToast('Erro: ' + e.message, 'erro');
      } finally {
         btn.disabled = false;
         progresso.esconder();
      }
    };
}

PDFTools.registrar({
  id: 'numerar_paginas',
  nome: 'Numerar Páginas',
  descricao: 'Adicione numeração de páginas em rodapé ou cabeçalho, em qualquer formato.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: (container) => montarCarimboUI(container, 'num')
});

PDFTools.registrar({
  id: 'marca_dagua',
  nome: "Marca d'Água",
  descricao: 'Adicione um carimbo de texto (ex: CONFIDENCIAL) sobre todas as páginas.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: (container) => montarCarimboUI(container, 'marca')
});

// Hex to {r,g,b} 0-1
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : {r:0, g:0, b:0};
}

async function aplicarCarimbo(pdfDoc, indicesPags, conf, totalPagsOriginal) {
  const { rgb, degrees, StandardFonts } = window.PDFLib;

  // Fonte WinAnsi cobre português (ç, ã, é) nativamente no PDF
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i of indicesPags) {
    if (conf.modo === 'num' && (i + 1) < conf.iniciarPag) continue; // Pula capa

    const page = pdfDoc.getPage(i);
    // page.getSize() sempre retorna as dimensões BRUTAS do MediaBox, sem considerar /Rotate.
    const { width: rawW, height: rawH } = page.getSize();
    const R = ((page.getRotation().angle % 360) + 360) % 360;
    // Dimensões VISUAIS (como o usuário vê a página na tela), usadas para posicionar.
    const { width: visW, height: visH } = PDFTools.dimensoesVisuais(rawW, rawH, R);

    if (conf.modo === 'num') {
      const numAtual = conf.iniciarNum + (i + 1) - conf.iniciarPag;
      let txt = '';
      if (conf.formato === '1') txt = `${numAtual}`;
      else if (conf.formato === '1 de N') txt = `${numAtual} de ${totalPagsOriginal}`;
      else if (conf.formato === 'Pagina 1 de N') txt = `Página ${numAtual} de ${totalPagsOriginal}`;
      else if (conf.formato === '- 1 -') txt = `- ${numAtual} -`;

      const txtW = font.widthOfTextAtSize(txt, conf.tamanho);
      const txtH = font.heightAtSize(conf.tamanho);

      let visX = 0, visYTopo = 0;
      const margemY = 30;
      const margemX = 40;

      if (conf.posicao.includes('centro')) visX = (visW / 2) - (txtW / 2);
      else if (conf.posicao.includes('direita')) visX = visW - txtW - margemX;
      else if (conf.posicao.includes('esquerda')) visX = margemX;

      // Coordenada visual é top-down: rodapé fica perto da base (Y grande), cabeçalho perto do topo (Y pequeno).
      if (conf.posicao.includes('rodape')) visYTopo = visH - margemY - txtH;
      else if (conf.posicao.includes('cabecalho')) visYTopo = margemY;

      // Converte a posição visual desejada para o espaço bruto do PDF, compensando /Rotate.
      const t = PDFTools.posicaoRotacionada(visX, visYTopo, txtW, txtH, rawW, rawH, R);
      page.drawText(txt, {
        x: t.x, y: t.y, size: conf.tamanho, font, color: rgb(conf.cor.r, conf.cor.g, conf.cor.b),
        rotate: degrees(t.rotate)
      });

    } else { // Marca d'água
      const txt = conf.texto;
      const txtW = font.widthOfTextAtSize(txt, conf.tamanho);
      const txtH = font.heightAtSize(conf.tamanho);

      const opcoesBase = {
        size: conf.tamanho,
        font,
        color: rgb(conf.cor.r, conf.cor.g, conf.cor.b),
        opacity: conf.opacidade
      };

      // Rotação total no espaço bruto = rotação decorativa do usuário + compensação de /Rotate da página.
      const rotTotal = conf.rotacao + R;

      if (conf.posicao === 'centro') {
        // Ancora tal que, após rotacionar por rotTotal ao redor da âncora, o CENTRO do texto
        // caia exatamente no centro bruto da página (que corresponde ao centro visual,
        // pois o centro de um retângulo é invariável sob rotação ao redor de si mesmo).
        const rad = (rotTotal * Math.PI) / 180;
        const xOffset = (txtW/2)*Math.cos(rad) - (txtH/2)*Math.sin(rad);
        const yOffset = (txtW/2)*Math.sin(rad) + (txtH/2)*Math.cos(rad);

        page.drawText(txt, {
          ...opcoesBase,
          x: (rawW/2) - xOffset,
          y: (rawH/2) - yOffset,
          rotate: degrees(rotTotal)
        });
      } else {
        // Repetida (Tiled): gera a grade em coordenadas VISUAIS e converte cada ponto
        // individualmente para o espaço bruto, já compensando /Rotate.
        const stepX = txtW + 50;
        const stepY = txtH + 100;
        const diag = Math.sqrt(visW*visW + visH*visH);
        for(let py = -diag; py < diag*1.5; py += stepY) {
          for(let px = -diag; px < diag*1.5; px += stepX) {
            const t = PDFTools.posicaoRotacionada(px, py, 0, 0, rawW, rawH, R);
            page.drawText(txt, { ...opcoesBase, x: t.x, y: t.y, rotate: degrees(rotTotal) });
          }
        }
      }
    }
  }
}
