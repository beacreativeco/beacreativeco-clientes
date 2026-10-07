// Aparência (claro / escuro / do aparelho). Script comum, carregado no <head> ANTES do CSS
// aparecer: põe data-tema="claro" | "escuro" no <html> já na primeira pintura, sem piscar.
// A escolha fica salva neste aparelho (localStorage); sem escolha, segue o aparelho.
// O menu do avatar troca pela função window.beaTema.definir('claro' | 'escuro' | 'aparelho').
(function () {
  var CHAVE = 'bea-aparencia';
  var midia = window.matchMedia('(prefers-color-scheme: dark)');
  // Cor da barra do navegador no celular: a da moldura do app em cada modo.
  var COR_BARRA = { claro: '#2B201B', escuro: '#120E0C' };
  var memoria = null; // sem armazenamento (modo privado): a escolha vale até fechar a página

  function ler() {
    var v = memoria;
    try { v = localStorage.getItem(CHAVE) || memoria; } catch (e) { /* usa a memória */ }
    return v === 'claro' || v === 'escuro' ? v : 'aparelho';
  }

  function aplicar() {
    var escolha = ler();
    var tema = escolha === 'aparelho' ? (midia.matches ? 'escuro' : 'claro') : escolha;
    document.documentElement.dataset.tema = tema;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = COR_BARRA[tema];
    return tema;
  }

  aplicar();
  // "Do aparelho": acompanha quando o celular troca sozinho (ex.: modo escuro à noite).
  midia.addEventListener('change', function () { if (ler() === 'aparelho') aplicar(); });
  // Outra aba mudou a escolha: esta acompanha.
  window.addEventListener('storage', function (e) { if (e.key === CHAVE) aplicar(); });
  // A <meta> só existe depois do parse do <head>: acerta a cor de novo quando a página carrega.
  document.addEventListener('DOMContentLoaded', aplicar);

  window.beaTema = {
    escolha: ler,
    definir: function (valor) {
      memoria = valor === 'aparelho' ? null : valor;
      try {
        if (valor === 'aparelho') localStorage.removeItem(CHAVE);
        else localStorage.setItem(CHAVE, valor);
      } catch (e) { /* sem armazenamento: vale só nesta página */ }
      return aplicar();
    },
  };
})();
