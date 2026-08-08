PDFTools.registrar({
  id: 'comprimir_pdf',
  nome: 'Comprimir PDF',
  descricao: 'Deixe o PDF mais leve para enviar por e-mail ou site. Escolha o quanto reduzir e eu cuido do resto.',
  precisa: ['pdf-lib', 'pdfjs'],
  montarUI: function(container, arquivoInicial) {
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
        .comp-btn-acao:hover { background: var(--cor-primaria-hover, var(--acento-hover)); }
        .comp-btn-acao:disabled { background: var(--sup-2); color: var(--texto-2); opacity: 0.45; cursor: not-allowed; }
        .comp-input { padding: 8px; border: 1px solid var(--borda); border-radius: 4px; font-size: 14px; width: 100%; box-sizing: border-box; }
        .res-tabela { width: 100%; font-size: 15px; }
        .res-tabela td { padding: 8px 0; border-bottom: 1px solid var(--borda); }
        .res-tabela td:last-child { text-align: right; font-weight: bold; }

        .comp-nivel { display: block; border: 1px solid var(--borda); border-radius: 8px; padding: 12px;
          margin-bottom: 10px; cursor: pointer; background: var(--sup); }
        .comp-nivel:hover { border-color: var(--cor-primaria); }
        .comp-nivel.sel { border-color: var(--cor-primaria); box-shadow: 0 0 0 1px var(--cor-primaria) inset; }
        .comp-nivel.indisponivel { opacity: 0.5; cursor: not-allowed; }
        .comp-nivel.indisponivel:hover { border-color: var(--borda); }
        .comp-nivel-topo { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .comp-nivel-nome { font-weight: bold; font-size: 15px; color: var(--texto); }
        .comp-nivel-tag { font-size: 11px; font-weight: bold; color: var(--cor-primaria); text-transform: uppercase; letter-spacing: 0.04em; }
        .comp-nivel-alvo { font-size: 13px; font-weight: bold; color: var(--cor-primaria); white-space: nowrap; }
        .comp-nivel-desc { font-size: 12px; color: var(--texto-2); line-height: 1.4; margin-top: 4px; }
        .comp-nivel input { margin-right: 6px; }
        .comp-honesto { background: var(--sup-2); border: 1px solid var(--borda); border-left: 3px solid var(--cor-primaria);
          border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.5; color: var(--texto-2); }
        .comp-honesto strong { color: var(--texto); }
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
          <h3>O quanto reduzir</h3>
          <div id="comp-niveis"></div>
          <div id="comp-sem-ganho" style="display:none;"></div>

          <p style="font-size:12px; color:var(--texto-2); line-height:1.45; margin:16px 0 0;">
            <strong style="color:var(--texto);">O que esta ferramenta reduz de verdade:</strong>
            imagens JPEG embutidas no PDF (filtro DCTDecode). PDF só de texto, fontes ou imagens
            em outros formatos (PNG/Flate, JBIG2, etc.) costumam encolher pouco ou nada — a análise
            ao carregar o arquivo avisa quando for o caso.
          </p>

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
        <div id="comp-proximos-passos"></div>
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

    // Níveis calculados a partir do documento carregado (ver montarNiveis).
    let niveisAtuais = [];

    function formatarMB(mb) {
      return (mb >= 1 ? mb.toFixed(1).replace('.', ',') + ' MB' : Math.round(mb * 1024) + ' KB');
    }

    // Oferece o Dividir — ele corta por tamanho máximo OU por quantidade de páginas, que é a saída
    // real de quem precisa caber num limite de upload. `arquivo`/`nome` permitem mandar o PDF JÁ
    // comprimido (depois de uma compressão bem-sucedida) em vez do original: quem chegou aqui já
    // aceitou a compressão, então dividir de novo o original desfaria o ganho.
    function blocoDividir(motivo, arquivo, nome) {
      const div = document.createElement('div');
      div.className = 'comp-honesto';
      div.style.marginTop = '12px';
      const p = document.createElement('div');
      p.innerHTML = motivo;
      div.appendChild(p);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'comp-btn';
      btn.style.marginTop = '10px';
      btn.textContent = 'Dividir em arquivos menores';
      btn.addEventListener('click', () => {
        PDFTools.abrirComArquivo('dividir_pdf', arquivo || fileOrig, nome || fileOrig.name);
      });
      div.appendChild(btn);
      return div;
    }

    // Monta os 3 níveis. Regra honesta: nível cujo alvo já está acima do tamanho atual não
    // reduziria nada, então aparece desabilitado dizendo isso — em vez de fingir que faria algo.
    function montarNiveis(info) {
      const caixa = container.querySelector('#comp-niveis');
      const semGanho = container.querySelector('#comp-sem-ganho');
      caixa.innerHTML = '';
      semGanho.innerHTML = '';
      semGanho.style.display = 'none';

      const tamanhoAtual = fileOrig.size;
      niveisAtuais = calcularNiveis(info.paginas, tamanhoAtual);
      const algumVale = niveisAtuais.some(n => n.vale);
      const podeComprimir = info.imagensTrataveis > 0;
      const btnComprimir = container.querySelector('#btn-comprimir');

      // Caso 1: não há imagem recomprimível (PDF de texto, ou só PNG/JBIG2). Comprimir não resolve.
      if (!podeComprimir) {
        const porQue = info.totalImagens === 0
          ? `Ele é feito de <strong>texto</strong>, não de imagens digitalizadas — e é justamente imagem que esta ferramenta reduz.`
          : `As ${info.totalImagens} imagens dele estão em formatos que eu não recomprimo no navegador (PNG/Flate, JBIG2).`;
        semGanho.appendChild(blocoDividir(
          `<strong>Seu PDF já está no menor tamanho que eu consigo entregar.</strong><br>${porQue}
           Comprimir aqui não ganharia quase nada. Se você precisa caber num limite de envio,
           o caminho é dividir em partes.`));
        semGanho.style.display = 'block';
        btnComprimir.disabled = true;
        return;
      }

      // Caso 2: tem imagem, mas o arquivo já está menor que todos os alvos. Ex.: 10 páginas em 1 MB.
      if (!algumVale) {
        semGanho.appendChild(blocoDividir(
          `<strong>Seu PDF já está num tamanho pequeno</strong> —
           ${PDFTools.formatarTamanho(tamanhoAtual)} para ${info.paginas} página(s), cerca de
           ${Math.round(tamanhoAtual / 1024 / Math.max(1, info.paginas))} KB por página.
           Comprimir agora só tiraria qualidade sem ganho real de tamanho.
           Se mesmo assim ele não cabe onde você precisa enviar, divida em partes.`));
        semGanho.style.display = 'block';
        btnComprimir.disabled = true;
        return;
      }

      // Caso 3: normal — mostra os 3 níveis, pré-selecionando a Equilibrada (ou a 1ª que valha).
      const disponiveis = niveisAtuais.filter(n => n.vale);
      const padrao = disponiveis.find(n => n.recomendada) || disponiveis[0];

      niveisAtuais.forEach(n => {
        const lab = document.createElement('label');
        lab.className = 'comp-nivel' + (!n.vale ? ' indisponivel' : '') + (n === padrao ? ' sel' : '');
        lab.innerHTML = `
          <div class="comp-nivel-topo">
            <span class="comp-nivel-nome">
              <input type="radio" name="comp-nivel" value="${n.id}"${n === padrao ? ' checked' : ''}${!n.vale ? ' disabled' : ''}>
              ${n.nome}${n.recomendada ? ' <span class="comp-nivel-tag">recomendada</span>' : ''}
            </span>
            <span class="comp-nivel-alvo">${n.vale ? 'até ' + formatarMB(n.alvoMB) : '—'}</span>
          </div>
          <div class="comp-nivel-desc">${n.vale ? n.desc : 'Seu arquivo já está menor que isso.'}</div>
        `;
        caixa.appendChild(lab);
      });

      caixa.addEventListener('change', () => {
        caixa.querySelectorAll('.comp-nivel').forEach(l => {
          l.classList.toggle('sel', !!l.querySelector('input:checked'));
        });
      });

      btnComprimir.disabled = false;
    }

    async function abrirArquivo(file) {
      // Valida pelo header %PDF (ehPDF), não pelo file.type — um .pdf pode chegar com MIME vazio
      // ou não-padrão. Mantém a dropzone visível para tentar outro arquivo.
      const boxErroAntigo = container.querySelector('#comp-erro-arquivo');
      if (boxErroAntigo) boxErroAntigo.remove();
      if (!(await PDFTools.ehPDF(file))) {
        const box = document.createElement('div');
        box.id = 'comp-erro-arquivo';
        box.style.marginTop = '12px';
        box.innerHTML = PDFTools.erro('nao_e_pdf');
        container.querySelector('#comp-dropzone').appendChild(box);
        return;
      }
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
        
        progresso.atualizar(10, 'Analisando documento...');
        const info = await analisarPDF(fileOrig);
        
        if (info.totalImagens > 0) {
          let ignoradas = info.totalImagens - info.imagensTrataveis;
          let prop = info.bytesTotais > 0 ? Math.round((info.bytesTrataveis / info.bytesTotais) * 100) : 0;
          let avisoMsg = `Este PDF tem <strong>${info.totalImagens} imagens</strong>: ${info.imagensTrataveis} que consigo recomprimir e <strong>${ignoradas} em formatos que não consigo tratar no navegador</strong> (como Flate/JBIG2 puros). A redução possível fica limitada a cerca de <strong>${prop}%</strong> do tamanho total.`;
          
          let painelAviso = document.getElementById('comp-analise-aviso');
          painelAviso.innerHTML = avisoMsg;
          painelAviso.style.display = 'block';
        }
        
        arqBuffer = info.buffer;
        
        container.querySelector('#comp-meta-arq').textContent = `${PDFTools.formatarTamanho(file.size)} • ${info.paginas} páginas`;
        
        // O caso "texto puro" agora é dito pelo painel de níveis, com a saída do Dividir junto —
        // não faz sentido repetir aqui um aviso genérico dizendo a mesma coisa.
        avisoBox.style.display = 'none';

        if (file.size > 150 * 1024 * 1024) { // >150MB
          avisoBox.innerHTML = `<strong>Arquivo pesado:</strong> O processamento pode deixar o aparelho lento. Recomenda-se fechar outras abas.`;
          avisoBox.style.display = 'block';
        }

        montarNiveis(info);

        painelOpcoes.style.opacity = '1';
        painelOpcoes.style.pointerEvents = 'auto';

      } catch (err) {
        const cod = PDFTools.classificarErro(err);
        avisoBox.innerHTML = PDFTools.erro(cod, cod === 'desconhecido' ? (err && err.message) : null);
        avisoBox.style.display = 'block';
      } finally {
        progresso.esconder();
      }
    }

    container.querySelector('#btn-comprimir').onclick = async () => {
      if (!arqBuffer) return;
      const btn = container.querySelector('#btn-comprimir');
      const resultadoDiv = container.querySelector('#comp-resultado');
      
      btn.disabled = true;
      resultadoDiv.style.display = 'none';
      
      const escolhido = container.querySelector('input[name="comp-nivel"]:checked');
      const nivel = niveisAtuais.find(n => n.id === (escolhido && escolhido.value))
        || niveisAtuais.find(n => n.vale);
      if (!nivel) { btn.disabled = false; return; }
      // Margem de segurança de 2,5%: o Windows exibe tamanho em unidades de 1024 (MiB rotulado
      // "MB"), o que deixa pouca folga perto do limite. O alvo interno fica um pouco abaixo do
      // que a pessoa vê na tela.
      const params = { alvoBytes: nivel.alvoBytes * 0.975 };

      try {
        const result = await comprimirLogica(arqBuffer, params, (pct, txt) => progresso.atualizar(pct, txt));
        
        resultadoDiv.style.display = 'block';
        
        const sizeOrig = fileOrig.size;
        const sizeFinal = result.tamanho;
        
        container.querySelector('#res-orig').textContent = PDFTools.formatarTamanho(sizeOrig);
        container.querySelector('#res-final').textContent = PDFTools.formatarTamanho(sizeFinal);
        
        const btnManterOrig = container.querySelector('#btn-manter-orig');
        const btnBaixar = container.querySelector('#btn-baixar-comp');
        const msgDiv = container.querySelector('#comp-resultado-msg');
        const nome = PDFTools.nomeSemExtensao(fileOrig.name) + '-comprimido.pdf';

        if (result.blob.size >= fileOrig.size) {
           container.querySelector('#res-reducao').textContent = 'Nenhuma';
           container.querySelector('#res-reducao').style.color = 'var(--cor-erro)';
           msgDiv.innerHTML = `<span style="color:var(--cor-erro);">Atenção:</span> O PDF já estava muito comprimido (redução de 0%). O arquivo gerado está sendo entregue igual ou maior que o original.`;
           btnManterOrig.style.display = 'block';
           btnManterOrig.onclick = () => PDFTools.baixar(fileOrig, fileOrig.name);
           // Comprimir não tem mais o que dar: a saída real para caber num limite é dividir.
           msgDiv.appendChild(blocoDividir('Se você precisa que ele caiba num limite de envio, divida em partes menores.'));
        } else {
           const pReducao = Math.round((1 - (result.blob.size / fileOrig.size)) * 100);
           container.querySelector('#res-reducao').textContent = `-${pReducao}%`;
           container.querySelector('#res-reducao').style.color = 'var(--cor-sucesso)';
           btnManterOrig.style.display = 'none';
           
           if (pReducao < 5) {
             msgDiv.innerHTML = `Reduzi apenas <strong>${pReducao}%</strong>. Motivo: ${result.imagensIgnoradas} das ${result.totalImagensOriginal} imagens possuem filtros complexos que não pude tratar, ou o arquivo já está otimizado.`;
           } else {
             msgDiv.innerHTML = `Compressão finalizada com sucesso após ${result.tentativas} iteração(ões)! Redução de ${pReducao}%.`;
             if (result.imagensIgnoradas > 0) {
               // Só atribui a causa "cor/transparência" ao subconjunto que realmente foi pulado por
               // isso; o resto tem outros motivos (PNG/Flate, JBIG2, ASCII85...) e fica genérico.
               const porCor = result.imagensPuladasPorCor > 0
                 ? ` Dessas, ${result.imagensPuladasPorCor} têm espaço de cor ou máscara de transparência que eu não recomprimo sem arriscar a cor.`
                 : '';
               msgDiv.innerHTML += ` (${result.imagensIgnoradas} de ${result.totalImagensOriginal} imagens ficaram como estavam.${porCor})`;
             }
           }

           // Comprimir entregou, mas o limite de destino é da pessoa, não nosso — ela pode precisar
           // de algo ainda menor. Oferece a saída seguinte já com o arquivo COMPRIMIDO em mãos.
           msgDiv.appendChild(blocoDividir(
             `<strong>Ainda não é o tamanho que você precisa?</strong> Dá para dividir este PDF já
              comprimido (${PDFTools.formatarTamanho(result.blob.size)}) em arquivos menores —
              escolhendo um tamanho máximo por parte ou uma quantidade de páginas.`,
             result.blob, nome));
        }

        btnBaixar.onclick = () => PDFTools.baixar(result.blob, nome);

        const proxContainer = container.querySelector('#comp-proximos-passos');
        proxContainer.innerHTML = '';
        const prox = PDFTools.UI.criarProximosPassos({
          blob: result.blob, nomeArquivo: nome, origemId: 'comprimir_pdf', tamanhoBytes: result.blob.size
        });
        if (prox) proxContainer.appendChild(prox);
        PDFTools.registrarAcaoSessao('Comprimiu o PDF');

        // Preview da primeira página do resultado - numa etapa isolada: se a pré-visualização
        // falhar (arquivo atípico, etc.), o resultado e o "E agora?" acima já ficaram de pé.
        const previewDiv = container.querySelector('#comp-preview');
        previewDiv.innerHTML = '<span style="color:#999; font-size:12px;">Carregando...</span>';
        try {
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
        } catch (previewErr) {
          console.error(previewErr);
          previewDiv.innerHTML = '<span style="color:var(--cor-erro); font-size:12px;">Não foi possível gerar a pré-visualização.</span>';
        }

      } catch (err) {
        PDFTools.UI.toastErro(err);
      } finally {
        progresso.esconder();
        btn.disabled = false;
      }
    };

    if (arquivoInicial) abrirArquivo(arquivoInicial);
  }
});

// --- LÓGICA PURA ---

function obterFiltrosStr(filter, PDFName, PDFArray) {
  let list = [];
  if (!filter) return list;
  if (filter instanceof PDFName) list.push(filter.decodeText ? filter.decodeText() : (filter.name || ''));
  else if (filter instanceof PDFArray) {
    const arr = filter.array || [];
    for (let i = 0; i < arr.length; i++) {
      let f = arr[i];
      if (f instanceof PDFName) list.push(f.decodeText ? f.decodeText() : (f.name || ''));
    }
  } else if (Array.isArray(filter)) {
    for (let i = 0; i < filter.length; i++) {
      let f = filter[i];
      list.push(f && f.decodeText ? f.decodeText() : (f.name || f));
    }
  }
  return list;
}

// Níveis de redução. O alvo é proporcional à contagem de páginas porque o tamanho de um PDF
// digitalizado escala LINEARMENTE com ela — medido: 4149 KB/página constante de 1 a 20 páginas.
// A base de 500 KB/página é o peso típico de uma página A4 escaneada em qualidade boa (~200 DPI),
// que é a intuição certa: "cada página vale mais ou menos uma foto".
// O teto existe porque linear puro estoura em documento longo (50 págs × 500 KB = 25 MB, acima de
// qualquer limite de portal); nele o alvo vira mais agressivo, e isso é o desejado.
const NIVEIS_REDUCAO = [
  { id: 'leve', nome: 'Leve', kbPorPagina: 1000, tetoMB: 20,
    desc: 'Mexe o mínimo. A olho nu fica igual ao original.' },
  { id: 'equilibrada', nome: 'Equilibrada', kbPorPagina: 500, tetoMB: 10, recomendada: true,
    desc: 'A escolha certa na maioria dos casos: bem menor, e continua bonito.' },
  { id: 'maxima', nome: 'Máxima', kbPorPagina: 250, tetoMB: 5,
    desc: 'O menor arquivo possível. Pode perder um pouco de nitidez.' }
];

// Traduz cada nível num alvo em bytes para ESTE documento e diz se vale a pena oferecê-lo.
// `vale: false` = o arquivo já está abaixo desse alvo, então escolher esse nível não faria nada.
function calcularNiveis(paginas, tamanhoAtual) {
  const nPag = Math.max(1, paginas || 1);
  return NIVEIS_REDUCAO.map(n => {
    let mb = (nPag * n.kbPorPagina) / 1024;
    mb = Math.min(mb, n.tetoMB);
    mb = Math.max(mb, 0.3); // piso: abaixo disso vira ilegível mesmo em 1 página
    const alvoBytes = mb * 1024 * 1024;
    return Object.assign({}, n, {
      alvoMB: mb,
      alvoBytes: alvoBytes,
      // margem de 5%: cortar 3% de um arquivo não compensa o tempo nem a perda de qualidade
      vale: alvoBytes < tamanhoAtual * 0.95
    });
  });
}

// Recomprimir via canvas força a imagem a sair como JPEG RGB de 3 componentes, e não atualiza
// nenhum /SMask associado. Então só é seguro para ColorSpace já DeviceRGB/DeviceGray (ou ausente):
// CMYK/Indexed/ICCBased/Separation sairiam com cor errada, e uma imagem com SMask ficaria com a
// máscara órfã se o redimensionamento por maxPx mudar as dimensões da imagem principal.
function colorSpaceRecomprimivel(pdfObject, PDFName) {
  if (pdfObject.dict.has(PDFName.of('SMask'))) return false;
  const cs = pdfObject.dict.lookup(PDFName.of('ColorSpace'));
  return !cs || cs === PDFName.of('DeviceRGB') || cs === PDFName.of('DeviceGray');
}

async function analisarPDF(file) {
  const buffer = await PDFTools.lerComoArrayBuffer(file);
  const { PDFDocument, PDFName, PDFRawStream, PDFArray } = window.PDFLib;
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  
  let totalImagens = 0;
  let imagensTrataveis = 0;
  let bytesTrataveis = 0;
  let bytesTotais = 0;

  doc.context.enumerateIndirectObjects().forEach(([ref, pdfObject]) => {
    if (pdfObject instanceof PDFRawStream) {
      const subtype = pdfObject.dict.lookup(PDFName.of('Subtype'));
      if (subtype === PDFName.of('Image')) {
        totalImagens++;
        const size = pdfObject.contents ? pdfObject.contents.length : 0;
        bytesTotais += size;
        
        const filter = pdfObject.dict.lookup(PDFName.of('Filter'));
        const filtrosStr = obterFiltrosStr(filter, PDFName, PDFArray);
        
        let isCompressivel = false;
        if (filtrosStr.includes('DCTDecode') && colorSpaceRecomprimivel(pdfObject, PDFName)) {
          isCompressivel = true;
        }

        if (isCompressivel) {
          imagensTrataveis++;
          bytesTrataveis += size;
        }
      }
    }
  });

  const numPages = doc.getPageCount();
  const tipo = (totalImagens === 0) ? 'texto' : (totalImagens < numPages ? 'misto' : 'escaneado');

  return { tipo, paginas: numPages, totalImagens, imagensTrataveis, bytesTotais, bytesTrataveis, buffer };
}

async function comprimirLogica(bufferOriginal, params, aoProgredir) {
  const { PDFDocument, PDFName, PDFRawStream, PDFNumber, PDFArray } = window.PDFLib;
  const { alvoBytes, qualidadeFixa } = params;
  
  let melhorBlob = null;
  let melhorTamanho = Infinity;
  let tentativas = 0;
  let imgIgnoradasStats = 0;
  let imgTotal = 0;
  // Contado à parte do total de ignoradas: "ignorada" mistura PNG/Flate, JBIG2, ASCII85, erro de
  // decodificação etc. Só este subconjunto pode ser atribuído a ColorSpace/SMask na mensagem.
  let imgPuladasCor = 0;

  let qMin = 0.15; // Não descer abaixo de 15% senão vira borrão irrecuperável
  let qMax = 0.85; 
  
  const tamanhoOrig = bufferOriginal.byteLength || bufferOriginal.length;

  // O arquivo JÁ cabe no alvo: devolver INTACTO. Antes caía num ramo que recomprimia a q=0.5 do
  // mesmo jeito — num teste, 3,80 MB com alvo de 20 MB voltava com 0,55 MB, ou seja, 85% de perda
  // de qualidade que ninguém pediu (o alvo é um TETO, não uma meta a perseguir).
  if (alvoBytes && tamanhoOrig <= alvoBytes) {
    return {
      blob: new Blob([bufferOriginal], { type: 'application/pdf' }),
      tentativas: 0,
      tamanho: tamanhoOrig,
      intacto: true,
      imagensIgnoradas: 0,
      imagensPuladasPorCor: 0,
      totalImagensOriginal: 0
    };
  }

  const numTentativas = alvoBytes ? 6 : 1;
  let ultimaQualidadeUsada = 0;

  for (let t = 0; t < numTentativas; t++) {
    tentativas++;
    let q = alvoBytes ? (qMin + qMax) / 2 : qualidadeFixa;
    ultimaQualidadeUsada = q;
    
    aoProgredir((t / numTentativas) * 100, `Tentativa ${t+1} de ${numTentativas} (Teste a ${Math.round(q*100)}%)...`);
    await new Promise(r => setTimeout(r, 10));

    const doc = await PDFDocument.load(bufferOriginal, { ignoreEncryption: true });
    
    // Zera /Info e XMP: alem de reduzir bytes, evita que o arquivo entregue continue anunciando
    // autor e software de quem gerou o original.
    doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator('');
    PDFTools.removerXMP(doc);

    const refs = doc.context.enumerateIndirectObjects();
    let imgProc = 0;
    imgTotal = 0;
    imgPuladasCor = 0;

    for (let i = 0; i < refs.length; i++) {
      const [ref, pdfObject] = refs[i];
      if (pdfObject instanceof PDFRawStream) {
        const subtype = pdfObject.dict.lookup(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Image')) {
           imgTotal++;
           const filter = pdfObject.dict.lookup(PDFName.of('Filter'));
           const filtrosStr = obterFiltrosStr(filter, PDFName, PDFArray);
           
           if (filtrosStr.includes('DCTDecode')) {
             if (filtrosStr.includes('ASCII85Decode') || filtrosStr.includes('ASCIIHexDecode')) {
                continue; // Ignorado por pré-filtros não suportados
             }
             if (!colorSpaceRecomprimivel(pdfObject, PDFName)) {
                imgPuladasCor++;
                continue; // Ignorado: ColorSpace fora de RGB/Gray ou possui SMask (ver colorSpaceRecomprimivel)
             }
             try {
               let imgBytes = pdfObject.contents;
               
               // Se tem FlateDecode antes do DCTDecode, descomprime a camada Flate usando o
               // DecompressionStream nativo do navegador. Sem ele, NÃO buscamos nenhuma
               // biblioteca externa (o app não faz requisição de rede durante o uso, por
               // privacidade e para poder funcionar sem depender de CDN): apenas pulamos esta
               // imagem, mantendo a original intacta (degradação graciosa; a imagem entra na
               // contagem de "não tratadas" mais abaixo).
               if (filtrosStr[0] === 'FlateDecode') {
                  if (!window.DecompressionStream) continue;
                  const ds = new DecompressionStream('deflate');
                  const writer = ds.writable.getWriter();
                  const writePromise = writer.write(imgBytes).then(() => writer.close());
                  const res = new Response(ds.readable);
                  const bufPromise = res.arrayBuffer();
                  await writePromise;
                  imgBytes = new Uint8Array(await bufPromise);
               }

               const resJpg = await recomprimirJpeg(imgBytes, q);
               const novoJpgBytes = resJpg.bytes;
               
               // Reescreve o stream no lugar. embedJpg criaria um objeto novo e deixaria o antigo órfão no arquivo.
               pdfObject.contents = novoJpgBytes;
               pdfObject.dict.set(PDFName.of('Length'), PDFNumber.of(novoJpgBytes.length));
               pdfObject.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
               pdfObject.dict.set(PDFName.of('Width'), PDFNumber.of(resJpg.w));
               pdfObject.dict.set(PDFName.of('Height'), PDFNumber.of(resJpg.h));
               pdfObject.dict.delete(PDFName.of('DecodeParms'));
               pdfObject.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
               
               imgProc++;
             } catch(e) {
               console.warn('Falha na imagem, mantendo original:', e.message);
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
        // Ficou grande demais: desce a qualidade (qMax = q). O algoritmo de recompressão
        // (DCT + maxPx por faixa de q) NÃO muda — só o registro do fallback.
        qMax = q;
        // Guarda o menor overshoot visto (em geral a última tentativa, mais agressiva).
        // Antes só gravava na última iteração; se ela falhasse por exceção, saíamos sem blob.
        if (atualTamanho < melhorTamanho) {
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

  // Blindagem: se nenhuma tentativa produziu blob (falha total), devolve o original intocado.
  if (!melhorBlob) {
    melhorBlob = new Blob([bufferOriginal], { type: 'application/pdf' });
    melhorTamanho = tamanhoOrig;
  }

  // Se mesmo reduzindo tudo nunca bateu a meta, entrega o melhor esforço (menor overshoot).
  return { blob: melhorBlob, tentativas, tamanho: melhorTamanho, imagensIgnoradas: imgIgnoradasStats, imagensPuladasPorCor: imgPuladasCor, totalImagensOriginal: imgTotal };
}

async function recomprimirJpeg(imgBytes, qualidade) {
  // IMPORTANTE (eficiência): faixas maxPx e qualidade JPEG intactas — não “suavizar” estes
  // limites; já foram validados com PDFs pesados de imagem. Só liberamos o canvas no fim.
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
        try {
          if (!newBlob) return reject(new Error('toBlob falhou'));
          const buf = await newBlob.arrayBuffer();
          resolve({ bytes: new Uint8Array(buf), w, h });
        } finally {
          // Memória: zera o canvas sem mudar o resultado do JPEG.
          if (PDFTools.liberarCanvas) PDFTools.liberarCanvas(canvas);
        }
      }, 'image/jpeg', qualidade);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao decodificar JPEG no navegador'));
    };
    img.src = url;
  });
}
