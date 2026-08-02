PDFTools.UI = (function() {
  
  function criarElemento(tag, classes = [], html = '') {
    const el = document.createElement(tag);
    if (classes.length > 0) el.classList.add(...classes);
    if (html) el.innerHTML = html;
    return el;
  }

  function criarDropzone(opcoes) {
    const { multiplo = false, aceita = '.pdf', onArquivos } = opcoes;
    
    const container = criarElemento('div', ['pdf-dropzone']);
    container.innerHTML = `
      <div class="pdf-dropzone-icon">📄</div>
      <div class="pdf-dropzone-text">
        Arraste ${multiplo ? 'os arquivos' : 'o arquivo'} para cá ou 
        <button type="button" class="pdf-btn-texto">clique para escolher</button>
      </div>
      <input type="file" ${multiplo ? 'multiple' : ''} accept="${aceita}" style="display: none;">
    `;

    const input = container.querySelector('input');
    const btn = container.querySelector('button');

    btn.addEventListener('click', () => input.click());
    container.addEventListener('click', (e) => {
      if (e.target !== btn) input.click();
    });

    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        onArquivos(Array.from(e.target.files));
      }
      input.value = '';
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      container.addEventListener(eventName, () => container.classList.add('arrastando'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, () => container.classList.remove('arrastando'), false);
    });

    container.addEventListener('drop', (e) => {
      const arquivos = e.dataTransfer.files;
      if (arquivos.length > 0) {
        onArquivos(Array.from(arquivos));
      }
    });

    return container;
  }

  function criarListaArquivos(arquivos, onRemover) {
    const container = criarElemento('div', ['pdf-lista-arquivos']);
    
    arquivos.forEach((arq, index) => {
      const item = criarElemento('div', ['pdf-arquivo-item']);
      item.innerHTML = `
        <span class="pdf-arquivo-nome"></span>
        <span class="pdf-arquivo-tamanho">${PDFTools.formatarTamanho(arq.size)}</span>
        <button type="button" class="pdf-btn-remover" aria-label="Remover arquivo" data-index="${index}">✕</button>
      `;
      item.querySelector('.pdf-arquivo-nome').textContent = arq.name;
      
      item.querySelector('.pdf-btn-remover').addEventListener('click', () => {
        onRemover(index);
      });
      
      container.appendChild(item);
    });
    
    return container;
  }

  function criarProgresso() {
    const container = criarElemento('div', ['pdf-progresso'], `
      <div class="pdf-progresso-texto">Aguardando...</div>
      <div class="pdf-progresso-barra-fundo">
        <div class="pdf-progresso-barra-preenchimento" style="width: 0%"></div>
      </div>
    `);
    
    container.style.display = 'none';

    return {
      elemento: container,
      atualizar: (porcentagem, texto) => {
        container.style.display = 'block';
        const barra = container.querySelector('.pdf-progresso-barra-preenchimento');
        const txt = container.querySelector('.pdf-progresso-texto');
        barra.style.width = `${porcentagem}%`;
        if (texto) txt.textContent = texto;
      },
      esconder: () => {
        container.style.display = 'none';
      }
    };
  }

  function criarBotaoPrincipal(texto, onClick) {
    const btn = criarElemento('button', ['pdf-btn-principal']);
    btn.textContent = texto;
    btn.disabled = true;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function mostrarToast(mensagem, tipo = 'info') {
    const toast = criarElemento('div', ['pdf-toast', `pdf-toast-${tipo}`]);
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = mensagem;
    
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('visivel'));
    
    setTimeout(() => {
      toast.classList.remove('visivel');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  return {
    criarElemento,
    criarDropzone,
    criarListaArquivos,
    criarProgresso,
    criarBotaoPrincipal,
    mostrarToast
  };
})();
