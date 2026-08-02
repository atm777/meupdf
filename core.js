window.PDFTools = (function() {
  const LIMITE_AVISO_MB = 100;
  const libsCarregadas = {};
  const ferramentasRegistradas = {};

  const configLibs = {
    'pdf-lib': 'lib/pdf-lib.min.js',
    'pdfjs': 'lib/pdf.min.js'
  };

  const erros = {
    'nao_e_pdf': { msg: 'Esse arquivo não é um PDF.', dica: 'Confira se você selecionou o arquivo certo.' },
    'pdf_protegido': { msg: 'Esse PDF está protegido por senha.', dica: 'Remova a senha antes de usar esta ferramenta.' },
    'pdf_corrompido': { msg: 'Não consegui ler esse PDF.', dica: 'O arquivo pode estar danificado.' },
    'sem_paginas': { msg: 'Esse PDF não tem páginas.', dica: '' },
    'memoria': { msg: 'O arquivo é grande demais para este aparelho.', dica: 'Tente num computador ou divida o arquivo antes.' },
    'desconhecido': { msg: 'Algo deu errado.', dica: '' }
  };

  function registrar(config) {
    ferramentasRegistradas[config.id] = config;
  }

  function carregarLib(nome) {
    if (libsCarregadas[nome]) {
      return libsCarregadas[nome];
    }
    
    if (!configLibs[nome]) {
      return Promise.reject(new Error(`Biblioteca ${nome} não configurada.`));
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = configLibs[nome];
      script.onload = () => {
        if (nome === 'pdfjs' && window.pdfjsLib) {
           window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
        }
        resolve();
      };
      script.onerror = () => reject(new Error(`Falha ao carregar ${nome}`));
      document.head.appendChild(script);
    });

    libsCarregadas[nome] = promise;
    return promise;
  }

  function lerComoArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function baixar(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function formatarTamanho(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const tamanhos = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const valor = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return valor.toLocaleString('pt-BR') + ' ' + tamanhos[i];
  }

  function nomeSemExtensao(nome) {
    const ultimoPonto = nome.lastIndexOf('.');
    if (ultimoPonto === -1) return nome;
    return nome.substring(0, ultimoPonto);
  }

  function sanitizarNome(nome) {
    return nome.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  function ehPDF(file) {
    return new Promise((resolve) => {
      if (!file) return resolve(false);
      
      const leitor = new FileReader();
      leitor.onload = function(e) {
        const arr = new Uint8Array(e.target.result);
        let header = "";
        for(let i = 0; i < arr.length; i++) {
          header += String.fromCharCode(arr[i]);
        }
        resolve(header === '%PDF');
      };
      leitor.onerror = () => resolve(false);
      leitor.readAsArrayBuffer(file.slice(0, 4));
    });
  }

  function ehImagem(file) {
    return file && file.type.startsWith('image/');
  }

  // Calcula onde desenhar um elemento (texto/imagem) no espaço bruto (não rotacionado)
  // do PDF, dado que ele deve aparecer numa posição VISUAL (top-down, em pontos, a partir
  // do canto superior-esquerdo da página como o usuário vê na tela) numa página que já
  // possui uma rotação intrínseca (/Rotate). pdf-lib desenha sempre no espaço bruto e não
  // compensa /Rotate sozinho — por isso este cálculo é necessário toda vez que se desenha
  // sobre uma página que pode estar rotacionada (carimbo, assinatura, formulário).
  // visX/visYTopo/boxW/boxH em pontos. rawW/rawH = page.getSize() (não muda com /Rotate).
  // Fórmula derivada e validada empiricamente (posição, ausência de espelhamento e
  // orientação corretas) para os 4 ângulos possíveis.
  function posicaoRotacionada(visX, visYTopo, boxW, boxH, rawW, rawH, anguloPagina) {
    const R = ((Math.round(anguloPagina / 90) * 90) % 360 + 360) % 360;
    let x, y, rotate;
    if (R === 90) {
      x = visYTopo + boxH; y = visX; rotate = 90;
    } else if (R === 180) {
      x = rawW - visX; y = visYTopo + boxH; rotate = 180;
    } else if (R === 270) {
      x = rawW - visYTopo - boxH; y = rawH - visX; rotate = 270;
    } else {
      x = visX; y = rawH - visYTopo - boxH; rotate = 0;
    }
    return { x, y, width: boxW, height: boxH, rotate };
  }

  // Dimensões visuais (como o usuário vê na tela) de uma página, considerando /Rotate.
  // page.getSize() do pdf-lib sempre retorna o MediaBox bruto, sem levar a rotação em conta.
  function dimensoesVisuais(rawW, rawH, anguloPagina) {
    const R = ((Math.round(anguloPagina / 90) * 90) % 360 + 360) % 360;
    return (R === 90 || R === 270) ? { width: rawH, height: rawW } : { width: rawW, height: rawH };
  }

  // Pede para o "shell" da aplicação (index.html / futuro tema Blogger) trocar para
  // outra ferramenta pelo id. O núcleo não conhece a UI de navegação, então apenas
  // dispara um evento — quem monta a página escuta 'pdftools:ir-para' e troca a tela.
  function irParaFerramenta(id) {
    document.dispatchEvent(new CustomEvent('pdftools:ir-para', { detail: { id } }));
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function erro(codigo, detalhes = null) {
    const info = erros[codigo] || erros['desconhecido'];
    let html = `<strong>${info.msg}</strong>`;
    if (info.dica) html += `<br><em>Dica: ${info.dica}</em>`;
    if (detalhes) {
      html += `<br><details style="margin-top:8px; font-size:12px; font-family:monospace; color:var(--erro);"><summary>Detalhes técnicos</summary><pre style="white-space:pre-wrap;">${escapeHTML(detalhes)}</pre></details>`;
    }
    return html;
  }

  return {
    LIMITE_AVISO_MB,
    registrar,
    carregarLib,
    lerComoArrayBuffer,
    baixar,
    formatarTamanho,
    nomeSemExtensao,
    sanitizarNome,
    ehPDF,
    ehImagem,
    erro,
    posicaoRotacionada,
    dimensoesVisuais,
    irParaFerramenta,
    obterFerramentas: () => Object.values(ferramentasRegistradas)
  };
})();
