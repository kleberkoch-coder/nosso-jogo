/* Imagem do card para o WhatsApp (KAN-295, pelada-v129): o mesmo SVG da tela vira um PNG de 1080 × 1350 (4:5), nítido
   no WhatsApp. O SVG desenhado como imagem não enxerga nada da página, então vão dentro dele: as imagens (foto, logotipo
   e fundo enviado, lidas como dados) e a fonte dos títulos (lida da folha de estilos da página). Sem servidor. */

const LARG = 1080,
  ALT = 1350;

const comoDados = (b: Blob) =>
  new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = erro;
    r.readAsDataURL(b);
  });

async function baixar(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    return r.ok ? await comoDados(await r.blob()) : null;
  } catch (e) {
    return null;
  }
}

/* A fonte dos títulos (a mesma dos cards, var(--display)), nos pesos que o card usa, como @font-face com os dados
   dentro. Se não der (sem internet e sem cópia guardada), o card sai com a fonte do sistema. */
let fonteGuardada: string | null = null;
async function fonteDosTitulos(familia: string): Promise<string> {
  if (fonteGuardada != null) return fonteGuardada;
  let css = '';
  try {
    const l = document.querySelector('link[rel=stylesheet][href^="https://fonts"]') as HTMLLinkElement | null;
    if (l) {
      const r = await fetch(l.href);
      const txt = r.ok ? await r.text() : '';
      const nome = familia.replace(/['"]/g, '').trim();
      const blocos = txt.match(/@font-face\s*{[^}]*}/g) || [];
      const vistos = new Set<string>();
      for (const b of blocos) {
        if (!b.includes(nome) || !/U\+0000-00FF/.test(b)) continue;
        const peso = (/font-weight:\s*(\d+)/.exec(b) || [])[1] || '400';
        const url = (/url\(([^)]+)\)/.exec(b) || [])[1];
        if (!url || vistos.has(peso)) continue;
        vistos.add(peso);
        const dados = await baixar(url.replace(/['"]/g, ''));
        if (dados) css += `@font-face{font-family:'${nome}';font-weight:${peso};src:url(${dados})}`;
      }
    }
  } catch (e) {
    /* segue sem a fonte */
  }
  fonteGuardada = css;
  return css;
}

/* Desenha o SVG num PNG de 1080 × 1350. */
export async function cardParaPng(svg: SVGSVGElement): Promise<Blob | null> {
  const c = svg.cloneNode(true) as SVGSVGElement;
  c.setAttribute('width', String(LARG));
  c.setAttribute('height', String(ALT));
  c.removeAttribute('class');
  const txt = svg.querySelector('text'),
    familia = txt ? getComputedStyle(txt).fontFamily : '';
  c.style.fontFamily = familia;
  for (const i of [...c.querySelectorAll('image')]) {
    const h = i.getAttribute('href') || '';
    if (!h || h.startsWith('data:')) continue;
    const d = await baixar(h);
    if (d) i.setAttribute('href', d);
    else i.remove();
  }
  const fonte = familia ? await fonteDosTitulos(familia.split(',')[0] || '') : '';
  if (fonte) {
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = fonte;
    c.insertBefore(st, c.firstChild);
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(c)], { type: 'image/svg+xml' }));
  try {
    const im = new Image();
    im.decoding = 'sync';
    await new Promise<void>((ok, erro) => {
      im.onload = () => ok();
      im.onerror = erro;
      im.src = url;
    });
    const cv = document.createElement('canvas');
    cv.width = LARG;
    cv.height = ALT;
    const x = cv.getContext('2d');
    if (!x) return null;
    x.drawImage(im, 0, 0, LARG, ALT);
    return await new Promise<Blob | null>(ok => cv.toBlob(b => ok(b), 'image/png'));
  } catch (e) {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* Compartilhar pelo celular (abre o WhatsApp e os outros apps); sem isso (computador), baixa a imagem. */
export async function compartilharCard(
  png: Blob,
  nomeArquivo: string,
  texto: string
): Promise<'compartilhou' | 'baixou'> {
  const arq = new File([png], nomeArquivo, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [arq] })) {
    try {
      await nav.share({ files: [arq], text: texto });
      return 'compartilhou';
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return 'compartilhou';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(png);
  a.download = nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'baixou';
}
