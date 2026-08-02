PDFTools.registrar({
  id: 'imagens_para_pdf',
  nome: 'Imagens para PDF',
  descricao: 'Transforme fotos e imagens em um único arquivo PDF. Ordenação fácil e redução inteligente de tamanho.',
  precisa: ['pdf-lib'],
  montarUI: function(container) {
    let itens = []; 
    
    if (!document.getElementById('css-imagens-pdf')) {
      const style = document.createElement('style');
      style.id = 'css-imagens-pdf';
      style.textContent = `
        .ferramenta-grid { display: flex; gap: 24px; flex-wrap: wrap; }
        .ferramenta-col-esq { flex: 1; min-width: 300px; }
        .ferramenta-col-dir { width: 300px; flex-shrink: 0; background: var(--sup-2); padding: 16px; border-radius: 8px; border: 1px solid var(--borda); }
        .img-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin-top: 16px; max-height: 400px; overflow-y: auto; padding: 4px; }
        .img-item { border: 1px solid var(--borda); border-radius: 4px; padding: 4px; background: var(--sup); cursor: grab; position: relative; display: flex; flex-direction: column; }
        .img-item:active { cursor: grabbing; }
        .img-item.dragging { opacity: 0.5; }
        .img-item.drag-over { border-color: var(--cor-primaria); box-shadow: 0 0 0 2px var(--cor-primaria); }
        .img-thumb { width: 100%; height: 80px; object-fit: cover; border-radius: 2px; margin-bottom: 4px; }
        .img-nome { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; text-align: center; }
        .img-acoes { display: flex; justify-content: space-between; }
        .img-acoes button { background: var(--sup-2); border: 1px solid #ced4da; border-radius: 4px; cursor: pointer; padding: 2px 8px; font-size: 12px; }
        .img-acoes button:hover { background: #dde0e3; }
        .img-acoes button.del { color: var(--cor-erro); font-weight: bold; }
        .ordenacao-acoes { display: flex; gap: 8px; margin-top: 16px; }
        .ordenacao-acoes button { font-size: 12px; padding: 6px 12px; cursor: pointer; background: var(--sup); border: 1px solid var(--borda); border-radius: 4px; }
        .ordenacao-acoes button:hover { background: #f0f0f0; }
        .opcoes-grupo { margin-bottom: 16px; }
        .opcoes-grupo label { display: block; font-size: 14px; font-weight: bold; margin-bottom: 4px; }
        .opcoes-grupo select, .opcoes-grupo input { width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--borda); font-size: 14px; box-sizing: border-box; }
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
      aceita: 'image/jpeg, image/png, image/webp',
      onArquivos: (arquivos) => {
        let ignorados = 0;
        arquivos.forEach(file => {
          if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
            alert(`O navegador não abre arquivos HEIC (${file.name}).\nNo iPhone, em Ajustes > Câmera > Formatos, escolha 'Mais compatível', ou compartilhe a foto pelo WhatsApp primeiro (isso converte para JPG).`);
            return;
          }
          if (PDFTools.ehImagem(file)) {
            itens.push({
              id: Math.random().toString(36).substring(2, 9),
              file: file,
              url: URL.createObjectURL(file)
            });
          } else {
            ignorados++;
          }
        });
        if (ignorados > 0) PDFTools.UI.mostrarToast(`${ignorados} arquivo(s) ignorado(s) por não serem imagens suportadas.`, 'erro');
        renderLista();
      }
    });
    colEsq.appendChild(areaDrop);

    const ordenacao = PDFTools.UI.criarElemento('div', ['ordenacao-acoes']);
    ordenacao.style.display = 'none';
    const btnOrdNome = PDFTools.UI.criarElemento('button', [], 'Ordenar por Nome');
    btnOrdNome.onclick = () => { itens.sort((a, b) => a.file.name.localeCompare(b.file.name)); renderLista(); };
    const btnOrdData = PDFTools.UI.criarElemento('button', [], 'Ordenar por Data');
    btnOrdData.onclick = () => { itens.sort((a, b) => (a.file.lastModified || 0) - (b.file.lastModified || 0)); renderLista(); };
    ordenacao.appendChild(btnOrdNome);
    ordenacao.appendChild(btnOrdData);
    colEsq.appendChild(ordenacao);

    const grade = PDFTools.UI.criarElemento('div', ['img-grade']);
    colEsq.appendChild(grade);

    colDir.innerHTML = `
      <div class="opcoes-grupo">
        <label>Tamanho da Página</label>
        <select id="opt-tamanho">
          <option value="a4" selected>A4</option>
          <option value="carta">Carta</option>
          <option value="ajustar">Ajustar à imagem</option>
        </select>
      </div>
      <div class="opcoes-grupo">
        <label>Orientação</label>
        <select id="opt-orientacao">
          <option value="auto" selected>Automática</option>
          <option value="retrato">Retrato</option>
          <option value="paisagem">Paisagem</option>
        </select>
      </div>
      <div class="opcoes-grupo">
        <label>Margem</label>
        <select id="opt-margem">
          <option value="nenhuma">Nenhuma</option>
          <option value="pequena" selected>Pequena</option>
          <option value="media">Média</option>
        </select>
      </div>
      <div class="opcoes-grupo">
        <label>Qualidade</label>
        <select id="opt-qualidade">
          <option value="alta">Alta</option>
          <option value="media" selected>Média</option>
          <option value="baixa">Reduzir peso</option>
        </select>
      </div>
      <div class="opcoes-grupo">
        <label>Nome do Arquivo</label>
        <input type="text" id="opt-nome" value="documento-${new Date().toISOString().split('T')[0]}">
      </div>
    `;

    const progresso = PDFTools.UI.criarProgresso();
    colDir.appendChild(progresso.elemento);

    const btnGerar = PDFTools.UI.criarBotaoPrincipal('Gerar PDF', async () => {
      if (itens.length === 0) return;
      
      const totalMb = itens.reduce((acc, i) => acc + i.file.size, 0) / (1024 * 1024);
      if (totalMb > PDFTools.LIMITE_AVISO_MB) {
        if (!confirm(`Você está prestes a processar ${totalMb.toFixed(1)} MB de imagens. Isso pode demorar e travar aparelhos mais fracos. Deseja continuar?`)) {
          return;
        }
      }

      btnGerar.disabled = true;
      areaResultado.style.display = 'none';
      
      try {
        await PDFTools.carregarLib('pdf-lib');
        
        const opcoes = {
          tamanho: document.getElementById('opt-tamanho').value,
          orientacao: document.getElementById('opt-orientacao').value,
          margem: document.getElementById('opt-margem').value,
          qualidade: document.getElementById('opt-qualidade').value
        };

        const arquivos = itens.map(i => i.file);
        
        const resultado = await imagensParaPDF(arquivos, opcoes, (pct, txt) => {
          progresso.atualizar(pct, txt);
        });

        if (resultado.erros.length > 0) {
          PDFTools.UI.mostrarToast(`PDF gerado, mas houve problemas em ${resultado.erros.length} imagem(ns).`, 'erro');
          console.warn('Erros:', resultado.erros);
        } else {
          PDFTools.UI.mostrarToast('PDF gerado com sucesso!', 'sucesso');
        }

        const nome = document.getElementById('opt-nome').value.trim() || 'documento';
        const nomeFinal = nome.endsWith('.pdf') ? nome : nome + '.pdf';
        
        areaResultado.style.display = 'block';
        areaResultado.querySelector('.res-tamanho').textContent = PDFTools.formatarTamanho(resultado.blob.size);
        
        const btnBaixar = areaResultado.querySelector('button');
        btnBaixar.onclick = () => PDFTools.baixar(resultado.blob, nomeFinal);
        
        btnBaixar.click(); // Auto-baixar

      } catch (err) {
        console.error(err);
        const el = document.createElement('div');
        el.innerHTML = PDFTools.erro('desconhecido', err.message);
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
      <div style="font-size:14px; margin-bottom:12px;">Tamanho final: <strong class="res-tamanho"></strong></div>
      <button class="pdf-btn-principal" style="min-height:40px; margin-top:0;">Baixar Novamente</button>
    `;
    colDir.appendChild(areaResultado);

    container.appendChild(grid);

    let draggedIndex = null;

    function renderLista() {
      grade.innerHTML = '';
      if (itens.length === 0) {
        grade.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color: var(--texto-2); padding:20px;">Nenhuma imagem selecionada.</div>';
        ordenacao.style.display = 'none';
        btnGerar.disabled = true;
        return;
      }

      ordenacao.style.display = 'flex';
      btnGerar.disabled = false;
      
      itens.forEach((item, index) => {
        const el = PDFTools.UI.criarElemento('div', ['img-item']);
        el.draggable = true;
        
        el.innerHTML = `
          <img src="${item.url}" class="img-thumb" alt="${item.file.name}">
          <div class="img-nome" title="${item.file.name}">${item.file.name}</div>
          <div class="img-acoes">
            <button class="btn-up" aria-label="Mover para cima">↑</button>
            <button class="del" aria-label="Remover">✕</button>
            <button class="btn-down" aria-label="Mover para baixo">↓</button>
          </div>
        `;

        el.querySelector('.btn-up').onclick = () => moverItem(index, -1);
        el.querySelector('.btn-down').onclick = () => moverItem(index, 1);
        el.querySelector('.del').onclick = () => {
          URL.revokeObjectURL(item.url);
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
          grade.querySelectorAll('.img-item').forEach(e => e.classList.remove('drag-over'));
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

async function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao abrir imagem'));
    };
    img.src = url;
  });
}

const TAMANHOS = { a4: [595.28, 841.89], carta: [612, 792] };
const MARGENS = { nenhuma: 0, pequena: 20, media: 50 };
const QUALIDADE = {
  alta: { maxPx: Infinity, jpegQ: 1.0 },
  media: { maxPx: 1754, jpegQ: 0.75 }, 
  baixa: { maxPx: 1000, jpegQ: 0.5 }
};

async function imagensParaPDF(arquivos, opcoes, aoProgredir) {
  const { PDFDocument } = window.PDFLib;
  const doc = await PDFDocument.create();
  
  let sucesso = 0;
  let erros = [];

  for (let i = 0; i < arquivos.length; i++) {
    const file = arquivos[i];
    
    await new Promise(r => setTimeout(r, 0));
    aoProgredir(((i) / arquivos.length) * 100, `Processando imagem ${i+1} de ${arquivos.length}...`);

    try {
      const img = await carregarImagem(file);
      
      let maxPx = QUALIDADE[opcoes.qualidade].maxPx;
      if (img.width > 8000 || img.height > 8000) maxPx = Math.min(maxPx, 8000);
      
      let w = img.width;
      let h = img.height;
      if (w > maxPx || h > maxPx) {
        const prop = Math.min(maxPx / w, maxPx / h);
        w = Math.round(w * prop);
        h = Math.round(h * prop);
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // Fundo branco caso PNG seja transparente
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', QUALIDADE[opcoes.qualidade].jpegQ));
      const arrayBuffer = await blob.arrayBuffer();
      const pdfImage = await doc.embedJpg(arrayBuffer);

      let pageWidth, pageHeight;
      const isLandscapeImg = w > h;

      if (opcoes.tamanho === 'ajustar') {
        pageWidth = w;
        pageHeight = h;
      } else {
        const dims = opcoes.tamanho === 'a4' ? TAMANHOS.a4 : TAMANHOS.carta;
        let wantLandscape = false;
        
        if (opcoes.orientacao === 'auto') wantLandscape = isLandscapeImg;
        else if (opcoes.orientacao === 'paisagem') wantLandscape = true;

        pageWidth = wantLandscape ? dims[1] : dims[0];
        pageHeight = wantLandscape ? dims[0] : dims[1];
      }

      const page = doc.addPage([pageWidth, pageHeight]);
      const margin = MARGENS[opcoes.margem];
      const drawAreaW = pageWidth - (margin * 2);
      const drawAreaH = pageHeight - (margin * 2);

      const scale = Math.min(drawAreaW / w, drawAreaH / h);
      const finalW = w * scale;
      const finalH = h * scale;
      const x = margin + (drawAreaW - finalW) / 2;
      const y = margin + (drawAreaH - finalH) / 2;

      page.drawImage(pdfImage, { x, y, width: finalW, height: finalH });
      sucesso++;

    } catch (err) {
      erros.push(`${file.name}: Não foi possível ler a imagem.`);
    }
  }

  aoProgredir(100, `Gerando arquivo PDF...`);
  await new Promise(r => setTimeout(r, 0));

  if (sucesso === 0) {
    throw new Error('Nenhuma imagem válida foi processada.\n' + erros.join('\n'));
  }

  const pdfBytes = await doc.save();
  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    erros
  };
}
