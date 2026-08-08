/**
 * PDFTools.Editor — primitives compartilhadas dos editores de página
 * (Editar / Assinar / Tarjar). Fase 2 do plano.
 *
 * Carregado do mesmo origin do shell (Pages: ./page-editor.js), não via jsDelivr,
 * para o shell poder evoluir o motor sem esperar tag de tool.
 *
 * Requer window.PDFTools e PDFTools.UI já definidos (núcleo no index.html).
 */
(function (global) {
  'use strict';
  if (!global.PDFTools) {
    console.error('page-editor.js: PDFTools não encontrado. Carregue o núcleo antes.');
    return;
  }

  /**
   * Escala "ajustar à tela" com base no espaço real do modal-body
   * (padding + navegador de páginas lateral).
   */
  function calcularEscalaAjuste(modalBody, viewportRef, opcoes) {
    opcoes = opcoes || {};
    const fatorMaximo = opcoes.fatorMaximo != null ? opcoes.fatorMaximo : 1.5;
    const navEl = opcoes.navEl || null;
    if (!modalBody || !viewportRef) return 1;
    const cs = getComputedStyle(modalBody);
    const padH = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const larguraNav = (navEl && navEl.offsetWidth) ? (navEl.offsetWidth + 16) : 0;
    const maxWidth = Math.max(100, modalBody.clientWidth - padH - larguraNav);
    const maxHeight = Math.max(100, modalBody.clientHeight - padV);
    const vw = viewportRef.width || 1;
    const vh = viewportRef.height || 1;
    return Math.min(maxWidth / vw, maxHeight / vh, fatorMaximo);
  }

  /** IntersectionObserver para miniaturas preguiçosas. */
  function criarObserverMiniaturas(aoVisivel, opcoes) {
    opcoes = opcoes || {};
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) aoVisivel(entry.target);
      });
    }, { rootMargin: opcoes.rootMargin || '200px' });
    return {
      observe: function (el) { observer.observe(el); },
      disconnect: function () { observer.disconnect(); },
      unobserve: function (el) { observer.unobserve(el); }
    };
  }

  /**
   * Renderiza a 1ª vez a miniatura de uma célula de grade.
   * el.dataset.index = índice 0-based; el.dataset.rendered evita re-render.
   */
  async function renderizarMiniaturaPdf(pdfDocJs, el, opcoes) {
    if (!el || el.dataset.rendered === 'true' || !pdfDocJs) return;
    el.dataset.rendered = 'true';
    opcoes = opcoes || {};
    const scale = opcoes.scale != null ? opcoes.scale : 0.3;
    const seletor = opcoes.containerSeletor || '[class$="-thumb-container"], .thumb-container';
    const index = parseInt(el.dataset.index, 10);
    if (!isFinite(index)) return;
    try {
      const page = await pdfDocJs.getPage(index + 1);
      // getRotation(index, page) opcional — Editar usa para refletir giro aplicado na grade.
      const rot = typeof opcoes.getRotation === 'function'
        ? opcoes.getRotation(index, page)
        : null;
      const viewport = rot != null
        ? page.getViewport({ scale: scale, rotation: rot })
        : page.getViewport({ scale: scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      const box = el.querySelector(seletor);
      if (box) {
        box.innerHTML = '';
        box.appendChild(canvas);
      }
    } catch (e) {
      el.dataset.rendered = '';
    }
  }

  /** Abre modal full-viewport e libera o fixed do backdrop-filter do #workspace. */
  function abrirModalEditor(modalEl) {
    if (!modalEl) return;
    modalEl.style.display = 'flex';
    document.body.classList.add('pdf-editor-modal-aberto');
  }

  function fecharModalEditor(modalEl) {
    if (modalEl) modalEl.style.display = 'none';
    document.body.classList.remove('pdf-editor-modal-aberto');
  }

  /** Coordenadas do ponteiro relativas a um elemento (mouse ou touch). */
  function posicaoNoElemento(e, el) {
    const rect = el.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    const cx = t.clientX;
    const cy = t.clientY;
    return {
      x: cx - rect.left,
      y: cy - rect.top,
      w: rect.width,
      h: rect.height,
      clientX: cx,
      clientY: cy
    };
  }

  /**
   * Listeners de arrasto no document (mousemove/mouseup/touch).
   * Evita o bug de perder o gesto quando o ponteiro sai do item (pointer-events).
   * Retorna { destruir }.
   */
  function ouvirArrastoDocumento(handlers) {
    const onMove = handlers.onMove || function () {};
    const onEnd = handlers.onEnd || function () {};
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    return {
      destruir: function () {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      }
    };
  }

  /**
   * Recalcula escala base e re-renderiza ao resize/orientationchange.
   * opcoes: {
   *   modalEl, modalBody, navEl?,
   *   getPaginaPdf: () => page|null,
   *   getFatorMaximo?: () => number,
   *   getRotation?: () => number,  // se omitido, viewport sem rotation extra
   *   setEscalaBase: (n) => void,
   *   render: () => void
   * }
   */
  function criarResizeEditor(opcoes) {
    let raf = null;
    function aoResize() {
      if (!opcoes.modalEl || opcoes.modalEl.style.display === 'none') return;
      const page = opcoes.getPaginaPdf && opcoes.getPaginaPdf();
      if (!page) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        const rot = opcoes.getRotation ? opcoes.getRotation() : null;
        const viewportRef = rot != null
          ? page.getViewport({ scale: 1.0, rotation: rot })
          : page.getViewport({ scale: 1.0 });
        const fator = opcoes.getFatorMaximo
          ? opcoes.getFatorMaximo()
          : (opcoes.fatorMaximo != null ? opcoes.fatorMaximo : 1.5);
        const escala = calcularEscalaAjuste(opcoes.modalBody, viewportRef, {
          fatorMaximo: fator,
          navEl: opcoes.navEl || null
        });
        opcoes.setEscalaBase(escala);
        opcoes.render();
      });
    }
    window.addEventListener('resize', aoResize);
    window.addEventListener('orientationchange', aoResize);
    return {
      recalcular: aoResize,
      destruir: function () {
        window.removeEventListener('resize', aoResize);
        window.removeEventListener('orientationchange', aoResize);
        if (raf) cancelAnimationFrame(raf);
      }
    };
  }

  /**
   * Instala zoom + navegador de páginas nos slots do modal.
   * opcoes: { modalBody, zoomSlot, navSlot, aoMudarZoom, aoNavegar }
   */
  function montarZoomENav(opcoes) {
    const controleZoom = global.PDFTools.UI.criarControleZoom({
      superficieToque: opcoes.modalBody,
      aoMudarZoom: opcoes.aoMudarZoom
    });
    opcoes.zoomSlot.appendChild(controleZoom.elemento);
    const navegadorPaginas = global.PDFTools.UI.criarNavegadorPaginas({
      aoNavegar: opcoes.aoNavegar
    });
    opcoes.navSlot.appendChild(navegadorPaginas.elemento);
    return { controleZoom: controleZoom, navegadorPaginas: navegadorPaginas };
  }

  /**
   * Renderiza página PDF no canvas (fundo branco).
   * opcoes.rotation opcional (graus, convenção pdf.js).
   * Resolve com o viewport usado.
   */
  function renderCanvasPagina(page, canvas, scale, opcoes) {
    opcoes = opcoes || {};
    const opts = opcoes.rotation != null
      ? { scale: scale, rotation: opcoes.rotation }
      : { scale: scale };
    const viewport = page.getViewport(opts);
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
      return viewport;
    });
  }

  global.PDFTools.Editor = {
    calcularEscalaAjuste: calcularEscalaAjuste,
    criarObserverMiniaturas: criarObserverMiniaturas,
    renderizarMiniaturaPdf: renderizarMiniaturaPdf,
    abrirModalEditor: abrirModalEditor,
    fecharModalEditor: fecharModalEditor,
    posicaoNoElemento: posicaoNoElemento,
    ouvirArrastoDocumento: ouvirArrastoDocumento,
    criarResizeEditor: criarResizeEditor,
    montarZoomENav: montarZoomENav,
    renderCanvasPagina: renderCanvasPagina
  };
})(typeof window !== 'undefined' ? window : this);
