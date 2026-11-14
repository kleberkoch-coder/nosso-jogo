"""Testes automáticos do Nosso Jogo (modo demonstração, celular de 390 x 844).

Uso:
  1. Monte o site (npm run build) e copie o conteúdo da pasta dist/ para uma pasta de teste.
  2. No index.html, troque window.FIREBASE_CONFIG = {...} por window.FIREBASE_CONFIG = {} (modo demonstração).
  3. Sirva a pasta:  python3 -m http.server 8765
  4. Rode:           python3 testes_app.py http://127.0.0.1:8765/index.html pasta_das_fotos

Saída: uma linha por verificação (OK ou FALHOU), fotos das telas e um resumo em JSON (resultado.json).
Termina com código 1 se alguma verificação falhar.
Erros das fontes do Google e dos ícones são ignorados (o ambiente de teste pode bloquear a internet).
"""
import sys, os, re, json, time, datetime
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/index.html'
# KAN-220: o roteiro se divide em 3 partes que rodam ao mesmo tempo no GitHub (PARTE=a, b ou c). Sem PARTE, roda tudo.
#   a: o caminho principal (um navegador só, do cadastro ao portal) e o app instalado (usa os dados dele);
#   b: blocos com navegador próprio da v47 à v69; c: da v70 em diante.
PARTE = os.environ.get('PARTE', '')
parte = lambda k: PARTE in ('', k)
OUT = sys.argv[2] if len(sys.argv) > 2 else 'fotos'
os.makedirs(OUT, exist_ok=True)
res = []; errs = []
pulados = []
# O roteiro também roda na cópia de um arquivo só do Project (agentes de Qualidade), sem ícones, pedaços nem portal.
# Nesses casos, o que depende desses arquivos é pulado e anotado, em vez de virar falha falsa (pedido da Qualidade, 22/10/2026).
import urllib.request
BASE = URL.rsplit('/', 1)[0] + '/'
def existe(rel):
    try:
        return urllib.request.urlopen(BASE + rel, timeout=5).status == 200
    except Exception:
        return False
def pagina_usa_pedacos():
    try:
        return 'chunks/' in urllib.request.urlopen(URL, timeout=5).read().decode('utf-8', 'ignore')
    except Exception:
        return False
TEM_ICONES, TEM_PORTAL, TEM_PEDACOS = existe('icons/icon-192.png'), existe('portal.html'), pagina_usa_pedacos()
def pular(msg):
    pulados.append(msg)
    print('PULADO  ' + msg, flush=True)
def okp(cond, msg):
    """Verificação que depende dos pedaços (chunks/) da montagem publicada."""
    if TEM_PEDACOS: ok(cond, msg)
    else: pular(msg.split(':')[0] + ': a cópia de um arquivo só não tem pedaços (chunks/)')

def ok(cond, msg):
    res.append({'ok': bool(cond), 'teste': msg})
    print(('OK      ' if cond else 'FALHOU  ') + msg, flush=True)

# Contraste do texto visível na tela (WCAG 2.2 AA: 4,5:1; 3:1 para texto grande)
CHK = """()=>{const L=c=>{const m=c.match(/[\\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
 const bgOf=el=>{while(el){const c=getComputedStyle(el).backgroundColor;const a=c.match(/[\\d.]+/g);if(a&&(a.length<4||+a[3]>0.9))return c;el=el.parentElement}return 'rgb(255,255,255)'};
 const out=[];document.querySelectorAll('button,a,span,p,h2,h3,li,b,label,small,td,th,div').forEach(el=>{if(!el.childNodes.length||![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const st=getComputedStyle(el);if(st.visibility==='hidden'||st.display==='none'||+st.opacity<1||el.closest('[hidden],.busy'))return;
  const r=el.getBoundingClientRect();if(!r.width)return;const a=L(st.color),b=L(bgOf(el));const cr=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);const big=parseFloat(st.fontSize)>=24||(parseFloat(st.fontSize)>=18.6&&+st.fontWeight>=700);
  if(cr<(big?3:4.5))out.push(el.textContent.trim().slice(0,30)+' '+cr.toFixed(2))});return out}"""
# Palavras de futebol que não podem aparecer em outros esportes
FUTEBOL = re.compile(r'\b(Gols?|Goleiros?|GOL)\b')

def contraste(pg, nome):
    bd = pg.evaluate(CHK)
    ok(len(bd) == 0, f'contraste em {nome}: ' + ('; '.join(bd[:6]) if bd else 'tudo passa'))

def abrir_entrada(pg, rota='criar'):
    """KAN-220: abre a tela de criar conta (ou de entrar) e espera ela ficar pronta de verdade (campo de e-mail na tela e,
    no cadastro, a lista de países preenchida), em vez de um tempo fixo. Digitar antes disso às vezes perdia letras."""
    pg.goto(URL + '#/' + rota); pg.wait_for_selector('#le', timeout=15000)
    if rota == 'criar':
        pg.wait_for_function("document.querySelector('#lpais') && document.querySelector('#lpais').options.length > 10", timeout=15000)
    pg.wait_for_timeout(250)

def novo_grupo(pg, nome, esporte):
    pg.click('[data-a=groupsDlg]'); pg.wait_for_timeout(300)
    pg.click('#dlg [data-a=newGroup]'); pg.wait_for_timeout(300)
    pg.fill('#ngn', nome)
    pg.click(f'[data-a=pickSport][data-v={esporte}]')
    pg.click('[data-a=createGroup]'); pg.wait_for_timeout(1500)

def elenco_e_presenca(pg, n):
    pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(300)
    pg.click('[data-a=seed]'); pg.wait_for_timeout(1500)
    pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
    btns = pg.locator('[data-a=mark][data-v=in]')
    for i in range(n):
        btns.nth(i).click(); pg.wait_for_timeout(330)
    pg.wait_for_timeout(600)

def sortear(pg):
    pg.click('[data-a=drawDlg]'); pg.wait_for_timeout(300)
    if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)  # rodada com partida salva pede confirmação (KAN-138)
    pg.click('#drawGo'); pg.wait_for_timeout(2500)

# Banco de demonstração (localStorage 'pelada-demo-v2'). O app só lê o banco ao abrir: depois de PUT/DEL, recarregue a página.
LER = "(k)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return s[k]===undefined?null:s[k]}"
PUT = "(o)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K)||'{}');Object.assign(s,o);localStorage.setItem(K,JSON.stringify(s))}"
DEL = "(ks)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K)||'{}');ks.forEach(k=>delete s[k]);localStorage.setItem(K,JSON.stringify(s))}"
# Identificador malicioso dos casos do KAN-76
XSS = 'x"><img src=x onerror="window.__xss=1">'
SEM_XSS = "!window.__xss && !document.querySelector('img[src=\"x\"],[onerror]') && !document.body.innerText.includes('Invasor')"
CORES = ['Laranja', 'Azul', 'Amarelo', 'Vermelho', 'Roxo', 'Branco', 'Verde', 'Preto']
pres_k = lambda g, r, p: f'grupos/{g}/rodadas/{r}/presencas/{p}'
lim_k = lambda g, r: f'grupos/{g}/rodadas/{r}/limites/avulsos'

# Janela de confirmação do app (KAN-128): responde Sim (botão da ação) ou Cancelar.
def sair(pg):
    """Sair da conta pelo menu da conta, no cabeçalho (KAN-166)."""
    pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(200)
    pg.click('.theme-menu [data-a=logout]')

def abrir_pais_conta(pg):
    """Abre a janela do país da conta pelo menu da conta (KAN-166)."""
    pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(200)
    pg.click('.theme-menu [data-a=contaPais]'); pg.wait_for_timeout(400)

# KAN-66 (pelada-v107): no futebol, depois do autor do gol a janela pergunta a assistência; os roteiros antigos seguem
# "Sem assistência" (o gol já está contado).
def sem_assist(pg):
    try:
        if pg.locator('#astOpcoes').count():
            pg.click('#astOpcoes [data-a=addAssist]:not([data-p])'); pg.wait_for_timeout(200)
    except Exception:
        pass

def confirmar_app(pg, sim=True):
    try:
        pg.wait_for_selector('#dlg .conf [data-a=confSim]', timeout=3000)
    except Exception:
        return False
    pg.click('#dlg .conf [data-a=confSim]' if sim else '#dlg .conf [data-a=confNao]'); pg.wait_for_timeout(500)
    return True

def trocar_colete(pg, sel):
    """Abre a escolha do colete (v60) e escolhe a primeira cor que nenhum time usa."""
    pg.locator(sel).first.click(); pg.wait_for_timeout(400)
    livre = pg.locator('#coletes [data-a=pickColor][aria-pressed=false]:not(:has(.tag))').first
    livre.click(); pg.wait_for_timeout(800)

def adicionar_pelo_link(pg, nome):
    pg.click('[data-a=pubAdd]'); pg.wait_for_selector('#anm', timeout=8000); pg.fill('#anm', nome); pg.click('[data-a=pubSaveAdd]'); pg.wait_for_timeout(1200)
    return pg.evaluate("n=>Object.keys(S.pres).find(id=>S.pres[id].nome===n)||null", nome)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # KAN-164: o app segue o idioma do navegador. O roteiro roda em português, salvo onde o caso pede outro idioma.
    _contexto = b.new_context
    def _em_portugues(*a, **k):
        k.setdefault('locale', 'pt-BR')
        return _contexto(*a, **k)
    b.new_context = _em_portugues
    # Fuso de São Paulo (KAN-162): o país da conta nova é sugerido pelo fuso do aparelho; assim o roteiro dá o mesmo resultado em qualquer máquina.
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # KAN-128: o app não usa mais as caixas do navegador (confirm e alert). Se alguma aparecer, é anotada e recusada,
    # e o teste "CT-KAN-128-05" no fim falha. As confirmações agora são a janela do app: ver conf() abaixo.
    nativos = []
    pg.on('dialog', lambda d: (nativos.append(d.message[:60]), d.dismiss()))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    sem_traducao = []
    pg.on('console', lambda m: sem_traducao.append(m.text) if m.type == 'warning' and m.text.startswith('Texto sem tradução') else None)
    shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png')

    if parte('a'):
        # ---------- Página de apresentação e seletor de tema
        import time
        t0 = time.time(); pg.goto(URL); pg.wait_for_selector('.ld-nav', timeout=10000); ms = (time.time() - t0) * 1000
        # KAN-220: tempo depende da máquina; com ela carregada (outras partes rodando), mede de novo uma vez e vale a melhor.
        if ms > 1500:
            t0 = time.time(); pg.goto('about:blank'); pg.goto(URL); pg.wait_for_selector('.ld-nav', timeout=10000); ms = min(ms, (time.time() - t0) * 1000)
        ok(ms <= 1500, f'primeira tela desenhada em até 1,5 s (levou {ms:.0f} ms)')
        pg.wait_for_timeout(600); shot('01-apresentacao')
        # Bug do Kleber (14/10): no celular, o topo da apresentação não mostrava "Entrar". Confere em 390, 360 e 320 px.
        for lw in (390, 360, 320):
            pg.set_viewport_size({'width': lw, 'height': 844}); pg.wait_for_timeout(200)
            nav = pg.evaluate("""(()=>{const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&b.width>0?[b.left,b.right]:null};
              return {entrar:r('.ld-nav .ld-enter'),criar:r('.ld-nav a[href="#/criar"]'),tema:r('.ld-nav [data-a=themeMenu]'),largura:document.documentElement.scrollWidth}})()""")
            cabe = all(nav[k] and nav[k][0] >= 0 and nav[k][1] <= lw - 12 for k in ('entrar', 'criar', 'tema'))
            ok(cabe and nav['largura'] <= lw, f'apresentação em {lw}px: Entrar, Criar conta e tema aparecem no topo, sem rolagem lateral ({nav})')
        pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'apresentação sem rolagem lateral no celular')
        # KAN-59: os 5 ícones guardados pelo service worker existem e são imagens (sem eles o modo offline quebra)
        ic = pg.evaluate("""Promise.all(['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png','favicon-32.png'].map(f=>fetch('icons/'+f,{cache:'no-store'}).then(r=>r.ok&&(r.headers.get('content-type')||'').startsWith('image')?'':f).catch(()=>f))).then(a=>a.filter(Boolean))""")
        if TEM_ICONES: ok(not ic, 'CT-KAN-59-01: os 5 ícones do app existem e carregam' + (f' (faltando: {ic})' if ic else ''))
        else: pular('CT-KAN-59-01: a pasta icons/ não existe nesta cópia do app')
        # v19: a versão do app aparece e é a mesma do service worker (fonte única: VERSION do sw.js)
        VER = pg.evaluate("fetch('sw.js',{cache:'no-store'}).then(r=>r.text()).then(t=>(/VERSION\\s*=\\s*'pelada-v(\\d+)'/.exec(t)||[])[1])")
        ok(bool(VER) and f'versão {VER}' in pg.inner_text('.ld-foot'), f'CT-KAN-107-01: apresentação mostra a versão {VER} do app')
        btn = pg.locator('.ld-nav [data-a=themeMenu]'); ok(btn.count() == 1, 'botão de tema na página de apresentação')
        btn.click(); pg.wait_for_timeout(200); ok(pg.locator('.theme-menu').count() == 1, 'menu de tema abre')
        ok(pg.evaluate("document.activeElement.getAttribute('aria-checked')") == 'true', 'foco vai para a opção atual do tema')
        hs = pg.evaluate("[...document.querySelectorAll('.theme-menu button')].map(b=>Math.round(b.getBoundingClientRect().height))")
        ok(min(hs) >= 44, f'opções do menu de tema com 44px ou mais {hs}')
        pg.locator('.theme-menu [data-v=dark]').click(); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.documentElement.dataset.theme") == 'dark', 'Escuro aplica o tema escuro')
        ok(pg.evaluate("document.querySelector('meta[name=theme-color]').content") == '#173A2A', 'cor do navegador acompanha o tema')
        ok(pg.locator('.theme-menu').count() == 0, 'menu de tema fecha ao escolher')
        pg.reload(); pg.wait_for_timeout(500); ok(pg.evaluate("document.documentElement.dataset.theme") == 'dark', 'tema Escuro continua depois de recarregar')
        pg.locator('.ld-nav [data-a=themeMenu]').click(); pg.keyboard.press('Escape'); pg.wait_for_timeout(100); ok(pg.locator('.theme-menu').count() == 0, 'Esc fecha o menu de tema')
        url_antes = pg.url
        pg.locator('.ld-nav [data-a=themeMenu]').click(); pg.mouse.click(200, 600); pg.wait_for_timeout(300)
        ok(pg.locator('.theme-menu').count() == 0 and pg.url == url_antes, 'tocar fora fecha o menu sem acionar o que está embaixo')
        pg.locator('.ld-nav [data-a=themeMenu]').click(); pg.locator('.theme-menu [data-v=auto]').click(); pg.wait_for_timeout(100)
        ok(not pg.evaluate("document.documentElement.hasAttribute('data-theme')"), 'Automático volta a seguir o celular')

        # ---------- Cadastro e grupo de futebol
        abrir_entrada(pg, 'criar')
        ok(pg.evaluate("document.activeElement.id") == 'le', 'cursor no e-mail no cadastro')
        pg.wait_for_function("document.querySelector('#lpais') && document.querySelector('#lpais').options.length > 10", timeout=8000)
        ok(pg.input_value('#lpais') == 'BR' and 'Seu país' in pg.inner_text('main') and pg.evaluate("document.activeElement.id") == 'le',
           'CT-KAN-162-01: cadastro já vem com o país sugerido pelo fuso do aparelho (São Paulo → Brasil) e o cursor continua no e-mail')
        ok(f'Nosso Jogo · versão {VER}' in pg.inner_text('main'), 'CT-KAN-107-01: tela de login e cadastro mostra a versão do app')
        ok(pg.locator('#themeBtn').is_visible(), 'chip de tema no cabeçalho do cadastro')
        # v17: botão do Google no padrão e Mostrar senha
        ok(pg.locator('.gbtn svg.gic path').count() == 4 and 'Continuar com o Google' in pg.inner_text('.gbtn'), 'CT-KAN-99-01: botão do Google com o G colorido oficial')
        pg.fill('#lp', 'Jogo@2026'); pg.click('[data-a=verSenha][data-v=lp]'); pg.wait_for_timeout(100)
        ok(pg.get_attribute('#lp', 'type') == 'text' and pg.inner_text('[data-a=verSenha][data-v=lp]') == 'Ocultar' and pg.evaluate("document.activeElement.id") == 'lp', 'CT-KAN-97-01: Mostrar deixa ver a senha e mantém o cursor no campo')
        pg.click('[data-a=verSenha][data-v=lp]'); pg.wait_for_timeout(100)
        ok(pg.get_attribute('#lp', 'type') == 'password', 'CT-KAN-97-01: Ocultar esconde a senha de novo')
        ok(pg.locator('[data-a=verSenha][data-v=lp2]').count() == 1, 'CT-KAN-97-02: "Confirme a senha" também tem Mostrar')
        contraste(pg, 'cadastro com Mostrar senha (CT-KAN-97-02)')
        # ---------- v34 (KAN-10): regras da senha iguais à política do Firebase (maiúscula, minúscula, número, especial da lista, 8+)
        def pw_estado(sen):
            pg.fill('#le', 'org@teste.com'); pg.fill('#lp', sen); pg.fill('#lp2', sen); pg.wait_for_timeout(100)
            return pg.evaluate("[[...document.querySelectorAll('#pwr li')].filter(l=>!l.classList.contains('ok')).map(l=>l.textContent), document.getElementById('sgBtn').disabled]")
        ok(pg.locator('#pwr li').count() == 5 and '1 letra minúscula' in pg.inner_text('#pwr'), 'CT-KAN-10-01: checklist da senha tem 5 itens, incluindo "1 letra minúscula"')
        f1 = pw_estado('JOGO@2026')
        ok(f1[0] == ['1 letra minúscula'] and f1[1], f'CT-KAN-10-01: senha sem minúscula não libera "Criar conta" ({f1})')
        f2 = pw_estado('Jogo-2026')
        ok(f2[0] == ['1 caractere especial'] and f2[1], f'CT-KAN-10-02: hífen não conta como especial (o Firebase não aceita) ({f2})')
        ok('Caracteres especiais aceitos:' in pg.inner_text('main') and '@' in pg.inner_text('.pw-esp'), 'CT-KAN-10-02: a tela mostra quais caracteres especiais valem')
        f3 = pw_estado('Jogo@2026')
        ok(f3[0] == [] and not f3[1], 'CT-KAN-10-03: senha com tudo libera "Criar conta"')
        pg.fill('#le', 'org@teste.com'); pg.fill('#lp', 'Jogo@2026'); pg.fill('#lp2', 'Jogo@2026'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
        ok(pg.locator('#ngn').count() == 1, 'Enter cria a conta e abre "Novo grupo"')
        pg.fill('#ngn', 'Futebol de Segunda'); pg.click('[data-a=createGroup]'); pg.wait_for_timeout(1500)
        ok('#/g/' in pg.url, 'grupo de futebol criado')
        gid_fut = pg.url.split('#/g/')[1]
        # Planos (KAN-119): a conta principal do roteiro cria vários grupos; recebe o Plano B como se fosse pelo portal.
        # Antes do portal (KAN-116), o plano sai, para a conta voltar a aparecer como Grátis.
        pg.evaluate(PUT, {'contas/u-orgtestecom': {**(pg.evaluate(LER, 'contas/u-orgtestecom') or {}), 'plano': 'B'}}); pg.reload(); pg.wait_for_timeout(1200)
        elenco_e_presenca(pg, 10)
        ok(pg.evaluate("document.querySelector('#tabs').getAttribute('role')") == 'tablist', 'abas com role=tablist')
        ok(pg.locator('.mk button.on-in').count() >= 10, '10 presenças marcadas')
        hsm = pg.evaluate("Math.min(...[...document.querySelectorAll('.btn.sm')].map(b=>b.getBoundingClientRect().height).filter(h=>h>0))")
        ok(hsm >= 36, f'botões pequenos com 36px ou mais ({hsm:.0f}px)')
        shot('02-rodada-claro'); contraste(pg, 'Rodada (claro)')
        # v43 (KAN-153): a aba Rodada é componente e usa os componentes do Design System
        rc = pg.evaluate("(()=>{const r=document.getElementById('rodadaRaiz');return r?{hero:!!r.querySelector('.hero-r'),seg:r.querySelectorAll('.seg-filtro [data-a=presFiltro]').length,corta:!!r.querySelector('[data-corta]')}:null})()")
        ok(rc and rc['hero'] and rc['seg'] == 4 and rc['corta'], f'CT-KAN-153-01: aba Rodada montada como componente, com filtros e texto cortado ({rc})')
        # ---------- v31 (defeito do Kleber, 14/10): ao abrir o grupo, enquanto as rodadas chegam, a aba Rodada mostra "Carregando…"
        # e não pisca "Nenhuma rodada marcada" nem a lista de outra rodada
        for aba_c in ('rodada', 'partida'):
            pg.evaluate("S.loaded.rodF=false"); pg.click(f'[data-a=tab][data-v={aba_c}]'); pg.wait_for_timeout(150)
            tc = pg.inner_text('main')
            ok('Carregando' in tc and 'Nenhuma rodada' not in tc and 'Sem times' not in tc and pg.locator('[data-a=mark]').count() == 0,
               f'v31: aba {aba_c} espera as rodadas chegarem ("Carregando…"), sem piscar outra tela')
            pg.evaluate("S.loaded.rodF=true")
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(300)
        # ---------- v29 (KAN-71): sortear sem rolar a tela; uma lista só de presença com filtros
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(150)
        bar = pg.evaluate("(()=>{const b=document.querySelector('.acao-fixa [data-a=drawDlg]');if(!b)return null;const r=b.getBoundingClientRect();return {t:b.textContent.trim(),top:r.top,bot:r.bottom,h:r.height,dis:b.disabled}})()")
        ok(bool(bar) and bar['t'] == 'Sortear times (10)' and bar['bot'] <= 844 and bar['top'] > 600 and bar['h'] >= 44 and not bar['dis'],
           f'CT-KAN-71-01: "Sortear times (10)" fica fixo no rodapé, visível sem rolar, com 44px ({bar})')
        ok(pg.locator('[data-a=drawDlg]').count() == 1 and pg.locator('.grid2').count() == 0, 'CT-KAN-71-02: um só botão de sortear e uma lista só de presença (sem "Confirmados" repetido)')
        nome1 = pg.locator('#presLista .pn').first.inner_text().split(' ·')[0].strip()
        ok(pg.inner_text('main').count(nome1) == 1, f'CT-KAN-71-02: cada nome aparece uma vez na aba Rodada ({nome1})')
        cont = pg.evaluate("Object.fromEntries([...document.querySelectorAll('[data-a=presFiltro]')].map(b=>[b.dataset.v,+b.querySelector('.n').textContent]))")
        ok(cont.get('in') == 10 and cont['in'] + cont['out'] + cont['sem'] == cont['todos'], f'CT-KAN-71-03: filtros Todos, Vão, Não vão e Sem resposta somam certo ({cont})')
        pg.click('[data-a=presFiltro][data-v=in]'); pg.wait_for_timeout(200)
        nums = pg.locator('#presLista .num').all_inner_texts()
        ok(len(nums) == 10 and nums[0] == '1' and nums[-1] == '10' and pg.get_attribute('[data-a=presFiltro][data-v=in]', 'aria-pressed') == 'true', f'CT-KAN-71-03: "Vão" mostra os 10 em ordem de chegada, numerados ({len(nums)})')
        pg.click('[data-a=presFiltro][data-v=sem]'); pg.wait_for_timeout(200)
        ok(pg.locator('#presLista [data-a=mark]').count() == cont['sem'] * 2, 'CT-KAN-71-03: "Sem resposta" mostra só quem não respondeu, com ✓ e ✕')
        pg.click('[data-a=presFiltro][data-v=todos]'); pg.wait_for_timeout(200)
        hf = pg.evaluate("Math.min(...[...document.querySelectorAll('[data-a=presFiltro]')].map(b=>b.getBoundingClientRect().height))")
        ok(hf >= 44 and pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'CT-KAN-71: filtros com 44px e sem rolagem lateral ({hf:.0f}px)')
        ok(pg.locator('.fixos details').count() in (0, 1) and (pg.locator('.fixos').count() == 0 or not pg.locator('.fixos details p').is_visible()),
           'CT-KAN-71-04: a explicação dos jogos fixos fica recolhida em "Como funciona"')
        # KAN-72: abas com sombra de continuação e aba aberta sempre inteira
        ok('mais-dir' in pg.get_attribute('#tabsnav', 'class') and 'mais-esq' not in pg.get_attribute('#tabsnav', 'class'), 'CT-KAN-72-01: sombra à direita mostra que há mais abas (e nenhuma à esquerda no começo)')
        for aba in ('caixa', 'grupo', 'ranking'):
            pg.click(f'[data-a=tab][data-v={aba}]'); pg.wait_for_timeout(300)
            ar = pg.evaluate("(()=>{const r=document.querySelector('.tab[aria-selected=true]').getBoundingClientRect();return [r.left,r.right]})()")
            ok(ar[0] >= 0 and ar[1] <= 390, f'CT-KAN-72-02: aba {aba} aberta fica inteira na barra ({ar[0]:.0f}–{ar[1]:.0f})')
        ok('mais-esq' in pg.get_attribute('#tabsnav', 'class'), 'CT-KAN-72-01: depois de rolar, sombra à esquerda aparece')
        tp = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.tab')).paddingLeft)")
        ok(tp == 12, f'CT-KAN-72-03: espaço lateral das abas de 12px ({tp}px)')
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(300)
        # KAN-130: janela Sortear com alvos de toque grandes
        pg.click('[data-a=drawDlg]'); pg.wait_for_timeout(300)
        seg = pg.evaluate("[...document.querySelectorAll('#drawBox .seg button')].map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)})")
        ok(bool(seg) and min(seg) >= 36, f'CT-KAN-130-01: quantidade de times, posições fora e "Variar parceiros" com 36px ou mais ({min(seg):.0f}px)')
        pg.click('#drawBox details summary'); pg.wait_for_timeout(150)
        hl = pg.evaluate("[...document.querySelectorAll('#drawBox .chk label')].map(l=>l.getBoundingClientRect().height)")
        lab = pg.locator('#drawBox .chk label').first; box = lab.bounding_box()
        pg.mouse.click(box['x'] + box['width'] - 4, box['y'] + box['height'] / 2); pg.wait_for_timeout(100)
        desmarcou = not pg.locator('#drawBox .chk input').first.is_checked()
        pg.mouse.click(box['x'] + box['width'] - 4, box['y'] + box['height'] / 2); pg.wait_for_timeout(100)
        ok(min(hl) >= 44 and desmarcou and pg.locator('#drawBox .chk input').first.is_checked(), f'CT-KAN-130-02: cada jogador é uma linha de 44px tocável inteira ({min(hl):.0f}px)')
        rol = pg.evaluate("(()=>{const d=document.getElementById('dlg');return d.scrollHeight/d.clientHeight})()")
        ok(rol <= 2, f'CT-KAN-130-06: com a lista aberta, "Sortear" fica a no máximo 1 rolagem dentro da janela ({rol:.2f} telas)')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
        hc = pg.evaluate("[...document.querySelectorAll('.top .chip, #topright .chip')].map(b=>b.getBoundingClientRect().height).filter(h=>h>0)")
        ok(bool(hc) and min(hc) >= 36, f'CT-KAN-130-05: chips do cabeçalho com 36px ou mais ({min(hc):.0f}px)')
        sortear(pg); ok(pg.locator('.team').count() >= 2, 'times de futebol sorteados'); shot('03-times')
        foco = pg.evaluate("(()=>{const h=document.getElementById('timesTit');const r=h.getBoundingClientRect();return [document.activeElement===h,r.top]})()")
        ok(foco[0] and 0 <= foco[1] <= 300, f'CT-KAN-71-05: depois de sortear, a tela vai até os times e o foco fica em "Times" (topo em {foco[1]:.0f}px)')
        ok(pg.locator('.acao-fixa').count() == 0 and pg.locator('#timesTit ~ [data-a=drawDlg], .panel [data-a=drawDlg]').count() >= 1, 'CT-KAN-71-05: com times sorteados, a barra fixa sai e "Sortear de novo" fica no painel dos times')
        mv = pg.evaluate("[...document.querySelectorAll('[data-a=move]')].map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)})")
        ok(bool(mv) and min(mv) >= 36 and (pg.get_attribute('[data-a=move]', 'aria-label') or '').startswith('Mover '), f'CT-KAN-130-03: ⇄ com área de 36 × 36px e nome do jogador para leitor de tela ({min(mv):.0f}px)')

        # ---------- v15 (KAN-90 a KAN-92): lista fechada, sorteio fecha a lista, aviso de lista diferente dos times e pôr no time
        # Com times sorteados, mudar presença abre a confirmação do app (KAN-128): responde Sim, a não ser que sim=False.
        def mark(pid, v, sim=True):
            pg.click(f'[data-a=mark][data-p="{pid}"][data-v={v}]'); pg.wait_for_timeout(150)
            if pg.locator('#dlg .conf').count(): confirmar_app(pg, sim)
        ok(pg.evaluate("!!S.rod[S.rid].locked"), 'CT-KAN-91-01: sortear fecha a lista')
        ok(pg.locator('[data-a=mark]').count() == 0 and 'Lista fechada pelo sorteio' in pg.inner_text('main'), 'CT-KAN-90-01: com a lista fechada o administrador não marca presença')
        ok(pg.locator('[data-a=addAvulso]').count() == 0, 'CT-KAN-90-01: com a lista fechada some o "Adicionar avulso" da presença')
        ok(pg.locator('.warn-div').count() == 0, 'CT-KAN-91-03: logo depois do sorteio não há aviso de divergência')
        # Pôr direto no time com a lista fechada
        conf0 = pg.evaluate("Object.values(S.pres).filter(p=>p.s==='in').length")
        pg.locator('[data-a=porTime]').first.click(); pg.wait_for_timeout(300)
        ok('A pessoa entra direto neste time' in pg.inner_text('#dlg'), 'CT-KAN-92-01: "+ Pôr no time" abre a escolha de jogador')
        novo = pg.locator('#dlg [data-a=doPorTime]').first.get_attribute('data-p')
        pg.locator('#dlg [data-a=doPorTime]').first.click(); pg.wait_for_timeout(800)
        st = pg.evaluate("(id)=>[S.rod[S.rid].times[0].players.includes(id),(S.pres[id]||{}).s,Object.values(S.pres).filter(p=>p.s==='in').length]", novo)
        ok(st[0] and st[1] == 'in' and st[2] == conf0 + 1, f'CT-KAN-92-02: quem é posto no time entra no time e na lista de confirmados ({conf0} → {st[2]})')
        ok(pg.locator('.warn-div').count() == 0, 'CT-KAN-92-02: pôr no time não gera aviso de divergência')
        # Reabrir a lista e mudar presença com times sorteados
        pg.click('[data-a=lock]'); confirmar_app(pg, True); pg.wait_for_timeout(300)
        ok(pg.locator('[data-a=mark]').count() > 0, 'CT-KAN-90-02: reabrir a lista volta a permitir marcar presença')
        t0p = pg.evaluate("S.rod[S.rid].times[0].players[0]")
        mark(t0p, 'out', False); pg.wait_for_timeout(300)
        ok(pg.evaluate("(id)=>S.pres[id].s", t0p) == 'in', 'CT-KAN-91-02: com times sorteados, mudar presença pede confirmação (Cancelar não muda)')
        mark(t0p, 'out'); pg.wait_for_timeout(300)
        fora = pg.evaluate("Object.keys(S.jog).find(id=>!S.pres[id])")
        mark(fora, 'in'); pg.wait_for_timeout(600)
        aviso = pg.inner_text('.warn-div') if pg.locator('.warn-div').count() else ''
        ok('A lista mudou depois do sorteio' in aviso and 'não vai mais' in aviso and 'confirmou depois do sorteio' in aviso, 'CT-KAN-91-03: aviso mostra quem saiu e quem entrou depois do sorteio')
        shot('14-lista-diferente-dos-times'); contraste(pg, 'aviso de lista diferente dos times')
        pg.click(f'.warn-div [data-a=divTirar][data-p="{t0p}"]'); pg.wait_for_timeout(600)
        ok(pg.evaluate("(id)=>!S.rod[S.rid].times.some(t=>t.players.includes(id))", t0p) and 'não vai mais' not in pg.inner_text('main'), 'CT-KAN-91-04: "Tirar do time" tira só essa pessoa e o aviso dela some')
        pg.click(f'.warn-div [data-a=divPor][data-p="{fora}"]'); pg.wait_for_timeout(300)
        pg.locator('#dlg [data-a=doPorTime]').last.click(); pg.wait_for_timeout(700)
        ok(pg.evaluate("(id)=>S.rod[S.rid].times.some(t=>t.players.includes(id))", fora) and pg.locator('.warn-div').count() == 0, 'CT-KAN-91-04: "Pôr no time" coloca quem entrou e o aviso some')
        outro = pg.evaluate("S.rod[S.rid].times[1].players[0]")
        mark(outro, 'out'); pg.wait_for_timeout(600)
        ok(pg.locator('.warn-div').count() == 1, 'CT-KAN-91-03: aviso volta quando a lista muda de novo')
        pg.click('.warn-div [data-a=divManter]'); pg.wait_for_timeout(600)
        ok(pg.locator('.warn-div').count() == 0, 'CT-KAN-91-04: "Manter os times assim" apaga o aviso')
        mark(outro, 'in'); pg.wait_for_timeout(600)
        ok(pg.locator('.warn-div').count() == 0, 'CT-KAN-91-04: depois de "Manter", quem volta a confirmar e já está no time não gera aviso')
        mark(pg.evaluate("S.rod[S.rid].times[0].players[1]"), 'out'); pg.wait_for_timeout(600)
        pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        ok(pg.locator('.warn-div').count() == 1, 'CT-KAN-91-03: aviso continua depois de recarregar (vale para mudança vinda do link)')
        pg.click('.warn-div [data-a=drawDlg]'); pg.wait_for_timeout(300); pg.click('#drawGo'); pg.wait_for_timeout(2500)
        ok(pg.locator('.warn-div').count() == 0 and pg.evaluate("!!S.rod[S.rid].locked"), 'CT-KAN-91-04: "Sortear de novo" refaz os times, fecha a lista e apaga o aviso')
        # Link público com a lista fechada pelo sorteio
        pg.goto(URL + '#/p/' + gid_fut); pg.wait_for_timeout(900)
        ok(pg.locator('.mk.lg button').count() == 0 and 'Lista fechada' in pg.inner_text('main') and pg.locator('.team').count() >= 2, 'CT-KAN-91-01: link mostra a lista fechada e os times')
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(900); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        pg.click('[data-a=lock]'); confirmar_app(pg, True); pg.wait_for_timeout(300)  # reabre para os testes do link público abaixo

        # ---------- Partida, ranking, caixa, votação
        pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(400)
        pg.locator('[data-a=goal][data-v=a]').first.click(); pg.wait_for_timeout(200); pg.locator('[data-a=addGoal][data-p]').first.click(); pg.wait_for_timeout(300)
        sem_assist(pg)
        pg.evaluate("S.live.dur=1"); pg.click('[data-a=clock]'); pg.wait_for_timeout(1600)
        ok(pg.locator('#clockMsg').is_visible(), 'aviso visual "Tempo esgotado" no cronômetro')
        shot('04-placar'); pg.click('[data-a=clock]')
        pg.click('[data-a=saveMatch]'); pg.wait_for_timeout(800)
        # v18 (KAN-86): partida na subpasta da rodada, ficha da rodada só com a contagem
        est = pg.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')),rid=S.rid,ks=Object.keys(s).filter(k=>k.startsWith('grupos/'+g+'/rodadas/'+rid+'/partidas/'));const r=s['grupos/'+g+'/rodadas/'+rid]||{};return [ks.length,(r.matches||[]).length,r.np||0]}", gid_fut)
        ok(est == [1, 0, 1], f'CT-KAN-86-01: partida gravada na subpasta da rodada, não na ficha ({est})')
        ok(pg.locator('[data-a=delMatch]').count() == 1, 'CT-KAN-86-01: aba Partida lista a partida salva')
        # Desde a v61 o Ranking baixa ao abrir a aba (KAN-180): espera a tabela aparecer, até 5 s.
        pg.click('[data-a=tab][data-v=ranking]')
        try: pg.wait_for_selector('table', timeout=5000)
        except Exception: pass
        ok(pg.locator('table').count() == 1, 'ranking mostra a partida salva')
        ok(pg.evaluate("S.rodAll==null && Object.keys(S.res||{}).length<=12"), 'CT-KAN-87-01: ranking lê só as fichas do ano (nenhuma rodada inteira)')
        j0 = pg.evaluate("Object.values(S.res).reduce((s,d)=>s+Object.values(d.jog||{}).reduce((a,x)=>a+(x.j||0),0),0)")
        ok(j0 == 10, f'CT-KAN-87-02: partida salva já entra no ranking sem recalcular ({j0} jogos de jogadores)')
        # Apagar uma partida desconta do ranking
        pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(400); pg.click('[data-a=saveMatch]'); pg.wait_for_timeout(800)
        pg.locator('[data-a=delMatch]').last.click(); confirmar_app(pg, True); pg.wait_for_timeout(500)
        pg.click('[data-a=tab][data-v=ranking]'); pg.wait_for_timeout(500)
        j1 = pg.evaluate("Object.values(S.res).reduce((s,d)=>s+Object.values(d.jog||{}).reduce((a,x)=>a+(x.j||0),0),0)")
        ok(j1 == 10 and pg.locator('[data-a=delMatch]').count() == 0, f'CT-KAN-87-03: apagar partida desconta do ranking ({j1})')
        # Recalcular: estraga a ficha no banco e manda refazer
        pg.evaluate("(g)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem('pelada-demo-v2')),m=Object.keys(s).find(k=>k.startsWith('grupos/'+g+'/resumos/'));const d=s[m];const p=Object.keys(d.jog)[0];d.jog[p].j=99;localStorage.setItem(K,JSON.stringify(s))}", gid_fut)
        pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-a=tab][data-v=ranking]'); pg.wait_for_timeout(600)
        ok('99' in pg.inner_text('table'), 'CT-KAN-87-04: ficha estragada aparece no ranking (preparação)')
        pg.click('[data-a=recalc]'); confirmar_app(pg, True); pg.wait_for_timeout(1200)
        j2 = pg.evaluate("Object.values(S.res).reduce((s,d)=>s+Object.values(d.jog||{}).reduce((a,x)=>a+(x.j||0),0),0)")
        ok(j2 == 10 and '99' not in pg.inner_text('table'), f'CT-KAN-87-04: Recalcular refaz o ranking a partir das partidas ({j2})')
        shot('17-ranking-resumos'); contraste(pg, 'Ranking com Recalcular')
        pg.click('[data-a=tab][data-v=caixa]'); pg.wait_for_timeout(400); pg.click('[data-a=addLan]'); pg.wait_for_timeout(200)
        pg.select_option('#lp2', index=1); pg.click('[data-a=saveLan]'); pg.wait_for_timeout(800)
        ok(pg.locator('.money').first.inner_text().strip() != 'R$ 0,00', 'lançamento entra no caixa'); shot('05-caixa')
        kp = [x.strip().replace('\xa0', ' ') for x in pg.locator('.kpis .money').all_inner_texts()]
        ok(kp[0] == kp[1] and kp[2] == 'R$ 0,00', f'CT-KAN-87-05: saldo, entradas e saídas batem com os lançamentos ({kp})')
        cx = pg.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')),m=S.month,d=s['grupos/'+g+'/resumosCaixa/'+m]||{};return (d.cx||{}).ent||0}", gid_fut)
        cxr = pg.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')),m=S.month,d=s['grupos/'+g+'/resumos/'+m]||{};return 'cx' in d}", gid_fut)
        ok(cx == 8000 and not cxr, f'CT-KAN-87-05 e CT-KAN-207-01: a ficha de caixa do mês guarda as entradas em centavos, fora do resumo do ranking ({cx})')
        # KAN-207: grupo de antes da v74, com totais do caixa ainda no resumo do ranking: o app do organizador muda de lugar uma vez
        mig0 = pg.evaluate(LER, f'grupos/{gid_fut}/privado/migracao') or {}
        pg.evaluate(PUT, {f'grupos/{gid_fut}/resumos/2025-03': {'mes': '2025-03', 'jog': {}, 'jogos': {}, 'cx': {'ent': 5000, 'sai': 1200}},
                          f'grupos/{gid_fut}/privado/migracao': {k: v for k, v in mig0.items() if k != 'cx'}})
        pg.reload(); pg.wait_for_timeout(2500)
        rc207 = pg.evaluate(LER, f'grupos/{gid_fut}/resumosCaixa/2025-03') or {}
        r207 = pg.evaluate(LER, f'grupos/{gid_fut}/resumos/2025-03') or {}
        ok(rc207.get('cx') == {'ent': 5000, 'sai': 1200} and 'cx' not in r207 and (pg.evaluate(LER, f'grupos/{gid_fut}/privado/migracao') or {}).get('cx') == 1,
           f'CT-KAN-207-04: os totais antigos do caixa mudam de lugar uma vez, sem mudar o valor ({rc207.get("cx")}, resumo sem cx: {"cx" not in r207})')
        pg.click('[data-a=tab][data-v=caixa]'); pg.wait_for_timeout(1200)
        kp207 = [x.strip().replace('\xa0', ' ') for x in pg.locator('.kpis .money').all_inner_texts()]
        ok(kp207 and kp207[0] != kp[0], f'CT-KAN-207-04: o saldo inclui os totais que mudaram de lugar ({kp[0]} → {kp207[0] if kp207 else None})')
        # ---------- v30 (KAN-135): Caixa como componente; nome com código aparece como texto
        ok(pg.locator('#caixaRaiz .kpis').count() == 1 and pg.locator('#pendLista li').count() >= 1, 'CT-KAN-135-01: aba Caixa (componente) mostra saldo, entradas, saídas e pendências')
        pid0 = pg.evaluate("Object.keys(S.jog)[0]"); nome0 = pg.evaluate("(id)=>S.jog[id].name", pid0)
        pg.evaluate("(id)=>{S.jog[id]=Object.assign({},S.jog[id],{name:'<b>Negrito</b><script>window.__xss=1</script>'})}", pid0)
        pg.click('[data-a=tab][data-v=caixa]'); pg.wait_for_timeout(300)
        ok('<b>Negrito</b>' in pg.inner_text('#caixaRaiz') and pg.locator('#caixaRaiz b', has_text='Negrito').count() == 0 and not pg.evaluate("!!window.__xss"),
           'CT-KAN-135-02: nome com <b> ou <script> aparece como texto no Caixa, sem executar')
        pg.evaluate("(a)=>{S.jog[a[0]]=Object.assign({},S.jog[a[0]],{name:a[1]})}", [pid0, nome0]); pg.click('[data-a=tab][data-v=caixa]'); pg.wait_for_timeout(300)
        # ---------- v30 (KAN-129): "Recebi" com Desfazer
        npend = pg.locator('#pendLista [data-a=payPend]').count(); saldo0 = pg.locator('.kpis .money').first.inner_text()
        b0 = pg.locator('#pendLista [data-a=payPend]').first; lbl = b0.get_attribute('aria-label') or ''
        nome_p = pg.locator('#pendLista li .pn').first.inner_text().split(' Mensalidade')[0].split(' Diária')[0].strip()
        ok(lbl.startswith('Recebi de ' + nome_p + ', R$'), f'CT-KAN-129-05: "Recebi" diz o nome e o valor para o leitor de tela ({lbl})')
        b0.click(); pg.wait_for_timeout(500)
        tt = pg.inner_text('#toast'); und = pg.locator('#toast [data-a=avisoAcao]')
        ok(tt.startswith('Recebido de ' + nome_p + ': R$') and und.is_visible() and und.inner_text() == 'Desfazer' and pg.get_attribute('#toast', 'role') == 'status',
           f'CT-KAN-129-01: depois de Recebi, aviso "Recebido de …" com Desfazer ({tt!r})')
        ok(pg.locator('#pendLista [data-a=payPend]').count() == npend - 1, 'CT-KAN-129-01: o pagamento entra na hora (sai dos pendentes)')
        bb = und.bounding_box()
        ok(bb['width'] >= 44 and bb['height'] >= 44, f"CT-KAN-129-04: Desfazer com área de 44 × 44px ({bb['width']:.0f}×{bb['height']:.0f})")
        for tema in ('light', 'dark'):
            pg.evaluate("(t)=>document.documentElement.dataset.theme=t", tema)
            cr = pg.evaluate("""()=>{const L=c=>{const m=c.match(/[\\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
              const b=document.querySelector('#toast [data-a=avisoAcao]'),a=L(getComputedStyle(b).color),c=L(getComputedStyle(document.getElementById('toast')).backgroundColor);return (Math.max(a,c)+.05)/(Math.min(a,c)+.05)}""")
            ok(cr >= 4.5, f'CT-KAN-129-04: Desfazer com contraste {cr:.1f}:1 no tema {tema}')
        pg.evaluate("document.documentElement.removeAttribute('data-theme')")
        und.click(); pg.wait_for_timeout(600)
        ok(pg.locator('#pendLista [data-a=payPend]').count() == npend and pg.locator('.kpis .money').first.inner_text() == saldo0 and 'Pagamento desfeito' in pg.inner_text('#toast'),
           'CT-KAN-129-02: Desfazer apaga o lançamento, a pessoa volta para Pendentes e o saldo volta ao anterior')
        pg.locator('#pendLista [data-a=payPend]').first.click(); pg.wait_for_timeout(300); pg.mouse.move(5, 5)
        nl0 = pg.locator('#lanLista [data-a=delLan]').count(); pg.wait_for_timeout(6600)
        ok(not pg.evaluate("document.getElementById('toast').classList.contains('on')") and pg.locator('#pendLista [data-a=payPend]').count() == npend - 1,
           'CT-KAN-129-03: sem toque, o aviso some depois de 6 segundos e o pagamento fica gravado')
        # ---------- v30 (KAN-128): janela de confirmação do app
        xb = pg.locator('#lanLista [data-a=delLan]').first; xb.focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        cj = pg.evaluate("(()=>{const c=document.querySelector('#dlg .conf');if(!c)return null;return {t:c.querySelector('h3').textContent,b:[...c.querySelectorAll('button')].map(b=>b.textContent),foco:document.activeElement.dataset.a,so:document.querySelectorAll('#dlgBody > *').length}})()")
        ok(bool(cj) and cj['t'] == 'Apagar este lançamento?' and cj['b'] == ['Cancelar', 'Apagar lançamento'] and cj['so'] == 1 and not nativos,
           f'CT-KAN-128-01: ✕ do lançamento abre a janela do app "Apagar este lançamento?" com Cancelar e Apagar lançamento ({cj})')
        ok(bool(cj) and cj['foco'] == 'confNao', 'CT-KAN-128-06: a janela abre com o foco em Cancelar')
        for tema in ('light', 'dark'):
            pg.evaluate("(t)=>document.documentElement.dataset.theme=t", tema)
            m = pg.evaluate("""()=>{const L=c=>{const m=c.match(/[\\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
              const b=document.querySelector('#dlg [data-a=confSim]'),s=getComputedStyle(b),a=L(s.color),c=L(s.backgroundColor),of=getComputedStyle(document.documentElement).getPropertyValue('--out-fill').trim();
              return {cr:(Math.max(a,c)+.05)/(Math.min(a,c)+.05),h:b.getBoundingClientRect().height,fundo:s.backgroundColor,of}}""")
            ok(m['cr'] >= 4.5 and m['h'] >= 44, f"CT-KAN-128-03: botão da ação que apaga em out-fill/on-out, contraste {m['cr']:.1f}:1 e {m['h']:.0f}px no tema {tema}")
        pg.evaluate("document.documentElement.removeAttribute('data-theme')")
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        ok(not pg.evaluate("document.getElementById('dlg').open") and pg.locator('#lanLista [data-a=delLan]').count() == nl0 and pg.evaluate("document.activeElement.dataset.a") == 'delLan',
           'CT-KAN-128-02/06: Esc fecha sem apagar e o foco volta para o ✕')
        pg.locator('#lanLista [data-a=delLan]').first.click(); pg.wait_for_timeout(300); pg.mouse.click(8, 8); pg.wait_for_timeout(300)
        ok(not pg.evaluate("document.getElementById('dlg').open") and pg.locator('#lanLista [data-a=delLan]').count() == nl0, 'CT-KAN-128-02: tocar fora fecha sem apagar')
        pg.locator('#lanLista [data-a=delLan]').first.click(); confirmar_app(pg, True)
        ok(pg.locator('#lanLista [data-a=delLan]').count() == nl0 - 1 and 'Lançamento apagado' in pg.inner_text('#toast') and pg.locator('#toast [data-a=avisoAcao]').is_visible(),
           'CT-KAN-128-01/KAN-129: Apagar lançamento apaga e oferece Desfazer')
        pg.click('#toast [data-a=avisoAcao]'); pg.wait_for_timeout(500)
        ok(pg.locator('#lanLista [data-a=delLan]').count() == nl0, 'CT-KAN-129: Desfazer devolve o lançamento apagado')
        # Confirmação por cima de outra janela: Excluir jogador > Cancelar volta ao formulário, com o que foi digitado
        pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(300); pg.locator('[data-a=editPlayer]').first.click(); pg.wait_for_timeout(300)
        pg.fill('#pnm', 'Nome Em Edição'); pg.click('#dlg [data-a=delPlayer]'); pg.wait_for_timeout(300)
        t1 = pg.inner_text('#dlg .conf h3') if pg.locator('#dlg .conf').count() else ''
        confirmar_app(pg, False)
        ok(t1.startswith('Excluir ') and pg.locator('#pnm').is_visible() and pg.input_value('#pnm') == 'Nome Em Edição', f'CT-KAN-128: confirmação por cima do jogador; Cancelar volta ao formulário com o que foi digitado ({t1})')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)
        # ---------- v50 (KAN-168): ordenar a lista de jogadores
        pg.click('#dlg [data-a=close]') if pg.evaluate("document.getElementById('dlg').open") else None
        pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(400)
        ok(pg.locator('#jogadoresRaiz select[data-c=ordemJog]').count() == 1 and pg.input_value('#jogadoresRaiz select[data-c=ordemJog]') == 'nome', 'CT-KAN-168-01: a aba Jogadores tem "Ordenar por", começando em Nome')
        pg.select_option('#jogadoresRaiz select[data-c=ordemJog]', 'nota'); pg.wait_for_timeout(400)
        notas168 = [float(x.replace(',', '.')) for x in pg.locator('#jogadoresRaiz .panel').first.locator('.lvl-tag').all_inner_texts()]
        ok(len(notas168) > 2 and notas168 == sorted(notas168, reverse=True), f'CT-KAN-168-01: em Nota, a maior nota vem primeiro ({notas168[:6]})')
        pg.select_option('#jogadoresRaiz select[data-c=ordemJog]', 'posicao'); pg.wait_for_timeout(400)
        pos168 = pg.locator('#jogadoresRaiz .panel').first.locator('li .pos').all_inner_texts()
        ordem_esp = pg.evaluate("(()=>{const k=[...new Set(Object.values(S.jog).map(p=>p.pos).filter(Boolean))];return k})()")
        ok(len(pos168) > 2 and pos168[0] == 'GOL', f'CT-KAN-168-02: em Posição, os jogadores vêm agrupados na ordem do esporte, goleiros primeiro ({pos168[:6]})')
        pg.reload(); pg.wait_for_timeout(1500); pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(500)
        ok(pg.input_value('#jogadoresRaiz select[data-c=ordemJog]') == 'posicao', 'CT-KAN-168-03: depois de recarregar, a ordem escolhida continua')
        pg.select_option('#jogadoresRaiz select[data-c=ordemJog]', 'nome'); pg.wait_for_timeout(300)
        # ---------- v44 (KAN-156): telefone nacional e internacional, e e-mail com formato mínimo
        pid156 = pg.locator('[data-a=editPlayer]').first.get_attribute('data-p')
        pg.locator('[data-a=editPlayer]').first.click(); pg.wait_for_timeout(300)
        ok(pg.locator('#ptel').get_attribute('placeholder') and 'outro país' in pg.inner_text('#dlg'), 'CT-KAN-156-02: campo de telefone mostra a dica para número de outro país')
        pg.fill('#ptel', '9876-54'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(400)
        ok(pg.evaluate("document.getElementById('dlg').open") and 'Telefone incompleto' in pg.inner_text('#toast') and pg.evaluate("document.activeElement.id") == 'ptel',
           'CT-KAN-156-03: telefone curto não salva, avisa e volta o cursor ao campo')
        pg.fill('#ptel', '11 98765-43ab'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(400)
        ok(pg.evaluate("document.getElementById('dlg').open") and 'Telefone inválido' in pg.inner_text('#toast'), 'CT-KAN-156-03: telefone com letras não salva')
        pg.fill('#ptel', '+1 (415) 555-0100'); pg.fill('#pmail', 'ana@clube'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(400)
        ok(pg.evaluate("document.getElementById('dlg').open") and 'E-mail inválido' in pg.inner_text('#toast') and pg.evaluate("document.activeElement.id") == 'pmail',
           'CT-KAN-156-04: e-mail sem terminação não salva e volta o cursor ao campo')
        pg.fill('#pmail', 'ana@clube.com.br'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(600)
        ct156 = pg.evaluate("(id)=>S.cont&&S.cont[id]", pid156)
        ok(not pg.evaluate("document.getElementById('dlg').open") and ct156 and ct156['tel'] == '+14155550100' and ct156['email'] == 'ana@clube.com.br',
           f'CT-KAN-156-02: número dos EUA gravado no formato internacional ({ct156})')
        ok(pg.locator(f'a[href="https://api.whatsapp.com/send?phone=14155550100"]').count() >= 1, 'CT-KAN-156-02: link do WhatsApp abre o número dos EUA, sem o 55 na frente')
        pg.locator(f'[data-a=editPlayer][data-p="{pid156}"]').click(); pg.wait_for_timeout(300)
        # KAN-162: o combo do telefone voltou com os EUA (o número salvo); número brasileiro sem trocar o combo não salva errado
        ok(pg.input_value('#ppais') == 'US' and pg.input_value('#ptel') == '4155550100', 'CT-KAN-162-03: ao editar, o combo mostra o país do número salvo (+1) e o campo só o número')
        pg.fill('#ptel', '(11) 98765-4321'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(400)
        ok(pg.evaluate("document.getElementById('dlg').open") and 'Telefone inválido' in pg.inner_text('#toast'), 'CT-KAN-162-03: número brasileiro com o combo nos EUA não vira um número americano errado')
        pg.select_option('#ppais', 'BR'); pg.wait_for_timeout(100)
        ok(pg.get_attribute('#ptel', 'placeholder') == '(11) 98765-4321', 'CT-KAN-162-03: trocar o país do combo troca o exemplo do campo')
        pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(600)
        ok(pg.evaluate("(id)=>S.cont[id].tel", pid156) == '+5511987654321' and pg.locator('a[href="https://api.whatsapp.com/send?phone=5511987654321"]').count() >= 1,
           'CT-KAN-156-01: número brasileiro com DDD vira +55 e o link do WhatsApp abre certo')
        pg.locator(f'[data-a=editPlayer][data-p="{pid156}"]').click(); pg.wait_for_timeout(300)
        ok(pg.input_value('#ptel') == '(11) 98765-4321', 'CT-KAN-156-01: ao editar, o número brasileiro aparece fácil de ler')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        # ---------- v46 (KAN-159): importar o elenco da planilha (colar e arquivo)
        n0 = pg.evaluate("Object.keys(S.jog).length")
        existente = pg.evaluate("Object.values(S.jog)[0].name")
        pg.click('[data-a=importarDlg]'); pg.wait_for_timeout(400)
        ok(pg.evaluate("document.activeElement && document.activeElement.id") == 'impTexto' and pg.locator('#dlg [data-a=importarJogadores]').is_disabled(),
           'CT-KAN-159: a janela abre com o cursor no campo de colar e o botão Importar desligado')
        colado = ('Jogador\tPosição\tNota\tTipo\tTelefone\tE-mail\n'
                  'Importado Um\tGoleiro\t7,5\tDiarista\t(11) 91234-5678\tum@clube.com\n'
                  'Importado Dois\tATA\t12\tMensalista\t\t\n'
                  + existente.upper() + '\tDEF\t5\t\t\t\n'
                  'importado um\tMEI\t6\t\t\t')
        pg.fill('#impTexto', colado); pg.wait_for_timeout(300)
        resumo159 = pg.inner_text('#impResumo'); bt = pg.inner_text('#dlg [data-a=importarJogadores]')
        ok('2 jogadores novos' in resumo159 and '2 já estão no elenco ou repetidos' in resumo159 and '1 com aviso' in resumo159 and bt == 'Importar 2 jogadores',
           f'CT-KAN-159-01/03/04: prévia do colado: novos, já existentes, repetidos e avisos ({resumo159!r}, {bt!r})')
        lista = pg.inner_text('#impLista')
        ok('Goleiro' in lista and 'nota 7,5' in lista and 'Diarista' in lista and '(11) 91234-5678' in lista and 'Nota fora de 1 a 10' in lista and 'já está no elenco' in lista and 'repetido na lista' in lista,
           'CT-KAN-159-01/04: prévia mostra posição, nota, tipo e contato reconhecidos, e o motivo de cada aviso')
        pg.click('#dlg [data-a=importarJogadores]'); pg.wait_for_timeout(800)
        imp = pg.evaluate("""(()=>{const id=n=>Object.keys(S.jog).find(k=>S.jog[k].name===n);const a=id('Importado Um'),b=id('Importado Dois');
          return {n:Object.keys(S.jog).length,pa:a&&S.jog[a].pos,tipo:a&&S.pc.tipos[a],nota:a&&S.rat.nivel[a],tel:a&&S.cont[a]&&S.cont[a].tel,mail:a&&S.cont[a]&&S.cont[a].email,pb:b&&S.jog[b].pos,notab:b&&S.rat.nivel&&S.rat.nivel[b],aberto:document.getElementById('dlg').open}})()""")
        ok(imp['n'] == n0 + 2 and imp['pa'] == 'GOL' and imp['tipo'] == 'diarista' and imp['nota'] == 7.5 and imp['tel'] == '+5511912345678' and imp['mail'] == 'um@clube.com'
           and imp['pb'] == 'ATA' and imp['notab'] is None and not imp['aberto'] and 'importados' in pg.inner_text('#toast'),
           f'CT-KAN-159-05: importar grava os 2 novos com posição, nota, tipo e contato, e fecha a janela ({imp})')
        ok(pg.locator('#jogadoresRaiz li', has_text='Importado Um').count() == 1, 'CT-KAN-159-05: a aba Jogadores mostra o elenco novo')
        import tempfile, zipfile
        pasta = tempfile.mkdtemp()
        xlsx = os.path.join(pasta, 'elenco.xlsx')
        # Planilha do Excel mínima, montada à mão (sem biblioteca): textos compartilhados e números, como o Excel grava.
        with zipfile.ZipFile(xlsx, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
            z.writestr('xl/sharedStrings.xml', '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                       + ''.join(f'<si><t>{t}</t></si>' for t in ['Nome', 'Nota', 'Tipo', 'Planilha Três', 'Mensalista', 'Planilha Quatro', 'D']) + '</sst>')
            z.writestr('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
                       '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>'
                       '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>8</v></c><c r="C2" t="s"><v>4</v></c></row>'
                       '<row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3"><v>6.5</v></c><c r="C3" t="s"><v>6</v></c></row>'
                       '</sheetData></worksheet>')
        csv = os.path.join(pasta, 'elenco.csv'); open(csv, 'w', encoding='utf-8').write('Nome;Telefone\nCsv Cinco;+351 912 345 678\n')
        pg.click('[data-a=importarDlg]'); pg.wait_for_timeout(400)
        pg.set_input_files('#impArq', xlsx); pg.wait_for_timeout(800)
        rx = pg.inner_text('#impResumo') if pg.locator('#impResumo').count() else ''
        ok('2 jogadores novos' in rx and 'elenco.xlsx' in pg.inner_text('#dlg') and 'nota 6,5' in pg.inner_text('#impLista'), f'CT-KAN-159-02: arquivo do Excel (.xlsx) mostra a mesma prévia ({rx!r})')
        pg.click('#dlg [data-a=importarJogadores]'); pg.wait_for_timeout(800)
        pg.click('[data-a=importarDlg]'); pg.wait_for_timeout(400)
        pg.set_input_files('#impArq', csv); pg.wait_for_timeout(600)
        ok('1 jogador novo' in pg.inner_text('#impResumo') and '+351 912345678' in pg.inner_text('#impLista'), 'CT-KAN-159-02: arquivo .csv com ";" e telefone de outro país')
        pg.click('#dlg [data-a=importarJogadores]'); pg.wait_for_timeout(800)
        ok(pg.evaluate("['Planilha Três','Planilha Quatro','Csv Cinco'].every(n=>Object.values(S.jog).some(p=>p.name===n))"), 'CT-KAN-159-02: jogadores do .xlsx e do .csv importados')
        pg.click('[data-a=importarDlg]'); pg.wait_for_timeout(400)
        ruim = os.path.join(pasta, 'foto.png'); open(ruim, 'wb').write(b'\x89PNG\r\n')
        pg.set_input_files('#impArq', ruim); pg.wait_for_timeout(400)
        ok('Não foi possível ler este arquivo' in pg.inner_text('#dlg') and pg.locator('#dlg [data-a=importarJogadores]').is_disabled(), 'CT-KAN-159: arquivo que não é planilha mostra o erro e não importa nada')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)
        pg.click('[data-a=tab][data-v=votacao]'); pg.wait_for_timeout(300); pg.click('[data-a=newVote]'); pg.wait_for_timeout(200)
        pg.click('[data-a=saveVote]'); pg.wait_for_timeout(800)
        ok(pg.locator('#shtxt').is_visible(), 'votação criada e link para o WhatsApp continua aberto')
        pg.click('[data-a=close]'); pg.wait_for_timeout(300)
        # ---------- v35 (KAN-141): local com "Como chegar" no Google Maps e no Waze
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        pg.click('[data-a=editRod]'); pg.wait_for_timeout(300); END_LONGO = 'Society do Zé, Av. Pref. Luis Latorre, 5501 - Retiro, Jundiaí - SP, 13214-205, Brasil'
        pg.fill('#rpl', END_LONGO); ok(pg.input_value('#rpl') == END_LONGO, f'CT-KAN-143-01: o local aceita o endereço completo ({len(END_LONGO)} letras)')
        pg.click('[data-a=saveRod]'); pg.wait_for_timeout(800)
        ok(pg.evaluate("S.rod[S.rid].place") == END_LONGO and 'Jundia%C3%AD' in (pg.get_attribute('.hero-r .chip-mapa', 'href') or ''), 'CT-KAN-143-01: endereço completo gravado e levado inteiro para o mapa')
        hm = pg.evaluate("[...document.querySelectorAll('.hero-r .chip-mapa')].map(a=>[a.textContent,a.href,a.target])")
        ok(len(hm) == 2 and 'google.com/maps/search/?api=1&query=Society%20do%20Z%C3%A9' in hm[0][1] and 'waze.com/ul?q=Society' in hm[1][1] and hm[0][2] == '_blank',
           f'CT-KAN-141-01: aba Rodada mostra "Como chegar" com Google Maps e Waze ({[x[0] for x in hm]})')
        pg.click('[data-a=shareConvite]'); pg.wait_for_timeout(300)
        ok('🗺️ https://www.google.com/maps/search/' in pg.input_value('#shtxt'), 'CT-KAN-141-02: o convite do WhatsApp leva o link do mapa')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(300); pg.click('[data-a=editGroup]'); pg.wait_for_timeout(300)
        if pg.locator('#sched .sl').count():
            pg.locator('#sched .sl').first.fill(END_LONGO)
            ok(pg.locator('#sched .sl').first.input_value() == END_LONGO and pg.get_attribute('#sched .sl', 'maxlength') == '200', 'CT-KAN-143-02: o local dos dias fixos aceita o endereço completo (limite de 200 letras)')
        pg.mouse.click(8, 8); pg.wait_for_timeout(300)
        if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(300)
        # ---------- v37 (KAN-144): local enorme e sem espaço não estoura a tela (gestão e link)
        pg.click('[data-a=editRod]'); pg.wait_for_timeout(300); pg.fill('#rpl', '0123456789' * 20); pg.click('[data-a=saveRod]'); pg.wait_for_timeout(800)
        larg = pg.evaluate("[document.documentElement.scrollWidth, innerWidth, Math.round(document.querySelector('.hero-r').getBoundingClientRect().right)]")
        ok(larg[0] <= larg[1] and larg[2] <= larg[1], f'CT-KAN-144-01: local com 200 letras sem espaço não estoura a aba Rodada ({larg})')
        # ---------- v39 (KAN-146, revisão do KAN-145): local numa linha só; o seletor e o cabeçalho não mostram o local
        ok(all('0123456789' not in o for o in pg.locator('select[data-c=rid] option').all_inner_texts()) and '0123456789' not in pg.inner_text('#gsub'),
           'CT-KAN-146-01: o seletor de rodadas e o cabeçalho não mostram o local')
        lc = pg.evaluate("(()=>{const g=document.querySelector('.hero-r [data-corta]');const r=g.getBoundingClientRect();return [g.getAttribute('role'),g.title.length,Math.round(r.height),g.classList.contains('cortado')]})()")
        ok(lc[0] == 'button' and lc[1] == 200 and lc[2] < 30 and lc[3], f'CT-KAN-146-02: local longo fica numa linha com "…" e o texto inteiro ao passar o mouse ({lc})')
        pg.click('.hero-r [data-corta]'); pg.wait_for_timeout(200)
        ab = pg.evaluate("(()=>{const g=document.querySelector('.hero-r [data-corta]');return [g.classList.contains('aberto'),g.getBoundingClientRect().height>30,g.getAttribute('aria-expanded'),document.documentElement.scrollWidth<=innerWidth]})()")
        ok(ab == [True, True, 'true', True], f'CT-KAN-146-03: tocar no local abre o texto inteiro, sem rolagem lateral ({ab})')
        pg.click('.hero-r [data-corta]'); pg.wait_for_timeout(200)
        ok(not pg.evaluate("document.querySelector('.hero-r [data-corta]').classList.contains('aberto')"), 'CT-KAN-146-03: tocar de novo fecha')
        # ---------- v40 (KAN-150): painel do link permanente sem repetir dia, hora e local; aba Grupo legível no celular
        if pg.locator('.fixos').count():
            fx = pg.inner_text('.fixos')
            ok('Link permanente' in fx and not re.search(r'\d{2}:\d{2}', fx) and '0123456789' not in fx, f'CT-KAN-150-01: o painel do link permanente não repete dia, horário e local ({fx[:60]!r})')
        # KAN-151: horário com hora (00–23) e minutos (00–59), setas ▲▼ e digitação; qualquer minuto (ex.: 10:03)
        pg.click('[data-a=newRod]'); pg.wait_for_timeout(300)
        hi = '#dlg [data-hora]:has(#rtm)'
        pg.fill(hi + ' .hh', '10'); pg.fill(hi + ' .hm', '03')
        ok(pg.input_value('#rtm') == '10:03', f'CT-KAN-151-01: digitar 10 e 03 grava 10:03 ({pg.input_value("#rtm")})')
        pg.click(hi + ' [data-hseta="+m"]'); pg.wait_for_timeout(100)
        ok(pg.input_value('#rtm') == '10:04', f'CT-KAN-151-02: ▲ nos minutos soma 1 ({pg.input_value("#rtm")})')
        pg.fill(hi + ' .hh', '23'); pg.click(hi + ' [data-hseta="+h"]'); pg.wait_for_timeout(100)
        ok(pg.input_value('#rtm') == '00:04', f'CT-KAN-151-02: ▲ na hora 23 volta para 00 ({pg.input_value("#rtm")})')
        pg.fill(hi + ' .hh', '99'); ok(pg.input_value(hi + ' .hh') == '23', 'CT-KAN-151-03: hora não passa de 23')
        tf = '#dlg [data-hora]:has(#rfm)'
        ok(pg.input_value('#rfm') == '' and pg.input_value(tf + ' .hh') == '', 'CT-KAN-151-04: término pode ficar vazio')
        pg.click(tf + ' [data-hseta="+h"]'); pg.wait_for_timeout(100)
        ok(pg.input_value('#rfm') == '23:04', f'CT-KAN-151-04: a primeira seta do término parte do início ({pg.input_value("#rfm")})')
        hb = pg.evaluate("[...document.querySelectorAll('#dlg [data-hseta]')].map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height))")
        ok(min(hb) >= 36 and pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'CT-KAN-151-05: setas com 36px ou mais e sem rolagem lateral ({min(hb):.0f}px)')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
        fi = pg.evaluate("(()=>{const d=[...document.querySelectorAll('.ficha dt')].map(e=>Math.round(e.getBoundingClientRect().width));return [Math.min(...d),document.documentElement.scrollWidth<=innerWidth]})()")
        ok(fi[0] >= 200 and fi[1], f'CT-KAN-150-02: na aba Grupo, no celular, os rótulos ficam inteiros em cima do valor ({fi})')
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        pl = ctx.new_page(); pedidos = []; pl.on('request', lambda r: pedidos.append(r.url))
        pl.goto(URL + '#/p/' + gid_fut); pl.wait_for_timeout(1200)
        # v41 (KAN-149): o link do jogador não baixa a parte de gestão
        okp(any('/chunks/chunk-' in u for u in pedidos) and not any('/chunks/admin-' in u for u in pedidos), f'CT-KAN-149-01: o link público não baixa a parte de gestão ({[u.rsplit("/",1)[-1] for u in pedidos if "/chunks/" in u]})')
        larg = pl.evaluate("[document.documentElement.scrollWidth, innerWidth]"); pl.close()
        ok(larg[0] <= larg[1], f'CT-KAN-144-02: nem o link do jogador ({larg})')
        pg.click('[data-a=editRod]'); pg.wait_for_timeout(300); pg.fill('#rpl', END_LONGO); pg.click('[data-a=saveRod]'); pg.wait_for_timeout(800)
        # ---------- v35 (KAN-140): tocar fora ou Esc numa janela preenchida pergunta antes de descartar
        pg.click('[data-a=newRod]'); pg.wait_for_timeout(300); pg.mouse.click(8, 8); pg.wait_for_timeout(300)
        ok(not pg.evaluate("document.getElementById('dlg').open"), 'CT-KAN-140-01: janela sem nada preenchido fecha direto ao tocar fora')
        pg.click('[data-a=newRod]'); pg.wait_for_timeout(300); pg.fill('#rpl', 'Arena Nova'); pg.mouse.click(8, 8); pg.wait_for_timeout(300)
        cj = pg.inner_text('#dlg .conf') if pg.locator('#dlg .conf').count() else ''
        ok('Descartar o que você preencheu?' in cj and 'Continuar editando' in cj, 'CT-KAN-140-02: tocar fora com algo preenchido pergunta antes de descartar')
        confirmar_app(pg, False)
        ok(pg.locator('#rpl').is_visible() and pg.input_value('#rpl') == 'Arena Nova', 'CT-KAN-140-02: "Continuar editando" volta ao formulário com o que foi digitado')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        ok(pg.locator('#dlg .conf').count() == 1, 'CT-KAN-140-03: Esc com algo preenchido também pergunta')
        confirmar_app(pg, True)
        ok(not pg.evaluate("document.getElementById('dlg').open"), 'CT-KAN-140-03: "Descartar" fecha a janela')
        # ---------- v33 (KAN-138, decisão do Kleber 15/10): rodada com votação não pode ser sorteada de novo
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        ok(pg.locator('[data-a=drawDlg]').count() == 0 and 'exclua a votação' in pg.inner_text('main'),
           'CT-KAN-138-01: com votação na rodada, "Sortear de novo" some e o aviso explica como liberar')
        ok(pg.locator('[data-a=move]').count() > 0, 'CT-KAN-138-01: mover jogador continua disponível com votação')
        # Votação pública (sugerido pela Qualidade na v12): chip de tema, voto registrado e contraste nos dois temas
        vid = pg.evaluate("S.vid")
        pg.goto(URL + '#/p/' + gid_fut + '/v/' + vid); pg.wait_for_timeout(1000)
        ok(pg.locator('#themeBtn').is_visible(), 'votação pública: chip de tema visível')
        pg.select_option('[data-c=voter]', index=1); pg.wait_for_timeout(400)
        pg.locator('[data-a=pubVote]').first.click(); pg.wait_for_timeout(800)
        ok('Voto registrado' in pg.inner_text('main'), 'votação pública: voto registrado')
        contraste(pg, 'votação pública (claro)')
        pg.locator('#themeBtn').click(); pg.locator('.theme-menu [data-v=dark]').click(); pg.wait_for_timeout(300)
        contraste(pg, 'votação pública (escuro)'); shot('18-votacao-publica-escuro')
        pg.locator('#themeBtn').click(); pg.locator('.theme-menu [data-v=auto]').click(); pg.wait_for_timeout(200)
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000)

        # ---------- Aba Grupo e tema escuro na gestão
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(300)
        ok(pg.locator('.theme-seg').count() == 1, 'painel Aparência na aba Grupo')
        ok(f'versão {VER}' in pg.inner_text('main .versao'), 'CT-KAN-107-01: depois de entrar, a aba Grupo mostra a versão do app')
        ficha = pg.inner_text('.ficha')
        ok('Jogadores por time' in ficha and '11' in ficha, 'CT-KAN-100-01: aba Grupo mostra jogadores por time sem abrir Editar')
        ok('E-mail e senha' in pg.inner_text('.plist .via'), 'CT-KAN-98-01: administrador mostra que entrou com e-mail e senha')
        ok(pg.evaluate("Object.values(S.membros)[0].via") == 'senha', 'CT-KAN-98-01: forma de entrar gravada no administrador')
        pg.locator('.theme-seg [data-v=dark]').click(); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.documentElement.dataset.theme") == 'dark', 'Escuro pela aba Grupo')
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(300); shot('06-rodada-escuro'); contraste(pg, 'Rodada (escuro)')
        pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(300); shot('07-placar-escuro'); contraste(pg, 'Partida (escuro)')

        # ---------- Link público (jogador sem conta)
        pg.goto(URL + '#/p/' + gid_fut); pg.wait_for_timeout(900)
        ok(pg.locator('#themeBtn').is_visible(), 'chip de tema no link público')
        hl = pg.evaluate("[...document.querySelectorAll('.mk.lg button')].map(b=>Math.round(b.getBoundingClientRect().height))")
        ok(bool(hl) and min(hl) >= 44, f'Vou e Não vou com 44px no link público ({min(hl) if hl else "-"}px)')
        ok(pg.locator('.lvl-tag').count() == 0, 'link público não mostra notas')
        # ---------- v29 (KAN-127): achar o nome sem rolar
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(100)
        vis = pg.evaluate("(()=>{const f=document.querySelector('#pbusca'),v=document.querySelector('[data-a=pubMark]');if(!f||!v)return null;return {f:f.getBoundingClientRect().bottom,v:v.getBoundingClientRect().bottom,h:f.getBoundingClientRect().height,lbl:!!f.closest('label')&&f.closest('label').innerText.includes('Procure seu nome')}})()")
        ok(bool(vis) and vis['f'] <= 844 and vis['v'] <= 844, f'CT-KAN-127-01: "Procure seu nome" e o primeiro Vou aparecem sem rolar ({vis})')
        ok(bool(vis) and vis['h'] >= 44 and vis['lbl'], 'CT-KAN-127-06: campo de busca com rótulo visível e 44px de altura')
        total = pg.locator('[data-a=pubMark][data-v=in]').count()
        pg.fill('#pbusca', 'FERN'); pg.wait_for_timeout(150)
        achou = [re.split(r' ·|\n', x)[0].strip() for x in pg.locator('.mk.lg').locator('xpath=..').locator('.pn').all_inner_texts()]
        ok(len(achou) >= 1 and all('fern' in n.lower() for n in achou), f'CT-KAN-127-02: busca "FERN" mostra só os nomes com "fern", sem diferenciar maiúsculas ({achou})')
        pg.fill('#pbusca', 'aléMAO'); pg.wait_for_timeout(150)
        ok(pg.locator('[data-a=pubMark][data-v=in]').count() == 1, 'CT-KAN-127-02: busca ignora acentos ("aléMAO" acha Alemão)')
        pg.fill('#pbusca', ''); pg.wait_for_timeout(150)
        ok(pg.locator('[data-a=pubMark][data-v=in]').count() == total, f'CT-KAN-127-02: apagar a busca volta a lista completa ({total})')
        pg.fill('#pbusca', 'Zezinho Novo'); pg.wait_for_timeout(150)
        ok('Não achou? Toque em Adicionar meu nome' in pg.inner_text('main') and pg.locator('[data-a=pubAdd]').is_visible(), 'CT-KAN-127-03: busca sem resultado orienta e mostra "Adicionar meu nome"')
        pg.click('[data-a=pubAdd]'); pg.wait_for_selector('#anm', timeout=8000)
        ok(pg.input_value('#anm') == 'Zezinho Novo', 'CT-KAN-127-03: o nome digitado na busca já vem na janela')
        ok(pg.get_attribute('#anm', 'enterkeyhint') == 'done', 'CT-KAN-74-02: o teclado do celular mostra "Concluir" no campo da janela')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200); pg.fill('#pbusca', ''); pg.wait_for_timeout(150)
        ordem = pg.evaluate("(()=>{const h=[...document.querySelectorAll('main h3, main summary')].map(e=>e.textContent.trim());return h})()")
        iv = next((i for i, t in enumerate(ordem) if t.startswith('Você vai')), 99); it = next((i for i, t in enumerate(ordem) if t.startswith('Ver times')), -1)
        ok(it > iv and not pg.locator('main .teams').first.is_visible(), f'CT-KAN-127-04: com a lista aberta, "Você vai?" vem antes e os times ficam recolhidos em "Ver times" ({ordem[:4]})')
        txtp = pg.inner_text('main')
        # KAN-249 (v107): a linha da partida mostra quem marcou ("gols: Gui"); isso é o resultado, não a lista de nomes
        txpp = pg.inner_text('#pubPartidas') if pg.locator('#pubPartidas').count() else ''
        rep_ = [n for n in [re.split(r' ·|\n', x)[0].strip() for x in pg.locator('main .plist .pn').all_inner_texts()] if n and txtp.count(n) - txpp.count(n) > 1 and not any(n != m and n in m for m in [re.split(r' ·|\n', y)[0].strip() for y in pg.locator('main .plist .pn').all_inner_texts()])]
        ok(not rep_, f'CT-KAN-127-05: fora dos blocos recolhidos, cada nome aparece uma vez ({rep_[:3]})')
        ok('Partidas' in pg.inner_text('main') and ' × ' in pg.inner_text('main') and pg.locator('[data-a=delMatch]').count() == 0, 'CT-KAN-86-03: jogador vê o placar das partidas pelo link, sem botão de apagar')
        pg.locator('.mk.lg [data-v=out]').nth(11).click(); pg.wait_for_timeout(900)
        ok(pg.locator('.mk.lg button.on-out').first.inner_text().startswith('✕'), 'Não vou marcado mostra ✕')
        ok(pg.locator('.mk.lg button.on-in').first.inner_text().startswith('✓'), 'Vou marcado mostra ✓')
        pg.click('[data-a=pubAdd]'); pg.wait_for_selector('#anm', timeout=8000); pg.fill('#anm', 'Avulso Teste'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
        ok('Avulso Teste' in pg.inner_text('main') and not pg.evaluate("document.getElementById('dlg').open"), 'CT-KAN-74-01: avulso se adiciona pelo link apertando Enter ("Ir" no teclado)')
        shot('08-link-publico-escuro'); contraste(pg, 'link público (escuro)')
        pg.locator('#themeBtn').click(); pg.locator('.theme-menu [data-v=light]').click(); pg.wait_for_timeout(300)
        shot('09-link-publico-claro'); contraste(pg, 'link público (claro)')

        # ---------- v14: carregar só o que está na tela e gravar só o que mudou (KAN-82 a KAN-85)
        # 7 rodadas antigas gravadas direto no banco de demonstração (uma por semana para trás)
        pg.evaluate("""(g)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K)||'{}');
          for(let i=1;i<=7;i++){const d=new Date();d.setHours(12);d.setDate(d.getDate()-7*i);const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
            s['grupos/'+g+'/rodadas/antiga'+i]={date:ds,time:'20:00',place:'Quadra '+i,locked:false,times:null,info:{},matches:[],createdAt:Date.now()}}
          localStorage.setItem(K,JSON.stringify(s))}""", gid_fut)
        pg.goto(URL + '#/p/' + gid_fut); pg.reload(); pg.wait_for_timeout(900)
        ok(pg.evaluate("""(()=>{const d=new Date();d.setDate(d.getDate()-1);const y=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
          return Object.values(S.rod).every(r=>r.date>=y)})()"""), 'CT-KAN-82: link do jogador não carrega rodadas antigas')
        ok(pg.locator('.mk.lg button').count() >= 2, 'CT-KAN-82: link do jogador continua mostrando a próxima rodada')
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000)
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        # desde a v39 o seletor não mostra o local: identifica cada opção pelo local gravado na rodada
        opts = ' | '.join(pg.evaluate("[...document.querySelectorAll('select[data-c=rid] option')].map(o=>(S.rod[o.value]||{}).place||'')"))
        ok('Quadra 1' in opts and 'Quadra 4' in opts and 'Quadra 5' not in opts and 'Quadra 7' not in opts, 'CT-KAN-84: aba Rodada mostra as próximas e só as últimas 4')
        ok(pg.evaluate("!('antiga7' in S.rod) && !('antiga6' in S.rod)"), 'CT-KAN-84: rodadas antigas não são carregadas na aba Rodada')
        ok(pg.locator('[data-a=tab][data-v=historico]').count() >= 1, 'CT-KAN-84: atalho para o Histórico')
        # Gravação por campo: com uma cópia desatualizada da rodada (sem a partida), fechar a lista não apaga a partida salva
        rid = pg.evaluate("S.rid")
        antes = pg.evaluate("(a)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return (s['grupos/'+a[0]+'/rodadas/'+a[1]]||{}).np||0}", [gid_fut, rid])
        pg.evaluate("S.rod[S.rid].np=0"); pg.click('[data-a=lock]'); pg.wait_for_timeout(700)
        depois = pg.evaluate("(a)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));const d=s['grupos/'+a[0]+'/rodadas/'+a[1]]||{};return [!!d.locked,d.np||0]}", [gid_fut, rid])
        ok(antes >= 1 and depois[0] and depois[1] == antes, f'CT-KAN-83: fechar a lista não apaga partida salva por outro aparelho ({antes} → {depois[1]})')
        pg.click('[data-a=lock]'); pg.wait_for_timeout(300); confirmar_app(pg, False)  # com times, reabrir pede confirmação; aqui fica fechada (como antes da v30)
        # v18 (KAN-86): grupo com partidas no formato antigo é migrado na abertura
        pg.evaluate("""(g)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K));const d=new Date();d.setDate(d.getDate()-63);d.setHours(12);
          const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const js=Object.keys(S.jog);
          s['grupos/'+g+'/rodadas/velha1']={date:ds,time:'20:00',place:'Quadra velha',locked:true,info:{},times:[{c:0,players:js.slice(0,2)},{c:1,players:js.slice(2,4)}],
            matches:[{id:'mv1',ca:0,cb:1,pa:js.slice(0,2),pb:js.slice(2,4),ga:2,gb:0,goals:[{t:'a',pid:js[0],pts:1},{t:'a',pid:js[0],pts:1}],at:1},{id:'mv2',ca:0,cb:1,pa:js.slice(0,2),pb:js.slice(2,4),ga:1,gb:1,goals:[],at:2}],createdAt:1};
          delete s['grupos/'+g+'/privado/migracao'];Object.keys(s).filter(k=>k.startsWith('grupos/'+g+'/resumos/')).forEach(k=>delete s[k]);
          localStorage.setItem(K,JSON.stringify(s));window._mesVelho=ds.slice(0,7);window._p0=js[0]}""", gid_fut)
        mes_velho = pg.evaluate("window._mesVelho"); p0 = pg.evaluate("window._p0")
        pg.reload(); pg.wait_for_timeout(2000)
        mg = pg.evaluate("(a)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')),g=a[0],r=s['grupos/'+g+'/rodadas/velha1'],res=s['grupos/'+g+'/resumos/'+a[1]]||{},j=((res.jog||{})[a[2]])||{};return [!!s['grupos/'+g+'/rodadas/velha1/partidas/mv1'],!!s['grupos/'+g+'/rodadas/velha1/partidas/mv2'],(r.matches||[]).length,r.np,j.j||0,j.v||0,j.e||0,j.g||0,(s['grupos/'+g+'/privado/migracao']||{}).v]}", [gid_fut, mes_velho, p0])
        ok(mg == [True, True, 0, 2, 2, 1, 1, 2, 18], f'CT-KAN-86-02: partidas antigas migradas e totais do mês montados ({mg})')
        tot = pg.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return Object.keys(s).filter(k=>k.startsWith('grupos/'+g+'/resumos/')).reduce((a,k)=>a+Object.values(s[k].jog||{}).reduce((b,x)=>b+(x.j||0),0),0)}", gid_fut)
        ok(tot == 18, f'CT-KAN-86-02: ranking depois da migração soma as partidas novas e as antigas ({tot})')
        # Histórico
        pg.click('[data-a=tab][data-v=historico]'); pg.wait_for_timeout(900); shot('12-historico')
        ok(pg.locator('#hmes').count() == 1, 'CT-KAN-85: aba Histórico abre com a busca por mês')
        pg.click('[data-a=histModo][data-v=periodo]'); pg.wait_for_timeout(200)
        pg.evaluate("""()=>{const f=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
          document.getElementById('hde').value=f(-70);document.getElementById('hate').value=f(0)}""")
        pg.click('[data-a=histBuscar]'); pg.wait_for_timeout(900)
        txt = pg.inner_text('main')
        ok(all(f'Quadra {i}' in txt for i in range(1, 8)), 'CT-KAN-85: busca por período encontra as rodadas antigas')
        pg.locator('li', has_text='Quadra 6').locator('[data-a=histAbrir]').click(); pg.wait_for_timeout(700); shot('13-historico-rodada')
        det = pg.inner_text('main')
        ok(all(x in det for x in ['Confirmados', 'Times', 'Partidas', 'Votação', 'Quadra 6']), 'CT-KAN-85: rodada do histórico mostra lista, times, partidas e votação')
        contraste(pg, 'Histórico (claro)')
        pg.click('[data-a=histVoltar]'); pg.wait_for_timeout(300)
        pg.evaluate("()=>{document.getElementById('hde').value='2001-01-01';document.getElementById('hate').value='2001-01-31'}")
        pg.click('[data-a=histBuscar]'); pg.wait_for_timeout(700)
        ok('Nenhum jogo nesse período.' in pg.inner_text('main'), 'CT-KAN-85: período sem jogos mostra mensagem clara')
        ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-85: Histórico sem rolagem lateral no celular')

        # ---------- Outros esportes: nada de futebol fixo
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(800)
        novo_grupo(pg, 'Beach Domingo', 'beach_tennis')
        ok('#/g/' in pg.url and pg.url.split('#/g/')[1] != gid_fut, 'grupo de beach tennis criado')
        gid_bt = pg.url.split('#/g/')[1]
        elenco_e_presenca(pg, 8)
        ok(pg.locator('main .pos').count() == 0, 'beach tennis sem siglas de posição')
        sortear(pg)
        ok('Dupla 1' in pg.inner_text('main'), 'beach tennis sorteia em duplas')
        av = pg.inner_text('.lista-fechada') if pg.locator('.lista-fechada').count() else ''
        ok('sorteie de novo' in av and 'Pôr no time' not in av, f'CT-KAN-110-01: em duplas o aviso da lista fechada não cita "+ Pôr no time" ({av[:60]})')
        ok(not FUTEBOL.search(pg.inner_text('main')), 'Rodada do beach tennis sem palavras de futebol')
        pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(400)
        ok(pg.locator('[data-a=goal]').first.inner_text().strip() == '+ Game', 'placar do beach tennis conta Game')
        ok(not FUTEBOL.search(pg.inner_text('main')), 'Partida do beach tennis sem palavras de futebol'); shot('10-beach-placar')
        novo_grupo(pg, 'Basquete Quinta', 'basquete')
        gid_bq = pg.url.split('#/g/')[1]
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(300)
        bb = pg.evaluate("(()=>{const b=document.querySelector('.acao-fixa [data-a=drawDlg]');return b?[b.textContent.trim(),b.disabled]:null})()")
        ok(bb == ['Faltam 4 para sortear', True], f'CT-KAN-71-01: sem confirmados, o botão fixo fica desabilitado e diz quantos faltam ({bb})')
        elenco_e_presenca(pg, 10); sortear(pg)
        ok(not FUTEBOL.search(pg.inner_text('main')), 'Rodada do basquete sem palavras de futebol')
        pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(400)
        sc = [x.strip() for x in pg.locator('[data-a=goal][data-v=a]').all_inner_texts()]
        ok(sc == ['+1', '+2', '+3'], f'placar do basquete com +1, +2 e +3 ({sc})')
        pg.locator('[data-a=goal][data-v=a]').nth(2).click(); pg.wait_for_timeout(200); pg.locator('[data-a=addGoal][data-p]').first.click(); pg.wait_for_timeout(300)
        sem_assist(pg)
        ok(pg.locator('.board .sc').first.inner_text().strip() == '3', 'cesta de 3 soma 3 pontos'); shot('11-basquete-placar')
        # ---------- v41 (KAN-75): textos do basquete vêm do catálogo, sem nada de futebol
        pg.locator('[data-a=goal][data-v=a]').nth(1).click(); pg.wait_for_timeout(200)
        tj = pg.inner_text('#dlg h3')
        ok(tj.startswith('+2 pontos — '), f'CT-KAN-75-03: no basquete, a janela do ponto diz "+2 pontos — time" ({tj!r})')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        pg.locator('[data-a=goal][data-v=a]').nth(0).click(); pg.wait_for_timeout(200)
        t1 = pg.inner_text('#dlg h3'); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        ok(t1.startswith('+1 ponto — '), f'CT-KAN-75-03: "+1 ponto" no singular ({t1!r})')
        pg.click('[data-a=tab][data-v=votacao]'); pg.wait_for_timeout(400)
        vz = pg.inner_text('main')
        ok('melhor jogador' in vz and 'bagre' in vz and not FUTEBOL.search(vz) and 'goleiro' not in vz.lower(), f'CT-KAN-75-02: votação vazia do basquete sem "goleiro" ({vz[:90]!r})')
        pg.evaluate("S.app.cfg.fixos=[{dow:4,ini:'19:00',fim:'21:00',place:'Ginásio'},{dow:6,ini:'09:00',fim:'',place:''}]")
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        pg.click('[data-a=shareFixo]'); pg.wait_for_timeout(300)
        fx = pg.input_value('#shtxt'); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        ok(fx.startswith('🏀 *') and '⚽' not in fx, f'CT-KAN-75-01: convite do link permanente com o emoji do basquete ({fx[:30]!r})')
        ok('Toda quinta, 19:00 às 21:00 — Ginásio' in fx and 'Todo sábado, 09:00' in fx, f'CT-KAN-75-01: "Toda quinta" e "Todo sábado" no convite ({fx!r})')
        pg.evaluate("S.app.cfg.fixos=[]"); pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(300)
        # ---------- v29 (KAN-73): pontuar com segurança em qualquer esporte
        hb = pg.evaluate("[...document.querySelectorAll('[data-a=goal]')].map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height)})")
        ok(min(hb) >= 44, f'CT-KAN-73-01: basquete: +1, +2 e +3 com 44px ({min(hb):.0f}px)')
        pg.evaluate("S.app.sport='fut_americano'"); pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(300)
        fa = pg.evaluate("(()=>{const g=document.querySelector('.board .pts');return {cols:getComputedStyle(g).gridTemplateColumns.split(' ').length,grade:g.classList.contains('grade'),h:Math.min(...[...document.querySelectorAll('[data-a=goal]')].map(b=>b.getBoundingClientRect().height)),n:document.querySelectorAll('[data-a=goal][data-v=a]').length}})()")
        ok(fa['grade'] and fa['cols'] == 2 and fa['h'] >= 44 and fa['n'] == 5, f'CT-KAN-73-02: futebol americano: 5 pontuações em grade de 2 colunas, com 44px ({fa})')
        ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-73-02: placar com 5 pontuações sem rolagem lateral'); shot('11b-placar-grade')
        pg.evaluate("S.app.sport='basquete'"); pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(300)
        pg.evaluate("S.live.dur=1"); pg.click('[data-a=clock]'); pg.wait_for_timeout(1700)
        ck = pg.evaluate("(()=>{const c=document.getElementById('clock'),s=getComputedStyle(c);return {over:c.classList.contains('over'),pisca:c.classList.contains('pisca'),vezes:s.animationIterationCount,msg:!document.getElementById('clockMsg').hidden}})()")
        ok(ck['over'] and ck['pisca'] and ck['vezes'] == '3' and ck['msg'], f'CT-KAN-73-03: tempo esgotado: o número pisca só 3 vezes e o aviso fica fixo ({ck})')
        pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(400)
        ok(not pg.evaluate("document.getElementById('clock').classList.contains('pisca')"), 'CT-KAN-73-03: ao redesenhar a tela, o cronômetro não volta a piscar')
        pg.click('[data-a=clock]'); pg.click('[data-a=clockReset]'); pg.wait_for_timeout(300)
        # ---------- v33 (KAN-138): com partida salva (sem votação), sortear de novo pede confirmação
        pg.click('[data-a=saveMatch]'); pg.wait_for_timeout(800)
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        t_antes = pg.evaluate("JSON.stringify(S.rod[S.rid].times.map(t=>t.players))")
        pg.locator('.panel [data-a=drawDlg]').first.click(); pg.wait_for_timeout(300)
        cj = pg.inner_text('#dlg .conf') if pg.locator('#dlg .conf').count() else ''
        ok('Sortear de novo com partidas salvas?' in cj and 'continua no ranking' in cj, f'CT-KAN-138-02: com partida salva, "Sortear de novo" avisa antes ({cj[:60]!r})')
        confirmar_app(pg, False)
        ok(pg.evaluate("JSON.stringify(S.rod[S.rid].times.map(t=>t.players))") == t_antes and not pg.evaluate("document.getElementById('dlg').open"), 'CT-KAN-138-02: Cancelar não mexe nos times')
        pg.locator('.panel [data-a=drawDlg]').first.click(); pg.wait_for_timeout(300); confirmar_app(pg, True)
        ok(pg.locator('#drawGo').is_visible(), 'CT-KAN-138-02: confirmando, abre a janela do sorteio')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)

        # ---------- v16 (KAN-94 e KAN-95): jogadores por time definido no grupo, reservas e posições fora do sorteio
        pg.click('[data-a=groupsDlg]'); pg.wait_for_timeout(300); pg.click('#dlg [data-a=newGroup]'); pg.wait_for_timeout(300)
        ok(pg.input_value('#ngt') == '11', 'CT-KAN-94-01: novo grupo de futebol vem com 11 por time')
        pg.click('[data-a=pickSport][data-v=volei_praia]'); ok(pg.input_value('#ngt') == '2', 'CT-KAN-94-01: vôlei de praia vem com 2 (duplas)')
        pg.click('[data-a=pickSport][data-v=society]'); ok(pg.input_value('#ngt') == '6', 'CT-KAN-94-01: society vem com 6')
        pg.fill('#ngt', '0'); pg.fill('#ngn', 'Society Terça'); pg.click('[data-a=createGroup]'); pg.wait_for_timeout(600)
        ok(pg.locator('#ngn').count() == 1, 'CT-KAN-94-01: número inválido de jogadores por time não cria o grupo')
        pg.fill('#ngt', '4'); pg.click('[data-a=createGroup]'); pg.wait_for_timeout(1500)
        ok(pg.evaluate("S.app&&S.app.cfg.porTime") == 4, 'CT-KAN-94-01: grupo grava jogadores por time')
        pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(300); pg.click('[data-a=seed]'); pg.wait_for_timeout(1500)
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        for i in range(14):
            pg.locator('[data-a=mark][data-v=in]').nth(i).click(); pg.wait_for_timeout(250)
        pg.wait_for_timeout(500)
        pg.click('[data-a=drawDlg]'); pg.wait_for_timeout(300)
        ok(pg.get_attribute('#drawBox', 'data-n') == '3', 'CT-KAN-94-02: com 14 confirmados e times de 4, sugere 3 times')
        ok(pg.inner_text('#drawPrev') == '14 jogadores → 3 times de 4 + 2 reservas', 'CT-KAN-94-02: prévia mostra times e reservas (' + pg.inner_text('#drawPrev') + ')')
        pg.click('#drawBox [data-a=dN][data-v="4"]'); pg.wait_for_timeout(100)
        ok('4 times de 4 e 3' in pg.inner_text('#drawPrev'), 'CT-KAN-94-02: com 4 times divide por igual sem reserva (' + pg.inner_text('#drawPrev') + ')')
        pg.click('#drawBox [data-a=dN][data-v="3"]'); pg.click('#drawBox [data-a=dFora][data-v=GOL]'); pg.wait_for_timeout(100)
        ok(pg.inner_text('#drawK') == '12' and pg.inner_text('#drawPrev') == '12 jogadores → 3 times de 4', 'CT-KAN-95-01: tirar a posição GOL tira os goleiros do sorteio')
        pg.click('#drawBox [data-a=dFora][data-v=GOL]'); pg.wait_for_timeout(100)
        ok(pg.inner_text('#drawK') == '14', 'CT-KAN-95-01: tocar de novo devolve a posição ao sorteio')
        shot('15-sorteio-por-time'); pg.click('#drawGo'); pg.wait_for_timeout(2500)
        tz = pg.evaluate("S.rod[S.rid].times.map(t=>[t.players.length,(t.res||[]).length])")
        ok(sorted(tz) == [[4, 0], [5, 1], [5, 1]], f'CT-KAN-94-02: 3 times de 4 com 2 reservas ({tz})')
        ok(pg.evaluate("S.rod[S.rid].times.every(t=>(t.res||[]).every(id=>t.players.filter(p=>p!==id).every(p=>S.pres[p].t<=S.pres[id].t)))"), 'CT-KAN-94-02: reserva é quem confirmou por último no time')
        ok(pg.locator('.team li.reserva').count() == 2, 'CT-KAN-94-02: reservas aparecem marcados nos times'); shot('16-times-com-reserva'); contraste(pg, 'times com reserva')
        pg.click('[data-a=shareTimes]'); pg.wait_for_timeout(300)
        ok(pg.input_value('#shtxt').count('— reserva') == 2, 'CT-KAN-94-02: texto do WhatsApp indica os reservas'); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        gid_soc = pg.url.split('#/g/')[1]
        pg.goto(URL + '#/p/' + gid_soc); pg.wait_for_timeout(900)
        ok(pg.locator('.team li.reserva').count() == 2, 'CT-KAN-94-02: link do jogador mostra os reservas')
        pg.goto(URL + '#/g/' + gid_soc); pg.wait_for_timeout(900); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        # Reserva vira titular pelo ⇄
        rid0 = pg.evaluate("(S.rod[S.rid].times.find(t=>t.res)||{}).res[0]")
        pg.click(f'.team [data-a=move][data-p="{rid0}"]'); pg.wait_for_timeout(300); pg.click('#dlg [data-a=toggleRes]'); pg.wait_for_timeout(600)
        ok(pg.evaluate("(id)=>!S.rod[S.rid].times.some(t=>(t.res||[]).includes(id))", rid0), 'CT-KAN-94-03: "Marcar como titular" tira a marca de reserva')
        # Sortear de novo sem goleiros: a escolha fica salva no grupo
        pg.click('[data-a=drawDlg]'); pg.wait_for_timeout(300); pg.click('#drawBox [data-a=dFora][data-v=GOL]'); pg.click('#drawGo'); pg.wait_for_timeout(2500)
        ok(pg.evaluate("S.rod[S.rid].times.every(t=>t.players.every(id=>S.jog[id].pos!=='GOL')&&!t.res)"), 'CT-KAN-95-02: sorteio sem goleiros e sem reservas (12 em 3 times de 4)')
        pg.click('[data-a=drawDlg]'); pg.wait_for_timeout(300)
        ok(pg.get_attribute('#drawBox [data-a=dFora][data-v=GOL]', 'aria-pressed') == 'true', 'CT-KAN-95-02: posição fora do sorteio fica salva para o próximo'); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        # Time completo: quem é posto no time entra como reserva
        gol = pg.evaluate("Object.keys(S.jog).find(id=>S.jog[id].pos==='GOL')")
        pg.locator('[data-a=porTime]').first.click(); pg.wait_for_timeout(300); pg.click(f'#dlg [data-a=doPorTime][data-p="{gol}"]'); pg.wait_for_timeout(700)
        ok(pg.evaluate("(id)=>(S.rod[S.rid].times[0].res||[]).includes(id)", gol), 'CT-KAN-94-03: pôr alguém num time completo entra como reserva')
        ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-94: sem rolagem lateral no celular')

        # ---------- v22: correções dos defeitos abertos pela Qualidade (KAN-76, KAN-108, KAN-109, KAN-112)
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        rid_x = pg.evaluate("S.rid")
        # KAN-76: presença gravada com identificador malicioso não chega à tela (nem do administrador nem do link)
        pg.evaluate("""(a)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K));
          s['grupos/'+a[0]+'/rodadas/'+a[1]+'/presencas/x"><img src=x onerror="window.__xss=1">']={s:'in',t:1,nome:'Invasor',avulso:true,by:'z',dev:'z'};
          localStorage.setItem(K,JSON.stringify(s))}""", [gid_fut, rid_x])
        pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(600)
        ok(pg.evaluate("!window.__xss && !document.querySelector('img[src=\"x\"]') && !document.body.innerText.includes('Invasor')"), 'CT-KAN-76-01: identificador com código é ignorado na aba Rodada (nada é executado)')
        pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(500)
        ok(pg.evaluate("!window.__xss && !document.querySelector('img[src=\"x\"]')"), 'CT-KAN-76-02: nada é executado na aba Jogadores')
        pg.goto(URL + '#/p/' + gid_fut + '/r/' + rid_x); pg.wait_for_timeout(1200)
        ok(pg.evaluate("!window.__xss && !document.body.innerText.includes('Invasor')"), 'CT-KAN-76-03: nada é executado no link do jogador')
        # KAN-108: trocar a cor com os times desatualizados não desfaz um sorteio feito por outro administrador
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        if pg.evaluate("!!(S.rod[S.rid]&&S.rod[S.rid].times)"):
            # tela deste aparelho desatualizada (times antigos); no banco estão os times do outro administrador
            novo = pg.evaluate("(a)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return JSON.stringify(s['grupos/'+a[0]+'/rodadas/'+a[1]].times.map(t=>t.players))}", [gid_fut, rid_x])
            pg.evaluate("S.rod[S.rid]=Object.assign({},S.rod[S.rid],{times:S.rod[S.rid].times.map(t=>Object.assign({},t,{players:t.players.slice().reverse()}))})")
            trocar_colete(pg, '.team [data-a=color]')
            depois = pg.evaluate("(a)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')),d=s['grupos/'+a[0]+'/rodadas/'+a[1]];return [JSON.stringify(d.times.map(t=>t.players)),d.cores&&d.cores['0']!=null]}", [gid_fut, rid_x])
            ok(depois[0] == novo and depois[1], 'CT-KAN-108-01: a cor nova é gravada sem desfazer o sorteio do outro administrador')
        else:
            ok(False, 'CT-KAN-108-01: rodada sem times para testar a cor')
        # KAN-109: enquanto a presença carrega, mostra "Carregando…" e não "Ninguém confirmou ainda"
        # Como na abertura do grupo: presença ainda não chegou (lista vazia na memória) numa rodada com times sorteados
        tem_times = pg.evaluate("!!(S.rod[S.rid]&&S.rod[S.rid].times)")
        pg.evaluate("S.loaded.pres=false;window.__presGuardada=S.pres;S.pres={}"); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(200)
        txt = pg.inner_text('main')
        ok('Carregando' in txt and 'Ninguém confirmou ainda' not in txt, 'CT-KAN-109-01: presença carregando mostra "Carregando…"')
        ok(tem_times and pg.locator('.warn-div').count() == 0 and 'não vai mais' not in txt, 'KAN-137 (v32): enquanto a presença carrega, não aparece o aviso "A lista mudou depois do sorteio" com todos saindo')
        pg.evaluate("S.pres=window.__presGuardada;S.loaded.pres=true"); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(200)
        # KAN-112: o aviso "Abra no navegador" usa o mesmo texto do botão
        ok('Continuar com Google' not in pg.content(), 'CT-KAN-112-01: nenhum texto "Continuar com Google" sem o "o" no app')

        # ---------- KAN-89: limites contra abuso. No modo demonstração o app avisa; no Firebase, as regras recusam (testes/regras-firebase).
        LIM = "(o)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K));if(o)s['sistema/limites']=o;else delete s['sistema/limites'];localStorage.setItem(K,JSON.stringify(s))}"
        cont = pg.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return Object.entries(s).filter(([k])=>k.startsWith('grupos/'+g+'/rodadas/')&&k.endsWith('/limites/avulsos')).map(([,v])=>v.n)}", gid_fut)
        ok(cont == [1], f'CT-KAN-89-01: avulso novo pelo link soma 1 no contador da rodada; jogador cadastrado e administrador não contam ({cont})')
        # A lista desta rodada está fechada pelo sorteio: reabre direto no banco de demonstração para testar o link aberto.
        TRAVA = "(a)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K)),r=s['grupos/'+a[0]+'/rodadas/'+a[1]];if(r)r.locked=a[2];localStorage.setItem(K,JSON.stringify(s))}"
        pg.goto(URL + '#/p/' + gid_fut); pg.wait_for_timeout(900); rid_lim = pg.evaluate("S.route.id")
        pg.evaluate(LIM, {'avulsosPorRodada': 1}); pg.evaluate(TRAVA, [gid_fut, rid_lim, False]); pg.reload(); pg.wait_for_timeout(1200)
        txt = pg.inner_text('main')
        ok('limite de nomes novos' in txt and pg.locator('[data-a=pubAdd]').count() == 0, 'CT-KAN-89-02: no limite, o link avisa e esconde "Adicionar meu nome"')
        ok(pg.locator('.mk.lg [data-v=in]').count() >= 2, 'CT-KAN-89-02: no limite, quem já está na lista continua respondendo Vou / Não vou')
        shot('20-limite-link')
        # CT-03: no limite, um jogador da lista faz Vou, Não vou e Vou de novo: as três gravam, sem aviso de limite e sem somar no contador
        lim0 = pg.evaluate(LER, lim_k(gid_fut, rid_lim))
        pj = pg.evaluate("Object.keys(S.pres).find(id=>S.jog[id]&&S.pres[id].s==='in')")
        seq = []; avisos = []
        for v in ['in', 'out', 'in']:
            pg.click(f'.mk.lg [data-a=pubMark][data-p="{pj}"][data-v={v}]'); pg.wait_for_timeout(800)
            seq.append((pg.evaluate(LER, pres_k(gid_fut, rid_lim, pj)) or {}).get('s')); avisos.append(pg.inner_text('#toast'))
        lim1 = pg.evaluate(LER, lim_k(gid_fut, rid_lim))
        ok(seq == ['in', 'out', 'in'] and not any('limite' in t for t in avisos) and (lim1 or {}).get('n') == (lim0 or {}).get('n') == 1,
           f'CT-KAN-89-03: no limite, jogador da lista faz Vou, Não vou e Vou de novo sem bloqueio nem aviso de limite ({seq}, contador {(lim1 or {}).get("n")})')
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        av = pg.inner_text('.aviso-limite') if pg.locator('.aviso-limite').count() else ''
        ok('limite de avulsos novos (1)' in av and pg.locator('[data-a=addAvulso]').count() >= 1, f'CT-KAN-89-03: organizador vê o aviso do limite na aba Rodada e ainda pode adicionar avulso ({av[:50]})')
        contraste(pg, 'Rodada com aviso de limite')
        # CT-04: no limite, o administrador adiciona um avulso (administrador não tem limite e não soma no contador)
        n0 = pg.evaluate("Object.values(S.pres).filter(p=>p.s==='in').length")
        pg.click('[data-a=addAvulso]'); pg.wait_for_timeout(300); pg.fill('#anm', 'Avulso do Admin'); pg.click('#dlg [data-a=saveAvulso]'); pg.wait_for_timeout(1000)
        n1 = pg.evaluate("Object.values(S.pres).filter(p=>p.s==='in').length")
        av_adm = pg.evaluate("Object.keys(S.pres).find(id=>S.pres[id].nome==='Avulso do Admin')||null")
        ok(av_adm and n1 == n0 + 1 and pg.evaluate(LER, pres_k(gid_fut, rid_lim, av_adm or '-')) and (pg.evaluate(LER, lim_k(gid_fut, rid_lim)) or {}).get('n') == 1,
           f'CT-KAN-89-04: no limite, o administrador adiciona um avulso e ele entra na lista ({n0} → {n1}), sem somar no contador')
        # CT-07: limite trocado de 1 para 2 na configuração: o botão volta; com o 2º avulso some de novo
        pg.goto(URL + '#/p/' + gid_fut); pg.evaluate(LIM, {'avulsosPorRodada': 2}); pg.reload(); pg.wait_for_timeout(1200)
        ok(pg.locator('[data-a=pubAdd]').count() == 1 and pg.locator('.aviso-limite').count() == 0, 'CT-KAN-89-07: com o limite trocado de 1 para 2, "Adicionar meu nome" volta no link sem versão nova')
        av_lk2 = adicionar_pelo_link(pg, 'Avulso Dois')
        n_lim = (pg.evaluate(LER, lim_k(gid_fut, rid_lim)) or {}).get('n')
        ok(av_lk2 and n_lim == 2 and pg.locator('[data-a=pubAdd]').count() == 0 and 'limite de nomes novos' in pg.inner_text('main'),
           f'CT-KAN-89-07: o 2º avulso pelo link soma no contador ({n_lim}) e o botão some de novo')
        # Desfaz: tira os dois avulsos de teste da rodada e volta o contador para 1
        pg.evaluate(DEL, [pres_k(gid_fut, rid_lim, x) for x in [av_adm, av_lk2] if x] + ([f'grupos/{gid_fut}/avulsos/{av_adm}'] if av_adm else []))
        pg.evaluate(PUT, {lim_k(gid_fut, rid_lim): lim0}); pg.reload(); pg.wait_for_timeout(1000)
        # CT-09: beach tennis: avulso pelo link conta e, no limite, o link avisa e esconde o botão; sem siglas de posição
        pg.goto(URL + '#/p/' + gid_bt); pg.wait_for_timeout(1000); rid_bt = pg.evaluate("S.route.id")
        pg.evaluate(LIM, None); pg.evaluate(TRAVA, [gid_bt, rid_bt, False]); pg.reload(); pg.wait_for_timeout(1200)
        av_bt = adicionar_pelo_link(pg, 'Avulso Praia')
        nb = (pg.evaluate(LER, lim_k(gid_bt, rid_bt)) or {}).get('n')
        ok(av_bt and nb == 1 and 'Avulso Praia' in pg.inner_text('main'), f'CT-KAN-89-09: beach tennis: avulso novo pelo link soma 1 no contador da rodada ({nb})')
        pg.evaluate(LIM, {'avulsosPorRodada': 1}); pg.reload(); pg.wait_for_timeout(1200)
        ok('limite de nomes novos' in pg.inner_text('main') and pg.locator('[data-a=pubAdd]').count() == 0 and pg.locator('.mk.lg [data-v=in]').count() >= 2 and pg.locator('main .pos').count() == 0,
           'CT-KAN-89-09: beach tennis no limite: o link avisa, esconde "Adicionar meu nome", mantém Vou / Não vou e não mostra siglas de posição')
        pg.evaluate(DEL, [pres_k(gid_bt, rid_bt, av_bt or '-'), lim_k(gid_bt, rid_bt)]); pg.evaluate(TRAVA, [gid_bt, rid_bt, True])
        pg.evaluate(LIM, {'avulsosPorRodada': 1}); pg.reload(); pg.wait_for_timeout(800)
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1200)
        ng = pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return (s['contas/'+S.user.uid]||{}).ng||0})()")
        ok(ng >= 2, f'CT-KAN-89-04: cada grupo criado soma 1 no contador da conta ({ng})')
        pg.evaluate(LIM, {'gruposPorConta': ng}); pg.reload(); pg.wait_for_timeout(1200)
        antes = pg.evaluate("Object.keys(S.me.grupos||{}).length")
        novo_grupo(pg, 'Grupo Além do Limite', 'futebol')
        err = pg.inner_text('#ngErr') if pg.locator('#ngErr').count() else ''
        ok('chegou ao limite de' in err and pg.evaluate("Object.keys(S.me.grupos||{}).length") == antes, f'CT-KAN-89-05: no limite de grupos aparece mensagem clara e nenhum grupo é criado ({err[:40]})')
        shot('21-limite-grupos')
        # Singular (Qualidade, 10/10): com limite 1 o texto diz "1 grupo", e não "1 grupos"
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
        pg.evaluate(LIM, {'gruposPorConta': 1}); pg.reload(); pg.wait_for_timeout(1200)
        novo_grupo(pg, 'Grupo Além do Limite', 'futebol')
        err = pg.inner_text('#ngErr') if pg.locator('#ngErr').count() else ''
        ok('limite de 1 grupo.' in err and '1 grupos' not in err, f'CT-KAN-89-05: com limite 1, a mensagem fala "1 grupo" no singular ({err[:40]})')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
        # CT-05 também em "Duplicar grupo"
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
        antes = pg.evaluate("Object.keys(S.me.grupos||{}).length")
        pg.click('[data-a=dupGroup]'); pg.wait_for_timeout(300); pg.click('#dlg [data-a=doDupGroup]'); pg.wait_for_timeout(1200)
        err = pg.inner_text('#dgErr') if pg.locator('#dgErr').count() else ''
        ok('chegou ao limite de' in err and pg.evaluate("Object.keys(S.me.grupos||{}).length") == antes and '#/g/' + gid_fut in pg.url,
           f'CT-KAN-89-05: no limite, "Duplicar grupo" mostra mensagem clara e nenhum grupo é criado ({err[:40]})')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
        pg.evaluate(LIM, None); pg.evaluate(TRAVA, [gid_fut, rid_lim, True]); pg.reload(); pg.wait_for_timeout(1000)

        # ---------- Casos da Qualidade automatizados (KAN-110, KAN-109, KAN-108, KAN-76)
        # KAN-110 CT-03: futebol e basquete continuam citando "+ Pôr no time", e o botão existe
        for nome_g, g in [('futebol', gid_fut), ('basquete', gid_bq)]:
            pg.goto(URL + '#/g/' + g); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
            av = pg.inner_text('.lista-fechada') if pg.locator('.lista-fechada').count() else ''
            nb = pg.locator('.team [data-a=porTime]').count()
            ok('+ Pôr no time' in av and nb >= 2, f'CT-KAN-110-03: {nome_g}: o aviso da lista fechada cita "+ Pôr no time" e o botão existe ({nb})')
        # KAN-110 CT-02: vôlei de praia e futebol com 2 por time seguem a regra de duplas
        DUPLAS = 'Lista fechada pelo sorteio. Para mudar a presença, reabra a lista ou sorteie de novo.'
        novo_grupo(pg, 'Vôlei Praia Sábado', 'volei_praia')
        elenco_e_presenca(pg, 8); sortear(pg)
        av = pg.inner_text('.lista-fechada') if pg.locator('.lista-fechada').count() else ''
        ok(av.strip() == DUPLAS and pg.locator('[data-a=porTime]').count() == 0, f'CT-KAN-110-02: vôlei de praia: aviso de duplas sem "+ Pôr no time" ({av[:50]})')
        pg.click('[data-a=groupsDlg]'); pg.wait_for_timeout(300); pg.click('#dlg [data-a=newGroup]'); pg.wait_for_timeout(300)
        pg.fill('#ngn', 'Futebol em Dupla'); pg.fill('#ngt', '2'); pg.click('[data-a=createGroup]'); pg.wait_for_timeout(1500)
        elenco_e_presenca(pg, 8); sortear(pg)
        av = pg.inner_text('.lista-fechada') if pg.locator('.lista-fechada').count() else ''
        ok(pg.evaluate("S.app.sport==='futebol'&&S.app.cfg.porTime===2") and av.strip() == DUPLAS and pg.locator('[data-a=porTime]').count() == 0,
           f'CT-KAN-110-02: futebol com 2 por time: mesmo aviso de duplas, sem nada fixo por esporte ({av[:50]})')

        # KAN-109 CT-02 e CT-03: rodada sem presença mostra "Ninguém confirmou ainda"; rodada com confirmados mostra todos
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        rid_main = pg.evaluate("S.rid")
        pg.evaluate("""(g)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K)),d=new Date();d.setDate(d.getDate()+40);d.setHours(12);
          const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
          s['grupos/'+g+'/rodadas/vazia109']={date:ds,time:'20:00',place:'Quadra vazia',locked:false,times:null,info:{},createdAt:Date.now()};localStorage.setItem(K,JSON.stringify(s))}""", gid_fut)
        pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(400)
        pg.select_option('select[data-c=rid]', 'vazia109')
        try:
            pg.wait_for_selector('text=Ninguém confirmou ainda', timeout=5000)
        except Exception:
            pass
        txt = pg.inner_text('main')
        ok('Ninguém confirmou ainda. Mande o link no grupo.' in txt and 'Quadra vazia' in txt and 'Carregando' not in txt and pg.inner_text('.hero-r .count').startswith('0'),
           'CT-KAN-109-02: rodada sem nenhuma presença mostra "Ninguém confirmou ainda. Mande o link no grupo." depois de carregar')
        # ---------- v46 (KAN-160): a aba Partida tem o seletor de rodada, mesmo sem times
        pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(500)
        sem = pg.inner_text('main')
        ok(pg.locator('#partidaRaiz select[data-c=rid]').count() == 1 and 'Sem times sorteados' in sem and pg.locator('#partidaRaiz [data-a=tab][data-v=rodada]').count() == 1,
           'CT-KAN-160-01/03: rodada sem times na aba Partida mostra o seletor e o caminho para sortear')
        pg.select_option('#partidaRaiz select[data-c=rid]', rid_main); pg.wait_for_timeout(600)
        ok(pg.locator('.board').count() == 1 and pg.locator('#partidaRaiz select[data-c=rid]').count() == 1 and pg.evaluate("S.rid") == rid_main,
           'CT-KAN-160-02: trocando no seletor da Partida para uma rodada com times, o placar aparece na hora')
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        pg.select_option('select[data-c=rid]', rid_main); pg.wait_for_timeout(800)
        n_in = pg.evaluate("(a)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')),p='grupos/'+a[0]+'/rodadas/'+a[1]+'/presencas/';return Object.keys(s).filter(k=>k.startsWith(p)&&/^[A-Za-z0-9_-]{1,64}$/.test(k.slice(p.length))&&s[k].s==='in').length}", [gid_fut, rid_main])
        pg.click('[data-a=presFiltro][data-v=in]'); pg.wait_for_timeout(200)
        conf = pg.locator('#presPainel')
        nl = conf.locator('ol.plist li').count()
        ok(n_in >= 4 and nl == n_in and 'Ninguém confirmou' not in conf.inner_text() and pg.inner_text('.hero-r .count').startswith(str(n_in)),
           f'CT-KAN-109-03: rodada com confirmados mostra a lista com todos ({nl} de {n_in})')
        pg.click('[data-a=presFiltro][data-v=todos]'); pg.wait_for_timeout(200)
        pg.evaluate(DEL, [f'grupos/{gid_fut}/rodadas/vazia109']); pg.reload(); pg.wait_for_timeout(1200)

        # KAN-108 CT-02: troca a cor e, com uma cópia desatualizada, sorteia de novo: o sorteio novo é gravado e a cor escolhida continua
        pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        RODDB = "(a)=>JSON.parse(localStorage.getItem('pelada-demo-v2'))['grupos/'+a[0]+'/rodadas/'+a[1]]"
        trocar_colete(pg, '.team [data-a=color][data-v="1"]')
        d0 = pg.evaluate(RODDB, [gid_fut, rid_main])
        pg.evaluate("S.rod[S.rid]=Object.assign({},S.rod[S.rid]);delete S.rod[S.rid].cores")  # este aparelho não viu a troca de cor
        # A rodada principal tem votação (desde a v33 isso bloqueia sortear de novo); aqui a votação sai só da memória para testar as cores
        pg.evaluate("window.__votGuardada=S.vot;S.vot={}"); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(300)
        sortear(pg)
        pg.evaluate("S.vot=window.__votGuardada"); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(300)
        d1 = pg.evaluate(RODDB, [gid_fut, rid_main])
        ok((d0.get('cores') or {}).get('1') is not None and d1.get('drawnAt') != d0.get('drawnAt') and d1.get('cores') == d0.get('cores') and d1.get('locked'),
           f'CT-KAN-108-02: sortear de novo com a tela desatualizada grava o sorteio novo e mantém as cores escolhidas ({d1.get("cores")})')
        # KAN-108 CT-06: o link do jogador mostra os times novos com as cores novas, sem notas
        esperado = [[f'Time {i + 1}', 'colete ' + CORES[((d1.get('cores') or {}).get(str(i), t.get('c', 0)) or 0) % 8].lower() + ' · ' + str(len(t['players']))] for i, t in enumerate(d1['times'])]
        pg.goto(URL + '#/p/' + gid_fut); pg.wait_for_timeout(1200)
        visto = pg.evaluate("[...document.querySelectorAll('.team')].map(t=>[t.querySelector('.th b').textContent,t.querySelector('.th .tag').textContent])")
        ok(pg.evaluate("S.route.id") == rid_main and visto == esperado and pg.locator('.lvl-tag').count() == 0,
           f'CT-KAN-108-06: link do jogador mostra os times novos com as cores novas e sem notas ({visto})')
        # KAN-108 CT-05: basquete não perde nenhuma mudança; em duplas (beach tennis) não existe botão de Cor, de propósito
        pg.goto(URL + '#/g/' + gid_bq); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        rid_bq = pg.evaluate("S.rid")
        novo = json.dumps([t['players'] for t in pg.evaluate(RODDB, [gid_bq, rid_bq])['times']], separators=(',', ':'))
        pg.evaluate("S.rod[S.rid]=Object.assign({},S.rod[S.rid],{times:S.rod[S.rid].times.map(t=>Object.assign({},t,{players:t.players.slice().reverse()}))})")
        trocar_colete(pg, '.team [data-a=color]')
        db = pg.evaluate(RODDB, [gid_bq, rid_bq])
        ok(json.dumps([t['players'] for t in db['times']], separators=(',', ':')) == novo and (db.get('cores') or {}).get('0') is not None,
           'CT-KAN-108-05: basquete: a cor nova é gravada sem desfazer o sorteio do outro administrador')
        pg.goto(URL + '#/g/' + gid_bt); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
        ok(pg.locator('.team').count() >= 2 and pg.locator('[data-a=color]').count() == 0, 'CT-KAN-108-05: beach tennis (duplas): sem botão de Cor, de propósito, então não há cor a perder')

        # KAN-76 CT-06: voto com código no identificador, no pid e nos valores é ignorado; nada é injetado
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000)
        cats = pg.evaluate("(v)=>((S.vot[v]||{}).cats||[]).map(c=>c.id)", vid)
        vk = f'grupos/{gid_fut}/votacoes/{vid}/votos/'
        pg.evaluate(PUT, {vk + XSS: {'pid': XSS, 'v': {c: XSS for c in cats}, 't': 1}, vk + 'zz76': {'pid': XSS, 'v': {**{c: XSS for c in cats}, XSS: XSS}, 't': 2}})
        pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-a=tab][data-v=votacao]'); pg.wait_for_timeout(800)
        ok(bool(cats) and pg.evaluate(SEM_XSS) and pg.locator('main .panel h3').count() >= len(cats), 'CT-KAN-76-06: votação do administrador com voto malicioso abre sem nada executado nem injetado')
        pg.goto(URL + '#/p/' + gid_fut + '/v/' + vid); pg.wait_for_timeout(1200)
        ok(pg.evaluate(SEM_XSS) and pg.locator('[data-c=voter]').count() == 1, 'CT-KAN-76-06: votação pública com voto malicioso abre sem nada executado nem injetado')
        pg.evaluate(DEL, [vk + XSS, vk + 'zz76']); pg.reload(); pg.wait_for_timeout(800)
        # KAN-76 CT-12: beach tennis e basquete: presença com código (CT-01) e sorteio com a carga gravada (CT-03)
        for nome_g, g in [('beach tennis', gid_bt), ('basquete', gid_bq)]:
            pg.goto(URL + '#/g/' + g); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
            rg = pg.evaluate("S.rid")
            pg.evaluate(PUT, {pres_k(g, rg, XSS): {'s': 'in', 't': 1, 'nome': 'Invasor', 'avulso': True, 'by': 'z', 'dev': 'z'}})
            pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(600)
            ok(pg.evaluate(SEM_XSS) and pg.locator('[data-a=mark],.team').count() > 0, f'CT-KAN-76-12: {nome_g}: presença com código é ignorada na aba Rodada (nada é executado)')
            d0 = pg.evaluate(RODDB, [g, rg])
            pg.click('[data-a=drawDlg]'); pg.wait_for_timeout(300)
            if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)  # basquete tem partida salva (KAN-138)
            vals = pg.evaluate("[...document.querySelectorAll('#drawBox .dp')].map(x=>x.value)")
            pg.click('#drawGo'); pg.wait_for_timeout(2500)
            d1 = pg.evaluate(RODDB, [g, rg])
            bons = all(re.fullmatch(r'[A-Za-z0-9_-]{1,64}', x) for x in vals) and XSS not in json.dumps(d1.get('times'))
            forma = ('Dupla 1' in pg.inner_text('main')) if nome_g == 'beach tennis' else pg.locator('.team').count() >= 2
            ok(bons and len(vals) >= 4 and d1.get('drawnAt') != d0.get('drawnAt') and forma and pg.evaluate(SEM_XSS),
               f'CT-KAN-76-12: {nome_g}: sorteio com a carga gravada funciona, só com identificadores válidos e nada injetado')
            pg.evaluate(DEL, [pres_k(g, rg, XSS)]); pg.reload(); pg.wait_for_timeout(800)

        # ---------- v49 (KAN-167, defeito do Kleber 16/10): posição criada e par separado continuam depois de recarregar
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1200)
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400); pg.click('[data-a=addPos]'); pg.wait_for_timeout(300)
        pg.fill('#psg', 'vol'); pg.fill('#pnmx', 'Volante'); pg.click('#dlg [data-a=savePos]'); pg.wait_for_timeout(700)
        bruto167 = pg.evaluate("(g)=>JSON.stringify(JSON.parse(localStorage.getItem('pelada-demo-v2'))['grupos/'+g].posx)", gid_fut)
        ok('__lista' in bruto167 and 'Volante' in bruto167, f'CT-KAN-167-01: a posição criada é gravada num formato que o Firestore aceita ({bruto167})')
        pg.reload(); pg.wait_for_timeout(1500); pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
        ok('Volante' in pg.inner_text('main') and pg.evaluate("(S.app.posx||[]).some(p=>Array.isArray(p)&&p[0]==='VOL'&&p[1]==='Volante')"), 'CT-KAN-167-01: depois de recarregar (F5), a posição criada continua lá')
        pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(400); pg.click('[data-a=addSep]'); pg.wait_for_timeout(300)
        ops167 = pg.eval_on_selector_all('#sa option', 'os=>os.map(o=>o.value)')
        pg.select_option('#sa', ops167[0]); pg.select_option('#sb', ops167[1]); pg.click('#dlg [data-a=saveSep]'); pg.wait_for_timeout(700)
        pg.reload(); pg.wait_for_timeout(1500); pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(500)
        ok(pg.locator('[data-a=delSep]').count() >= 1 and pg.evaluate("(S.rat.sep||[]).some(p=>Array.isArray(p)&&p.length===2)"), 'CT-KAN-167-02: o par "não colocar no mesmo time" continua depois de recarregar')
        pg.locator('[data-a=delSep]').last.click(); pg.wait_for_timeout(500)
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
        pg.locator('[data-a=rmPos]').last.click(); pg.wait_for_timeout(300)
        if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)
        pg.wait_for_timeout(500)

        # ---------- v47 (KAN-162): país da conta e do grupo (moeda, formato, fuso) e telefone com o país ao lado
        pg.goto(URL + '#/'); pg.wait_for_timeout(900)
        ok(pg.evaluate("S.me && S.me.pais") == 'BR' and pg.evaluate("S.me.formato") == 'pt-BR', 'CT-KAN-162-01: conta criada num aparelho no fuso de São Paulo fica com o país Brasil')
        home162 = pg.inner_text('main')
        # v48 (KAN-166): o país da conta fica no menu da conta, no cabeçalho
        ok(pg.inner_text('#topright [data-a=contaMenu]') == 'O' and 'País da conta' not in home162, 'CT-KAN-166-01: cabeçalho mostra o botão da conta com a inicial do e-mail; a página inicial não repete o país')
        pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(300)
        menu166 = pg.inner_text('.theme-menu') if pg.locator('.theme-menu').count() else ''
        ok('org@teste.com' in menu166 and 'País e formatos' in menu166 and 'Brasil' in menu166 and 'Sair' in menu166
           and pg.get_attribute('#topright [data-a=contaMenu]', 'aria-expanded') == 'true' and pg.evaluate("document.activeElement.dataset.a") == 'contaPais',
           f'CT-KAN-166-01: o menu da conta mostra o e-mail, País e formatos (com o país) e Sair ({menu166!r})')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        ok(pg.locator('.theme-menu').count() == 0 and pg.evaluate("document.activeElement.dataset.a") == 'contaMenu', 'CT-KAN-166-01: Esc fecha o menu e o foco volta ao botão da conta')
        abrir_pais_conta(pg)
        ok(pg.locator('.theme-menu').count() == 0, 'CT-KAN-166-02: escolher um item fecha o menu')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        # v50 (KAN-169): com conta, o tema fica no menu da conta
        ok(not pg.locator('#themeBtn').is_visible(), 'CT-KAN-169-01: com conta, o cabeçalho não mostra o botão do tema')
        pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(300)
        tema169 = {'auto': 'Automático', 'light': 'Claro', 'dark': 'Escuro'}[pg.evaluate("localStorage.getItem('nj-tema')") or 'auto']
        ok('Tema' in pg.inner_text('.theme-menu') and tema169 in pg.inner_text('.theme-menu'), f'CT-KAN-169-01: o menu da conta tem "Tema" com o tema atual ({tema169})')
        pg.click('.theme-menu [data-a=temaConta]'); pg.wait_for_timeout(300)
        ok(pg.locator('.theme-menu [data-v=dark]').count() == 1 and pg.get_attribute('#topright [data-a=contaMenu]', 'aria-expanded') == 'true', 'CT-KAN-169-02: "Tema" abre as opções Automático, Claro e Escuro')
        pg.click('.theme-menu [data-v=dark]'); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.documentElement.dataset.theme") == 'dark', 'CT-KAN-169-02: escolher Escuro deixa o app escuro')
        contraste(pg, 'gestão no escuro pelo menu da conta (CT-KAN-169-04)')
        pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(300)
        ok('Escuro' in pg.inner_text('.theme-menu'), 'CT-KAN-169-02: o menu da conta mostra "Tema: Escuro"')
        pg.click('.theme-menu [data-a=temaConta]'); pg.wait_for_timeout(200); pg.click('.theme-menu [data-v=auto]'); pg.wait_for_timeout(300)
        abrir_pais_conta(pg)
        ok(pg.evaluate("document.activeElement.id") == 'cpais', 'CT-KAN-162-02: a janela do país abre com o cursor no combo')
        pg.select_option('#cpais', 'US'); pg.click('#dlg [data-a=salvarPaisConta]'); pg.wait_for_timeout(600)
        pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(300)
        menu166b = pg.inner_text('.theme-menu') if pg.locator('.theme-menu').count() else ''
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        ok(pg.evaluate("S.me.pais") == 'US' and 'Estados Unidos' in menu166b and (pg.evaluate(LER, 'usuarios/u-orgtestecom') or {}).get('pais') == 'US',
           'CT-KAN-162-02: trocar o país da conta grava e mostra o país novo')
        pg.click('main [data-a=newGroup]'); pg.wait_for_timeout(400)
        rot166 = pg.inner_text('#sched .srow')
        ok('Início' in rot166 and 'Término (opcional)' in rot166 and rot166.index('Início') < rot166.index('Término'), f'CT-KAN-166-03: os horários do dia fixo têm os rótulos Início e Término (opcional) ({rot166!r})')
        ok(pg.input_value('#ngp') == 'US' and pg.input_value('#ngm') == 'USD' and pg.locator('#ngzW').is_visible() and pg.input_value('#ngz') == 'America/New_York',
           'CT-KAN-162-02: grupo novo já vem com o país, a moeda e o fuso do organizador (EUA, dólar, Nova York)')
        pg.select_option('#ngp', 'PT'); pg.wait_for_timeout(100)
        ok(pg.input_value('#ngm') == 'EUR' and pg.input_value('#ngz') == 'Europe/Lisbon', 'CT-KAN-162-02: trocar o país do grupo troca a moeda e o fuso')
        pg.select_option('#ngp', 'US'); pg.wait_for_timeout(100)
        pg.fill('#ngn', 'Pickup Soccer NYC'); pg.click('[data-a=createGroup]'); pg.wait_for_timeout(1500)
        gid_us = pg.url.split('#/g/')[1]
        cfg_us = (pg.evaluate(LER, 'grupos/' + gid_us) or {}).get('cfg') or {}
        ok(cfg_us.get('pais') == 'US' and cfg_us.get('moeda') == 'USD' and cfg_us.get('formato') == 'en-US' and cfg_us.get('fuso') == 'America/New_York',
           'CT-KAN-162-02: o grupo guarda país, moeda, formato e fuso')
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
        pg.click('[data-a=settings]'); pg.wait_for_timeout(300)
        rot162 = pg.inner_text('#dlg')
        ok('Mensalidade ($)' in rot162 and 'Diária ($)' in rot162, f'CT-KAN-162-02: valores do caixa com o símbolo da moeda do grupo ({rot162[:80]!r})')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        ok('$' in pg.inner_text('main') and 'R$' not in pg.inner_text('main'), 'CT-KAN-162-02: a aba Grupo mostra os valores em dólar, sem R$')
        pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(300); pg.click('[data-a=addPlayer]'); pg.wait_for_timeout(300)
        ok(pg.input_value('#ppais') == 'US' and '10 dígitos' in (pg.get_attribute('#ptel', 'placeholder') or ''), 'CT-KAN-162-03: telefone de jogador novo já vem com o combo nos EUA')
        pg.fill('#pnm', 'Mike Jones'); pg.fill('#ptel', '(212) 555-0142'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(700)
        tel162 = pg.evaluate("()=>{const p=Object.entries(S.jog).find(([,x])=>x.name==='Mike Jones');return p&&S.cont[p[0]]&&S.cont[p[0]].tel}")
        ok(tel162 == '+12125550142' and pg.locator('a[href="https://api.whatsapp.com/send?phone=12125550142"]').count() == 1, f'CT-KAN-162-03: número americano sem "+" vira +1 e o WhatsApp abre certo ({tel162})')
        pg.click('[data-a=addPlayer]'); pg.wait_for_timeout(300)
        pg.fill('#pnm', 'Mike Curto'); pg.fill('#ptel', '212 555 01'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(400)
        ok('Estados Unidos' in pg.inner_text('#toast') and '10 dígitos' in pg.inner_text('#toast'), 'CT-KAN-162-03: número incompleto avisa quantos dígitos tem o número no país')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        if pg.locator('#dlg .conf').count(): confirmar_app(pg, True)
        # Trocar a moeda avisa que os valores lançados não são convertidos
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400); pg.click('[data-a=editGroup]'); pg.wait_for_timeout(400)
        ok(pg.input_value('#ngp') == 'US' and pg.input_value('#ngm') == 'USD', 'CT-KAN-162-04: Editar grupo mostra o país e a moeda do grupo')
        pg.select_option('#ngm', 'BRL'); pg.click('#dlg [data-a=saveGroup]'); pg.wait_for_timeout(300)
        conf162 = pg.inner_text('#dlg .conf') if pg.locator('#dlg .conf').count() else ''
        ok('Trocar a moeda' in conf162 and 'não são convertidos' in conf162, f'CT-KAN-162-04: trocar a moeda pede confirmação ({conf162[:90]!r})')
        confirmar_app(pg, True); pg.wait_for_timeout(800)
        ok(((pg.evaluate(LER, 'grupos/' + gid_us) or {}).get('cfg') or {}).get('moeda') == 'BRL', 'CT-KAN-162-04: confirmando, a moeda nova é gravada')
        # O grupo de antes (sem país) continua Brasil e Real; a conta volta para o Brasil
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1200)
        pg.click('[data-a=tab][data-v=jogadores]'); pg.wait_for_timeout(300); pg.click('[data-a=addPlayer]'); pg.wait_for_timeout(300)
        ok(pg.input_value('#ppais') == 'BR' and pg.get_attribute('#ptel', 'placeholder') == '(11) 98765-4321', 'CT-KAN-162-05: grupo antigo, sem país, continua com o telefone do Brasil')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        pg.goto(URL + '#/'); pg.wait_for_timeout(800)
        abrir_pais_conta(pg); pg.select_option('#cpais', 'BR'); pg.click('#dlg [data-a=salvarPaisConta]'); pg.wait_for_timeout(600)

        # ---------- Sugestões da Qualidade (09/10): versão em todas as telas, convite e tema escuro
        pg.goto(URL + '#/'); pg.wait_for_timeout(900)
        ok(f'versão {VER}' in (pg.inner_text('main .versao') if pg.locator('main .versao').count() else ''), 'CT-KAN-107-03: Meus grupos mostra a versão do app')
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
        pg.click('[data-a=inviteLink]'); pg.wait_for_timeout(500); token = pg.evaluate("S.convite&&S.convite.token"); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
        # Sair (KAN-80): com algo ainda sem enviar, pergunta antes; Cancelar mantém a pessoa conectada
        pg.evaluate("window.__demoPendente=true")
        sair(pg); pg.wait_for_timeout(800)
        sj = pg.inner_text('#dlg .conf') if pg.locator('#dlg .conf').count() else ''
        ok('Sair sem enviar' in sj and 'Sair mesmo assim' in sj, 'CT-KAN-128: Sair com alterações sem enviar pergunta na janela do app ("Sair mesmo assim")')
        confirmar_app(pg, False)
        ok(pg.evaluate("!!(S.user&&!S.user.anon)"), 'CT-KAN-80-03: com alterações sem enviar, Sair pergunta antes e Cancelar mantém conectado')
        pg.evaluate("window.__demoPendente=false")
        sair(pg); pg.wait_for_timeout(1500)
        ok(pg.locator('.ld-nav').count() == 1 and pg.evaluate("!S.user||S.user.anon") and pg.evaluate("Object.keys(S.caixa||{}).length==0&&!S.rat"), 'CT-KAN-80-01: Sair desconecta, recarrega na apresentação e não deixa dados do grupo na tela')
        abrir_entrada(pg, 'entrar')
        ok(f'Nosso Jogo · versão {VER}' in pg.inner_text('main'), 'CT-KAN-107-02: tela Entrar mostra a versão do app')
        pg.evaluate("localStorage.setItem('nj-tema','dark')"); pg.reload(); pg.wait_for_timeout(900)
        ok(pg.evaluate("document.documentElement.dataset.theme") == 'dark', 'tema escuro aplicado na tela Entrar')
        contraste(pg, 'Entrar (escuro, CT-KAN-107-05)')
        pg.goto(URL + '#/'); pg.wait_for_timeout(900)
        contraste(pg, 'apresentação (escuro, CT-KAN-107-05)'); shot('19-apresentacao-escuro')
        ok(f'versão {VER}' in pg.inner_text('.ld-foot'), 'CT-KAN-107-05: versão no rodapé da apresentação no tema escuro')
        if token:
            pg.goto(URL + '#/convite/' + gid_fut + '/' + token); pg.wait_for_timeout(1200)
            ok(pg.locator('#themeBtn').is_visible(), 'convite: chip de tema visível')
            ok(pg.evaluate("document.activeElement&&document.activeElement.id") == 'le', 'convite: cursor já no campo de e-mail')
            contraste(pg, 'convite (escuro)')
        else:
            ok(False, 'convite: não foi possível gerar o link de convite')

        # ---------- KAN-80 (Qualidade): depois de Sair
        # CT-04: o endereço do grupo mostra só a tela Entrar, sem abas, jogadores, notas ou caixa
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1200)
        txt = pg.inner_text('main')
        ok(pg.locator('#le').count() == 1 and pg.evaluate("document.querySelector('#tabsnav').hidden") and pg.locator('[data-a=tab]').count() == 0
           and pg.locator('.lvl-tag,.money,.team').count() == 0 and not any(n in txt for n in ['Bruno', 'Japa', 'R$']),
           'CT-KAN-80-04: depois de Sair, o endereço do grupo mostra só a tela Entrar, sem abas, jogadores, notas ou caixa')
        # CT-05: o link do jogador continua funcionando sem conta (Vou grava) e sem notas
        pg.evaluate(TRAVA, [gid_fut, rid_main, False]); pg.reload(); pg.wait_for_timeout(600)
        pg.goto(URL + '#/p/' + gid_fut); pg.wait_for_timeout(1500)
        alvo = pg.locator('.mk.lg [data-a=pubMark][data-v=in]:not(.on-in)').first.get_attribute('data-p')
        antes = pg.evaluate(LER, pres_k(gid_fut, rid_main, alvo))
        pg.click(f'.mk.lg [data-a=pubMark][data-p="{alvo}"][data-v=in]'); pg.wait_for_timeout(1000)
        depois = pg.evaluate(LER, pres_k(gid_fut, rid_main, alvo)) or {}
        ok(pg.evaluate("!!(S.user&&S.user.anon)") and depois.get('s') == 'in' and 'Presença confirmada' in pg.inner_text('#toast') and pg.locator('.lvl-tag').count() == 0,
           'CT-KAN-80-05: depois de Sair, o link do jogador funciona sem conta: Vou grava e não há notas')
        pg.evaluate(PUT, {pres_k(gid_fut, rid_main, alvo): antes}) if antes else pg.evaluate(DEL, [pres_k(gid_fut, rid_main, alvo)])
        pg.evaluate(TRAVA, [gid_fut, rid_main, True]); pg.reload(); pg.wait_for_timeout(600)
        # CT-06: entrar de novo traz o grupo; no tema escuro, Sair cabe nos 390px, tem contraste AA e leva à apresentação
        abrir_entrada(pg, 'entrar')
        pg.fill('#le', 'org@teste.com'); pg.fill('#lp', 'Jogo@2026'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1500)
        ok(pg.evaluate("!!(S.user&&!S.user.anon)") and pg.locator('[data-a=tab]').count() >= 8 and pg.inner_text('#gname') == 'Futebol de Segunda' and pg.locator('.hero-r').count() == 1,
           'CT-KAN-80-06: entrar de novo com a mesma conta traz o grupo de volta')
        ok(pg.evaluate("document.documentElement.dataset.theme") == 'dark' and pg.evaluate("(()=>{const r=document.querySelector('#topright [data-a=contaMenu]').getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth})()"),
           'CT-KAN-80-06: no tema escuro, o botão da conta (com o Sair) cabe na tela de 390px')
        contraste(pg, 'gestão com Sair (escuro, CT-KAN-80-06)')
        sair(pg)
        try: pg.wait_for_selector('.ld-nav', timeout=8000); pg.wait_for_timeout(300)
        except Exception: pass
        ok(pg.locator('.ld-nav').count() == 1 and pg.evaluate("!S.user||S.user.anon"), 'CT-KAN-80-06: Sair no tema escuro leva à apresentação, sem conta conectada')
        pg.evaluate("localStorage.removeItem('nj-tema')")

        # ---------- Casos da Qualidade (14/10): caixa só para administradores (KAN-79), presença pelo link (KAN-78, KAN-77, KAN-133)
        # O que só as regras do Firebase garantem (CT-KAN-79-01/02, CT-KAN-78-01/02/07, CT-KAN-77-01 a 04, CT-KAN-133-02) é testado no emulador.
        PIX79 = 'chave-kan79-teste'; PIX_VELHO = 'chave-antiga-kan79'
        GK, PCK = f'grupos/{gid_fut}', f'grupos/{gid_fut}/privado/caixa'
        pc0 = pg.evaluate(LER, PCK); eu0 = pg.evaluate("localStorage.getItem('pelada-eu')")
        # Preparação do CT-KAN-116-07: o último acesso do organizador fica de 10 dias atrás e este aparelho "esquece" que já registrou hoje
        pg.evaluate(PUT, {'contas/u-orgtestecom': {**(pg.evaluate(LER, 'contas/u-orgtestecom') or {}), 'acesso': int(time.time() * 1000) - 10 * 86400000}})
        pg.evaluate("localStorage.removeItem('nj-acesso-u-orgtestecom')")
        abrir_entrada(pg, 'entrar')
        pg.fill('#le', 'org@teste.com'); pg.fill('#lp', 'Jogo@2026'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
        pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1500)
        pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
        pg.click('[data-a=settings]'); pg.wait_for_timeout(300)
        pg.fill('#cm', '120'); pg.fill('#cd', '25'); pg.fill('#cpx', PIX79); pg.click('#dlg [data-a=saveSettings]'); pg.wait_for_timeout(1000)
        gdoc = pg.evaluate(LER, GK) or {}; pcd = pg.evaluate(LER, PCK) or {}; cfg_pub = gdoc.get('cfg') or {}
        ok(not any(k in cfg_pub for k in ('mensal', 'diaria', 'pix')) and PIX79 not in json.dumps(gdoc) and pcd.get('mensal') == 120 and pcd.get('diaria') == 25 and pcd.get('pix') == PIX79
           and 'Pix: ' + PIX79 in pg.inner_text('main'),
           f'CT-KAN-79-03: Mensalidade 120, Diária 25 e Pix ficam só em privado/caixa, nada no documento público do grupo (cfg público: {sorted(cfg_pub)})')
        # CT-05: grupo antigo com os 3 campos no documento público; o administrador abre o grupo e eles saem de lá
        g_mig = json.loads(json.dumps(gdoc)); g_mig.setdefault('cfg', {}).update({'mensal': 150, 'diaria': 30, 'pix': PIX_VELHO})
        pg.evaluate(PUT, {GK: g_mig}); pg.reload(); pg.wait_for_timeout(2000)
        cfg2 = (pg.evaluate(LER, GK) or {}).get('cfg') or {}; pc2 = pg.evaluate(LER, PCK) or {}
        ok(not any(k in cfg2 for k in ('mensal', 'diaria', 'pix')) and pc2.get('mensal') == 120 and pc2.get('pix') == PIX79,
           f'CT-KAN-79-05: grupo antigo com mensalidade, diária e Pix no documento público: ao abrir, os 3 campos saem de lá (cfg público: {sorted(cfg2)})')
        sair(pg)
        try: pg.wait_for_selector('.ld-nav', timeout=8000); pg.wait_for_timeout(300)
        except Exception: pass
        # Visitante sem conta no link permanente, com a lista aberta
        pg.evaluate(TRAVA, [gid_fut, rid_main, False]); pg.reload(); pg.wait_for_timeout(600)
        pg.goto(URL + '#/p/' + gid_fut); pg.wait_for_timeout(1500)
        ok(pg.evaluate("!!(S.user&&S.user.anon)") and 'Futebol de Segunda' in pg.inner_text('body') and pg.locator('.mk.lg [data-a=pubMark][data-v=in]').count() >= 1
           and pg.locator('.mk.lg [data-a=pubMark][data-v=out]').count() >= 1, 'CT-KAN-133-01: visitante sem conta abre o link do grupo: o grupo carrega com Vou e Não vou')
        body = pg.inner_text('body'); html = pg.content()
        ok(not re.search(r'R\$|Pix|[Mm]ensalidade|[Dd]iária', body) and PIX79 not in html and PIX_VELHO not in html and pg.evaluate("!(S.pc&&S.pc.pix)"),
           'CT-KAN-79-04: no link público não aparece Pix, mensalidade, diária nem valores')
        LISTA = "[...document.querySelectorAll('ol.plist li')].map(li=>[li.querySelector('.num').textContent.trim(),li.querySelector('.pn').textContent.trim()])"
        nomes = lambda: [x[1] for x in pg.evaluate(LISTA)]
        # CT-KAN-78-03: jogador já confirmado toca Vou de novo: a hora gravada não muda e ele mantém a posição
        inn = pg.evaluate("Object.keys(S.pres).filter(id=>S.pres[id].s==='in'&&S.jog[id]).sort((a,b)=>S.pres[a].t-S.pres[b].t)")
        pj = inn[0]; nome_pj = pg.evaluate("id=>S.jog[id].name", pj)
        p_antes = pg.evaluate(LER, pres_k(gid_fut, rid_main, pj)); lista0 = nomes()
        pg.click(f'.mk.lg [data-a=pubMark][data-p="{pj}"][data-v=in]'); pg.wait_for_timeout(900)
        p1 = pg.evaluate(LER, pres_k(gid_fut, rid_main, pj)) or {}; lista1 = nomes()
        ok(len(inn) >= 4 and p1.get('s') == 'in' and p1.get('t') == p_antes.get('t') and lista1 == lista0 and nome_pj in lista1,
           f'CT-KAN-78-03: confirmado que toca Vou de novo mantém a hora e a posição (t {p_antes.get("t")} → {p1.get("t")}; {lista0.index(nome_pj) + 1}º → {lista1.index(nome_pj) + 1 if nome_pj in lista1 else "-"}º)')
        # CT-KAN-78-04: Não vou e depois Vou: hora nova, maior que a anterior, e ele vai para o fim da fila
        pg.click(f'.mk.lg [data-a=pubMark][data-p="{pj}"][data-v=out]'); pg.wait_for_timeout(900)
        p_out = pg.evaluate(LER, pres_k(gid_fut, rid_main, pj)) or {}
        pg.click(f'.mk.lg [data-a=pubMark][data-p="{pj}"][data-v=in]'); pg.wait_for_timeout(900)
        p2 = pg.evaluate(LER, pres_k(gid_fut, rid_main, pj)) or {}; lista2 = nomes()
        ok(p_out.get('s') == 'out' and p2.get('s') == 'in' and p2.get('t', 0) > p_antes.get('t', 0) and p2.get('t', 0) >= p_out.get('t', 0) and lista2 and lista2[-1] == nome_pj and len(lista2) == len(lista0),
           f'CT-KAN-78-04: Não vou e depois Vou grava hora nova e maior, e o jogador vai para o fim da lista ({lista2.index(nome_pj) + 1 if nome_pj in lista2 else "-"}º de {len(lista2)})')
        # CT-KAN-77-05: link permanente no celular de 390px: só a próxima rodada, sem datas distantes, e o Vou grava
        i77 = pg.evaluate("""(()=>{const f=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
          const ds=Object.values(S.rod).map(r=>r.date),r=S.rod[S.route.id]||{};
          return {ds,d:r.date,ok:ds.every(d=>d>=f(-1))&&!!r.date&&r.date<=f(15),w:innerWidth,larg:document.documentElement.scrollWidth<=innerWidth}})()""")
        ok(i77['ok'] and i77['w'] == 390 and i77['larg'] and p2.get('s') == 'in',
           f'CT-KAN-77-05: link permanente em 390px mostra só a próxima rodada ({i77["d"]}), nenhuma data distante, sem rolagem lateral, e o Vou grava ({i77["ds"]})')
        # CT-KAN-78-06 e 05: avulso novo pelo link entra no fim da lista numerada; Não vou e Vou não mudam nome, avulso e posição
        lim78 = pg.evaluate(LER, lim_k(gid_fut, rid_main))
        pg.click('[data-a=pubAdd]'); pg.wait_for_selector('#anm', timeout=8000); pg.fill('#anm', 'Zé Avulso 78')
        tem_pos = pg.locator('select#apos').count() == 1
        if tem_pos: pg.select_option('select#apos', index=1)
        pg.click('[data-a=pubSaveAdd]'); pg.wait_for_timeout(1200)
        za = pg.evaluate("Object.keys(S.pres).find(id=>S.pres[id].nome==='Zé Avulso 78')||null")
        l6 = pg.evaluate(LISTA)
        esp = pg.evaluate("Object.keys(S.pres).filter(id=>S.pres[id].s==='in').sort((a,b)=>S.pres[a].t-S.pres[b].t).map(id=>(S.jog[id]&&S.jog[id].name)||(S.avul&&S.avul[id]&&S.avul[id].nome)||S.pres[id].nome)")
        ok(bool(za) and [x[0] for x in l6] == [str(i + 1) for i in range(len(l6))] and [x[1] for x in l6] == esp and l6[-1][1] == 'Zé Avulso 78',
           f'CT-KAN-78-06: a lista do link é numerada na ordem de confirmação, com o avulso novo no fim ({", ".join(f"{a} {b}" for a, b in l6[-3:])})')
        z0 = pg.evaluate(LER, pres_k(gid_fut, rid_main, za or '-')) or {}
        for v in ['out', 'in']:
            pg.click(f'.mk.lg [data-a=pubMark][data-p="{za}"][data-v={v}]'); pg.wait_for_timeout(900)
        z1 = pg.evaluate(LER, pres_k(gid_fut, rid_main, za or '-')) or {}
        ok(bool(za) and z1.get('s') == 'in' and z0.get('avulso') is True and z0.get('nome') == 'Zé Avulso 78' and (not tem_pos or z0.get('pos'))
           and all(z1.get(k) == z0.get(k) for k in ('nome', 'avulso', 'pos')),
           f'CT-KAN-78-05: avulso do link faz Não vou e Vou e nome, avulso e posição são gravados iguais ({[z1.get(k) for k in ("nome", "avulso", "pos")]})')
        # Desfaz: presença original do jogador, tira o avulso de teste, contador e "quem sou eu" de volta, lista fechada de novo
        pg.evaluate(PUT, {pres_k(gid_fut, rid_main, pj): p_antes})
        pg.evaluate(DEL, [pres_k(gid_fut, rid_main, za or '-'), f'grupos/{gid_fut}/avulsos/{za or "-"}'])
        pg.evaluate(PUT, {lim_k(gid_fut, rid_main): lim78}) if lim78 else pg.evaluate(DEL, [lim_k(gid_fut, rid_main)])
        pg.evaluate("v=>{if(v)localStorage.setItem('pelada-eu',v);else localStorage.removeItem('pelada-eu')}", eu0)
        pg.evaluate(TRAVA, [gid_fut, rid_main, True]); pg.reload(); pg.wait_for_timeout(800)

        # ---------- KAN-116: área administrativa do portal (e KAN-115: plano por conta)
        pg.evaluate(PUT, {'contas/u-orgtestecom': {k: v for k, v in (pg.evaluate(LER, 'contas/u-orgtestecom') or {}).items() if k != 'plano'}}); pg.reload(); pg.wait_for_timeout(1200)
        conta_org = pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return s['contas/u-orgtestecom']||null})()")
        ok(bool(conta_org) and conta_org.get('email') == 'org@teste.com' and isinstance(conta_org.get('acesso'), (int, float)) and conta_org.get('criada'),
           f'CT-KAN-116-03: ao entrar, a conta registra o último acesso, o e-mail e a data de registro ({conta_org and sorted(conta_org.keys())})')
        # O app dos clientes não tem portal: nenhum botão, nem para o e-mail do Kleber, e #/portal cai em Meus grupos
        abrir_entrada(pg, 'entrar')
        pg.fill('#le', 'kleberkoch@gmail.com'); pg.fill('#lp', 'Jogo@2026'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
        pg.goto(URL + '#/'); pg.wait_for_timeout(1000)
        if pg.locator('#dlg[open]').count(): pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
        pg.goto(URL + '#/portal'); pg.wait_for_timeout(900)
        ok(pg.locator('a[href*="portal"]').count() == 0 and 'Portal do Nosso Jogo' not in pg.inner_text('main') and pg.locator('li.cli').count() == 0,
           'CT-KAN-116-02: o app dos clientes não tem portal (nenhum botão, nem para o e-mail da administração; #/portal não abre nada)')
        sair(pg)
        try: pg.wait_for_selector('.ld-nav', timeout=8000)
        except Exception: pass

        # ---------- Portal do Nosso Jogo: site separado (KAN-116), aqui em modo demonstração com os dados de teste
        if not TEM_PORTAL:
            pular('bloco do portal (18 casos): portal.html não existe nesta cópia do app')
        else:
            PORTAL = URL.rsplit('/', 1)[0] + '/portal.html'
            pp = ctx.new_page(); pp.on('pageerror', lambda e: errs.append('portal: ' + str(e)))
            pp.goto(PORTAL); pp.wait_for_timeout(1000)
            ok(pp.locator('[data-p=google]').count() == 1 and pp.locator('#le, #lp, [data-a=signup], [data-a=login]').count() == 0 and 'Criar conta' not in pp.inner_text('body'),
               'CT-KAN-116-07: o portal só tem "Entrar com o Google", sem criação de conta nem e-mail e senha')
            ok('não é o app dos clientes' in pp.inner_text('header'), 'CT-KAN-116-07: o portal se identifica como área da administração')
            pp.click('[data-p=google]')
            try: pp.wait_for_selector('li.cli', timeout=8000)
            except Exception: pass
            txt = pp.inner_text('main')
            org = pp.locator('li.cli', has_text='org@teste.com')
            ok(org.count() == 1 and 'Grátis' in org.inner_text() and 'Último acesso' in org.inner_text() and 'ativo' in org.inner_text() and 'última rodada gravada' in org.inner_text(),
               'CT-KAN-116-01: a lista mostra o cliente com plano, grupos, último acesso e última rodada')
            ok('Clientes' in txt and 'Plano A' in txt and 'Plano B' in txt, 'CT-KAN-115-01: os planos do catálogo (Grátis, A e B) aparecem no resumo do portal')
            ok(not re.search(r'R\$|Pix|Nota|WhatsApp|\(11\)', txt), 'CT-KAN-116-05: o portal não mostra notas, valores de caixa, Pix nem contatos')
            pp.screenshot(path=f'{OUT}/22-portal.png'); contraste(pp, 'portal (CT-KAN-116-06)')
            # CT-KAN-116-09: o grupo tem mensalidade 120, diária 25 e chave Pix gravadas (CT-KAN-79-03), e nada disso aparece no portal
            ok(bool((pg.evaluate(LER, PCK) or {}).get('pix')) and PIX79 not in pp.content() and not re.search(r'R\$|Pix|[Mm]ensalidade|[Dd]iária|120|25,00', txt),
               'CT-KAN-116-09: com mensalidade e Pix gravados no grupo, o portal não mostra nenhum valor nem a chave Pix')
            # CT-KAN-115-03: conta sem plano gravado aparece como Grátis
            ok('plano' not in (pg.evaluate(LER, 'contas/u-orgtestecom') or {}) and org.locator('.tag').first.inner_text().strip() == 'Grátis',
               'CT-KAN-115-03: org@teste.com, sem plano gravado, aparece no portal como "Grátis"')
            # CT-KAN-133-03: o portal lista todos os clientes (contas e donos de grupos do banco)
            n_cli = pp.evaluate("""(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}'),u=new Set();
              Object.keys(s).forEach(k=>{const p=k.split('/');if(p.length===2&&p[0]==='contas')u.add(p[1]);if(p.length===2&&p[0]==='grupos'&&s[k]&&s[k].owner)u.add(s[k].owner)});return u.size})()""")
            kpi = pp.locator('.kpis .money').first.inner_text().strip()
            ok(n_cli >= 2 and pp.locator('li.cli').count() == n_cli and kpi == str(n_cli), f'CT-KAN-133-03: o portal lista todos os clientes ({pp.locator("li.cli").count()} de {n_cli}, resumo {kpi})')
            # CT-KAN-116-10: Atualizar mostra loading e a lista volta completa
            n_antes = pp.locator('li.cli').count()
            ld = pp.evaluate("""(()=>{const b=document.querySelector('[data-p=atualizar]');b.click();
              return {busy:b.classList.contains('busy')&&b.disabled&&b.getAttribute('aria-busy')==='true',lista:document.querySelectorAll('#pmain li.cli').length}})()""")
            try: pp.wait_for_selector('li.cli', timeout=8000)
            except Exception: pass
            pp.wait_for_timeout(300)
            ok(ld['busy'] and ld['lista'] == n_antes and pp.locator('li.cli').count() == n_antes and pp.locator('[data-p=atualizar]:not(.busy):not([disabled])').count() == 1,
               f'CT-KAN-116-10: tocar Atualizar mostra loading no botão, a lista continua na tela e volta completa ({ld}, {pp.locator("li.cli").count()} de {n_antes})')
            # CT-KAN-116-07: o organizador entrou hoje (o acesso antigo de 10 dias foi trocado ao entrar) e, depois de Atualizar, aparece com a data de hoje
            hoje_br = pp.evaluate("new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})")
            oi = pp.locator('li.cli', has_text='org@teste.com').inner_text()
            ok(f'Último acesso: {hoje_br}' in oi, f'CT-KAN-116-07: organizador que entrou hoje aparece com "Último acesso: {hoje_br}" depois de Atualizar')
            # CT-KAN-116-11: celular de 390px, sem rolagem lateral e controles com 36px ou mais
            # Mede os controles da lista (busca, filtro e Atualizar) e o chip "Sair" do cabeçalho (36px desde a v28, achado da Qualidade).
            lay = pp.evaluate("""(()=>{const h=[...document.querySelectorAll('#pmain button,#pmain input,#pmain select')].filter(e=>e.getBoundingClientRect().width>0).map(e=>Math.round(e.getBoundingClientRect().height));
              const c=document.querySelector('#ptopo .chip');return {w:innerWidth,larg:document.documentElement.scrollWidth<=innerWidth,min:Math.min(...h),n:h.length,chip:c?Math.round(c.getBoundingClientRect().height):null}})()""")
            ok(lay['w'] == 390 and lay['larg'] and lay['n'] >= 3 and lay['min'] >= 36 and (lay['chip'] or 0) >= 36,
               f'CT-KAN-116-11: portal em 390px sem rolagem lateral; busca, filtro, Atualizar e Sair com 36px ou mais (menor: {lay["min"]}px; chip Sair do cabeçalho: {lay["chip"]}px)')
            # CT-KAN-116-08: conta sem acesso há 45 dias: o filtro "sem acesso há mais de 30 dias" mostra só ela
            agora_ms = int(time.time() * 1000)
            pp.evaluate(PUT, {'contas/u-velhotestecom': {'email': 'velho@teste.com', 'acesso': agora_ms - 45 * 86400000, 'criada': agora_ms - 100 * 86400000}})
            pp.reload()
            try: pp.wait_for_selector('li.cli', timeout=8000)
            except Exception: pass
            pp.select_option('#ptf', 'semAcesso30'); pp.wait_for_timeout(300)
            s30 = pp.locator('li.cli').all_inner_texts()
            ok(len(s30) == 1 and 'velho@teste.com' in s30[0], f'CT-KAN-116-08: o filtro "sem acesso há mais de 30 dias" mostra só a conta sem acesso há 45 dias ({[x.split(chr(10))[0] for x in s30]})')
            pp.evaluate(DEL, ['contas/u-velhotestecom'])
            # CT-KAN-116-12: tema escuro com contraste AA
            pp.evaluate("localStorage.setItem('nj-tema','dark')"); pp.reload()
            try: pp.wait_for_selector('li.cli', timeout=8000)
            except Exception: pass
            pp.wait_for_timeout(300)
            ok(pp.evaluate("document.documentElement.dataset.theme") == 'dark' and pp.locator('li.cli').count() >= 2, 'CT-KAN-116-12: portal abre no tema escuro')
            contraste(pp, 'portal no tema escuro (CT-KAN-116-12)'); pp.screenshot(path=f'{OUT}/23-portal-escuro.png')
            pp.evaluate("localStorage.removeItem('nj-tema')"); pp.reload()
            try: pp.wait_for_selector('li.cli', timeout=8000)
            except Exception: pass
            pp.fill('#ptq', 'org@'); pp.wait_for_timeout(200)
            vis = pp.evaluate("[...document.querySelectorAll('#ptlist li.cli')].filter(l=>!l.hidden).map(l=>l.innerText.split('\\n')[0])")
            ok(len(vis) == 1 and 'org@teste.com' in vis[0], f'CT-KAN-116-04: a busca por e-mail mostra só o cliente procurado ({vis})')
            pp.fill('#ptq', ''); pp.wait_for_timeout(100)
            pp.evaluate("(()=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K));const c=s['contas/u-orgtestecom']||{};c.plano='A';c.planoAte=Date.now()+864e5;s['contas/u-orgtestecom']=c;localStorage.setItem(K,JSON.stringify(s))})()")
            pp.reload()
            try: pp.wait_for_selector('li.cli', timeout=8000)
            except Exception: pass
            pp.select_option('#ptf', 'vence7'); pp.wait_for_timeout(300)
            v7 = pp.locator('li.cli').all_inner_texts()
            ok(len(v7) == 1 and 'org@teste.com' in v7[0] and 'Plano A' in v7[0] and 'até' in v7[0], f'CT-KAN-116-04: o filtro "vence em até 7 dias" mostra a conta com plano A até amanhã ({len(v7)})')
            pp.select_option('#ptf', 'plano:gratis'); pp.wait_for_timeout(300)
            ok(all('org@teste.com' not in x for x in pp.locator('li.cli').all_inner_texts()), 'CT-KAN-116-04: o filtro por plano separa Grátis de Plano A')
            pp.evaluate("(()=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K));s['contas/u-orgtestecom'].planoAte=Date.now()-1000;localStorage.setItem(K,JSON.stringify(s))})()")
            pp.reload()
            try: pp.wait_for_selector('li.cli', timeout=8000)
            except Exception: pass
            oi = pp.locator('li.cli', has_text='org@teste.com').inner_text()
            ok('Grátis' in oi and 'vencido' in oi, 'CT-KAN-115-05: plano com validade vencida aparece como Grátis, com o aviso de vencido')
            pp.evaluate("(()=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem(K));const c=s['contas/u-orgtestecom'];delete c.plano;delete c.planoAte;localStorage.setItem(K,JSON.stringify(s))})()")
            pp.click('#ptopo [data-p=sair]'); pp.wait_for_timeout(1200)
            ok(pp.locator('[data-p=google]').count() == 1, 'CT-KAN-116-07: Sair no portal volta para "Entrar com o Google"')
            pp.close()
        # Desfaz o caixa do CT-KAN-79-03 (valores e chave Pix de teste)
        pg.evaluate(PUT, {PCK: pc0}) if pc0 else pg.evaluate(DEL, [PCK])

    if parte('b'):
        # ---------- KAN-111: jogo fixo que passa da meia-noite (relógio simulado, fuso de São Paulo, navegador separado)
        ctx2 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p2 = ctx2.new_page()
        p2.on('pageerror', lambda e: errs.append(str(e)))
        p2.on('dialog', lambda d: d.dismiss())
        p2.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        relogio = lambda t: p2.clock.set_fixed_time(t)
        # Título, local e número de confirmados da rodada mostrada (ou o título do aviso, quando não há rodada)
        HERO = "(()=>{const q=s=>{const e=document.querySelector(s);return e?e.textContent.trim():''};return [q('.hero-r h2')||q('main h2'),q('.hero-r .muted'),(q('.hero-r .count').match(/^\\d+/)||[''])[0]]})()"
        def ver111(g):
            p2.reload(); p2.wait_for_timeout(600)  # relê o banco de demonstração antes de qualquer gravação do app
            p2.goto(URL + '#/g/' + g); p2.wait_for_selector('main h2', timeout=8000); p2.wait_for_timeout(400)
            adm = p2.evaluate(HERO)
            p2.goto(URL + '#/p/' + g); p2.wait_for_selector('.hero-r h2', timeout=8000); p2.wait_for_timeout(400)
            return adm, p2.evaluate(HERO)
        relogio('2026-10-16T22:00:00-03:00')  # sexta, 22h
        abrir_entrada(p2, 'criar')
        p2.fill('#le', 'relogio@teste.com'); p2.fill('#lp', 'Jogo@2026'); p2.fill('#lp2', 'Jogo@2026'); p2.keyboard.press('Enter'); p2.wait_for_timeout(1200)
        p2.fill('#ngn', 'Sexta Noite')
        p2.select_option('#sched .sd', '5'); p2.fill('#sched .srow .hrot:nth-of-type(1) [data-hora] .hh', '23'); p2.fill('#sched .srow .hrot:nth-of-type(1) [data-hora] .hm', '00'); p2.fill('#sched .srow .hrot:nth-of-type(2) [data-hora] .hh', '01'); p2.fill('#sched .srow .hrot:nth-of-type(2) [data-hora] .hm', '00')
        p2.click('[data-a=createGroup]'); p2.wait_for_timeout(1500)
        gid_nt = p2.url.split('#/g/')[1]
        elenco_e_presenca(p2, 5)
        ok(p2.evaluate("S.rid") == 'f-2026-10-16-2300' and p2.locator('.mk button.on-in').count() == 5, 'CT-KAN-111: preparação: jogo toda sexta das 23h à 01h com 5 confirmados')
        adm, pub = ver111(gid_nt)
        ok('16/10' in adm[0] and '16/10' in pub[0], f'CT-KAN-111-03: sexta 22h, antes do início: aba Rodada e link mostram a sexta de hoje ({adm[0]} | {pub[0]})')
        relogio('2026-10-17T00:30:00-03:00')  # sábado, 00h30
        adm, pub = ver111(gid_nt)
        ok('16/10' in adm[0] and '16/10' in pub[0] and adm[2] == '5' and pub[2] == '5',
           f'CT-KAN-111-01: sábado 00h30, jogo em andamento: aba Rodada e link mostram a sexta com os 5 confirmados ({adm[0]} {adm[2]} | {pub[0]} {pub[2]})')
        lista = p2.locator('.panel', has_text='Confirmados').last.locator('ol.plist li').count()
        ok(lista == 5 and p2.locator('.lvl-tag').count() == 0 and not re.search(r'wa\.me|Telefone|R\$|Pix', p2.inner_text('main')),
           f'CT-KAN-111-06: link permanente às 00h30 mostra os {lista} confirmados da sexta, sem notas e sem contatos')
        relogio('2026-10-17T01:01:00-03:00')  # sábado, 01h01
        adm, pub = ver111(gid_nt)
        ok('23/10' in adm[0] and '23/10' in pub[0], f'CT-KAN-111-02: sábado 01h01, depois do término: os dois passam para a sexta seguinte ({adm[0]} | {pub[0]})')
        # CT-05: virada de ano (jogo em 31/12, quinta, das 23h à 01h; relógio em 01/01, 00h30)
        APPK = f'grupos/{gid_nt}'
        cfg_app = p2.evaluate(LER, APPK)
        def fixos111(fx):
            c = json.loads(json.dumps(cfg_app)); c['cfg']['fixos'] = fx; p2.evaluate(PUT, {APPK: c})
        fixos111([{'id': 'q1', 'dow': 4, 'ini': '23:00', 'fim': '01:00', 'place': ''}])
        relogio('2027-01-01T00:30:00-03:00')
        adm, pub = ver111(gid_nt)
        ok('31/12' in adm[0] and '31/12' in pub[0], f'CT-KAN-111-05: 01/01 às 00h30, jogo de 31/12 das 23h à 01h ainda aparece ({adm[0]} | {pub[0]})')
        # CT-04: sem regressão (jogo que não passa da meia-noite, dois dias fixos, data cancelada e rodada já gravada)
        seg = {'id': 's1', 'dow': 1, 'ini': '20:00', 'fim': '22:00', 'place': ''}
        fixos111([seg])
        relogio('2026-10-19T21:00:00-03:00'); a1 = ver111(gid_nt)
        relogio('2026-10-19T22:01:00-03:00'); a2 = ver111(gid_nt)
        ok(all('19/10' in x[0] for x in a1) and all('26/10' in x[0] for x in a2), f'CT-KAN-111-04: segunda das 20h às 22h: às 21h mostra 19/10 e às 22h01 mostra 26/10 ({a1[0][0]} → {a2[0][0]})')
        fixos111([seg, {'id': 'q2', 'dow': 3, 'ini': '20:00', 'fim': '22:00', 'place': ''}])
        a3 = ver111(gid_nt)
        rq = f'grupos/{gid_nt}/rodadas/f-2026-10-21-2000'
        p2.evaluate(PUT, {rq: {'date': '2026-10-21', 'time': '20:00', 'fim': '22:00', 'fixo': True, 'cancelada': True, 'locked': False, 'times': None, 'createdAt': 1}})
        a4 = ver111(gid_nt)
        # Data cancelada: a aba Rodada e o link pulam para a seguinte. A aba Rodada abria às vezes na data cancelada
        # (a escolha era fixada antes de as rodadas gravadas chegarem); corrigido na v25.
        ok(all('21/10' in x[0] for x in a3) and '26/10' in a4[1][0], f'CT-KAN-111-04: com dois dias fixos vale o mais próximo (21/10), e com a data cancelada o link pula para a seguinte ({a3[0][0]} → link {a4[1][0]})')
        ok('26/10' in a4[0][0] and 'cancelada' not in a4[0][0], f'CT-KAN-111-04: com a data cancelada, a aba Rodada também abre na seguinte ({a4[0][0]})')
        p2.evaluate(PUT, {rq: {'date': '2026-10-21', 'time': '20:00', 'fim': '22:00', 'place': 'Quadra gravada', 'fixo': True, 'locked': False, 'times': None, 'createdAt': 1}})
        a5 = ver111(gid_nt)
        ok(all('21/10' in x[0] and 'Quadra gravada' in x[1] for x in a5), f'CT-KAN-111-04: rodada já gravada é a que aparece ({a5[0][0]} · {a5[0][1][:30]})')
        ctx2.close()
        # ---------- v47 (KAN-162): computador em Chicago, com o navegador em inglês: o cadastro sugere Estados Unidos
        ctx4 = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block', timezone_id='America/Chicago', locale='en-US'); p4 = ctx4.new_page()
        p4.on('pageerror', lambda e: errs.append(str(e)))
        p4.goto(URL + '#/criar'); p4.wait_for_function("document.querySelector('#lpais') && document.querySelector('#lpais').options.length > 10", timeout=8000)
        ok(p4.input_value('#lpais') == 'US', 'CT-KAN-162-01: no computador em Chicago, o cadastro sugere Estados Unidos')
        ctx4.close()
        ctx5 = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block', timezone_id='America/Manaus', locale='en-US'); p5 = ctx5.new_page()
        p5.goto(URL + '#/criar'); p5.wait_for_function("document.querySelector('#lpais') && document.querySelector('#lpais').options.length > 10", timeout=8000)
        ok(p5.input_value('#lpais') == 'BR', 'CT-KAN-162-01: computador em inglês, mas no fuso de Manaus: o cadastro sugere Brasil (vale o fuso)')
        ctx5.close()

        # ---------- v53 (KAN-175): fim por placar, "Sem tempo" e sugestão do próximo jogo (navegador separado)
        ctx8 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p8 = ctx8.new_page()
        p8.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p8, 'criar')
        p8.fill('#le', 'partida.fila@teste.com'); p8.fill('#lp', 'Jogo@2026'); p8.fill('#lp2', 'Jogo@2026'); p8.keyboard.press('Enter'); p8.wait_for_timeout(1300)
        p8.fill('#ngn', 'Fila FC'); p8.click('[data-a=pickSport][data-v=futebol]'); p8.click('[data-a=createGroup]'); p8.wait_for_timeout(1500)
        elenco_e_presenca(p8, 12)
        p8.click('[data-a=drawDlg]'); p8.wait_for_timeout(300)
        if p8.locator('#dlg .conf').count(): confirmar_app(p8, True)
        p8.click('[data-a=dN][data-v="4"]'); p8.wait_for_timeout(200); p8.click('#drawGo'); p8.wait_for_timeout(2500)
        ok(p8.evaluate("(curRod=>curRod&&curRod.times&&curRod.times.length)(Object.values(S.rod).find(r=>r.times))") == 4, 'CT-KAN-175: preparação com 4 times sorteados')
        p8.click('[data-a=tab][data-v=partida]'); p8.wait_for_selector('#partidaRaiz .board', timeout=8000); p8.wait_for_timeout(300)
        viva = lambda: p8.evaluate("[S.live.a,S.live.b]")
        esp = lambda: p8.evaluate("(()=>{const r=Object.values(S.rod).find(r=>r.times);const e=document.getElementById('naEspera');return e?e.innerText.replace('Na espera:','').split('·').map(s=>s.trim()):[]})()")
        nomes = p8.evaluate("(()=>{const r=Object.values(S.rod).find(r=>r.times);return [...document.querySelectorAll('[data-c=ta] option')].map(o=>o.textContent)})()")
        ok(viva() == [0, 1] and esp() == [nomes[2], nomes[3]], f'CT-KAN-175-03: primeiro jogo com os 2 primeiros do sorteio e os outros na espera ({viva()}, {esp()})')
        def gol(lado, n=1):
            for _ in range(n):
                p8.click(f'[data-a=goal][data-v={lado}]'); p8.wait_for_timeout(250)
                p8.click('#dlg [data-a=addGoal]:not([data-p])'); p8.wait_for_timeout(250)
        def salvar():
            p8.click('[data-a=saveMatch]'); p8.wait_for_timeout(900)
        gol('a'); salvar()
        ok(viva() == [0, 2] and esp() == [nomes[3], nomes[1]], f'CT-KAN-175-03: time 1 ganha: fica, entra o 3 e a espera é 4 · 2 ({viva()}, {esp()})')
        gol('b'); salvar()
        ok(viva() == [2, 3] and esp() == [nomes[1], nomes[0]], f'CT-KAN-175-03: time 3 ganha: 3 × 4 e a espera é 2 · 1 ({viva()}, {esp()})')
        p8.screenshot(path=f'{OUT}/53-partida-fila.png', full_page=True); contraste(p8, 'Partida com a fila')
        p8.select_option('[data-c=lim]', '2'); p8.wait_for_timeout(200)
        p8.click('[data-a=clock]'); p8.wait_for_timeout(300)
        gol('a', 2)
        ok(p8.locator('#limMsg').is_visible() and 'Fim por placar' in p8.inner_text('#limMsg') and not p8.evaluate("S.live.run"),
           'CT-KAN-175-01: com limite de 2, o 2º gol mostra "Fim por placar" e pausa o cronômetro')
        p8.screenshot(path=f'{OUT}/53-partida-limite.png')
        p8.click('[data-a=undoGoal]'); p8.wait_for_timeout(300)
        ok(p8.locator('#limMsg').count() == 0, 'CT-KAN-175-01: desfazer o gol tira o aviso de fim por placar')
        p8.select_option('[data-c=dur]', '0'); p8.wait_for_timeout(200)
        p8.click('[data-a=clockReset]'); p8.wait_for_timeout(200); p8.click('[data-a=clock]'); p8.wait_for_timeout(2300)
        rel = p8.inner_text('#clock')
        ok(rel in ('00:02', '00:03') and not p8.evaluate("document.getElementById('clock').classList.contains('over')") and p8.locator('#clockMsg').is_hidden(),
           f'CT-KAN-175-02: "Sem tempo" conta para cima, sem alarme ({rel})')
        p8.click('[data-a=clock]')
        p8.set_viewport_size({'width': 360, 'height': 780}); p8.wait_for_timeout(200)
        larg = p8.evaluate("document.documentElement.scrollWidth")
        ok(larg <= 360, f'Partida com Fim por placar cabe em 360px sem rolagem lateral ({larg}px)')
        p8.screenshot(path=f'{OUT}/53-partida-360.png', full_page=True)
        p8.set_viewport_size({'width': 390, 'height': 844})
        p8.select_option('[data-c=tb]', '0' if viva()[0] != 0 else '1'); p8.wait_for_timeout(200)
        trocado = viva()
        gol('b'); salvar()
        ok(viva()[0] == trocado[1], f'CT-KAN-175-05: com o time trocado à mão, a sugestão parte do jogo que aconteceu ({trocado} → {viva()})')
        antes = viva()
        p8.reload(); p8.wait_for_timeout(1500); p8.click('[data-a=tab][data-v=partida]'); p8.wait_for_selector('#partidaRaiz .board', timeout=8000); p8.wait_for_timeout(800)
        ok(viva() == antes, f'CT-KAN-175-06: depois de recarregar, a sugestão continua a mesma ({antes} → {viva()})')

        # ---------- v54 (KAN-176): editar uma partida salva (mesmo navegador do KAN-175)
        g8 = p8.url.split('#/g/')[1].split('/')[0]
        m1 = p8.evaluate("(()=>{const ms=Object.entries(S.parts).map(([id,m])=>Object.assign({id},m)).sort((a,b)=>a.at-b.at);return ms[0]})()")
        mes8 = m1['date'][:7]
        res8 = lambda: (p8.evaluate(LER, f'grupos/{g8}/resumos/{mes8}') or {}).get('jog', {})
        p8.locator('#partidaRaiz [data-a=editarPartida]').first.click(); p8.wait_for_timeout(400)
        ok(p8.locator('#dlg .ed-autor').count() == 1, f'CT-KAN-176: a janela Editar mostra os gols da partida ({p8.locator("#dlg .ed-autor").count()})')
        p8.screenshot(path=f'{OUT}/54-editar-partida.png'); contraste(p8, 'Editar partida')
        autor = m1['pa'][0]
        p8.select_option('#dlg .ed-autor', 'p:' + autor); p8.wait_for_timeout(150)
        p8.click('#dlg [data-a=salvarEdicao]'); p8.wait_for_timeout(1000)
        ok((res8().get(autor) or {}).get('g') == 1, f'CT-KAN-176-01: trocar "sem autor" por um jogador dá o gol a ele na artilharia ({res8().get(autor)})')
        r0 = dict(res8().get(autor) or {})
        p8.locator('#partidaRaiz [data-a=editarPartida]').first.click(); p8.wait_for_timeout(400)
        p8.click('#dlg .plist [aria-label="Tirar este gol"]'); p8.wait_for_timeout(150)
        p8.click('#dlg [data-a=salvarEdicao]'); p8.wait_for_timeout(1000)
        r1 = res8().get(autor) or {}
        ok(not r1.get('g') and r1.get('v', 0) == r0.get('v', 0) - 1 and r1.get('e', 0) == r0.get('e', 0) + 1 and r1.get('j') == r0.get('j') and '0 × 0' in p8.inner_text('#partidaRaiz .plist'),
           f'CT-KAN-176-02: tirar o único gol de um 1×0 troca a vitória por empate no ranking e na lista ({r0} → {r1})')
        p8.locator('#partidaRaiz [data-a=editarPartida]').first.click(); p8.wait_for_timeout(400)
        p8.click('#dlg .ed-mais[data-lado=b]'); p8.wait_for_timeout(150)
        ok('Salvar 0 × 1' in p8.inner_text('#dlg [data-a=salvarEdicao]'), 'CT-KAN-176-03: incluir um gol atualiza o placar na janela')
        p8.click('#dlg [data-a=salvarEdicao]'); p8.wait_for_timeout(1000)
        p8.reload(); p8.wait_for_timeout(1500); p8.click('[data-a=tab][data-v=partida]'); p8.wait_for_selector('#partidaRaiz .board', timeout=8000); p8.wait_for_timeout(800)
        ok('0 × 1' in p8.inner_text('#partidaRaiz .plist li'), 'CT-KAN-176-04: depois de recarregar, a partida corrigida continua 0 × 1')

        # ---------- v55 (KAN-177): escalação com empréstimo e troca (mesmo navegador)
        p8.click('[data-a=abrirEscalacao][data-v=a]'); p8.wait_for_timeout(400)
        ok(p8.locator('#dlg #escLista li').count() >= 1 and p8.locator('#dlg #escQuem option').count() >= 1, 'CT-KAN-177: a Escalação mostra quem joga e quem pode entrar')
        p8.screenshot(path=f'{OUT}/55-escalacao.png'); contraste(p8, 'Escalação')
        emprestado = p8.eval_on_selector('#dlg #escQuem', 'e=>e.value')
        p8.click('#dlg #escConfirmar'); p8.wait_for_timeout(300)
        p8.click('#dlg [data-a=close]'); p8.wait_for_timeout(300)
        ok(p8.evaluate("(id)=>S.live.esc.a.entrou.includes(id)", emprestado) and 'Entrou:' in p8.inner_text('#partidaRaiz .board'), 'CT-KAN-177-01: puxar de outro time coloca o jogador no lado A e o placar mostra "Entrou"')
        p8.click('[data-a=goal][data-v=a]'); p8.wait_for_timeout(300)
        ok(p8.locator(f'#dlg [data-a=addGoal][data-p="{emprestado}"]').count() == 1, 'CT-KAN-177-01: o emprestado aparece na janela do gol')
        p8.click(f'#dlg [data-a=addGoal][data-p="{emprestado}"]'); p8.wait_for_timeout(300)
        sem_assist(p8)
        p8.click('[data-a=abrirEscalacao][data-v=a]'); p8.wait_for_timeout(400)
        sai = p8.eval_on_selector('#dlg #escLugar', 'e=>e.options[1].value')
        entra = p8.eval_on_selector('#dlg #escQuem', 'e=>e.options[e.options.length-1].value')
        p8.select_option('#dlg #escQuem', entra); p8.select_option('#dlg #escLugar', sai); p8.click('#dlg #escConfirmar'); p8.wait_for_timeout(300)
        ok('saiu' in p8.inner_text('#dlg #escLista'), 'CT-KAN-177-02: na troca, quem saiu aparece marcado como "saiu"')
        p8.click('#dlg [data-a=close]'); p8.wait_for_timeout(300)
        antes8 = {k: dict(v) for k, v in res8().items()}
        salvar()
        depois8 = res8()
        dv = lambda pid, k: (depois8.get(pid) or {}).get(k, 0) - (antes8.get(pid) or {}).get(k, 0)
        ok(dv(emprestado, 'g') == 1 and dv(emprestado, 'v') == 1, f'CT-KAN-177-01: o gol e a vitória vão para o emprestado no ranking (gols {dv(emprestado, "g")}, vitórias {dv(emprestado, "v")})')
        ok(dv(sai, 'j') == 1 and dv(entra, 'j') == 1 and dv(sai, 'v') == 1 and dv(entra, 'v') == 1, f'CT-KAN-177-02: quem saiu e quem entrou contam o jogo e a vitória ({dv(sai, "j")}/{dv(sai, "v")}, {dv(entra, "j")}/{dv(entra, "v")})')
        ok(p8.evaluate("!S.live.esc") and 'Entrou:' not in p8.inner_text('#partidaRaiz .board'), 'CT-KAN-177-03: a partida seguinte volta à escalação do sorteio')

        # ---------- v56 (KAN-178): artilharia da rodada, só gols (mesmo navegador)
        n_salvas = p8.locator('#partidaRaiz [data-a=editarPartida]').count()
        p8.click('#artPainel [data-a=abrirArtilharia]'); p8.wait_for_timeout(400)
        ok(p8.locator('#dlg #artLista li').count() >= 8 and 'já tem partidas com placar' in p8.inner_text('#dlg'), 'CT-KAN-178: a janela lista os jogadores dos times e avisa que a rodada já tem partidas com placar')
        p8.screenshot(path=f'{OUT}/56-artilharia.png'); contraste(p8, 'Artilharia da rodada')
        art = p8.eval_on_selector('#dlg #artLista li button[data-p]', 'b=>b.dataset.p')
        nome_art = p8.inner_text('#dlg #artLista li .pn')
        a0 = dict(res8().get(art) or {})
        for _ in range(3):
            p8.click(f'#dlg #artLista button[data-p="{art}"]'); p8.wait_for_timeout(100)
        p8.click('#dlg [data-a=salvarArtilharia]'); p8.wait_for_timeout(1000)
        a1 = res8().get(art) or {}
        ok(a1.get('g', 0) - a0.get('g', 0) == 3 and a1.get('v', 0) == a0.get('v', 0) and a1.get('j', 0) == a0.get('j', 0),
           f'CT-KAN-178-01: lançar 3 gols sobe a artilharia em 3, sem mexer em jogos e vitórias ({a0} → {a1})')
        ok(nome_art.strip() + ' 3' in p8.inner_text('#artPainel') and p8.locator('#partidaRaiz [data-a=editarPartida]').count() == n_salvas,
           'CT-KAN-178: o painel mostra o lançamento e ele não vira partida na lista')
        p8.click('#artPainel [data-a=abrirArtilharia]'); p8.wait_for_timeout(400)
        p8.click(f'#dlg #artLista [aria-label="Tirar 1 de {nome_art.strip()}"]'); p8.wait_for_timeout(100)
        p8.click('#dlg [data-a=salvarArtilharia]'); p8.wait_for_timeout(1000)
        a2 = res8().get(art) or {}
        ok(a2.get('g', 0) - a0.get('g', 0) == 2, f'CT-KAN-178-02: corrigir de 3 para 2 desce a artilharia em 1 ({a1.get("g")} → {a2.get("g")})')
        p8.reload(); p8.wait_for_timeout(1500); p8.click('[data-a=tab][data-v=partida]'); p8.wait_for_selector('#artPainel', timeout=8000); p8.wait_for_timeout(800)
        ok(nome_art.strip() + ' 2' in p8.inner_text('#artPainel'), 'CT-KAN-178-03: depois de recarregar, a artilharia lançada continua')
        # KAN-202 (v71): tocar fora da janela da artilharia com algo lançado pergunta antes de descartar
        def fora8():
            bb = p8.locator('#dlg').bounding_box() if p8.locator('#dlg').count() else None
            p8.mouse.click(5, 5) if not bb or bb['y'] > 10 else p8.mouse.click(5, 840); p8.wait_for_timeout(400)
        p8.click('#artPainel [data-a=abrirArtilharia]'); p8.wait_for_timeout(400)
        fora8()
        ok(not p8.evaluate("document.getElementById('dlg').open"), 'CT-KAN-202-03: sem nada mudado, tocar fora fecha a janela da artilharia direto')
        p8.click('#artPainel [data-a=abrirArtilharia]'); p8.wait_for_timeout(400)
        p8.click(f'#dlg #artLista button[data-p="{art}"]'); p8.wait_for_timeout(150)
        fora8()
        ok(p8.locator('#dlg .conf').count() == 1 and 'Descartar' in p8.inner_text('#dlg .conf'), 'CT-KAN-202-01: com um + lançado, tocar fora pergunta "Descartar o que você preencheu?"')
        confirmar_app(p8, False)
        ok(p8.locator('#dlg #artLista').count() == 1 and p8.inner_text(f'#dlg .art-n[data-p="{art}"]').strip() == '3', 'CT-KAN-202-01: "Continuar editando" volta para a janela com o número lançado')
        fora8(); confirmar_app(p8, True); p8.wait_for_timeout(500)
        ok(not p8.evaluate("document.getElementById('dlg').open") and (res8().get(art) or {}).get('g', 0) - a0.get('g', 0) == 2, 'CT-KAN-202-02: "Descartar" fecha sem gravar (a artilharia continua 2)')
        p8.locator('#partidaRaiz [data-a=editarPartida]').first.click(); p8.wait_for_timeout(400)
        p8.click('#dlg .ed-mais[data-lado=a]'); p8.wait_for_timeout(150)
        fora8()
        ok(p8.locator('#dlg .conf').count() == 1, 'CT-KAN-202-04: Editar partida com gol incluído também pergunta antes de descartar')
        confirmar_app(p8, True); p8.wait_for_timeout(300)
        ctx8.close()

        # ---------- v57 (KAN-64 e KAN-161): cobrar quem não respondeu e valor fora do padrão (navegador separado)
        ctx9 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p9 = ctx9.new_page()
        p9.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p9, 'criar')
        p9.fill('#le', 'cobrar@teste.com'); p9.fill('#lp', 'Jogo@2026'); p9.fill('#lp2', 'Jogo@2026'); p9.keyboard.press('Enter'); p9.wait_for_timeout(1300)
        p9.fill('#ngn', 'Cobra FC'); p9.click('[data-a=pickSport][data-v=futebol]'); p9.click('[data-a=createGroup]'); p9.wait_for_timeout(1500)
        p9.click('[data-a=tab][data-v=jogadores]'); p9.wait_for_timeout(300); p9.click('[data-a=seed]'); p9.wait_for_timeout(1500)
        ids9 = p9.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false)")
        com_tel = ids9[0]; nome_tel = p9.evaluate("(id)=>S.jog[id].name", com_tel)
        p9.click(f'[data-a=editPlayer][data-p="{com_tel}"]'); p9.wait_for_timeout(300)
        p9.fill('#ptel', '11987654321'); p9.click('[data-a=savePlayer]'); p9.wait_for_timeout(800)
        p9.click('[data-a=tab][data-v=rodada]'); p9.wait_for_timeout(600)
        tit = p9.inner_text('#semResposta h3') if p9.locator('#semResposta').count() else ''
        ok(f'Ainda não responderam ({len(ids9)})' == tit, f'CT-KAN-64-01: o bloco mostra quantos do elenco ainda não responderam ({tit!r})')
        p9.click(f'[data-a=mark][data-v=in][data-p="{ids9[1]}"]'); p9.wait_for_timeout(350)
        p9.click(f'[data-a=mark][data-v=out][data-p="{ids9[2]}"]'); p9.wait_for_timeout(500)
        tit2 = p9.inner_text('#semResposta h3')
        ok(tit2 == f'Ainda não responderam ({len(ids9) - 2})', f'CT-KAN-64-02: quem responde Vou ou Não vou sai da lista ({tit2!r})')
        p9.locator('#semResposta').screenshot(path=f'{OUT}/57-cobrar.png'); contraste(p9, 'Ainda não responderam')
        p9.click('#semResposta [data-a=cobrarGrupo]'); p9.wait_for_timeout(400)
        txt9 = p9.input_value('#shtxt')
        falta9 = p9.evaluate("(()=>Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false&&!(S.pres[id]&&S.pres[id].s)).map(id=>S.jog[id].name))()")
        ok('Ainda não responderam:' in txt9 and all(n in txt9 for n in falta9) and '#/p/' in txt9, 'CT-KAN-64-03: "Cobrar no grupo" monta a mensagem com os nomes e o link de confirmar')
        p9.click('#dlg [data-a=close]'); p9.wait_for_timeout(300)
        p9.click('#semResposta summary'); p9.wait_for_timeout(200)
        lnk = p9.locator(f'#cobrarLista a[aria-label="Cobrar {nome_tel} no WhatsApp"]')
        href = lnk.get_attribute('href') if lnk.count() else ''
        ok(nome_tel in falta9 and href.startswith('https://api.whatsapp.com/send?phone=5511987654321&text=') and 'Confirme%20aqui' in href, f'CT-KAN-64-04: com telefone, "WhatsApp" abre a conversa da pessoa com a mensagem ({href[:60]})')
        bb9 = lnk.bounding_box() if lnk.count() else {'height': 0}
        ok(bb9['height'] >= 36 and p9.locator('#cobrarLista li', has_text='sem telefone').count() >= 1, f'CT-KAN-64-05: botão de 36px; sem telefone aparece "sem telefone" ({bb9["height"]:.0f}px)')
        p9.click('[data-a=lock]'); p9.wait_for_timeout(300); confirmar_app(p9, True); p9.wait_for_timeout(500)
        ok(p9.locator('#semResposta').count() == 0, 'CT-KAN-64-06: com a lista fechada, o bloco de cobrança some')
        # KAN-161: valor fora do padrão (mensalidade padrão 80)
        p9.click('[data-a=tab][data-v=caixa]'); p9.wait_for_timeout(500)
        n_lan = lambda: p9.evaluate("Object.keys(S.caixa||{}).length")
        p9.click('[data-a=addLan]'); p9.wait_for_timeout(300); p9.select_option('#lk', 'despesa'); p9.fill('#lv', '99999999999'); p9.click('#dlg [data-a=saveLan]'); p9.wait_for_timeout(400)
        cf = p9.inner_text('#dlg .conf') if p9.locator('#dlg .conf').count() else ''
        ok('Lançar R$' in cf and 'normal deste grupo' in cf and n_lan() == 0, f'CT-KAN-161-01: valor fora do padrão pergunta antes de gravar ({cf[:60]!r})')
        p9.screenshot(path=f'{OUT}/57-fora-do-padrao.png'); contraste(p9, 'Valor fora do padrão')
        p9.click('#dlg [data-a=confNao]'); p9.wait_for_timeout(300)
        ok(p9.evaluate("document.activeElement && document.activeElement.id") == 'lv' and n_lan() == 0, 'CT-KAN-161-02: "Corrigir valor" volta ao campo Valor, sem gravar')
        p9.fill('#lv', '800'); p9.click('#dlg [data-a=saveLan]'); p9.wait_for_timeout(700)
        ok(n_lan() == 1 and p9.locator('#dlg .conf').count() == 0, 'CT-KAN-161-04: 800 (10 vezes a mensalidade) grava sem pergunta')
        p9.click('[data-a=addLan]'); p9.wait_for_timeout(300); p9.select_option('#lk', 'despesa'); p9.fill('#lv', '5000'); p9.click('#dlg [data-a=saveLan]'); p9.wait_for_timeout(400)
        p9.click('#dlg [data-a=confSim]'); p9.wait_for_timeout(700)
        ok(n_lan() == 2, 'CT-KAN-161-03: "Lançar assim mesmo" grava')
        p9.click('[data-a=addLan]'); p9.wait_for_timeout(300); p9.fill('#lv', '0'); p9.click('#dlg [data-a=saveLan]'); p9.wait_for_timeout(300)
        ok('Informe um valor' in p9.inner_text('#toast') and n_lan() == 2, 'CT-KAN-161-07: valor zero continua recusado')
        p9.click('#dlg [data-a=close]'); p9.wait_for_timeout(300)
        if p9.locator('#dlg .conf').count(): confirmar_app(p9, True)
        p9.click('[data-a=tab][data-v=jogadores]'); p9.wait_for_timeout(300)
        p9.click(f'[data-a=editPlayer][data-p="{ids9[1]}"]'); p9.wait_for_timeout(300)
        p9.check('#prj'); p9.fill('#prv', '9999'); p9.click('[data-a=savePlayer]'); p9.wait_for_timeout(400)
        ok('normal deste grupo' in (p9.inner_text('#dlg .conf') if p9.locator('#dlg .conf').count() else ''), 'CT-KAN-161: valor por jogo fora do padrão também pergunta na ficha')
        p9.click('#dlg [data-a=confNao]'); p9.wait_for_timeout(300)
        ok(p9.evaluate("document.activeElement && document.activeElement.id") == 'prv', 'CT-KAN-161: "Corrigir valor" na ficha volta ao valor por jogo')
        ctx9.close()

        # ---------- v58 (KAN-179): confirmados por posição e mínimo para o jogo, em futebol, vôlei e beach tennis (navegador separado)
        ctx10 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p10 = ctx10.new_page()
        p10.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p10, 'criar')
        p10.fill('#le', 'minimo@teste.com'); p10.fill('#lp', 'Jogo@2026'); p10.fill('#lp2', 'Jogo@2026'); p10.keyboard.press('Enter'); p10.wait_for_timeout(1300)
        p10.fill('#ngn', 'Mínimo FC'); p10.click('[data-a=pickSport][data-v=futebol]'); p10.click('[data-a=createGroup]'); p10.wait_for_timeout(1500)
        p10.click('[data-a=tab][data-v=jogadores]'); p10.wait_for_timeout(300); p10.click('[data-a=seed]'); p10.wait_for_timeout(1500)
        jog10 = p10.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false).map(id=>[id,S.jog[id].pos])")
        gol10 = [i for i, k in jog10 if k == 'GOL'][:1]; def10 = [i for i, k in jog10 if k == 'DEF'][:2]
        p10.click('[data-a=tab][data-v=rodada]'); p10.wait_for_timeout(600)
        for pid in gol10 + def10:
            p10.click(f'[data-a=mark][data-v=in][data-p="{pid}"]'); p10.wait_for_timeout(350)
        p10.wait_for_timeout(400)
        chip = lambda pg_, k: pg_.inner_text(f'#porPosicao [data-pos="{k}"]').replace('\n', ' ').strip() if pg_.locator(f'#porPosicao [data-pos="{k}"]').count() else ''
        ok(chip(p10, 'GOL') == 'GOL 1' and chip(p10, 'DEF') == 'DEF 2' and chip(p10, 'MEI') == '', f'CT-KAN-179-01: aba Rodada mostra os confirmados por posição ({chip(p10, "GOL")!r}, {chip(p10, "DEF")!r})')
        p10.click('#porPosicao [data-a=abrirMinimos]'); p10.wait_for_timeout(400)
        foco = p10.evaluate("document.activeElement && document.activeElement.dataset.k")
        ok(foco == '_total' and p10.locator('#minRaiz .minp').count() == 5, f'CT-KAN-179-05: a janela abre com o cursor no total e um campo por posição do futebol ({foco!r})')
        p10.fill('#minRaiz .minp[data-k="_total"]', '5'); p10.fill('#minRaiz .minp[data-k="GOL"]', '2')
        p10.locator('#minRaiz .minp[data-k="GOL"]').press('Enter'); p10.wait_for_timeout(800)
        falta = p10.inner_text('#faltaPos') if p10.locator('#faltaPos').count() else ''
        ok(not p10.locator('#dlg[open]').count() and chip(p10, 'GOL') == 'GOL 1 de 2' and 'Falta 1 GOL' in falta and 'Faltam 2 jogadores' in falta,
           f'CT-KAN-179-02: Enter salva; aparece "GOL 1 de 2", "Falta 1 GOL" e "Faltam 2 jogadores" ({falta!r})')
        ok(p10.evaluate("JSON.stringify(S.app.cfg.minPos)") == '{"GOL":2,"_total":5}', 'CT-KAN-179-02: o mínimo fica salvo no grupo só com o que tem valor')
        p10.locator('#porPosicao').screenshot(path=f'{OUT}/58-por-posicao.png'); contraste(p10, 'Confirmados por posição')
        p10.set_viewport_size({'width': 360, 'height': 800}); p10.wait_for_timeout(300)
        ok(p10.evaluate("document.documentElement.scrollWidth") <= 360, 'CT-KAN-179: em 360px o quadro cabe sem rolagem lateral')
        p10.click('#porPosicao [data-a=abrirMinimos]'); p10.wait_for_timeout(400); p10.screenshot(path=f'{OUT}/58-minimo-360.png')
        bt = p10.locator('#dlg [data-a=salvarMinimos]').bounding_box(); cp = p10.locator('#minRaiz .minp').first.bounding_box()
        ok(bt['height'] >= 44 and cp['height'] >= 44, f'CT-KAN-179: botão e campos com 44px ({bt["height"]:.0f}, {cp["height"]:.0f})')
        p10.click('#dlg [data-a=close]'); p10.wait_for_timeout(300)
        if p10.locator('#dlg .conf').count(): confirmar_app(p10, True)
        p10.set_viewport_size({'width': 390, 'height': 844})
        p10.reload(); p10.wait_for_timeout(1500); p10.click('[data-a=tab][data-v=rodada]'); p10.wait_for_timeout(600)
        ok(chip(p10, 'GOL') == 'GOL 1 de 2', 'CT-KAN-179-02: depois de recarregar o mínimo continua')
        gid10 = p10.evaluate("S.gid"); rid10 = p10.evaluate("S.presRid")
        pl10 = ctx10.new_page(); pl10.goto(URL + '#/p/' + gid10 + '/r/' + rid10); pl10.wait_for_timeout(1500)
        fl = pl10.inner_text('#faltaPos') if pl10.locator('#faltaPos').count() else ''
        ok(chip(pl10, 'GOL') == 'GOL 1 de 2' and chip(pl10, 'DEF') == 'DEF 2' and 'Falta 1 GOL' in fl and pl10.locator('[data-a=abrirMinimos]').count() == 0,
           f'CT-KAN-179-02: o link do jogador mostra a contagem e o que falta, sem o botão de definir ({fl!r})')
        pl10.locator('#porPosicao').screenshot(path=f'{OUT}/58-link-por-posicao.png'); contraste(pl10, 'Por posição no link'); pl10.close()
        p10.click('#porPosicao [data-a=abrirMinimos]'); p10.wait_for_timeout(400)
        p10.fill('#minRaiz .minp[data-k="_total"]', '0'); p10.fill('#minRaiz .minp[data-k="GOL"]', '0'); p10.click('#dlg [data-a=salvarMinimos]'); p10.wait_for_timeout(800)
        ok(p10.locator('#faltaPos').count() == 0 and chip(p10, 'GOL') == 'GOL 1', 'CT-KAN-179-03: mínimo zerado, o aviso some e fica só a contagem')
        # Vôlei: as siglas vêm do esporte, nada de goleiro
        novo_grupo(p10, 'Mínimo Vôlei', 'volei')
        p10.click('[data-a=tab][data-v=jogadores]'); p10.wait_for_timeout(300); p10.click('[data-a=seed]'); p10.wait_for_timeout(1500)
        p10.click('[data-a=tab][data-v=rodada]'); p10.wait_for_timeout(600)
        bv = p10.locator('[data-a=mark][data-v=in]')
        for i in range(3): bv.nth(i).click(); p10.wait_for_timeout(350)
        p10.click('#porPosicao [data-a=abrirMinimos]'); p10.wait_for_timeout(400)
        ks = p10.evaluate("[...document.querySelectorAll('#minRaiz .minp')].map(i=>i.dataset.k)")
        p10.fill('#minRaiz .minp[data-k="LEV"]', '2'); p10.click('#dlg [data-a=salvarMinimos]'); p10.wait_for_timeout(800)
        tv = p10.inner_text('#porPosicao')
        ok(ks == ['_total', 'LEV', 'PON', 'CEN', 'OPO', 'LIB'] and 'LEV' in tv and not FUTEBOL.search(tv), f'CT-KAN-179-04: vôlei usa as posições do vôlei, sem goleiro ({ks})')
        # Beach tennis: sem posição, só o mínimo total
        novo_grupo(p10, 'Mínimo Praia', 'beach_tennis')
        p10.click('[data-a=tab][data-v=jogadores]'); p10.wait_for_timeout(300); p10.click('[data-a=seed]'); p10.wait_for_timeout(1500)
        p10.click('[data-a=tab][data-v=rodada]'); p10.wait_for_timeout(600)
        bb = p10.locator('[data-a=mark][data-v=in]')
        for i in range(3): bb.nth(i).click(); p10.wait_for_timeout(350)
        p10.click('#porPosicao [data-a=abrirMinimos]'); p10.wait_for_timeout(400)
        kb = p10.evaluate("[...document.querySelectorAll('#minRaiz .minp')].map(i=>i.dataset.k)")
        p10.fill('#minRaiz .minp[data-k="_total"]', '8'); p10.click('#dlg [data-a=salvarMinimos]'); p10.wait_for_timeout(800)
        tb = p10.inner_text('#porPosicao')
        ok(kb == ['_total'] and 'Mínimo para o jogo' in tb and 'Total 3 de 8' in tb.replace('\n', ' ') and 'Faltam 5 jogadores' in tb and not FUTEBOL.search(tb),
           f'CT-KAN-179-04: beach tennis (sem posição) usa só o mínimo total ({tb[:80]!r})')
        ctx10.close()

        # ---------- v59 (KAN-63): vagas para diaristas e avulsos (navegador separado)
        ctx11 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p11 = ctx11.new_page()
        p11.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p11, 'criar')
        p11.fill('#le', 'vagas@teste.com'); p11.fill('#lp', 'Jogo@2026'); p11.fill('#lp2', 'Jogo@2026'); p11.keyboard.press('Enter'); p11.wait_for_timeout(1300)
        p11.fill('#ngn', 'Vagas FC'); p11.click('[data-a=pickSport][data-v=futebol]'); p11.click('[data-a=createGroup]'); p11.wait_for_timeout(1500)
        p11.click('[data-a=tab][data-v=jogadores]'); p11.wait_for_timeout(300); p11.click('[data-a=seed]'); p11.wait_for_timeout(1500)
        p11.click('[data-a=tab][data-v=rodada]'); p11.wait_for_timeout(700)
        dia11 = p11.evaluate("Object.keys(S.pc.tipos).filter(id=>S.pc.tipos[id]==='diarista'&&S.jog[id]&&S.jog[id].ativo!==false)")
        men11 = p11.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false&&(S.pc.tipos[id]||'mensalista')!=='diarista')")
        ok(p11.locator('#vagasPainel').count() == 0 and p11.evaluate("Object.values(S.jog).every(j=>!j.vaga)") and len(dia11) >= 2,
           f'CT-KAN-63-01: sem o controle ligado, nada muda (sem quadro de vagas e ninguém marcado; {len(dia11)} diaristas no elenco)')
        p11.click('#porPosicao [data-a=abrirMinimos]'); p11.wait_for_timeout(400)
        p11.check('#vagasCtrl'); p11.click('#dlg [data-a=salvarMinimos]'); p11.wait_for_timeout(1200)
        est = p11.inner_text('#vagasEstado') if p11.locator('#vagasEstado').count() else ''
        marc = p11.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].vaga).sort().join()")
        ok('Fechadas' in est and marc == ','.join(sorted(p11.evaluate("Object.keys(S.pc.tipos).filter(id=>S.pc.tipos[id]==='diarista'&&S.jog[id])"))),
           f'CT-KAN-63-02: ligado o controle, o quadro mostra "Fechadas" e só os diaristas ganham a marca ({est!r})')
        p11.locator('#vagasPainel').screenshot(path=f'{OUT}/59-vagas-fechadas.png'); contraste(p11, 'Vagas fechadas')
        nomes_dia11 = p11.evaluate("(ids)=>ids.map(i=>S.jog[i].name)", dia11)
        falta11 = [x.strip() for x in p11.inner_text('#semResposta > p').split(',')] if p11.locator('#semResposta > p').count() else []
        ok(falta11 and not any(n in falta11 for n in nomes_dia11),
           f'CT-KAN-206-01: com as vagas fechadas, diarista não aparece em "Ainda não responderam" nem na cobrança ({nomes_dia11})')
        gid11 = p11.evaluate("S.gid"); rid11 = p11.evaluate("S.presRid")
        pl11 = ctx11.new_page(); pl11.on('pageerror', lambda e: errs.append(str(e)))
        abrir_link = lambda: (pl11.goto(URL + '#/p/' + gid11 + '/r/' + rid11), pl11.reload(), pl11.wait_for_timeout(1500))
        # No modo demonstração, cada aba guarda o banco inteiro: recarregue a gestão antes de agir depois do link.
        gestao11 = lambda: (p11.reload(), p11.wait_for_timeout(1500), p11.click('[data-a=tab][data-v=rodada]'), p11.wait_for_timeout(700))
        abrir_link()
        vis = lambda pid: pl11.locator(f'[data-a=pubMark][data-v=in][data-p="{pid}"]').count() > 0
        av = pl11.inner_text('#avisoVagas') if pl11.locator('#avisoVagas').count() else ''
        ok(not any(vis(x) for x in dia11) and vis(men11[0]) and pl11.locator('[data-a=pubAdd]').count() == 0 and 'ainda não abertas' in av,
           f'CT-KAN-63-03: vagas fechadas: diaristas somem do link, mensalista aparece, sem "Adicionar meu nome" ({av!r})')
        pl11.locator('#avisoVagas').screenshot(path=f'{OUT}/59-link-fechadas.png'); contraste(pl11, 'Link com vagas fechadas')
        pl11.click(f'[data-a=pubMark][data-v=in][data-p="{men11[0]}"]'); pl11.wait_for_timeout(700)
        ok((pl11.evaluate(LER, pres_k(gid11, rid11, men11[0])) or {}).get('s') == 'in', 'CT-KAN-63-03: mensalista confirma normalmente com as vagas fechadas')
        # Abrir 1 vaga
        gestao11(); p11.click('#vagasPainel [data-a=abrirVagas]'); p11.wait_for_timeout(400)
        foco = p11.evaluate("document.activeElement && document.activeElement.id")
        p11.fill('#vagasN', '1'); p11.locator('#vagasN').press('Enter'); p11.wait_for_timeout(900)
        est = p11.inner_text('#vagasEstado')
        ok(foco == 'vagasN' and 'Abertas · 0 de 1' in est and not p11.locator('#dlg[open]').count(), f'CT-KAN-63-04: "Abrir vagas" abre com o cursor na quantidade; Enter abre ({est!r})')
        falta11 = [x.strip() for x in p11.inner_text('#semResposta > p').split(',')] if p11.locator('#semResposta > p').count() else []
        ok(all(n in falta11 for n in nomes_dia11), 'CT-KAN-206-01: com vaga aberta, os diaristas voltam para "Ainda não responderam"')
        abrir_link()
        av = pl11.inner_text('#avisoVagas') if pl11.locator('#avisoVagas').count() else ''
        ok(all(vis(x) for x in dia11) and pl11.locator('[data-a=pubAdd]').count() == 1 and 'Resta 1 vaga' in av, f'CT-KAN-63-05: com vaga aberta, diaristas e "Adicionar meu nome" voltam ao link ({av!r})')
        pl11.click(f'[data-a=pubMark][data-v=in][data-p="{dia11[0]}"]'); pl11.wait_for_timeout(900)
        nvg = (pl11.evaluate(LER, f'grupos/{gid11}/rodadas/{rid11}/limites/vagas') or {}).get('n')
        abrir_link()
        av = pl11.inner_text('#avisoVagas') if pl11.locator('#avisoVagas').count() else ''
        ok(nvg == 1 and vis(dia11[0]) and not vis(dia11[1]) and pl11.locator('[data-a=pubAdd]').count() == 0 and 'acabaram' in av,
           f'CT-KAN-63-05: o diarista ocupa a vaga ({nvg}); esgotou, os outros somem e o link avisa ({av!r})')
        gestao11()
        ok('Esgotadas · 1 de 1' in p11.inner_text('#vagasEstado'), 'CT-KAN-63-05: na gestão, "Esgotadas · 1 de 1 preenchidas"')
        pl11.click(f'[data-a=pubMark][data-v=out][data-p="{dia11[0]}"]'); pl11.wait_for_timeout(900)
        nvg2 = (pl11.evaluate(LER, f'grupos/{gid11}/rodadas/{rid11}/limites/vagas') or {}).get('n')
        abrir_link()
        ok(nvg2 == 0 and vis(dia11[1]) and 'Resta 1 vaga' in pl11.inner_text('#avisoVagas'), f'CT-KAN-63-06: quem desiste devolve a vaga ({nvg2}) e o link volta a mostrar os diaristas')
        # Avulso novo ocupa a vaga
        av_id = adicionar_pelo_link(pl11, 'Avulso Vaga')
        nvg3 = (pl11.evaluate(LER, f'grupos/{gid11}/rodadas/{rid11}/limites/vagas') or {}).get('n')
        ok(av_id and nvg3 == 1, f'CT-KAN-63-07: avulso novo pelo link ocupa uma vaga ({nvg3})')
        # Fechar
        gestao11(); p11.click('#vagasPainel [data-a=fecharVagas]'); p11.wait_for_timeout(800)
        abrir_link()
        ok('Fechadas' in p11.inner_text('#vagasEstado') and not vis(dia11[1]) and 'Avulso Vaga' in pl11.inner_text('main'),
           'CT-KAN-63-08: "Fechar vagas" esconde de novo quem precisa de vaga; quem já entrou continua na lista')
        # Administrador põe o diarista mesmo com as vagas fechadas
        p11.click(f'[data-a=mark][data-v=in][data-p="{dia11[1]}"]'); p11.wait_for_timeout(700)
        ok((p11.evaluate(LER, pres_k(gid11, rid11, dia11[1])) or {}).get('s') == 'in', 'CT-KAN-63-09: o administrador confirma o diarista pela gestão mesmo com as vagas fechadas')
        p11.set_viewport_size({'width': 360, 'height': 800}); p11.wait_for_timeout(300)
        p11.click('#vagasPainel [data-a=abrirVagas]'); p11.wait_for_timeout(400); p11.screenshot(path=f'{OUT}/59-abrir-vagas-360.png')
        ok(p11.evaluate("document.documentElement.scrollWidth") <= 360 and p11.locator('#dlg [data-a=salvarVagas]').bounding_box()['height'] >= 44, 'CT-KAN-63: janela "Abrir vagas" cabe em 360px, botão com 44px')
        p11.click('#dlg [data-a=close]'); p11.wait_for_timeout(300)
        if p11.locator('#dlg .conf').count(): confirmar_app(p11, True)
        p11.set_viewport_size({'width': 390, 'height': 844})
        # Desligar o controle: marcas somem e o link mostra todo mundo
        p11.click('#porPosicao [data-a=abrirMinimos]'); p11.wait_for_timeout(400)
        p11.uncheck('#vagasCtrl'); p11.click('#dlg [data-a=salvarMinimos]'); p11.wait_for_timeout(1200)
        abrir_link()
        d10 = (p11.locator('#vagasPainel').count(), p11.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].vaga).length"), [vis(x) for x in dia11], pl11.locator('#avisoVagas').count())
        ok(d10[0] == 0 and d10[1] == 0 and all(d10[2]) and d10[3] == 0,
           f'CT-KAN-63-10 {d10}: desligado o controle, as marcas somem e o link volta a ser como antes')
        ctx11.close()

        # ---------- v60: times por número (Time 1, Time 2), cor só no colete, e qualquer minuto no cronômetro (navegador separado)
        ctx12 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p12 = ctx12.new_page()
        p12.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p12, 'criar')
        p12.fill('#le', 'times@teste.com'); p12.fill('#lp', 'Jogo@2026'); p12.fill('#lp2', 'Jogo@2026'); p12.keyboard.press('Enter'); p12.wait_for_timeout(1300)
        p12.fill('#ngn', 'Times FC'); p12.click('[data-a=pickSport][data-v=futebol]'); p12.click('[data-a=createGroup]'); p12.wait_for_timeout(1500)
        elenco_e_presenca(p12, 10)
        p12.click('[data-a=drawDlg]'); p12.wait_for_timeout(300)
        p12.click('[data-a=dN][data-v="2"]'); p12.wait_for_timeout(200); p12.click('#drawGo'); p12.wait_for_timeout(2500)
        nomes12 = p12.evaluate("[...document.querySelectorAll('.team .th b')].map(b=>b.textContent)")
        col12 = p12.evaluate("[...document.querySelectorAll('.team [data-a=color]')].map(b=>b.textContent.trim())")
        cores0 = p12.evaluate("Object.values(S.rod).find(r=>r.times).times.map(t=>t.c)")
        ok(nomes12 == ['Time 1', 'Time 2'] and all(c.startswith('colete ') for c in col12), f'CT-v60-01: os times se chamam Time 1 e Time 2, e a cor aparece como colete ({nomes12}, {col12})')
        p12.locator('.team').first.screenshot(path=f'{OUT}/60-time-colete.png'); contraste(p12, 'Time com colete')
        p12.locator('.team [data-a=color][data-v="0"]').click(); p12.wait_for_timeout(400)
        n_cores = p12.locator('#coletes [data-a=pickColor]').count()
        p12.screenshot(path=f'{OUT}/60-escolher-colete.png')
        p12.locator(f'#coletes [data-a=pickColor][data-c2="{cores0[1]}"]').click(); p12.wait_for_timeout(800)
        cores1 = p12.evaluate("(()=>{const r=Object.values(S.rod).find(r=>r.times);return r.times.map((t,i)=>(r.cores&&r.cores[i]!=null)?r.cores[i]:t.c)})()")
        ok(n_cores == 8 and cores1 == [cores0[1], cores0[0]] and p12.evaluate("[...document.querySelectorAll('.team .th b')].map(b=>b.textContent)") == ['Time 1', 'Time 2'],
           f'CT-v60-02: escolher a cor de outro time troca os coletes dos dois; os nomes continuam ({cores0} → {cores1})')
        # Cronômetro: qualquer minuto (o Kleber não conseguia 9)
        p12.click('[data-a=tab][data-v=partida]'); p12.wait_for_selector('#partidaRaiz .board', timeout=8000); p12.wait_for_timeout(300)
        mins = p12.evaluate("[...document.querySelectorAll('[data-c=dur] option')].map(o=>o.value)")
        p12.select_option('[data-c=dur]', '9'); p12.wait_for_timeout(300)
        ok(all(str(m) in mins for m in range(1, 61)) and p12.evaluate("S.live.dur") == 540 and p12.inner_text('#clock') == '09:00',
           f'CT-v60-03: o cronômetro aceita qualquer minuto de 1 a 60; 9 minutos mostra 09:00 ({p12.inner_text("#clock")})')
        ok(p12.evaluate("[...document.querySelectorAll('[data-c=ta] option')].map(o=>o.textContent)") == ['Time 1', 'Time 2'], 'CT-v60-04: na Partida, os times aparecem como Time 1 e Time 2')
        p12.click('[data-a=saveMatch]'); p12.wait_for_timeout(900)
        if p12.locator('#dlg .conf').count(): confirmar_app(p12, True); p12.wait_for_timeout(600)
        m12 = p12.evaluate("(()=>{const ms=Object.values(S.parts||{}).filter(m=>m.tipo!=='art');return ms.length?ms[0]:null})()") or {}
        salvas = p12.inner_text('#partidaRaiz') if p12.locator('#partidaRaiz').count() else ''
        ok(m12.get('ta') == 0 and m12.get('tb') == 1 and 'Time 1' in salvas and 'Time 2' in salvas, f'CT-v60-05: a partida salva guarda a posição dos times e aparece como Time 1 × Time 2 ({m12.get("ta")}, {m12.get("tb")})')
        # Trocar o colete depois não muda o nome na partida já salva
        p12.click('[data-a=tab][data-v=rodada]'); p12.wait_for_timeout(500)
        trocar_colete(p12, '.team [data-a=color][data-v="0"]')
        p12.click('[data-a=tab][data-v=partida]'); p12.wait_for_timeout(600)
        ok('Time 1' in p12.inner_text('#partidaRaiz'), 'CT-v60-05: trocar o colete depois não muda o nome na partida salva')
        gid12 = p12.evaluate("S.gid"); rid12 = p12.evaluate("S.presRid")
        pl12 = ctx12.new_page(); pl12.goto(URL + '#/p/' + gid12 + '/r/' + rid12); pl12.wait_for_timeout(1500)
        tl = pl12.inner_text('main')
        ok('Time 1' in tl and 'Time 2' in tl and 'colete ' in tl and not any(c + ' ' in tl.split('Partidas')[0] for c in ['Laranja', 'Azul', 'Amarelo']),
           'CT-v60-06: no link do jogador, os times aparecem como Time 1 e Time 2, com o colete ao lado')
        pl12.close(); ctx12.close()

        # ---------- v61 (KAN-180): Caixa, Histórico, Votação e Ranking baixam só ao abrir a aba (navegador separado)
        ctx13 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p13 = ctx13.new_page(); ped13 = []
        p13.on('pageerror', lambda e: errs.append(str(e)))
        p13.on('request', lambda r: ped13.append(r.url))
        abrir_entrada(p13, 'criar')
        p13.fill('#le', 'abas@teste.com'); p13.fill('#lp', 'Jogo@2026'); p13.fill('#lp2', 'Jogo@2026'); p13.keyboard.press('Enter'); p13.wait_for_timeout(1300)
        p13.fill('#ngn', 'Abas FC'); p13.click('[data-a=pickSport][data-v=futebol]'); p13.click('[data-a=createGroup]'); p13.wait_for_timeout(1500)
        p13.click('[data-a=tab][data-v=jogadores]'); p13.wait_for_timeout(300); p13.click('[data-a=seed]'); p13.wait_for_timeout(1500)
        pedaco = lambda nome: any(f'/chunks/{nome}-' in u for u in ped13)
        ok(not any(pedaco(n) for n in ('caixa', 'historico', 'votacao', 'ranking')), 'CT-KAN-180-01: abrir a gestão não baixa Caixa, Histórico, Votação nem Ranking')
        abriu = {}
        for aba, sinal in (('caixa', '[data-a=addLan]'), ('historico', '[data-a=histModo]'), ('ranking', '#rankAno,[data-c=rankAno],.tbl,.empty')):
            p13.click(f'[data-a=tab][data-v={aba}]'); p13.wait_for_timeout(1200)
            abriu[aba] = (pedaco(aba), p13.locator(sinal).count() > 0)
        okp(all(v == (True, True) for v in abriu.values()), f'CT-KAN-180-02: cada aba baixa a sua parte ao ser aberta e aparece normalmente ({abriu})')
        # Sem internet: as abas que já chegaram abrem; a que nunca foi aberta avisa e, com a internet de volta, abre
        ctx13.set_offline(True)
        p13.click('[data-a=tab][data-v=caixa]'); p13.wait_for_timeout(500)
        cx_off = p13.locator('[data-a=addLan]').count() > 0
        p13.click('[data-a=tab][data-v=historico]'); p13.wait_for_timeout(500)
        ok(cx_off and p13.locator('[data-a=histModo]').count() > 0, 'CT-KAN-180-03: sem internet, Caixa e Histórico já usados abrem normalmente')
        p13.click('[data-a=tab][data-v=votacao]'); p13.wait_for_timeout(1500)
        okp('Não foi possível carregar' in p13.inner_text('main'), 'CT-KAN-180-04: sem internet, aba que nunca chegou avisa que não carregou')
        # O navegador guarda a falha de um pedaço até recarregar; por isso o aviso pede para recarregar a página.
        ctx13.set_offline(False)
        p13.reload(); p13.wait_for_timeout(1500); p13.click('[data-a=tab][data-v=votacao]'); p13.wait_for_timeout(1500)
        okp(pedaco('votacao') and p13.locator('[data-a=newVote]').count() > 0, 'CT-KAN-180-04: com a internet de volta, recarregando a página, a Votação abre')
        ctx13.close()

        # ---------- v62 (KAN-184): link com internet ruim tenta de novo e nunca diz "não encontrado" por falha de rede
        ctx14 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p14 = ctx14.new_page()
        p14.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p14, 'criar')
        p14.fill('#le', 'carga@teste.com'); p14.fill('#lp', 'Jogo@2026'); p14.fill('#lp2', 'Jogo@2026'); p14.keyboard.press('Enter'); p14.wait_for_timeout(1300)
        p14.fill('#ngn', 'Carga FC'); p14.click('[data-a=pickSport][data-v=futebol]'); p14.click('[data-a=createGroup]'); p14.wait_for_timeout(1500)
        p14.click('[data-a=tab][data-v=rodada]'); p14.wait_for_timeout(700)
        gid14 = p14.evaluate("S.gid")
        def link_com(falhas, segurar=False, espera=1500):
            pg_ = ctx14.new_page()
            chave = 'grupos/' + gid14
            pg_.add_init_script(f"window.__njFalhar={{{json.dumps(chave)}:{falhas}}};" + (f"window.__njSegurar={{{json.dumps(chave)}:true}};" if segurar else ''))
            pg_.goto(URL + '#/p/' + gid14); pg_.wait_for_timeout(espera)
            return pg_
        l1 = link_com(2, espera=4000)
        t1 = l1.inner_text('main')
        ok('Carga FC' in l1.inner_text('body') and 'não encontrado' not in t1 and 'Você vai?' in t1,
           'CT-KAN-184-01: a leitura do grupo falha 2 vezes por rede e, na nova tentativa, o link abre normalmente')
        l1.close()
        l2 = link_com(99, espera=9500)
        t2 = l2.inner_text('main')
        ok('Não foi possível carregar' in t2 and l2.locator('#cargaFalhou').count() == 1 and 'não encontrado' not in t2,
           f'CT-KAN-184-02: falhando sempre, o link avisa "Não foi possível carregar" com "Tentar de novo", e não "Grupo não encontrado" ({t2[:60]!r})')
        l2.screenshot(path=f'{OUT}/62-falhou-carga.png'); contraste(l2, 'Falha ao carregar')
        l2.close()
        l3 = ctx14.new_page(); l3.goto(URL + '#/p/grupoQueNaoExiste'); l3.wait_for_timeout(1500)
        ok('Grupo não encontrado' in l3.inner_text('main'), 'CT-KAN-184-03: grupo que não existe mesmo continua "Grupo não encontrado"')
        l3.close()
        l4 = link_com(0, segurar=True, espera=13000)
        ok(l4.locator('#cargaDemorada').count() == 1 and 'demorando' in l4.inner_text('main'), 'CT-KAN-184-04: carregando há mais de 12 s, avisa que está demorando e oferece tentar de novo')
        l4.close(); ctx14.close()

        # ---------- v63 (KAN-183): o link do jogador não baixa a tela de entrar nem a votação
        ctx15 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p15 = ctx15.new_page(); ped15 = []
        p15.on('pageerror', lambda e: errs.append(str(e)))
        p15.on('request', lambda r: ped15.append(r.url))
        abrir_entrada(p15, 'criar')
        okp(any('/chunks/entrar-' in u for u in ped15) and p15.evaluate("document.activeElement && document.activeElement.id") == 'le',
           'CT-KAN-183-02: a tela de criar conta baixa a parte "entrar" e abre com o cursor no e-mail')
        p15.fill('#le', 'link183@teste.com'); p15.fill('#lp', 'Jogo@2026'); p15.fill('#lp2', 'Jogo@2026'); p15.keyboard.press('Enter'); p15.wait_for_timeout(1300)
        p15.fill('#ngn', 'Link FC'); p15.click('[data-a=pickSport][data-v=futebol]'); p15.click('[data-a=createGroup]'); p15.wait_for_timeout(1500)
        gid15 = p15.evaluate("S.gid")
        # O jogador abre o link num aparelho sem nada guardado: novo navegador, com o banco de demonstração copiado
        banco = p15.evaluate("localStorage.getItem('pelada-demo-v2')")
        ctxj = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block')
        ctxj.add_init_script("localStorage.setItem('pelada-demo-v2', " + json.dumps(banco) + ")")
        pj = ctxj.new_page(); pedj = []; pj.on('request', lambda r: pedj.append(r.url)); pj.on('pageerror', lambda e: errs.append(str(e)))
        pj.goto(URL + '#/p/' + gid15); pj.wait_for_timeout(1500)
        pedacos_j = [u.rsplit('/', 1)[-1].split('-')[0] for u in pedj if '/chunks/' in u]
        ok('Você vai?' in pj.inner_text('main') and not any(n in pedacos_j for n in ('entrar', 'publico', 'admin')),
           f'CT-KAN-183-01: o link do jogador abre sem baixar a tela de entrar, a votação nem a gestão ({pedacos_j})')
        ctxj.close(); ctx15.close()

        # ---------- v64: casos "(automatizável)" que a Qualidade validou à mão na v63 (KAN-63, 179, 181, 182, 184) e KAN-185
        ctx16 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p16 = ctx16.new_page()
        p16.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p16, 'criar')
        p16.fill('#le', 'qa64@teste.com'); p16.fill('#lp', 'Jogo@2026'); p16.fill('#lp2', 'Jogo@2026'); p16.keyboard.press('Enter'); p16.wait_for_timeout(1300)
        p16.fill('#ngn', 'QA FC'); p16.click('[data-a=pickSport][data-v=futebol]'); p16.click('[data-a=createGroup]'); p16.wait_for_timeout(1500)
        elenco_e_presenca(p16, 11)
        gid16 = p16.evaluate("S.gid"); rid16 = p16.evaluate("S.presRid")
        def minimos(total='', gol=''):
            p16.click('#porPosicao [data-a=abrirMinimos]'); p16.wait_for_timeout(400)
            p16.fill('#minRaiz .minp[data-k="_total"]', str(total)); p16.fill('#minRaiz .minp[data-k="GOL"]', str(gol))
            p16.click('#dlg [data-a=salvarMinimos]'); p16.wait_for_timeout(800)
        # KAN-179-07: dados estranhos
        minimos(-3, 99999)
        mp = p16.evaluate("JSON.stringify(S.app.cfg.minPos||{})")
        ok(mp == '{"GOL":99}', f'CT-KAN-179-07: total −3 não grava e GOL 99999 fica em 99 ({mp})')
        minimos(14, 2)
        # KAN-185 e KAN-179-08: contraste no tema escuro, na gestão e no link, com posição faltando; 360px sem rolagem
        p16.evaluate("document.documentElement.dataset.theme='dark'"); p16.wait_for_timeout(200)
        contraste(p16, 'Mínimo para o jogo no tema escuro (CT-KAN-185-01)')
        cf = p16.evaluate("(()=>{const e=document.querySelector('#porPosicao .poschips span.falta');if(!e)return 0;const L=c=>{const m=c.match(/[\\d.]+/g).map(Number);const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};const s=getComputedStyle(e),a=L(s.color),b=L(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)})()")
        ok(cf >= 4.5, f'CT-KAN-185-01: no tema escuro, o selo da posição que falta tem contraste de pelo menos 4,5:1 ({cf:.2f})')
        p16.set_viewport_size({'width': 360, 'height': 800}); p16.wait_for_timeout(200)
        ok(p16.evaluate("document.documentElement.scrollWidth") <= 360, 'CT-KAN-179-08: em 360px, no tema escuro, o quadro cabe sem rolagem lateral')
        p16.set_viewport_size({'width': 390, 'height': 844})
        pl16 = ctx16.new_page(); pl16.emulate_media(color_scheme='dark'); pl16.goto(URL + '#/p/' + gid16 + '/r/' + rid16); pl16.wait_for_timeout(1500)
        pl16.evaluate("document.documentElement.dataset.theme='dark'"); pl16.wait_for_timeout(200)
        ok(pl16.locator('#porPosicao .falta').count() >= 1, 'CT-KAN-185-02: o link mostra o selo da posição que falta')
        contraste(pl16, 'link com posição faltando no tema escuro (CT-KAN-185-02)')
        pl16.screenshot(path=f'{OUT}/64-link-escuro.png')
        # KAN-63-14: o link público não leva dados privados, nem com o controle de vagas ligado
        p16.evaluate("document.documentElement.dataset.theme='light'")
        p16.click('#porPosicao [data-a=abrirMinimos]'); p16.wait_for_timeout(400); p16.check('#vagasCtrl'); p16.click('#dlg [data-a=salvarMinimos]'); p16.wait_for_timeout(1200)
        pl16.reload(); pl16.wait_for_timeout(1500)
        priv = pl16.evaluate("[S.pc, S.rat, Object.keys(S.cont||{}).length, Object.keys(S.caixa||{}).length]")
        corpo = pl16.inner_text('body').lower()
        campos_jog = pl16.evaluate("[...new Set(Object.values(S.jog||{}).flatMap(j=>Object.keys(j||{})))].sort().join()")
        ok(priv == [None, None, 0, 0] and not any(p in corpo for p in ('mensalista', 'isento', 'r$', 'pix')) and set(campos_jog.split(',')) <= {'name', 'pos', 'ativo', 'criado', 'vaga', ''},
           f'CT-KAN-63-14: o link público não traz tipo, valores, notas, contatos nem caixa ({priv}; jogador: {campos_jog})')
        # KAN-63-11 e 13: sugestão do que falta; valores estranhos; tocar fora pergunta; dois toques gravam uma vez
        p16.click('[data-a=tab][data-v=rodada]'); p16.wait_for_timeout(500)
        conf16 = p16.evaluate("S.pres?Object.values(S.pres).filter(x=>x&&x.s==='in').length:0")
        p16.click('#vagasPainel [data-a=abrirVagas]'); p16.wait_for_timeout(400)
        sug = p16.input_value('#vagasN')
        ok(sug == str(14 - conf16), f'CT-KAN-63-11: "Abrir vagas" já sugere o que falta para o mínimo (14 − {conf16} = {sug})')
        p16.fill('#vagasN', '7'); p16.mouse.click(8, 8); p16.wait_for_timeout(400)
        perguntou = p16.locator('#dlg .conf').count() == 1
        if perguntou: confirmar_app(p16, True)
        ok(perguntou and not (p16.evaluate("(S.rod[S.presRid]||{}).vagas") or {}).get('aberta'), 'CT-KAN-63-13: tocar fora com 7 digitado pergunta e não abre vagas')
        p16.click('#vagasPainel [data-a=abrirVagas]'); p16.wait_for_timeout(400); p16.fill('#vagasN', '-5'); p16.click('#dlg [data-a=salvarVagas]'); p16.wait_for_timeout(800)
        v1 = p16.evaluate("JSON.stringify((S.rod[S.presRid]||{}).vagas)")
        p16.click('#vagasPainel [data-a=abrirVagas]'); p16.wait_for_timeout(400); p16.fill('#vagasN', '5000')
        btn = p16.locator('#dlg [data-a=salvarVagas]'); btn.click(); btn.click(force=True) if btn.count() else None; p16.wait_for_timeout(800)
        v2 = p16.evaluate("JSON.stringify((S.rod[S.presRid]||{}).vagas)")
        ok(v1 == '{"aberta":true,"max":0}' and v2 == '{"aberta":true,"max":99}', f'CT-KAN-63-13: −5 vira "sem limite" e 5000 vira 99 ({v1}, {v2})')
        # KAN-182-02: lista de minutos
        p16.click('[data-a=drawDlg]'); p16.wait_for_timeout(300); p16.click('#drawGo'); p16.wait_for_timeout(2500)
        p16.click('[data-a=tab][data-v=partida]'); p16.wait_for_selector('#partidaRaiz .board', timeout=8000); p16.wait_for_timeout(300)
        op = p16.evaluate("[...document.querySelectorAll('[data-c=dur] option')].map(o=>o.value)")
        ok(op[:60] == [str(i) for i in range(1, 61)] and op[60:63] == ['70', '80', '90'] and '0' in op and len(op) == 64, f'CT-KAN-182-02: minutos de 1 a 60, 70, 80, 90 e "Sem tempo" ({len(op)} opções)')
        # KAN-181-05: texto do WhatsApp com Time 1 e colete
        p16.click('[data-a=tab][data-v=rodada]'); p16.wait_for_timeout(500)
        p16.click('[data-a=shareTimes]'); p16.wait_for_timeout(400)
        wt = p16.input_value('#shtxt') if p16.locator('#shtxt').count() else ''
        ok('*Time 1* · colete ' in wt and '*Time 2* · colete ' in wt, f'CT-KAN-181-05: "Mandar times no WhatsApp" usa "Time 1 · colete …" ({wt[:60]!r})')
        p16.click('#dlg [data-a=close]'); p16.wait_for_timeout(300)
        # KAN-181-07, 179-06 e 63-12: colete, mínimo e vagas continuam depois de F5 e de sair e entrar de novo
        trocar_colete(p16, '.team [data-a=color][data-v="0"]')
        cor0 = p16.evaluate("(()=>{const r=S.rod[S.presRid];return (r.cores&&r.cores[0]!=null)?r.cores[0]:r.times[0].c})()")
        def estado16():
            r = p16.evaluate("(()=>{const r=S.rod[S.presRid]||{};return [(r.cores&&r.cores[0]!=null)?r.cores[0]:(r.times||[{}])[0].c, JSON.stringify(S.app.cfg.minPos), !!S.app.cfg.vagasCtrl, JSON.stringify(r.vagas)]})()")
            return r
        p16.reload(); p16.wait_for_timeout(1500); p16.click('[data-a=tab][data-v=rodada]'); p16.wait_for_timeout(600)
        e1 = estado16()
        sair(p16)
        try: p16.wait_for_selector('.ld-nav', timeout=8000)
        except Exception: pass
        abrir_entrada(p16, 'entrar')
        p16.fill('#le', 'qa64@teste.com'); p16.fill('#lp', 'Jogo@2026'); p16.keyboard.press('Enter'); p16.wait_for_timeout(1300)
        p16.goto(URL + '#/g/' + gid16); p16.wait_for_timeout(1500); p16.click('[data-a=tab][data-v=rodada]'); p16.wait_for_timeout(800)
        e2 = estado16()
        esperado = [cor0, '{"GOL":2,"_total":14}', True, '{"aberta":true,"max":99}']
        ok(e1 == esperado and e2 == esperado, f'CT-KAN-181-07, CT-KAN-179-06 e CT-KAN-63-12: colete, mínimo e vagas continuam depois de F5 e de sair e entrar ({e2})')
        # KAN-181-08: nome com código num time aparece como texto, na gestão e no link
        jid = p16.evaluate("S.rod[S.presRid].times[0].players[0]")
        p16.evaluate("(id)=>{window.__xss=0}", jid)
        p16.click('[data-a=tab][data-v=jogadores]'); p16.wait_for_timeout(400)
        p16.click(f'[data-a=editPlayer][data-p="{jid}"]'); p16.wait_for_timeout(300)
        p16.fill('#pnm', '<img src=x onerror="window.__xss=1">Zé'); p16.click('[data-a=savePlayer]'); p16.wait_for_timeout(800)
        if p16.locator('#dlg .conf').count(): confirmar_app(p16, True); p16.wait_for_timeout(500)
        p16.click('[data-a=tab][data-v=rodada]'); p16.wait_for_timeout(600)
        pl16.reload(); pl16.wait_for_timeout(1500)
        ok(p16.evaluate("!window.__xss && !document.querySelector('img[src=\"x\"]')") and pl16.evaluate("!window.__xss && !document.querySelector('img[src=\"x\"]')") and '<img' in p16.inner_text('main') and '<img' in pl16.inner_text('main'),
           'CT-KAN-181-08: nome com código no time aparece como texto na gestão e no link, sem executar')
        pl16.close(); ctx16.close()
        # KAN-181-06: duplas continuam "Dupla 1", sem colete
        ctx17 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p17 = ctx17.new_page(); p17.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p17, 'criar')
        p17.fill('#le', 'duplas64@teste.com'); p17.fill('#lp', 'Jogo@2026'); p17.fill('#lp2', 'Jogo@2026'); p17.keyboard.press('Enter'); p17.wait_for_timeout(1300)
        p17.fill('#ngn', 'Praia QA'); p17.click('[data-a=pickSport][data-v=beach_tennis]'); p17.click('[data-a=createGroup]'); p17.wait_for_timeout(1500)
        elenco_e_presenca(p17, 4)
        sortear(p17)
        nd = p17.evaluate("[...document.querySelectorAll('.team .th b')].map(b=>b.textContent)")
        ok(nd[:2] == ['Dupla 1', 'Dupla 2'] and p17.locator('.team [data-a=color]').count() == 0, f'CT-KAN-181-06: em duplas, continua "Dupla 1", sem colete ({nd})')
        # KAN-184-05: depois de falhar, "Tentar de novo" com a internet de volta abre o grupo; KAN-184-06: votação inexistente avisa
        gid17 = p17.evaluate("S.gid")
        pf = ctx17.new_page()
        pf.add_init_script("if(!sessionStorage.getItem('falhou184')){sessionStorage.setItem('falhou184','1');window.__njFalhar={" + json.dumps('grupos/' + gid17) + ":99}}")
        pf.goto(URL + '#/p/' + gid17); pf.wait_for_timeout(9500)
        falhou = pf.locator('#cargaFalhou').count() == 1
        if falhou: pf.click('#cargaFalhou'); pf.wait_for_timeout(2500)
        ok(falhou and pf.locator('.hero-r').count() == 1 and 'Não foi possível' not in pf.inner_text('main'), 'CT-KAN-184-05: depois da falha, "Tentar de novo" com a internet de volta abre o grupo')
        pf.goto(URL + '#/p/' + gid17 + '/v/votacaoQueNaoExiste'); pf.reload(); pf.wait_for_timeout(2000)
        ok('Votação não encontrada' in pf.inner_text('main'), 'CT-KAN-184-06: link de votação que não existe avisa "Votação não encontrada", sem travar')
        ctx17.close()

        # ---------- v65 (KAN-163): relógio de 12h com AM/PM e semana do país num grupo dos EUA; KAN-165: formulário do grupo e login como componentes
        ctx18 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/New_York')
        p18 = ctx18.new_page(); p18.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p18, 'criar')
        ok(p18.evaluate("document.activeElement.id") == 'le' and p18.input_value('#lpais') == 'US' and p18.evaluate("[...document.querySelectorAll('#authRaiz .gbtn svg path')].filter(x=>/^M\\d/.test(x.getAttribute('d'))).length") == 4,
           'CT-KAN-165-01: tela de criar conta como componente: cursor no e-mail, país sugerido pelo fuso (EUA) e o botão do Google com o "G"')
        p18.fill('#le', 'relogio65@teste.com'); p18.fill('#lp', 'Jogo@2026'); p18.fill('#lp2', 'Jogo@2026'); p18.keyboard.press('Enter'); p18.wait_for_timeout(1300)
        p18.wait_for_selector('#ngBox', timeout=5000)
        r1 = '#sched .srow:nth-child(1)'
        ini18, fim18 = f'{r1} [data-hora]:has(.si)', f'{r1} [data-hora]:has(.sf)'
        dias18 = p18.evaluate("[...document.querySelectorAll('#sched .srow .sd option')].map(o=>o.textContent)")
        ok(dias18[:2] == ['Domingo', 'Segunda'], f'CT-KAN-163-07: grupo dos EUA: a lista de dias começa no domingo ({dias18[:2]})')
        ok(p18.locator(f'{r1} .hora[data-doze]').count() == 2 and p18.input_value(f'{ini18} .hh') == '8' and p18.inner_text(f'{ini18} .hap') == 'PM' and p18.input_value(f'{r1} .si') == '20:00',
           'CT-KAN-163-03: o campo do dia fixo dos EUA mostra 8 e PM (gravado 20:00 por dentro)')
        p18.fill(f'{ini18} .hh', '7'); p18.fill(f'{fim18} .hh', '9'); p18.locator(f'{fim18} .hm').focus(); p18.wait_for_timeout(100)
        ok(p18.input_value(f'{r1} .si') == '19:00' and p18.input_value(f'{r1} .sf') == '21:00', f'CT-KAN-163-06: Início 7:00 PM e Término 9:00 PM gravam 19:00 e 21:00 ({p18.input_value(r1 + " .si")}, {p18.input_value(r1 + " .sf")})')
        # KAN-165: outro dia, remover e jogadores por time continuam iguais no componente
        p18.click('#ngBox [data-a=addSched]'); p18.wait_for_timeout(200)
        n2 = p18.locator('#sched .srow').count()
        ok(n2 == 2 and p18.evaluate("document.activeElement.classList.contains('sd')") and p18.input_value('#sched .srow:nth-child(2) .si') == '19:00',
           'CT-KAN-165-02: "Outro dia" copia o horário do anterior e põe o cursor no dia')
        p18.locator('#sched .srow:nth-child(2) [data-a=rmSched]').click(); p18.wait_for_timeout(200)
        p18.locator('#sched .srow:nth-child(1) [data-a=rmSched]').click(); p18.wait_for_timeout(200)
        ok(p18.locator('#sched .srow').count() == 1 and 'pelo menos um dia' in p18.inner_text('#toast') and p18.input_value('#sched .srow .si') == '19:00',
           'CT-KAN-165-02: remover deixa pelo menos um dia, sem perder o horário digitado')
        p18.click("[data-a=pickSport][data-v=volei]"); p18.wait_for_timeout(100)
        pt18 = p18.input_value('#ngt'); p18.click('[data-a=pickFreq][data-v=esporadico]'); p18.wait_for_timeout(100)
        esc18 = p18.locator('#schedW').is_hidden(); p18.click('[data-a=pickFreq][data-v=fixo]'); p18.click('[data-a=pickSport][data-v=futebol]'); p18.wait_for_timeout(100)
        ok(pt18 == '6' and esc18 and p18.input_value('#ngt') == '11' and p18.input_value('#sched .srow .si') == '19:00',
           f'CT-KAN-165-02: esporte e frequência trocam como antes (vôlei 6, futebol 11) e mantêm os dias ({pt18})')
        p18.set_viewport_size({'width': 360, 'height': 780}); p18.wait_for_timeout(200)
        v360 = p18.evaluate("(()=>{const d=document.getElementById('dlgBody');const r=[...document.querySelectorAll('#sched .hap')].map(b=>b.getBoundingClientRect());return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, Math.min(...r.map(x=>Math.min(x.width,x.height))), Math.max(...r.map(x=>x.right))<=innerWidth]})()")
        p18.screenshot(path=f'{OUT}/v65-grupo-eua-360.png')
        ok(v360[0] and v360[1] and v360[2] >= 44 and v360[3], f'CT-KAN-163-12: em 360px, o dia fixo com AM/PM cabe sem rolagem lateral e o botão AM/PM tem 44px ({v360})')
        p18.set_viewport_size({'width': 390, 'height': 844})
        p18.fill('#ngn', 'Pickup 12h'); p18.click('[data-a=createGroup]'); p18.wait_for_timeout(1500)
        g18 = p18.url.split('#/g/')[1]
        fx18 = ((p18.evaluate(LER, 'grupos/' + g18) or {}).get('cfg') or {}).get('fixos') or [{}]
        ok(fx18[0].get('ini') == '19:00' and fx18[0].get('fim') == '21:00', f'CT-KAN-163-06: o banco guarda 19:00 e 21:00 ({fx18[0]})')
        hero18 = p18.inner_text('.hero-r') if p18.locator('.hero-r').count() else p18.inner_text('main')
        ok('7:00–9:00 PM' in hero18 and '19:00' not in hero18, f'CT-KAN-163-01: a rodada do grupo dos EUA mostra 7:00–9:00 PM ({hero18[:80]!r})')
        p18.click('[data-a=tab][data-v=grupo]'); p18.wait_for_timeout(400)
        ok('7:00–9:00 PM' in p18.inner_text('main'), 'CT-KAN-163-06: a aba Grupo mostra o dia fixo em 7:00–9:00 PM')
        p18.click('[data-a=tab][data-v=rodada]'); p18.wait_for_timeout(400)
        # Campo da Nova rodada: AM/PM, setas que viram o dia e digitação estranha (CT-KAN-163-03 a 05)
        p18.click('[data-a=newRod]'); p18.wait_for_timeout(300)
        hi = '#dlg [data-hora]:has(#rtm)'
        ok(p18.locator(hi + ' .hap').count() == 1 and p18.input_value(hi + ' .hh') == str(int(p18.input_value('#rtm')[:2]) % 12 or 12) and p18.inner_text(hi + ' .hap') == ('PM' if int(p18.input_value('#rtm')[:2]) >= 12 else 'AM'),
           f'CT-KAN-163-03: Nova rodada no grupo dos EUA: hora de 1 a 12 com AM/PM ({p18.input_value("#rtm")})')
        p18.fill(hi + ' .hh', '11'); p18.fill(hi + ' .hm', '15')
        if p18.inner_text(hi + ' .hap') != 'AM': p18.click(hi + ' .hap'); p18.wait_for_timeout(100)
        p18.click(hi + ' [data-hseta="+h"]'); p18.wait_for_timeout(100)
        a2 = (p18.input_value(hi + ' .hh'), p18.inner_text(hi + ' .hap'), p18.input_value('#rtm'))
        ok(a2 == ('12', 'PM', '12:15'), f'CT-KAN-163-04: ▲ em 11 AM vira 12 PM ({a2})')
        p18.fill(hi + ' .hh', '11')
        if p18.inner_text(hi + ' .hap') != 'PM': p18.click(hi + ' .hap'); p18.wait_for_timeout(100)
        p18.click(hi + ' [data-hseta="+h"]'); p18.wait_for_timeout(100)
        a1 = (p18.input_value(hi + ' .hh'), p18.inner_text(hi + ' .hap'), p18.input_value('#rtm'))
        ok(a1 == ('12', 'AM', '00:15'), f'CT-KAN-163-04: ▲ em 11 PM vira 12 AM (vira o dia certo) ({a1})')
        p18.fill(hi + ' .hm', '59'); p18.click(hi + ' [data-hseta="+m"]'); p18.wait_for_timeout(100)
        ok(p18.input_value(hi + ' .hm') == '00', 'CT-KAN-163-04: ▲ nos minutos em 59 volta a 00')
        p18.fill(hi + ' .hh', '13'); h13 = p18.input_value(hi + ' .hh')
        p18.fill(hi + ' .hh', '0'); p18.locator(hi + ' .hm').focus(); p18.wait_for_timeout(100); h0 = p18.input_value(hi + ' .hh')
        p18.fill(hi + ' .hm', 'ab'); mab = p18.input_value(hi + ' .hm')
        ok(h13 == '12' and h0 == '12' and mab == '', f'CT-KAN-163-05: hora fica entre 1 e 12 (13 → {h13}, 0 → {h0}) e letras não entram ({mab!r})')
        p18.fill(hi + ' .hh', '8'); p18.fill(hi + ' .hm', '15')
        if p18.inner_text(hi + ' .hap') != 'PM': p18.click(hi + ' .hap'); p18.wait_for_timeout(100)
        hb18 = p18.evaluate("(()=>{const r=document.querySelector('#dlg .hap').getBoundingClientRect();return Math.min(r.width,r.height)})()")
        ok(p18.input_value('#rtm') == '20:15' and hb18 >= 44, f'CT-KAN-163-03: 8:15 PM grava 20:15 e o botão AM/PM tem 44px ({p18.input_value("#rtm")}, {hb18:.0f}px)')
        p18.locator(hi + ' .hap').focus(); p18.keyboard.press('Enter'); p18.wait_for_timeout(100)
        tecl = p18.input_value('#rtm'); p18.keyboard.press('Space'); p18.wait_for_timeout(100)
        ok(tecl == '08:15' and p18.input_value('#rtm') == '20:15', f'CT-KAN-163-03: o botão AM/PM também troca pelo teclado ({tecl})')
        p18.fill('#rdt', '2031-05-10'); p18.click('#dlg [data-a=saveRod]'); p18.wait_for_timeout(900)
        rods18 = p18.evaluate("Object.values(S.rod||{}).map(r=>r.time)")
        ok('20:15' in rods18, f'CT-KAN-163-03: a rodada nova fica gravada em 20:15 ({rods18})')
        # Jogo que passa da meia-noite (KAN-111) mostra os dois períodos
        p18.click('[data-a=newRod]'); p18.wait_for_timeout(300)
        p18.fill('#rdt', '2031-05-17'); p18.fill(hi + ' .hh', '11'); p18.fill(hi + ' .hm', '00')
        if p18.inner_text(hi + ' .hap') != 'PM': p18.click(hi + ' .hap')
        tf = '#dlg [data-hora]:has(#rfm)'
        p18.fill(tf + ' .hh', '1'); p18.fill(tf + ' .hm', '00')
        if p18.inner_text(tf + ' .hap') != 'AM': p18.click(tf + ' .hap')
        p18.wait_for_timeout(100)
        ok(p18.input_value('#rtm') == '23:00' and p18.input_value('#rfm') == '01:00', f'CT-KAN-163-11: 11:00 PM–1:00 AM grava 23:00 e 01:00 ({p18.input_value("#rtm")}, {p18.input_value("#rfm")})')
        p18.click('#dlg [data-a=saveRod]'); p18.wait_for_timeout(900)
        pv = ctx18.new_page(); pv.on('pageerror', lambda e: errs.append(str(e)))
        pv.goto(URL + '#/p/' + g18); pv.wait_for_selector('.hero-r', timeout=8000); pv.wait_for_timeout(500)
        pub18 = pv.inner_text('.hero-r')
        ok(re.search(r'\d{1,2}:\d{2}(–\d{1,2}:\d{2})? (AM|PM)', pub18) and not re.search(r'\b(1[3-9]|2[0-3]):\d{2}', pub18), f'CT-KAN-163-10: o link do jogador do grupo dos EUA mostra o horário em 12h ({pub18[:80]!r})')
        pv.close()
        # Convite do WhatsApp dos dias fixos (Rodada > Link permanente)
        p18.click('[data-a=tab][data-v=rodada]'); p18.wait_for_timeout(400)
        if p18.locator('[data-a=shareFixo]').count():
            p18.click('[data-a=shareFixo]'); p18.wait_for_timeout(400)
            zap18 = p18.input_value('#shtxt')
            ok('7:00 PM' in zap18 and '9:00 PM' in zap18 and '19:00' not in zap18, f'CT-KAN-163-01: o convite do WhatsApp mostra 7:00 PM até 9:00 PM ({zap18[:120]!r})')
            p18.click('#dlg [data-a=close]'); p18.wait_for_timeout(200)
        else:
            ok(False, 'CT-KAN-163-01: botão do convite dos dias fixos não encontrado na aba Rodada')
        p18.click('[data-a=tab][data-v=grupo]'); p18.wait_for_timeout(400)
        # Troca de país: o mesmo horário gravado passa a aparecer em 24h, sem mudar o banco (CT-KAN-163-09) e Brasil sem AM/PM (CT-KAN-163-08)
        p18.click('[data-a=editGroup]'); p18.wait_for_timeout(400)
        p18.select_option('#ngp', 'BR'); p18.wait_for_timeout(100)
        ok(p18.input_value('#ngm') == 'BRL' and p18.input_value('#ngz') == 'America/Sao_Paulo', 'CT-KAN-165-03: no componente, trocar o país do grupo troca a moeda e o fuso')
        p18.click('#dlg [data-a=saveGroup]'); p18.wait_for_timeout(300)
        if p18.locator('#dlg .conf').count(): confirmar_app(p18, True)
        p18.wait_for_timeout(900)
        fx18b = ((p18.evaluate(LER, 'grupos/' + g18) or {}).get('cfg') or {}).get('fixos') or [{}]
        grupo18 = p18.inner_text('main')
        ok('19:00–21:00' in grupo18 and 'PM' not in grupo18 and fx18b[0].get('ini') == '19:00', f'CT-KAN-163-09: grupo trocado para o Brasil mostra 19:00–21:00 e o gravado não muda ({fx18b[0].get("ini")})')
        p18.click('[data-a=editGroup]'); p18.wait_for_timeout(400)
        ok(p18.locator('#dlg .hap').count() == 0 and p18.input_value('#sched .srow .hh') == '19' and p18.evaluate("[...document.querySelectorAll('#sched .srow .sd option')][0].textContent") == 'Domingo',
           'CT-KAN-163-08: grupo do Brasil: campo em 24h (19), sem AM/PM, semana no domingo, como antes')
        p18.click('#dlg [data-a=close]'); p18.wait_for_timeout(200)
        if p18.locator('#dlg .conf').count(): confirmar_app(p18, True)
        contraste(p18, 'aba Grupo depois do formulário em componente (v65)')
        # Persistência na mesma sessão: Sair e entrar de novo (CT-KAN-163-06)
        p18.goto(URL + '#/'); p18.wait_for_timeout(800)
        sair(p18); p18.wait_for_timeout(1500); abrir_entrada(p18, 'entrar')
        ok(p18.locator('#authRaiz #le').count() == 1, 'CT-KAN-165-01: depois de sair, a tela de entrar (componente) aparece')
        p18.click('#authRaiz [data-a=authMode][data-v=login]'); p18.wait_for_timeout(300)
        p18.fill('#le', 'relogio65@teste.com'); p18.fill('#lp', 'Jogo@2026'); p18.keyboard.press('Enter'); p18.wait_for_timeout(1500)
        ok(p18.evaluate("!!(S.user&&!S.user.anon)"), 'CT-KAN-165-01: Enter na tela de entrar (componente) entra na conta')
        ctx18.close()

        # ---------- v66 (KAN-186): trocar o país no formulário do grupo já troca o relógio e a semana; KAN-187: Criar conta diz por que o botão está desligado
        ctx19 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/New_York')
        p19 = ctx19.new_page(); p19.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p19, 'criar')
        p19.fill('#le', 'ana@clube'); p19.fill('#lp', 'Jogo@2026'); p19.fill('#lp2', 'Jogo@2026'); p19.wait_for_timeout(100)
        m187 = p19.inner_text('#lerr')
        ok(p19.locator('#sgBtn').is_disabled() and 'terminação' in m187, f'CT-KAN-187-01: e-mail sem terminação com a senha certa: o botão fica desligado e o motivo aparece ({m187!r})')
        p19.fill('#le', ''); p19.locator('#lp2').focus(); p19.keyboard.press('Enter'); p19.wait_for_timeout(100)
        m187b = p19.inner_text('#lerr')
        ok('Digite seu e-mail' in m187b, f'CT-KAN-187-02: Enter com o botão desligado diz o que falta ({m187b!r})')
        p19.fill('#le', 'ana@clube.com'); p19.wait_for_timeout(100)
        ok(not p19.locator('#sgBtn').is_disabled() and p19.inner_text('#lerr') == '', 'CT-KAN-187-03: com o e-mail completo, o aviso some e o botão liga')
        p19.keyboard.press('Enter'); p19.wait_for_selector('#ngBox', timeout=5000)
        r19 = '#sched .srow:nth-child(1)'
        # KAN-220: espera o relógio de 12h (vem do país da conta, que chega logo depois) antes de digitar a hora.
        p19.wait_for_function("document.querySelectorAll('#sched .srow:nth-child(1) .hap').length === 2", timeout=8000); p19.wait_for_timeout(300)
        p19.fill(f'{r19} [data-hora]:has(.si) .hh', '7'); p19.fill('#sched .srow:nth-child(1) .sl', 'Quadra 1')
        ok(p19.locator(f'{r19} .hap').count() == 2 and p19.input_value(f'{r19} .si') == '19:00', 'CT-KAN-186-01: conta dos EUA abre o Novo grupo em 12h (7 PM = 19:00)')
        p19.select_option('#ngp', 'DE'); p19.wait_for_function("document.querySelectorAll('#sched .srow:nth-child(1) .hap').length === 0", timeout=5000)
        d19 = (p19.locator(f'{r19} .hap').count(), p19.input_value(f'{r19} [data-hora]:has(.si) .hh'), p19.input_value(f'{r19} .si'),
               p19.evaluate("document.querySelector('#sched .srow .sd option').textContent"), p19.input_value(f'{r19} .sl'))
        ok(d19 == (0, '19', '19:00', 'Segunda', 'Quadra 1'), f'CT-KAN-186-01: trocar para Alemanha passa na hora para 24h e semana na segunda, sem perder o horário e o local ({d19})')
        p19.select_option('#ngp', 'US'); p19.wait_for_function("document.querySelectorAll('#sched .srow:nth-child(1) .hap').length === 2", timeout=5000)
        d19b = (p19.locator(f'{r19} .hap').count(), p19.input_value(f'{r19} [data-hora]:has(.si) .hh'), p19.input_value(f'{r19} .si'),
                p19.evaluate("document.querySelector('#sched .srow .sd option').textContent"))
        ok(d19b == (2, '7', '19:00', 'Domingo'), f'CT-KAN-186-02: voltar para os EUA volta para 12h e semana no domingo ({d19b})')
        p19.select_option('#ngp', 'DE'); p19.fill('#ngn', 'Berlin FC'); p19.click('[data-a=createGroup]'); p19.wait_for_function("location.hash.startsWith('#/g/')", timeout=8000)
        g19 = p19.url.split('#/g/')[1]
        fx19 = ((p19.evaluate(LER, 'grupos/' + g19) or {}).get('cfg') or {}).get('fixos') or [{}]
        ok(fx19[0].get('ini') == '19:00' and fx19[0].get('place') == 'Quadra 1', f'CT-KAN-186-03: o grupo é criado com o horário e o local digitados ({fx19[0]})')
        ctx19.close()

        # ---------- v67 (KAN-192): termos do esporte na aba Partida; KAN-193: seções recolhíveis com o cartão inteiro tocável; KAN-106: caixa só com a janela recente
        ctx20 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p20 = ctx20.new_page(); p20.on('pageerror', lambda e: errs.append(str(e)))
        p20.set_viewport_size({'width': 360, 'height': 740}); p20.goto(URL); p20.wait_for_timeout(900)
        ld193 = p20.evaluate("(()=>{const t=document.querySelector('.ld-nav [data-a=themeMenu]').getBoundingClientRect();const f=[...document.querySelectorAll('.ld-faq summary')].map(s=>s.getBoundingClientRect().height);return [Math.round(t.width),Math.round(t.height),Math.min(...f),document.documentElement.scrollWidth<=innerWidth]})()")
        ok(ld193[0] >= 36 and ld193[1] >= 36 and ld193[2] >= 43.5 and ld193[3], f'CT-KAN-193-04: apresentação em 360px: tema com 36px ou mais e perguntas com 44px, sem rolagem lateral ({ld193})')
        p20.set_viewport_size({'width': 390, 'height': 844})
        abrir_entrada(p20, 'criar')
        ini193 = p20.evaluate("(()=>{const a=[...document.querySelectorAll('a.chip')].find(x=>x.textContent.includes('Início'));return a?a.getBoundingClientRect().height:0})()")
        ok(ini193 >= 36, f'CT-KAN-193-03: "← Início" no Criar conta com 36px ou mais ({ini193:.0f}px)')
        entrar193 = p20.evaluate("(()=>{const b=document.querySelector('#authRaiz [data-a=authMode][data-v=login].linkbtn');const r=b.getBoundingClientRect();return r.height})()")
        ok(entrar193 >= 43.5, f'CT-KAN-193-03: "Entrar" no Criar conta tem 44px de área de toque ({entrar193:.0f}px)')
        p20.fill('#le', 'v67@teste.com'); p20.fill('#lp', 'Jogo@2026'); p20.fill('#lp2', 'Jogo@2026'); p20.keyboard.press('Enter'); p20.wait_for_timeout(1300)
        p20.fill('#ngn', 'Praia 67'); p20.click('[data-a=pickSport][data-v=beach_tennis]'); p20.click('[data-a=createGroup]'); p20.wait_for_timeout(1500)
        g20 = p20.url.split('#/g/')[1]
        elenco_e_presenca(p20, 8)
        sortear(p20)
        p20.click('[data-a=tab][data-v=partida]'); p20.wait_for_timeout(1200)
        t20 = p20.inner_text('main')
        ok('Dupla A' in t20 and 'Dupla B' in t20 and 'Time A' not in t20, f'CT-KAN-192-01: em duplas, os combos dizem Dupla A e Dupla B ({t20[:60]!r})')
        ok(p20.locator('[data-a=abrirEscalacao]').count() == 0 and 'Escalação' not in t20 and 'Artilharia' not in t20 and not re.search(r'\bGols?\b', t20),
           'CT-KAN-192-01: em duplas, sem Escalação, sem Artilharia e sem Gol')
        ok('Pontos da rodada' in t20, 'CT-KAN-192-01: em duplas, o painel se chama "Pontos da rodada" (decisão do Kleber, 27/10)')
        p20.set_viewport_size({'width': 360, 'height': 740}); p20.wait_for_timeout(200)
        ok(p20.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-192-05: aba Partida em duplas sem rolagem lateral em 360px')
        contraste(p20, 'aba Partida em duplas (v67)')
        p20.set_viewport_size({'width': 390, 'height': 844})
        # Link do jogador: "Ver times" e "ver nomes" abrem tocando em qualquer ponto do cartão (KAN-193)
        pl20 = ctx20.new_page(); pl20.on('pageerror', lambda e: errs.append(str(e)))
        pl20.goto(URL + '#/p/' + g20); pl20.wait_for_selector('.hero-r', timeout=8000); pl20.wait_for_timeout(600)
        alt = pl20.evaluate("[...document.querySelectorAll('details > summary')].filter(s=>s.offsetParent).map(s=>Math.round(s.getBoundingClientRect().height))")
        ok(alt and min(alt) >= 44, f'CT-KAN-193-02: seções recolhíveis do link com 44px ou mais ({alt})')
        vt = pl20.locator('details.panel').first  # com a lista fechada depois do sorteio, o cartão é "Lista fechada · ver lista"
        vt.scroll_into_view_if_needed(); pl20.wait_for_timeout(150)
        bx = vt.bounding_box()
        pl20.mouse.click(bx['x'] + bx['width'] - 6, bx['y'] + bx['height'] - 6); pl20.wait_for_timeout(200)
        aberto193 = vt.evaluate('d=>d.open')
        pl20.mouse.click(bx['x'] + bx['width'] - 6, bx['y'] + 10); pl20.wait_for_timeout(200)
        ok(aberto193 and not vt.evaluate('d=>d.open'), 'CT-KAN-193-01: tocar na margem do cartão recolhível do link abre; tocar de novo fecha')
        vt.locator('summary').focus(); pl20.keyboard.press('Enter'); pl20.wait_for_timeout(150)
        foco193 = pl20.evaluate("(()=>{const s=document.activeElement;return s.tagName==='SUMMARY'&&getComputedStyle(s).outlineStyle!=='none'})()")
        ok(vt.evaluate('d=>d.open') and foco193, 'CT-KAN-193-05: pelo teclado, Enter abre a seção e o foco aparece na linha')
        pl20.close()
        # Basquete: "Cestinhas da rodada" (KAN-192-02)
        p20.click('[data-a=groupsDlg]'); p20.wait_for_timeout(300); p20.click('#dlg [data-a=newGroup]'); p20.wait_for_timeout(300)
        p20.fill('#ngn', 'Basquete 67'); p20.click('[data-a=pickSport][data-v=basquete]'); p20.click('[data-a=createGroup]'); p20.wait_for_timeout(1500)
        elenco_e_presenca(p20, 10); sortear(p20)
        p20.click('[data-a=tab][data-v=partida]'); p20.wait_for_timeout(1200)
        tb20 = p20.inner_text('main')
        ok('Cestinhas da rodada' in tb20 and 'Artilharia' not in tb20 and 'Time A' in tb20 and p20.locator('[data-a=abrirEscalacao]').count() == 2,
           'CT-KAN-192-02: basquete mostra "Cestinhas da rodada", com Time A, Time B e Escalação')
        p20.click('[data-a=abrirArtilharia]'); p20.wait_for_timeout(300)
        ok('Salvar cestinhas' in p20.inner_text('#dlg'), 'CT-KAN-192-02: o botão de salvar acompanha o nome ("Salvar cestinhas")')
        p20.click('#dlg [data-a=close]'); p20.wait_for_timeout(200)
        if p20.locator('#dlg .conf').count(): confirmar_app(p20, True)
        # Caixa (KAN-106): lançamento de 1 ano atrás entra no saldo pela ficha do mês, mas não é carregado
        p20.click('[data-a=tab][data-v=caixa]'); p20.wait_for_timeout(600)
        antigo = p20.evaluate("(()=>{const d=new Date();d.setFullYear(d.getFullYear()-1);return d.toISOString().slice(0,10)})()")
        p20.click('[data-a=addLan]'); p20.wait_for_timeout(300); p20.select_option('#lk', 'entrada'); p20.fill('#lv', '37'); p20.fill('#ld', antigo)
        p20.click('#dlg [data-a=saveLan]'); p20.wait_for_timeout(800)
        p20.click('[data-a=addLan]'); p20.wait_for_timeout(300); p20.select_option('#lk', 'entrada'); p20.fill('#lv', '5')
        p20.click('#dlg [data-a=saveLan]'); p20.wait_for_timeout(800)
        p20.reload(); p20.wait_for_timeout(1500); p20.click('[data-a=tab][data-v=caixa]'); p20.wait_for_timeout(1200)
        sal106 = p20.locator('.kpis .money').first.inner_text()
        carregou = p20.evaluate("(a)=>Object.values(S.caixa||{}).some(l=>l.d===a)", antigo)
        ok('42,00' in sal106 and not carregou, f'CT-KAN-106-01: o saldo soma o lançamento antigo pela ficha do mês (R$ 42,00), sem carregar o lançamento ({sal106!r}, carregado: {carregou})')
        ok(p20.locator('#caixaRaiz select[data-c=month] option[value="' + antigo[:7] + '"]').count() == 1, 'CT-KAN-106-02: o mês antigo continua no seletor de meses')
        p20.select_option('#caixaRaiz select[data-c=month]', antigo[:7]); p20.wait_for_timeout(1200)
        lista106 = p20.inner_text('#caixaRaiz')
        ok('37,00' in lista106 and p20.evaluate("(a)=>Object.values(S.caixa||{}).some(l=>l.d===a)", antigo), 'CT-KAN-106-03: escolhendo o mês antigo, o lançamento dele aparece (a janela acompanha o mês)')
        ctx20.close()

        # ---------- v68 (KAN-200): quem mais joga junto com o número de vezes e "Ver todos"
        ctx21 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p21 = ctx21.new_page(); p21.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p21, 'criar')
        p21.fill('#le', 'juntos68@teste.com'); p21.fill('#lp', 'Jogo@2026'); p21.fill('#lp2', 'Jogo@2026'); p21.keyboard.press('Enter'); p21.wait_for_timeout(1300)
        p21.fill('#ngn', 'Juntos FC'); p21.click('[data-a=pickSport][data-v=futebol]'); p21.click('[data-a=createGroup]'); p21.wait_for_timeout(1500)
        g21 = p21.url.split('#/g/')[1]
        p21.click('[data-a=tab][data-v=jogadores]'); p21.wait_for_timeout(300)
        ok('Aparece depois dos primeiros sorteios' in p21.inner_text('#juntos'), 'CT-KAN-200-03: sem sorteio, aparece "Aparece depois dos primeiros sorteios."')
        p21.click('[data-a=seed]'); p21.wait_for_timeout(1500)
        ids21 = p21.evaluate("Object.keys(S.jog).sort()")
        a1, a2 = ids21[0], ids21[1]
        rods21 = {}
        for i, d in enumerate(['2026-09-01', '2026-09-08', '2026-09-15']):
            rods21[f'grupos/{g21}/rodadas/rj{i}'] = {'date': d, 'locked': True, 'times': [{'players': [a1, a2] + ids21[2 + i * 2:4 + i * 2], 'c': 0}, {'players': ids21[8:12], 'c': 1}]}
        p21.evaluate(PUT, rods21); p21.reload(); p21.wait_for_timeout(1500)
        p21.click('[data-a=tab][data-v=jogadores]'); p21.wait_for_timeout(1000)
        j21 = p21.inner_text('#juntos')
        nomes21 = p21.evaluate("(ids)=>ids.map(i=>S.jog[i].name)", [a1, a2])
        primeira = p21.locator('#juntos ol.juntos li').first.inner_text()
        ok(nomes21[0] in primeira and nomes21[1] in primeira and '3 vezes' in primeira, f'CT-KAN-200-01: o par que jogou junto 3 vezes aparece primeiro, com "3 vezes" ({primeira!r})')
        ok('últimas 3 rodadas' in j21, f'CT-KAN-200-01: a ajuda diz quantas rodadas entraram na conta ({j21[:120]!r})')
        ok(p21.locator('#juntos summary', has_text='Ver todos').count() == 1, 'CT-KAN-200-02: com mais de 6 pares, aparece "Ver todos (N pares)"')
        p21.click('#juntos summary'); p21.wait_for_timeout(200)
        tot = p21.locator('#juntos ol.juntos li').count()
        ok(tot > 6 and p21.locator('#juntos ol.juntos li').last.inner_text().endswith('1 vez'), f'CT-KAN-200-02: "Ver todos" mostra todos os pares, do mais frequente ao menos ({tot})')
        p21.set_viewport_size({'width': 360, 'height': 740}); p21.wait_for_timeout(200)
        ok(p21.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-200-04: Quem mais joga junto sem rolagem lateral em 360px')
        p21.locator('#juntos').screenshot(path=f'{OUT}/v68-juntos-360.png')
        contraste(p21, 'Quem mais joga junto (v68)')
        ctx21.close()

        # ---------- v69 (KAN-201): permissões dos administradores convidados
        ctx22 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p22 = ctx22.new_page(); p22.on('pageerror', lambda e: errs.append(str(e)))
        def entrar22(email, criar=False):
            p22.goto(URL + ('#/criar' if criar else '#/entrar')); p22.wait_for_timeout(900)
            if not criar and p22.locator('#authRaiz [data-a=authMode][data-v=login]').count():
                p22.click('#authRaiz [data-a=authMode][data-v=login]'); p22.wait_for_timeout(200)
            p22.fill('#le', email); p22.fill('#lp', 'Jogo@2026')
            if criar: p22.fill('#lp2', 'Jogo@2026')
            p22.keyboard.press('Enter'); p22.wait_for_timeout(1400)
        entrar22('dono69@teste.com', True)
        p22.fill('#ngn', 'Permissões FC'); p22.click('[data-a=pickSport][data-v=futebol]'); p22.click('[data-a=createGroup]'); p22.wait_for_timeout(1500)
        g22 = p22.url.split('#/g/')[1]
        p22.click('[data-a=tab][data-v=jogadores]'); p22.wait_for_timeout(300); p22.click('[data-a=seed]'); p22.wait_for_timeout(1500)
        p22.evaluate(PUT, {f'grupos/{g22}/privado/contatos': {'x1': {'tel': '+5511999999999', 'email': ''}}}); p22.reload(); p22.wait_for_timeout(1500)
        p22.click('[data-a=tab][data-v=grupo]'); p22.wait_for_timeout(400)
        ok(p22.locator('#grupoRaiz [data-a=editGroup]').count() == 1 and p22.locator('#grupoRaiz .theme-seg').count() == 1, 'CT-KAN-201-10: aba Grupo (agora componente) mostra Editar grupo e Aparência para o organizador')
        p22.click('[data-a=inviteLink]'); p22.wait_for_timeout(500); tok22 = p22.evaluate("S.convite&&S.convite.token"); p22.click('#dlg [data-a=close]'); p22.wait_for_timeout(200)
        sair(p22); p22.wait_for_timeout(1500)
        p22.goto(URL + '#/convite/' + g22 + '/' + str(tok22)); p22.wait_for_timeout(1200)
        if p22.locator('#authRaiz [data-a=authMode][data-v=signup]').count():
            p22.click('#authRaiz [data-a=authMode][data-v=signup]'); p22.wait_for_timeout(200)
        p22.fill('#le', 'convidado69@teste.com'); p22.fill('#lp', 'Jogo@2026')
        if p22.locator('#lp2').count(): p22.fill('#lp2', 'Jogo@2026')
        p22.keyboard.press('Enter'); p22.wait_for_timeout(1500)
        p22.click('[data-a=acceptInv]'); p22.wait_for_timeout(1800)
        conv22 = p22.evaluate("S.user&&S.user.uid")
        perm22 = p22.evaluate("S.mem&&S.mem.perm")
        ok(perm22 == {'caixa': False, 'notas': False, 'elenco': False, 'config': False}, f'CT-KAN-201-01: convidado novo entra só com o dia a dia ({perm22})')
        # KAN-258 (pelada-v104): o código do convite fica em convites/{uid} (ninguém lê), não no cadastro.
        m258 = p22.evaluate(LER, f'grupos/{g22}/membros/{conv22}') or {}
        c258 = p22.evaluate(LER, f'grupos/{g22}/convites/{conv22}') or {}
        ok('token' not in m258 and c258.get('token') == tok22 and not p22.evaluate("Object.values(S.membros||{}).some(m=>m&&m.token)"),
           f'CT-KAN-258-01: o cadastro do convidado não guarda o código do convite; ele vai para convites/{{uid}} ({sorted(m258)})')
        # Cadastro antigo com o código: o próprio convidado tira, ao abrir a gestão
        p22.evaluate(PUT, {f'grupos/{g22}/membros/{conv22}': {**m258, 'token': tok22}}); p22.reload(); p22.wait_for_timeout(1800)
        ok('token' not in (p22.evaluate(LER, f'grupos/{g22}/membros/{conv22}') or {'token': 1}), 'CT-KAN-258-02: cadastro antigo com o código: o app tira o código ao abrir')
        abas22 = p22.evaluate("[...document.querySelectorAll('[data-a=tab]')].map(b=>b.dataset.v)")
        ok('caixa' not in abas22 and 'rodada' in abas22 and 'partida' in abas22, f'CT-KAN-201-02: sem a permissão de caixa, a aba Caixa não aparece ({abas22})')
        ok(p22.evaluate("S.pc===null&&Object.keys(S.cont||{}).length===0"), 'CT-KAN-201-02: sem caixa e sem elenco, caixa e contatos nem chegam ao aparelho')
        ok(p22.locator('[data-a=abrirMinimos]').count() == 0, 'CT-KAN-201-07: sem configurações, "Definir mínimo" não aparece na Rodada')
        p22.click('[data-a=tab][data-v=jogadores]'); p22.wait_for_timeout(600)
        jt22 = p22.inner_text('main')
        ok(p22.locator('main .lvl-tag').count() == 0 and 'Não colocar' not in jt22, 'CT-KAN-201-03: sem a permissão de notas, notas e pares separados não aparecem')
        ok(p22.locator('[data-a=addPlayer],[data-a=importarDlg],[data-a=editPlayer],[data-a=promote]').count() == 0, 'CT-KAN-201-04: sem a permissão de elenco, não aparece adicionar, importar nem editar jogador')
        ok('Mensalista' not in jt22 and 'Diarista' not in jt22, 'CT-KAN-201-02: sem caixa, o tipo do jogador (mensalista, diarista) não aparece')
        ordens22 = p22.evaluate("[...document.querySelectorAll('[data-c=ordemJog] option')].map(o=>o.value)")
        ok('nota' not in ordens22 and 'tipo' not in ordens22, f'CT-KAN-201-03: ordenar por nota ou tipo some sem as permissões ({ordens22})')
        ok(p22.evaluate("!!S.rat&&Object.keys(S.rat.nivel||{}).length>0"), 'CT-KAN-201-05: as notas continuam chegando para o sorteio equilibrar (escondidas na tela)')
        p22.click('[data-a=tab][data-v=grupo]'); p22.wait_for_timeout(400)
        gt22 = p22.inner_text('#grupoRaiz')
        ok(p22.locator('#grupoRaiz [data-a=editGroup],#grupoRaiz [data-a=settings],#grupoRaiz [data-a=inviteLink],#grupoRaiz [data-a=addPos],#grupoRaiz [data-a=dupGroup],#grupoRaiz [data-a=abrirPerm],#grupoRaiz [data-a=rmMember]').count() == 0,
           'CT-KAN-201-06: sem configurações, a aba Grupo não mostra editar, convidar, posições, duplicar, remover nem Permissões')
        ok('Só o dia a dia' in gt22 and 'mensalidade' not in gt22, 'CT-KAN-201-06: o convidado vê que tem "Só o dia a dia" e não vê valores do caixa')
        p22.screenshot(path=f'{OUT}/v69-grupo-convidado.png')
        # O organizador libera Caixa e Notas
        sair(p22); p22.wait_for_timeout(1500)
        entrar22('dono69@teste.com')
        p22.goto(URL + '#/g/' + g22); p22.wait_for_timeout(1200); p22.click('[data-a=tab][data-v=grupo]'); p22.wait_for_timeout(500)
        ok(p22.locator(f'#grupoRaiz [data-a=abrirPerm][data-v="{conv22}"]').count() == 1, 'CT-KAN-201-08: o organizador vê "Permissões" ao lado do convidado')
        p22.click(f'#grupoRaiz [data-a=abrirPerm][data-v="{conv22}"]'); p22.wait_for_timeout(400)
        marc22 = p22.evaluate("['caixa','notas','elenco','config'].map(k=>document.getElementById('perm_'+k).checked)")
        ok(marc22 == [False, False, False, False], f'CT-KAN-201-08: a janela abre com o que o convidado pode hoje ({marc22})')
        p22.set_viewport_size({'width': 360, 'height': 740}); p22.wait_for_timeout(200)
        ok(p22.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-201-09: janela de Permissões sem rolagem lateral em 360px')
        p22.screenshot(path=f'{OUT}/v69-permissoes-360.png'); contraste(p22, 'Permissões (v69)')
        p22.set_viewport_size({'width': 390, 'height': 844})
        p22.check('#perm_caixa'); p22.check('#perm_notas'); p22.click('#dlg [data-a=salvarPerm]'); p22.wait_for_timeout(900)
        ok(p22.evaluate("(u)=>JSON.stringify(S.membros[u].perm)", conv22) == '{"caixa":true,"notas":true,"elenco":false,"config":false}', 'CT-KAN-201-08: Salvar permissões grava só as quatro chaves')
        ok('Dia a dia, caixa e notas' in p22.inner_text('#adminsPainel'), 'CT-KAN-201-08: a lista mostra o resumo "Dia a dia, caixa e notas"')
        sair(p22); p22.wait_for_timeout(1500)
        entrar22('convidado69@teste.com')
        p22.goto(URL + '#/g/' + g22); p22.wait_for_timeout(1500)
        abas22b = p22.evaluate("[...document.querySelectorAll('[data-a=tab]')].map(b=>b.dataset.v)")
        p22.click('[data-a=tab][data-v=jogadores]'); p22.wait_for_timeout(600)
        ok('caixa' in abas22b and p22.locator('main .lvl-tag').count() > 0 and p22.locator('[data-a=addPlayer]').count() == 0,
           f'CT-KAN-201-08: com Caixa e Notas liberadas, aparecem a aba Caixa e as notas; elenco continua fechado ({abas22b})')
        # Administrador de antes da v69 (sem permissões gravadas) continua com tudo
        p22.evaluate(PUT, {f'grupos/{g22}/membros/{conv22}': {'uid': conv22, 'role': 'admin', 'email': 'convidado69@teste.com'}}); p22.reload(); p22.wait_for_timeout(1500)
        p22.click('[data-a=tab][data-v=jogadores]'); p22.wait_for_timeout(600)
        ok(p22.locator('[data-a=addPlayer]').count() == 1 and p22.locator('main .lvl-tag').count() > 0, 'CT-KAN-201-11: administrador de antes (sem permissões gravadas) continua podendo tudo')
        ctx22.close()

    if parte('c'):
        # ---------- v70 (KAN-119): planos no app (transição, Grátis com cadeados, teste grátis, limite de grupos)
        ctx23 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p23 = ctx23.new_page(); p23.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p23, 'criar')
        p23.fill('#le', 'planos70@teste.com'); p23.fill('#lp', 'Jogo@2026'); p23.fill('#lp2', 'Jogo@2026'); p23.keyboard.press('Enter'); p23.wait_for_timeout(1400)
        p23.fill('#ngn', 'Planos FC'); p23.click('[data-a=pickSport][data-v=futebol]'); p23.click('[data-a=createGroup]'); p23.wait_for_timeout(1600)
        g23 = p23.url.split('#/g/')[1]
        u23 = p23.evaluate("S.user.uid")
        p23.click('[data-a=tab][data-v=jogadores]'); p23.wait_for_timeout(300); p23.click('[data-a=seed]'); p23.wait_for_timeout(1500)
        conta23 = p23.evaluate(LER, f'contas/{u23}') or {}
        ok(conta23.get('ativos') == [g23], f'CT-KAN-119-01: o grupo novo entra na lista de grupos ativos da conta ({conta23.get("ativos")})')
        p23.click('[data-a=tab][data-v=rodada]'); p23.wait_for_timeout(500)
        ok(p23.locator('#avisoNovidade').count() == 1 and 'agora tem planos' in p23.inner_text('#avisoNovidade'), 'CT-KAN-119-02: na transição, o organizador vê o aviso da novidade com a data')
        ok(p23.locator('.tab-trava').count() == 0, 'CT-KAN-119-02: na transição, nenhuma aba tem cadeado (Plano A)')
        pl23 = p23.evaluate("S.app&&S.app.pl")
        ok(bool(pl23) and pl23.get('id') == 'A' and pl23.get('o') == 'transicao', f'CT-KAN-119-03: o espelho do plano fica no grupo para os convidados ({pl23})')
        p23.click('#avisoNovidade [data-a=lerAvisoPlano]'); p23.wait_for_timeout(300); p23.reload(); p23.wait_for_timeout(1500)
        ok(p23.locator('#avisoNovidade').count() == 0, 'CT-KAN-119-02: "Entendi" esconde o aviso, e ele não volta ao recarregar')
        # Fim da transição: Grátis
        p23.evaluate(PUT, {'sistema/planos': {'transicaoAte': 1}}); p23.reload(); p23.wait_for_timeout(1500)
        trav23 = p23.evaluate("[...document.querySelectorAll('[data-a=tab]')].filter(b=>b.querySelector('.tab-trava')).map(b=>b.dataset.v)")
        ok(sorted(set(trav23)) == ['caixa', 'historico', 'votacao'], f'CT-KAN-119-04: no Grátis, Caixa, Votação e Histórico aparecem com cadeado, sem sumir ({trav23})')
        p23.click('[data-a=tab][data-v=votacao]'); p23.wait_for_timeout(500)
        tv23 = p23.inner_text('#trava') if p23.locator('#trava').count() else ''
        ok('Faz parte do Plano A' in tv23 and p23.locator('#trava [data-a=testarPlano]').count() == 1 and p23.locator('[data-a=newVote]').count() == 0,
           f'CT-KAN-119-04: Votação no Grátis mostra o cadeado e o convite "Testar o Plano A", sem criar votação ({tv23[:80]!r})')
        p23.set_viewport_size({'width': 360, 'height': 740}); p23.wait_for_timeout(200)
        ok(p23.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-119-05: cadeado sem rolagem lateral em 360px')
        p23.screenshot(path=f'{OUT}/v70-cadeado-360.png'); contraste(p23, 'Cadeado do plano (v70)')
        p23.set_viewport_size({'width': 390, 'height': 844})
        p23.click('[data-a=tab][data-v=ranking]'); p23.wait_for_timeout(800)
        ok(p23.locator('[data-c=rankAno]').count() == 0 and p23.locator('[data-trava=rankingAnual]').count() == 1, 'CT-KAN-119-06: no Grátis, o ranking mostra só os meses, com o cadeado do ranking do ano')
        p23.click('[data-a=tab][data-v=rodada]'); p23.wait_for_timeout(600)
        ok(p23.locator('#semResposta [data-trava=cobrarPendentes]').count() == 1 and p23.locator('[data-a=cobrarGrupo]').count() == 0, 'CT-KAN-119-06: cobrar quem não respondeu aparece com cadeado no Grátis')
        p23.click('[data-a=abrirMinimos]'); p23.wait_for_timeout(400)
        ok(p23.locator('#vagasCtrl').is_disabled() and p23.locator('#dlg [data-trava=listaEspera]').count() == 1, 'CT-KAN-119-06: o controle de vagas (lista de espera) fica travado no Grátis')
        p23.click('#dlg [data-a=close]'); p23.wait_for_timeout(300)
        # Grátis: só 1 grupo ativo
        p23.click('[data-a=groupsDlg]'); p23.wait_for_timeout(400)
        p23.click('#dlg [data-a=newGroup]'); p23.wait_for_timeout(900)
        ok(p23.locator('#planoMotivo').count() == 1 and '1 grupo ativo' in p23.inner_text('#planoMotivo') and p23.locator('#ngn').count() == 0,
           'CT-KAN-119-07: no Grátis com 1 grupo, "Novo grupo" explica o limite e mostra os planos, sem abrir o formulário (critério 1)')
        ok(p23.locator('#planosRaiz table th.atual', has_text='Grátis').count() == 1, 'CT-KAN-119-08: a janela Planos marca o plano de agora (Grátis)')
        p23.set_viewport_size({'width': 360, 'height': 740}); p23.wait_for_timeout(200)
        ok(p23.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-119-08: janela Planos sem rolagem lateral em 360px')
        p23.screenshot(path=f'{OUT}/v70-planos-360.png'); contraste(p23, 'Janela Planos (v70)')
        p23.set_viewport_size({'width': 390, 'height': 844})
        # Testar grátis
        p23.click('#planosRaiz [data-a=testarPlano]'); p23.wait_for_timeout(300); confirmar_app(p23, True); p23.wait_for_timeout(900)
        t23 = (p23.evaluate(LER, f'contas/{u23}') or {}).get('teste')
        ok(isinstance(t23, (int, float)) and t23 > 0, 'CT-KAN-119-09: "Testar o Plano A" grava o início do teste na conta')
        p23.goto(URL + '#/g/' + g23); p23.wait_for_timeout(1500)
        ok(p23.locator('.tab-trava').count() == 0 and p23.evaluate("S.app.pl&&S.app.pl.o") == 'teste', 'CT-KAN-119-09: no teste, os cadeados somem e o espelho mostra o teste')
        p23.click('[data-a=tab][data-v=caixa]'); p23.wait_for_timeout(900)
        ok(p23.locator('#trava').count() == 0 and p23.locator('[data-a=addLan]').count() == 1, 'CT-KAN-119-09: no teste, o caixa abre normalmente')
        # Teste perto do fim: aviso 3 dias antes; depois do fim, volta ao Grátis sem poder testar de novo
        p23.evaluate(PUT, {f'contas/{u23}': dict(conta23, ativos=[g23], teste=int(time.time() * 1000) - 12 * 864e5)}); p23.reload(); p23.wait_for_timeout(1500)
        fim23 = p23.inner_text('#avisoFimPlano') if p23.locator('#avisoFimPlano').count() else ''
        ok('acaba em 2 dias' in fim23 and 'teste grátis' in fim23, f'CT-KAN-119-10: 3 dias antes do fim do teste, o organizador é avisado ({fim23[:90]!r}) (critério 3)')
        p23.evaluate(PUT, {f'contas/{u23}': dict(conta23, ativos=[g23], teste=int(time.time() * 1000) - 15 * 864e5)}); p23.reload(); p23.wait_for_timeout(1500)
        p23.click('[data-a=tab][data-v=caixa]'); p23.wait_for_timeout(600)
        ok(p23.locator('#trava').count() == 1 and p23.locator('#trava [data-a=testarPlano]').count() == 0 and 'Contratação em breve' in p23.inner_text('#trava'),
           'CT-KAN-119-10: depois do teste, volta ao Grátis, sem testar de novo: "Contratação em breve" (critério 3)')
        # Rebaixado com 3 grupos: escolhe o que fica (critério 4)
        for gx in ['gx1', 'gx2']:
            p23.evaluate(PUT, {f'grupos/{gx}': {'name': 'Extra ' + gx, 'owner': u23, 'ativo': True, 'createdAt': 1, 'sport': 'futebol'},
                               f'grupos/{gx}/membros/{u23}': {'uid': u23, 'role': 'owner'}})
        me23 = p23.evaluate(LER, f'usuarios/{u23}') or {}
        me23.setdefault('grupos', {})
        for gx in ['gx1', 'gx2']: me23['grupos'][gx] = {'name': 'Extra ' + gx, 'role': 'owner', 'ativo': True, 'sport': 'futebol'}
        p23.evaluate(PUT, {f'usuarios/{u23}': me23, f'contas/{u23}': dict(conta23, ativos=[g23, 'gx1', 'gx2'], teste=1)})
        p23.goto(URL + '#/'); p23.reload(); p23.wait_for_timeout(1800)
        ok(p23.locator('#avisoGrupos').count() == 1 and 'permite 1 grupo ativo' in p23.inner_text('#avisoGrupos'), 'CT-KAN-119-11: com 3 grupos no Grátis, Meus grupos pede para escolher quais continuam ativos')
        p23.click('#avisoGrupos [data-a=escolherAtivos]'); p23.wait_for_timeout(700)
        p23.locator('#escolherLista input').nth(1).check(); p23.click('#dlg [data-a=salvarAtivos]'); p23.wait_for_timeout(300)
        ok('Marque até 1' in p23.inner_text('#escolherErr'), 'CT-KAN-119-11: marcar mais do que o plano permite avisa e não grava')
        p23.locator('#escolherLista input').nth(1).uncheck(); p23.click('#dlg [data-a=salvarAtivos]'); p23.wait_for_timeout(300); confirmar_app(p23, True); p23.wait_for_timeout(1500)
        c23 = p23.evaluate(LER, f'contas/{u23}') or {}
        inat23 = [gx for gx in ['gx1', 'gx2'] if (p23.evaluate(LER, f'grupos/{gx}') or {}).get('ativo') is False]
        ok(len(c23.get('ativos', [])) == 1 and len(inat23) == 2 and p23.locator('#avisoGrupos').count() == 0,
           f'CT-KAN-119-11: os outros grupos ficam inativos (guardados), e a conta fica com 1 ativo ({c23.get("ativos")}, inativos: {inat23}) (critério 4)')
        p23.goto(URL + '#/g/gx1'); p23.wait_for_timeout(1500)
        p23.click('.inbar [data-a=toggleAtivo]'); p23.wait_for_timeout(800)
        ok(p23.locator('#planoMotivo').count() == 1 and (p23.evaluate(LER, 'grupos/gx1') or {}).get('ativo') is False, 'CT-KAN-119-12: reativar um grupo além do limite do plano explica e não reativa')
        p23.goto(URL + '#/'); p23.wait_for_timeout(1000)
        p23.click('#topright [data-a=contaMenu]'); p23.wait_for_timeout(200)
        ok(p23.locator('.theme-menu [data-a=planosDlg]').count() == 1, 'CT-KAN-119-08: o menu da conta tem "Plano e recursos"')
        ctx23.close()

        # ---------- v71 (KAN-204): administradores convidados por plano; (KAN-203) Ranking como componente
        ctx24 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p24 = ctx24.new_page(); p24.on('pageerror', lambda e: errs.append(str(e)))
        def entrar24(email, criar=False, url=None):
            p24.goto(url or (URL + ('#/criar' if criar else '#/entrar'))); p24.wait_for_timeout(1000)
            modo = 'signup' if criar else 'login'
            if p24.locator(f'#authRaiz [data-a=authMode][data-v={modo}]').count():
                p24.click(f'#authRaiz [data-a=authMode][data-v={modo}]'); p24.wait_for_timeout(200)
            p24.fill('#le', email); p24.fill('#lp', 'Jogo@2026')
            if criar and p24.locator('#lp2').count(): p24.fill('#lp2', 'Jogo@2026')
            p24.keyboard.press('Enter'); p24.wait_for_timeout(1500)
        entrar24('dono71@teste.com', True)
        p24.fill('#ngn', 'Convidados FC'); p24.click('[data-a=pickSport][data-v=futebol]'); p24.click('[data-a=createGroup]'); p24.wait_for_timeout(1600)
        g24 = p24.url.split('#/g/')[1]; dono24 = p24.evaluate("S.user.uid")
        p24.click('[data-a=tab][data-v=jogadores]'); p24.wait_for_timeout(300); p24.click('[data-a=seed]'); p24.wait_for_timeout(1500)
        p24.evaluate(PUT, {'sistema/planos': {'transicaoAte': 1}}); p24.reload(); p24.wait_for_timeout(1500)
        p24.click('[data-a=tab][data-v=ranking]'); p24.wait_for_timeout(900)
        ok(p24.locator('#rankRaiz [data-c=rank]').count() == 1 and p24.locator('#rankRaiz [data-trava=rankingAnual]').count() == 1 and p24.locator('#rankRaiz [data-c=rankMes] option').count() == 12,
           'CT-KAN-203-01: o Ranking (agora componente) mostra a ordenação, os 12 meses e, no Grátis, a trava do ranking do ano')
        p24.select_option('#rankRaiz [data-c=rank]', 'gols'); p24.wait_for_timeout(300)
        ok(p24.evaluate("S.rankSort") == 'gols' and p24.locator('#rankRaiz [data-c=rank]').input_value() == 'gols', 'CT-KAN-203-02: trocar a ordenação continua funcionando no componente')
        p24.click('[data-a=tab][data-v=grupo]'); p24.wait_for_timeout(700)
        p24.click('#grupoRaiz [data-a=inviteLink]'); p24.wait_for_timeout(500); tok24 = p24.evaluate("S.convite&&S.convite.token"); p24.click('#dlg [data-a=close]'); p24.wait_for_timeout(200)
        sair(p24); p24.wait_for_timeout(1500)
        entrar24('conv71a@teste.com', True, URL + '#/convite/' + g24 + '/' + str(tok24))
        p24.click('[data-a=acceptInv]'); p24.wait_for_timeout(1800)
        ua = p24.evaluate("S.user.uid")
        ok(p24.evaluate("S.app.adms") == [ua], f'CT-KAN-204-01: o convidado entra na lista de convidados do grupo ({p24.evaluate("S.app.adms")})')
        ok(p24.locator('#avisoSoVer').count() == 0 and not p24.evaluate("document.body.classList.contains('so-ver')"), 'CT-KAN-204-01: o primeiro convidado (dentro do limite do Grátis) edita normalmente')
        sair(p24); p24.wait_for_timeout(1500)
        entrar24('conv71b@teste.com', True, URL + '#/convite/' + g24 + '/' + str(tok24))
        ok(p24.locator('#conviteCheio').count() == 1 and p24.locator('[data-a=acceptInv]').count() == 0 and '1 administrador convidado' in p24.inner_text('#conviteCheio'),
           'CT-KAN-204-02: com o plano cheio, o convite explica e não deixa aceitar (critério 1)')
        p24.screenshot(path=f'{OUT}/v71-convite-cheio.png'); contraste(p24, 'Convite com o plano cheio (v71)')
        ub = p24.evaluate("S.user.uid")
        # Rebaixamento simulado: o segundo convidado já estava no grupo (entrou quando o plano permitia 2)
        p24.evaluate(PUT, {f'grupos/{g24}/membros/{ub}': {'uid': ub, 'role': 'admin', 'email': 'conv71b@teste.com', 'at': int(time.time() * 1000), 'perm': {'caixa': False, 'notas': False, 'elenco': False, 'config': False}},
                           f'grupos/{g24}': {**(p24.evaluate(LER, f'grupos/{g24}') or {}), 'adms': [ua, ub]}})
        me24 = p24.evaluate(LER, f'usuarios/{ub}') or {}; me24.setdefault('grupos', {})[g24] = {'name': 'Convidados FC', 'role': 'admin', 'ativo': True, 'sport': 'futebol'}
        p24.evaluate(PUT, {f'usuarios/{ub}': me24}); p24.reload(); p24.wait_for_timeout(800)
        p24.goto(URL + '#/g/' + g24); p24.wait_for_timeout(1800)
        ok(p24.locator('#avisoSoVer').count() == 1 and p24.evaluate("document.body.classList.contains('so-ver')"), 'CT-KAN-204-03: o convidado além do limite vê o aviso de que só pode ver (critério 2)')
        vis24 = p24.evaluate("[...document.querySelectorAll('main [data-a]')].filter(b=>b.offsetParent!==null).map(b=>b.dataset.a)")
        ok(not [a for a in vis24 if a not in ('planosDlg', 'lerAvisoPlano', 'recarregar', 'forgetGroup') and not a.startswith(('copy', 'share', 'hist'))],
           f'CT-KAN-204-03: nenhum botão que grava aparece para quem só vê ({vis24[:8]})')
        p24.evaluate("(()=>{const b=document.createElement('button');b.dataset.a='newRod';b.id='forca';document.body.appendChild(b)})()")
        p24.click('#forca'); p24.wait_for_timeout(400)
        ok('só pode ver' in p24.inner_text('#toast') and not p24.evaluate("document.getElementById('dlg').open"), 'CT-KAN-204-03: uma ação que grava, se chegar a ser chamada, é barrada com aviso')
        p24.click('[data-a=tab][data-v=jogadores]'); p24.wait_for_timeout(600)
        ok(p24.locator('main .plist li').count() > 5, 'CT-KAN-204-03: quem só vê continua vendo o elenco')
        p24.screenshot(path=f'{OUT}/v71-so-ve.png'); contraste(p24, 'Convidado que só vê (v71)')
        sair(p24); p24.wait_for_timeout(1500)
        entrar24('dono71@teste.com')
        p24.goto(URL + '#/g/' + g24); p24.wait_for_timeout(1500); p24.click('[data-a=tab][data-v=grupo]'); p24.wait_for_timeout(800)
        ok(p24.locator('#adminsPainel .so-ve').count() == 1 and p24.locator('#soVeAjuda').count() == 1, 'CT-KAN-204-04: o organizador vê quem só vê, com a explicação do plano')
        p24.click('#grupoRaiz [data-a=inviteLink]'); p24.wait_for_timeout(700)
        ok(p24.locator('#planoMotivo').count() == 1 and 'administrador convidado' in p24.inner_text('#planoMotivo'), 'CT-KAN-204-04: "Convidar" com o plano cheio explica o limite e mostra os planos')
        p24.click('#dlg [data-a=close]'); p24.wait_for_timeout(300)
        # O plano sobe (teste grátis): o segundo convidado volta a editar sem fazer nada (critério 3)
        p24.evaluate(PUT, {f'contas/{dono24}': {**(p24.evaluate(LER, f'contas/{dono24}') or {}), 'teste': int(time.time() * 1000)}}); p24.reload(); p24.wait_for_timeout(1800)
        p24.click('[data-a=tab][data-v=grupo]'); p24.wait_for_timeout(800)
        ok(p24.locator('#adminsPainel .so-ve').count() == 0 and p24.evaluate("S.app.pl&&S.app.pl.id") == 'A', 'CT-KAN-204-05: com o Plano A (2 convidados), ninguém fica só vendo (critério 3)')
        ctx24.close()

        # ---------- v75 (KAN-194): rodada e confirmados à vista no celular; (KAN-195) Nova votação; (KAN-131) rótulos para leitor de tela
        ctx25 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p25 = ctx25.new_page(); p25.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p25, 'criar')
        p25.fill('#le', 'ux75@teste.com'); p25.fill('#lp', 'Jogo@2026'); p25.fill('#lp2', 'Jogo@2026'); p25.keyboard.press('Enter'); p25.wait_for_selector('#ngBox', timeout=8000)
        r25 = '#sched .srow:nth-child(1)'
        p25.fill(f'{r25} [data-hora]:has(.si) .hh', '20'); p25.fill(f'{r25} [data-hora]:has(.sf) .hh', '22')
        LOCAL100 = 'Society do Zé, Av. Prefeito Faria Lima 1234, Pinheiros, São Paulo, ao lado do posto, portão azul 3'
        p25.fill(f'{r25} .sl', LOCAL100); p25.fill('#ngn', 'Futebol de Quinta da Firma')
        p25.click('[data-a=createGroup]'); p25.wait_for_function("location.hash.startsWith('#/g/')"); p25.wait_for_timeout(1500)
        def medir25():
            p25.evaluate("document.getElementById('demo').hidden=true; scrollTo(0,0)"); p25.wait_for_timeout(150)
            return p25.evaluate("""(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {t:r.top,b:r.bottom,h:r.height}};
              const g=document.getElementById('gname');
              return {top:R('header.top'),h2:R('.hero-r h2'),count:R('.count'),barra:R('.acao-fixa'),hero:R('.hero-r'),fixos:R('.fixos'),
                nomeLinhas:Math.round(g.getBoundingClientRect().height/parseFloat(getComputedStyle(g).lineHeight)),cortado:g.scrollWidth>g.clientWidth,
                fonte:parseFloat(getComputedStyle(g).fontSize),hora:(()=>{const n=document.querySelector('.hero-r h2 .nw');return n?n.getClientRects().length:0})()}})()""")
        for tema in ['light', 'dark']:
            p25.emulate_media(color_scheme=tema); m25 = medir25()
            ok(m25['count']['b'] <= 740 and m25['count']['b'] <= m25['barra']['t'] and m25['h2']['b'] <= m25['barra']['t'],
               f'CT-KAN-194-01: em 360 × 740 ({tema}), a data da rodada e o número de confirmados aparecem sem rolar, acima da barra Sortear (confirmados até {m25["count"]["b"]:.0f}px, barra em {m25["barra"]["t"]:.0f}px)')
            ok(m25['top']['h'] <= 120 and m25['nomeLinhas'] == 1 and m25['cortado'] and m25['fonte'] == 28,
               f'CT-KAN-194-02: em 360px ({tema}), o cabeçalho verde tem até 120px ({m25["top"]["h"]:.0f}) e o nome longo fica numa linha, com "…", em 28px')
            ok(m25['hora'] == 1, f'CT-KAN-194-04: em 360px ({tema}), "20:00–22:00" fica na mesma linha ({p25.inner_text(".hero-r h2")!r})')
            ok(m25['fixos'] and m25['fixos']['t'] > m25['hero']['b'], f'CT-KAN-194-05: o painel do link permanente vem depois do cartão da rodada ({tema})')
        p25.emulate_media(color_scheme='light')
        p25.screenshot(path=f'{OUT}/v75-rodada-360.png')
        p25.click('#gname'); p25.wait_for_timeout(200)
        ab25 = p25.evaluate("[document.getElementById('gname').classList.contains('aberto'), document.getElementById('gname').getAttribute('aria-expanded'), document.getElementById('gname').title]")
        ok(ab25[0] and ab25[1] == 'true' and ab25[2] == 'Futebol de Quinta da Firma', f'CT-KAN-194-02: tocar no nome do grupo mostra o nome inteiro ({ab25})')
        p25.click('#gname'); p25.wait_for_timeout(200)
        ok(p25.locator('main [data-a=tab][data-v=historico]').count() == 0 and p25.locator('#tabs [data-a=tab][data-v=historico]').count() == 1,
           'CT-KAN-194-03: na aba Rodada, o Histórico tem um caminho só (a aba), sem o botão repetido')
        fx25 = p25.inner_text('.fixos')
        ok('Link permanente' in fx25 and not p25.locator('.fixos details p').is_visible() and not p25.locator('.fixos [data-a=copyFixo]').is_visible(),
           f'CT-KAN-194-05: o link permanente fica recolhido numa linha ("Mandar no WhatsApp"); copiar e editar ficam em "Como funciona"')
        p25.click('.fixos [data-a=shareFixo]'); p25.wait_for_timeout(500)
        ok(p25.locator('#shtxt').is_visible() and 'Confirme sua presença sempre neste link' in p25.input_value('#shtxt'), 'CT-KAN-194-05: "Mandar no WhatsApp" do link permanente na nova posição abre a janela do WhatsApp como antes')
        # KAN-131: a caixa de texto da janela de compartilhar tem rótulo
        ok(p25.evaluate("(()=>{const t=document.getElementById('shtxt');return !!(t.labels&&t.labels.length&&t.labels[0].textContent.includes('Mensagem pronta para o WhatsApp'))})()"),
           'CT-KAN-131-03: a caixa de texto da janela de compartilhar tem o rótulo "Mensagem pronta para o WhatsApp"')
        p25.click('#dlg [data-a=close]'); p25.wait_for_timeout(300)
        p25.set_viewport_size({'width': 1024, 'height': 800}); p25.wait_for_timeout(300)
        d25 = p25.evaluate("(()=>{const g=document.getElementById('gname');return [parseFloat(getComputedStyle(g).fontSize), g.scrollWidth<=g.clientWidth]})()")
        ok(d25[0] == 40 and d25[1], f'CT-KAN-194-06: no computador, o cabeçalho continua como antes (nome em 40px, inteiro) ({d25})')
        p25.set_viewport_size({'width': 360, 'height': 740}); p25.wait_for_timeout(200)
        # KAN-195: Nova votação com caixas de 44px e seletor de rodada sem o local
        elenco_e_presenca(p25, 8); sortear(p25)
        p25.click('[data-a=tab][data-v=votacao]'); p25.wait_for_timeout(900); p25.click('[data-a=newVote]'); p25.wait_for_timeout(300)
        for tema in ['light', 'dark']:
            p25.emulate_media(color_scheme=tema); p25.wait_for_timeout(150)
            cx25 = p25.evaluate("[...document.querySelectorAll('#dlg .chk-linha')].filter(e=>e.offsetParent).map(e=>Math.round(e.getBoundingClientRect().height))")
            ok(cx25 and min(cx25) >= 44, f'CT-KAN-195-01: na Nova votação ({tema}), cada linha de caixa de marcar tem pelo menos 44px ({cx25})')
        p25.emulate_media(color_scheme='light')
        antes25 = p25.evaluate("[...document.querySelectorAll('#dlg .vc')].map(x=>x.checked)")
        p25.locator('#dlg .chk-linha:has(.vc[value=worst]) span').click(); p25.wait_for_timeout(100)
        depois25 = p25.evaluate("[...document.querySelectorAll('#dlg .vc')].map(x=>x.checked)")
        ok(antes25[-1] is False and depois25[-1] is True and antes25[:-1] == depois25[:-1], f'CT-KAN-195-01: tocar no texto da linha marca a caixa daquela linha ({antes25} → {depois25})')
        p25.locator('#dlg .chk-linha:has(.vc[value=worst]) span').click()
        opt25 = p25.evaluate("[...document.querySelectorAll('#vr option')].map(o=>o.textContent)")
        ok(opt25 and all('Society' not in o and '20:00–22:00' in o and 'fixo' in o for o in opt25), f'CT-KAN-195-02: o seletor Rodada da Nova votação mostra data, hora e "fixo", sem o local ({opt25})')
        v25 = p25.evaluate("(()=>{const d=document.getElementById('dlgBody');const b=[...d.querySelectorAll('.dlg-f .btn')].map(x=>x.getBoundingClientRect());return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, d.scrollHeight-d.clientHeight]})()")
        ok(v25[0] and v25[1], f'CT-KAN-195-03: em 360px, a janela Nova votação não tem rolagem lateral ({v25})')
        p25.screenshot(path=f'{OUT}/v75-nova-votacao-360.png')
        # KAN-131: "Outra categoria" com rótulo visível que continua ao digitar
        p25.fill('#vx', 'Jogada mais bonita')
        lb25 = p25.evaluate("(()=>{const i=document.getElementById('vx');const l=i.labels&&i.labels[0];return l?[l.querySelector('span').textContent, l.querySelector('span').getBoundingClientRect().height>0]:null})()")
        ok(lb25 and lb25[0] == 'Outra categoria (opcional)' and lb25[1], f'CT-KAN-131-05: "Outra categoria" tem rótulo visível acima do campo, que continua ao digitar ({lb25})')
        for tema in ['light', 'dark']:
            p25.emulate_media(color_scheme=tema); p25.wait_for_timeout(100); contraste(p25, f'Nova votação ({tema})')
        p25.emulate_media(color_scheme='light')
        p25.fill('#vx', '')
        p25.click('[data-a=saveVote]'); p25.wait_for_timeout(800); p25.click('#dlg [data-a=close]'); p25.wait_for_timeout(400)
        sem25 = p25.evaluate("""(()=>[...document.querySelectorAll('main input,main select,main textarea')].filter(e=>e.offsetParent&&e.type!=='hidden').filter(e=>!((e.labels&&e.labels.length)||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby'))).map(e=>e.outerHTML.slice(0,60)))()""")
        ok(p25.get_attribute('[data-c=vid]', 'aria-label') == 'Votação' and not sem25, f'CT-KAN-131-03: na aba Votação, nenhum campo sem rótulo ({sem25})')
        ok('Craque da rodada' in p25.inner_text('main') and p25.locator('main [data-a=shareVote]').count() == 1, 'CT-KAN-195: a aba Votação (agora componente) mostra a votação criada e seus botões')
        p25.click('[data-a=tab][data-v=caixa]'); p25.wait_for_timeout(900)
        p25.click('[data-a=addLan]'); p25.wait_for_timeout(300); p25.select_option('#lk', 'despesa'); p25.fill('#lv', '80'); p25.click('#dlg [data-a=saveLan]'); p25.wait_for_timeout(700)
        sem25c = p25.evaluate("""(()=>[...document.querySelectorAll('main input,main select,main textarea')].filter(e=>e.offsetParent&&e.type!=='hidden').filter(e=>!((e.labels&&e.labels.length)||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby'))).map(e=>e.outerHTML.slice(0,60)))()""")
        ok(not sem25c, f'CT-KAN-131-03: na aba Caixa, nenhum campo sem rótulo ({sem25c})')
        xl25 = p25.get_attribute('main [data-a=delLan]', 'aria-label') or ''
        ok('Despesa' in xl25 and 'R$' in xl25 and '80' in xl25, f'CT-KAN-131-04: o ✕ do lançamento diz o tipo e o valor ({xl25!r})')
        # KAN-131: botão ⇄ com o nome do jogador
        p25.click('[data-a=tab][data-v=rodada]'); p25.wait_for_timeout(500)
        mv25 = p25.evaluate("(()=>{const b=document.querySelector('[data-a=move]');return b?[b.getAttribute('aria-label'), (S.jog[b.dataset.p]||{}).name]:null})()")
        ok(mv25 and mv25[0] == 'Mover ' + mv25[1], f'CT-KAN-131-01: o botão ⇄ anuncia "Mover" e o nome do jogador ({mv25})')
        # KAN-131: Meus grupos: "Abrir" com o nome do grupo, e o cartão inteiro abre o grupo
        novo_grupo(p25, 'Basquete da Firma', 'basquete')
        # KAN-195 CT-04: grupo de basquete: categorias do catálogo do esporte (sem goleiro), no novo formato
        elenco_e_presenca(p25, 8); sortear(p25)
        p25.click('[data-a=tab][data-v=votacao]'); p25.wait_for_timeout(900); p25.click('[data-a=newVote]'); p25.wait_for_timeout(300)
        cb25 = p25.evaluate("[...document.querySelectorAll('#dlg .chk-linha')].map(e=>[e.textContent.trim(),Math.round(e.getBoundingClientRect().height)])")
        ok(cb25 and not any('goleiro' in t.lower() for t, _ in cb25) and min(h for _, h in cb25) >= 44, f'CT-KAN-195-04: no basquete, as categorias seguem o esporte (sem goleiro) e com 44px ({cb25})')
        p25.click('#dlg [data-a=close]'); p25.wait_for_timeout(300)
        p25.goto(URL + '#/'); p25.wait_for_timeout(1200)
        ab25b = p25.evaluate("[...document.querySelectorAll('#homeRaiz .grupo-linha .abrir-grupo')].map(a=>a.getAttribute('aria-label'))")
        ok(sorted(ab25b) == ['Abrir Basquete da Firma', 'Abrir Futebol de Quinta da Firma'], f'CT-KAN-131-02: em Meus grupos, cada "Abrir" anuncia o nome do grupo ({ab25b})')
        bx25 = p25.locator('#homeRaiz .grupo-linha:has-text("Basquete da Firma") .pn b').bounding_box()
        p25.mouse.click(bx25['x'] + 10, bx25['y'] + bx25['height'] / 2); p25.wait_for_timeout(1200)
        ok(p25.evaluate("location.hash.startsWith('#/g/') && S.app && S.app.name") == 'Basquete da Firma', 'CT-KAN-131-02: tocar no nome do grupo também abre o grupo')
        ctx25.close()
        # ---------- v76 (KAN-208): afastamento de jogador por um período, com ou sem mensalidade
        ctx26 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p26 = ctx26.new_page(); p26.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p26, 'criar')
        p26.fill('#le', 'afast76@teste.com'); p26.fill('#lp', 'Jogo@2026'); p26.fill('#lp2', 'Jogo@2026'); p26.keyboard.press('Enter'); p26.wait_for_selector('#ngBox', timeout=8000)
        p26.fill('#ngn', 'Afastados FC'); p26.click('[data-a=createGroup]'); p26.wait_for_function("location.hash.startsWith('#/g/')"); p26.wait_for_timeout(1500)
        g26 = p26.url.split('#/g/')[1]
        p26.click('[data-a=tab][data-v=jogadores]'); p26.wait_for_timeout(300); p26.click('[data-a=seed]'); p26.wait_for_timeout(1500)
        mes = lambda n: p26.evaluate("(n)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}", n)
        M, M1, M2, P1 = mes(0), mes(-1), mes(-2), mes(1)
        mens26 = p26.evaluate("Object.keys(S.jog).filter(id=>!['diarista','isento'].includes(((S.pc||{}).tipos||{})[id]||'mensalista')).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        j1, j2, j3 = mens26[0], mens26[1], mens26[2]
        n1, n2, n3 = [p26.evaluate("(i)=>S.jog[i].name", x) for x in (j1, j2, j3)]
        # Janela pela ficha (critério 8: 360px, 44px, contraste)
        p26.click(f'[data-a=editPlayer][data-p="{j1}"]'); p26.wait_for_timeout(400)
        ok(p26.locator('#dlg .afast-linha [data-a=afastarDlg]').count() == 1, 'CT-KAN-208: a ficha do jogador tem o botão "Afastar"')
        p26.click('#dlg [data-a=afastarDlg]'); p26.wait_for_selector('#afMot', timeout=8000); p26.wait_for_timeout(200)
        for tema in ['light', 'dark']:
            p26.emulate_media(color_scheme=tema); p26.wait_for_timeout(150)
            v26 = p26.evaluate("(()=>{const d=document.getElementById('dlgBody');const r=[...d.querySelectorAll('.chk-linha')].map(e=>Math.round(e.getBoundingClientRect().height));return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, r, document.activeElement.id]})()")
            ok(v26[0] and v26[1] and v26[2] and min(v26[2]) >= 44 and v26[3] == 'afMot', f'CT-KAN-208-08: em 360px ({tema}), a janela Afastar não tem rolagem lateral, as opções da mensalidade têm 44px e o cursor vem no motivo ({v26})')
            contraste(p26, f'janela Afastar ({tema})')
        p26.emulate_media(color_scheme='light')
        p26.screenshot(path=f'{OUT}/v76-afastar-360.png')
        p26.select_option('#afMot', 'lesao'); p26.fill('#afObs', 'cirurgia no joelho'); p26.select_option('#afDe', M1); p26.select_option('#afAte', P1)
        ok(p26.is_checked('input[name=afCobra][value=nao]'), 'CT-KAN-208: "Não cobrar nesse período" vem marcado')
        p26.click('#dlg [data-a=afSalvar]'); p26.wait_for_timeout(800)
        a26 = p26.evaluate("(p)=>{const e=Object.entries(S.af||{}).find(([,a])=>a&&a.pid===p);return e?[e[0],e[1],((S.pc||{}).afIsen||{})[e[0]]||null]:null}", j1)
        ok(a26 and a26[1]['de'] == M1 and a26[1]['ate'] == P1 and a26[1]['obs'] == 'cirurgia no joelho' and a26[2] == {'pid': j1, 'de': M1, 'ate': P1},
           f'CT-KAN-208: o afastamento e o "não cobrar" ficam gravados ({a26})')
        aid1 = a26[0] if a26 else ''
        tag26 = p26.inner_text(f'#jogadoresRaiz li:has([data-p="{j1}"]) .afast-tag') if p26.locator(f'#jogadoresRaiz li:has([data-p="{j1}"]) .afast-tag').count() else ''
        ok(tag26.startswith('afastado até '), f'CT-KAN-208: na lista do elenco, o afastado tem a etiqueta ({tag26!r})')
        p26.click(f'[data-a=editPlayer][data-p="{j1}"]'); p26.wait_for_timeout(400)
        fl26 = p26.inner_text('#dlg .afast-linha')
        ok('Lesão' in fl26 and p26.locator('#dlg .afast-linha [data-a=afastarDlg][data-v]').count() == 1, f'CT-KAN-208: a ficha mostra o afastamento de agora e abre a janela para ver ou mudar ({fl26!r})')
        p26.locator('#dlg .afast-linha').scroll_into_view_if_needed(); p26.screenshot(path=f'{OUT}/v76-ficha-afastado-360.png')
        p26.click('#dlg [data-a=close]'); p26.wait_for_timeout(300)
        # Mais dois pelo banco: j2 afastado nos 2 meses anteriores (sem mensalidade) e j3 "até voltar" com "cobrar normalmente"
        p26.evaluate(PUT, {
            f'grupos/{g26}/privado/afast': dict(p26.evaluate(LER, f'grupos/{g26}/privado/afast') or {}, **{
                'a2': {'pid': j2, 'mot': 'ferias', 'de': M2, 'ate': M1, 'em': 2},
                'a3': {'pid': j3, 'mot': 'viagem', 'de': M, 'ate': '', 'em': 3}}),
            f'grupos/{g26}/privado/caixa': dict(p26.evaluate(LER, f'grupos/{g26}/privado/caixa') or {}, afIsen=dict(((p26.evaluate(LER, f'grupos/{g26}/privado/caixa') or {}).get('afIsen') or {}), a2={'pid': j2, 'de': M2, 'ate': M1}))})
        p26.reload(); p26.wait_for_timeout(1800)
        # Critérios 1 e 2: Caixa do mês
        p26.click('[data-a=tab][data-v=caixa]'); p26.wait_for_timeout(1200)
        pend26 = p26.inner_text('#pendLista') if p26.locator('#pendLista').count() else ''
        ok(n1 not in pend26 and n2 in pend26, f'CT-KAN-208-01: o afastado sem mensalidade sai das pendências do mês, e quem voltou (afastamento já terminou) aparece de novo ({n1} fora, {n2} dentro)')
        ok(n3 in pend26, f'CT-KAN-208-02: afastado com "Cobrar normalmente" continua com a mensalidade pendente ({n3})')
        if p26.locator('[data-a=shareCob]').count():
            p26.locator('[data-a=shareCob]').first.click(); p26.wait_for_timeout(500)
            tz26 = p26.input_value('#shtxt') if p26.locator('#shtxt').count() else ''
            ok(n1 not in tz26, f'CT-KAN-208-01: o texto de cobrança do WhatsApp não inclui o afastado sem mensalidade')
            p26.click('#dlg [data-a=close]'); p26.wait_for_timeout(300)
        # Critério 3: Rodada
        p26.click('[data-a=tab][data-v=rodada]'); p26.wait_for_timeout(900)
        lista26 = p26.inner_text('#presLista'); falta26 = p26.inner_text('#semResposta') if p26.locator('#semResposta').count() else ''
        ativos26 = p26.evaluate("Object.values(S.jog).filter(p=>p.ativo!==false).length")
        tot26 = p26.evaluate("+(document.querySelector('[data-a=presFiltro][data-v=todos] .n')||{}).textContent||0")
        ok(n1 not in lista26 and n3 not in lista26 and n1 not in falta26 and n3 not in falta26 and n2 in lista26,
           f'CT-KAN-208-03: afastados fora da lista de presença e de "Ainda não responderam"; quem voltou continua')
        ok(tot26 == ativos26 - 2, f'CT-KAN-208-03: a contagem "Todos" não inclui os afastados ({tot26} de {ativos26} ativos)')
        # Critério 4: afastado confirma pelo link → aviso com "Voltou" e "Manter afastado"
        rid26 = p26.evaluate("S.rid || Object.keys(S.rod)[0]")
        p26.evaluate(PUT, {pres_k(g26, rid26, j1): {'s': 'in', 'at': 1, 'nome': n1}, pres_k(g26, rid26, j3): {'s': 'in', 'at': 2, 'nome': n3}})
        p26.reload(); p26.wait_for_timeout(1800); p26.click('[data-a=tab][data-v=rodada]'); p26.wait_for_timeout(900)
        av26 = p26.inner_text('#afastConfirmou') if p26.locator('#afastConfirmou').count() else ''
        ok(n1 in av26 and n3 in av26 and 'Lesão' in av26 and p26.locator('#afastConfirmou [data-a=afVoltou]').count() == 2 and p26.locator('#afastConfirmou [data-a=afManter]').count() == 2,
           f'CT-KAN-208-04: afastado que confirmou aparece no aviso com "Voltou" e "Manter afastado" ({av26[:90]!r})')
        p26.locator('#afastConfirmou').scroll_into_view_if_needed(); p26.wait_for_timeout(200)
        p26.screenshot(path=f'{OUT}/v76-afastado-confirmou-360.png')
        p26.click(f'#afastConfirmou [data-a=afVoltou][data-v="{aid1}"]'); p26.wait_for_timeout(1200)
        ate26 = p26.evaluate("(a)=>[(S.af[a]||{}).ate, (((S.pc||{}).afIsen||{})[a]||{}).ate]", aid1)
        ok(ate26 == [M1, M1], f'CT-KAN-208-04: "Voltou" encerra o afastamento (e o "não cobrar") no mês anterior ({ate26}, esperado {M1})')
        p26.click('#afastConfirmou [data-a=afManter][data-v="a3"]'); p26.wait_for_timeout(1000)
        ok(p26.locator('#afastConfirmou').count() == 0 and p26.evaluate("(S.af.a3||{}).ign") == rid26,
           'CT-KAN-208-04: "Manter afastado" tira o aviso nesta rodada e mantém o afastamento')
        # Critério 5: convidado sem Caixa não vê a opção da mensalidade
        p26.evaluate("S.app.owner='outro'; S.app.adms=[S.user.uid]; S.mem=Object.assign({},S.mem,{role:'admin',perm:{caixa:false,notas:true,elenco:true,config:true}})")
        p26.click('[data-a=tab][data-v=jogadores]'); p26.wait_for_timeout(500)
        p26.click(f'[data-a=editPlayer][data-p="{j2}"]'); p26.wait_for_timeout(400); p26.click('#dlg [data-a=afastarDlg]'); p26.wait_for_selector('#afMot', timeout=8000)
        ok(p26.locator('#afCobra').count() == 0 and p26.locator('#dlg .afast-hist, #dlg details').count() >= 1,
           'CT-KAN-208-05: sem a permissão de Caixa, a janela não mostra a opção da mensalidade (o histórico continua)')
        p26.click('#dlg [data-a=close]'); p26.wait_for_timeout(300)
        if p26.locator('#dlg .conf').count(): confirmar_app(p26, True)
        p26.reload(); p26.wait_for_timeout(1500)
        # Critério 7: o link do jogador não mostra nada do afastamento
        pl26 = ctx26.new_page(); pl26.goto(URL + '#/p/' + g26); pl26.wait_for_timeout(1800)
        tl26 = pl26.inner_text('main')
        ok(n3 in tl26 and 'afastad' not in tl26.lower() and 'Viagem' not in tl26 and 'Lesão' not in tl26,
           'CT-KAN-208-07: o link do jogador não mostra afastamento nem motivo (o afastado continua na lista para confirmar)')
        pl26.close(); ctx26.close()
        # ---------- v77 (KAN-209): dia em que começa o mês da mensalidade, "Mensalidade de qual mês" e "Em atraso"
        ctx27 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p27 = ctx27.new_page(); p27.on('pageerror', lambda e: errs.append(str(e)))
        p27.clock.install(time=datetime.datetime(2026, 2, 10, 15, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3))))
        abrir_entrada(p27, 'criar')
        p27.fill('#le', 'ciclo77@teste.com'); p27.fill('#lp', 'Jogo@2026'); p27.fill('#lp2', 'Jogo@2026'); p27.keyboard.press('Enter'); p27.wait_for_selector('#ngBox', timeout=8000)
        p27.fill('#ngn', 'Ciclo FC'); p27.click('[data-a=createGroup]'); p27.wait_for_function("location.hash.startsWith('#/g/')"); p27.wait_for_timeout(1500)
        g27 = p27.url.split('#/g/')[1]
        p27.click('[data-a=tab][data-v=jogadores]'); p27.wait_for_timeout(300); p27.click('[data-a=seed]'); p27.wait_for_timeout(1500)
        def info27():
            p27.click('[data-a=tab][data-v=caixa]'); p27.wait_for_timeout(1000)
            return p27.inner_text('.ciclo-linha') if p27.locator('.ciclo-linha').count() else ''
        def ciclo27(dia, quando):
            p27.click('[data-a=tab][data-v=grupo]'); p27.wait_for_timeout(900); p27.click('[data-a=settings]'); p27.wait_for_selector('#cdia')
            p27.fill('#cm', '85'); p27.select_option('#cdia', str(dia)); p27.wait_for_timeout(200)
            if quando: p27.check(f'input[name=cdiaQuando][value={quando}]')
            p27.click('#dlg [data-a=saveSettings]'); p27.wait_for_timeout(800)
        # Critério 2: "A partir da próxima" não muda a mensalidade atual
        p27.click('[data-a=tab][data-v=grupo]'); p27.wait_for_timeout(900); p27.click('[data-a=settings]'); p27.wait_for_selector('#cdia')
        p27.select_option('#cdia', '20'); p27.wait_for_timeout(200)
        q27 = p27.inner_text('#cdiaQuando') if p27.locator('#cdiaQuando').count() else ''
        ok('fevereiro de 2026 vai até 19/03' in q27 and '(janeiro de 2026: 20/01 a 19/02)' in q27 and p27.is_checked('input[name=cdiaQuando][value=proxima]'),
           f'CT-KAN-209-02: ao mudar o dia, a janela pergunta "a partir de quando", com "A partir da próxima" marcada ({q27!r})')
        for tema in ['light', 'dark']:
            p27.emulate_media(color_scheme=tema); p27.wait_for_timeout(150)
            v27 = p27.evaluate("(()=>{const d=document.getElementById('dlgBody');return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, Math.min(...[...d.querySelectorAll('#cdiaQuando .chk-linha')].map(e=>e.getBoundingClientRect().height))]})()")
            ok(v27[0] and v27[1] and v27[2] >= 44, f'CT-KAN-209-07: em 360px ({tema}), Partidas e caixa sem rolagem lateral e as opções com 44px ({v27})')
            contraste(p27, f'Partidas e caixa ({tema})')
        p27.emulate_media(color_scheme='light'); p27.screenshot(path=f'{OUT}/v77-partidas-caixa-360.png')
        p27.click('#dlg [data-a=close]'); p27.wait_for_timeout(300)
        if p27.locator('#dlg .conf').count(): confirmar_app(p27, True)
        ciclo27(20, 'proxima')
        i27 = info27()
        ok(p27.evaluate("JSON.stringify(S.pc.ciclo)") == '[{"desde":"2026-03","dia":20}]' and 'fevereiro de 2026: 01/02 a 19/03' in i27,
           f'CT-KAN-209-02: "A partir da próxima" mantém a mensalidade atual (fevereiro), que vai até a véspera da próxima ({i27!r})')
        # Critério 1: "Já na atual" → em 10/02, com o ciclo no dia 20, a atual é janeiro (20/01 a 19/02)
        ciclo27(20, 'atual')
        i27 = info27()
        ok('janeiro de 2026: 20/01 a 19/02' in i27, f'CT-KAN-209-01: com o ciclo no dia 20, em 10/02 a mensalidade atual é a de janeiro (20/01 a 19/02) ({i27!r})')
        # Elenco antigo (desde 06/2025) e um novato (entrou hoje)
        mens27 = p27.evaluate("Object.keys(S.jog).filter(id=>!['diarista','isento'].includes(((S.pc||{}).tipos||{})[id]||'mensalista')).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        velho = int(datetime.datetime(2025, 6, 1).timestamp() * 1000)
        o27 = {}
        for id in mens27[:2]:
            d = p27.evaluate(LER, f'grupos/{g27}/jogadores/{id}'); d['criado'] = velho; o27[f'grupos/{g27}/jogadores/{id}'] = d
        p27.evaluate(PUT, o27); p27.reload(); p27.wait_for_timeout(1800)
        a1, a2, novato = mens27[0], mens27[1], mens27[2]
        n1, n2, nn = [p27.evaluate("(i)=>S.jog[i].name", x) for x in (a1, a2, novato)]
        info27(); at27 = p27.inner_text('#atrasoLista') if p27.locator('#atrasoLista').count() else ''
        linhas27 = [l for l in at27.split('\n') if 'de 20' in l]
        ok(n1 in at27 and n2 in at27 and 'dez. de 2025' in at27 and 'jul. de 2025' in at27 and 'jun. de 2025' not in at27,
           f'CT-KAN-209-04: "Em atraso" mostra as 6 mensalidades anteriores em aberto (dez./2025 a jul./2025), não a 7ª ({len(linhas27)} linhas)')
        ok(nn not in at27, f'CT-KAN-209-05: quem entrou no elenco depois não aparece em atraso nos meses anteriores ({nn})')
        # "Recebi" no atraso grava a mensalidade daquele mês com a data de hoje
        idx27 = p27.evaluate("(n)=>{const b=[...document.querySelectorAll('#atrasoLista li')].find(li=>li.textContent.includes(n)&&li.textContent.includes('dez.'));return b?b.querySelector('[data-a=payPend]').dataset.v:null}", n2)
        p27.click(f'#atrasoLista [data-a=payPend][data-v="{idx27}"]'); p27.wait_for_timeout(900)
        rc27 = p27.evaluate("(p)=>Object.values(S.caixa).filter(l=>l.pid===p).map(l=>[l.k,l.ref,l.d,l.v])", a2)
        ok(rc27 == [['mensal', '2025-12', '2026-02-10', 85]], f'CT-KAN-209-04: "Recebi" no atraso grava a mensalidade de dezembro com a data de hoje ({rc27})')
        p27.screenshot(path=f'{OUT}/v77-caixa-atraso-360.png', full_page=True)
        # Critério 3: Lançar vários meses de uma vez
        p27.click('[data-a=addLan]'); p27.wait_for_selector('#lanMeses')
        ok(p27.is_checked('#lanMeses .lm[value="2026-01"]'), 'CT-KAN-209-03: "Mensalidade de qual mês" já vem com a mensalidade atual (janeiro) marcada')
        p27.select_option('#lp2', a1)
        p27.locator('#lanMeses .chk-linha:has(.lm[value="2025-12"]) span').click(); p27.wait_for_timeout(150)
        ok(p27.input_value('#lv') == '170' and 'R$ 85,00' in p27.inner_text('#lanDivide').replace('\xa0', ' '), f'CT-KAN-209-03: com dois meses, o valor vira R$ 170 e a janela avisa que são 2 lançamentos de R$ 85')
        for tema in ['light', 'dark']:
            p27.emulate_media(color_scheme=tema); p27.wait_for_timeout(150)
            v27 = p27.evaluate("(()=>{const d=document.getElementById('dlgBody');return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, Math.min(...[...d.querySelectorAll('#lanMeses .chk-linha')].map(e=>e.getBoundingClientRect().height))]})()")
            ok(v27[0] and v27[1] and v27[2] >= 44, f'CT-KAN-209-07: em 360px ({tema}), Novo lançamento sem rolagem lateral e os meses com 44px ({v27})')
            contraste(p27, f'Novo lançamento ({tema})')
        p27.emulate_media(color_scheme='light'); p27.screenshot(path=f'{OUT}/v77-lancar-360.png')
        p27.click('#dlg [data-a=saveLan]'); p27.wait_for_timeout(1000)
        l27 = p27.evaluate("(p)=>Object.values(S.caixa).filter(l=>l.pid===p).map(l=>[l.ref,l.d,l.v]).sort()", a1)
        ok(l27 == [['2025-12', '2026-02-10', 85], ['2026-01', '2026-02-10', 85]], f'CT-KAN-209-03: dois lançamentos (dez. e jan., R$ 85 cada, com a data de hoje) ({l27})')
        ent27 = p27.inner_text('#caixaRaiz').replace('\xa0', ' ')
        pend27 = p27.inner_text('#pendLista'); at27b = p27.inner_text('#atrasoLista') if p27.locator('#atrasoLista').count() else ''
        ok('R$ 255,00' in ent27 and n1 not in pend27 and not [l for l in at27b.split('Recebi') if n1 in l and 'dez.' in l],
           'CT-KAN-209-03: os dois entram no fluxo do mês (R$ 255 com o Recebi) e saem das pendências (janeiro) e do atraso (dezembro)')
        ctx27.close()
        # ---------- v78 (KAN-212): Quadro do ano no Caixa (mensalistas × 12 meses)
        ctx28 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p28 = ctx28.new_page(); p28.on('pageerror', lambda e: errs.append(str(e)))
        p28.clock.install(time=datetime.datetime(2026, 10, 29, 15, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3))))
        abrir_entrada(p28, 'criar')
        p28.fill('#le', 'quadro78@teste.com'); p28.fill('#lp', 'Jogo@2026'); p28.fill('#lp2', 'Jogo@2026'); p28.keyboard.press('Enter'); p28.wait_for_selector('#ngBox', timeout=8000)
        p28.fill('#ngn', 'Quadro FC'); p28.click('[data-a=createGroup]'); p28.wait_for_function("location.hash.startsWith('#/g/')"); p28.wait_for_timeout(1500)
        g28 = p28.url.split('#/g/')[1]
        p28.click('[data-a=tab][data-v=jogadores]'); p28.wait_for_timeout(300); p28.click('[data-a=seed]'); p28.wait_for_timeout(1500)
        p28.click('[data-a=tab][data-v=grupo]'); p28.wait_for_timeout(900); p28.click('[data-a=settings]'); p28.wait_for_selector('#cm')
        p28.fill('#cm', '85'); p28.click('#dlg [data-a=saveSettings]'); p28.wait_for_timeout(800)
        mens28 = p28.evaluate("Object.keys(S.jog).filter(id=>(((S.pc||{}).tipos||{})[id]||'mensalista')==='mensalista').sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        a1, a2, a3 = mens28[0], mens28[1], mens28[2]
        n1, n2, n3 = [p28.evaluate("(i)=>S.jog[i].name", x) for x in (a1, a2, a3)]
        # Elenco: a1 e a2 desde 2025; a3 entrou em 10/06/2026. Grupo antigo: mensalidade de janeiro de a2 lançada antes do resumo
        # por jogador existir (sem privado/migracao.mens); a2 afastado em maio e junho, sem cobrança.
        o28 = {}
        for id, quando in ((a1, datetime.datetime(2025, 6, 1)), (a2, datetime.datetime(2025, 6, 1)), (a3, datetime.datetime(2026, 6, 10, 12))):
            d = p28.evaluate(LER, f'grupos/{g28}/jogadores/{id}'); d['criado'] = int(quando.timestamp() * 1000); o28[f'grupos/{g28}/jogadores/{id}'] = d
        o28[f'grupos/{g28}/caixa/velho1'] = {'k': 'mensal', 'v': 85, 'd': '2026-02-05', 'pid': a2, 'ref': '2026-01', 'note': ''}
        migr = p28.evaluate(LER, f'grupos/{g28}/privado/migracao') or {}; migr.pop('mens', None); o28[f'grupos/{g28}/privado/migracao'] = migr
        o28[f'grupos/{g28}/privado/afast'] = {'af1': {'pid': a2, 'mot': 'lesao', 'de': '2026-05', 'ate': '2026-06', 'em': 1}}
        pc = p28.evaluate(LER, f'grupos/{g28}/privado/caixa') or {}; pc['afIsen'] = {'af1': {'pid': a2, 'de': '2026-05', 'ate': '2026-06'}}; o28[f'grupos/{g28}/privado/caixa'] = pc
        p28.evaluate(PUT, o28); p28.reload(); p28.wait_for_timeout(1800)
        p28.click('[data-a=tab][data-v=caixa]'); p28.wait_for_timeout(1200)
        r28 = p28.evaluate(LER, f'grupos/{g28}/resumosCaixa/2026-01') or {}
        ok((r28.get('mens') or {}).get(a2) == 8500 and (p28.evaluate(LER, f'grupos/{g28}/privado/migracao') or {}).get('mens') == 1,
           f'CT-KAN-212-05: grupo antigo: na primeira abertura do Caixa, o resumo por jogador é montado com os lançamentos que já existiam ({r28})')
        # Lançar setembro e outubro de a1 (dois lançamentos): o resumo de cada competência soma na hora
        p28.click('[data-a=addLan]'); p28.wait_for_selector('#lanMeses'); p28.select_option('#lp2', a1)
        p28.locator('#lanMeses .chk-linha:has(.lm[value="2026-09"]) span').click(); p28.wait_for_timeout(150)
        p28.click('#dlg [data-a=saveLan]'); p28.wait_for_timeout(1000)
        s9 = ((p28.evaluate(LER, f'grupos/{g28}/resumosCaixa/2026-09') or {}).get('mens') or {}).get(a1)
        ok(s9 == 8500, f'CT-KAN-212-05: lançar a mensalidade soma no resumo da competência dela (setembro), não só no mês do dinheiro ({s9})')
        # Critério 1: abre o quadro (fechado por padrão) e confere cada situação
        ok(p28.locator('#quadroTab').count() == 0, 'CT-KAN-212-04: o Quadro do ano começa fechado (não pesa no Caixa)')
        p28.click('#quadroAno > summary'); p28.wait_for_selector('#quadroTab')
        est = p28.evaluate("""(ids)=>Object.fromEntries(ids.map(id=>{const tr=document.querySelector(`#quadroTab tr[data-pid="${id}"]`);return [id,tr?[...tr.querySelectorAll('td')].map(td=>(td.className.match(/q-(\\w+)/)||[])[1]):null]}))""", [a1, a2, a3])
        e1, e2, e3 = est[a1], est[a2], est[a3]
        ok(e1 and e1[8] == 'pago' and e1[9] == 'pago' and e1[0] == 'aberto' and e1[10] == 'futuro',
           f'CT-KAN-212-01: {n1}: set. e out. pagos, jan. em aberto, nov. ainda não venceu ({e1})')
        ok(e2 and e2[0] == 'pago' and e2[4] == 'isento' and e2[5] == 'isento' and e2[1] == 'aberto',
           f'CT-KAN-212-01: {n2}: jan. pago (lançado em fevereiro), mai. e jun. sem cobrança (afastado), fev. em aberto ({e2})')
        ok(e3 and all(x == 'antes' for x in e3[:5]) and e3[5] == 'aberto',
           f'CT-KAN-212-01: {n3}, que entrou em junho: jan. a mai. com "—" e junho em aberto ({e3})')
        nomes28 = p28.inner_text('#quadroTab tbody')
        tipos28 = p28.evaluate("Object.keys(S.jog).filter(id=>(((S.pc||{}).tipos||{})[id]||'mensalista')!=='mensalista').map(id=>S.jog[id].name)")
        ok(not [n for n in tipos28 if n in nomes28.split('\n')], f'CT-KAN-212-01: só mensalistas no quadro (fora: {tipos28})')
        pe28 = p28.locator(f'#quadroTab tr[data-pid="{a1}"] .q-pago').first.get_attribute('title') or ''
        ok('pago em' in pe28 and '29/10' in pe28 and 'R$' in pe28, f'CT-KAN-212-01: o "Pago" mostra a data e o valor ({pe28!r})')
        ft28 = p28.inner_text('#quadroTab tfoot').replace('\xa0', ' ')
        ok('Pagaram' in ft28 and 'Recebido' in ft28 and 'R$ 85' in ft28, f'CT-KAN-212-01: o rodapé mostra quantos pagaram e o total recebido por mês ({ft28!r})')
        # Critério 3: 360px, só a grade rola de lado, nome fixo, alvos de 44px, nos dois temas
        for tema in ['light', 'dark']:
            p28.emulate_media(color_scheme=tema); p28.wait_for_timeout(150)
            v28 = p28.evaluate("""(()=>{const r=document.querySelector('.quadro-rolar');r.scrollLeft=0;const n0=r.querySelector('tbody .q-nome').getBoundingClientRect().left;r.scrollLeft=400;const n1=r.querySelector('tbody .q-nome').getBoundingClientRect().left;const alt=Math.min(...[...r.querySelectorAll('tbody td,.q-btn')].map(e=>e.getBoundingClientRect().height));r.scrollLeft=0;return [document.documentElement.scrollWidth<=innerWidth, r.scrollWidth>r.clientWidth, Math.abs(n0-n1)<1, Math.round(alt)]})()""")
            ok(v28[0] and v28[1] and v28[2] and v28[3] >= 44, f'CT-KAN-212-03: em 360px ({tema}), só a grade rola de lado, com o nome fixo e alvos de 44px ({v28})')
            contraste(p28, f'Quadro do ano ({tema})')
            p28.locator('#quadroAno').screenshot(path=f'{OUT}/v78-quadro-{tema}-360.png')
        p28.emulate_media(color_scheme='light')
        # Critério 2: "Recebi" numa célula em aberto grava aquela competência com a data de hoje, e a célula vira Pago
        p28.locator(f'#quadroTab tr[data-pid="{a3}"] [data-a=payMes][data-v="2026-06"]').click(); p28.wait_for_timeout(900)
        l28 = p28.evaluate("(p)=>Object.values(S.caixa).filter(l=>l.pid===p).map(l=>[l.k,l.ref,l.d,l.v])", a3)
        c28 = p28.locator(f'#quadroTab tr[data-pid="{a3}"] td').nth(5).get_attribute('class')
        ok(l28 == [['mensal', '2026-06', '2026-10-29', 85]] and c28 == 'q-pago',
           f'CT-KAN-212-02: "Recebi" grava a mensalidade de junho com a data de hoje e a célula vira Pago ({l28}, {c28})')
        ok(p28.locator('#quadroAno').get_attribute('open') is not None, 'CT-KAN-212-02: o quadro continua aberto depois de lançar')
        p28.set_viewport_size({'width': 390, 'height': 844}); p28.wait_for_timeout(200)
        p28.locator('#quadroAno').screenshot(path=f'{OUT}/v78-quadro-390.png')
        ctx28.close()
        # ---------- v79 (KAN-213): rateio (vaquinha) no Caixa
        ctx29 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p29 = ctx29.new_page(); p29.on('pageerror', lambda e: errs.append(str(e)))
        p29.clock.install(time=datetime.datetime(2026, 10, 29, 15, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3))))
        abrir_entrada(p29, 'criar')
        p29.fill('#le', 'rateio79@teste.com'); p29.fill('#lp', 'Jogo@2026'); p29.fill('#lp2', 'Jogo@2026'); p29.keyboard.press('Enter'); p29.wait_for_selector('#ngBox', timeout=8000)
        p29.fill('#ngn', 'Rateio FC'); p29.click('[data-a=createGroup]'); p29.wait_for_function("location.hash.startsWith('#/g/')"); p29.wait_for_timeout(1500)
        p29.click('[data-a=tab][data-v=jogadores]'); p29.wait_for_timeout(300); p29.click('[data-a=seed]'); p29.wait_for_timeout(1500)
        p29.click('[data-a=tab][data-v=grupo]'); p29.wait_for_timeout(900); p29.click('[data-a=settings]'); p29.wait_for_selector('#cm')
        p29.fill('#cm', '85'); p29.fill('#cpx', 'pix.rateio@teste.com'); p29.click('#dlg [data-a=saveSettings]'); p29.wait_for_timeout(800)
        p29.click('[data-a=tab][data-v=caixa]'); p29.wait_for_timeout(1200)
        ok(p29.locator('#rateios').count() == 1 and p29.locator('[data-a=ratNovo]').count() == 1, 'CT-KAN-213-01: o Caixa tem a seção Rateios com "Novo rateio"')
        p29.click('[data-a=ratNovo]'); p29.wait_for_selector('#rtn'); p29.wait_for_timeout(200)
        ok(p29.evaluate("document.activeElement && document.activeElement.id") == 'rtn', 'CT-KAN-213-01: a janela abre com o cursor no nome')
        nmens29 = p29.evaluate("Object.keys(S.jog).filter(id=>(((S.pc||{}).tipos||{})[id]||'mensalista')==='mensalista').length")
        p29.click('#rtMensalistas'); p29.wait_for_timeout(150)
        ok(p29.locator('#rtPart .rtp:checked').count() == nmens29, f'CT-KAN-213-01: "Todos os mensalistas" marca os {nmens29} mensalistas')
        p29.click('#rtLimpar'); p29.wait_for_timeout(150)
        p29.fill('#rtn', 'Churrasco de dezembro'); p29.fill('#rtv', '505')
        ids29 = p29.evaluate("[...document.querySelectorAll('#rtPart .rtp')].map(x=>x.value)")[:7]
        for pid in ids29:
            p29.locator(f'#rtPart .rat-linha:has(.rtp[value="{pid}"]) .chk-linha span').click(); p29.wait_for_timeout(60)
        vals29 = p29.evaluate("[...document.querySelectorAll('#rtPart .rat-valor')].map(x=>x.value)")
        soma29 = p29.inner_text('#rtSoma').replace('\xa0', ' ')
        ok(vals29 == ['72.16'] + ['72.14'] * 6 and '7 participantes · soma R$ 505,00' in soma29,
           f'CT-KAN-213-01: R$ 505 entre 7: R$ 72,14 cada, centavos acertados no primeiro, e o total confere ({vals29}, {soma29!r})')
        for tema in ['light', 'dark']:
            p29.emulate_media(color_scheme=tema); p29.wait_for_timeout(150)
            v29 = p29.evaluate("(()=>{const d=document.getElementById('dlgBody');const alvos=[...d.querySelectorAll('.chk-linha,.rat-valor')].map(e=>e.getBoundingClientRect().height);const sm=[...d.querySelectorAll('#rtMensalistas,#rtLimpar')].map(e=>e.getBoundingClientRect().height);return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, Math.round(Math.min(...alvos)), Math.round(Math.min(...sm))]})()")
            ok(v29[0] and v29[1] and v29[2] >= 44 and v29[3] >= 36, f'CT-KAN-213-04: em 360px ({tema}), Novo rateio sem rolagem lateral, opções e valores com 44px e atalhos compactos com 36px ({v29})')
            contraste(p29, f'Novo rateio ({tema})')
        p29.emulate_media(color_scheme='light'); p29.screenshot(path=f'{OUT}/v79-novo-rateio-360.png')
        p29.click('#dlg [data-a=ratSalvar]'); p29.wait_for_timeout(900)
        rid29 = p29.evaluate("Object.keys((S.pc||{}).rat||{})[0]")
        r29 = p29.evaluate("(r)=>S.pc.rat[r]", rid29)
        ok(r29 and r29['n'] == 'Churrasco de dezembro' and sum(r29['part'].values()) == 50500 and r29.get('pend') is True,
           f'CT-KAN-213-01: o rateio é gravado com os 7 e o total de R$ 505 ({r29 and r29.get("part")})')
        card = f'#rat-{rid29}'
        ok(p29.locator(f'{card} .rat-faltam li').count() == 7 and 'falta R$ 505,00' in p29.inner_text(card).replace('\xa0', ' '),
           'CT-KAN-213-02: o cartão mostra quanto falta e os 7 em "Falta pagar"')
        # Critério 2: Recebi no cartão
        n2 = p29.evaluate("(i)=>S.jog[i].name", ids29[1])
        p29.click(f'{card} [data-a=ratRecebi][data-p="{ids29[1]}"]'); p29.wait_for_timeout(900)
        l29 = p29.evaluate("(p)=>Object.values(S.caixa).filter(l=>l.pid===p).map(l=>[l.k,l.v,l.d,l.rat,l.note])", ids29[1])
        ok(l29 == [['entrada', 72.14, '2026-10-29', rid29, 'Churrasco de dezembro']] and p29.evaluate("(a)=>S.pc.rat[a[0]].pg[a[1]]", [rid29, ids29[1]]) == 7214,
           f'CT-KAN-213-02: "Recebi" lança uma entrada com o jogador e o rateio, com a data de hoje ({l29})')
        falta29 = p29.inner_text(f'{card} .rat-faltam')
        ok(n2 not in falta29 and p29.locator(f'{card} .rat-faltam li').count() == 6, f'CT-KAN-213-02: {n2} sai de "Falta pagar"')
        ok('R$ 72,14' in p29.inner_text('#lanLista').replace('\xa0', ' '), 'CT-KAN-213-02: a entrada aparece no fluxo do mês do pagamento')
        # Decisão do Kleber: o rateio pode aparecer nas pendências do Caixa ("Recebi" lá também baixa no rateio)
        pend29 = p29.inner_text('#pendLista')
        n3 = p29.evaluate("(i)=>S.jog[i].name", ids29[2])
        ok('Churrasco de dezembro' in pend29 and n3 in pend29 and n2 not in [l for l in pend29.split('\n') if 'Churrasco' in l],
           'CT-KAN-213-05: com "Mostrar nas pendências do Caixa", quem falta aparece nas pendências do mês')
        idx29 = p29.evaluate("(n)=>{const li=[...document.querySelectorAll('#pendLista li')].find(x=>x.textContent.includes(n)&&x.textContent.includes('Churrasco'));return li?li.querySelector('[data-a=payPend]').dataset.v:null}", n3)
        p29.click(f'#pendLista [data-a=payPend][data-v="{idx29}"]'); p29.wait_for_timeout(900)
        ok(p29.evaluate("(a)=>S.pc.rat[a[0]].pg[a[1]]", [rid29, ids29[2]]) == 7214 and p29.locator(f'{card} .rat-faltam li').count() == 5,
           'CT-KAN-213-05: "Recebi" nas pendências lança no rateio e o jogador sai de "Falta pagar"')
        # Critério 3: cobrança só de quem falta, com o valor e o Pix
        p29.click(f'{card} [data-a=ratCobrar]'); p29.wait_for_timeout(500)
        tz29 = p29.input_value('#shtxt') if p29.locator('#shtxt').count() else ''
        faltam_n = [p29.evaluate("(i)=>S.jog[i].name", x) for x in [ids29[0]] + ids29[3:7]]
        ok('Churrasco de dezembro' in tz29 and all(n in tz29 for n in faltam_n) and n2 not in tz29 and n3 not in tz29
           and 'R$ 72,14' in tz29.replace('\xa0', ' ') and 'R$ 72,16' in tz29.replace('\xa0', ' ') and 'Pix: pix.rateio@teste.com' in tz29,
           f'CT-KAN-213-03: a cobrança lista só quem falta, com o valor de cada um e o Pix ({tz29!r})')
        p29.click('#dlg [data-a=close]'); p29.wait_for_timeout(300)
        # Despesa ligada ao rateio (fornecedor)
        p29.click('[data-a=addLan]'); p29.wait_for_selector('#lk'); p29.select_option('#lk', 'despesa'); p29.wait_for_timeout(150)
        p29.select_option('#lrat', rid29); p29.fill('#lv', '505'); p29.fill('#ln', 'Açougue')
        p29.click('#dlg [data-a=saveLan]'); p29.wait_for_timeout(300)
        if p29.locator('#dlg .conf').count(): confirmar_app(p29, True)
        p29.wait_for_timeout(800)
        ok('despesas R$ 505,00' in p29.inner_text(card).replace('\xa0', ' '), 'CT-KAN-213-06: despesa ligada ao rateio aparece no cartão')
        # Segundo rateio: valor fixo, um ajustado (2 camisas), fora das pendências
        p29.click('[data-a=ratNovo]'); p29.wait_for_selector('#rtn')
        p29.fill('#rtn', 'Camisa'); p29.check('input[name=rtModo][value=fixo]'); p29.fill('#rtv', '85')
        for pid in ids29[:3]:
            p29.locator(f'#rtPart .rat-linha:has(.rtp[value="{pid}"]) .chk-linha span').click(); p29.wait_for_timeout(60)
        p29.fill(f'#rtPart .rat-valor[data-p="{ids29[0]}"]', '170'); p29.wait_for_timeout(100)
        p29.uncheck('#rtpend')
        soma29b = p29.inner_text('#rtSoma').replace('\xa0', ' ')
        ok('3 participantes · soma R$ 340,00' in soma29b, f'CT-KAN-213-01: valor por pessoa com um ajuste (2 camisas = R$ 170) soma certo ({soma29b!r})')
        p29.click('#dlg [data-a=ratSalvar]'); p29.wait_for_timeout(900)
        ok('Camisa' not in p29.inner_text('#pendLista'), 'CT-KAN-213-05: rateio sem "Mostrar nas pendências" fica só no cartão')
        p29.emulate_media(color_scheme='light')
        for tema in ['light', 'dark']:
            p29.emulate_media(color_scheme=tema); p29.wait_for_timeout(150)
            v29 = p29.evaluate("(()=>{const s=document.getElementById('rateios');const alvos=[...s.querySelectorAll('button')].map(e=>e.getBoundingClientRect().height);return [document.documentElement.scrollWidth<=innerWidth, Math.round(Math.min(...alvos))]})()")
            ok(v29[0] and v29[1] >= 36, f'CT-KAN-213-04: em 360px ({tema}), os cartões de rateio sem rolagem lateral ({v29})')
            contraste(p29, f'Rateios ({tema})')
            p29.locator('#rateios').screenshot(path=f'{OUT}/v79-rateios-{tema}-360.png')
        p29.emulate_media(color_scheme='light')
        # Encerrar: quem não pagou fica registrado
        p29.click(f'{card} [data-a=ratEncerrar]'); confirmar_app(p29, True); p29.wait_for_timeout(800)
        ok(p29.evaluate("(r)=>!!S.pc.rat[r].fim", rid29) and 'Churrasco de dezembro' not in p29.inner_text('#pendLista'),
           'CT-KAN-213-07: "Encerrar" grava a data e o rateio sai das pendências')
        p29.click('.rat-fechados > summary'); p29.wait_for_timeout(300)
        t29 = p29.inner_text(card)
        ok('Não pagaram (5)' in t29 and 'encerrado' in t29 and p29.locator(f'{card} [data-a=ratRecebi]').count() == 0,
           f'CT-KAN-213-07: encerrado, quem não pagou fica registrado em "Não pagaram (5)"')
        # Critério 4 (no aparelho): continua depois de recarregar
        p29.reload(); p29.wait_for_timeout(1800); p29.click('[data-a=tab][data-v=caixa]'); p29.wait_for_timeout(1200)
        rr29 = p29.evaluate("(r)=>{const x=(S.pc.rat||{})[r];return x?[x.n, Object.keys(x.part).length, x.pg, !!x.fim]:null}", rid29)
        ok(rr29 and rr29[1] == 7 and rr29[2] == {ids29[1]: 7214, ids29[2]: 7214} and rr29[3],
           f'CT-KAN-213-04: o rateio, os pagamentos e o encerramento continuam depois de recarregar ({rr29})')
        ctx29.close()
        # ---------- v80 (KAN-214): avaliação de notas por link
        ctx30 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p30 = ctx30.new_page(); p30.on('pageerror', lambda e: errs.append(str(e)))
        p30.clock.install(time=datetime.datetime(2026, 10, 29, 15, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3))))
        abrir_entrada(p30, 'criar')
        p30.fill('#le', 'aval80@teste.com'); p30.fill('#lp', 'Jogo@2026'); p30.fill('#lp2', 'Jogo@2026'); p30.keyboard.press('Enter'); p30.wait_for_selector('#ngBox', timeout=8000)
        p30.fill('#ngn', 'Notas FC'); p30.click('[data-a=createGroup]'); p30.wait_for_function("location.hash.startsWith('#/g/')"); p30.wait_for_timeout(1500)
        g30 = p30.url.split('#/g/')[1]
        p30.click('[data-a=tab][data-v=jogadores]'); p30.wait_for_timeout(300); p30.click('[data-a=seed]'); p30.wait_for_timeout(1500)
        ok(p30.locator('[data-a=avAbrir]').count() == 1, 'CT-KAN-214-01: com a permissão de Notas, a aba Jogadores tem "Avaliação por link"')
        p30.click('[data-a=avAbrir]'); p30.wait_for_selector('[data-a=avNova]', timeout=8000)
        p30.click('[data-a=avNova]'); p30.wait_for_selector('#avT'); p30.wait_for_timeout(150)
        mens30 = p30.evaluate("Object.keys(S.jog).filter(id=>(((S.pc||{}).tipos||{})[id]||'mensalista')==='mensalista')")
        ok(p30.evaluate("document.activeElement && document.activeElement.id") == 'avT' and p30.locator('#avQuem .avj:checked').count() == len(mens30),
           f'CT-KAN-214-01: a nova avaliação abre com o cursor no título e já marca os {len(mens30)} mensalistas')
        p30.fill('#avData', '2026-11-05')
        p30.click('#dlg [data-a=avCriar]'); p30.wait_for_selector('#shtxt', timeout=8000)
        tz30 = p30.input_value('#shtxt')
        aid30 = p30.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return Object.keys(s).filter(k=>k.startsWith('grupos/'+g+'/avaliacoes/')&&k.split('/').length===4).map(k=>k.split('/')[3])[0]}", g30)
        ok(aid30 and f'#/p/{g30}/a/{aid30}' in tz30 and 'Notas FC' in tz30 and '05/11' in tz30,
           f'CT-KAN-214-01: criar já abre o compartilhar, com o link e o prazo ({tz30!r})')
        av30 = p30.evaluate(LER, f'grupos/{g30}/avaliacoes/{aid30}')
        alvo = sorted(mens30, key=lambda i: p30.evaluate("(i)=>S.jog[i].name", i))[0]
        nalvo = p30.evaluate("(i)=>S.jog[i].name", alvo)
        outros = [j for j in av30['jogs'] if j != alvo]
        antes30 = p30.evaluate("(i)=>S.rat&&S.rat.nivel?S.rat.nivel[i]:null", alvo)
        # Administrador dá a própria nota pelo app (5 para o alvo)
        p30.click('#dlg [data-a=close]'); p30.wait_for_timeout(200)
        p30.click('[data-a=avAbrir]'); p30.wait_for_selector(f'[data-a=avMinhas][data-v="{aid30}"]', timeout=8000)
        p30.click(f'[data-a=avMinhas][data-v="{aid30}"]'); p30.wait_for_selector('#avLista')
        ok(p30.locator('#avLista .aval-nota').count() == len(av30['jogs']) and 'Atual' not in p30.inner_text('#dlgBody'),
           'CT-KAN-214-02: "Minhas notas" lista todos os avaliados, sem mostrar a nota atual')
        p30.select_option(f'#avLista .aval-nota[data-p="{alvo}"]', '5'); p30.select_option(f'#avLista .aval-nota[data-p="{outros[0]}"]', '8')
        p30.click('#dlg [data-a=avEnviar]'); p30.wait_for_timeout(800)
        # Outros dois pelo link (gravados direto, como se fossem outros aparelhos)
        p30.evaluate(PUT, {f'grupos/{g30}/avaliacoes/{aid30}/notas/anon-x': {'pid': outros[0], 'n': {alvo: 6}, 't': 1},
                           f'grupos/{g30}/avaliacoes/{aid30}/notas/anon-y': {'pid': outros[1], 'n': {alvo: 9}, 't': 2},
                           f'grupos/{g30}/avaliacoes/{aid30}/notas/anon-z': {'pid': outros[1], 'n': {alvo: 2}, 't': 1}})
        # O link, sem conta (outro navegador com os mesmos dados de demonstração)
        est30 = ctx30.storage_state()
        ctx31 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo', storage_state=est30)
        ctx31.add_init_script("if(!sessionStorage.getItem('saiu')){localStorage.removeItem('pelada-demo-v2-u');sessionStorage.setItem('saiu','1')}")
        q = ctx31.new_page(); q.on('pageerror', lambda e: errs.append(str(e)))
        q.clock.install(time=datetime.datetime(2026, 10, 29, 16, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3))))
        q.goto(URL + f'#/p/{g30}/a/{aid30}'); q.wait_for_selector('#avNome', timeout=10000); q.wait_for_timeout(300)
        t31 = q.inner_text('main')
        ok('Avaliação de outubro' in t31 and 'Ninguém vê as notas dos outros' in t31 and q.locator('#avLista').count() == 0,
           'CT-KAN-214-03: o link mostra o título e a regra, e pede o nome antes das notas')
        q.select_option('#avNome', alvo); q.wait_for_selector('#avLista')
        linhas31 = q.inner_text('#avLista')
        vazios31 = [q.input_value(f'#avLista .aval-nota[data-p="{j}"]') for j in av30['jogs']]
        ok(q.locator('#avLista .aval-nota').count() == len(av30['jogs']) and q.locator('#avLista .lvl-tag').count() == 0
           and all(v == '' for v in vazios31),
           'CT-KAN-214-03: quem abre o link vê só nome e posição de cada um, sem nota atual nem dos outros (todas começam em "—")')
        q.select_option(f'#avLista .aval-nota[data-p="{alvo}"]', '7'); q.select_option(f'#avLista .aval-nota[data-p="{outros[0]}"]', '6.5')
        ok('2 de ' in q.inner_text('#avConta'), 'CT-KAN-214-03: o contador mostra quantos já têm nota')
        for tema in ['light', 'dark']:
            q.emulate_media(color_scheme=tema); q.wait_for_timeout(150)
            v31 = q.evaluate("(()=>[document.documentElement.scrollWidth<=innerWidth, Math.round(Math.min(...[...document.querySelectorAll('#avLista .aval-nota,#avNome,#avEnviar')].map(e=>e.getBoundingClientRect().height)))])()")
            ok(v31[0] and v31[1] >= 44, f'CT-KAN-214-06: link da avaliação em 360px ({tema}) sem rolagem lateral e com alvos de 44px ({v31})')
            contraste(q, f'Avaliação pelo link ({tema})')
        q.emulate_media(color_scheme='light'); q.screenshot(path=f'{OUT}/v80-avaliacao-link-360.png', full_page=True)
        q.click('#avEnviar'); q.wait_for_timeout(900)
        meu31 = q.evaluate("S.minhaAv")
        ok(meu31 and meu31['pid'] == alvo and meu31['n'] == {alvo: 7, outros[0]: 6.5} and q.locator('#avEnviado').count() == 1,
           f'CT-KAN-214-03: as notas são enviadas com o nome escolhido ({meu31})')
        q.reload(); q.wait_for_selector('#avLista', timeout=10000); q.wait_for_timeout(300)
        ok(q.input_value(f'#avLista .aval-nota[data-p="{alvo}"]') == '7' and 'Atualizar notas' in q.inner_text('#avEnviar'),
           'CT-KAN-214-03: depois de recarregar, o aparelho volta com o nome e as notas enviadas, e dá para mudar')
        uid31 = q.evaluate("S.user.uid"); doc31 = q.evaluate(LER, f'grupos/{g30}/avaliacoes/{aid30}/notas/{uid31}')
        ctx31.close()
        p30.evaluate(PUT, {f'grupos/{g30}/avaliacoes/{aid30}/notas/{uid31}': doc31})
        # Resultado: 5 (adm), 6, 9 (o 2 do mesmo nome é mais antigo e não vale) e 7 → média 6,75 e mediana 6,5
        p30.reload(); p30.wait_for_timeout(1500); p30.click('[data-a=tab][data-v=jogadores]'); p30.wait_for_timeout(400)
        p30.click('[data-a=avAbrir]'); p30.wait_for_selector(f'[data-a=avResultado][data-v="{aid30}"]', timeout=8000)
        p30.click(f'[data-a=avResultado][data-v="{aid30}"]'); p30.wait_for_selector('#avRes')
        lin = f'#avRes tr[data-pid="{alvo}"]'
        r30 = [p30.inner_text(f'{lin} .aval-media'), p30.inner_text(f'{lin} .aval-mediana'), p30.inner_text(f'{lin} .aval-qtd')]
        ok(r30 == ['6,75', '6,5', '4'], f'CT-KAN-214-04: {nalvo} com notas 5, 6, 7 e 9: média 6,75, mediana 6,5, 4 notas; a nota repetida do mesmo nome vale só a mais recente ({r30})')
        ok('4 responderam (1 pelo app)' in p30.inner_text('#avQuemRespondeu'), 'CT-KAN-214-04: mostra quantos responderam e quem')
        atual30 = p30.evaluate("(i)=>S.rat&&S.rat.nivel?S.rat.nivel[i]:null", alvo)
        ok(atual30 == antes30, f'CT-KAN-214-05: nada muda no cadastro sozinho ({antes30} → {atual30})')
        for tema in ['light', 'dark']:
            p30.emulate_media(color_scheme=tema); p30.wait_for_timeout(150)
            v30 = p30.evaluate("(()=>{const d=document.getElementById('dlgBody');return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1]})()")
            ok(v30[0] and v30[1], f'CT-KAN-214-06: resultado em 360px ({tema}): só a tabela rola de lado ({v30})')
            contraste(p30, f'Resultado da avaliação ({tema})')
        p30.emulate_media(color_scheme='light')
        p30.click('#avUsarMediana'); p30.wait_for_timeout(150)
        ok(p30.input_value(f'{lin} .aval-nova') == '6.5' and p30.is_checked(f'{lin} .avap'), 'CT-KAN-214-05: "Usar a mediana" preenche e marca')
        p30.fill(f'#avRes tr[data-pid="{outros[0]}"] .aval-nova', '7.2'); p30.wait_for_timeout(100)
        p30.screenshot(path=f'{OUT}/v80-resultado-360.png')
        p30.click('#dlg [data-a=avAplicar]'); p30.wait_for_timeout(900)
        n30 = p30.evaluate("(a)=>[S.rat.nivel[a[0]], S.rat.nivel[a[1]]]", [alvo, outros[0]])
        ok(n30 == [6.5, 7], f'CT-KAN-214-05: "Atualizar notas" grava no cadastro só as marcadas, de meio em meio ponto ({n30})')
        # Encerrar: o link para de receber notas
        p30.click(f'[data-a=avEncerrar][data-v="{aid30}"]'); confirmar_app(p30, True); p30.wait_for_timeout(700)
        ok(p30.evaluate(LER, f'grupos/{g30}/avaliacoes/{aid30}')['open'] is False, 'CT-KAN-214-07: "Encerrar" fecha a avaliação')
        p30.goto(URL + f'#/p/{g30}/a/{aid30}'); p30.wait_for_timeout(1500)
        ok('terminou' in p30.inner_text('main') and p30.locator('#avLista').count() == 0, 'CT-KAN-214-07: encerrada, o link avisa e não recebe mais notas')
        ctx30.close()
        # ---------- v81 (KAN-216): pessoas de fora do elenco no rateio
        ctx32 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p32 = ctx32.new_page(); p32.on('pageerror', lambda e: errs.append(str(e)))
        p32.clock.install(time=datetime.datetime(2026, 10, 29, 15, 0, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=-3))))
        abrir_entrada(p32, 'criar')
        p32.fill('#le', 'fora81@teste.com'); p32.fill('#lp', 'Jogo@2026'); p32.fill('#lp2', 'Jogo@2026'); p32.keyboard.press('Enter'); p32.wait_for_selector('#ngBox', timeout=8000)
        p32.fill('#ngn', 'Fora FC'); p32.click('[data-a=createGroup]'); p32.wait_for_function("location.hash.startsWith('#/g/')"); p32.wait_for_timeout(1500)
        p32.click('[data-a=tab][data-v=jogadores]'); p32.wait_for_timeout(300); p32.click('[data-a=seed]'); p32.wait_for_timeout(1500)
        p32.click('[data-a=tab][data-v=grupo]'); p32.wait_for_timeout(900); p32.click('[data-a=settings]'); p32.wait_for_selector('#cm')
        p32.fill('#cm', '85'); p32.fill('#cpx', 'pix.fora@teste.com'); p32.click('#dlg [data-a=saveSettings]'); p32.wait_for_timeout(800)
        njog32 = p32.evaluate("Object.keys(S.jog).length")
        p32.click('[data-a=tab][data-v=caixa]'); p32.wait_for_timeout(1200)
        p32.click('[data-a=ratNovo]'); p32.wait_for_selector('#rtn')
        p32.fill('#rtn', 'Churrasco'); p32.fill('#rtv', '300')
        ids32 = p32.evaluate("[...document.querySelectorAll('#rtPart .rtp')].map(x=>x.value)")[:2]
        for pid in ids32:
            p32.locator(f'#rtPart .rat-linha:has(.rtp[value="{pid}"]) .chk-linha span').click(); p32.wait_for_timeout(60)
        p32.fill('#rtFora', 'Primo do Bruno'); p32.press('#rtFora', 'Enter'); p32.wait_for_timeout(150)
        p32.fill('#rtFora', 'Vizinho'); p32.click('#rtForaAdd'); p32.wait_for_timeout(150)
        ok(p32.locator('#rtPart .rat-fora').count() == 2 and p32.input_value('#rtFora') == '' and p32.is_visible('#dlg'),
           'CT-KAN-216-01: "Adicionar" (ou Enter) põe a pessoa de fora no rateio e limpa o campo, sem fechar a janela')
        p32.locator('#rtPart .rat-fora:has-text("Vizinho") .rat-tirar').click(); p32.wait_for_timeout(150)
        # Sob carga, a divisão pode levar um instante para aparecer
        try: p32.wait_for_function("[...document.querySelectorAll('#rtPart .rat-valor')].every(x=>x.value&&x.value!=='0')", timeout=4000)
        except Exception: pass
        vals32 = p32.evaluate("[...document.querySelectorAll('#rtPart .rat-valor')].map(x=>x.value)")
        soma32 = p32.inner_text('#rtSoma').replace('\xa0', ' ')
        ok(p32.locator('#rtPart .rat-fora').count() == 1 and vals32 == ['100', '100', '100'] and '3 participantes · soma R$ 300,00' in soma32,
           f'CT-KAN-216-01: com "Primo do Bruno", R$ 300 entre 3 dá R$ 100 cada e o total confere; tirar quem não pagou funciona ({vals32}, {soma32!r})')
        for tema in ['light', 'dark']:
            p32.emulate_media(color_scheme=tema); p32.wait_for_timeout(150)
            v32 = p32.evaluate("(()=>{const d=document.getElementById('dlgBody');const a=[...d.querySelectorAll('.rat-fora .rat-valor,#rtFora,.rat-fora-nome')].map(e=>e.getBoundingClientRect().height);return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, Math.round(Math.min(...a))]})()")
            ok(v32[0] and v32[1] and v32[2] >= 44, f'CT-KAN-216-04: em 360px ({tema}), a parte "De fora do elenco" sem rolagem lateral e com 44px ({v32})')
            contraste(p32, f'Rateio com pessoa de fora ({tema})')
        p32.emulate_media(color_scheme='light')
        p32.locator('#rtPart .rat-fora').scroll_into_view_if_needed(); p32.screenshot(path=f'{OUT}/v81-rateio-fora-360.png')
        p32.click('#dlg [data-a=ratSalvar]'); p32.wait_for_timeout(900)
        rid32 = p32.evaluate("Object.keys((S.pc||{}).rat||{})[0]")
        r32 = p32.evaluate("(r)=>S.pc.rat[r]", rid32)
        fid = list((r32.get('fora') or {}).keys())[0] if r32.get('fora') else None
        ok(fid and fid.startswith('f_') and r32['fora'][fid] == 'Primo do Bruno' and r32['part'].get(fid) == 10000 and len(r32['fora']) == 1,
           f'CT-KAN-216-01: o rateio grava a pessoa de fora só com o nome ({r32.get("fora")})')
        card = f'#rat-{rid32}'
        ok('Primo do Bruno' in p32.inner_text(f'{card} .rat-faltam') and 'de fora' in p32.inner_text(f'{card} .rat-faltam'),
           'CT-KAN-216-01: no cartão, a pessoa aparece em "Falta pagar" com a etiqueta "de fora"')
        # Critério 3: não entra no elenco nem na mensalidade
        ok(p32.evaluate("Object.keys(S.jog).length") == njog32 and 'Primo do Bruno' not in p32.evaluate("Object.values(S.jog).map(j=>j.name).join('|')"),
           'CT-KAN-216-03: a pessoa de fora não entra no elenco')
        pend32 = [l for l in p32.inner_text('#pendLista').split('\n') if 'Primo do Bruno' in l]
        ok(pend32 and all('Churrasco' in l for l in pend32) and not [l for l in pend32 if 'Mensalidade' in l],
           f'CT-KAN-216-03: nas pendências, ela aparece só pelo rateio, nunca com mensalidade ({pend32})')
        # Critério 4: cobrança inclui quem é de fora
        p32.click(f'{card} [data-a=ratCobrar]'); p32.wait_for_timeout(500)
        tz32 = p32.input_value('#shtxt') if p32.locator('#shtxt').count() else ''
        ok('• Primo do Bruno: R$' in tz32 and 'Pix: pix.fora@teste.com' in tz32, f'CT-KAN-216-04: a cobrança do WhatsApp inclui a pessoa de fora ({tz32!r})')
        p32.click('#dlg [data-a=close]'); p32.wait_for_timeout(300)
        # Critério 2: Recebi
        p32.click(f'{card} [data-a=ratRecebi][data-p="{fid}"]'); p32.wait_for_timeout(900)
        l32 = p32.evaluate("(r)=>Object.values(S.caixa).filter(l=>l.rat===r).map(l=>[l.k,l.pid||null,l.fora||null,l.v,l.d,l.note])", rid32)
        ok(l32 == [['entrada', None, fid, 100, '2026-10-29', 'Churrasco — Primo do Bruno']] and p32.evaluate("(a)=>S.pc.rat[a[0]].pg[a[1]]", [rid32, fid]) == 10000,
           f'CT-KAN-216-02: "Recebi" lança uma entrada ligada ao rateio, sem jogador, com o nome na descrição ({l32})')
        ok('Primo do Bruno' not in p32.inner_text(f'{card} .rat-faltam') and 'Churrasco — Primo do Bruno' in p32.inner_text('#lanLista'),
           'CT-KAN-216-02: ela sai de "Falta pagar" e a entrada aparece no fluxo do mês')
        # Quem já pagou não pode ser tirado
        p32.click(f'{card} [data-a=ratEditar]'); p32.wait_for_selector('#rtPart .rat-fora')
        ok(p32.locator('#rtPart .rat-fora .rat-tirar').count() == 0, 'CT-KAN-216-01: depois de pagar, a pessoa de fora não pode ser tirada')
        p32.click('#dlg [data-a=close]'); p32.wait_for_timeout(300)
        if p32.locator('#dlg .conf').count(): confirmar_app(p32, True)
        p32.reload(); p32.wait_for_timeout(1800); p32.click('[data-a=tab][data-v=caixa]'); p32.wait_for_timeout(1200)
        rr32 = p32.evaluate("(a)=>{const x=S.pc.rat[a[0]];return [x.fora[a[1]], x.pg[a[1]]]}", [rid32, fid])
        ok(rr32 == ['Primo do Bruno', 10000] and 'Primo do Bruno' in p32.locator(f'{card} .rat-pagaram').text_content(), f'CT-KAN-216-04: continua depois de recarregar ({rr32})')
        ctx32.close()
        # ---------- v82 (KAN-217): gestão mais leve: o CSS de cada parte chega com ela; formulário do grupo e convite sob demanda
        ctx33 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p33 = ctx33.new_page(); p33.on('pageerror', lambda e: errs.append(str(e)))
        p33.goto(URL); p33.wait_for_timeout(1500)
        ld33 = p33.evaluate("(()=>{const h=document.querySelector('.ld-hero');return [!!document.getElementById('css-apresentacao'), h?getComputedStyle(h).position:null, h?getComputedStyle(h).backgroundImage.slice(0,25):null]})()")
        ok(ld33[0] and ld33[1] == 'relative' and (ld33[2] or '').startswith('repeating-linear'), f'CT-KAN-217-02: a página de apresentação traz o próprio estilo e aparece formatada ({ld33})')
        abrir_entrada(p33, 'criar')
        ok(p33.locator('#css-entrar').count() == 1, 'CT-KAN-217-02: a tela de criar conta traz o próprio estilo')
        p33.fill('#le', 'leve82@teste.com'); p33.fill('#lp', 'Jogo@2026'); p33.fill('#lp2', 'Jogo@2026'); p33.keyboard.press('Enter')
        p33.wait_for_selector('#ngBox', timeout=8000)
        ok(p33.locator('#ngn').count() == 1 and p33.locator('#dlg [data-a=createGroup]').count() == 1, 'CT-KAN-217-02: o formulário do grupo (agora sob demanda) abre depois do cadastro')
        p33.fill('#ngn', 'Leve FC'); p33.click('[data-a=createGroup]'); p33.wait_for_function("location.hash.startsWith('#/g/')"); p33.wait_for_timeout(1500)
        ok(p33.locator('#css-caixa').count() == 0 and p33.locator('#css-ranking').count() == 0, 'CT-KAN-217-01: ao abrir a gestão, o estilo do Caixa e do Ranking ainda não baixou (só chega com a aba)')
        p33.click('[data-a=tab][data-v=jogadores]'); p33.wait_for_timeout(300); p33.click('[data-a=seed]'); p33.wait_for_timeout(1500)
        p33.click('[data-a=tab][data-v=caixa]'); p33.wait_for_timeout(1200)
        q33 = p33.evaluate("(()=>{const s=document.querySelector('#quadroAno > summary');return [!!document.getElementById('css-caixa'), s?Math.round(s.getBoundingClientRect().height):0]})()")
        ok(q33[0] and q33[1] >= 44, f'CT-KAN-217-02: ao abrir o Caixa, o estilo dele chega junto e a tela fica igual (Quadro do ano com 44px) ({q33})')
        for tema in ['light', 'dark']:
            p33.emulate_media(color_scheme=tema); p33.wait_for_timeout(150)
            contraste(p33, f'Caixa com o estilo sob demanda ({tema})')
        p33.emulate_media(color_scheme='light')
        p33.click('[data-a=tab][data-v=grupo]'); p33.wait_for_timeout(900)
        p33.click('[data-a=editGroup]'); p33.wait_for_selector('#ngBox', timeout=8000)
        ok(p33.input_value('#ngn') == 'Leve FC', 'CT-KAN-217-02: "Editar grupo" abre o formulário (sob demanda) com os dados do grupo')
        p33.click('#dlg [data-a=close]'); p33.wait_for_timeout(300)
        if p33.locator('#dlg .conf').count(): confirmar_app(p33, True)
        ctx33.close()
        # ---------- v84 (KAN-218/219): textos no dicionário, telas montadas sem HTML em texto e ações de grupo sob demanda
        CRUA84 = r"\b(render|tema|pwa|erro|admgrupo|avulso|rodadm|novaRodada|jogador|sorteio|dia|comum|abas|publico|votacao)\.[a-zA-Z0-9]+\b"
        falta84 = []
        def sem_chave84(pg, onde):
            t = pg.inner_text('body'); m = re.findall(CRUA84, t)
            ok(not m, f'CT-KAN-219-02: {onde} sem chave de texto aparecendo crua ({m[:3]})')
        ctx35 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p35 = ctx35.new_page(); p35.on('pageerror', lambda e: errs.append(str(e)))
        p35.on('console', lambda m: falta84.append(m.text) if m.type == 'warning' and m.text.startswith('Texto sem tradução') else None)
        abrir_entrada(p35, 'criar')
        ok(p35.inner_text('#topright').strip() == '← Início', f'CT-KAN-218-02: na tela de criar conta, o cabeçalho mostra "← Início" ({p35.inner_text("#topright")!r})')
        p35.fill('#le', 'textos84@teste.com'); p35.fill('#lp', 'Jogo@2026'); p35.fill('#lp2', 'Jogo@2026'); p35.keyboard.press('Enter')
        p35.wait_for_selector('#ngBox', timeout=12000)
        ok(p35.inner_text('#dlg h3').strip() == 'Novo grupo', 'CT-KAN-218-03: "Novo grupo" (ação agora sob demanda) abre depois do cadastro com o título traduzido')
        p35.fill('#ngn', 'Textos FC'); p35.click('[data-a=createGroup]'); p35.wait_for_function("location.hash.startsWith('#/g/')"); p35.wait_for_timeout(1500)
        g35 = p35.url.split('#/g/')[1]
        abas35 = p35.evaluate("[...document.querySelectorAll('#tabs .tab')].map(b=>b.textContent.trim())")
        ok(abas35[:4] == ['Rodada', 'Histórico', 'Jogadores', 'Partida'] and 'Grupo' in abas35, f'CT-KAN-218-02: as abas aparecem com os nomes do dicionário ({abas35})')
        ok(p35.locator('#tabs [aria-selected=true]').count() == 1 and p35.locator('#rodadaRaiz').count() == 1, 'CT-KAN-218-02: a aba aberta fica marcada e a Rodada se desenha no lugar dela')
        sem_chave84(p35, 'Rodada')
        p35.click('[data-a=tab][data-v=jogadores]'); p35.wait_for_timeout(300); p35.click('[data-a=seed]'); p35.wait_for_timeout(1500)
        sem_chave84(p35, 'Jogadores')
        p35.click('[data-a=addPlayer]'); p35.wait_for_timeout(400)
        j35 = p35.evaluate("(()=>{const i=[...document.querySelectorAll('#dlgBody input.inp')];return [document.activeElement.id, i.length>0 && i.every(x=>x.getAttribute('enterkeyhint')==='done'), !!document.querySelector('#dlgBody #ppais option'), document.querySelector('#dlg h3').textContent]})()")
        ok(j35[0] == 'pnm' and j35[1] and j35[2] and j35[3] == 'Novo jogador', f'CT-KAN-218-04: a janela Novo jogador (componente) abre com o cursor no nome, Enter envia e o telefone tem a lista de países ({j35})')
        p35.fill('#pnm', 'Fulano'); p35.keyboard.press('Escape'); p35.wait_for_timeout(300)
        ok(p35.locator('#dlg .conf').count() == 1 and 'Descartar' in p35.inner_text('#dlg .conf'), 'CT-KAN-218-04: com algo digitado, fechar a janela pergunta antes de descartar')
        confirmar_app(p35, True); p35.wait_for_timeout(200)
        ok(not p35.evaluate("document.getElementById('dlg').open"), 'CT-KAN-218-04: Descartar fecha a janela')
        p35.click('[data-a=addPlayer]'); p35.wait_for_timeout(300)
        ok(p35.input_value('#pnm') == '', 'CT-KAN-218-04: reabrindo, a janela vem limpa (o componente anterior foi desmontado)')
        p35.click('#dlg [data-a=close]'); p35.wait_for_timeout(200)
        p35.click('[data-a=tab][data-v=rodada]'); p35.wait_for_timeout(600)
        if p35.locator('[data-a=newRod]').count():
            p35.locator('[data-a=newRod]').first.click(); p35.wait_for_timeout(400)
            ok('Nova rodada' in p35.inner_text('#dlg') and 'Quantidade de times' in p35.inner_text('#dlg'), 'CT-KAN-219-02: a janela Nova rodada mostra os textos do dicionário')
            sem_chave84(p35, 'janela Nova rodada')
            p35.click('#dlg [data-a=close]'); p35.wait_for_timeout(300)
            if p35.locator('#dlg .conf').count(): confirmar_app(p35, True)
        p35.reload(); p35.wait_for_timeout(1800)
        carregou = lambda: p35.evaluate("performance.getEntriesByType('resource').some(e=>/grupo-lote/.test(e.name))")
        # na cópia de um arquivo só (sem chunks/), não há o que baixar sob demanda: confere só a janela
        partes35 = p35.evaluate("performance.getEntriesByType('resource').some(e=>/\\/chunks\\//.test(e.name))")
        ok(not partes35 or not carregou(), 'CT-KAN-218-03: ao abrir a gestão, as ações de grupo ainda não baixaram (só chegam quando usadas)')
        p35.click('[data-a=groupsDlg]'); p35.wait_for_selector('#dlg[open] .plist', timeout=8000)
        ok((not partes35 or carregou()) and 'Seus grupos' in p35.inner_text('#dlg') and 'Textos FC' in p35.inner_text('#dlg'), 'CT-KAN-218-03: "⇄ Grupos" baixa as ações de grupo e abre "Seus grupos"')
        sem_chave84(p35, 'Seus grupos')
        p35.click('#dlg [data-a=close]') if p35.locator('#dlg [data-a=close]').count() else p35.keyboard.press('Escape'); p35.wait_for_timeout(300)
        p35.evaluate("document.getElementById('dlg').open && document.getElementById('dlg').close()")
        p35.click('[data-a=themeMenu]') if p35.locator('[data-a=themeMenu]:visible').count() else None
        p35.goto(URL + '#/g/grupoQueNaoExiste84'); p35.wait_for_timeout(2500)
        t35 = p35.inner_text('#main')
        ok('Grupo não encontrado' in t35 and p35.locator('#main a.btn[href="#/"]').count() == 1, f'CT-KAN-218-02: grupo inexistente mostra o aviso e o botão Meus grupos ({t35[:60]!r})')
        ctx35.close()
        ctx36 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo', color_scheme='light')
        p36 = ctx36.new_page(); p36.on('pageerror', lambda e: errs.append(str(e)))
        p36.on('console', lambda m: falta84.append(m.text) if m.type == 'warning' and m.text.startswith('Texto sem tradução') else None)
        abrir_entrada(p36, 'entrar')
        if p36.locator('[data-a=themeMenu]:visible').count():
            p36.locator('[data-a=themeMenu]:visible').first.click(); p36.wait_for_timeout(300)
            op36 = p36.evaluate("[...document.querySelectorAll('.theme-menu [role=menuitemradio]')].map(b=>[b.textContent.trim(), b.getAttribute('aria-checked')])")
            ok([o[0].lstrip('🌓☀️🌙') .split('agora')[0] for o in op36] == ['Automático', 'Claro', 'Escuro'] and op36[0][1] == 'true' and 'agora: claro' in op36[0][0],
               f'CT-KAN-218-02: o menu do tema (sem HTML em texto) mostra as 3 opções, Automático marcado, com "agora: claro" ({op36})')
            ok(p36.evaluate("document.activeElement.getAttribute('role')") == 'menuitemradio', 'CT-KAN-218-02: ao abrir o menu do tema, o foco vai para a opção atual')
            p36.keyboard.press('Escape'); p36.wait_for_timeout(200)
        ok(not falta84, 'CT-KAN-219-02: nenhum texto sem tradução nas telas da v84' + ('' if not falta84 else ': ' + ' | '.join(falta84[:4])))
        ctx36.close()
        # ---------- v83 (KAN-218/219): apresentação, convite, histórico e votação pública como componentes, com textos no dicionário
        CRUA = r"\b(apr|convite|hist|voto|publico|times)\.[a-z][A-Za-z]+\b"
        def sem_chave(pg, onde):
            t = pg.inner_text('body'); m = re.findall(CRUA, t)
            ok(not m, f'CT-KAN-219-01: {onde} sem chave de texto aparecendo crua ({m[:3]})')
        ctx34 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p34 = ctx34.new_page(); p34.on('pageerror', lambda e: errs.append(str(e)))
        p34.goto(URL); p34.wait_for_timeout(1500)
        chips34 = p34.evaluate("[...document.querySelectorAll('.ld-chips span')].map(s=>s.textContent)")
        ok(len(chips34) >= 3 and chips34[-1] == '🏅 e outros' and p34.locator('.ld-hero h1').count() == 1, f'CT-KAN-218-01: a apresentação (componente) mostra o título e os esportes ({chips34[-2:]})')
        sem_chave(p34, 'apresentação')
        p34.goto(URL + '#/convite/gx/tok'); p34.wait_for_timeout(1500)
        ok(p34.locator('#invHead').count() == 1 and p34.locator('#le').count() == 1, 'CT-KAN-218-01: o convite sem conta mostra o cabeçalho e o formulário de entrar')
        sem_chave(p34, 'convite sem conta')
        abrir_entrada(p34, 'criar')
        p34.fill('#le', 'telas83@teste.com'); p34.fill('#lp', 'Jogo@2026'); p34.fill('#lp2', 'Jogo@2026'); p34.keyboard.press('Enter')
        p34.wait_for_selector('#ngBox', timeout=12000)
        p34.fill('#ngn', 'Telas FC'); p34.click('[data-a=createGroup]'); p34.wait_for_function("location.hash.startsWith('#/g/')"); p34.wait_for_timeout(1500)
        g34 = p34.url.split('#/g/')[1]
        p34.click('[data-a=tab][data-v=jogadores]'); p34.wait_for_timeout(300); p34.click('[data-a=seed]'); p34.wait_for_timeout(1500)
        ids34 = p34.evaluate("Object.keys(S.jog).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        o34 = {f'grupos/{g34}/rodadas/rold': {'date': '2026-09-07', 'time': '20:00', 'place': 'Quadra X', 'np': 0, 'times': [{'c': 0, 'players': ids34[0:5]}, {'c': 1, 'players': ids34[5:10], 'res': [ids34[9]]}], 'matches': [{'id': 'm1', 'ga': 3, 'gb': 2, 'at': 1, 'goals': [{'t': 'a', 'pid': ids34[0]}]}]},
               f'grupos/{g34}/votacoes/v1': {'rid': 'rold', 'title': 'Destaques', 'open': True, 'cats': [{'id': 'mvp', 'name': 'Melhor da rodada'}]},
               f'grupos/{g34}/votacoes/v2': {'rid': 'rold', 'title': 'Bagre', 'open': False, 'cats': [{'id': 'b', 'name': 'Bagre da rodada'}], 'resultado': {'b': {'winners': [ids34[3]], 'counts': {ids34[3]: 4}}}}}
        for i, pid in enumerate(ids34[0:6]): o34[f'grupos/{g34}/rodadas/rold/presencas/{pid}'] = {'s': 'in', 't': i + 1}
        p34.evaluate(PUT, o34); p34.reload(); p34.wait_for_timeout(1800)
        p34.click('[data-a=tab][data-v=historico]'); p34.wait_for_timeout(1200)
        p34.fill('#hmes', '2026-09'); p34.click('[data-a=histBuscar]'); p34.wait_for_timeout(1200)
        ok(p34.locator('[data-a=histAbrir][data-v=rold]').count() == 1, 'CT-KAN-218-01: o Histórico (componente) busca pelo mês e lista a rodada')
        p34.click('[data-a=histModo][data-v=periodo]'); p34.wait_for_timeout(400)
        ok(p34.locator('#hde').count() == 1 and p34.locator('#hate').count() == 1, 'CT-KAN-218-01: o Histórico troca para a busca por período')
        p34.click('[data-a=histModo][data-v=mes]'); p34.wait_for_timeout(300)
        p34.click('[data-a=histAbrir][data-v=rold]'); p34.wait_for_timeout(1500)
        det34 = p34.inner_text('#histRaiz')
        ok('Quadra X' in det34 and '· reserva' in det34 and '· aberta' in det34, 'CT-KAN-218-01: o detalhe da rodada mostra local, times com reserva e as votações')
        sem_chave(p34, 'Histórico')
        p34.click('[data-a=histVoltar]'); p34.wait_for_timeout(400)
        p34.goto(URL + f'#/p/{g34}/v/v1'); p34.wait_for_timeout(1800)
        ok(p34.locator('[data-c=voter]').count() == 1, 'CT-KAN-218-01: a votação pública (componente) pede quem está votando')
        p34.select_option('[data-c=voter]', ids34[1]); p34.wait_for_timeout(600)
        p34.locator('[data-a=pubVote]').first.click(); p34.wait_for_timeout(900)
        sem_chave(p34, 'votação pública')
        p34.goto(URL + f'#/p/{g34}/v/v2'); p34.wait_for_timeout(1500)
        ok('Encerrada' in p34.inner_text('body') or 'encerrada' in p34.inner_text('body'), 'CT-KAN-218-01: a votação encerrada mostra o resultado')
        sem_chave(p34, 'votação encerrada')
        for tema in ['light', 'dark']:
            p34.emulate_media(color_scheme=tema); p34.wait_for_timeout(150)
            contraste(p34, f'Votação encerrada como componente ({tema})')
        p34.emulate_media(color_scheme='light')
        p34.goto(URL + f'#/convite/{g34}/tok'); p34.wait_for_timeout(1800)
        ok('Você já administra' in p34.inner_text('#main') and p34.locator('#main .btn.primary').count() >= 1, 'CT-KAN-218-01: o convite de quem já administra avisa e oferece abrir o grupo')
        sem_chave(p34, 'convite de quem já administra')
        p34.goto(URL + '#/convite/grupoQueNaoExiste/tok'); p34.wait_for_timeout(2000)
        sem_chave(p34, 'convite de grupo que não existe')
        p34.screenshot(path=f'{OUT}/83-convite-nao-encontrado.png')
        ctx34.close()
        # ---------- v86 (KAN-222): "Quem votou" na aba Votação, com a hora do servidor, as trocas e o aviso de 2 aparelhos
        ctx37 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p37 = ctx37.new_page(); p37.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p37, 'criar')
        p37.fill('#le', 'auditoria86@teste.com'); p37.fill('#lp', 'Jogo@2026'); p37.fill('#lp2', 'Jogo@2026'); p37.keyboard.press('Enter')
        p37.wait_for_selector('#ngBox', timeout=12000)
        p37.fill('#ngn', 'Auditoria FC'); p37.click('[data-a=createGroup]'); p37.wait_for_function("location.hash.startsWith('#/g/')"); p37.wait_for_timeout(1500)
        g37 = p37.url.split('#/g/')[1]
        p37.click('[data-a=tab][data-v=jogadores]'); p37.wait_for_timeout(300); p37.click('[data-a=seed]'); p37.wait_for_timeout(1500)
        ids37 = p37.evaluate("Object.keys(S.jog).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        nm37 = p37.evaluate("(ids)=>ids.map(i=>S.jog[i].name)", ids37)
        base37 = 1793404800000  # 30/10/2026 21:00 em São Paulo
        p37.evaluate(PUT, {
            f'grupos/{g37}/rodadas/rold': {'date': '2026-10-29', 'time': '20:00', 'place': '', 'np': 0, 'times': [{'c': 0, 'players': ids37[0:5]}, {'c': 1, 'players': ids37[5:10]}]},
            f'grupos/{g37}/votacoes/v1': {'rid': 'rold', 'title': 'Destaques', 'open': True, 'cats': [{'id': 'best', 'name': 'Melhor jogador'}], 'createdAt': 1},
            # aparelho A: votou em ids[2] e trocou para ids[3] (com as trocas, hora do servidor)
            f'grupos/{g37}/votacoes/v1/votos/devA': {'pid': ids37[0], 'v': {'best': ids37[3]}, 't': base37 + 600000},
            f'grupos/{g37}/votacoes/v1/trocas/x1': {'u': 'devA', 'pid': ids37[0], 'c': 'best', 'p': ids37[2], 'em': base37 + 120000},
            f'grupos/{g37}/votacoes/v1/trocas/x2': {'u': 'devA', 'pid': ids37[0], 'c': 'best', 'p': ids37[3], 'em': base37 + 600000},
            # aparelho B: o mesmo nome, votação antiga (sem trocas: vale a hora do aparelho)
            f'grupos/{g37}/votacoes/v1/votos/devB': {'pid': ids37[0], 'v': {'best': ids37[4]}, 't': base37 + 300000},
        })
        p37.reload(); p37.wait_for_timeout(1500)
        p37.click('[data-a=tab][data-v=votacao]'); p37.wait_for_selector('#quemVotou', timeout=8000)
        ok('Quem votou (2)' in p37.inner_text('#quemVotou > summary') and p37.locator('#quemVotou .aud-linha').count() == 0,
           'CT-KAN-222-01: a aba Votação tem "Quem votou (2)", recolhida (o resultado continua em cima)')
        p37.click('#quemVotou > summary'); p37.wait_for_selector('#quemVotou .aud-linha', timeout=5000)
        lin37 = p37.evaluate("[...document.querySelectorAll('#quemVotou .aud-linha')].map(l=>[l.dataset.u,l.querySelector('.aud-hora').textContent.trim(),l.querySelector('.aud-votos').textContent.trim(),!!l.querySelector('.aud-repetido')])")
        ok(lin37[0][0] == 'devA' and lin37[0][1] == '30/10, 21:10' and lin37[0][2] == 'Melhor jogador: ' + nm37[3],
           f'CT-KAN-222-01: cada voto mostra o nome, a data e a hora (do servidor) e a escolha em cada categoria ({lin37[0]})')
        ok(lin37[1][0] == 'devB' and 'hora do aparelho' in lin37[1][1], f'CT-KAN-222-01: voto sem trocas (votação antiga) mostra a hora do aparelho, marcada ({lin37[1]})')
        ok(lin37[0][3] and lin37[1][3], 'CT-KAN-222-03: o mesmo nome em 2 aparelhos aparece marcado ("votou em 2 aparelhos")')
        bt37 = p37.locator('#quemVotou .aud-linha[data-u=devA] .aud-ver')
        ok(bt37.inner_text() == 'Ver trocas (2)' and p37.locator('#quemVotou .aud-linha[data-u=devB] .aud-ver').count() == 0, 'CT-KAN-222-02: "Ver trocas (2)" só onde há trocas')
        bt37.click(); p37.wait_for_timeout(200)
        tr37 = p37.evaluate("[...document.querySelectorAll('#quemVotou .aud-linha[data-u=devA] .aud-trocas li')].map(x=>x.textContent)")
        ok(tr37 == [f'21:02 · Melhor jogador: {nm37[2]}', f'21:10 · Melhor jogador: {nm37[3]}'] and bt37.get_attribute('aria-expanded') == 'true',
           f'CT-KAN-222-02: as trocas aparecem em ordem, com a hora do servidor ({tr37})')
        al37 = p37.evaluate("[...document.querySelectorAll('#quemVotou > summary, #quemVotou .aud-ver')].map(e=>Math.round(e.getBoundingClientRect().height))")
        ok(min(al37) >= 44, f'CT-KAN-222-01: o resumo e "Ver trocas" têm pelo menos 44px ({al37})')
        ok(p37.evaluate("document.documentElement.scrollWidth") <= 360, 'CT-KAN-222-01: a 360px, nada passa da largura da tela')
        for tema in ['light', 'dark']:
            p37.emulate_media(color_scheme=tema); p37.wait_for_timeout(150)
            contraste(p37, f'Quem votou ({tema})')
            ok(p37.locator('#quemVotou .aud-trocas li').count() == 2, f'CT-KAN-222-02: a seção e as trocas continuam abertas quando a tela se desenha de novo ({tema})')
            p37.locator('#quemVotou').screenshot(path=f'{OUT}/86-quem-votou-{tema}.png')
        p37.emulate_media(color_scheme='light')
        # o voto pelo link grava a troca junto (mesmo aparelho, modo demonstração)
        p37.goto(URL + f'#/p/{g37}/v/v1'); p37.wait_for_selector('[data-c=voter]', timeout=8000)
        p37.select_option('[data-c=voter]', ids37[1]); p37.wait_for_timeout(400)
        p37.locator('[data-a=pubVote]').first.click(); p37.wait_for_timeout(800)
        meu37 = p37.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return Object.entries(s).filter(([k])=>k.startsWith('grupos/'+g+'/votacoes/v1/trocas/')).map(([,v])=>v)}", g37)
        novas37 = [t for t in meu37 if t.get('pid') == ids37[1]]
        ok(len(novas37) == 1 and novas37[0].get('c') == 'best' and isinstance(novas37[0].get('em'), (int, float)),
           f'CT-KAN-222-02: votar pelo link grava a troca junto com o voto, com a hora ({novas37})')
        p37.goto(URL + '#/g/' + g37); p37.wait_for_timeout(1200); p37.click('[data-a=tab][data-v=votacao]'); p37.wait_for_selector('#quemVotou', timeout=8000)
        ok('Quem votou (3)' in p37.inner_text('#quemVotou > summary'), 'CT-KAN-222-02: o voto novo entra em "Quem votou"')
        p37.click('[data-a=delVote]'); confirmar_app(p37, True); p37.wait_for_timeout(1000)
        sobra37 = p37.evaluate("(g)=>Object.keys(JSON.parse(localStorage.getItem('pelada-demo-v2'))).filter(k=>k.startsWith('grupos/'+g+'/votacoes/v1/')).length", g37)
        ok(sobra37 == 0, f'CT-KAN-222-06: excluir a votação apaga também os votos e as trocas ({sobra37} sobraram)')
        ctx37.close()
        # ---------- v88 (KAN-223/224, 222-09, 210, 211, 221): trocas sem repetição, caixa sem negativo, datas dos planos e prazo no fuso do grupo
        BRT88 = datetime.timezone(datetime.timedelta(hours=-3))
        ctx38 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p38 = ctx38.new_page(); p38.on('pageerror', lambda e: errs.append(str(e)))
        dlg38 = []; p38.on('dialog', lambda d: (dlg38.append(d.message), d.dismiss()))
        p38.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT88))
        abrir_entrada(p38, 'criar')
        p38.fill('#le', 'v88@teste.com'); p38.fill('#lp', 'Jogo@2026'); p38.fill('#lp2', 'Jogo@2026'); p38.keyboard.press('Enter')
        p38.wait_for_selector('#ngBox', timeout=12000)
        p38.fill('#ngn', 'Fuso FC'); p38.click('[data-a=createGroup]'); p38.wait_for_function("location.hash.startsWith('#/g/')"); p38.wait_for_timeout(1500)
        g38 = p38.url.split('#/g/')[1]
        # KAN-211: a transição acaba na virada de 28 para 29/11; os avisos mostram 28/11, o último dia que vale
        p38.wait_for_selector('#avisoNovidade', timeout=8000)
        nv38 = p38.inner_text('#avisoNovidade')
        ok('28/11/2026' in nv38 and '29/11' not in nv38, f'CT-KAN-211-01: o aviso "Novidade" diz "Até 28/11/2026", o último dia do Plano A grátis ({nv38[:90]!r})')
        p38.click('#avisoNovidade [data-a=planosDlg]'); p38.wait_for_selector('#dlg[open]', timeout=8000); p38.wait_for_timeout(300)
        pl38 = p38.inner_text('#dlg')
        ok('28/11/2026' in pl38 and '29/11' not in pl38, f'CT-KAN-211-02: a janela Planos mostra a mesma data, 28/11/2026 ({pl38[:120]!r})')
        p38.keyboard.press('Escape'); p38.wait_for_timeout(300)
        p38.click('[data-a=tab][data-v=jogadores]'); p38.wait_for_timeout(300); p38.click('[data-a=seed]'); p38.wait_for_timeout(1500)
        cfg38 = p38.evaluate("(S.app||{}).cfg||{}")
        ok(cfg38.get('fuso') == 'America/Sao_Paulo', f'CT-KAN-221-00: o grupo criado em São Paulo guarda o fuso do Brasil ({cfg38.get("fuso")})')
        ids38 = p38.evaluate("Object.keys(S.jog).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        # KAN-210: mensalidade e diária negativas não são gravadas
        p38.click('[data-a=tab][data-v=grupo]'); p38.wait_for_timeout(400)
        p38.click('[data-a=settings]'); p38.wait_for_selector('#cm', timeout=8000)
        p38.fill('#cm', '80'); p38.fill('#cd', '20'); p38.click('#dlg [data-a=saveSettings]'); p38.wait_for_timeout(800)
        pc38 = p38.evaluate("[S.pc&&S.pc.mensal, S.pc&&S.pc.diaria]")
        p38.click('[data-a=settings]'); p38.wait_for_selector('#cm', timeout=8000)
        p38.fill('#cm', '-50'); p38.click('#dlg [data-a=saveSettings]'); p38.wait_for_timeout(500)
        neg38 = p38.evaluate("[S.pc.mensal, S.pc.diaria, document.getElementById('dlg').open, document.activeElement&&document.activeElement.id, (document.getElementById('toast')||{}).textContent||'']")
        ok(pc38 == [80, 20] and neg38[0] == 80 and neg38[1] == 20 and neg38[2] and neg38[3] == 'cm' and 'não pode ser negativo' in neg38[4],
           f'CT-KAN-210-01: mensalidade -50 não é gravada; a janela continua aberta, com o cursor no campo e o motivo ({pc38}, {neg38})')
        p38.fill('#cm', '80'); p38.fill('#cd', '-10'); p38.click('#dlg [data-a=saveSettings]'); p38.wait_for_timeout(500)
        neg38b = p38.evaluate("[S.pc.diaria, document.getElementById('dlg').open, document.activeElement&&document.activeElement.id]")
        ok(neg38b == [20, True, 'cd'], f'CT-KAN-210-02: diária -10 também não é gravada, com o cursor na diária ({neg38b})')
        p38.fill('#cm', '0'); p38.fill('#cd', '0'); p38.click('#dlg [data-a=saveSettings]'); p38.wait_for_timeout(800)
        ok(p38.evaluate("[S.pc.mensal, S.pc.diaria, document.getElementById('dlg').open]") == [0, 0, False], 'CT-KAN-210-03: zero continua valendo (sem mensalidade) e fecha a janela')
        # KAN-222-09: nome com HTML aparece como texto em "Quem votou" e nas trocas
        mau38 = '<img src=x onerror=alert(1)>'
        p38.evaluate(PUT, {
            f'grupos/{g38}/jogadores/{ids38[0]}': dict(p38.evaluate(LER, f'grupos/{g38}/jogadores/{ids38[0]}') or {}, name=mau38),
            f'grupos/{g38}/rodadas/rold': {'date': '2026-11-03', 'time': '20:00', 'place': '', 'np': 0, 'times': [{'c': 0, 'players': ids38[0:5]}, {'c': 1, 'players': ids38[5:10]}]},
            f'grupos/{g38}/votacoes/v1': {'rid': 'rold', 'title': 'Destaques', 'open': True, 'cats': [{'id': 'best', 'name': 'Melhor jogador'}], 'createdAt': 1},
            # outro aparelho votou no jogador do nome com HTML
            f'grupos/{g38}/votacoes/v1/votos/devB': {'pid': ids38[3], 'v': {'best': ids38[0]}, 't': 1793800000000, 'nt': 1},
            f'grupos/{g38}/votacoes/v1/trocas/devB_1': {'u': 'devB', 'pid': ids38[3], 'c': 'best', 'p': ids38[0], 'em': 1793800000000},
        })
        # KAN-223/224: no link, 3 toques no mesmo nome (2 deles rápidos) e 1 em outro gravam só 2 trocas
        p38.goto(URL + f'#/p/{g38}/v/v1'); p38.reload(); p38.wait_for_selector('[data-c=voter]', timeout=8000)
        p38.select_option('[data-c=voter]', ids38[0]); p38.wait_for_timeout(400)
        bt38 = lambda pid: p38.locator(f'[data-a=pubVote][data-c2=best][data-p="{pid}"]')
        bt38(ids38[1]).click(); p38.wait_for_timeout(300); bt38(ids38[1]).dblclick(); p38.wait_for_timeout(300)
        bt38(ids38[2]).click(); p38.wait_for_timeout(800)
        uid38 = p38.evaluate("S.user&&S.user.uid")
        tr38 = p38.evaluate("(a)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return Object.entries(s).filter(([k])=>k.startsWith('grupos/'+a[0]+'/votacoes/v1/trocas/'+a[1])).map(([k,v])=>[k.split('/').pop(),v.p])}", [g38, uid38])
        ok(sorted(tr38) == sorted([[uid38 + '_1', ids38[1]], [uid38 + '_2', ids38[2]]]),
           f'CT-KAN-223-01: tocar de novo no mesmo nome (inclusive dois toques rápidos) não grava troca; só a troca de nome grava ({tr38})')
        vt38 = p38.evaluate(LER, f'grupos/{g38}/votacoes/v1/votos/{uid38}') or {}
        ok(vt38.get('nt') == 2 and (vt38.get('v') or {}).get('best') == ids38[2], f'CT-KAN-224-01: o voto guarda o contador de trocas junto ({vt38})')
        p38.goto(URL + '#/g/' + g38); p38.wait_for_timeout(1200); p38.click('[data-a=tab][data-v=votacao]'); p38.wait_for_selector('#quemVotou', timeout=8000)
        p38.click('#quemVotou > summary'); p38.wait_for_selector('#quemVotou .aud-linha', timeout=5000)
        p38.locator(f'#quemVotou .aud-linha[data-u="{uid38}"] .aud-ver').click(); p38.wait_for_timeout(300)
        p38.locator('#quemVotou .aud-linha[data-u=devB] .aud-ver').click(); p38.wait_for_timeout(300)
        li38 = p38.evaluate("(u)=>[...document.querySelectorAll('#quemVotou .aud-linha[data-u=\"'+u+'\"] .aud-trocas li')].map(x=>x.textContent)", uid38)
        ok(len(li38) == 2 and li38[0] != li38[1], f'CT-KAN-223-02: "Ver trocas" mostra 2 linhas, sem repetição ({li38})')
        qv38 = p38.inner_text('#quemVotou')
        ok(mau38 in qv38 and p38.locator('#quemVotou img').count() == 0 and not dlg38,
           f'CT-KAN-222-09: nome com HTML aparece como texto em "Quem votou" e nas trocas, sem executar ({dlg38})')
        # KAN-221: o organizador com o aparelho em Lisboa cria a avaliação até 06/11 de um grupo do Brasil
        est38 = ctx38.storage_state()
        ctx39 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='Europe/Lisbon', storage_state=est38)
        p39 = ctx39.new_page(); p39.on('pageerror', lambda e: errs.append(str(e)))
        p39.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT88))
        p39.goto(URL + '#/g/' + g38); p39.wait_for_timeout(1500)
        p39.click('[data-a=tab][data-v=jogadores]'); p39.wait_for_timeout(400)
        p39.click('[data-a=avAbrir]'); p39.wait_for_selector('[data-a=avNova]', timeout=8000)
        p39.click('[data-a=avNova]'); p39.wait_for_selector('#avT'); p39.wait_for_timeout(150)
        p39.fill('#avData', '2026-11-06'); p39.click('#dlg [data-a=avCriar]'); p39.wait_for_selector('#shtxt', timeout=8000)
        sh39 = p39.input_value('#shtxt')
        ok('Vale até 06/11' in sh39, f'CT-KAN-221-03: com o aparelho em Lisboa, o texto do compartilhar diz "até 06/11" ({sh39[:140]!r})')
        aid39 = p39.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return Object.keys(s).filter(k=>k.startsWith('grupos/'+g+'/avaliacoes/')&&k.split('/').length===4).map(k=>k.split('/')[3])[0]}", g38)
        ate39 = (p39.evaluate(LER, f'grupos/{g38}/avaliacoes/{aid39}') or {}).get('ate')
        fim06 = int(datetime.datetime(2026, 11, 6, 23, 59, 59, tzinfo=BRT88).timestamp() * 1000)
        p39.click('#dlg [data-a=close]'); p39.wait_for_timeout(200)
        p39.reload(); p39.wait_for_timeout(1500); p39.click('[data-a=tab][data-v=jogadores]'); p39.wait_for_timeout(300)
        p39.click('[data-a=avAbrir]'); p39.wait_for_selector(f'[data-a=avMinhas][data-v="{aid39}"]', timeout=8000)
        lj39 = p39.inner_text('#dlg')
        ok(ate39 == fim06 and 'até 06/11' in lj39 and '07/11' not in lj39,
           f'CT-KAN-221-04: o prazo fica gravado como fim de 06/11 em Brasília e continua 06/11 depois de recarregar ({ate39} x {fim06})')
        est39 = ctx39.storage_state(); ctx39.close()
        # O link aberto em vários fusos (sem conta): sempre "até 06/11"; fecha quando diz
        def link39(tz, quando):
            c = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id=tz, storage_state=est39)
            c.add_init_script("if(!sessionStorage.getItem('saiu')){localStorage.removeItem('pelada-demo-v2-u');sessionStorage.setItem('saiu','1')}")
            q = c.new_page(); q.on('pageerror', lambda e: errs.append(str(e)))
            q.clock.install(time=quando)
            q.goto(URL + f'#/p/{g38}/a/{aid39}'); q.wait_for_selector('main .panel', timeout=10000); q.wait_for_timeout(800)
            t = q.inner_text('main'); aberto = q.locator('#avNome').count() == 1
            c.close()
            return t, aberto
        meio = datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT88)
        tzs39 = {}
        for tz in ['Europe/Lisbon', 'America/Sao_Paulo', 'America/New_York', 'Asia/Tokyo']:
            t, _ = link39(tz, meio); tzs39[tz] = ('até 06/11' in t and '07/11' not in t)
        ok(tzs39['Europe/Lisbon'], f'CT-KAN-221-01: com o aparelho em Lisboa, o link diz "Dá para mudar até 06/11" ({tzs39})')
        ok(all(tzs39.values()), f'CT-KAN-221-02: em São Paulo, Nova York e Tóquio também, sempre "até 06/11" ({tzs39})')
        t1, ab1 = link39('Europe/Lisbon', datetime.datetime(2026, 11, 6, 23, 30, 0, tzinfo=BRT88))
        t2, ab2 = link39('Europe/Lisbon', datetime.datetime(2026, 11, 7, 0, 1, 0, tzinfo=BRT88))
        ok(ab1 and 'até 06/11' in t1 and not ab2 and 'terminou em 06/11' in t2,
           f'CT-KAN-221-05: em Lisboa, às 23:30 de Brasília ainda recebe notas; às 00:01 avisa que terminou em 06/11 ({ab1}, {ab2}, {t2[:80]!r})')
        # KAN-211: aviso 3 dias antes, em dias do calendário
        for dia, esp in [(27, 'acaba em 1 dia, em 28/11/2026'), (28, 'acaba hoje, 28/11/2026')]:
            c = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo', storage_state=est38)
            q = c.new_page(); q.on('pageerror', lambda e: errs.append(str(e)))
            q.clock.install(time=datetime.datetime(2026, 11, dia, 10, 0, 0, tzinfo=BRT88))
            q.goto(URL + '#/g/' + g38); q.wait_for_timeout(1500)
            t = q.inner_text('#avisoFimPlano') if q.locator('#avisoFimPlano').count() else ''
            ok(esp in t, f'CT-KAN-211-03: no dia {dia}/11, o aviso diz "{esp}" ({t[:100]!r})')
            c.close()
        ctx38.close()

        # ---------- v90 (KAN-164): app em inglês e espanhol; idioma de cada pessoa no menu da conta; link no idioma do celular
        BRT90 = datetime.timezone(datetime.timedelta(hours=-3))
        PT90 = re.compile(r'\b(Rodada|Jogadores|Partida|Caixa|Votação|Histórico|Salvar|Editar|confirmados|Mensalista|você|não)\b')
        ctx40 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p40 = ctx40.new_page(); p40.on('pageerror', lambda e: errs.append(str(e)))
        p40.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT90))
        abrir_entrada(p40, 'criar')
        p40.fill('#le', 'idioma90@teste.com'); p40.fill('#lp', 'Jogo@2026'); p40.fill('#lp2', 'Jogo@2026'); p40.keyboard.press('Enter')
        p40.wait_for_selector('#ngBox', timeout=12000)
        p40.fill('#ngn', 'Idiomas FC'); p40.click('[data-a=pickSport][data-v=basquete]'); p40.click('[data-a=createGroup]')
        p40.wait_for_function("location.hash.startsWith('#/g/')"); p40.wait_for_timeout(1500)
        g40 = p40.url.split('#/g/')[1]
        p40.click('[data-a=tab][data-v=jogadores]'); p40.wait_for_timeout(300); p40.click('[data-a=seed]'); p40.wait_for_timeout(1500)
        nomes40 = p40.evaluate("Object.values(S.jog).map(j=>j.name)")
        ok(p40.evaluate("document.documentElement.lang") == 'pt-BR' and 'Jogadores' in p40.inner_text('.tabs'), 'CT-KAN-164-08: navegador em português abre em português')
        # Menu da conta → Idioma
        p40.click('#topright [data-a=contaMenu]'); p40.wait_for_timeout(200)
        dica40 = p40.inner_text('.theme-menu [data-a=idiomaConta]')
        p40.click('.theme-menu [data-a=idiomaConta]'); p40.wait_for_selector('.theme-menu [data-a=setIdioma]', timeout=5000)
        op40 = p40.evaluate("[...document.querySelectorAll('.theme-menu [data-a=setIdioma]')].map(b=>[b.dataset.v,b.textContent,b.getAttribute('aria-checked')])")
        ok('Idioma' in dica40 and 'Português' in dica40 and op40 == [['pt-BR', 'Português', 'true'], ['en', 'English', 'false'], ['es', 'Español', 'false']],
           f'CT-KAN-164-01: o menu da conta tem "Idioma" (Português, English, Español, cada um na própria língua) ({dica40!r}, {op40})')
        p40.click('.theme-menu [data-a=setIdioma][data-v=en]'); p40.wait_for_timeout(1500)
        ok(p40.evaluate("document.documentElement.lang") == 'en' and 'Players' in p40.inner_text('.tabs'), 'CT-KAN-164-01: English vale na hora, sem recarregar')
        ok(p40.evaluate("localStorage.getItem('nj-idioma')") == 'en' and (p40.evaluate(LER, 'usuarios/' + p40.evaluate("S.user.uid")) or {}).get('idioma') == 'en',
           'CT-KAN-164-06: a escolha fica no aparelho e na conta (usuarios/{uid}.idioma)')
        # Todas as abas em inglês: nenhuma chave sem tradução e nenhuma palavra em português na tela
        pt40 = {}
        for aba in ['rodada', 'historico', 'jogadores', 'partida', 'ranking', 'caixa', 'votacao', 'grupo']:
            if p40.locator(f'[data-a=tab][data-v={aba}]').count():
                p40.click(f'[data-a=tab][data-v={aba}]'); p40.wait_for_timeout(900)
                t = p40.inner_text('body')
                for n in nomes40: t = t.replace(n, '')
                achou = sorted(set(PT90.findall(t)))
                if achou: pt40[aba] = achou
        sem40 = p40.evaluate("window.__njSemTraducao()")
        ok(not pt40 and sem40 == [], f'CT-KAN-164-01: em English, nenhuma aba mostra texto em português e nenhum texto ficou sem tradução ({pt40}, {sem40[:5]})')
        # Catálogo do esporte (basquete) e mensagens prontas
        ok('Basketball' in p40.inner_text('header'), 'CT-KAN-164-03: o nome do esporte vem do catálogo em inglês (Basketball)')
        p40.click('[data-a=tab][data-v=jogadores]'); p40.wait_for_timeout(400)
        p40.locator('[data-a=editPlayer]').first.click(); p40.wait_for_timeout(300)
        pos40 = p40.evaluate("[...document.querySelectorAll('#dlg select option')].map(o=>o.textContent)")
        ok(any('Point guard' in x for x in pos40) and not any('Armador' in x for x in pos40), f'CT-KAN-164-03: posições do basquete em inglês ({pos40[:6]})')
        p40.click('#dlg [data-a=close]'); p40.wait_for_timeout(200)
        if p40.locator('#dlg .conf').count(): confirmar_app(p40, True)
        p40.click('[data-a=tab][data-v=grupo]'); p40.wait_for_timeout(500)
        if p40.locator('[data-a=shareFixo]').count():
            p40.click('[data-a=shareFixo]'); p40.wait_for_selector('#shtxt', timeout=5000)
            sh40 = p40.input_value('#shtxt')
            ok('Always confirm your attendance' in sh40 and 'Idiomas FC' in sh40, f'CT-KAN-164-03: a mensagem pronta do WhatsApp sai em inglês, com o nome do grupo intacto ({sh40[:90]!r})')
            p40.click('#dlg [data-a=close]'); p40.wait_for_timeout(200)
        # Caixa: rótulos em inglês, valores em R$ no formato do Brasil (moeda e formato são do grupo)
        p40.click('[data-a=settings]'); p40.wait_for_selector('#cm', timeout=5000)
        p40.fill('#cm', '1234.5'); p40.click('#dlg [data-a=saveSettings]'); p40.wait_for_timeout(800)
        p40.click('[data-a=tab][data-v=caixa]'); p40.wait_for_timeout(1200)
        cx40 = p40.inner_text('main')
        ok('Funds balance' in cx40 and 'R$' in cx40 and '1.234,50' in cx40, f'CT-KAN-164-05: em English, o Caixa de um grupo do Brasil continua em R$ no formato brasileiro ({cx40[:120]!r})')
        # 360px e temas
        p40.set_viewport_size({'width': 360, 'height': 740})
        for aba in ['rodada', 'jogadores', 'caixa']:
            p40.click(f'[data-a=tab][data-v={aba}]'); p40.wait_for_timeout(500)
            for tema in ['light', 'dark']:
                p40.emulate_media(color_scheme=tema); p40.wait_for_timeout(150)
                contraste(p40, f'English {aba} ({tema})')
            ok(p40.evaluate("document.documentElement.scrollWidth") <= 360, f'CT-KAN-164-09: em English, a aba {aba} cabe em 360px sem rolagem lateral')
        p40.emulate_media(color_scheme='light'); p40.screenshot(path=f'{OUT}/90-english-caixa.png')
        # Recarregar e entrar em outro navegador (sem a escolha guardada no aparelho): continua em inglês, pela conta
        p40.reload(); p40.wait_for_timeout(1500)
        ok(p40.evaluate("document.documentElement.lang") == 'en' and 'Players' in p40.inner_text('.tabs'), 'CT-KAN-164-06: depois de recarregar, continua em inglês')
        est40 = ctx40.storage_state()
        ctx41 = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', timezone_id='America/Sao_Paulo', storage_state=est40)
        ctx41.add_init_script("if(!sessionStorage.getItem('limpo')){localStorage.removeItem('nj-idioma');sessionStorage.setItem('limpo','1')}")
        p41 = ctx41.new_page(); p41.on('pageerror', lambda e: errs.append(str(e)))
        p41.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT90))
        p41.goto(URL + '#/g/' + g40); p41.wait_for_timeout(2500)
        ok('Players' in p41.inner_text('.tabs'), 'CT-KAN-164-06: em outro aparelho (navegador em português, sem escolha guardada), o idioma vem da conta')
        ctx41.close()
        # Outro administrador (outra conta, navegador em português) continua em português
        ctx42 = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', timezone_id='America/Sao_Paulo')
        p42 = ctx42.new_page(); p42.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p42, 'criar')
        ok('Crie sua conta grátis' in p42.inner_text('main'), 'CT-KAN-164-07: cada pessoa vê o seu idioma: outra conta, em outro aparelho, continua em português')
        ctx42.close()
        # O link do jogador segue o idioma do celular (sem conta)
        def link40(locale):
            c = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', timezone_id='America/Sao_Paulo', locale=locale, storage_state=est40)
            c.add_init_script("if(!sessionStorage.getItem('saiu')){localStorage.removeItem('pelada-demo-v2-u');localStorage.removeItem('nj-idioma');sessionStorage.setItem('saiu','1')}")
            q = c.new_page(); q.on('pageerror', lambda e: errs.append(str(e)))
            q.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT90))
            q.goto(URL + f'#/p/{g40}'); q.wait_for_selector('[data-a=pubMark]', timeout=10000); q.wait_for_timeout(500)
            t = q.inner_text('main'); lang = q.evaluate("document.documentElement.lang")
            q.locator('[data-a=pubMark]').first.click(); q.wait_for_timeout(800)
            gravou = q.evaluate("Object.values(S.pres||{}).some(p=>p.s==='in'||p.s==='out')")
            c.close()
            return t, lang, gravou
        ten, len_, gen = link40('en-US')
        tes, les, ges = link40('es-AR')
        tpt, lpt, gpt = link40('pt-BR')
        ok(len_ == 'en' and "I'm in" in ten and 'Vou' not in ten and gen, f'CT-KAN-164-04: celular em inglês: o link aparece em inglês e a resposta grava ({len_})')
        ok(les == 'es' and 'Voy' in tes and gpt and lpt == 'pt-BR' and 'Vou' in tpt, f'CT-KAN-164-04: celular em espanhol abre em espanhol; em português, em português ({les}, {lpt})')
        # Voltar ao português, sem recarregar
        p40.set_viewport_size({'width': 390, 'height': 844})
        p40.click('#topright [data-a=contaMenu]'); p40.wait_for_timeout(200)
        p40.click('.theme-menu [data-a=idiomaConta]'); p40.wait_for_selector('.theme-menu [data-a=setIdioma]', timeout=5000)
        p40.click('.theme-menu [data-a=setIdioma][data-v=pt-BR]'); p40.wait_for_timeout(1000)
        ok(p40.evaluate("document.documentElement.lang") == 'pt-BR' and 'Jogadores' in p40.inner_text('.tabs') and 'Basquete' in p40.inner_text('header'),
           'CT-KAN-164-08: voltar para Português vale na hora, inclusive o nome do esporte')
        ctx40.close()

        # ---------- v91 (KAN-226, KAN-227): siglas no idioma; idioma sem conta (apresentação, entrar, link); Instalar app e WhatsApp
        BRT91 = datetime.timezone(datetime.timedelta(hours=-3))
        ctx43 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p43 = ctx43.new_page(); p43.on('pageerror', lambda e: errs.append(str(e)))
        p43.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT91))
        p43.goto(URL); p43.wait_for_selector('.ld-lang', timeout=10000); p43.wait_for_timeout(300)
        ok(p43.inner_text('.ld-lang').strip() == 'PT' and p43.evaluate("document.documentElement.scrollWidth") <= 360,
           'CT-KAN-227-01: a apresentação tem o botão de idioma (PT) no topo, sem rolagem lateral em 360px')
        p43.click('.ld-lang'); p43.wait_for_selector('.theme-menu [data-a=setIdioma]', timeout=5000)
        p43.click('.theme-menu [data-a=setIdioma][data-v=en]'); p43.wait_for_timeout(1500)
        ok('Fair teams.' in p43.inner_text('main') and p43.inner_text('.ld-lang').strip() == 'EN' and p43.evaluate("document.documentElement.lang") == 'en',
           'CT-KAN-227-01: escolher English na apresentação vale na hora')
        ok(p43.evaluate("document.getElementById('installBtn').textContent").strip() == '📲 Install app', 'CT-KAN-227-02: o botão de instalar segue o idioma (Install app)')
        abrir_entrada(p43, 'criar')
        ok(p43.locator('#langBtn').is_visible() and 'EN' in p43.inner_text('#langBtn') and 'Create your free account' in p43.inner_text('main'),
           'CT-KAN-227-01: a tela de criar conta também tem o botão de idioma e continua em inglês')
        p43.fill('#le', 'siglas91@teste.com'); p43.fill('#lp', 'Jogo@2026'); p43.fill('#lp2', 'Jogo@2026'); p43.keyboard.press('Enter')
        p43.wait_for_selector('#ngBox', timeout=12000)
        p43.fill('#ngn', 'Siglas FC'); p43.click('[data-a=pickSport][data-v=futebol]'); p43.click('[data-a=createGroup]')
        p43.wait_for_function("location.hash.startsWith('#/g/')"); p43.wait_for_timeout(1500)
        g43 = p43.url.split('#/g/')[1]
        ok(not p43.locator('#langBtn').is_visible(), 'CT-KAN-227-01: com conta, o idioma sai do topo (fica no menu da conta)')
        p43.click('[data-a=tab][data-v=jogadores]'); p43.wait_for_timeout(300); p43.click('[data-a=seed]'); p43.wait_for_timeout(1500)
        sig43 = sorted(set(p43.evaluate("[...document.querySelectorAll('main .pos')].map(e=>e.textContent.trim())")))
        db43 = sorted(set(p43.evaluate("Object.values(S.jog).map(j=>j.pos).filter(Boolean)")))
        ok(set(sig43) <= {'GK', 'DF', 'MF', 'FW'} and len(sig43) >= 3 and set(db43) <= {'GOL', 'DEF', 'MEI', 'ATA'},
           f'CT-KAN-226-01: em English, as siglas aparecem GK, DF, MF e FW, e o banco continua com GOL, DEF, MEI e ATA ({sig43}, {db43})')
        p43.click('[data-a=tab][data-v=rodada]'); p43.wait_for_timeout(600)
        p43.click('#porPosicao [data-a=abrirMinimos]'); p43.wait_for_timeout(400)
        ok('GK' in p43.inner_text('#minRaiz') and 'GOL' not in p43.inner_text('#minRaiz'), 'CT-KAN-226-01: a janela do mínimo mostra a sigla em inglês')
        p43.fill('#minRaiz .minp[data-k="GOL"]', '2'); p43.click('#dlg [data-a=salvarMinimos]'); p43.wait_for_timeout(800)
        fp43 = p43.inner_text('#porPosicao')
        ok('2 GK missing' in fp43 and 'GOL' not in fp43 and (p43.evaluate("S.app.cfg.minPos") or {}).get('GOL') == 2,
           f'CT-KAN-226-01: "Faltam 2" sai como "2 GK missing", e o mínimo fica gravado em GOL ({fp43[:80]!r})')
        p43.click('[data-a=shareConvite]'); p43.wait_for_selector('#shtxt', timeout=5000)
        zap43 = p43.input_value('#shtxt')
        ok('Confirm your attendance here:' in zap43 and 'Confirme' not in zap43, f'CT-KAN-227-03: o convite do WhatsApp sai em inglês ({zap43[:120]!r})')
        p43.click('#dlg [data-a=close]'); p43.wait_for_timeout(200)
        # O link do jogador sem conta também tem o botão de idioma
        est43 = ctx43.storage_state()
        c44 = b.new_context(viewport={'width': 360, 'height': 740}, service_workers='block', timezone_id='America/Sao_Paulo', storage_state=est43)
        c44.add_init_script("if(!sessionStorage.getItem('saiu')){localStorage.removeItem('pelada-demo-v2-u');localStorage.removeItem('nj-idioma');sessionStorage.setItem('saiu','1')}")
        q44 = c44.new_page(); q44.on('pageerror', lambda e: errs.append(str(e)))
        q44.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT91))
        q44.goto(URL + f'#/p/{g43}'); q44.wait_for_selector('[data-a=pubMark]', timeout=10000); q44.wait_for_timeout(300)
        ok(q44.locator('#langBtn').is_visible() and 'PT' in q44.inner_text('#langBtn') and 'Vou' in q44.inner_text('main'), 'CT-KAN-227-01: o link do jogador abre no idioma do celular (português) e tem o botão de idioma')
        q44.click('#langBtn'); q44.wait_for_selector('.theme-menu [data-a=setIdioma]', timeout=5000)
        q44.click('.theme-menu [data-a=setIdioma][data-v=es]'); q44.wait_for_timeout(1500)
        ok('Voy' in q44.inner_text('main') and 'ES' in q44.inner_text('#langBtn'),
           'CT-KAN-227-01: no link, trocar para Español vale na hora')
        q44.screenshot(path=f'{OUT}/91-link-es.png'); c44.close()
        ctx43.close()

        # ---------- v92 (KAN-228): extra da rodada (churrasco, pizzada…) com resposta separada do jogo, convidados e rateio
        BRT92 = datetime.timezone(datetime.timedelta(hours=-3))
        ctx92 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p92 = ctx92.new_page(); p92.on('pageerror', lambda e: errs.append(str(e)))
        p92.clock.install(time=datetime.datetime(2026, 11, 4, 12, 0, 0, tzinfo=BRT92))
        abrir_entrada(p92, 'criar')
        p92.fill('#le', 'extra92@teste.com'); p92.fill('#lp', 'Jogo@2026'); p92.fill('#lp2', 'Jogo@2026'); p92.keyboard.press('Enter'); p92.wait_for_selector('#ngBox', timeout=12000)
        p92.fill('#ngn', 'Churras FC'); p92.click('[data-a=pickSport][data-v=futebol]'); p92.click('[data-a=createGroup]')
        p92.wait_for_function("location.hash.startsWith('#/g/')"); p92.wait_for_timeout(1500)
        g92 = p92.url.split('#/g/')[1]
        p92.click('[data-a=tab][data-v=jogadores]'); p92.wait_for_timeout(300); p92.click('[data-a=seed]'); p92.wait_for_timeout(1500)
        js92 = p92.evaluate("Object.keys(S.jog).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        ja, jb, jc = js92[0], js92[1], js92[2]
        na, nb, nc = [p92.evaluate("(i)=>S.jog[i].name", x) for x in (ja, jb, jc)]
        # jc fica afastado neste mês: mesmo assim responde ao extra
        p92.click(f'[data-a=editPlayer][data-p="{jc}"]'); p92.wait_for_timeout(400)
        p92.click('#dlg [data-a=afastarDlg]'); p92.wait_for_selector('#afMot', timeout=8000); p92.wait_for_timeout(200)
        p92.select_option('#afMot', 'viagem'); p92.click('#dlg [data-a=afSalvar]'); p92.wait_for_timeout(800)
        p92.click('[data-a=tab][data-v=rodada]'); p92.wait_for_timeout(800)
        ok(p92.locator('#extraRodada').count() == 0 and p92.locator('[data-a=abrirExtra]').count() == 1,
           'CT-KAN-228-01: a rodada começa sem extra e tem o botão "🍖 Extra"')
        p92.click('[data-a=abrirExtra]'); p92.wait_for_selector('#exN', timeout=8000); p92.wait_for_timeout(300)
        for tema in ['light', 'dark']:
            p92.emulate_media(color_scheme=tema); p92.wait_for_timeout(150)
            v92 = p92.evaluate("(()=>{const d=document.getElementById('dlgBody');return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, document.activeElement.id]})()")
            ok(v92[0] and v92[1] and v92[2] == 'exN', f'CT-KAN-228-01: em 360px ({tema}), a janela do extra não tem rolagem lateral e o cursor vem no "O que vai ter" ({v92})')
            contraste(p92, f'janela do extra ({tema})')
        p92.emulate_media(color_scheme='light')
        p92.screenshot(path=f'{OUT}/92-extra-janela.png')
        p92.select_option('#exN', '_'); p92.wait_for_timeout(150)
        ok(p92.locator('#exOutro').is_visible(), 'CT-KAN-228-01: "Outro" mostra o campo do nome')
        p92.fill('#exOutro', ''); p92.click('#dlg [data-a=salvarExtra]'); p92.wait_for_timeout(400)
        ok(p92.locator('#exN').count() == 1 and p92.evaluate("document.activeElement.id") == 'exOutro', 'CT-KAN-228-01: sem nome, a janela não fecha e o cursor vai para o nome')
        p92.select_option('#exN', 'Churrasco'); p92.fill('#exV', '30'); p92.click('#dlg [data-a=salvarExtra]'); p92.wait_for_timeout(1200)
        rid92 = p92.evaluate("S.rid")
        ex92 = p92.evaluate("(i)=>i&&S.rod[i].extra", rid92)
        ok(ex92 == {'n': 'Churrasco', 'v': 30} and p92.locator('#extraRodada').count() == 1,
           f'CT-KAN-228-01: o extra fica ligado só nesta rodada, com nome e valor por pessoa, e o painel aparece na Rodada ({ex92})')
        ok(p92.locator('[data-a=abrirExtra]').count() == 1 and 'Ninguém respondeu' in p92.inner_text('#extraRodada'),
           'CT-KAN-228-01: o painel mostra que ninguém respondeu e tem "Editar extra"')
        p92.click('[data-a=shareConvite]'); p92.wait_for_selector('#shtxt', timeout=5000)
        zap92 = p92.input_value('#shtxt')
        ok('Depois tem Churrasco: responda no mesmo link, separado do jogo.' in zap92, f'CT-KAN-228-02: o convite do WhatsApp avisa do extra ({zap92[-120:]!r})')
        p92.click('#dlg [data-a=close]'); p92.wait_for_timeout(200)
        # Link do jogador, sem conta
        est92 = ctx92.storage_state()
        c93 = b.new_context(viewport={'width': 360, 'height': 740}, service_workers='block', timezone_id='America/Sao_Paulo', storage_state=est92)
        c93.add_init_script("if(!sessionStorage.getItem('saiu')){localStorage.removeItem('pelada-demo-v2-u');sessionStorage.setItem('saiu','1')}")
        q93 = c93.new_page(); q93.on('pageerror', lambda e: errs.append(str(e)))
        q93.clock.install(time=datetime.datetime(2026, 11, 4, 12, 5, 0, tzinfo=BRT92))
        q93.goto(URL + f'#/p/{g92}'); q93.wait_for_selector('#extraPainel', timeout=10000); q93.wait_for_timeout(300)
        ok('Churrasco depois do jogo' in q93.inner_text('#extraPainel') and 'R$' in q93.inner_text('#extraPainel'),
           'CT-KAN-228-03: o link mostra o extra, separado do jogo, com o valor por pessoa')
        ok(q93.evaluate("document.querySelector('#extraPainel details.extra-todos').open"), 'CT-KAN-228-03: sem nome escolhido no aparelho, a lista do extra já vem aberta')
        q93.click(f'#extraPainel [data-extra="{ja}"] [data-a=pubExtra][data-v=in]'); q93.wait_for_timeout(900)
        e93 = q93.evaluate("(p)=>[(S.ext[p]||{}).s, (S.pres[p]||{}).s||null]", ja)
        ok(e93 == ['in', None], f'CT-KAN-228-03: {na} vai só ao churrasco: a presença no jogo continua sem resposta ({e93})')
        q93.click(f'#extraPainel [data-extra="{jc}"] [data-a=pubExtra][data-v=in]'); q93.wait_for_timeout(900)
        ok(q93.evaluate("(p)=>(S.ext[p]||{}).s", jc) == 'in', f'CT-KAN-228-04: {nc}, afastado, também responde ao extra')
        q93.click(f'#extraPainel [data-extra="{jb}"] [data-a=pubExtra][data-v=out]'); q93.wait_for_timeout(900)
        # Convidados: até 3, com Enter
        for i, nome in enumerate(['Primo', 'Cunhado', 'Vizinho']):
            q93.click(f'#extraPainel [data-extra="{ja}"] [data-a=pubConvAbrir]'); q93.wait_for_timeout(250)
            if i == 0:
                ok(q93.evaluate("document.activeElement.id") == 'extraConv', 'CT-KAN-228-05: "+ Levar convidado" abre o campo com o cursor nele')
            q93.fill('#extraConv', nome); q93.keyboard.press('Enter'); q93.wait_for_timeout(700)
        cv93 = q93.evaluate("(p)=>S.ext[p].conv", ja)
        ok(cv93 == ['Primo', 'Cunhado', 'Vizinho'] and q93.locator(f'#extraPainel [data-extra="{ja}"] [data-a=pubConvAbrir]').count() == 0,
           f'CT-KAN-228-05: cada pessoa leva até 3 convidados; no limite, o botão some ({cv93})')
        tot93 = q93.inner_text('#extraTotal')
        ok('5 vão' in tot93 and '3 convidados' in tot93, f'CT-KAN-228-05: o total conta quem vai e os convidados ({tot93!r})')
        for tema in ['light', 'dark']:
            q93.emulate_media(color_scheme=tema); q93.wait_for_timeout(150)
            ok(q93.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'CT-KAN-228-03: em 360px ({tema}), o link com o extra não tem rolagem lateral')
            contraste(q93, f'extra no link ({tema})')
        q93.emulate_media(color_scheme='light')
        q93.locator('#extraPainel').screenshot(path=f'{OUT}/92-extra-link.png')
        alvo93 = q93.evaluate("Math.min(...[...document.querySelectorAll('#extraPainel [data-a=pubConvTirar],#extraPainel [data-a=pubExtra]')].map(e=>Math.round(Math.min(e.getBoundingClientRect().width,e.getBoundingClientRect().height))))")
        ok(alvo93 >= 44, f'CT-KAN-228-03: os botões do extra no link (Vou, Não vou e ✕ do convidado) têm alvo de 44px ({alvo93})')
        q93.click(f'#extraPainel [data-extra="{ja}"] [data-a=pubConvTirar][data-i="1"]'); q93.wait_for_timeout(700)
        ok(q93.evaluate("(p)=>S.ext[p].conv", ja) == ['Primo', 'Vizinho'], 'CT-KAN-228-05: dá para tirar um convidado')
        # Em inglês, o extra também aparece traduzido
        q93.evaluate("localStorage.setItem('nj-idioma','en')"); q93.reload(); q93.wait_for_selector('#extraPainel', timeout=10000); q93.wait_for_timeout(500)
        tx93 = q93.inner_text('#extraPainel')
        ok('after the game' in tx93 and 'going' in tx93 and 'depois' not in tx93 and not q93.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>k.startsWith('extra.'))"),
           f'CT-KAN-228-03: em English, o extra aparece traduzido ({tx93[:80]!r})')
        # O banco da demonstração fica em cada navegador: as respostas do link voltam para o navegador da gestão
        db93 = q93.evaluate("localStorage.getItem('pelada-demo-v2')")
        c93.close()
        p92.evaluate("(d)=>localStorage.setItem('pelada-demo-v2', d)", db93)
        # Gestão: o painel atualiza, adiciona do elenco e de fora, tira e cria o rateio com quem vai
        p92.reload(); p92.wait_for_selector('#extraRodada', timeout=10000); p92.wait_for_timeout(800)
        t92 = p92.inner_text('#extraRodada')
        ok(na in t92 and nc in t92 and 'Primo' in t92 and '4 vão' in t92 and '1 não vai' in t92,
           f'CT-KAN-228-06: a gestão vê quem vai, os convidados e quem não vai ({t92[:160]!r})')
        p92.evaluate("document.querySelector('#extraRodada details.extra-todos').open=true"); p92.wait_for_timeout(200)
        p92.select_option('#exAdd', jb); p92.click('#extraRodada [data-a=extraAdd]'); p92.wait_for_timeout(700)
        p92.fill('#exFora', 'Tio do Zé'); p92.click('#extraRodada [data-a=extraAddFora]'); p92.wait_for_timeout(700)
        f92 = p92.evaluate("Object.entries(S.ext).filter(([,a])=>a.nome).map(([k,a])=>[a.nome,a.s])")
        ok(p92.evaluate("(p)=>S.ext[p].s", jb) == 'in' and f92 == [['Tio do Zé', 'in']], f'CT-KAN-228-06: a gestão adiciona alguém do elenco e alguém de fora ({f92})')
        p92.click(f'#extraRodada [data-a=extraTirar][data-p="{jc}"]'); p92.wait_for_timeout(700)
        ok(p92.evaluate("(p)=>S.ext[p].s", jc) == 'out', 'CT-KAN-228-06: tirar alguém do elenco marca "não vai"')
        if p92.locator('#extraRodada [data-a=extraRateio]').count():
            p92.click('#extraRodada [data-a=extraRateio]'); p92.wait_for_selector('#rtn', timeout=10000); p92.wait_for_timeout(500)
            ok(p92.input_value('#rtn').startswith('Churrasco') and p92.input_value('#rtv') == '30',
               f'CT-KAN-228-07: o rateio do extra já vem com o nome e o valor por pessoa ({p92.input_value("#rtn")!r})')
            p92.click('#dlg [data-a=ratSalvar]'); p92.wait_for_timeout(1000)
            r92 = p92.evaluate("(()=>{const r=Object.values((S.pc||{}).rat||{}).find(r=>r.n.startsWith('Churrasco'));return r?[Object.keys(r.part).length,Object.values(r.fora||{}).sort()]:null})()")
            ok(r92 and r92[0] == 5 and r92[1] == sorted(['Tio do Zé', f'Primo (convidado de {na})', f'Vizinho (convidado de {na})']),
               f'CT-KAN-228-07: o rateio entra com quem vai, os de fora e os convidados ({r92})')
        else:
            ok(False, 'CT-KAN-228-07: o painel do extra tem "Criar rateio" (Caixa liberado na demonstração)')
        # Desligar: o painel some e o convite volta ao normal
        p92.click('[data-a=tab][data-v=rodada]'); p92.wait_for_timeout(600)
        p92.click('#extraRodada [data-a=abrirExtra]'); p92.wait_for_selector('#exN', timeout=8000)
        p92.click('#dlg [data-a=desligarExtra]'); confirmar_app(p92, True); p92.wait_for_timeout(900)
        ok(p92.locator('#extraRodada').count() == 0 and not p92.evaluate("(i)=>S.rod[i].extra", rid92),
           'CT-KAN-228-01: desligar tira o extra da rodada (com confirmação)')
        ctx92.close()
        # ---------- v93 (KAN-229, KAN-232, KAN-231): corrigir gol na partida; partidas e votação no WhatsApp; planilha da votação
        BRT93 = datetime.timezone(datetime.timedelta(hours=-3))
        ctx93 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo', accept_downloads=True)
        p93 = ctx93.new_page(); p93.on('pageerror', lambda e: errs.append(str(e)))
        p93.clock.install(time=datetime.datetime(2026, 11, 5, 20, 0, 0, tzinfo=BRT93))
        abrir_entrada(p93, 'criar')
        p93.fill('#le', 'v93@teste.com'); p93.fill('#lp', 'Jogo@2026'); p93.fill('#lp2', 'Jogo@2026'); p93.keyboard.press('Enter'); p93.wait_for_selector('#ngBox', timeout=12000)
        p93.fill('#ngn', 'Placar FC'); p93.click('[data-a=pickSport][data-v=futebol]'); p93.click('[data-a=createGroup]')
        p93.wait_for_function("location.hash.startsWith('#/g/')"); p93.wait_for_timeout(1500)
        g93 = p93.url.split('#/g/')[1]
        elenco_e_presenca(p93, 10); sortear(p93)
        p93.click('[data-a=tab][data-v=partida]'); p93.wait_for_selector('[data-a=goal]', timeout=10000); p93.wait_for_timeout(400)
        ok(p93.locator('[data-a=corrigirGols]').is_disabled(), 'CT-KAN-229-01: sem gol, "Corrigir" fica desligado')
        def gol93(lado, n):
            p93.locator(f'[data-a=goal][data-v={lado}]').first.click(); p93.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
            sem_assist(p93)
            p93.locator('[data-a=addGoal][data-p]').nth(n).click(); p93.wait_for_timeout(300)
            sem_assist(p93)
        gol93('a', 0); gol93('b', 0); gol93('a', 1)
        g0 = p93.evaluate("S.live.goals.map(g=>[g.t,g.pid])")
        ok([x[0] for x in g0] == ['a', 'b', 'a'], f'CT-KAN-229-01: três gols marcados ({g0})')
        p93.click('[data-a=corrigirGols]'); p93.wait_for_selector('#cgRaiz .gols-lado', timeout=5000); p93.wait_for_timeout(300)
        for tema in ['light', 'dark']:
            p93.emulate_media(color_scheme=tema); p93.wait_for_timeout(150)
            v93 = p93.evaluate("(()=>{const d=document.getElementById('dlgBody');return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, document.activeElement.classList.contains('ed-autor'), Math.min(...[...d.querySelectorAll('button,select')].map(e=>Math.round(e.getBoundingClientRect().height)))]})()")
            ok(v93[0] and v93[1] and v93[2] and v93[3] >= 36, f'CT-KAN-229-01: em 360px ({tema}), a janela Corrigir não tem rolagem lateral, o cursor vem no 1º autor e os botões têm alvo ({v93})')
            contraste(p93, f'janela Corrigir o placar ({tema})')
        p93.emulate_media(color_scheme='light')
        p93.screenshot(path=f'{OUT}/93-corrigir.png')
        # Trocar o autor do 1º gol do Time 1 e tirar o gol do Time 2 (o do meio)
        outro93 = p93.evaluate("(()=>{const o=[...document.querySelectorAll('#cgRaiz [data-lado=a] .ed-autor')][0].options;return [...o].map(x=>x.value).find(v=>v.startsWith('p:')&&v.slice(2)!==S.live.goals[0].pid&&v.slice(2)!==S.live.goals[2].pid)})()")
        p93.locator('#cgRaiz [data-lado=a] .ed-autor').first.select_option(outro93); p93.wait_for_timeout(200)
        p93.locator('#cgRaiz [data-lado=b] .btn.danger').first.click(); p93.wait_for_timeout(200)
        ok('Aplicar: 2 × 0' in p93.inner_text('#dlg [data-a=salvarCorrecao]'), 'CT-KAN-229-01: o botão mostra o placar corrigido (2 × 0) antes de aplicar')
        p93.click('#dlg [data-a=salvarCorrecao]'); p93.wait_for_timeout(500)
        g1 = p93.evaluate("S.live.goals.map(g=>[g.t,g.pid])")
        ok(g1 == [['a', outro93[2:]], ['a', g0[2][1]]] and [s.strip() for s in p93.locator('.board .sc').all_inner_texts()] == ['2', '0'],
           f'CT-KAN-229-01: o 1º gol troca de autor, o do meio sai e o 3º continua igual; o placar fica 2 × 0 ({g1})')
        p93.click('[data-a=saveMatch]'); p93.wait_for_timeout(1000)
        p93.reload(); p93.wait_for_timeout(1500); p93.click('[data-a=tab][data-v=partida]'); p93.wait_for_timeout(1200)
        s93 = p93.evaluate("Object.values(S.parts||{}).filter(m=>m.tipo!=='art').map(m=>[m.ga,m.gb,m.goals.map(g=>g.pid)])")
        ok(s93 == [[2, 0, [outro93[2:], g0[2][1]]]], f'CT-KAN-229-01: a partida salva guarda os gols corrigidos, depois de recarregar ({s93})')
        # KAN-232: partidas desta rodada no WhatsApp
        p93.click('[data-a=zapPartidas]'); p93.wait_for_selector('#shtxt', timeout=5000)
        z93 = p93.input_value('#shtxt'); n93 = [p93.evaluate("(i)=>S.jog[i].name", x) for x in (outro93[2:], g0[2][1])]
        ok(z93.startswith('⚽ *Partidas — ') and f'*2 × 0*' in z93 and f'({n93[0]}, {n93[1]})' in z93 and '🏅 *Artilharia*:' in z93 and '🏆' not in z93 and 'Detalhes: ' in z93,
           f'CT-KAN-232-01: "Mandar no WhatsApp" das partidas traz o placar, quem marcou e a artilharia; com 2 times, sem classificação ({z93[:160]!r})')
        hw93 = p93.get_attribute('#dlg a.btn.primary', 'href') or ''
        ok(hw93.startswith('https://api.whatsapp.com/send?text=%E2%9A%BD%20') and '%F0%9F%9F%A7' in hw93 and 'wa.me' not in hw93,
           f'CT-KAN-234-01: "Abrir no WhatsApp" vai direto para api.whatsapp.com com os emojis codificados, sem o wa.me ({hw93[:70]})')
        p93.click('#dlg [data-a=close]'); p93.wait_for_timeout(200)
        # Histórico: rodada antiga com 4 times e as 8 partidas da foto do Kleber
        ids93 = p93.evaluate("Object.keys(S.jog).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")
        nm93 = lambda i: p93.evaluate("(x)=>S.jog[x].name", ids93[i])
        o93 = {f'grupos/{g93}/rodadas/rold': {'date': '2026-09-03', 'time': '20:00', 'place': 'Quadra 93', 'np': 8,
               'times': [{'c': 0, 'players': ids93[0:3]}, {'c': 1, 'players': ids93[3:6]}, {'c': 2, 'players': ids93[6:9]}, {'c': 3, 'players': ids93[9:12]}]}}
        jogos93 = [(0, 1, 1, 0, 0), (3, 2, 1, 0, 9), (2, 0, 0, 5, 1), (3, 1, 1, 1, 10), (3, 0, 3, 0, 9), (1, 2, 4, 1, 3), (1, 2, 1, 2, 6), (3, 0, 1, 2, 11)]
        for k, (ta, tb, ga, gb, autor) in enumerate(jogos93):
            gols = [{'t': 'a', 'pid': ids93[autor]}] * ga + [{'t': 'b', 'pid': ids93[(tb * 3)]}] * gb
            o93[f'grupos/{g93}/rodadas/rold/partidas/m{k}'] = {'at': k + 1, 'ta': ta, 'tb': tb, 'ca': ta, 'cb': tb, 'ga': ga, 'gb': gb, 'goals': gols}
        p93.evaluate(PUT, o93); p93.reload(); p93.wait_for_timeout(1500)
        p93.click('[data-a=tab][data-v=historico]'); p93.wait_for_timeout(1200)
        p93.fill('#hmes', '2026-09'); p93.click('[data-a=histBuscar]'); p93.wait_for_timeout(1200)
        p93.click('[data-a=histAbrir][data-v=rold]'); p93.wait_for_selector('[data-a=histZap]', timeout=8000)
        p93.click('[data-a=histZap]'); p93.wait_for_selector('#shtxt', timeout=5000)
        h93 = p93.input_value('#shtxt')
        tab93 = h93.split('🏆')[1] if '🏆' in h93 else ''
        ok(h93.split('🏆')[0].count('\n1. ') == 1 and '\n8. ' in h93 and '*Classificação da rodada*' in tab93 and '1. 🟧 Time 1: 9 pts (3V 0E 1D, saldo +4)' in tab93 and '4. 🟥 Time 4' not in tab93 and '2. 🟥 Time 4: 7 pts (2V 1E 1D, saldo +3)' in tab93,
           f'CT-KAN-232-02: no Histórico, a mensagem tem as 8 partidas e a classificação da rodada com 4 times ({tab93[:200]!r})')
        ok(f'{nm93(1)} 4' not in h93 and '🏅 *Artilharia*:' in h93, 'CT-KAN-232-02: a artilharia da rodada antiga também vai na mensagem')
        p93.click('#dlg [data-a=close]'); p93.wait_for_timeout(200)
        # KAN-231: votação encerrada da rodada antiga, com 3 votos
        p93.evaluate(PUT, {
            f'grupos/{g93}/votacoes/v1': {'rid': 'rold', 'title': 'Destaques', 'open': False, 'createdAt': 1,
                'cats': [{'id': 'best', 'name': 'Melhor jogador'}, {'id': 'bag', 'name': 'Bagre'}],
                'resultado': {'best': {'winners': [ids93[1]], 'counts': {ids93[1]: 2, ids93[2]: 1}, 'total': 3}, 'bag': {'winners': [ids93[4]], 'counts': {ids93[4]: 1}, 'total': 1}}},
            f'grupos/{g93}/votacoes/v1/votos/devA': {'pid': ids93[0], 'v': {'best': ids93[1], 'bag': ids93[4]}, 't': 1788000000000},
            f'grupos/{g93}/votacoes/v1/votos/devB': {'pid': ids93[3], 'v': {'best': ids93[1]}, 't': 1788000060000},
            f'grupos/{g93}/votacoes/v1/votos/devC': {'pid': ids93[5], 'v': {'best': ids93[2]}, 't': 1788000120000},
        })
        p93.reload(); p93.wait_for_timeout(1500)
        p93.click('[data-a=tab][data-v=votacao]'); p93.wait_for_selector('[data-a=shareVote]', timeout=8000)
        p93.click('[data-a=shareVote]'); p93.wait_for_selector('#votZapRaiz #shtxt', timeout=5000)
        r93 = p93.input_value('#shtxt')
        ok(f'🏅 *Melhor jogador*: {nm93(1)} (2 · 67%) · {nm93(2)} (1 · 33%)' in r93 and f'🏅 *Bagre*: {nm93(4)} (1 · 100%)' in r93 and 'Quem votou em quem' not in r93
           and not p93.is_checked('#votDetalhe') and p93.locator('#votAviso').count() == 0,
           f'CT-KAN-231-01: o resultado no WhatsApp traz os mais votados com os votos e o percentual (KAN-257), sem quem votou em quem ({r93[:160]!r})')
        p93.check('#votDetalhe'); p93.wait_for_timeout(300)
        r93b = p93.input_value('#shtxt')
        ok(p93.locator('#votAviso').is_visible() and 'só para o grupo dos administradores' in p93.inner_text('#votAviso')
           and '👀 *Quem votou em quem*' in r93b and f'• {nm93(0)}: Melhor jogador: {nm93(1)}; Bagre: {nm93(4)}' in r93b,
           f'CT-KAN-231-01: marcando "Incluir quem votou em quem", aparece o aviso e a mensagem leva o voto de cada um ({r93b[-160:]!r})')
        for tema in ['light', 'dark']:
            p93.emulate_media(color_scheme=tema); p93.wait_for_timeout(150)
            contraste(p93, f'resultado da votação no WhatsApp com aviso ({tema})')
            ok(p93.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'CT-KAN-231-01: em 360px ({tema}), a janela não tem rolagem lateral')
        p93.emulate_media(color_scheme='light')
        p93.screenshot(path=f'{OUT}/93-votacao-zap.png')
        p93.click('#dlg [data-a=close]'); p93.wait_for_timeout(300)
        p93.click('#quemVotou > summary'); p93.wait_for_selector('[data-a=baixarVotos]', timeout=5000)
        baix93 = []; p93.on('download', lambda d: baix93.append(d))
        with p93.expect_download() as d93:
            p93.dblclick('[data-a=baixarVotos]')
        p93.wait_for_timeout(1500)
        ok(len(baix93) == 1, f'CT-KAN-266-03: dois cliques seguidos em "Baixar planilha" baixam uma planilha só ({len(baix93)})')
        arq93 = d93.value; csv93 = open(arq93.path(), encoding='utf-8-sig', newline='').read().split('\r\n')
        ok(arq93.suggested_filename == 'Destaques.csv' and csv93[0] == '"Quem votou";"Melhor jogador";"Bagre";"Hora";"Trocas";"Origem"' and len(csv93) == 4 and all(l.endswith(';"link"') for l in csv93[1:])
           and any(l.startswith(f'"{nm93(0)}";"{nm93(1)}";"{nm93(4)}";') for l in csv93),
           f'CT-KAN-231-02: "Baixar planilha" baixa Destaques.csv com uma coluna por categoria e uma linha por voto, com a origem (KAN-254) ({csv93[:2]})')
        # Em inglês
        p93.evaluate("localStorage.setItem('nj-idioma','en')"); p93.reload(); p93.wait_for_timeout(2000)
        p93.click('[data-a=tab][data-v=votacao]'); p93.wait_for_selector('[data-a=shareVote]', timeout=8000)
        p93.click('[data-a=shareVote]'); p93.wait_for_selector('#votZapRaiz #shtxt', timeout=5000); p93.check('#votDetalhe'); p93.wait_for_timeout(300)
        e93 = p93.inner_text('#dlgBody') + p93.input_value('#shtxt')
        p93.click('#dlg [data-a=close]'); p93.wait_for_timeout(200)
        p93.click('[data-a=tab][data-v=historico]'); p93.wait_for_timeout(1200)
        p93.fill('#hmes', '2026-09'); p93.click('[data-a=histBuscar]'); p93.wait_for_timeout(1200)
        p93.click('[data-a=histAbrir][data-v=rold]'); p93.wait_for_selector('[data-a=histZap]', timeout=8000); p93.click('[data-a=histZap]'); p93.wait_for_selector('#shtxt', timeout=5000)
        e93 += p93.input_value('#shtxt')
        falta93 = p93.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(zappart|votzap|partida\\.corrig)/.test(k))")
        ok('Who voted for whom' in e93 and "admins' group" in e93 and 'Matches — ' in e93 and 'Game day standings' in e93 and 'Classificação' not in e93 and not falta93,
           f'CT-KAN-231/232: em English, as mensagens e o aviso saem traduzidos ({falta93})')
        ctx93.close()
        # ---------- v94 (KAN-235, KAN-234): cor de colete livre (paleta) e links do WhatsApp sem o wa.me
        ctx94 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p94 = ctx94.new_page(); p94.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p94, 'criar')
        p94.fill('#le', 'v94@teste.com'); p94.fill('#lp', 'Jogo@2026'); p94.fill('#lp2', 'Jogo@2026'); p94.keyboard.press('Enter'); p94.wait_for_selector('#ngBox', timeout=12000)
        p94.fill('#ngn', 'Colete FC'); p94.click('[data-a=pickSport][data-v=futebol]'); p94.click('[data-a=createGroup]')
        p94.wait_for_function("location.hash.startsWith('#/g/')"); p94.wait_for_timeout(1500)
        g94 = p94.url.split('#/g/')[1]
        elenco_e_presenca(p94, 10); sortear(p94)
        p94.locator('.team [data-a=color][data-v="0"]').click(); p94.wait_for_selector('#coletes [data-a=outraCor]', timeout=8000); p94.wait_for_timeout(200)
        ok(p94.locator('#coletes [data-a=pickColor]').count() == 8 and p94.locator('#coletes [data-a=outraCor]').count() == 1,
           'CT-KAN-235-01: a janela do colete tem as 8 cores de sempre e "Outra cor…"')
        p94.click('#coletes [data-a=outraCor]'); p94.wait_for_selector('#paletaQuadro', timeout=8000); p94.wait_for_timeout(300)
        for tema in ['light', 'dark']:
            p94.emulate_media(color_scheme=tema); p94.wait_for_timeout(150)
            v94 = p94.evaluate("(()=>{const d=document.getElementById('dlgBody');return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, document.activeElement.id, Math.round(document.getElementById('paletaBrilho').getBoundingClientRect().height), !document.body.innerText.match(/#[0-9a-f]{6}/i)]})()")
            ok(v94[0] and v94[1] and v94[2] == 'paletaQuadro' and v94[3] >= 44 and v94[4],
               f'CT-KAN-235-02: em 360px ({tema}), a paleta não tem rolagem lateral, o cursor vem no quadro, a barra de claro e escuro tem 44px e não aparece código de cor ({v94})')
            contraste(p94, f'paleta de cor ({tema})')
        p94.emulate_media(color_scheme='light')
        # Toque no quadro: perto do azul forte (tom ~220, cheio)
        bx = p94.locator('#paletaQuadro').bounding_box()
        p94.mouse.click(bx['x'] + bx['width'] * 220 / 360, bx['y'] + 4); p94.wait_for_timeout(200)
        n94 = p94.input_value('#corNome')
        ok(n94 in ('Azul', 'Azul-marinho'), f'CT-KAN-235-02: tocar no azul sugere o nome "{n94}"')
        # Escurecer pela barra e trocar o nome
        p94.fill('#paletaBrilho', '45'); p94.dispatch_event('#paletaBrilho', 'input'); p94.wait_for_timeout(200)
        n94b = p94.input_value('#corNome')
        ok(n94b == 'Azul-marinho', f'CT-KAN-235-02: escurecer muda a sugestão para "Azul-marinho" ({n94b!r})')
        p94.fill('#corNome', ''); p94.click('#dlg [data-a=usarCor]'); p94.wait_for_timeout(400)
        ok(p94.locator('#paletaQuadro').count() == 1 and p94.evaluate("document.activeElement.id") == 'corNome', 'CT-KAN-235-02: sem nome, a janela não fecha e o cursor vai para o nome')
        p94.fill('#corNome', 'Marinho do clube'); p94.keyboard.press('Enter'); p94.wait_for_timeout(1000)
        c94 = p94.evaluate("(()=>{const r=S.rod[S.rid]||{};return (r.cores||{})[0]})()")
        ok(isinstance(c94, str) and re.match(r'^#[0-9a-f]{6}\|🟦\|Marinho do clube$', c94 or '') is not None and not p94.evaluate("document.getElementById('dlg').open"),
           f'CT-KAN-235-01: Enter usa a cor: o Time 1 fica com a cor livre e o nome digitado ({c94!r})')
        t94 = p94.inner_text('.team >> nth=0')
        ok('colete marinho do clube' in t94.lower(), f'CT-KAN-235-01: o cartão do time mostra "colete marinho do clube" ({t94[:60]!r})')
        p94.click('[data-a=shareTimes]') if p94.locator('[data-a=shareTimes]').count() else None
        if p94.locator('#shtxt').count():
            z94 = p94.input_value('#shtxt')
            ok('🟦 *Time 1* · colete marinho do clube' in z94, f'CT-KAN-235-01: no WhatsApp dos times, o quadradinho azul e o nome ({z94[:80]!r})')
            ok((p94.get_attribute('#dlg a.btn.primary', 'href') or '').startswith('https://api.whatsapp.com/send?text='), 'CT-KAN-234-01: "Abrir no WhatsApp" dos times vai direto para api.whatsapp.com')
            p94.click('#dlg [data-a=close]'); p94.wait_for_timeout(200)
        # Recarrega: a cor continua e aparece como recente na janela do colete do outro time
        p94.reload(); p94.wait_for_timeout(1800)
        ok(p94.evaluate("((S.rod[S.rid]||{}).cores||{})[0]") == c94, 'CT-KAN-235-01: a cor livre continua depois de recarregar')
        p94.locator('.team [data-a=color][data-v="1"]').click(); p94.wait_for_selector('#coletes [data-a=outraCor]', timeout=8000); p94.wait_for_timeout(200)
        lv94 = p94.evaluate("[...document.querySelectorAll('#coletes [data-a=pickColor]')].map(b=>b.dataset.c2)")
        ok(len(lv94) == 9 and lv94[8] == c94 and 'Time 1' in p94.inner_text('#coletes [data-a=pickColor] >> nth=8'),
           f'CT-KAN-235-03: a cor livre aparece na janela do outro time, marcada com o time que a usa ({lv94[8:]})')
        p94.locator('#coletes [data-a=pickColor]').nth(8).click(); p94.wait_for_timeout(900)
        cs94 = p94.evaluate("((S.rod[S.rid]||{}).cores||{})")
        ok(cs94.get('1') == c94 and isinstance(cs94.get('0'), int), f'CT-KAN-235-03: escolher a cor livre do outro time faz os dois trocarem ({cs94})')
        p94.screenshot(path=f'{OUT}/94-colete-livre.png')
        # Em inglês
        p94.evaluate("localStorage.setItem('nj-idioma','en')"); p94.reload(); p94.wait_for_timeout(2000)
        p94.locator('.team [data-a=color][data-v="0"]').click(); p94.wait_for_selector('#coletes [data-a=outraCor]', timeout=8000)
        p94.click('#coletes [data-a=outraCor]'); p94.wait_for_selector('#paletaQuadro', timeout=8000); p94.wait_for_timeout(300)
        e94 = p94.inner_text('#dlgBody')
        f94 = p94.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(paleta|cor\\.|colete\\.outra)/.test(k))")
        ok('Another color for Team 1' in e94 and 'Light and dark' in e94 and 'Claro' not in e94 and not f94, f'CT-KAN-235-02: em English, a paleta sai traduzida ({f94})')
        ctx94.close()
        # ---------- v95 (KAN-230): quem participa da votação (tipos de jogador e confirmados fora do sorteio)
        ctx95 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p95 = ctx95.new_page(); p95.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p95, 'criar')
        p95.fill('#le', 'v95@teste.com'); p95.fill('#lp', 'Jogo@2026'); p95.fill('#lp2', 'Jogo@2026'); p95.keyboard.press('Enter'); p95.wait_for_selector('#ngBox', timeout=12000)
        p95.fill('#ngn', 'Votação FC'); p95.click('[data-a=pickSport][data-v=futebol]'); p95.click('[data-a=createGroup]')
        p95.wait_for_function("location.hash.startsWith('#/g/')"); p95.wait_for_timeout(1500)
        g95 = p95.url.split('#/g/')[1]
        elenco_e_presenca(p95, 12)
        rid95 = p95.evaluate("S.rid")
        conf95 = p95.evaluate("Object.keys(S.pres).filter(id=>S.pres[id].s==='in')")
        gol95 = [x for x in conf95 if p95.evaluate("(i)=>(S.jog[i]||{}).pos", x) == 'GOL']
        dia95 = [x for x in conf95 if x not in gol95][0]
        # Um diarista (tipo privado), um avulso confirmado e os goleiros fora do sorteio
        p95.evaluate(PUT, {f'grupos/{g95}/privado/caixa': {**(p95.evaluate(LER, f'grupos/{g95}/privado/caixa') or {}), 'tipos': {dia95: 'diarista'}},
                           f'grupos/{g95}/rodadas/{rid95}/presencas/avx95': {'s': 'in', 't': 99, 'nome': 'Avulso Teste'},
                           f'grupos/{g95}': {**(p95.evaluate(LER, f'grupos/{g95}') or {}), 'cfg': {**((p95.evaluate(LER, f'grupos/{g95}') or {}).get('cfg') or {}), 'foraPos': ['GOL']}}})
        p95.reload(); p95.wait_for_timeout(1800)
        sortear(p95)
        nos95 = p95.evaluate("[].concat(...(S.rod[S.rid].times||[]).map(t=>t.players))")
        ok(gol95 and not any(x in nos95 for x in gol95) and 'avx95' in nos95 and dia95 in nos95,
           f'CT-KAN-230: preparação: goleiros confirmados fora do sorteio ({len(gol95)}), avulso e diarista nos times')
        # Padrão do grupo: sem diaristas e avulsos, com os confirmados fora do sorteio
        p95.click('[data-a=tab][data-v=grupo]'); p95.wait_for_timeout(900); p95.click('[data-a=settings]'); p95.wait_for_selector('#gvpart', timeout=8000)
        mk95 = p95.evaluate("[...document.querySelectorAll('#gvpart .vpart')].map(i=>[i.value,i.checked])")
        ok(mk95 == [['mensalista', True], ['diarista', True], ['avulso', True], ['fora', False]],
           f'CT-KAN-230-01: em Partidas e caixa, "Quem participa da votação" começa com todos os tipos e sem os de fora do sorteio ({mk95})')
        for tema in ['light', 'dark']:
            p95.emulate_media(color_scheme=tema); p95.wait_for_timeout(150)
            h95 = p95.evaluate("Math.min(...[...document.querySelectorAll('#gvpart .chk-linha')].map(e=>Math.round(e.getBoundingClientRect().height)))")
            ok(h95 >= 44 and p95.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'CT-KAN-230-01: em 360px ({tema}), as opções têm 44px e não há rolagem lateral ({h95})')
            contraste(p95, f'Quem participa da votação ({tema})')
        p95.emulate_media(color_scheme='light')
        p95.uncheck('#gvpart .vpart[value=diarista]'); p95.uncheck('#gvpart .vpart[value=avulso]'); p95.check('#gvpart .vpart[value=fora]')
        p95.click('#dlg [data-a=saveSettings]'); p95.wait_for_timeout(900)
        vp95 = p95.evaluate("(S.app.cfg||{}).votPart")
        ok(vp95 == {'mensalista': True, 'diarista': False, 'avulso': False, 'fora': True}, f'CT-KAN-230-01: o padrão do grupo fica gravado ({vp95})')
        p95.reload(); p95.wait_for_timeout(1500)
        ok(p95.evaluate("(S.app.cfg||{}).votPart") == vp95, 'CT-KAN-230-01: o padrão continua depois de recarregar')
        # Nova votação: vem com o padrão
        p95.click('[data-a=tab][data-v=votacao]'); p95.wait_for_timeout(900); p95.click('[data-a=newVote]'); p95.wait_for_selector('#vpart', timeout=8000)
        nv95 = p95.evaluate("[...document.querySelectorAll('#vpart .vpart')].map(i=>[i.value,i.checked])")
        ok(nv95 == [['mensalista', True], ['diarista', False], ['avulso', False], ['fora', True]] and 'só para esta votação' in p95.inner_text('#vpart'),
           f'CT-KAN-230-02: a janela Nova votação vem com o padrão do grupo e avisa que mudar ali vale só para ela ({nv95})')
        p95.click('#dlg [data-a=saveVote]'); p95.wait_for_timeout(1500)
        v95 = p95.evaluate("S.vid"); q95 = p95.evaluate("(S.vot[S.vid]||{}).quem||[]")
        ok(all(x in q95 for x in gol95) and dia95 not in q95 and 'avx95' not in q95 and len(q95) == len(conf95) - 1,
           f'CT-KAN-230-02: a votação grava quem participa: os goleiros fora do sorteio entram; o diarista e o avulso, não ({len(q95)} de {len(conf95)+1} confirmados)')
        p95.click('#dlg [data-a=close]'); p95.wait_for_timeout(200)
        # Link da votação, sem conta
        est95 = ctx95.storage_state()
        c96 = b.new_context(viewport={'width': 360, 'height': 740}, service_workers='block', timezone_id='America/Sao_Paulo', storage_state=est95)
        c96.add_init_script("if(!sessionStorage.getItem('saiu')){localStorage.removeItem('pelada-demo-v2-u');sessionStorage.setItem('saiu','1')}")
        q96 = c96.new_page(); q96.on('pageerror', lambda e: errs.append(str(e)))
        q96.goto(URL + f'#/p/{g95}/v/{v95}'); q96.wait_for_selector('[data-c=voter]', timeout=10000); q96.wait_for_timeout(500)
        vt96 = q96.evaluate("[...document.querySelectorAll('[data-c=voter] option')].map(o=>o.value).filter(Boolean)")
        ok(sorted(vt96) == sorted(q95), f'CT-KAN-230-02: no link, "Quem é você?" lista só quem participa ({len(vt96)})')
        q96.select_option('[data-c=voter]', q95[0]); q96.wait_for_timeout(600)
        cd96 = q96.evaluate("[...new Set([...document.querySelectorAll('[data-a=pubVote]')].map(b=>b.dataset.p||b.dataset.v))]")
        ok(any(x in cd96 for x in gol95) and dia95 not in cd96 and 'avx95' not in cd96,
           f'CT-KAN-230-02: as opções de voto incluem o goleiro fora do sorteio e não têm o diarista nem o avulso ({len(cd96)})')
        c96.close()
        # Em inglês
        p95.evaluate("localStorage.setItem('nj-idioma','en')"); p95.reload(); p95.wait_for_timeout(2000)
        p95.click('[data-a=tab][data-v=votacao]'); p95.wait_for_timeout(900); p95.click('[data-a=newVote]'); p95.wait_for_selector('#vpart', timeout=8000)
        e95 = p95.inner_text('#vpart'); f95 = p95.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>k.startsWith('votpart.'))")
        ok('Who takes part in the vote' in e95 and 'Guests' in e95 and 'Avulsos' not in e95 and not f95, f'CT-KAN-230: em English, as opções saem traduzidas ({f95})')
        ctx95.close()
        # ---------- v96 (KAN-233): campeonato da rodada (todos contra todos, classificação com desempate, Plano A); v97: mata-mata, quem passou, campeão no Histórico
        ctx96 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block')
        p96 = ctx96.new_page(); p96.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p96, 'criar')
        p96.fill('#le', 'v96@teste.com'); p96.fill('#lp', 'Jogo@2026'); p96.fill('#lp2', 'Jogo@2026'); p96.keyboard.press('Enter'); p96.wait_for_selector('#ngBox', timeout=12000)
        p96.fill('#ngn', 'Copa FC'); p96.click('[data-a=pickSport][data-v=futebol]'); p96.click('[data-a=createGroup]')
        p96.wait_for_function("location.hash.startsWith('#/g/')"); p96.wait_for_timeout(1500)
        g96 = p96.url.split('#/g/')[1]
        elenco_e_presenca(p96, 12); sortear(p96)
        p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#formatoPainel', timeout=10000); p96.wait_for_timeout(300)
        rid96 = p96.evaluate("S.live.rid")
        doc96 = p96.evaluate(LER, f'grupos/{g96}/rodadas/{rid96}')
        if len(doc96['times']) < 3:
            ok(p96.locator('#fmtCamp').is_disabled() and 'pelo menos 3 times' in p96.inner_text('#campMinimo') and p96.get_attribute('#fmtLivre', 'aria-pressed') == 'true',
               'CT-KAN-233-06: com 2 times, o formato fica Livre e Campeonato desligado, explicando que precisa de 3 times')
        # 4 times de 3 (como a turma que joga em quadra pequena)
        ids96 = p96.evaluate("Object.keys(S.jog).sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name))")[:12]
        doc96['times'] = [{'c': i, 'players': ids96[i * 3:(i + 1) * 3]} for i in range(4)]; doc96.pop('cores', None)
        p96.evaluate(PUT, {f'grupos/{g96}/rodadas/{rid96}': doc96}); p96.reload(); p96.wait_for_timeout(1500)
        p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#formatoPainel', timeout=10000); p96.wait_for_timeout(300)
        ok(not p96.locator('#fmtCamp').is_disabled() and p96.locator('#campPainel').count() == 0 and p96.locator('[data-trava=campeonato]').count() == 0,
           'CT-KAN-233-06: com 4 times no Plano A, Campeonato fica disponível, sem cadeado; o formato começa Livre')
        p96.click('#fmtCamp'); p96.wait_for_selector('#campCrit', timeout=5000); p96.wait_for_timeout(300)
        m96 = p96.inner_text('#dlgBody')
        mm96 = p96.evaluate("[...document.querySelectorAll('#campMata option')].map(o=>[o.textContent,o.selected])")
        ok('4 times, 6 jogos' in m96 and p96.evaluate("document.activeElement && document.activeElement.id === 'campMata'"),
           f'CT-KAN-233-01: "Montar campeonato" explica 4 times e 6 jogos, com o cursor no mata-mata ({m96[:90]!r})')
        ok([x[0] for x in mm96] == ['Sem mata-mata (campeão é o 1º da tabela)', 'Final (1º × 2º)', 'Final (1º × 2º) e 3º lugar (3º × 4º)', 'Semifinais (1º × 4º, 2º × 3º) e final', 'Semifinais (1º × 4º, 2º × 3º), final e 3º lugar']
           and [x[0] for x in mm96 if x[1]] == ['Final (1º × 2º) e 3º lugar (3º × 4º)'],
           f'CT-KAN-233-09: com 4 times, o mata-mata oferece as opções que cabem e vem no padrão: final e 3º lugar ({mm96})')
        crit0 = p96.evaluate("[...document.querySelectorAll('#campCrit li')].map(l=>[l.dataset.k,l.querySelector('input').checked])")
        ok(crit0 == [['saldo', True], ['gp', True], ['cd', True], ['sorteio', True]], f'CT-KAN-233-03: desempate padrão: saldo, gols a favor, confronto direto e sorteio ({crit0})')
        ok('saldo de gols' in m96.lower() and 'gols a favor' in m96.lower(), 'CT-KAN-233-03: os critérios usam a palavra do esporte (gols)')
        for tema in ['light', 'dark']:
            p96.emulate_media(color_scheme=tema); p96.wait_for_timeout(150)
            contraste(p96, f'janela Montar campeonato ({tema})')
        p96.emulate_media(color_scheme='light')
        p96.set_viewport_size({'width': 360, 'height': 740}); p96.wait_for_timeout(200)
        a96 = p96.evaluate("(()=>{const d=document.getElementById('dlgBody');return [document.documentElement.scrollWidth<=innerWidth, d.scrollWidth<=d.clientWidth+1, Math.min(...[...d.querySelectorAll('button,.chk-linha')].map(e=>Math.round(e.getBoundingClientRect().height)))]})()")
        ok(a96[0] and a96[1] and a96[2] >= 44, f'CT-KAN-233-01: em 360px, a janela não tem rolagem lateral e os alvos têm 44px ({a96})')
        p96.screenshot(path=f'{OUT}/96-montar-360.png')
        p96.set_viewport_size({'width': 390, 'height': 844})
        # Gols a favor antes do saldo; sem sorteio
        p96.click('#campCrit li[data-k=gp] .camp-subir'); p96.wait_for_timeout(150)
        p96.uncheck('#campCrit li[data-k=sorteio] input'); p96.wait_for_timeout(150)
        p96.click('#campOk'); p96.wait_for_selector('#campPainel', timeout=5000); p96.wait_for_timeout(800)
        c96 = (p96.evaluate(LER, f'grupos/{g96}/rodadas/{rid96}') or {}).get('camp') or {}
        ok(c96.get('jogos') == ['0-1', '2-3', '0-2', '1-3', '0-3', '1-2'] and c96.get('crit') == ['gp', 'saldo', 'cd'] and c96.get('n') == 4,
           f'CT-KAN-233-01: o campeonato fica gravado na rodada com os 6 jogos na ordem e o desempate escolhido ({c96})')
        ok(p96.get_attribute('#fmtCamp', 'aria-pressed') == 'true' and p96.locator('#campJogos li').count() == 6 and p96.locator('#campTabela tbody tr').count() == 4,
           'CT-KAN-233-01: com o campeonato, o formato fica em Campeonato e aparecem a tabela (4 times) e os 6 jogos')
        ok('Em quadra' in p96.inner_text('#campJogos li:nth-child(1)') and p96.evaluate("[S.live.a,S.live.b]") == [0, 1] and p96.locator('#naEspera').count() == 0,
           'CT-KAN-233-02: o primeiro jogo (Time 1 × Time 2) já fica em quadra; a fila de espera do livre não aparece')
        ok('ordem do campeonato' in p96.inner_text('#partidaRaiz'), 'CT-KAN-233-02: o aviso de sugestão fala da ordem do campeonato')
        def gols96(lado, n):
            for _ in range(n):
                p96.locator(f'[data-a=goal][data-v={lado}]').first.click(); p96.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
                sem_assist(p96)
                p96.locator('[data-a=addGoal][data-p]').first.click(); p96.wait_for_timeout(250)
                sem_assist(p96)
        placares96 = [(2, 0), (1, 0), (0, 0), (3, 0), (1, 1), (4, 1)]
        esperado96 = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]
        seguiu96 = []
        for k, (ga, gb) in enumerate(placares96):
            seguiu96.append(p96.evaluate("[S.live.a,S.live.b]"))
            gols96('a', ga); gols96('b', gb)
            p96.click('[data-a=saveMatch]'); p96.wait_for_timeout(900)
            if k == 2:
                p96.reload(); p96.wait_for_timeout(1500); p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#campPainel', timeout=10000); p96.wait_for_timeout(600)
                ok('Faltam 3 de 6 jogos' in p96.inner_text('#campPainel') and p96.locator('#campJogos li.feito').count() == 3,
                   'CT-KAN-233-05: fechar e abrir o app no meio mantém o campeonato, a tabela e os jogos feitos')
        ok(seguiu96 == esperado96, f'CT-KAN-233-02: depois de cada partida salva, o próximo jogo é o da ordem do campeonato ({seguiu96})')
        tab96 = p96.evaluate("[...document.querySelectorAll('#campTabela tbody tr')].map(r=>[+r.dataset.t,+r.children[2].innerText])")
        ok(tab96 == [[1, 6], [0, 5], [2, 4], [3, 1]], f'CT-KAN-233-03: classificação por pontos (vitória 3, empate 1): Time 2, Time 1, Time 3, Time 4 ({tab96})')
        ok('Todos os jogos foram disputados' in p96.inner_text('#campPainel') and 'Agora é o mata-mata' in p96.inner_text('#campMataAviso') and p96.locator('#campLider').count() == 0,
           'CT-KAN-233-04: com todos os jogos de todos contra todos disputados, o painel avisa que começa o mata-mata')
        ch96 = p96.evaluate("[...document.querySelectorAll('#campChave li')].map(l=>[l.dataset.s,l.innerText.replace(/\\s+/g,' ').trim()])")
        ok([x[0] for x in ch96] == ['t3', 'f'] and 'Time 3' in ch96[0][1] and 'Time 4' in ch96[0][1] and 'Time 2' in ch96[1][1] and 'Time 1' in ch96[1][1]
           and 'Em quadra' in ch96[0][1] and p96.evaluate("[S.live.a,S.live.b]") == [2, 3],
           f'CT-KAN-233-10: a chave se preenche pela tabela: 3º lugar (Time 3 × Time 4) já em quadra, depois a final (Time 2 × Time 1) ({ch96})')
        # 3º lugar empata: "Quem passou?" abre na hora; os pênaltis escolhem o time
        gols96('a', 1); gols96('b', 1)
        p96.click('[data-a=saveMatch]'); p96.wait_for_selector('#passouTimes', timeout=5000); p96.wait_for_timeout(300)
        qp96 = p96.inner_text('#dlgBody')
        ok('Empate: quem passou?' in qp96 and '3º lugar: Time 3 1 × 1 Time 4' in qp96 and p96.locator('#passouOk').is_disabled(),
           f'CT-KAN-233-11: empate no mata-mata abre "Quem passou?" com o placar; Confirmar só depois de escolher ({qp96[:80]!r})')
        for tema in ['light', 'dark']:
            p96.emulate_media(color_scheme=tema); p96.wait_for_timeout(150)
            contraste(p96, f'janela Quem passou ({tema})')
        p96.emulate_media(color_scheme='light')
        p96.fill('#pena', '4'); p96.fill('#penb', '3'); p96.wait_for_timeout(200)
        ok(p96.get_attribute('#passouTimes [data-t="2"]', 'aria-pressed') == 'true' and not p96.locator('#passouOk').is_disabled(),
           'CT-KAN-233-11: com os pênaltis 4 × 3, quem fez mais já fica escolhido')
        p96.set_viewport_size({'width': 360, 'height': 740}); p96.wait_for_timeout(200)
        a96b = p96.evaluate("(()=>{const d=document.getElementById('dlgBody');return [d.scrollWidth<=d.clientWidth+1, Math.min(...[...d.querySelectorAll('button,input')].map(e=>Math.round(e.getBoundingClientRect().height)))]})()")
        ok(a96b[0] and a96b[1] >= 44, f'CT-KAN-233-11: em 360px, "Quem passou?" cabe e os alvos têm 44px ({a96b})')
        p96.screenshot(path=f'{OUT}/97-quem-passou-360.png'); p96.set_viewport_size({'width': 390, 'height': 844})
        p96.click('#passouOk'); p96.wait_for_timeout(800)
        dec96 = ((p96.evaluate(LER, f'grupos/{g96}/rodadas/{rid96}') or {}).get('camp') or {}).get('dec')
        ok(dec96 == {'t3': {'p': 2, 'a': 4, 'b': 3}} and 'pênaltis 4 × 3, passou Time 3' in p96.inner_text('#campChave li[data-s=t3]'),
           f'CT-KAN-233-11: quem passou fica gravado no campeonato e aparece na chave com os pênaltis ({dec96})')
        # Final: Time 2 × Time 1
        ok(p96.evaluate("[S.live.a,S.live.b]") == [1, 0], 'CT-KAN-233-10: depois do 3º lugar, a final entra em quadra (Time 2 × Time 1)')
        gols96('a', 2); p96.click('[data-a=saveMatch]'); p96.wait_for_timeout(900)
        ok(p96.locator('#passouTimes').count() == 0 and 'Campeão: Time 2' in p96.inner_text('#campLider') and 'Vice: Time 1' in p96.inner_text('#campLider') and '3º: Time 3' in p96.inner_text('#campLider'),
           f'CT-KAN-233-12: com a final, aparecem campeão, vice e 3º ({p96.inner_text("#campLider")!r})')
        p96.reload(); p96.wait_for_timeout(1500); p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#campLider', timeout=10000); p96.wait_for_timeout(400)
        ok('Campeão: Time 2' in p96.inner_text('#campLider'), 'CT-KAN-233-12: campeão continua depois de recarregar')
        # KAN-238: campeonato encerrado: sem placar nem sugestão; jogar fora do campeonato é opcional
        ok(p96.locator('#campFim').count() == 1 and 'Campeonato encerrado' in p96.inner_text('#campFim') and 'Campeão: Time 2' in p96.inner_text('#campFim')
           and p96.locator('.board').count() == 0 and p96.locator('[data-a=saveMatch]').count() == 0,
           'CT-KAN-238-01: com o campeonato encerrado, o placar dá lugar a "Campeonato encerrado" com o campeão, e o app não sugere outro jogo')
        tags96 = p96.evaluate("[...document.querySelectorAll('#partidaRaiz .fase-tag')].map(e=>e.textContent)")
        ok(tags96 == ['Todos contra todos'] * 6 + ['3º lugar', 'Final'], f'CT-KAN-238-02: cada partida da lista mostra a fase ({tags96})')
        for tema in ['light', 'dark']:
            p96.emulate_media(color_scheme=tema); p96.wait_for_timeout(150)
            contraste(p96, f'campeonato encerrado ({tema})')
        p96.emulate_media(color_scheme='light')
        p96.set_viewport_size({'width': 360, 'height': 740}); p96.wait_for_timeout(200)
        ok(p96.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-238-01: em 360px, o fim do campeonato e as etiquetas não criam rolagem lateral')
        p96.locator('#formatoPainel').scroll_into_view_if_needed(); p96.screenshot(path=f'{OUT}/98-encerrado-360.png', full_page=True)
        p96.set_viewport_size({'width': 390, 'height': 844})
        tab96b = p96.evaluate("[...document.querySelectorAll('#campTabela tbody tr')].map(r=>r.innerText)")
        p96.click('#jogarFora'); p96.wait_for_selector('.board', timeout=5000); p96.wait_for_timeout(300)
        ok(p96.locator('#campForaAviso').count() == 1, 'CT-KAN-238-01: "Jogar partida fora do campeonato" volta o placar, com o aviso de que não entra na tabela')
        gols96('a', 1); p96.click('[data-a=saveMatch]'); p96.wait_for_timeout(900)
        tags96b = p96.evaluate("[...document.querySelectorAll('#partidaRaiz .fase-tag')].map(e=>e.textContent)")
        ok(tags96b[-1] == 'Fora do campeonato' and p96.evaluate("[...document.querySelectorAll('#campTabela tbody tr')].map(r=>r.innerText)") == tab96b and 'Campeão: Time 2' in p96.inner_text('#campLider'),
           f'CT-KAN-238-01: a partida extra aparece como "Fora do campeonato" e não mexe na tabela nem no campeão ({tags96b[-1:]})')
        p96.click('#campForaAviso [data-a=voltarCamp]'); p96.wait_for_selector('#campFim', timeout=5000)
        # WhatsApp: por fase, pênaltis, classificação do campeonato e campeão
        p96.click('[data-a=zapPartidas]'); p96.wait_for_selector('#shtxt', timeout=5000)
        z96 = p96.input_value('#shtxt')
        ok('*Todos contra todos*' in z96 and '*Mata-mata*' in z96 and '*Fora do campeonato*' in z96 and '7. 3º lugar: ' in z96 and '8. Final: ' in z96
           and '(pênaltis 4 × 3, passou Time 3)' in z96 and '🏆 *Classificação do campeonato*' in z96 and 'Classificação da rodada' not in z96
           and '🥇 *Campeão: Time 2*' in z96 and '🥈 Vice: Time 1' in z96 and '🥉 3º lugar: Time 3' in z96,
           f'CT-KAN-238-03: a mensagem do WhatsApp separa as fases, traz os pênaltis, a classificação do campeonato e o campeão, o vice e o 3º ({z96[:200]!r})')
        p96.click('#dlg [data-a=close]'); p96.wait_for_timeout(200)
        p96.click('[data-a=tab][data-v=historico]'); p96.wait_for_timeout(1200)
        p96.click('[data-a=histBuscar]'); p96.wait_for_timeout(1500)
        p96.locator(f'[data-a=histAbrir][data-v="{rid96}"]').first.click(); p96.wait_for_selector('#histCampeao', timeout=10000)
        hc96 = p96.inner_text('#histCampeao')
        ok('Campeão: Time 2' in hc96 and 'Vice: Time 1' in hc96, f'CT-KAN-233-13: campeão e vice ficam no Histórico da rodada ({hc96!r})')
        th96 = p96.evaluate("[...document.querySelectorAll('.fase-tag')].map(e=>e.textContent)")
        ok(th96 == ['Todos contra todos'] * 6 + ['3º lugar', 'Final', 'Fora do campeonato'], f'CT-KAN-238-02: no Histórico, cada partida mostra a fase ({th96})')
        p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#campPainel', timeout=10000); p96.wait_for_timeout(400)
        crit96 = p96.inner_text('#campCriterios')
        ok('pontos (vitória 3, empate 1), gols a favor, saldo de gols, confronto direto' in crit96 and 'sorteio' not in crit96, f'CT-KAN-233-03: a ordem da classificação aparece embaixo da tabela ({crit96!r})')
        # Mudar o desempate depois: abre com o que foi escolhido
        p96.click('#campPainel [data-a=abrirCampeonato]'); p96.wait_for_selector('#campCrit', timeout=5000); p96.wait_for_timeout(200)
        crit1 = p96.evaluate("[...document.querySelectorAll('#campCrit li')].map(l=>[l.dataset.k,l.querySelector('input').checked])")
        ok(crit1 == [['gp', True], ['saldo', True], ['cd', True], ['sorteio', False]] and 'Salvar ajustes' in p96.inner_text('#campOk')
           and p96.evaluate("document.querySelector('#campMata').selectedOptions[0].textContent") == 'Final (1º × 2º) e 3º lugar (3º × 4º)',
           f'CT-KAN-233-03: "Ajustes" abre com o mata-mata e a ordem do desempate gravados ({crit1})')
        p96.check('#campCrit li[data-k=sorteio] input'); p96.click('#campOk'); p96.wait_for_timeout(700)
        ok((p96.evaluate(LER, f'grupos/{g96}/rodadas/{rid96}') or {}).get('camp', {}).get('crit') == ['gp', 'saldo', 'cd', 'sorteio'], 'CT-KAN-233-03: o desempate mudado fica gravado, sem refazer os jogos')
        for tema in ['light', 'dark']:
            p96.emulate_media(color_scheme=tema); p96.wait_for_timeout(150)
            contraste(p96, f'painel do campeonato ({tema})')
        p96.emulate_media(color_scheme='light')
        p96.set_viewport_size({'width': 360, 'height': 740}); p96.wait_for_timeout(200)
        ok(p96.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-233-04: em 360px, o painel do campeonato não cria rolagem lateral (a tabela rola dentro)')
        p96.locator('#formatoPainel').scroll_into_view_if_needed(); p96.screenshot(path=f'{OUT}/96-campeonato-360.png', full_page=True)
        p96.set_viewport_size({'width': 390, 'height': 844})
        # English
        p96.evaluate("localStorage.setItem('nj-idioma','en')"); p96.reload(); p96.wait_for_timeout(1800)
        p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#campPainel', timeout=10000); p96.wait_for_timeout(500)
        t96 = p96.inner_text('#formatoPainel') + ' ' + p96.inner_text('#campPainel') + ' ' + p96.inner_text('#campFim') + ' ' + p96.inner_text('#partidaRaiz .fase-tag >> nth=0')
        sem96 = p96.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(camp\\.|mata\\.|zappart\\.|plano\\.rec\\.campeonato)/.test(k))")
        pt96 = [w for w in ['Campeonato', 'Faltam', 'Jogos', 'Saldo', 'Livre', 'vitória', 'confronto', 'lugar', 'Contra', 'Campeão', 'Vice', 'Mata-mata', 'pênaltis', 'passou', 'encerrado', 'Todos contra'] if w in t96]
        ok(not sem96 and not pt96 and 'Championship' in t96 and 'goals scored' in t96 and 'Champion: Team 2' in t96 and 'Knockout' in t96, f'CT-KAN-233-07: em English, o formato e o campeonato saem sem palavras em português ({sem96}, {pt96})')
        p96.evaluate("localStorage.setItem('nj-idioma','pt-BR')"); p96.reload(); p96.wait_for_timeout(1500)
        p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#campPainel', timeout=10000); p96.wait_for_timeout(400)
        # Voltar ao livre: pergunta, apaga só o campeonato; as partidas continuam
        p96.click('#fmtLivre'); ok(confirmar_app(p96, True), 'CT-KAN-233-08: voltar ao formato livre pergunta antes'); p96.wait_for_timeout(700)
        d96 = p96.evaluate(LER, f'grupos/{g96}/rodadas/{rid96}') or {}
        np96 = p96.evaluate("Object.values(S.parts||{}).filter(m=>m.tipo!=='art').length")
        ok('camp' not in d96 and p96.locator('#campPainel').count() == 0 and np96 == 9 and p96.get_attribute('#fmtLivre', 'aria-pressed') == 'true',
           f'CT-KAN-233-08: no formato livre, o campeonato sai da rodada e as 9 partidas continuam ({np96})')
        # Grátis: cadeado
        p96.evaluate(PUT, {'sistema/planos': {'transicaoAte': 1}}); p96.reload(); p96.wait_for_timeout(1500)
        p96.click('[data-a=tab][data-v=partida]'); p96.wait_for_selector('#formatoPainel', timeout=10000); p96.wait_for_timeout(400)
        ok(p96.locator('#fmtCamp').is_disabled() and '🔒' in p96.inner_text('#fmtCamp') and p96.locator('#formatoPainel [data-trava=campeonato]').count() == 1
           and 'Plano A' in p96.inner_text('#formatoPainel [data-trava=campeonato]'),
           'CT-KAN-233-06: no Grátis, Campeonato aparece com o cadeado e "faz parte do Plano A"')
        p96.click('#formatoPainel [data-trava=campeonato] [data-a=planosDlg]'); p96.wait_for_timeout(600)
        ok('Campeonato na rodada' in p96.inner_text('#dlgBody'), 'CT-KAN-233-06: a janela Planos lista o campeonato')
        p96.evaluate(DEL, ['sistema/planos']); ctx96.close()

        # ---------- v99 (KAN-117): ficha do cliente no portal (mudar plano, validade, motivo e histórico); v100 (KAN-240): Grátis sem validade nem motivo
        if TEM_PORTAL:
            ctx99 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block')
            p99 = ctx99.new_page(); p99.on('pageerror', lambda e: errs.append('portal v99: ' + str(e)))
            PORTAL99 = URL.rsplit('/', 1)[0] + '/portal.html'
            p99.goto(PORTAL99); p99.wait_for_timeout(600)
            agora99 = int(time.time() * 1000)
            p99.evaluate(PUT, {'contas/u-ficha99': {'email': 'ficha@teste.com', 'acesso': agora99, 'criada': agora99 - 5 * 864e5},
                               'grupos/g-ficha99': {'name': 'Pelada da Ficha', 'owner': 'u-ficha99', 'ativo': True, 'createdAt': 1},
                               'sistema/planos': {'transicaoAte': 1}})
            p99.reload(); p99.wait_for_timeout(600); p99.click('[data-p=google]'); p99.wait_for_selector('li.cli', timeout=8000); p99.wait_for_timeout(300)
            cli99 = p99.locator('li.cli', has_text='ficha@teste.com')
            ok(cli99.count() == 1 and cli99.locator('[data-p=ficha]').count() == 1, 'CT-KAN-117-01: cada cliente da lista tem o botão "Ficha"')
            cli99.locator('[data-p=ficha]').click(); p99.wait_for_selector('#ficha', timeout=5000); p99.wait_for_timeout(400)
            f99 = p99.inner_text('#ficha')
            ok('ficha@teste.com' in f99 and 'Plano em vigor: Grátis' in f99 and 'Nenhuma mudança feita pelo portal ainda' in f99,
               f'CT-KAN-117-01: a ficha mostra o e-mail, o plano em vigor e o histórico vazio ({f99[:120]!r})')
            # KAN-240: no Grátis, validade e motivo ficam desligados, com a explicação; com A ou B, ligam
            ok(p99.locator('#fAte').is_disabled() and p99.locator('#fMotivo').is_disabled() and 'No Grátis não há validade nem motivo' in p99.inner_text('#fichaForm'),
               'CT-KAN-240-01: com o plano em Grátis, "Válido até" e "Motivo" ficam desligados e a ficha explica por quê')
            # Plano pago sem motivo: recusa com explicação (e o que foi digitado continua no formulário)
            p99.select_option('#fPlano', 'A'); p99.wait_for_timeout(200)
            ok(not p99.locator('#fAte').is_disabled() and not p99.locator('#fMotivo').is_disabled() and 'No Grátis' not in p99.inner_text('#fichaForm'),
               'CT-KAN-240-01: ao escolher o Plano A, validade e motivo ligam na hora')
            p99.fill('#fObs', 'rascunho'); p99.click('#fSalvar'); p99.wait_for_timeout(400)
            ok('Escolha o motivo' in p99.inner_text('#fErro') and 'plano' not in (p99.evaluate(LER, 'contas/u-ficha99') or {}),
               'CT-KAN-117-01: plano pago sem motivo não grava e explica')
            ok(p99.input_value('#fObs') == 'rascunho' and p99.input_value('#fPlano') == 'A' and not p99.locator('#fAte').is_disabled(),
               'CT-KAN-240-02: depois do aviso de erro, o que foi digitado e escolhido continua no formulário')
            # Data passada: recusa
            p99.evaluate("(()=>{const i=document.getElementById('fAte');i.removeAttribute('min');i.value='2020-01-10'})()")
            p99.select_option('#fMotivo', 'cortesia'); p99.click('#fSalvar'); p99.wait_for_timeout(400)
            ok('A validade precisa ser hoje ou depois' in p99.inner_text('#fErro'), 'CT-KAN-117-01: validade no passado é recusada')
            # Cortesia do Plano A até daqui a 20 dias
            ate99 = p99.evaluate("(()=>{const d=new Date(Date.now()+20*864e5-3*36e5);return d.toISOString().slice(0,10)})()")
            p99.fill('#fAte', ate99); p99.fill('#fObs', 'amigo do grupo de segunda'); p99.wait_for_timeout(100)
            ld99 = p99.evaluate("(()=>{const b=document.getElementById('fSalvar');b.click();return b.classList.contains('busy')&&b.disabled})()")
            p99.wait_for_selector('#fOk', timeout=5000); p99.wait_for_timeout(300)
            c99 = p99.evaluate(LER, 'contas/u-ficha99') or {}
            esp_ate = p99.evaluate("(d)=>{const [y,m,x]=d.split('-').map(Number);return Date.UTC(y,m-1,x+1,3)}", ate99)
            ok(ld99 and c99.get('plano') == 'A' and c99.get('planoAte') == esp_ate and c99.get('motivo') == 'cortesia' and c99.get('obs') == 'amigo do grupo de segunda',
               f'CT-KAN-117-02: "Salvar plano" mostra carregando e grava Plano A até o fim do dia escolhido, com o motivo cortesia e a observação ({c99})')
            h99 = [v for k, v in p99.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return Object.entries(s).filter(([k])=>k.startsWith('contas/u-ficha99/historico/'))})()")]
            ok(len(h99) == 1 and h99[0]['de'] == {'plano': 'gratis', 'ate': None, 'motivo': None} and h99[0]['para'] == {'plano': 'A', 'ate': esp_ate, 'motivo': 'cortesia'}
               and h99[0]['por'] and h99[0]['obs'] == 'amigo do grupo de segunda',
               f'CT-KAN-117-04: a mudança vai para o histórico: quem, quando, de qual para qual plano, motivo e observação ({h99[:1]})')
            fh99 = p99.inner_text('#fHist')
            ok('Grátis → Plano A' in fh99.replace('\n', ' ') and 'Cortesia' in fh99 and 'Plano em vigor: Plano A' in p99.inner_text('#fichaAgora'),
               f'CT-KAN-117-04: o histórico aparece na ficha e o plano em vigor muda na hora ({fh99[:120]!r})')
            ok(p99.locator('#fichaAgora').count() == 1 and p99.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'CT-KAN-117-05: a ficha cabe em 390px sem rolagem lateral')
            for tema in ['light', 'dark']:
                p99.emulate_media(color_scheme=tema); p99.wait_for_timeout(150)
                contraste(p99, f'ficha do cliente no portal ({tema})')
            p99.emulate_media(color_scheme='light')
            p99.screenshot(path=f'{OUT}/99-ficha.png', full_page=True)
            # Salvar de novo sem mudar nada: avisa e não grava outro histórico
            p99.click('#fSalvar'); p99.wait_for_timeout(500)
            n99 = p99.evaluate("Object.keys(JSON.parse(localStorage.getItem('pelada-demo-v2'))).filter(k=>k.startsWith('contas/u-ficha99/historico/')).length")
            ok('Nada mudou' in p99.inner_text('#fErro') and n99 == 1, 'CT-KAN-117-04: salvar sem mudar nada avisa e não cria outra linha no histórico')
            # KAN-240: mudar só o motivo (no Plano A) salva e entra no histórico
            p99.select_option('#fMotivo', 'parceria'); p99.click('#fSalvar'); p99.wait_for_selector('#fOk', timeout=5000); p99.wait_for_timeout(300)
            ok((p99.evaluate(LER, 'contas/u-ficha99') or {}).get('motivo') == 'parceria' and p99.locator('#fHist li').count() == 2,
               'CT-KAN-240-02: mudar só o motivo salva e soma uma linha no histórico')
            p99.select_option('#fMotivo', 'cortesia'); p99.click('#fSalvar'); p99.wait_for_selector('#fOk', timeout=5000); p99.wait_for_timeout(300)
            # Voltar à lista: o cliente aparece com Plano A, validade e o motivo
            p99.click('[data-p=voltar]'); p99.wait_for_selector('li.cli', timeout=5000)
            l99 = p99.locator('li.cli', has_text='ficha@teste.com').inner_text()
            ok('Plano A' in l99 and 'até' in l99 and 'Cortesia' in l99, f'CT-KAN-117-03: na lista, o cliente aparece com o Plano A, a validade e o motivo ({l99[:90]!r})')
            # Voltar ao Grátis: validade e motivo somem; Enter no formulário salva
            p99.locator('li.cli', has_text='ficha@teste.com').locator('[data-p=ficha]').click(); p99.wait_for_selector('#fHist', timeout=5000)
            p99.select_option('#fPlano', 'gratis'); p99.focus('#fObs'); p99.keyboard.press('Enter'); p99.wait_for_selector('#fOk', timeout=5000); p99.wait_for_timeout(300)
            c99b = p99.evaluate(LER, 'contas/u-ficha99') or {}
            ok(c99b.get('plano') == 'gratis' and c99b.get('planoAte') is None and c99b.get('motivo') is None and p99.locator('#fHist li').count() == 4,
               f'CT-KAN-117-02: voltar ao Grátis (com Enter) limpa a validade e o motivo e soma uma linha no histórico ({c99b})')
            # ---------- v101 (KAN-117, 2ª parte): bloquear e desbloquear a conta; limites contra abuso pela tela
            p99.evaluate(PUT, {'grupos/g-ficha99/membros/u-ficha99': {'uid': 'u-ficha99', 'role': 'owner'}})
            ok(p99.locator('#bloqPainel').count() == 1 and '1 grupo' in p99.inner_text('#bloqPainel') and p99.locator('#bloqConfirma').count() == 0,
               'CT-KAN-117-06: a ficha mostra o painel de bloqueio, com quantos grupos a conta tem')
            p99.fill('#bloqMotivo', 'spam no link'); p99.click('#bloqBotao'); p99.wait_for_selector('#bloqConfirma', timeout=3000)
            ok('Bloquear a conta e os 1 grupo(s)' in p99.inner_text('#bloqConfirma') and (p99.evaluate(LER, 'contas/u-ficha99') or {}).get('bloq') is None,
               'CT-KAN-117-06: bloquear pede confirmação antes de gravar')
            p99.click('#bloqConfirmar'); p99.wait_for_selector('#bloqOk', timeout=5000); p99.wait_for_timeout(300)
            c101 = p99.evaluate(LER, 'contas/u-ficha99') or {}
            g101 = p99.evaluate(LER, 'grupos/g-ficha99') or {}
            h101 = [v for k, v in p99.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return Object.entries(s).filter(([k])=>k.startsWith('contas/u-ficha99/historico/'))})()") if v.get('acao')]
            ok(isinstance(c101.get('bloq'), (int, float)) and g101.get('bloq') is True and len(h101) == 1 and h101[0]['acao'] == 'bloquear' and h101[0].get('obs') == 'spam no link'
               and 'Bloqueada' in p99.inner_text('#bloqPainel') and 'Conta bloqueada' in p99.inner_text('#fHist'),
               f'CT-KAN-117-07: o bloqueio marca a conta e os grupos dela e vai para o histórico com o motivo ({c101.get("bloq")}, {g101.get("bloq")}, {h101[:1]})')
            for tema in ['light', 'dark']:
                p99.emulate_media(color_scheme=tema); p99.wait_for_timeout(150)
                contraste(p99, f'bloqueio da conta no portal ({tema})')
            p99.emulate_media(color_scheme='light')
            p99.screenshot(path=f'{OUT}/101-bloqueio.png', full_page=True)
            p99.click('[data-p=voltar]'); p99.wait_for_selector('li.cli', timeout=5000)
            ok('Bloqueada' in p99.locator('li.cli', has_text='ficha@teste.com').inner_text(), 'CT-KAN-117-07: na lista, a conta aparece como "Bloqueada"')
            # Limites contra abuso
            p99.fill('#limAvulsos', '0'); p99.click('#limSalvar'); p99.wait_for_timeout(300)
            ok('números inteiros de 1 a 500' in p99.inner_text('#limErro') and p99.evaluate(LER, 'sistema/limites') is None, 'CT-KAN-117-08: limite fora de 1 a 500 é recusado')
            p99.fill('#limAvulsos', '40'); p99.fill('#limGrupos', '10')
            ld101 = p99.evaluate("(()=>{const b=document.getElementById('limSalvar');b.click();return b.classList.contains('busy')})()")
            p99.wait_for_selector('#limOk', timeout=5000)
            ok(ld101 and p99.evaluate(LER, 'sistema/limites') == {'avulsosPorRodada': 40, 'gruposPorConta': 10},
               'CT-KAN-117-08: "Salvar limites" mostra carregando e grava os dois limites em sistema/limites')
            # No app: grupo bloqueado (só consulta, aviso) e o link indisponível
            p99.evaluate(PUT, {'grupos/g-ficha99/rodadas/r101': {'date': '2026-12-01', 'time': '20:00', 'place': 'Quadra'}})
            q101 = ctx99.new_page(); q101.on('pageerror', lambda e: errs.append('link v101: ' + str(e)))
            q101.goto(URL + '#/p/g-ficha99/r101'); q101.wait_for_timeout(1800)
            ok('indisponível' in q101.inner_text('main') and q101.locator('[data-a=mark]').count() == 0,
               'CT-KAN-117-09: o link de um grupo bloqueado mostra "grupo indisponível" e não aceita confirmação')
            q101.close()
            # Desbloquear: volta tudo na hora
            p99.locator('li.cli', has_text='ficha@teste.com').locator('[data-p=ficha]').click(); p99.wait_for_selector('#bloqPainel', timeout=5000)
            p99.click('#bloqBotao'); p99.wait_for_selector('#bloqOk', timeout=5000); p99.wait_for_timeout(300)
            ok((p99.evaluate(LER, 'contas/u-ficha99') or {}).get('bloq') is None and (p99.evaluate(LER, 'grupos/g-ficha99') or {}).get('bloq') is False
               and p99.locator('#bloqConfirma').count() == 0 and 'Conta desbloqueada' in p99.inner_text('#fHist'),
               'CT-KAN-117-07: desbloquear é direto, libera a conta e os grupos e também vai para o histórico')
            p99.evaluate(DEL, ['sistema/planos', 'sistema/limites']); ctx99.close()
        # No app do organizador: grupo bloqueado só para consulta e conta bloqueada sem "Novo grupo"
        ctx101 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block')
        p101 = ctx101.new_page(); p101.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p101, 'criar')
        p101.fill('#le', 'v101@teste.com'); p101.fill('#lp', 'Jogo@2026'); p101.fill('#lp2', 'Jogo@2026'); p101.keyboard.press('Enter'); p101.wait_for_selector('#ngBox', timeout=12000)
        p101.fill('#ngn', 'Bloqueado FC'); p101.click('[data-a=pickSport][data-v=futebol]'); p101.click('[data-a=createGroup]')
        p101.wait_for_function("location.hash.startsWith('#/g/')"); p101.wait_for_timeout(1500)
        g101b = p101.url.split('#/g/')[1]; u101 = p101.evaluate("S.user.uid")
        conta101 = p101.evaluate(LER, f'contas/{u101}') or {}
        grupo101 = p101.evaluate(LER, f'grupos/{g101b}') or {}
        p101.evaluate(PUT, {f'contas/{u101}': dict(conta101, bloq=int(time.time() * 1000)), f'grupos/{g101b}': dict(grupo101, bloq=True)})
        p101.reload(); p101.wait_for_timeout(1800)
        ok(p101.locator('#avisoBloqueado').count() == 1 and 'bloqueado pela administração' in p101.inner_text('#avisoBloqueado')
           and p101.evaluate("document.body.classList.contains('so-ver')") and p101.locator('#avisoSoVer').count() == 0,
           'CT-KAN-117-09: no app, o grupo bloqueado mostra o aviso e fica só para consulta')
        p101.click('[data-a=tab][data-v=jogadores]'); p101.wait_for_timeout(400)
        p101.locator('[data-a=seed]').first.click() if p101.locator('[data-a=seed]').count() else None; p101.wait_for_timeout(800)
        jog101 = p101.evaluate("(()=>Object.keys(JSON.parse(localStorage.getItem('pelada-demo-v2'))).filter(k=>k.includes('/jogadores/')&&k.includes('" + g101b + "')).length)()")
        ok(jog101 == 0, f'CT-KAN-117-09: no grupo bloqueado, tocar em gravar não grava nada ({jog101})')
        # Conta bloqueada: com 2 grupos, "Meus grupos" aparece (com 1 grupo, o app abre direto o grupo)
        me101 = p101.evaluate(LER, f'usuarios/{u101}') or {}
        me101.setdefault('grupos', {})['g-outro101'] = {'name': 'Outro FC', 'role': 'owner', 'ativo': True}
        p101.evaluate(PUT, {f'usuarios/{u101}': me101})
        # Sob carga, o app pode abrir o último grupo antes de a conta chegar: volta para "Meus grupos" até 3 vezes.
        for _ in range(3):
            p101.goto(URL + '#/'); p101.reload()
            try: p101.wait_for_selector('#avisoContaBloqueada', timeout=10000); break
            except Exception: pass
        p101.wait_for_timeout(300)
        if p101.locator('#dlg[open]').count(): p101.click('#dlg [data-a=close]'); p101.wait_for_timeout(300)
        st101 = p101.evaluate("[location.hash, !!(S.conta&&S.conta.bloq), document.querySelectorAll('[data-a=newGroup]').length]")
        ok(p101.locator('#avisoContaBloqueada').count() == 1 and p101.locator('[data-a=newGroup]').count() == 0,
           f'CT-KAN-117-10: com a conta bloqueada, "Meus grupos" avisa e não oferece criar grupo ({st101})')
        contraste(p101, 'aviso de conta bloqueada')
        p101.goto(URL + '#/g/' + g101b); p101.wait_for_timeout(1500)
        p101.click('#topright [data-a=groupsDlg]'); p101.wait_for_selector('#dlg[open]', timeout=5000); p101.wait_for_timeout(300)
        ok(p101.locator('#dlg [data-a=newGroup]').count() == 0, 'CT-KAN-117-10: a janela "Seus grupos" também não oferece criar grupo')
        ctx101.close()
        # ---------- v102 (KAN-254): votação rápida no aparelho do administrador (passa de mão em mão)
        ctx102 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p102 = ctx102.new_page(); p102.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p102, 'criar')
        p102.fill('#le', 'v102@teste.com'); p102.fill('#lp', 'Jogo@2026'); p102.fill('#lp2', 'Jogo@2026'); p102.keyboard.press('Enter'); p102.wait_for_selector('#ngBox', timeout=12000)
        p102.fill('#ngn', 'Roda FC'); p102.click('[data-a=pickSport][data-v=futebol]'); p102.click('[data-a=createGroup]')
        p102.wait_for_function("location.hash.startsWith('#/g/')"); p102.wait_for_timeout(1500)
        g102 = p102.url.split('#/g/')[1]
        elenco_e_presenca(p102, 10); sortear(p102)
        rid102 = p102.evaluate("S.rid")
        js102 = p102.evaluate("[...new Set([].concat(...(S.rod[S.rid].times||[]).map(t=>t.players)))].sort((a,b)=>S.jog[a].name.localeCompare(S.jog[b].name,'pt-BR'))")
        nm102 = lambda i: p102.evaluate("(x)=>S.jog[x].name", js102[i])
        V102 = f'grupos/{g102}/votacoes/v102'
        p102.evaluate(PUT, {V102: {'rid': rid102, 'title': 'Destaques', 'open': True, 'createdAt': 5, 'selfVote': False,
                                   'cats': [{'id': 'best', 'name': 'Melhor jogador', 'pos': None}, {'id': 'bag', 'name': 'Bagre', 'pos': None}]},
                            V102 + '/votos/devA': {'pid': js102[0], 'v': {'best': js102[2]}, 't': 1000}})
        p102.reload(); p102.wait_for_timeout(1500)
        p102.click('[data-a=tab][data-v=votacao]'); p102.wait_for_selector('#vrAbrir', timeout=8000)
        ok(p102.inner_text('#vrAbrir').strip() == 'Votação rápida', 'CT-KAN-254-07: com a votação aberta, a aba Votação tem o botão "Votação rápida"')
        p102.click('#vrAbrir'); p102.wait_for_selector('#votRapida', timeout=5000); p102.wait_for_timeout(300)
        cobre = p102.evaluate("(()=>{const t=document.querySelector('#tabsnav');const r=t.getBoundingClientRect();const e=document.elementFromPoint(r.left+20,r.top+r.height/2);return !!(e&&e.closest('#votRapida'))})()")
        ok(cobre and 'Quem vai votar?' in p102.inner_text('#votRapida'), 'CT-KAN-254-07: a votação rápida cobre a tela inteira (as abas ficam por baixo) e pergunta "Quem vai votar?"')
        ok(p102.inner_text('#vrConta').strip() == f'1 de {len(js102)} votaram', f'CT-KAN-254-07: o contador mostra quem já votou, inclusive pelo link ({p102.inner_text("#vrConta")!r})')
        ok(p102.locator(f'.vr-nome.feito[data-p="{js102[0]}"]').count() == 1 and p102.locator('.vr-nome.feito').count() == 1 and 'já votou' in p102.inner_text(f'.vr-nome[data-p="{js102[0]}"]'),
           'CT-KAN-254-07: quem votou pelo link aparece com ✓ "já votou"')
        for tema in ['light', 'dark']:
            p102.emulate_media(color_scheme=tema); p102.wait_for_timeout(150)
            a102 = p102.evaluate("Math.min(...[...document.querySelectorAll('#votRapida button')].map(e=>Math.round(e.getBoundingClientRect().height)))")
            ok(a102 >= 44 and p102.evaluate("document.documentElement.scrollWidth<=innerWidth && document.getElementById('votRapida').scrollWidth<=innerWidth"),
               f'CT-KAN-254-07: em 360px ({tema}), sem rolagem lateral e botões com pelo menos 44px ({a102})')
            contraste(p102, f'votação rápida: quem vai votar ({tema})')
        p102.emulate_media(color_scheme='light'); p102.screenshot(path=f'{OUT}/102-votacao-rapida.png')
        # Pessoa nova vota
        p102.click(f'.vr-nome[data-p="{js102[1]}"]'); p102.wait_for_selector('#vrConfirmar', timeout=5000); p102.wait_for_timeout(200)
        ok(p102.inner_text('.vr-quem').strip() == f'Voto de {nm102(1)}' and p102.locator('#vrConfirmar').is_disabled(),
           'CT-KAN-254-08: escolhido o nome, aparece "Voto de …" e "Confirmar voto" fica desligado até escolher alguém')
        ok(p102.locator(f'#votRapida [data-a=rapidaEscolher][data-p="{js102[1]}"]').count() == 0, 'CT-KAN-254-08: ninguém vota em si mesmo (regra da votação)')
        for tema in ['light', 'dark']:
            p102.emulate_media(color_scheme=tema); p102.wait_for_timeout(150); contraste(p102, f'votação rápida: votar ({tema})')
        p102.emulate_media(color_scheme='light')
        p102.click(f'#votRapida [data-a=rapidaEscolher][data-c2=best][data-p="{js102[3]}"]'); p102.wait_for_timeout(150)
        p102.click('#vrConfirmar'); p102.wait_for_selector('#vrProximo', timeout=6000)
        d102 = p102.evaluate(LER, V102 + f'/votos/r_{js102[1]}') or {}
        ok('Voto registrado' in p102.inner_text('#votRapida') and d102.get('o') == 'r' and d102.get('n') == 1 and d102.get('v') == {'best': js102[3]} and isinstance(d102.get('em'), (int, float)),
           f'CT-KAN-254-08: confirmar grava o voto em r_{{jogador}} com a origem, o contador e a hora, e a tela mostra "Voto registrado" ({d102})')
        ok(js102[3] not in p102.inner_text('#votRapida') and nm102(3) not in p102.inner_text('#votRapida'), 'CT-KAN-254-08: depois de confirmar, a tela limpa (o voto não fica à vista do próximo)')
        p102.click('#vrProximo'); p102.wait_for_selector('.vr-nome', timeout=5000)
        ok(p102.inner_text('#vrConta').strip() == f'2 de {len(js102)} votaram' and p102.locator(f'.vr-nome.feito[data-p="{js102[1]}"]').count() == 1,
           'CT-KAN-254-08: "Próximo" volta para "Quem vai votar?", com o contador e o ✓ de quem votou')
        # Alterar o voto de quem votou pelo link
        p102.click(f'.vr-nome[data-p="{js102[0]}"]'); p102.wait_for_selector('#dlg .conf', timeout=4000)
        dt102 = p102.inner_text('#dlg .conf')
        ok(f'{nm102(0)} já votou' in dt102 and 'O voto anterior será substituído' in dt102, f'CT-KAN-254-09: tocar em quem já votou pergunta antes de votar de novo ({dt102[:90]!r})')
        confirmar_app(p102, True); p102.wait_for_selector('#vrConfirmar', timeout=5000)
        ok(p102.locator('#votRapida [aria-pressed=true]').count() == 0, 'CT-KAN-254-09: o voto anterior não aparece para quem está votando')
        p102.click(f'#votRapida [data-a=rapidaEscolher][data-c2=bag][data-p="{js102[4]}"]'); p102.wait_for_timeout(100)
        p102.click('#vrConfirmar'); p102.wait_for_selector('#vrProximo', timeout=6000)
        v102 = [p102.evaluate(LER, V102 + '/votos/devA'), p102.evaluate(LER, V102 + f'/votos/r_{js102[0]}')]
        ok(v102[0] is None and v102[1] and v102[1].get('v') == {'bag': js102[4]}, f'CT-KAN-254-09: o voto novo substitui o do link (o do link sai no mesmo lote) ({v102})')
        # Votar de novo na votação rápida: o voto inteiro é substituído e o contador sobe
        p102.click('#vrProximo'); p102.wait_for_selector('.vr-nome', timeout=5000)
        p102.click(f'.vr-nome[data-p="{js102[1]}"]'); confirmar_app(p102, True); p102.wait_for_selector('#vrConfirmar', timeout=5000)
        p102.click(f'#votRapida [data-a=rapidaEscolher][data-c2=bag][data-p="{js102[5]}"]'); p102.wait_for_timeout(100)
        p102.click('#vrConfirmar'); p102.wait_for_selector('#vrProximo', timeout=6000)
        d102b = p102.evaluate(LER, V102 + f'/votos/r_{js102[1]}') or {}
        ok(d102b.get('n') == 2 and d102b.get('v') == {'bag': js102[5]}, f'CT-KAN-254-09: votar de novo troca o voto inteiro e o contador vai a 2 ({d102b})')
        # Sair pede confirmação
        p102.click('#vrSair'); p102.wait_for_selector('#dlg .conf', timeout=4000)
        ok('Sair da votação rápida?' in p102.inner_text('#dlg .conf'), 'CT-KAN-254-10: sair da votação rápida pede confirmação')
        p102.click('#dlg .conf [data-a=confSim]'); p102.wait_for_timeout(500)
        ok(p102.locator('#votRapida').count() == 0 and f'2 de {len(js102)} votaram' in p102.inner_text('#votRaiz'), f'CT-KAN-254-10: depois de sair, a aba Votação conta os 2 votos (um por pessoa)')
        p102.click('#quemVotou > summary'); p102.wait_for_timeout(300)
        q102 = p102.inner_text('#quemVotou')
        tg102 = p102.locator('#quemVotou .aud-origem').all_inner_texts()
        ok(sorted(tg102) == ['votação rápida', 'votação rápida'] and 'votou 2 vezes' in q102, f'CT-KAN-254-10: "Quem votou" mostra a origem (votação rápida) e quantas vezes a pessoa votou ({q102[:160]!r})')
        # Pelo link, a votação continua igual
        p102.evaluate(PUT, {V102 + '/votos/devB': {'pid': js102[6], 'v': {'best': js102[1]}, 't': 2000}}); p102.reload(); p102.wait_for_timeout(1500)
        p102.click('[data-a=tab][data-v=votacao]'); p102.wait_for_selector('#vrAbrir', timeout=8000)
        ok(f'3 de {len(js102)} votaram' in p102.inner_text('#votRaiz'), 'CT-KAN-254-10: votos pelo link e na votação rápida contam juntos')
        # Em inglês
        p102.evaluate("localStorage.setItem('nj-idioma','en')"); p102.reload(); p102.wait_for_timeout(2000)
        p102.click('[data-a=tab][data-v=votacao]'); p102.wait_for_selector('#vrAbrir', timeout=8000)
        p102.click('#vrAbrir'); p102.wait_for_selector('#votRapida', timeout=5000); p102.wait_for_timeout(300)
        e102 = p102.inner_text('#votRapida')
        p102.click(f'.vr-nome[data-p="{js102[7]}"]'); p102.wait_for_selector('#vrConfirmar', timeout=5000); e102 += p102.inner_text('#votRapida')
        falta102 = p102.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(rapida|aud|votzap|votacao)/.test(k))")
        ok('Who is voting?' in e102 and 'voted' in e102 and 'Confirm vote' in e102 and 'Quem vai' not in e102 and 'Confirmar' not in e102 and not falta102,
           f'CT-KAN-254-07: em English, a votação rápida sai traduzida ({falta102})')
        ctx102.close()



        # ---------- v103 (KAN-253, KAN-255, KAN-236, KAN-257): diaristas aguardando vaga; lista completa no WhatsApp;
        # placar guardado no aparelho; percentual e "N de M votaram"
        ctx103 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p103 = ctx103.new_page(); p103.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p103, 'criar')
        p103.fill('#le', 'v103@teste.com'); p103.fill('#lp', 'Jogo@2026'); p103.fill('#lp2', 'Jogo@2026'); p103.keyboard.press('Enter'); p103.wait_for_selector('#ngBox', timeout=12000)
        p103.fill('#ngn', 'Pacote FC'); p103.click('[data-a=pickSport][data-v=futebol]'); p103.click('[data-a=createGroup]')
        p103.wait_for_function("location.hash.startsWith('#/g/')"); p103.wait_for_timeout(1500)
        g103 = p103.url.split('#/g/')[1]
        p103.click('[data-a=tab][data-v=jogadores]'); p103.wait_for_timeout(300); p103.click('[data-a=seed]'); p103.wait_for_timeout(1500)
        p103.click('[data-a=tab][data-v=rodada]'); p103.wait_for_timeout(700)
        dia103 = p103.evaluate("Object.keys(S.pc.tipos).filter(id=>S.pc.tipos[id]==='diarista'&&S.jog[id]&&S.jog[id].ativo!==false)")
        # KAN-253: sem o controle, nada muda
        ok(p103.locator('#presAguardando').count() == 0, 'CT-KAN-253-04: com o controle de vagas desligado, a lista fica como antes (sem bloco de diaristas)')
        p103.click('#porPosicao [data-a=abrirMinimos]'); p103.wait_for_timeout(400)
        p103.fill('#minRaiz .minp[data-k="_total"]', '14')
        p103.check('#vagasCtrl'); p103.click('#dlg [data-a=salvarMinimos]'); p103.wait_for_timeout(1200)
        ag103 = p103.evaluate("[...document.querySelectorAll('#presAguardando [data-a=mark][data-v=in]')].map(b=>b.dataset.p)")
        pr103 = p103.evaluate("[...document.querySelectorAll('#presLista [data-a=mark][data-v=in]')].map(b=>b.dataset.p)")
        ok(sorted(ag103) == sorted(dia103) and not any(x in pr103 for x in dia103) and 'Diaristas (vagas fechadas)' in p103.inner_text('#presAguardandoTitulo'),
           f'CT-KAN-253-01: com as vagas fechadas, os diaristas vão para o bloco "Diaristas (vagas fechadas)" no fim da lista ({len(ag103)} de {len(dia103)})')
        ok(p103.locator('#presAguardando .tag-espera').count() == len(dia103) and 'Aguardando vaga' in p103.inner_text('#presAguardando'),
           'CT-KAN-253-01: cada diarista do bloco tem a etiqueta "Aguardando vaga"')
        # KAN-260 (pelada-v104): a etiqueta aparece inteira em 360px e 390px, mesmo com nome comprido
        MEDE260 = "[...document.querySelectorAll('#presAguardando .tag-espera')].map(t=>{const r=t.getBoundingClientRect(),p=t.closest('li').getBoundingClientRect(),n=t.closest('.pn').getBoundingClientRect();return [Math.round(r.width),t.scrollWidth,r.left>=n.left-1&&r.right<=n.right+1&&r.right<=p.right+1]})"
        p103.evaluate(PUT, {f'grupos/{g103}/jogadores/{dia103[1]}': {**(p103.evaluate(LER, f'grupos/{g103}/jogadores/{dia103[1]}') or {}), 'name': 'Fernandinho da Silva Pereira Junior'}}); p103.reload(); p103.wait_for_timeout(1800)
        for lg in [360, 390]:
            p103.set_viewport_size({'width': lg, 'height': 740}); p103.wait_for_timeout(300)
            m260 = p103.evaluate(MEDE260)
            ok(m260 and all(w >= sw - 1 and dentro for w, sw, dentro in m260), f'CT-KAN-260-01: em {lg}px, a etiqueta "Aguardando vaga" aparece inteira em todos os diaristas do bloco ({m260})')
        p103.set_viewport_size({'width': 360, 'height': 740}); p103.wait_for_timeout(200)
        for tema in ['light', 'dark']:
            p103.emulate_media(color_scheme=tema); p103.wait_for_timeout(150); contraste(p103, f'diaristas aguardando vaga ({tema})')
        p103.emulate_media(color_scheme='light')
        p103.wait_for_timeout(300); p103.screenshot(path=f'{OUT}/103-aguardando-vaga.png', full_page=True)
        d0 = dia103[0]
        p103.click(f'#presAguardando [data-a=mark][data-v=in][data-p="{d0}"]'); p103.wait_for_timeout(900)
        ok(p103.locator(f'#presLista [data-a=mark][data-v=in][data-p="{d0}"]').count() == 1 and p103.locator(f'#presAguardando [data-p="{d0}"]').count() == 0
           and p103.get_attribute(f'#presLista [data-a=mark][data-v=in][data-p="{d0}"]', 'aria-pressed') == 'true',
           'CT-KAN-253-02: o administrador confirma o diarista pelo bloco, e ele passa para a lista, sem a etiqueta')
        # Presença: 9 mensalistas confirmados, 1 "não vou" e o resto sem resposta
        men103 = [x for x in pr103 if x not in dia103]
        for x in men103[:9]:
            p103.click(f'#presLista [data-a=mark][data-v=in][data-p="{x}"]'); p103.wait_for_timeout(300)
        for x in men103[9:10]:
            p103.click(f'#presLista [data-a=mark][data-v=out][data-p="{x}"]'); p103.wait_for_timeout(300)
        p103.wait_for_timeout(600)
        nm103 = lambda i: p103.evaluate("(x)=>S.jog[x].name", i)
        # KAN-255: mensagem do WhatsApp com quem não vai, quem não respondeu e o que falta
        p103.click('[data-a=shareConvite]'); p103.wait_for_selector('#shtxt', timeout=8000); p103.wait_for_timeout(300)
        z103 = p103.input_value('#shtxt')
        sem103 = [x for x in men103[10:] if p103.evaluate("(x)=>S.jog[x].ativo!==false", x)]
        ok('✅ *Confirmados (10)*' in z103 and '❌ *Não vão (1)*' in z103 and nm103(men103[9]) in z103.split('❌')[1].split('⏳')[0],
           f'CT-KAN-255-01: a mensagem traz quem não vai, com os nomes ({z103[-220:]!r})')
        bloco_sem = z103.split('⏳')[1] if '⏳' in z103 else ''
        ok(f'*Ainda não responderam ({len(sem103)})*' in bloco_sem and all(nm103(x) in bloco_sem for x in sem103) and not any(nm103(x) in bloco_sem for x in dia103[1:]),
           f'CT-KAN-255-02: "Ainda não responderam" lista o elenco sem resposta, sem os diaristas com as vagas fechadas ({len(sem103)})')
        ok('⚠️ Faltam 4 jogadores' in z103, 'CT-KAN-255-01: a mensagem diz o que falta para o mínimo do jogo')
        ok(p103.is_checked('#zapNaoVao') and p103.is_checked('#zapSemResposta'), 'CT-KAN-255-03: as duas caixas vêm marcadas')
        for tema in ['light', 'dark']:
            p103.emulate_media(color_scheme=tema); p103.wait_for_timeout(150)
            ok(p103.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'CT-KAN-255-03: em 360px ({tema}), a janela não tem rolagem lateral')
            contraste(p103, f'janela da mensagem da rodada ({tema})')
        p103.emulate_media(color_scheme='light')
        p103.uncheck('#zapSemResposta'); p103.wait_for_timeout(300)
        z103b = p103.input_value('#shtxt')
        ok('⏳' not in z103b and '❌ *Não vão (1)*' in z103b, 'CT-KAN-255-03: desmarcando "Quem ainda não respondeu", a lista sai da mensagem')
        p103.click('#dlg [data-a=close]'); p103.wait_for_timeout(300)
        p103.click('[data-a=shareConvite]'); p103.wait_for_selector('#shtxt', timeout=8000); p103.wait_for_timeout(300)
        ok(not p103.is_checked('#zapSemResposta') and '⏳' not in p103.input_value('#shtxt'), 'CT-KAN-255-03: a escolha fica lembrada no aparelho')
        p103.check('#zapSemResposta'); p103.wait_for_timeout(200)
        p103.click('#dlg [data-a=close]'); p103.wait_for_timeout(300)
        # KAN-236: partida em andamento guardada no aparelho
        sortear(p103)
        p103.click('[data-a=tab][data-v=partida]'); p103.wait_for_selector('[data-a=goal]', timeout=10000); p103.wait_for_timeout(400)
        def gol103(lado, n):
            p103.locator(f'[data-a=goal][data-v={lado}]').first.click(); p103.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
            sem_assist(p103)
            p103.locator('[data-a=addGoal][data-p]').nth(n).click(); p103.wait_for_timeout(300)
            sem_assist(p103)
        gol103('a', 0); gol103('b', 0); gol103('a', 1)
        p103.click('#clockBtn'); p103.wait_for_timeout(1500)
        g103a = p103.evaluate("[S.live.a,S.live.b,S.live.goals.map(g=>[g.t,g.pid])]")
        p103.reload(); p103.wait_for_timeout(1800); p103.click('[data-a=tab][data-v=partida]'); p103.wait_for_selector('[data-a=goal]', timeout=10000); p103.wait_for_timeout(600)
        g103b = p103.evaluate("[S.live.a,S.live.b,S.live.goals.map(g=>[g.t,g.pid])]")
        sc103 = [s.strip() for s in p103.locator('.board .sc').all_inner_texts()]
        rel103 = p103.evaluate("[S.live.run, S.live.el + (S.live.run ? (Date.now()-S.live.st)/1000 : 0)]")
        ok(g103b == g103a and sc103 == ['2', '1'] and not p103.locator('[data-a=corrigirGols]').is_disabled(),
           f'CT-KAN-236-01: depois de recarregar, o placar, os gols com os autores e os times em quadra voltam ({sc103}, {len(g103b[2])} gols)')
        ok(rel103[0] is True and rel103[1] >= 1.5, f'CT-KAN-236-01: o cronômetro continua contando depois de recarregar ({rel103})')
        p103.click('[data-a=saveMatch]'); p103.wait_for_timeout(1200)
        p103.reload(); p103.wait_for_timeout(1800); p103.click('[data-a=tab][data-v=partida]'); p103.wait_for_selector('[data-a=goal]', timeout=10000); p103.wait_for_timeout(600)
        sc103b = [s.strip() for s in p103.locator('.board .sc').all_inner_texts()]
        ok(sc103b == ['0', '0'] and p103.evaluate("S.live.goals.length") == 0, f'CT-KAN-236-02: depois de "Encerrar e salvar partida", a partida guardada não volta ({sc103b})')
        # KAN-257: percentual e "N de M votaram"
        js103 = p103.evaluate("[...new Set([].concat(...(S.rod[S.rid].times||[]).map(t=>t.players)))]")
        rid103 = p103.evaluate("S.rid")
        V103 = f'grupos/{g103}/votacoes/v103'
        p103.evaluate(PUT, {V103: {'rid': rid103, 'title': 'Destaques', 'open': True, 'createdAt': 5, 'cats': [{'id': 'best', 'name': 'Melhor jogador', 'pos': None}]},
                            V103 + '/votos/d1': {'pid': js103[0], 'v': {'best': js103[5]}, 't': 1},
                            V103 + '/votos/d2': {'pid': js103[1], 'v': {'best': js103[5]}, 't': 2},
                            V103 + '/votos/d3': {'pid': js103[2], 'v': {'best': js103[6]}, 't': 3},
                            V103 + '/votos/r_' + js103[2]: {'pid': js103[2], 'v': {'best': js103[6]}, 't': 4, 'o': 'r', 'n': 1, 'em': 4}})
        p103.reload(); p103.wait_for_timeout(1500)
        p103.click('[data-a=tab][data-v=votacao]'); p103.wait_for_selector('#votPart', timeout=8000); p103.wait_for_timeout(300)
        vp103 = p103.inner_text('#votPart')
        ok(vp103.strip() == f'3 de {len(js103)} votaram', f'CT-KAN-257-02: o cabeçalho mostra "3 de {len(js103)} votaram" (a mesma pessoa no link e na votação rápida conta uma vez) ({vp103!r})')
        pc103 = sorted(p103.locator('#votRaiz .vt-n').all_inner_texts())
        ok(pc103 == ['1 · 33%', '2 · 67%'], f'CT-KAN-257-01: cada nome mostra os votos e o percentual da categoria ({pc103})')
        p103.click('[data-a=toggleVote]'); p103.wait_for_timeout(1200)
        dv103 = p103.evaluate(LER, V103) or {}
        ok(dv103.get('votaram') == 3 and dv103.get('podiam') == len(js103), f'CT-KAN-257-02: ao encerrar, fica gravado quantos votaram de quantos podiam ({dv103.get("votaram")}, {dv103.get("podiam")})')
        p103.click('[data-a=shareVote]'); p103.wait_for_selector('#votZapRaiz #shtxt', timeout=5000)
        r103 = p103.input_value('#shtxt')
        ok(f'{nm103(js103[5])} (2 · 67%)' in r103 and f'Votaram 3 de {len(js103)}' in r103, f'CT-KAN-257-04: o resultado no WhatsApp traz o percentual e "Votaram 3 de {len(js103)}" ({r103[:160]!r})')
        p103.click('#dlg [data-a=close]'); p103.wait_for_timeout(200)
        p103.goto(URL + f'#/p/{g103}/v/v103'); p103.wait_for_timeout(2500)
        lk103 = p103.inner_text('#main') if p103.locator('#main').count() else p103.inner_text('body')
        ok(f'3 de {len(js103)} votaram' in lk103 and '67%' in lk103, f'CT-KAN-257-03: o link da votação encerrada mostra o percentual e quantos votaram ({lk103[:160]!r})')
        # Em inglês
        p103.evaluate("localStorage.setItem('nj-idioma','en')"); p103.goto(URL + '#/g/' + g103); p103.reload(); p103.wait_for_timeout(2000)
        p103.click('[data-a=tab][data-v=votacao]'); p103.wait_for_selector('#votPart', timeout=8000)
        e103 = p103.inner_text('#votPart')
        p103.click('[data-a=shareVote]'); p103.wait_for_selector('#votZapRaiz #shtxt', timeout=5000); e103 += p103.input_value('#shtxt')
        p103.click('#dlg [data-a=close]'); p103.wait_for_timeout(200)
        falta103 = p103.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(zaplista|vagas\\.(aguardando|bloco)|votzap|votacao\\.votosPct|voto\\.participacao)/.test(k))")
        ok(f'of {len(js103)} voted' in e103 and 'Votaram' not in e103 and not falta103, f'CT-KAN-257: em English, a participação e o resultado saem traduzidos ({falta103})')
        ctx103.close()

        # ---------- v105 (KAN-239, 1ª parte): falhas no uso gravadas com os dados de navegação; lista no portal
        UA105 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
        ctx105 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block', user_agent=UA105)
        p105 = ctx105.new_page()
        abrir_entrada(p105, 'criar')
        p105.fill('#le', 'v105@teste.com'); p105.fill('#lp', 'Jogo@2026'); p105.fill('#lp2', 'Jogo@2026'); p105.keyboard.press('Enter'); p105.wait_for_selector('#ngBox', timeout=12000)
        p105.fill('#ngn', 'Falhas FC'); p105.click('[data-a=pickSport][data-v=futebol]'); p105.click('[data-a=createGroup]')
        p105.wait_for_function("location.hash.startsWith('#/g/')"); p105.wait_for_timeout(1500)
        g105 = p105.url.split('#/g/')[1]
        p105.goto(URL + '#/p/' + g105); p105.wait_for_timeout(1500)
        FALHAS = "(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return Object.entries(s).filter(([k])=>/^falhas\\/[^/]+$/.test(k)).map(([,v])=>v)})()"
        p105.evaluate("document.dispatchEvent(new CustomEvent('nj-appcheck-falhou',{detail:'appCheck/fetch-status-error'}));document.dispatchEvent(new CustomEvent('nj-appcheck-falhou',{detail:'appCheck/fetch-status-error'}))")
        p105.evaluate("setTimeout(()=>{throw new Error('Teste KAN-239: x is null')},0)")
        p105.evaluate("document.dispatchEvent(new CustomEvent('nj-gravacao-falhou',{detail:'permission-denied'}))")
        p105.wait_for_timeout(4500)
        f105 = p105.evaluate(FALHAS)
        por = {x['t']: x for x in f105}
        ac = por.get('appcheck') or {}
        ok(len(f105) == 3 and sorted(por) == ['appcheck', 'erro', 'gravacao'], f'CT-KAN-239-05: o comprovante do App Check, o erro de código e a gravação recusada viram 3 registros ({sorted(por)})')
        ok(ac.get('n') == 2 and ac.get('m') == 'appCheck/fetch-status-error' and ac.get('nav') == 'Safari 17' and ac.get('so') == 'iOS 17' and ac.get('disp') == 'celular'
           and re.match(r'pelada-v\d+$', str(ac.get('v'))) and ac.get('r') == 'r' and ac.get('g') == g105 and ac.get('lang') and isinstance(ac.get('em'), (int, float)) and ac.get('inst') is False,
           f'CT-KAN-239-05: a mesma falha na mesma visita vira um registro com a contagem e os dados de navegação ({ac})')
        er = por.get('erro') or {}
        ok('x is null' in er.get('m', '') and len(er.get('p', '')) > 0 and (por.get('gravacao') or {}).get('m') == 'permission-denied',
           f'CT-KAN-239-05: o erro de código leva o trecho do código; a gravação recusada, o código do Firebase ({er.get("m")!r})')
        proib = {'email', 'nome', 'name', 'tel', 'uid', 'ip'}
        ok(all(not (proib & set(x)) for x in f105) and all(set(x) <= {'v', 't', 'm', 'p', 'r', 'g', 'nav', 'so', 'disp', 'inst', 'lang', 'n', 'em', 'd'} for x in f105),
           'CT-KAN-239-05: nenhum registro leva nome, e-mail, telefone, identificador da pessoa ou IP')
        # No máximo 20 por aparelho por dia
        p105.evaluate("localStorage.setItem('nj-falhas-dia',JSON.stringify({d:JSON.parse(localStorage.getItem('nj-falhas-dia')).d,n:20}))")
        p105.evaluate("document.dispatchEvent(new CustomEvent('nj-appcheck-falhou',{detail:'outra'}))"); p105.wait_for_timeout(4000)
        ok(len(p105.evaluate(FALHAS)) == 3, 'CT-KAN-239-06: o 21º registro do dia no mesmo aparelho não é gravado')
        # Portal: lista agrupada
        if TEM_PORTAL:
            p105.goto(URL.rsplit('/', 1)[0] + '/portal.html'); p105.wait_for_timeout(600)
            if p105.locator('[data-p=google]').count(): p105.click('[data-p=google]')
            p105.wait_for_selector('#falhasPainel', timeout=8000); p105.wait_for_timeout(300)
            fp = p105.inner_text('#falhasPainel')
            ok('App Check' in fp and 'appCheck/fetch-status-error' in fp and '2×' in fp and 'Gravação' in fp and 'Erro' in fp,
               f'CT-KAN-239-07: o portal lista as falhas agrupadas por tipo e mensagem, com as vezes ({fp[:200]!r})')
            p105.locator('#falhasPainel details').first.click(); p105.wait_for_timeout(200)
            ok('Safari 17 · iOS 17 · celular: 2×' in p105.inner_text('#falhasPainel') and 'link da rodada' in p105.inner_text('#falhasPainel'),
               'CT-KAN-239-07: aberta, a falha mostra o navegador, o aparelho e a tela')
            for tema in ['light', 'dark']:
                p105.emulate_media(color_scheme=tema); p105.wait_for_timeout(150); contraste(p105, f'falhas no portal ({tema})')
            p105.emulate_media(color_scheme='light')
        ctx105.close()

        # ---------- v106 (KAN-262, KAN-248, KAN-250, KAN-251): link mais leve; nome inteiro na lista do link; janelas
        # prontas para digitar; "Automático" e o horário sem quebrar no meio
        ctx106 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', user_agent=UA105, timezone_id='America/Sao_Paulo')
        p106 = ctx106.new_page(); p106.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p106, 'criar')
        p106.fill('#le', 'v106@teste.com'); p106.fill('#lp', 'Jogo@2026'); p106.fill('#lp2', 'Jogo@2026'); p106.keyboard.press('Enter'); p106.wait_for_selector('#ngBox', timeout=12000)
        # KAN-250: o local do dia fixo tem rótulo visível
        rot106 = p106.evaluate("[...document.querySelectorAll('#ngBox .srow .sl')].map(i=>{const l=i.closest('label');return [l&&l.querySelector('.hrot-t')?l.querySelector('.hrot-t').textContent:'',i.placeholder]})")
        ok(rot106 and all(r == ['Local (opcional)', 'Ex.: Arena Society, quadra 3'] for r in rot106), f'CT-KAN-250-04: no Novo grupo, o local de cada dia fixo tem o rótulo "Local (opcional)" e um exemplo ({rot106})')
        p106.fill('#ngn', 'Leve FC'); p106.click('[data-a=pickSport][data-v=futebol]'); p106.click('[data-a=createGroup]')
        p106.wait_for_function("location.hash.startsWith('#/g/')"); p106.wait_for_timeout(1500)
        g106 = p106.url.split('#/g/')[1]
        p106.click('[data-a=tab][data-v=jogadores]'); p106.wait_for_timeout(300); p106.click('[data-a=seed]'); p106.wait_for_timeout(1500)
        js106 = p106.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false).sort()")
        nomes106 = {js106[0]: 'Alemão', js106[1]: 'Zé Carlos da Silva', js106[2]: 'Fernandinho', js106[3]: 'Maximiliano Bartolomeu Constantino de Albuquerque'}
        for pid, nm in nomes106.items():
            p106.evaluate(PUT, {f'grupos/{g106}/jogadores/{pid}': {**(p106.evaluate(LER, f'grupos/{g106}/jogadores/{pid}') or {}), 'name': nm}})
        # KAN-250: Lançar abre com o cursor em "Tipo"
        p106.reload(); p106.wait_for_timeout(1500)
        p106.click('[data-a=tab][data-v=caixa]'); p106.wait_for_selector('[data-a=addLan]', timeout=8000); p106.click('[data-a=addLan]'); p106.wait_for_timeout(400)
        ok(p106.evaluate("document.activeElement.id") == 'lk', f'CT-KAN-250-01: "Novo lançamento" abre com o cursor no campo "Tipo" ({p106.evaluate("document.activeElement.id")!r})')
        p106.fill('#lv', '80'); p106.select_option('#lp2', js106[5]); p106.focus('#lv'); p106.keyboard.press('Enter'); p106.wait_for_timeout(900)
        ok(not p106.evaluate("document.getElementById('dlg').open") and 'Mensalidade' in p106.inner_text('#lanLista'), 'CT-KAN-250-05: Enter no valor salva o lançamento')
        # KAN-250: Nova votação abre com o cursor em "Título", selecionado
        p106.click('[data-a=tab][data-v=rodada]'); p106.wait_for_timeout(500)
        for x in js106[:10]:
            p106.click(f'#presLista [data-a=mark][data-v=in][data-p="{x}"]'); p106.wait_for_timeout(250)
        sortear(p106)
        p106.click('[data-a=tab][data-v=votacao]'); p106.wait_for_selector('[data-a=newVote]', timeout=8000); p106.click('[data-a=newVote]'); p106.wait_for_timeout(400)
        f106 = p106.evaluate("(()=>{const a=document.activeElement;return [a.id,a.selectionStart,a.selectionEnd,a.value.length]})()")
        ok(f106[0] == 'vt' and f106[1] == 0 and f106[2] == f106[3] > 0, f'CT-KAN-250-02: "Nova votação" abre com o cursor no título, com o texto selecionado para trocar ({f106})')
        p106.click('#dlg [data-a=close]'); p106.wait_for_timeout(300)
        # KAN-250: nenhuma janela de formulário da gestão abre com o foco na própria janela
        foco106 = []
        for tab, sel in [('rodada', '[data-a=newRodada]'), ('rodada', '#porPosicao [data-a=abrirMinimos]'), ('jogadores', '[data-a=addPlayer]'), ('caixa', '[data-a=addLan]')]:
            p106.click(f'[data-a=tab][data-v={tab}]'); p106.wait_for_timeout(500)
            if not p106.locator(sel).count(): continue
            p106.locator(sel).first.click(); p106.wait_for_timeout(500)
            foco106.append((sel, p106.evaluate("(()=>{const a=document.activeElement,d=document.getElementById('dlg');return d.open&&a!==d&&d.contains(a)})()")))
            p106.click('#dlg [data-a=close]'); p106.wait_for_timeout(300); confirmar_app(p106, True)
        ok(len(foco106) >= 3 and all(x for _, x in foco106), f'CT-KAN-250-03: as janelas de formulário abrem com o foco num campo dentro delas ({foco106})')
        # KAN-251: Aparência sem palavra quebrada, três opções da mesma altura
        p106.click('[data-a=tab][data-v=grupo]'); p106.wait_for_selector('.theme-seg', timeout=8000)
        MEDE251 = "[...document.querySelectorAll('.theme-seg button')].map(b=>{const n=b.querySelector('.ts-nome');return [n.textContent,n.getClientRects().length,Math.round(b.getBoundingClientRect().height),n.getBoundingClientRect().right<=b.getBoundingClientRect().right+1]})"
        for lg, alt in [(360, 740), (390, 844)]:
            p106.set_viewport_size({'width': lg, 'height': alt}); p106.wait_for_timeout(250)
            for tema in ['light', 'dark']:
                p106.emulate_media(color_scheme=tema); p106.wait_for_timeout(100)
                m251 = p106.evaluate(MEDE251)
                ok(len(m251) == 3 and all(r == 1 and dentro for _, r, _, dentro in m251) and len({h for _, _, h, _ in m251}) == 1 and m251[0][2] >= 44,
                   f'CT-KAN-251-01: em {lg}px ({tema}), Automático, Claro e Escuro aparecem inteiros, numa linha, com a mesma altura de 44px ou mais ({m251})')
        p106.emulate_media(color_scheme='light'); p106.set_viewport_size({'width': 360, 'height': 740}); p106.wait_for_timeout(200)
        p106.screenshot(path=f'{OUT}/106-aparencia-360.png')
        p106.click('.theme-seg [data-v=auto]'); p106.wait_for_timeout(200)
        ok(p106.get_attribute('.theme-seg [data-v=auto]', 'aria-checked') == 'true' and 'Segue o tema do celular' in p106.inner_text('.theme-seg + p'), 'CT-KAN-251-02: tocar em Automático marca a opção e a ajuda continua')
        # KAN-251: no Histórico, o horário da rodada não quebra no meio
        ontem106 = p106.evaluate("(()=>{const d=new Date();d.setDate(d.getDate()-3);return d.toLocaleDateString('sv')})()")
        p106.evaluate(PUT, {f'grupos/{g106}/rodadas/hist106': {'date': ontem106, 'time': '20:00', 'fim': '22:00', 'place': 'Quadra 106', 'createdAt': 1}})
        p106.reload(); p106.wait_for_timeout(1500)
        p106.click('[data-a=tab][data-v=historico]'); p106.wait_for_timeout(1200)
        if p106.locator('li', has_text='Quadra 106').count() == 0 and p106.locator('[data-a=histBuscar]').count():
            p106.click('[data-a=histBuscar]'); p106.wait_for_timeout(900)
        p106.locator('li', has_text='Quadra 106').locator('[data-a=histAbrir]').click(); p106.wait_for_timeout(700)
        h251 = p106.evaluate("(()=>{const n=document.querySelector('main h2 .nw');return n?[n.textContent,n.getClientRects().length]:null})()")
        ok(h251 and '20:00' in h251[0] and '22:00' in h251[0] and h251[1] == 1, f'CT-KAN-251-03: no detalhe do Histórico em 360px, "20:00–22:00" fica inteiro numa linha ({h251})')
        p106.screenshot(path=f'{OUT}/106-historico-360.png')
        # KAN-262: o link abre sem as janelas do jogador; elas baixam ao tocar (os times sorteados acima saem, para a lista voltar)
        rid106 = p106.evaluate("S.rid")
        p106.goto(URL + '#/p/' + g106); p106.wait_for_selector('.hero-r h2', timeout=8000)
        r106 = p106.evaluate(LER, f'grupos/{g106}/rodadas/{rid106}') or {}
        p106.evaluate(PUT, {f'grupos/{g106}/rodadas/{rid106}': {k: v for k, v in r106.items() if k not in ('times', 'locked')}})
        p106.reload(); p106.wait_for_selector('.hero-r h2', timeout=8000); p106.wait_for_timeout(800)
        baixou = lambda: p106.evaluate("performance.getEntriesByType('resource').some(e=>/JanelasLink-/.test(e.name))")
        okp(pagina_usa_pedacos() and not baixou(), 'CT-KAN-262-06: o link do jogador abre sem baixar as janelas "Adicionar meu nome" e "Instalar"')
        p106.click('#installBtn'); p106.wait_for_selector('#dlg ol li', timeout=8000)
        ok('Instalar no celular' in p106.inner_text('#dlg') and 'Safari' in p106.inner_text('#dlg'), 'CT-KAN-262-06: no iPhone, "Instalar" abre a janela com os passos do Safari')
        okp(pagina_usa_pedacos() and baixou(), 'CT-KAN-262-06: a janela baixa só quando o jogador toca')
        p106.click('#dlg [data-a=close]'); p106.wait_for_timeout(200)
        sw106 = p106.evaluate("fetch('sw.js').then(r=>r.text()).then(t=>(/const PARTES_LINK = (\\[.*?\\]);/.exec(t)||[])[1]||'')")
        okp(pagina_usa_pedacos() and 'JanelasLink-' in sw106 and 'PARTES_LINK).catch' in p106.evaluate("fetch('sw.js').then(r=>r.text())"),
            f'CT-KAN-262-07: o service worker guarda as janelas do link na instalação, para abrir também sem internet ({sw106[:80]})')
        # KAN-248: nome inteiro em até 2 linhas, "você" embaixo
        p106.click(f'[data-a=pubMark][data-v=in][data-p="{js106[0]}"]'); p106.wait_for_timeout(1200)
        MEDE248 = """(id)=>{const b=document.querySelector(`[data-a=pubMark][data-v=in][data-p="${id}"]`);if(!b)return null;const li=b.closest('li'),t=li.querySelector('.pn-txt'),
          lh=parseFloat(getComputedStyle(t).lineHeight);return {nome:t.textContent,cabe:t.scrollHeight<=t.clientHeight+1&&t.scrollWidth<=t.clientWidth+1,linhas:Math.round(t.clientHeight/lh),
          tags:[...li.querySelectorAll('.pn-tags .tag')].map(x=>x.textContent),title:t.title,me:li.classList.contains('me-row'),
          bts:[...li.querySelectorAll('.mk.lg button')].map(x=>{const r=x.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]}),texto:li.textContent}}"""
        for tema in ['light', 'dark']:
            p106.emulate_media(color_scheme=tema); p106.wait_for_timeout(150)
            a248 = p106.evaluate(MEDE248, js106[0])
            ok(a248 and a248['me'] and a248['nome'] == 'Alemão' and a248['cabe'] and a248['tags'] == ['você'],
               f'CT-KAN-248-01: em 360px ({tema}), a minha linha mostra "Alemão" inteiro e a etiqueta "você" embaixo ({a248})')
            contraste(p106, f'lista do link com nome em 2 linhas ({tema})')
        p106.emulate_media(color_scheme='light')
        z248 = p106.evaluate(MEDE248, js106[1])
        ok(z248 and z248['cabe'] and z248['linhas'] <= 2, f'CT-KAN-248-02: "Zé Carlos da Silva" aparece inteiro em até 2 linhas ({z248})')
        larg106 = p106.evaluate("document.documentElement.scrollWidth")
        ok(all(w >= 44 and h >= 44 for w, h in (z248 or {}).get('bts', [])) and larg106 <= 360, f'CT-KAN-248-03: com o nome em 2 linhas, Vou e Não vou continuam com 44px e a página não rola de lado ({z248 and z248["bts"]}, {larg106}px)')
        ok(a248 and a248['texto'].index('Alemão') < a248['texto'].index('você') < a248['texto'].index('Vou'), f'CT-KAN-248-04: o leitor de tela ouve o nome, depois "você" e o estado ({a248 and a248["texto"]!r})')
        l248 = p106.evaluate(MEDE248, js106[3])
        ok(l248 and not l248['cabe'] and l248['linhas'] == 2 and l248['title'] == nomes106[js106[3]], f'CT-KAN-248-05: nome comprido demais corta na 2ª linha e fica inteiro no title ({l248 and [l248["linhas"], l248["title"]]})')
        p106.screenshot(path=f'{OUT}/106-link-nomes-360.png', full_page=True)
        # Em inglês
        p106.evaluate("localStorage.setItem('nj-idioma','en')"); p106.reload(); p106.wait_for_selector('.hero-r h2', timeout=8000); p106.wait_for_timeout(1200)
        e248 = p106.evaluate(MEDE248, js106[0])
        falta106 = p106.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(publico|pwa)/.test(k))")
        ok(e248 and e248['tags'] == ['you'] and not falta106, f'CT-KAN-248-01: em English, a etiqueta diz "you" ({e248 and e248["tags"]}, {falta106})')
        ctx106.close()

        # ---------- v52 (KAN-172): isento de pagamento e "Recebe por jogo" com A pagar no Caixa (navegador separado)
        ctx7 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, color_scheme='light', service_workers='block', timezone_id='America/Sao_Paulo')
        p7 = ctx7.new_page()
        p7.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p7, 'criar')
        p7.fill('#le', 'caixa.jogo@teste.com'); p7.fill('#lp', 'Jogo@2026'); p7.fill('#lp2', 'Jogo@2026'); p7.keyboard.press('Enter'); p7.wait_for_timeout(1300)
        p7.fill('#ngn', 'Goleiros Pagos'); p7.click('[data-a=pickSport][data-v=futebol]'); p7.click('[data-a=createGroup]'); p7.wait_for_timeout(1500)
        g7 = p7.url.split('#/g/')[1]
        p7.click('[data-a=tab][data-v=jogadores]'); p7.wait_for_timeout(300); p7.click('[data-a=seed]'); p7.wait_for_timeout(1500)
        ids7 = p7.evaluate("Object.keys(S.jog).sort()")
        gol, outros = ids7[0], ids7[1:]
        nome_gol = p7.evaluate("(id)=>S.jog[id].name", gol)
        p7.click(f'[data-a=editPlayer][data-p="{gol}"]'); p7.wait_for_timeout(300)
        opc = p7.evaluate("[...document.querySelectorAll('#ptp option')].map(o=>o.textContent)")
        ok(opc == ['Mensalista', 'Diarista', 'Isento de pagamento'] and p7.locator('#prvBox').is_hidden(),
           f'CT-KAN-172-05: ficha tem o tipo "Isento de pagamento" e o valor por jogo só aparece ao marcar "Recebe por jogo" ({opc})')
        p7.select_option('#ptp', 'isento'); p7.check('#prj'); p7.wait_for_timeout(150)
        ok(p7.locator('#prvBox').is_visible() and p7.evaluate("document.activeElement.id") == 'prv', 'CT-KAN-172-05: ao marcar "Recebe por jogo", aparece o valor e o cursor vai para ele')
        p7.screenshot(path=f'{OUT}/52-ficha-recebe-por-jogo.png'); contraste(p7, 'Ficha com Recebe por jogo')
        p7.click('[data-a=savePlayer]'); p7.wait_for_timeout(400)
        ok('Informe o valor por jogo' in p7.inner_text('#toast') and p7.locator('#prv').count() == 1, 'CT-KAN-172-06: "Recebe por jogo" sem valor não salva e avisa')
        p7.fill('#prv', '50'); p7.click('[data-a=savePlayer]'); p7.wait_for_timeout(800)
        hoje7 = p7.evaluate("new Date().toLocaleDateString('sv')")
        rod7 = lambda h, times: {'date': hoje7, 'time': h, 'place': '', 'createdAt': 1, 'times': [{'players': t} for t in times]}
        p7.evaluate(PUT, {
            f'grupos/{g7}/rodadas/rA': rod7('08:00', [[gol, outros[0]], [outros[1], outros[2]]]),
            f'grupos/{g7}/rodadas/rB': rod7('09:00', [[outros[0], outros[1]], [gol, outros[2]]]),
            f'grupos/{g7}/rodadas/rC': rod7('10:00', [[outros[0], outros[1]], [outros[2], outros[3]]]),
            f'grupos/{g7}/rodadas/rD': {'date': hoje7, 'time': '11:00', 'place': '', 'createdAt': 1},
            f'grupos/{g7}/rodadas/rD/presencas/{gol}': {'s': 'in', 'nome': nome_gol, 'at': 1},
        })
        p7.reload(); p7.wait_for_timeout(1200); p7.click('[data-a=tab][data-v=caixa]'); p7.wait_for_timeout(900)
        pend7 = p7.inner_text('#pendLista')
        ok(nome_gol not in pend7 and p7.evaluate("(id)=>S.pc.tipos[id]", gol) == 'isento',
           'CT-KAN-172-01: isento que jogou não aparece nas pendências de mensalidade nem de diária')
        lin = p7.locator('#apagarLista li')
        t7 = lin.first.inner_text().replace('\xa0', ' ') if lin.count() else ''
        ok(lin.count() == 1 and nome_gol in t7 and '2 jogos' in t7 and 'R$ 100,00' in t7,
           f'CT-KAN-172-02: quem recebe por jogo aparece em A pagar com os 2 jogos em que jogou (não conta onde só confirmou) e o total ({t7!r})')
        kpi = p7.inner_text('#kpiAPagar').replace('\xa0', ' ') if p7.locator('#kpiAPagar').count() else ''
        ok('R$ 100,00' in kpi, f'CT-KAN-172-02: o total a pagar aparece ao lado do saldo ({kpi!r})')
        p7.screenshot(path=f'{OUT}/52-caixa-a-pagar.png', full_page=True); contraste(p7, 'Caixa com A pagar')
        p7.set_viewport_size({'width': 360, 'height': 780}); p7.wait_for_timeout(200)
        larg = p7.evaluate("document.documentElement.scrollWidth")
        ok(larg <= 360, f'A pagar cabe em 360px sem rolagem lateral ({larg}px)')
        p7.screenshot(path=f'{OUT}/52-caixa-a-pagar-360.png', full_page=True)
        p7.set_viewport_size({'width': 390, 'height': 844})
        p7.click('#apagarLista [data-a=abrirPagar]'); p7.wait_for_timeout(400)
        marc = p7.locator('#apgLista .apg:checked').count()
        ok(marc == 2 and p7.input_value('#apgv') == '100', f'CT-KAN-172-03: a janela Pagar lista os 2 jogos marcados e o total ({marc}, {p7.input_value("#apgv")})')
        p7.locator('#apgLista .apg').first.uncheck(); p7.wait_for_timeout(150)
        ok(p7.input_value('#apgv') == '50', f'CT-KAN-172-03: desmarcar um jogo recalcula o total ({p7.input_value("#apgv")})')
        p7.screenshot(path=f'{OUT}/52-janela-pagar.png'); contraste(p7, 'Janela Pagar')
        p7.click('[data-a=pagarJogos]'); p7.wait_for_timeout(900)
        t8 = p7.locator('#apagarLista li').first.inner_text().replace('\xa0', ' ') if p7.locator('#apagarLista li').count() else ''
        sal = p7.locator('.kpis .money').first.inner_text().replace('\xa0', ' ')
        ok('1 jogo' in t8 and 'R$ 50,00' in t8 and '50,00' in sal and ('-' in sal or '−' in sal),
           f'CT-KAN-172-03: Paguei com 1 de 2 jogos lança a despesa de 1 jogo, sobra 1 em A pagar e o saldo desconta só o pago ({t8!r}, saldo {sal!r})')
        ok('Pagamento de 1 jogo' in p7.inner_text('#lanLista'), 'CT-KAN-172-03: a despesa aparece nos lançamentos do mês como "Pagamento de 1 jogo"')
        p7.reload(); p7.wait_for_timeout(1300); p7.click('[data-a=tab][data-v=caixa]'); p7.wait_for_timeout(900)
        t9 = p7.locator('#apagarLista li').first.inner_text().replace('\xa0', ' ') if p7.locator('#apagarLista li').count() else ''
        ok('1 jogo' in t9 and p7.evaluate("(id)=>S.pc.tipos[id]==='isento'&&S.pc.porJogo[id].v===50", gol),
           f'CT-KAN-172-04: depois de recarregar, tipo isento, valor por jogo e o pagamento continuam ({t9!r})')
        p7.click('#apagarLista [data-a=abrirPagar]'); p7.wait_for_timeout(400); p7.click('[data-a=pagarJogos]'); p7.wait_for_timeout(900)
        ok(p7.locator('#apagarLista').count() == 0 and p7.locator('#kpiAPagar').count() == 0, 'CT-KAN-172-03: tudo pago, o bloco A pagar some')
        ctx7.close()

    if parte('a'):
        # ---------- v51 (KAN-171): app instalado só volta sozinho ao link do jogador em aparelho que nunca entrou com conta
        ctx6 = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', timezone_id='America/Sao_Paulo')
        ctx6.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true})")
        p6 = ctx6.new_page()
        p6.on('pageerror', lambda e: errs.append(str(e)))
        banco = pg.evaluate("localStorage.getItem('pelada-demo-v2')")
        p6.goto(URL); p6.wait_for_timeout(300)
        p6.evaluate("b=>{localStorage.clear();localStorage.setItem('pelada-demo-v2',b)}", banco)
        p6.goto('about:blank')  # o modo demonstração lê o banco ao abrir
        def abrir_app6():
            p6.goto('about:blank'); p6.goto(URL); p6.wait_for_timeout(1200)
            return p6.evaluate("location.hash")
        p6.goto(URL + '#/p/' + gid_fut); p6.wait_for_selector('.hero-r h2', timeout=8000)
        h1 = abrir_app6()
        ok(h1.startswith('#/p/' + gid_fut), f'CT-KAN-171-01: jogador sem conta, com o app instalado, abre direto na rodada do último link ({h1!r})')
        abrir_entrada(p6, 'criar')
        p6.fill('#le', 'instalado@teste.com'); p6.fill('#lp', 'Jogo@2026'); p6.fill('#lp2', 'Jogo@2026'); p6.keyboard.press('Enter'); p6.wait_for_timeout(1300)
        p6.goto(URL + '#/p/' + gid_fut); p6.wait_for_selector('.hero-r h2', timeout=8000)
        p6.goto(URL + '#/'); p6.wait_for_timeout(800)
        sair(p6); p6.wait_for_timeout(1500)
        ok(p6.evaluate("!location.hash.startsWith('#/p/')") and p6.locator('#le').count() == 1, 'CT-KAN-171-02: organizador sai da conta no app instalado e vê o login, não o link do jogador')
        p6.goto(URL + '#/p/' + gid_fut); p6.wait_for_selector('.hero-r h2', timeout=8000)
        h3 = abrir_app6()
        ok(not h3.startswith('#/p/') and p6.locator('#le').count() == 1, f'CT-KAN-171-03: aparelho de organizador, só com o login anônimo do link: abrir o app mostra o login ({h3!r})')
        ctx6.close()

    if parte('b'):
        # ---------- v107 (KAN-124, KAN-66, KAN-249): agenda no link; assistências e Garçom; linha da partida
        ctx107 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', accept_downloads=True, timezone_id='America/Sao_Paulo')
        p107 = ctx107.new_page(); p107.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p107, 'criar')
        p107.fill('#le', 'v107@teste.com'); p107.fill('#lp', 'Jogo@2026'); p107.fill('#lp2', 'Jogo@2026'); p107.keyboard.press('Enter'); p107.wait_for_selector('#ngBox', timeout=12000)
        p107.fill('#ngn', 'Agenda FC'); p107.click('[data-a=pickSport][data-v=futebol]'); p107.click('[data-a=createGroup]')
        p107.wait_for_function("location.hash.startsWith('#/g/')"); p107.wait_for_timeout(1500)
        g107 = p107.url.split('#/g/')[1]
        p107.click('[data-a=tab][data-v=jogadores]'); p107.wait_for_timeout(300); p107.click('[data-a=seed]'); p107.wait_for_timeout(1500)
        js107 = p107.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false).sort()")
        baixados = []
        p107.on('download', lambda d: baixados.append(d))
        def ics107(seletor):
            with p107.expect_download(timeout=8000) as dl:
                p107.click(seletor)
            d = dl.value
            return d.suggested_filename, open(d.path(), encoding='utf-8', newline='').read()
        # KAN-124: o botão de agenda só aparece para quem confirmou, logo abaixo da própria linha
        p107.goto(URL + '#/p/' + g107); p107.wait_for_selector('.hero-r h2', timeout=8000); p107.wait_for_timeout(800)
        ok(p107.locator('#agendaLinha').count() == 0, 'CT-KAN-124-04: sem resposta, o botão de agenda não aparece')
        p107.click(f'[data-a=pubMark][data-v=in][data-p="{js107[0]}"]'); p107.wait_for_timeout(1200)
        AG = """(()=>{const li=document.getElementById('agendaLinha');if(!li)return null;const b=li.querySelector('[data-a=pubAgenda]'),r=b.getBoundingClientRect();
          return {antes:li.previousElementSibling&&li.previousElementSibling.classList.contains('me-row'),h:Math.round(r.height),rotulo:b.getAttribute('aria-label'),
          emoji:b.querySelector('[aria-hidden=true]')?.textContent,texto:b.textContent,ajuda:li.innerText,larg:document.documentElement.scrollWidth}})()"""
        for tema in ['light', 'dark']:
            p107.emulate_media(color_scheme=tema); p107.wait_for_timeout(150)
            a124 = p107.evaluate(AG)
            ok(a124 and a124['antes'] and a124['h'] >= 44 and a124['larg'] <= 360,
               f'CT-KAN-124-12: em 360px ({tema}), "Pôr na minha agenda" aparece logo abaixo da linha de quem confirmou, com 44px, sem rolagem lateral ({a124})')
            contraste(p107, f'botão de agenda no link ({tema})')
        p107.emulate_media(color_scheme='light')
        ok(a124 and a124['rotulo'] == 'Pôr o jogo na minha agenda' and a124['emoji'] == '📅' and 'não muda sozinha' in a124['ajuda'],
           f'CT-KAN-124-13: o leitor de tela ouve "Pôr o jogo na minha agenda", sem o emoji; a ajuda avisa que a agenda não muda sozinha ({a124 and a124["rotulo"]!r})')
        p107.evaluate('scrollTo(0,0)'); p107.screenshot(path=f'{OUT}/107-agenda-360.png', full_page=True)
        # grupo com dia fixo: "Só esta rodada" ou "Toda semana"
        p107.click('[data-a=pubAgenda]'); p107.wait_for_selector('#agOpcoes', timeout=8000); p107.wait_for_timeout(200)
        op124 = p107.evaluate("[...document.querySelectorAll('#agOpcoes button')].map(b=>b.textContent)")
        foco124 = p107.evaluate("document.activeElement&&document.activeElement.dataset.v")
        ok(len(op124) == 2 and op124[0].startswith('Só esta rodada (') and re.match(r'Toda semana \(\w+s?, \d', op124[1]) and foco124 == 'uma',
           f'CT-KAN-124-02: a janela oferece "Só esta rodada" e "Toda semana", com o foco na primeira ({op124}, {foco124})')
        p107.keyboard.press('Escape'); p107.wait_for_timeout(400)
        ok(not p107.evaluate("document.getElementById('dlg').open") and not baixados, 'CT-KAN-124-03: Esc fecha a janela sem gerar nada')
        p107.click('[data-a=pubAgenda]'); p107.wait_for_selector('#agOpcoes', timeout=8000)
        p107.click('#dlg [data-a=close]'); p107.wait_for_timeout(300)
        ok(not baixados, 'CT-KAN-124-03: Cancelar também não gera nada')
        p107.click('[data-a=pubAgenda]'); p107.wait_for_selector('#agOpcoes', timeout=8000)
        n124, t124 = ics107('#agOpcoes [data-v=semana]')
        L124 = t124.replace('\r\n ', '').split('\r\n')
        ok(n124.endswith('-semanal.ics') and any(l.startswith('RRULE:FREQ=WEEKLY;BYDAY=') for l in L124) and ('URL:' + URL.split('#')[0] + '#/p/' + g107) in L124,
           f'CT-KAN-124-02: "Toda semana" gera o evento repetido, com o link permanente do grupo ({n124}, {[l for l in L124 if l.startswith(("RRULE","URL"))]})')
        p107.click('[data-a=pubAgenda]'); p107.wait_for_selector('#agOpcoes', timeout=8000)
        n124b, t124b = ics107('#agOpcoes [data-v=uma]')
        L124b = t124b.replace('\r\n ', '').split('\r\n')
        ok('SUMMARY:Futebol — Agenda FC' in L124b and 'TRIGGER:-PT3H' in L124b and any(l.startswith('DTSTART;TZID=America/Sao_Paulo:') for l in L124b)
           and any(l.startswith('DTEND;TZID=') for l in L124b) and any('/r/' in l for l in L124b if l.startswith('URL:')) and not any(l.startswith('RRULE') for l in L124b)
           and any(l.startswith('DESCRIPTION:Mudou de ideia? Responda aqui: ') for l in L124b),
           f'CT-KAN-124-01: "Só esta rodada" gera o evento com título, início, término, alarme de 3 horas e o link da rodada ({[l for l in L124b if l[:4] in ("SUMM","DTST","URL:","TRIG")]})')
        ok(p107.inner_text('#toast').startswith('Pronto: abra o arquivo'), 'CT-KAN-124-01: depois de gerar, o aviso diz para abrir o arquivo')
        m124 = re.search(r'nota|mensalista|diarista|pix|R\$', re.sub(r'[a-z0-9]{12,}', '', t124b.replace(g107, '')), re.I)  # sem os identificadores, que são letras sorteadas
        ok(not m124 and t124b.count('@') == 1, f'CT-KAN-124-08: o arquivo não leva nota, tipo, valores nem contatos ({m124 and t124b[max(0,m124.start()-40):m124.end()+10]!r}, {t124b.count("@")})')
        # Não vou: o botão some na hora
        p107.click(f'[data-a=pubMark][data-v=out][data-p="{js107[0]}"]'); p107.wait_for_timeout(1000)
        ok(p107.locator('#agendaLinha').count() == 0, 'CT-KAN-124-04: quem marca "Não vou" depois de confirmar perde o botão na hora')
        p107.click(f'[data-a=pubMark][data-v=in][data-p="{js107[0]}"]'); p107.wait_for_timeout(1000)
        p107.reload(); p107.wait_for_selector('.hero-r h2', timeout=8000); p107.wait_for_timeout(1000)
        ok(p107.locator('#agendaLinha').count() == 1 and p107.evaluate(LER, f'grupos/{g107}/rodadas/' + p107.evaluate("S.route.id") + f'/presencas/{js107[0]}')['s'] == 'in',
           'CT-KAN-124-14: depois de recarregar, o botão continua e a presença não mudou')
        # KAN-266 (v112): dois toques rápidos geram um arquivo só. Rodada sem dia fixo baixa direto, sem janela: aqui a
        # rodada vira "sem dia fixo" só na memória da página, para o botão seguir esse caminho.
        # (a rodada do dia fixo ainda não tem documento: cria um na memória, igual, mas sem a marca de dia fixo)
        p107.evaluate("(()=>{const id=S.route.id,m=/^f-(\\d{4}-\\d{2}-\\d{2})-(\\d{2})(\\d{2})$/.exec(id)||[];S.rod[id]=Object.assign({date:m[1],time:m[2]?m[2]+':'+m[3]:''},S.rod[id]||{},{fixo:false})})()")
        antes266 = len(baixados)
        p107.locator('[data-a=pubAgenda]').click(); p107.wait_for_timeout(120); p107.locator('[data-a=pubAgenda]').click(force=True)
        p107.wait_for_timeout(2500)
        ok(len(baixados) - antes266 == 1, f'CT-KAN-266-01 (CT-KAN-124-14): dois toques rápidos em "Pôr na minha agenda" geram um arquivo só ({len(baixados) - antes266})')
        p107.locator('[data-a=pubAgenda]').click(); p107.wait_for_timeout(1500)
        ok(len(baixados) - antes266 == 2, f'CT-KAN-266-02: depois do carregando, um novo toque volta a gerar o arquivo ({len(baixados) - antes266})')
        # Em inglês, a agenda (o link segue o idioma escolhido no aparelho)
        p107.evaluate("localStorage.setItem('nj-idioma','en')"); p107.reload(); p107.wait_for_selector('#agendaLinha', timeout=8000); p107.wait_for_timeout(500)
        en124 = [p107.inner_text('[data-a=pubAgenda]'), p107.get_attribute('[data-a=pubAgenda]', 'aria-label')]
        p107.click('[data-a=pubAgenda]'); p107.wait_for_selector('#agOpcoes', timeout=8000); en124.append(p107.inner_text('#agOpcoes'))
        p107.keyboard.press('Escape'); p107.wait_for_timeout(200)
        falta124 = p107.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(agenda|publico|partida)\\./.test(k))")
        ok('Add to my calendar' in en124[0] and en124[1] == 'Add the game to my calendar' and 'Just this game (' in en124[2] and 'Every week (Mondays' in en124[2] and not falta124,
           f'CT-KAN-124-10: em English, o botão, o rótulo e a janela da agenda vêm traduzidos ({en124}, {falta124})')
        p107.evaluate("localStorage.setItem('nj-idioma','pt-BR')"); p107.reload(); p107.wait_for_timeout(800)
        # KAN-66: assistência na Partida
        p107.goto(URL + '#/g/' + g107); p107.wait_for_timeout(1500)
        p107.click('[data-a=tab][data-v=rodada]'); p107.wait_for_timeout(500)
        for x in js107[1:10]:
            p107.click(f'#presLista [data-a=mark][data-v=in][data-p="{x}"]'); p107.wait_for_timeout(200)
        sortear(p107)
        ok(p107.locator('[data-a=pubAgenda]').count() == 0, 'CT-KAN-124-17: a gestão não tem o botão de agenda')
        p107.click('[data-a=tab][data-v=partida]'); p107.wait_for_selector('[data-a=goal][data-v=a]', timeout=8000)
        p107.locator('[data-a=goal][data-v=a]').first.click(); p107.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
        autor66 = p107.eval_on_selector('#dlg [data-a=addGoal][data-p]:not([data-og])', 'b=>b.dataset.p')
        p107.click(f'#dlg [data-a=addGoal][data-p="{autor66}"]:not([data-og])'); p107.wait_for_selector('#astOpcoes', timeout=5000); p107.wait_for_timeout(200)
        A66 = p107.evaluate("""(()=>{const bs=[...document.querySelectorAll('#astOpcoes button')];return {primeiro:!bs[0].dataset.p&&bs[0].textContent,foco:document.activeElement===bs[0],
          ps:bs.slice(1).map(b=>b.dataset.p),alt:Math.min(...bs.map(b=>b.getBoundingClientRect().height)),titulo:document.getElementById('astTitulo').textContent,
          live:document.getElementById('astTitulo').getAttribute('aria-live'),placar:document.querySelector('.sc').textContent}})()""")
        meus66 = p107.evaluate("S.rod[S.rid].times[S.live.a].players")
        ok(A66['primeiro'] == 'Sem assistência' and A66['foco'] and A66['ps'] and autor66 not in A66['ps'] and all(x in meus66 for x in A66['ps']) and A66['alt'] >= 44,
           f'CT-KAN-66-01: depois do autor, "Assistência de…" com "Sem assistência" focado primeiro e só os colegas do time, com 44px ({A66})')
        ok(A66['titulo'] == 'Assistência de…' and A66['live'] == 'polite' and A66['placar'] == '1', 'CT-KAN-66-17: o título é anunciado e o gol já está no placar')
        as66 = A66['ps'][0]
        p107.click(f'#astOpcoes [data-p="{as66}"]'); p107.wait_for_timeout(400)
        nome = lambda i: p107.evaluate("id=>S.jog[id].name", i)
        g66 = p107.inner_text('.goals')
        ok(not p107.evaluate("document.getElementById('dlg').open") and f'{nome(autor66)} ({nome(as66)})' in g66 and p107.inner_text('.sc') == '1',
           f'CT-KAN-66-02: tocar num colega fecha a janela e o gol aparece como "Autor (Colega)", somando 1 ({g66!r})')
        # Esc e "Sem assistência": o gol fica contado, sem assistência
        p107.locator('[data-a=goal][data-v=a]').first.click(); p107.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
        p107.click(f'#dlg [data-a=addGoal][data-p="{autor66}"]:not([data-og])'); p107.wait_for_selector('#astOpcoes', timeout=5000)
        p107.keyboard.press('Escape'); p107.wait_for_timeout(400)
        p107.locator('[data-a=goal][data-v=a]').first.click(); p107.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
        p107.click(f'#dlg [data-a=addGoal][data-p="{autor66}"]:not([data-og])'); p107.wait_for_selector('#astOpcoes', timeout=5000)
        p107.dblclick('#astOpcoes [data-a=addAssist]:not([data-p])'); p107.wait_for_timeout(400)
        gs66 = p107.evaluate("S.live.goals.map(g=>[g.pid,g.as||null])")
        ok(p107.inner_text('.sc') == '3' and gs66[1:] == [[autor66, None], [autor66, None]], f'CT-KAN-66-03: Esc e "Sem assistência" (dois toques) contam o gol uma vez, sem assistência ({gs66})')
        # gol contra: fecha direto
        p107.locator('[data-a=goal][data-v=a]').first.click(); p107.wait_for_selector('[data-a=addGoal][data-og]', timeout=5000)
        p107.locator('#dlg [data-a=addGoal][data-og]').first.click(); p107.wait_for_timeout(400)
        ok(not p107.evaluate("document.getElementById('dlg').open") and p107.locator('#astOpcoes').count() == 0, 'CT-KAN-66-04: gol contra fecha a janela direto, sem o passo da assistência')
        p107.click('[data-a=saveMatch]'); p107.wait_for_timeout(800)
        t249 = p107.inner_text('#toast')
        ok(t249.startswith('Partida salva: Time') and 'Time 1' in t249 and 'Time 2' in t249, f'CT-KAN-249-04: o aviso diz "Partida salva: Time 1 4 × 0 Time 2" sem quebrar o nome do time ({t249!r})')
        # KAN-249: linha da partida em 360px
        LP = """(()=>{const li=document.querySelector('#partidasSalvas li.linha-partida');if(!li)return null;const c=li.querySelector('.confronto'),
          linhas=new Set([...c.children].map(x=>{const r=x.getBoundingClientRect();return Math.round((r.top+r.bottom)/20)})).size;
          return {linhas,nw:[...c.querySelectorAll('.nw')].map(x=>x.getClientRects().length),placar:c.querySelector('.placar-p').textContent,
          apoio:li.querySelector('.lp-apoio').textContent,larg:document.documentElement.scrollWidth}})()"""
        for tema in ['light', 'dark']:
            p107.emulate_media(color_scheme=tema); p107.wait_for_timeout(150)
            l249 = p107.evaluate(LP)
            ok(l249 and l249['linhas'] == 1 and l249['nw'] == [1, 1] and l249['placar'] == '4 × 0' and l249['larg'] <= 360,
               f'CT-KAN-249-01: em 360px ({tema}), o confronto cabe numa linha, com o placar em pílula e os nomes inteiros ({l249})')
            contraste(p107, f'linha da partida ({tema})')
        p107.emulate_media(color_scheme='light')
        ok(l249 and l249['apoio'].startswith('Jogo 1 · gols: ') and f'{nome(autor66)} ({nome(as66)})' in l249['apoio'],
           f'CT-KAN-249-02: embaixo, "Jogo 1 · gols: Autor (Colega), …" ({l249 and l249["apoio"]!r})')
        p107.screenshot(path=f'{OUT}/107-partida-360.png', full_page=True)
        # Ranking: coluna e Garçom
        p107.click('[data-a=tab][data-v=ranking]'); p107.wait_for_timeout(1500);  p107.wait_for_selector('#rankRaiz table', timeout=8000); p107.wait_for_timeout(500)
        r66 = p107.evaluate("""(()=>{const ab=document.querySelector('#rankRaiz th abbr');return {ab:ab&&[ab.textContent,ab.getAttribute('aria-label')],
          garcom:(document.getElementById('rankGarcom')||{}).textContent||'',larg:document.documentElement.scrollWidth}})()""")
        ok(r66['ab'] == ['Assist.', 'Assistências'] and f'Garçom: {nome(as66)} (1)' in r66['garcom'] and r66['larg'] <= 360,
           f'CT-KAN-66-08: o ranking ganha a coluna "Assist." (o leitor diz "Assistências") e o Garçom, sem rolagem lateral da página ({r66})')
        for tema in ['light', 'dark']:
            p107.emulate_media(color_scheme=tema); p107.wait_for_timeout(150); contraste(p107, f'ranking com assistências ({tema})')
        p107.emulate_media(color_scheme='light')
        # Editar partida: trocar a assistência; o autor não pode ser a própria assistência
        p107.click('[data-a=tab][data-v=partida]'); p107.wait_for_selector('[data-a=editarPartida]', timeout=8000)
        p107.click('[data-a=editarPartida]'); p107.wait_for_selector('#dlg .ed-assist', timeout=5000)
        n_ed = p107.locator('#dlg .ed-assist').count()
        outro66 = [x for x in A66['ps'] if x != as66][0]
        p107.locator('#dlg .ed-assist').first.select_option(outro66); p107.wait_for_timeout(150)
        p107.locator('#dlg .ed-autor').nth(1).select_option('p:' + autor66)
        p107.locator('#dlg .ed-assist').nth(1).select_option(outro66); p107.wait_for_timeout(100)
        p107.locator('#dlg .ed-autor').nth(1).select_option('p:' + outro66); p107.wait_for_timeout(150)
        v66 = p107.evaluate("[...document.querySelectorAll('#dlg .ed-assist')].map(s=>s.value)")
        ok(n_ed == 3 and v66[0] == outro66 and v66[1] == '', f'CT-KAN-66-10: no Editar, cada gol tem a assistência; quando o autor vira a própria assistência, ela é limpa ({n_ed}, {v66})')
        p107.click('#dlg [data-a=salvarEdicao]'); p107.wait_for_timeout(900)
        p107.click('[data-a=tab][data-v=ranking]'); p107.wait_for_timeout(800)
        gc66 = p107.inner_text('#rankGarcom') if p107.locator('#rankGarcom').count() else ''
        ok(f'Garçom: {nome(outro66)} (1)' in gc66 and nome(as66) not in gc66, f'CT-KAN-66-09: trocar a assistência no Editar muda o ranking na hora ({gc66!r})')
        p107.reload(); p107.wait_for_timeout(1500); p107.click('[data-a=tab][data-v=ranking]'); p107.wait_for_timeout(1200)
        gc66b = p107.inner_text('#rankGarcom') if p107.locator('#rankGarcom').count() else ''
        ok(gc66b == gc66, f'CT-KAN-66-09: e continua igual depois de recarregar ({gc66b!r})')
        # Link: as partidas no mesmo formato, com a assistência
        p107.goto(URL + '#/p/' + g107); p107.wait_for_selector('#pubPartidas', timeout=8000); p107.wait_for_timeout(300)
        p107.screenshot(path=f'{OUT}/107-link-partidas-360.png', full_page=True)
        lk249 = p107.evaluate("(()=>{const li=document.querySelector('#pubPartidas li');const c=li.querySelector('.confronto');return {linhas:new Set([...c.children].map(x=>{const r=x.getBoundingClientRect();return Math.round((r.top+r.bottom)/20)})).size,apoio:li.querySelector('.lp-apoio').textContent,larg:document.documentElement.scrollWidth}})()")
        ok(lk249['linhas'] == 1 and lk249['apoio'].startswith('Jogo 1 · gols: ') and f'({nome(outro66)})' in lk249['apoio'] and lk249['larg'] <= 360,
           f'CT-KAN-249-05: no link do jogador, a mesma linha da partida, com a assistência, sem rolagem lateral ({lk249})')
        # Esportes: vôlei sem assistência; basquete com assistência em cada cesta
        p107.goto(URL + '#/g/' + g107); p107.wait_for_timeout(1500)
        p107.evaluate("S.app.sport='volei'"); p107.click('[data-a=tab][data-v=partida]'); p107.wait_for_timeout(500)
        p107.locator('[data-a=goal][data-v=a]').first.click(); p107.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
        p107.locator('#dlg [data-a=addGoal][data-p]').first.click(); p107.wait_for_timeout(400)
        sem_volei = p107.locator('#astOpcoes').count() == 0 and not p107.evaluate("document.getElementById('dlg').open")
        p107.click('[data-a=undoGoal]'); p107.wait_for_timeout(200)
        p107.click('[data-a=tab][data-v=ranking]'); p107.wait_for_timeout(600)
        ok(sem_volei and p107.locator('#rankRaiz th abbr').count() == 0 and p107.locator('#rankGarcom').count() == 0,
           'CT-KAN-66-06: no vôlei, nada de assistência: nem o passo, nem a coluna, nem o Garçom')
        p107.evaluate("S.app.sport='basquete'"); p107.click('[data-a=tab][data-v=partida]'); p107.wait_for_timeout(500)
        p107.locator('[data-a=goal][data-v=a]').nth(1).click(); p107.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
        p107.locator('#dlg [data-a=addGoal][data-p]:not([data-og])').first.click(); p107.wait_for_timeout(300)
        tem_bq = p107.locator('#astOpcoes').count() == 1
        if tem_bq: p107.locator('#astOpcoes [data-p]').first.click(); p107.wait_for_timeout(300)
        bq = p107.evaluate("S.live.goals.slice(-1).map(g=>[g.pts,!!g.as])")
        ok(tem_bq and bq == [[2, True]], f'CT-KAN-66-07: no basquete, a cesta de +2 também aceita assistência ({bq})')
        p107.click('[data-a=undoGoal]'); p107.evaluate("S.app.sport='futebol'")
        # Em inglês
        p107.evaluate("localStorage.setItem('nj-idioma','en')"); p107.reload(); p107.wait_for_timeout(1800)
        p107.click('[data-a=tab][data-v=partida]'); p107.wait_for_selector('[data-a=goal][data-v=a]', timeout=8000)
        p107.locator('[data-a=goal][data-v=a]').first.click(); p107.wait_for_selector('[data-a=addGoal][data-p]', timeout=5000)
        p107.click(f'#dlg [data-a=addGoal][data-p="{autor66}"]:not([data-og])'); p107.wait_for_selector('#astOpcoes', timeout=5000)
        en66 = [p107.inner_text('#astTitulo'), p107.inner_text('#astOpcoes button')]
        p107.keyboard.press('Escape'); p107.wait_for_timeout(300); p107.click('[data-a=undoGoal]')
        p107.click('[data-a=tab][data-v=ranking]'); p107.wait_for_timeout(800)
        en66.append(p107.inner_text('#rankRaiz th abbr') if p107.locator('#rankRaiz th abbr').count() else '')
        falta107 = p107.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(partida|rank|agenda|cat)\\./.test(k))")
        ok(en66 == ['Assist by…', 'No assist', 'Ast.'] and not falta107, f'CT-KAN-66-18: em English, a assistência e a coluna vêm traduzidas ({en66}, {falta107})')
        # Com os times sorteados, a lista fecha: o link não oferece a agenda
        p107.goto(URL + '#/p/' + g107); p107.wait_for_selector('.hero-r h2', timeout=8000); p107.wait_for_timeout(800)
        ok(p107.locator('#agendaLinha').count() == 0, 'CT-KAN-124-05: com a lista fechada, o botão de agenda não aparece')
        ctx107.close()

        # ---------- v108 (KAN-252): todo combo com 44px (aba Partida, seletor de rodada, dias fixos)
        ctx108 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p108 = ctx108.new_page(); p108.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p108, 'criar')
        p108.fill('#le', 'v108@teste.com'); p108.fill('#lp', 'Jogo@2026'); p108.fill('#lp2', 'Jogo@2026'); p108.keyboard.press('Enter'); p108.wait_for_selector('#ngBox', timeout=12000)
        ALT = "(sel)=>[...document.querySelectorAll(sel)].filter(e=>e.offsetParent).map(e=>Math.round(e.getBoundingClientRect().height))"
        dias252 = p108.evaluate(ALT, '#ngBox .srow select.sel')
        p108.fill('#ngn', 'Combos FC'); p108.click('[data-a=pickSport][data-v=futebol]'); p108.click('[data-a=createGroup]')
        p108.wait_for_function("location.hash.startsWith('#/g/')"); p108.wait_for_timeout(1500)
        p108.click('[data-a=tab][data-v=jogadores]'); p108.wait_for_timeout(300); p108.click('[data-a=seed]'); p108.wait_for_timeout(1500)
        js108 = p108.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false).sort()")
        p108.click('[data-a=tab][data-v=rodada]'); p108.wait_for_timeout(500)
        for x in js108[:10]:
            p108.click(f'#presLista [data-a=mark][data-v=in][data-p="{x}"]'); p108.wait_for_timeout(200)
        sortear(p108)
        for lg, alt in [(360, 740), (390, 844)]:
            p108.set_viewport_size({'width': lg, 'height': alt}); p108.wait_for_timeout(200)
            for tema in ['light', 'dark']:
                p108.emulate_media(color_scheme=tema); p108.wait_for_timeout(100)
                p108.click('[data-a=tab][data-v=rodada]'); p108.wait_for_timeout(400)
                rod252 = p108.evaluate(ALT, 'select.sel[data-c=rid]')
                p108.click('[data-a=tab][data-v=partida]'); p108.wait_for_selector('select.sel[data-c=ta]', timeout=8000); p108.wait_for_timeout(300)
                par252 = p108.evaluate(ALT, 'select.sel[data-c=ta],select.sel[data-c=tb],select.sel[data-c=dur],select.sel[data-c=lim]')
                lin252 = p108.evaluate("new Set(['ta','tb','dur','lim'].map(c=>Math.round(document.querySelector(`select.sel[data-c=${c}]`).getBoundingClientRect().top))).size")
                larg252 = p108.evaluate("document.documentElement.scrollWidth")
                ok(rod252 and all(h >= 44 for h in rod252) and len(par252) == 4 and all(h >= 44 for h in par252),
                   f'CT-KAN-252-03: em {lg}px ({tema}), os combos da aba Partida e o seletor de rodada têm 44px ({par252}, {rod252})')
                ok(lin252 == 2 and larg252 <= lg, f'CT-KAN-252-05: em {lg}px ({tema}), os quatro combos da Partida ficam em duas linhas, sem rolagem lateral ({lin252}, {larg252}px)')
        p108.emulate_media(color_scheme='light')
        ok(dias252 and all(h >= 44 for h in dias252), f'CT-KAN-252-03: o dia da semana dos dias fixos tem 44px ({dias252})')
        p108.screenshot(path=f'{OUT}/108-partida-combos.png')
        ctx108.close()

        # ---------- v109 (KAN-246, KAN-190 parte 2): hora e número do sorteio; material do grupo
        ctx109 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p109 = ctx109.new_page(); p109.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p109, 'criar')
        p109.fill('#le', 'v109@teste.com'); p109.fill('#lp', 'Jogo@2026'); p109.fill('#lp2', 'Jogo@2026'); p109.keyboard.press('Enter'); p109.wait_for_selector('#ngBox', timeout=12000)
        p109.fill('#ngn', 'Bolas FC'); p109.click('[data-a=pickSport][data-v=futebol]'); p109.click('[data-a=createGroup]')
        p109.wait_for_function("location.hash.startsWith('#/g/')"); p109.wait_for_timeout(1500)
        g109 = p109.url.split('#/g/')[1]
        p109.click('[data-a=tab][data-v=jogadores]'); p109.wait_for_timeout(300); p109.click('[data-a=seed]'); p109.wait_for_timeout(1500)
        js109 = p109.evaluate("Object.keys(S.jog).filter(id=>S.jog[id].ativo!==false).sort()")
        nm = lambda i: p109.evaluate("id=>S.jog[id].name", i)
        kl, dg, gu, rf = js109[0], js109[1], js109[2], js109[3]
        # KAN-190: cadastrar 3 bolas, uma com cada pessoa (o caso real)
        p109.click('[data-a=tab][data-v=grupo]'); p109.wait_for_selector('#materialPainel', timeout=8000)
        for pid in [kl, dg, gu]:
            p109.fill('#matNome', 'Bola'); p109.fill('#matQtd', '1'); p109.select_option('#matCom', pid)
            p109.click('#matAddBtn'); p109.wait_for_timeout(400)
        m190 = p109.evaluate("(S.app.cfg.mat||[]).map(x=>[x.nome,x.com])")
        ok(m190 == [['Bola', kl], ['Bola', dg], ['Bola', gu]] and p109.locator('#matLista li').count() == 3,
           f'CT-KAN-190-11: na aba Grupo, o material do grupo guarda 3 bolas, cada uma com uma pessoa ({m190})')
        sug190 = p109.evaluate("[...document.querySelectorAll('#matSug [data-a=matSug]')].map(o=>o.dataset.v)")
        ok(sug190 == ['Bola', 'Coletes', 'Luvas', 'Cronômetro', 'Kit de primeiros socorros'],
           f'CT-KAN-190-11 e CT-KAN-267-02: no futebol, os atalhos vêm do catálogo do esporte, com luvas, cronômetro e primeiros socorros ({sug190})')
        # KAN-267 (v111): "O que é" é campo livre (sem lista ligada), os atalhos preenchem e levam o cursor para "Quantos"
        c267 = p109.evaluate("(()=>{const i=document.getElementById('matNome');return [i.tagName, i.type, i.getAttribute('list'), !!document.querySelector('datalist')]})()")
        ok(c267 == ['INPUT', 'text', None, False], f'CT-KAN-267-01: "O que é" é um campo de texto livre, sem lista ligada nem setinha ({c267})')
        p109.click('#matSug [data-a=matSug][data-v="Cronômetro"]'); p109.wait_for_timeout(200)
        f267 = p109.evaluate("[document.getElementById('matNome').value, document.activeElement && document.activeElement.id]")
        ok(f267 == ['Cronômetro', 'matQtd'], f'CT-KAN-267-03: tocar no atalho preenche o campo e leva o cursor para "Quantos" ({f267})')
        g267 = p109.evaluate("(()=>{const bs=[...document.querySelectorAll('#matSug .btn')],pn=document.getElementById('materialPainel').getBoundingClientRect();return {alt:Math.min(...bs.map(b=>Math.round(b.getBoundingClientRect().height))), dentro:bs.every(b=>{const r=b.getBoundingClientRect();return r.left>=pn.left&&r.right<=pn.right+0.5}), linhas:new Set(bs.map(b=>Math.round(b.getBoundingClientRect().top))).size, rolagem:document.documentElement.scrollWidth>innerWidth}})()")
        ok(g267['alt'] >= 44 and g267['dentro'] and g267['linhas'] >= 2 and not g267['rolagem'], f'CT-KAN-267-03: em 360px, os atalhos têm 44px e quebram linha dentro do painel, sem rolagem lateral ({g267})')
        p109.locator('#materialPainel .mat-novo').screenshot(path=f'{OUT}/111-material-atalhos-360.png')
        p109.fill('#matNome', '')
        p109.screenshot(path=f'{OUT}/109-material-grupo-360.png', full_page=True)
        # aba Rodada: ninguém que guarda confirmou
        p109.click('[data-a=tab][data-v=rodada]'); p109.wait_for_selector('#matRodada', timeout=8000); p109.wait_for_timeout(300)
        t190 = p109.inner_text('#matRodada')
        ok('ninguém que guarda confirmou ainda' in t190 and all(nm(x) in t190 for x in [kl, dg, gu]) and p109.locator('#matRodada [data-a=matCobrar]').count() == 1,
           f'CT-KAN-190-08: sem ninguém confirmado, a aba Rodada avisa "ninguém que guarda confirmou", com os 3 nomes e o botão de cobrar ({t190!r})')
        # KAN-264 (v110): com o aviso em 2 linhas, a caixa é um retângulo só e o botão fica embaixo, dentro do painel
        for larg in [360, 390]:
            p109.set_viewport_size({'width': larg, 'height': 740}); p109.wait_for_timeout(200)
            g264 = p109.evaluate('''(()=>{const w=document.querySelector('#matRodada .warn-alt'),b=document.querySelector('#matRodada [data-a=matCobrar]'),
              pn=document.querySelector('#matRodada').getBoundingClientRect(),rw=w.getBoundingClientRect(),rb=b.getBoundingClientRect();
              return {partes:w.getClientRects().length, alt:Math.round(rw.height), dentro:rw.left>=pn.left&&rw.right<=pn.right+0.5,
                botaoAbaixo:rb.top>=rw.bottom-0.5, botaoDentro:rb.left>=pn.left&&rb.right<=pn.right+0.5, botaoAlt:Math.round(rb.height),
                rolagem:document.documentElement.scrollWidth>innerWidth}})()''')
            ok(g264['partes'] == 1 and g264['alt'] > 40 and g264['dentro'] and not g264['rolagem'],
               f'CT-KAN-264-01: em {larg}px, o aviso em 2 linhas é uma caixa só, dentro do painel ({g264})')
            ok(g264['botaoAbaixo'] and g264['botaoDentro'] and g264['botaoAlt'] >= 44,
               f'CT-KAN-264-02: em {larg}px, "Cobrar no WhatsApp" fica abaixo do aviso, dentro do painel, com 44px ({g264})')
        p109.set_viewport_size({'width': 360, 'height': 740}); p109.wait_for_timeout(200)
        p109.locator('#matRodada').screenshot(path=f'{OUT}/110-material-rodada-360.png')
        p109.click('#matRodada [data-a=matCobrar]'); p109.wait_for_selector('#shtxt', timeout=5000)
        z190 = p109.input_value('#shtxt')
        ok(all(nm(x) in z190 for x in [kl, dg, gu]) and 'Bola' in z190 and '#/p/' in z190, f'CT-KAN-190-08: a cobrança no WhatsApp leva os 3 nomes, a bola e o link ({z190[:120]!r})')
        p109.click('#dlg [data-a=close]'); p109.wait_for_timeout(300)
        p109.click(f'#presLista [data-a=mark][data-v=in][data-p="{gu}"]'); p109.wait_for_timeout(500)
        t190b = p109.inner_text('#matRodada')
        ok(f'Bola: 1 de 3 confirmados ({nm(gu)})' in t190b and 'ninguém que guarda' not in t190b, f'CT-KAN-190-08: uma das 3 pessoas confirma e vira "Bola: 1 de 3 confirmados (nome)" ({t190b!r})')
        p109.click(f'#presLista [data-a=mark][data-v=out][data-p="{dg}"]'); p109.wait_for_timeout(500)
        t190c = p109.inner_text('#matRodada')
        ok(f'{nm(dg)} não vai e está com: Bola' in t190c, f'CT-KAN-190-09: quem guarda e não vai aparece separado ({t190c!r})')
        for tema in ['light', 'dark']:
            p109.emulate_media(color_scheme=tema); p109.wait_for_timeout(150); contraste(p109, f'material desta rodada ({tema})')
        p109.emulate_media(color_scheme='light')
        # link: lembrete para quem guarda
        p109.goto(URL + '#/p/' + g109); p109.wait_for_selector('.hero-r h2', timeout=8000); p109.wait_for_timeout(600)
        p109.click(f'[data-a=pubMark][data-v=out][data-p="{dg}"]'); p109.wait_for_timeout(900)
        l190 = p109.inner_text('#matLembrete') if p109.locator('#matLembrete').count() else ''
        ok('Você está com Bola do grupo: combine com alguém para levar.' in l190, f'CT-KAN-190-09: no link, quem guarda e diz "Não vou" vê o lembrete para combinar ({l190!r})')
        p109.click(f'[data-a=pubMark][data-v=in][data-p="{dg}"]'); p109.wait_for_timeout(900)
        l190b = p109.inner_text('#matLembrete') if p109.locator('#matLembrete').count() else ''
        ok('Você está com Bola do grupo: leve para o jogo.' in l190b, f'CT-KAN-190-09: ao confirmar, o lembrete diz para levar ({l190b!r})')
        p109.click(f'[data-a=pubMark][data-v=out][data-p="{dg}"]'); p109.wait_for_timeout(600)
        # passar a bola do Gu para o Rafa
        p109.goto(URL + '#/g/' + g109); p109.wait_for_timeout(1500)
        p109.click('[data-a=tab][data-v=grupo]'); p109.wait_for_selector('#matLista', timeout=8000)
        idg = p109.evaluate("id=>(S.app.cfg.mat||[]).find(x=>x.com===id).id", gu)
        p109.select_option(f'#matLista select[data-m="{idg}"]', rf); p109.wait_for_timeout(600)
        p109.reload(); p109.wait_for_timeout(1500); p109.click('[data-a=tab][data-v=grupo]'); p109.wait_for_selector('#matLista', timeout=8000)
        h190 = p109.evaluate("(S.app.cfg.matHist||[])[0]||{}")
        ok(p109.evaluate("id=>(S.app.cfg.mat||[]).find(x=>x.id===id).com", idg) == rf and h190.get('de') == gu and h190.get('para') == rf,
           f'CT-KAN-190-10: passar uma bola para outra pessoa continua depois de recarregar, com o histórico ({h190})')
        p109.click('.mat-hist summary'); p109.wait_for_timeout(200)
        ok(f'Bola: {nm(gu)} → {nm(rf)}' in p109.inner_text('.mat-hist'), 'CT-KAN-190-10: o histórico mostra "Bola: de → para"')
        # KAN-246: sortear e ver a linha na aba Rodada, no link e no WhatsApp
        p109.click('[data-a=tab][data-v=rodada]'); p109.wait_for_timeout(500)
        for x in js109[4:14]:
            p109.click(f'#presLista [data-a=mark][data-v=in][data-p="{x}"]'); p109.wait_for_timeout(150)
        sortear(p109)
        RE246 = r'^Sorteado às \d{2}:\d{2} · 1º sorteio$'
        a246 = p109.inner_text('#sortInfoAdm') if p109.locator('#sortInfoAdm').count() else ''
        ok(re.match(RE246, a246), f'CT-KAN-246-01: na aba Rodada, o administrador vê "Sorteado às HH:MM · 1º sorteio" ({a246!r})')
        hora_esp = p109.evaluate("new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(S.rod[S.rid].sor.em))")
        ok(hora_esp in a246, f'CT-KAN-246-01: a hora é a do sorteio, no fuso do grupo ({hora_esp}, {a246!r})')
        sortear(p109); sortear(p109)
        a246b = p109.inner_text('#sortInfoAdm')
        ok('3º sorteio' in a246b and p109.evaluate("S.rod[S.rid].sor.aj") == 0, f'CT-KAN-246-02: sortear de novo duas vezes mostra "3º sorteio" ({a246b!r})')
        p109.locator('#rodadaTimes [data-a=move], .teams [data-a=move]').first.click(); p109.wait_for_selector('#dlg [data-a=doMove]', timeout=5000)
        p109.locator('#dlg [data-a=doMove]').first.click(); p109.wait_for_timeout(600)
        a246c = p109.inner_text('#sortInfoAdm')
        ok('3º sorteio · 1 ajuste manual depois do sorteio' in a246c, f'CT-KAN-246-03: mover um jogador conta "1 ajuste manual depois do sorteio", sem nomes ({a246c!r})')
        p109.click('[data-a=shareTimes]'); p109.wait_for_selector('#shtxt', timeout=5000)
        z246 = p109.input_value('#shtxt')
        ok('3º sorteio · 1 ajuste manual depois do sorteio' in z246, 'CT-KAN-246-01: a mensagem dos times no WhatsApp leva a linha do sorteio')
        p109.click('#dlg [data-a=close]'); p109.wait_for_timeout(200)
        p109.reload(); p109.wait_for_timeout(1500)
        s246 = p109.evaluate("(()=>{const r=S.rod[S.rid];return r&&r.sor})()")
        ok(s246 and s246.get('n') == 3 and s246.get('aj') == 1, f'CT-KAN-246-05: o número e os ajustes continuam depois de recarregar ({s246})')
        p109.goto(URL + '#/p/' + g109); p109.wait_for_selector('#sortInfo', timeout=8000); p109.wait_for_timeout(300)
        for tema in ['light', 'dark']:
            p109.emulate_media(color_scheme=tema); p109.wait_for_timeout(150)
            l246 = p109.evaluate("(()=>{const e=document.getElementById('sortInfo');return {t:e.textContent,larg:document.documentElement.scrollWidth,cor:getComputedStyle(e).color}})()")
            ok(l246['t'].startswith('Sorteado às ') and '3º sorteio' in l246['t'] and l246['larg'] <= 360,
               f'CT-KAN-246-01: no link em 360px ({tema}), a linha do sorteio aparece acima dos times, sem rolagem lateral ({l246})')
            contraste(p109, f'linha do sorteio no link ({tema})')
        p109.emulate_media(color_scheme='light')
        p109.screenshot(path=f'{OUT}/109-link-sorteio-360.png', full_page=True)
        # desligar a linha no grupo: some do link e do WhatsApp; a aba Rodada continua mostrando
        p109.goto(URL + '#/g/' + g109); p109.wait_for_timeout(1500)
        p109.click('[data-a=tab][data-v=grupo]'); p109.wait_for_timeout(500)
        p109.click('[data-a=editGroup]'); p109.wait_for_selector('#ngVerSorteio', timeout=8000)
        ok(p109.is_checked('#ngVerSorteio'), 'CT-KAN-246-04: a opção de mostrar o sorteio vem ligada')
        p109.uncheck('#ngVerSorteio'); p109.click('#dlg [data-a=saveGroup]'); p109.wait_for_timeout(900)
        p109.click('[data-a=tab][data-v=rodada]'); p109.wait_for_timeout(500)
        a246d = p109.inner_text('#sortInfoAdm') if p109.locator('#sortInfoAdm').count() else ''
        p109.click('[data-a=shareTimes]'); p109.wait_for_selector('#shtxt', timeout=5000)
        z246b = p109.input_value('#shtxt'); p109.click('#dlg [data-a=close]'); p109.wait_for_timeout(200)
        p109.goto(URL + '#/p/' + g109); p109.wait_for_selector('.hero-r h2', timeout=8000); p109.wait_for_timeout(600)
        ok('3º sorteio' in a246d and 'só você vê' in a246d and 'sorteio' not in z246b and p109.locator('#sortInfo').count() == 0,
           f'CT-KAN-246-04: desligada, a linha some do link e do WhatsApp; o administrador continua vendo ({a246d!r})')
        # em inglês
        p109.evaluate("localStorage.setItem('nj-idioma','en')"); p109.reload(); p109.wait_for_timeout(1500)
        p109.goto(URL + '#/g/' + g109); p109.wait_for_timeout(1800)
        p109.click('[data-a=tab][data-v=rodada]'); p109.wait_for_selector('#sortInfoAdm', timeout=8000); p109.wait_for_timeout(500)
        en109 = [p109.inner_text('#sortInfoAdm'), p109.inner_text('#matRodada')]
        falta109 = p109.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(sortinfo|mat|matg|matlink|rodg)\\./.test(k))")
        p109.click('[data-a=tab][data-v=grupo]'); p109.wait_for_selector('#matSug', timeout=8000); p109.wait_for_timeout(300)
        en267 = p109.evaluate("[...document.querySelectorAll('#matSug [data-a=matSug]')].map(o=>o.textContent)")
        ok(en267 == ['Ball', 'Bibs', 'Gloves', 'Stopwatch', 'First aid kit'], f'CT-KAN-267-04: em English, os atalhos vêm traduzidos ({en267})')
        p109.click('[data-a=tab][data-v=rodada]'); p109.wait_for_timeout(500)
        ok(re.search(r'Drawn at \d{1,2}:\d{2}', en109[0]) and 'draw #3' in en109[0] and "This game's gear" in en109[1] and not falta109,
           f'CT-KAN-246-08 e CT-KAN-190-11: em English, a linha do sorteio e o material vêm traduzidos ({en109}, {falta109})')
        ctx109.close()

        # ---------- v113 (KAN-244): colar a lista do WhatsApp na aba Rodada
        ctx113 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p113 = ctx113.new_page(); p113.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p113, 'criar')
        p113.fill('#le', 'v113@teste.com'); p113.fill('#lp', 'Jogo@2026'); p113.fill('#lp2', 'Jogo@2026'); p113.keyboard.press('Enter'); p113.wait_for_selector('#ngBox', timeout=12000)
        p113.fill('#ngn', 'Lista FC'); p113.click('[data-a=pickSport][data-v=futebol]'); p113.click('[data-a=createGroup]')
        p113.wait_for_function("location.hash.startsWith('#/g/')"); p113.wait_for_timeout(1500)
        g113 = p113.url.split('#/g/')[1]
        p113.click('[data-a=tab][data-v=jogadores]'); p113.wait_for_timeout(300); p113.click('[data-a=seed]'); p113.wait_for_timeout(1500)
        id113 = lambda n: p113.evaluate("n=>Object.keys(S.jog).find(k=>S.jog[k].name===n)||null", n)
        p113.click('[data-a=tab][data-v=rodada]'); p113.wait_for_timeout(600)
        h113 = p113.evaluate("(()=>{const h=document.querySelector('#presPainel > .row.between'),bs=[...h.querySelectorAll('.btn')],pn=document.getElementById('presPainel').getBoundingClientRect();return {bts:bs.map(b=>b.textContent.trim()),alt:bs.map(b=>Math.round(b.getBoundingClientRect().height)),dentro:bs.every(b=>b.getBoundingClientRect().right<=pn.right+0.5),rolagem:document.documentElement.scrollWidth>innerWidth}})()")
        ok(h113['bts'] == ['📋 Colar lista', 'Adicionar avulso'] and min(h113['alt']) >= 36 and h113['dentro'] and not h113['rolagem'],
           f'CT-KAN-244-10: em 360px, "Colar lista" e "Adicionar avulso" ficam no topo da Presença, dentro do painel ({h113})')
        p113.click('[data-a=colarLista]'); p113.wait_for_selector('#colarTexto', timeout=8000); p113.wait_for_timeout(300)
        ok(p113.evaluate("document.activeElement && document.activeElement.id") == 'colarTexto', 'CT-KAN-244-10: a janela abre com o cursor no campo da lista')
        p113.fill('#colarTexto', '1.\n2. 👍👍\n⚽⚽'); p113.click('#dlg [data-a=colarLer]'); p113.wait_for_timeout(500)
        ok(p113.locator('#colarTexto').count() == 1 and 'Não achei nomes nesse texto' in p113.inner_text('#toast') and not p113.evaluate("Object.values(S.pres||{}).length"),
           'CT-KAN-244-03: texto sem nomes avisa "Não achei nomes nesse texto" e não grava nada')
        LISTA113 = """Lista 16/11 das 20:00 as 22h - 👍🏻 ou ❌ - Responder até as 13:00

1 - Gui (M) 👍🏼
2 - Japa Silva (A) 🤙🏼
3 - fernandinho (M) ❌️
4 - Caio (M) 👍
5 - Matheus (Z) 👍🏻
6 - Neto (A)
7 - Gabriel (Avulso) 👍🏼
8 - Vini (A) ❌
9 - Léo (Z) 👍

1- Bruno (goleiro) 👍🏽
2- Tiago (goleiro) ❌"""
        p113.fill('#colarTexto', LISTA113); p113.click('#dlg [data-a=colarLer]'); p113.wait_for_selector('#colarVao', timeout=5000); p113.wait_for_timeout(300)
        pv113 = p113.evaluate("""(()=>{const L=s=>[...document.querySelectorAll(s+' li')].map(li=>{const sel=li.querySelector('select');return [li.querySelector('.colar-nome').firstChild.textContent.trim(), sel.value, (li.querySelector('.colar-nome .small')||{}).textContent||'']});
          return {vao:L('#colarVao'), nao:L('#colarNao'), sem:(document.getElementById('colarSem')||{}).textContent||'', resumo:document.getElementById('colarResumo').textContent}})()""")
        ok([x[0] for x in pv113['vao']] == ['Gui', 'Japa Silva', 'Caio', 'Matheus', 'Gabriel', 'Léo', 'Bruno'] and [x[0] for x in pv113['nao']] == ['fernandinho', 'Vini', 'Tiago']
           and pv113['sem'] == 'Sem marca, não muda: Neto' and pv113['resumo'] == '7 vão · 3 não vão · 1 sem marca',
           f'CT-KAN-244-01: a prévia separa quem vai (na ordem colada), quem não vai e quem está sem marca; o título é ignorado ({pv113})')
        vs113 = {x[0]: x for x in pv113['vao'] + pv113['nao']}
        ok(vs113['Gui'][1] == id113('Gui') and vs113['fernandinho'][1] == id113('Fernandinho') and vs113['Japa Silva'][1] == id113('Japa')
           and vs113['Japa Silva'][2] == 'Parecido com Japa?' and vs113['Matheus'][1:] == ['novo:avulso', 'Novo no grupo'] and vs113['Gabriel'][1] == 'novo:avulso',
           f'CT-KAN-244-02: cada nome vem casado com o elenco (sem acento e maiúscula), "Parecido com Japa?" e os novos como avulso ({vs113})')
        p113.click('#colarTodosElenco'); p113.wait_for_timeout(200)
        el113 = p113.evaluate("[...document.querySelectorAll('#dlg .colar-sel')].map(s=>[s.closest('li').querySelector('.colar-nome').firstChild.textContent.trim(), s.value]).filter(x=>x[0]==='Matheus'||x[0]==='Gabriel')")
        ok(el113 == [['Matheus', 'novo:elenco'], ['Gabriel', 'novo:avulso']], f'CT-KAN-244-02: "Pôr todos os novos no elenco" muda os novos, menos quem veio marcado "(avulso)" ({el113})')
        g113b = p113.evaluate("(()=>{const d=document.getElementById('dlg'),r=d.getBoundingClientRect();return {larg:Math.round(r.width),rolagem:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth,sel:Math.min(...[...d.querySelectorAll('.colar-sel')].map(s=>Math.round(s.getBoundingClientRect().height)))}})()")
        ok(not g113b['rolagem'] and g113b['sel'] >= 44, f'CT-KAN-244-10: em 360px, a prévia não tem rolagem lateral e os combos têm 44px ({g113b})')
        for tema in ['light', 'dark']:
            p113.emulate_media(color_scheme=tema); p113.wait_for_timeout(150); contraste(p113, f'prévia da lista colada ({tema})')
        p113.emulate_media(color_scheme='light')
        p113.screenshot(path=f'{OUT}/113-colar-previa-360.png')
        # Voltar guarda o texto
        p113.click('#dlg [data-a=colarVoltar]'); p113.wait_for_selector('#colarTexto', timeout=5000)
        ok(p113.input_value('#colarTexto') == LISTA113, 'CT-KAN-244-10: "Voltar" mostra de novo o texto colado')
        p113.click('#dlg [data-a=colarLer]'); p113.wait_for_selector('#colarVao', timeout=5000); p113.click('#colarTodosElenco'); p113.wait_for_timeout(200)
        p113.click('#dlg [data-a=colarGravar]'); p113.wait_for_timeout(1500)
        ok('Lista marcada: 7 vão e 3 não vão.' in p113.inner_text('#toast') and not p113.evaluate("document.getElementById('dlg').open"),
           'CT-KAN-244-01: "Marcar na rodada" fecha a janela e avisa "Lista marcada: 7 vão e 3 não vão."')
        p113.reload(); p113.wait_for_timeout(2000); p113.click('[data-a=tab][data-v=rodada]'); p113.wait_for_timeout(800)
        r113 = p113.evaluate("""(()=>{const P=S.pres,nm=id=>(S.jog[id]&&S.jog[id].name)||(P[id]&&P[id].nome)||(S.avul[id]||{}).nome;
          const vao=Object.keys(P).filter(k=>P[k].s==='in').sort((a,b)=>P[a].t-P[b].t).map(nm), nao=Object.keys(P).filter(k=>P[k].s==='out').map(nm).sort();
          const mat=Object.keys(S.jog).find(k=>S.jog[k].name==='Matheus'), gab=Object.keys(S.avul||{}).find(k=>S.avul[k].nome==='Gabriel');
          return {vao, nao, matheus: mat?[S.jog[mat].pos||'', ((S.pc||{}).tipos||{})[mat]||'']:null, gabriel: gab?[!!P[gab]&&P[gab].avulso, !S.jog[gab]]:null, neto: P[Object.keys(S.jog).find(k=>S.jog[k].name==='Neto')]||null}})()""")
        ok(r113['vao'] == ['Gui', 'Japa', 'Caio', 'Matheus', 'Gabriel', 'Léo', 'Bruno'] and r113['nao'] == ['Fernandinho', 'Tiago', 'Vini'] and r113['neto'] is None,
           f'CT-KAN-244-01: depois de recarregar, 7 confirmados na ordem colada, 3 "não vão" e o Neto (sem marca) sem resposta ({r113})')
        ok(r113['matheus'] is not None and r113['matheus'][1] == 'mensalista' and r113['gabriel'] == [True, True],
           f'CT-KAN-244-02: Matheus entrou no elenco como mensalista e Gabriel como avulso ({r113["matheus"]}, {r113["gabriel"]})')
        # Em inglês
        p113.evaluate("localStorage.setItem('nj-idioma','en')"); p113.reload(); p113.wait_for_timeout(2000)
        p113.click('[data-a=tab][data-v=rodada]'); p113.wait_for_timeout(600)
        p113.click('[data-a=colarLista]'); p113.wait_for_selector('#colarTexto', timeout=8000)
        p113.fill('#colarTexto', '1 - Gui 👍\n2 - Somebody New ❌\n3 - Neto'); p113.click('#dlg [data-a=colarLer]'); p113.wait_for_selector('#colarVao', timeout=5000); p113.wait_for_timeout(300)
        en113 = p113.inner_text('#dlg')
        falta113 = p113.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(colar|rodg)\\./.test(k))")
        ok('Check before marking' in en113 and 'Going (1)' in en113 and 'Not going (1)' in en113 and 'No mark, nothing changes: Neto' in en113 and 'New to the group' in en113 and not falta113,
           f'CT-KAN-244-11: em English, a janela vem traduzida ({en113[:160]!r}, {falta113})')
        p113.click('#dlg [data-a=close]') if p113.locator('#dlg [data-a=close]').count() else p113.keyboard.press('Escape')
        ctx113.close()

        # ---------- v114 (KAN-245): sortear times agora, sem cadastro, e salvar como grupo
        ctx114 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p114 = ctx114.new_page(); p114.on('pageerror', lambda e: errs.append(str(e)))
        p114.goto(URL + '#/'); p114.wait_for_selector('#aprSortear', timeout=15000); p114.wait_for_timeout(400)
        ok(p114.inner_text('#aprSortear').strip() == '⚡ Sortear times agora, sem cadastro', 'CT-KAN-245-01: a apresentação tem "Sortear times agora, sem cadastro"')
        banco0 = p114.evaluate("Object.keys(JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}')).length")
        p114.click('#aprSortear'); p114.wait_for_selector('#srPasso1', timeout=15000); p114.wait_for_timeout(300)
        p114.select_option('#srEsporte', 'society'); p114.wait_for_timeout(100)
        ok(p114.input_value('#srPorTime') == '6', f'CT-KAN-245-01: trocar o esporte sugere o tamanho do time dele (society: {p114.input_value("#srPorTime")})')
        p114.fill('#srPorTime', '5')
        p114.fill('#srNomes', 'Kleber\nPeró'); p114.click('[data-a=srLer]'); p114.wait_for_selector('#srSortearBtn', timeout=5000)
        f114b = p114.evaluate("[document.getElementById('srSortearBtn').textContent, document.getElementById('srSortearBtn').disabled]")
        ok(f114b == ['Faltam 8 para sortear', True] and p114.locator('#srTimes').count() == 0,
           f'CT-KAN-245-03 (CT-KAN-270-02): com 2 nomes e 5 por time, o botão diz quantos faltam e não sorteia ({f114b})')
        p114.click('[data-a=srVoltar][data-v="1"]'); p114.wait_for_selector('#srNomes', timeout=5000)
        # KAN-269: nome completo com 6 palavras ou mais, um por linha, entra no sorteio
        p114.fill('#srNomes', 'Ana\nMaria Clara de Souza Lima Ferreira\nBia'); p114.click('[data-a=srLer]'); p114.wait_for_selector('#srPasso2', timeout=5000)
        n269 = p114.evaluate("[...document.querySelectorAll('#srLista .sr-nome')].map(e=>e.textContent)")
        ok(n269 == ['Ana', 'Maria Clara de Souza Lima Ferreira', 'Bia'], f'CT-KAN-269-01: "Maria Clara de Souza Lima Ferreira" (6 palavras, sem número) entra no sorteio ({n269})')
        p114.click('#srBarra [data-a=srVoltar]'); p114.wait_for_selector('#srNomes', timeout=5000)
        LISTA114 = """Lista 28/09 das 20:30 as 22h - 👍🏻 ou ❌ - Responder até as 13:00
1 - Kleber (Z) ❌️
2 - Peró (M) 👍🏼
3 - Diegão (M) 🤙🏼
4 - Luiz Otávio (LE) 👍
5 - Pedro Nunes (M) 👍
6 - Daniel (M) 👍🏽
7 - Alex (LD) 🤙🏼
8 - Thiago Aguiar (V)👍🏾
9 - Denis (A) 👍
10 - Cristian (M)
11 - Bruno (Z) 👍🏼
12 - Gustavão (V) 👍🏼
13 - Matheus (M) 👍🏻

1- Marcos (goleiro) 👍🏽
2- Jones (goleiro)👍🏼"""
        p114.fill('#srNomes', LISTA114); p114.click('[data-a=srLer]'); p114.wait_for_selector('#srPasso2', timeout=5000); p114.wait_for_timeout(200)
        n114 = p114.evaluate("[...document.querySelectorAll('#srLista .sr-nome')].map(e=>e.textContent)")
        gk114 = p114.evaluate("[...document.querySelectorAll('#srLista li')].filter(li=>li.querySelector('.sr-pos').value==='GOL').map(li=>li.querySelector('.sr-nome').textContent)")
        bar114 = p114.evaluate("(()=>{const b=document.getElementById('srSortearBtn').getBoundingClientRect();return {txt:document.getElementById('srSortearBtn').textContent,topo:Math.round(b.top),base:Math.round(b.bottom),alt:Math.round(b.height),dentro:b.bottom<=innerHeight+0.5&&b.top>=0,rolagem:document.documentElement.scrollWidth>innerWidth}})()")
        ok(bar114['txt'] == 'Sortear times (13)' and bar114['dentro'] and bar114['alt'] >= 44 and not bar114['rolagem'],
           f'CT-KAN-270-01: em 360px, "Sortear times (13)" fica visível sem rolar, numa barra fixa, sem rolagem lateral ({bar114})')
        ok(len(n114) == 13 and 'Kleber' not in n114 and 'Cristian' not in n114 and n114[0] == 'Peró' and gk114 == ['Marcos', 'Jones'],
           f'CT-KAN-245-01: da lista do WhatsApp entram só os 13 com 👍, e "(goleiro)" já vem como goleiro ({n114}, {gk114})')
        for i, nota in [(0, '9'), (1, '9'), (2, '3')]:
            p114.locator('#srLista .sr-nota').nth(i).select_option(nota)
        g114 = p114.evaluate("(()=>{const sels=[...document.querySelectorAll('#srLista .sel')];return {alt:Math.min(...sels.map(s=>Math.round(s.getBoundingClientRect().height))),rolagem:document.documentElement.scrollWidth>innerWidth}})()")
        ok(g114['alt'] >= 44 and not g114['rolagem'], f'CT-KAN-245-08: em 360px, os combos de posição e nota têm 44px e não há rolagem lateral ({g114})')
        p114.click('[data-a=srSortear]'); p114.wait_for_selector('#srTimes', timeout=5000); p114.wait_for_timeout(300)
        t114 = p114.evaluate("[...document.querySelectorAll('#srTimes .team')].map(t=>({n:t.querySelector('.th b').textContent,js:[...t.querySelectorAll('li')].map(li=>li.querySelector('.pn').firstChild.textContent.trim()),res:t.querySelectorAll('li.reserva').length,gk:[...t.querySelectorAll('.pos')].filter(p=>p.textContent==='GOL').length}))")
        gkres114 = p114.evaluate("[...document.querySelectorAll('#srTimes li.reserva .pos')].filter(p=>p.textContent==='GOL').length")
        ok(len(t114) == 2 and sorted(len(t['js']) for t in t114) == [6, 7] and sum(t['res'] for t in t114) == 3 and all(t['gk'] == 1 for t in t114) and gkres114 == 0
           and sorted(sum([t['js'] for t in t114], [])) == sorted(n114),
           f'CT-KAN-245-01: 13 nomes com 5 por time viram 2 times (7 e 6), com os reservas marcados, um goleiro em cada e nenhum goleiro de reserva ({t114})')
        z114 = p114.get_attribute('#srZap', 'href')
        from urllib.parse import unquote
        zt114 = unquote(z114.split('text=', 1)[1])
        ok(z114.startswith('https://api.whatsapp.com/send?text=') and 'Time 1' in zt114 and 'Peró' in zt114 and 'Nota' not in zt114 and '9' not in zt114.replace('#/sortear', ''),
           f'CT-KAN-245-06: "Mandar no WhatsApp" leva os times e os nomes, sem as notas ({zt114[:120]!r})')
        for tema in ['light', 'dark']:
            p114.emulate_media(color_scheme=tema); p114.wait_for_timeout(150); contraste(p114, f'sorteio sem conta ({tema})')
        p114.emulate_media(color_scheme='light')
        p114.screenshot(path=f'{OUT}/114-sorteio-rapido-360.png', full_page=True)
        banco1 = p114.evaluate("Object.keys(JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}')).length")
        ok(banco1 == banco0 and not p114.evaluate("localStorage.getItem('nj-sorteio-rapido')"),
           f'CT-KAN-245-06: sortear não grava nada no banco nem guarda no aparelho ({banco0} → {banco1})')
        # Duplas (beach tennis): sem posição
        p114.click('[data-a=srVoltar][data-v="2"]'); p114.wait_for_selector('#srPasso2', timeout=5000); p114.click('[data-a=srVoltar][data-v="1"]'); p114.wait_for_selector('#srNomes', timeout=5000)
        txt_antes = p114.input_value('#srNomes')
        p114.select_option('#srEsporte', 'beach_tennis'); p114.wait_for_timeout(100)
        p114.fill('#srPorTime', '2'); p114.fill('#srNomes', 'Ana\nBia\nCaio\nDuda\nEdu\nFabi\nGil\nHelô')
        p114.click('[data-a=srLer]'); p114.wait_for_selector('#srPasso2', timeout=5000)
        semPos114 = p114.locator('#srLista .sr-pos').count() == 0
        p114.click('[data-a=srSortear]'); p114.wait_for_selector('#srTimes', timeout=5000)
        d114 = p114.evaluate("[...document.querySelectorAll('#srTimes .team')].map(t=>[t.querySelector('.th b').textContent, t.querySelectorAll('li').length])")
        ok(txt_antes == LISTA114 and semPos114 and len(d114) == 4 and all(x[1] == 2 for x in d114) and d114[0][0] == 'Dupla 1',
           f'CT-KAN-245-05: beach tennis forma 4 duplas e não pede posição; "Voltar" guardou a lista ({d114})')
        # De volta ao society para salvar como grupo
        p114.click('[data-a=srVoltar][data-v="2"]'); p114.wait_for_selector('#srPasso2', timeout=5000); p114.click('[data-a=srVoltar][data-v="1"]'); p114.wait_for_selector('#srNomes', timeout=5000)
        p114.select_option('#srEsporte', 'society'); p114.fill('#srPorTime', '5'); p114.fill('#srNomes', LISTA114)
        p114.click('[data-a=srLer]'); p114.wait_for_selector('#srPasso2', timeout=5000)
        p114.locator('#srLista .sr-nota').nth(0).select_option('9')
        p114.click('[data-a=srSortear]'); p114.wait_for_selector('#srTimes', timeout=5000)
        times114 = p114.evaluate("[...document.querySelectorAll('#srTimes .team')].map(t=>[...t.querySelectorAll('li')].map(li=>li.querySelector('.pn').firstChild.textContent.trim()).sort())")
        p114.click('[data-a=srSalvar]'); p114.wait_for_selector('#le', timeout=15000); p114.wait_for_timeout(500)
        ok('#/criar' in p114.url and p114.locator('#authSorteio').count() == 1, 'CT-KAN-245-02: "Salvar como meu grupo" leva ao cadastro, que avisa que o sorteio está guardado')
        p114.wait_for_function("document.querySelector('#lpais') && document.querySelector('#lpais').options.length > 10", timeout=15000)
        p114.fill('#le', 'v114@teste.com'); p114.fill('#lp', 'Jogo@2026'); p114.fill('#lp2', 'Jogo@2026'); p114.keyboard.press('Enter')
        p114.wait_for_selector('#ngDoSorteio', timeout=15000); p114.wait_for_timeout(500)
        f114 = p114.evaluate("[document.getElementById('ngBox').dataset.sp, document.getElementById('ngt').value, document.getElementById('ngDoSorteio').textContent]")
        ok(f114[0] == 'society' and f114[1] == '5' and 'Os 13 jogadores do sorteio entram no elenco' in f114[2],
           f'CT-KAN-245-02: depois do cadastro, o "Novo grupo" abre com o esporte e o tamanho do time do sorteio e avisa o que vem junto ({f114})')
        p114.fill('#ngn', 'Turma do Sorteio'); p114.click('#dlg [data-a=criarGrupoDoSorteio]')
        p114.wait_for_function("location.hash.startsWith('#/g/')", timeout=15000); p114.wait_for_timeout(4000)
        ok('Grupo criado com os 13 jogadores e os times de hoje.' in p114.inner_text('#toast'), f'CT-KAN-245-02: avisa "Grupo criado com os 13 jogadores e os times de hoje." ({p114.inner_text("#toast")!r})')
        p114.reload(); p114.wait_for_timeout(2500); p114.click('[data-a=tab][data-v=rodada]'); p114.wait_for_timeout(1500)
        r114 = p114.evaluate("""(()=>{const nm=id=>S.jog[id]&&S.jog[id].name;const r=Object.entries(S.rod).find(([k,v])=>v.times)||[];const rd=r[1]||{};
          const per=Object.keys(S.jog).find(k=>S.jog[k].name==='Peró'),mar=Object.keys(S.jog).find(k=>S.jog[k].name==='Marcos');
          return {jog:Object.keys(S.jog).length, nota:((S.rat||{}).nivel||{})[per]||null, pos:[S.jog[per].pos, S.jog[mar].pos], tipo:((S.pc||{}).tipos||{})[per]||null,
            times:(rd.times||[]).map(t=>t.players.map(nm).sort()), sor:rd.sor?[rd.sor.n,rd.sor.aj]:null, vao:Object.values(S.pres||{}).filter(p=>p.s==='in').length,
            rascunho:localStorage.getItem('nj-sorteio-rapido')}})()""")
        ok(r114['jog'] == 13 and r114['nota'] == 9 and r114['pos'] == ['MEI', 'GOL'] and r114['tipo'] == 'mensalista' and r114['rascunho'] is None,
           f'CT-KAN-245-02: o grupo novo tem os 13 jogadores (mensalistas), com posição e nota, e o rascunho saiu do aparelho ({r114})')
        ok(sorted(r114['times']) == sorted(times114) and r114['sor'] == [1, 0] and r114['vao'] == 13 and p114.locator('.teams .team').count() == 2,
           f'CT-KAN-245-02: os times sorteados continuam visíveis na rodada de hoje, com todos confirmados e "1º sorteio" ({r114["times"]}, {r114["sor"]})')
        # Quem desistiu descarta o sorteio
        p114.goto(URL + '#/sortear'); p114.wait_for_selector('#srPasso1', timeout=15000)
        p114.select_option('#srEsporte', 'society'); p114.fill('#srPorTime', '5'); p114.fill('#srNomes', LISTA114)
        p114.click('[data-a=srLer]'); p114.wait_for_selector('#srPasso2', timeout=5000)
        p114.click('[data-a=srSortear]'); p114.wait_for_selector('#srTimes', timeout=5000)
        p114.click('[data-a=srSalvar]'); p114.wait_for_selector('#ngDoSorteio [data-a=descartarSorteio]', timeout=15000)
        p114.click('#ngDoSorteio [data-a=descartarSorteio]'); p114.wait_for_timeout(600)
        ds114 = p114.evaluate("[!!localStorage.getItem('nj-sorteio-rapido'), document.getElementById('dlg').open]")
        ok(ds114 == [False, False] and 'Sorteio descartado.' in p114.inner_text('#toast'), f'CT-KAN-245-09: "Descartar o sorteio" apaga o sorteio guardado e fecha o "Novo grupo" ({ds114})')
        # Conta já logada: "Salvar como meu grupo" abre o "Novo grupo" direto e cria o grupo com o sorteio
        p114.goto(URL + '#/sortear'); p114.wait_for_selector('#srPasso1', timeout=15000)
        p114.select_option('#srEsporte', 'society'); p114.fill('#srPorTime', '5'); p114.fill('#srNomes', LISTA114)
        p114.click('[data-a=srLer]'); p114.wait_for_selector('#srPasso2', timeout=5000)
        p114.click('[data-a=srSortear]'); p114.wait_for_selector('#srTimes', timeout=5000)
        p114.click('[data-a=srSalvar]'); p114.wait_for_selector('#ngDoSorteio', timeout=15000)
        p114.fill('#ngn', 'Segundo Grupo'); p114.click('#dlg [data-a=criarGrupoDoSorteio]')
        p114.wait_for_function("location.hash.startsWith('#/g/')", timeout=15000); p114.wait_for_timeout(4000)
        lg114 = p114.evaluate("[Object.keys(S.jog).length, !!localStorage.getItem('nj-sorteio-rapido'), S.app && S.app.name]")
        ok(lg114 == [13, False, 'Segundo Grupo'], f'CT-KAN-245-09: com a conta já aberta, "Salvar como meu grupo" vai direto ao "Novo grupo" e o grupo nasce com o sorteio ({lg114})')
        p114.evaluate("localStorage.removeItem('nj-sorteio-rapido')")
        ctx114.close()
        # Tela de entrar e English (visitante)
        ctx114b = b.new_context(viewport={'width': 360, 'height': 740}, service_workers='block', locale='en-US')
        p114b = ctx114b.new_page(); p114b.on('pageerror', lambda e: errs.append(str(e)))
        p114b.goto(URL + '#/entrar'); p114b.wait_for_selector('#authSortear', timeout=15000); p114b.wait_for_timeout(500)
        ok(p114b.inner_text('#authSortear') == 'Draw without signing up', f'CT-KAN-245-10: a tela de entrar tem o atalho para sortear sem cadastro ({p114b.inner_text("#authSortear")!r})')
        p114b.click('#authSortear'); p114b.wait_for_selector('#srPasso1', timeout=15000)
        p114b.fill('#srPorTime', '5'); p114b.fill('#srNomes', '\n'.join('P%d' % i for i in range(10))); p114b.click('[data-a=srLer]'); p114b.wait_for_selector('#srPasso2', timeout=5000)
        p114b.click('[data-a=srSortear]'); p114b.wait_for_selector('#srTimes', timeout=5000); p114b.wait_for_timeout(300)
        en114 = p114b.inner_text('main')
        falta114 = p114b.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(sr|apr|login)\\./.test(k))")
        ok('Teams drawn' in en114 and 'Save as my group' in en114 and 'Team 1' in en114 and not falta114,
           f'CT-KAN-245-11: em English, o sorteio sem conta vem traduzido ({en114[:140]!r}, {falta114})')
        ctx114b.close()

        # ---------- v116 (KAN-242): avisos no celular dos administradores
        ctx116 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo', permissions=['notifications'])
        # O Chromium de teste (sem tela) responde "bloqueado" para notificações: aqui o celular "permite".
        ctx116.add_init_script("Object.defineProperty(Notification,'permission',{configurable:true,get:()=>'granted'});Notification.requestPermission=async()=>'granted'")
        p116 = ctx116.new_page(); p116.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p116, 'criar')
        p116.fill('#le', 'v116@teste.com'); p116.fill('#lp', 'Jogo@2026'); p116.fill('#lp2', 'Jogo@2026'); p116.keyboard.press('Enter'); p116.wait_for_selector('#ngBox', timeout=12000)
        p116.fill('#ngn', 'Avisos FC'); p116.click('[data-a=pickSport][data-v=futebol]'); p116.click('[data-a=createGroup]')
        p116.wait_for_function("location.hash.startsWith('#/g/')"); p116.wait_for_timeout(1500)
        g116 = p116.url.split('#/g/')[1].split('/')[0]
        uid116 = p116.evaluate("S.user.uid")
        def janela116():
            p116.click('#topright [data-a=contaMenu]'); p116.wait_for_timeout(250)
            p116.click('.theme-menu [data-a=avisosDlg]'); p116.wait_for_selector('#avisosJanela', timeout=8000); p116.wait_for_timeout(400)
        p116.click('#topright [data-a=contaMenu]'); p116.wait_for_timeout(250)
        it116 = p116.evaluate("(()=>{const b=document.querySelector('.theme-menu [data-a=avisosDlg]');return b?b.textContent.trim():null})()")
        ok(it116 == '🔔Avisos no celular', f'CT-KAN-242-11: o menu da conta tem "Avisos no celular" ({it116!r})')
        p116.keyboard.press('Escape'); p116.wait_for_timeout(200)
        janela116()
        d116 = p116.evaluate("(()=>{const j=document.getElementById('avisosJanela'),b=document.getElementById('avLigar');return {est:j.dataset.estado,alt:b?Math.round(b.getBoundingClientRect().height):0,foco:document.activeElement&&document.activeElement.id,txt:b?b.textContent.trim():''}})()")
        ok(d116 == {'est': 'desligado', 'alt': d116['alt'], 'foco': 'avLigar', 'txt': '🔔 Receber avisos neste celular'} and d116['alt'] >= 44,
           f'CT-KAN-242-11: sem avisos, a janela mostra "Receber avisos neste celular" (44px, com o foco) ({d116})')
        p116.click('#avLigar'); p116.wait_for_selector('#avGrupos [data-a=avisosGrupo]', timeout=8000); p116.wait_for_timeout(800)
        ap116 = p116.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return Object.entries(s).filter(([k])=>k.startsWith('usuarios/'+S.user.uid+'/aparelhos/')).map(([k,v])=>[v.token,v.lang,v.plat])})()")
        pref116 = p116.evaluate(LER, f'avisos/{g116}_{uid116}')
        ok(ap116 == [['demo-token', 'pt-BR', 'web']] and pref116 and pref116['ligado'] is True and pref116['gid'] == g116 and pref116['uid'] == uid116,
           f'CT-KAN-242-01: ligar grava este celular (token e idioma) e já liga o grupo ({ap116}, {pref116})')
        gr116 = p116.evaluate("(()=>{const b=document.querySelector('#avGrupos [data-a=avisosGrupo]');return {nome:b.querySelector('.av-nome').textContent,ck:b.getAttribute('aria-checked'),alt:Math.round(b.getBoundingClientRect().height),semMin:!!document.querySelector('#avGrupos [data-a=avisosMinimo]'),sel:!!document.querySelector('#avGrupos select')}})()")
        ok(gr116 == {'nome': 'Avisos FC', 'ck': 'true', 'alt': gr116['alt'], 'semMin': True, 'sel': False} and gr116['alt'] >= 44,
           f'CT-KAN-242-05: o grupo aparece ligado (44px); sem mínimo, a janela orienta "Definir mínimo" em vez do horário ({gr116})')
        p116.click('#avGrupos [data-a=avisosGrupo]'); p116.wait_for_selector('#avGrupos [data-a=avisosGrupo][aria-checked=false]', timeout=5000); p116.wait_for_timeout(300)
        ok(p116.evaluate(LER, f'avisos/{g116}_{uid116}')['ligado'] is False, 'CT-KAN-242-05: cada administrador desliga um grupo só para si')
        p116.click('#avGrupos [data-a=avisosGrupo]'); p116.wait_for_selector('#avGrupos [data-a=avisosGrupo][aria-checked=true]', timeout=5000)
        # "Definir mínimo" leva para a aba Rodada; com o mínimo, aparece o horário do aviso
        p116.click('#avGrupos [data-a=avisosMinimo]'); p116.wait_for_timeout(1200)
        ok(p116.evaluate("S.tab") == 'rodada' and p116.locator('[data-a=abrirMinimos]').count() > 0 and 'Definir mínimo' in p116.inner_text('#toast'),
           'CT-KAN-242-05: "Definir mínimo" abre a aba Rodada do grupo e diz onde tocar')
        p116.click('[data-a=abrirMinimos]'); p116.wait_for_selector('#minRaiz .minp', timeout=5000)
        p116.fill('#minRaiz .minp[data-k=_total]', '10'); p116.click('#dlg [data-a=salvarMinimos]'); p116.wait_for_timeout(1000)
        janela116()
        sel116 = p116.evaluate("(()=>{const s=document.querySelector('#avGrupos select');return s?{v:s.value,alt:Math.round(s.getBoundingClientRect().height),ops:[...s.options].map(o=>o.textContent)}:null})()")
        ok(sel116 and sel116['v'] == '3' and sel116['alt'] >= 44 and sel116['ops'][0] == '1h antes do jogo' and '24h antes do jogo' in sel116['ops'],
           f'CT-KAN-242-02: com mínimo, o aviso de faltam pessoas vem 3h antes por padrão, de 1h a 24h (44px) ({sel116})')
        p116.select_option('#avGrupos select', '6'); p116.wait_for_timeout(800)
        ok(p116.evaluate(LER, f'grupos/{g116}/privado/avisos') == {'horas': 6} and 'Horário do aviso salvo' in p116.inner_text('#toast'),
           'CT-KAN-242-02: mudar o horário grava para o grupo todo (grupos/{gid}/privado/avisos)')
        lay116 = p116.evaluate("(()=>{const d=document.getElementById('dlg');return {rolagem:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth}})()")
        ok(not lay116['rolagem'], f'CT-KAN-242-11: em 360px, a janela não tem rolagem lateral ({lay116})')
        p116.screenshot(path=f'{OUT}/v116-avisos.png')
        for tema in ['light', 'dark']:
            p116.emulate_media(color_scheme=tema); p116.wait_for_timeout(200)
            bd116 = p116.evaluate(CHK)
            ok(not bd116, f'CT-KAN-242-11: contraste da janela no tema {tema} ({bd116[:4]})')
        p116.emulate_media(color_scheme='light')
        # Recarrega e confere
        p116.reload(); p116.wait_for_timeout(2000); janela116(); p116.wait_for_selector('#avGrupos select', timeout=8000)
        ok(p116.evaluate("document.getElementById('avisosJanela').dataset.estado") == 'ligado' and p116.evaluate("document.querySelector('#avGrupos select').value") == '6',
           'CT-KAN-242-11: depois de recarregar, os avisos continuam ligados e o horário de 6h')
        # Desligar neste celular
        p116.click('#avDesligar'); p116.wait_for_selector('#avLigar', timeout=5000); p116.wait_for_timeout(300)
        ap116b = p116.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return Object.keys(s).filter(k=>k.startsWith('usuarios/'+S.user.uid+'/aparelhos/')).length})()")
        ok(ap116b == 0 and p116.evaluate("localStorage.getItem('nj-avisos')") is None, 'CT-KAN-242-11: "Desligar neste celular" apaga o registro do celular')
        # O toque no aviso abre a rodada certa (#/g/{grupo}/r/{rodada})
        p116.click('#dlg [data-a=close]'); p116.wait_for_timeout(200)
        p116.click('[data-a=tab][data-v=jogadores]'); p116.wait_for_timeout(400)
        rid116 = p116.evaluate("(()=>{const r=document.querySelector('[data-c=rid]');return r&&r.value?r.value:S.rid})()")
        p116.goto(URL + '#/'); p116.wait_for_timeout(800)
        p116.goto(URL + '#/g/' + g116 + '/r/' + rid116); p116.wait_for_timeout(2000)
        rt116 = p116.evaluate("[S.tab, S.rid, !!document.getElementById('presPainel')]")
        ok(rid116 and rt116 == ['rodada', rid116, True], f'CT-KAN-242-01: o endereço do aviso abre a gestão na rodada do aviso ({rid116}, {rt116})')
        # Sair da conta com os avisos ligados: o celular sai da lista
        janela116(); p116.click('#avLigar'); p116.wait_for_selector('#avGrupos', timeout=8000); p116.wait_for_timeout(500)
        p116.click('#dlg [data-a=close]'); p116.wait_for_timeout(200)
        sair(p116); p116.wait_for_timeout(2500)
        ap116c = p116.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return Object.keys(s).filter(k=>k.includes('/aparelhos/')).length})()")
        ok(ap116c == 0 and p116.evaluate("localStorage.getItem('nj-avisos')") is None, f'CT-KAN-242-07: ao sair da conta, o celular para de receber (registro apagado) ({ap116c})')
        ctx116.close()
        # Sem permissão (bloqueada) e em English
        ctx116b = b.new_context(viewport={'width': 360, 'height': 740}, service_workers='block', locale='en-US', timezone_id='America/Sao_Paulo')
        ctx116b.add_init_script("Object.defineProperty(Notification,'permission',{configurable:true,get:()=>'default'})")
        p116b = ctx116b.new_page(); p116b.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p116b, 'criar')
        p116b.fill('#le', 'v116en@teste.com'); p116b.fill('#lp', 'Jogo@2026'); p116b.fill('#lp2', 'Jogo@2026'); p116b.keyboard.press('Enter'); p116b.wait_for_selector('#ngBox', timeout=12000)
        p116b.fill('#ngn', 'Alerts FC'); p116b.click('[data-a=pickSport][data-v=futebol]'); p116b.click('[data-a=createGroup]')
        p116b.wait_for_function("location.hash.startsWith('#/g/')"); p116b.wait_for_timeout(1500)
        p116b.click('#topright [data-a=contaMenu]'); p116b.wait_for_timeout(250)
        p116b.click('.theme-menu [data-a=avisosDlg]'); p116b.wait_for_selector('#avisosJanela', timeout=8000); p116b.wait_for_timeout(400)
        en116 = p116b.inner_text('#avisosJanela')
        falta116 = p116b.evaluate("(window.__njSemTraducao&&window.__njSemTraducao()||[]).filter(k=>/^(av|conta)\\./.test(k))")
        ok('Phone notifications' in en116 and 'Get notifications on this phone' in en116 and not re.search(r'\b(avisos|celular|Receber)\b', en116) and not falta116,
           f'CT-KAN-242-11: em English, a janela vem traduzida ({en116[:120]!r}, {falta116})')
        p116b.evaluate("(()=>{Object.defineProperty(Notification,'permission',{get:()=>'denied'})})()")
        p116b.click('#dlg [data-a=close]'); p116b.wait_for_timeout(200)
        p116b.click('#topright [data-a=contaMenu]'); p116b.wait_for_timeout(250)
        p116b.click('.theme-menu [data-a=avisosDlg]'); p116b.wait_for_selector('#avisosJanela', timeout=8000); p116b.wait_for_timeout(300)
        ok(p116b.evaluate("document.getElementById('avisosJanela').dataset.estado") == 'negado' and 'blocked' in p116b.inner_text('#avisosJanela'),
           'CT-KAN-242-05: com a permissão bloqueada, a janela explica como liberar, sem quebrar')
        ctx116b.close()

        # ---------- v117 (KAN-271): afastado aparece como "Não vou" no link (sem o motivo)
        ctx117 = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, service_workers='block', timezone_id='America/Sao_Paulo')
        p117 = ctx117.new_page(); p117.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p117, 'criar')
        p117.fill('#le', 'v117@teste.com'); p117.fill('#lp', 'Jogo@2026'); p117.fill('#lp2', 'Jogo@2026'); p117.keyboard.press('Enter'); p117.wait_for_selector('#ngBox', timeout=12000)
        p117.fill('#ngn', 'Afastados FC'); p117.click('[data-a=pickSport][data-v=futebol]'); p117.click('[data-a=createGroup]')
        p117.wait_for_function("location.hash.startsWith('#/g/')"); p117.wait_for_timeout(1500)
        g117 = p117.url.split('#/g/')[1].split('/')[0]
        p117.click('[data-a=tab][data-v=jogadores]'); p117.wait_for_timeout(300); p117.click('[data-a=seed]'); p117.wait_for_timeout(1500)
        p117.click('[data-a=tab][data-v=rodada]'); p117.wait_for_timeout(800)
        r117 = p117.evaluate("S.rid"); d117 = p117.evaluate("(S.rod[S.rid]||{}).date || S.rid.slice(2,12)")
        (j1, n1), (j2, n2) = p117.evaluate("Object.keys(S.jog).slice(0,2).map(k=>[k,S.jog[k].name])")
        mes117 = d117[:7]
        p117.evaluate(PUT, {f'grupos/{g117}/privado/afast': {'a117': {'pid': j1, 'mot': 'Lesao', 'obs': 'joelho', 'de': mes117, 'ate': mes117}}})
        p117.reload(); p117.wait_for_timeout(2500)
        p117.wait_for_function("(window.S && S.jog && Object.values(S.jog).some(j=>j && j.af))", timeout=10000)
        m117 = p117.evaluate(LER, f'grupos/{g117}/jogadores/{j1}')
        ok(m117 and m117.get('af') and m117['af'][0]['de'] <= d117 <= (m117['af'][0]['ate'] or '9999') and 'joelho' not in json.dumps(m117) and 'Lesao' not in json.dumps(m117),
           f'CT-KAN-271-04: a gestão grava no jogador só as datas do afastamento, sem motivo ({m117.get("af") if m117 else None})')
        p117.goto(URL + '#/p/' + g117 + '/r/' + r117); p117.wait_for_timeout(2000)
        LINHA117 = """(n=>{const li=[...document.querySelectorAll('li')].find(l=>(l.querySelector('.pn-txt')||{}).textContent===n);if(!li)return null;
          const b=v=>{const x=li.querySelector('[data-a=pubMark][data-v='+v+']');return x?x.getAttribute('aria-pressed'):null};return {txt:li.textContent, naoVou:b('out'), vou:b('in')}})"""
        lin117, lin117b = p117.evaluate(LINHA117, n1), p117.evaluate(LINHA117, n2)
        ok(lin117 and lin117['naoVou'] == 'true' and lin117['vou'] == 'false' and '· afastado' in lin117['txt'] and 'Lesão' not in lin117['txt']
           and lin117b and '· afastado' not in lin117b['txt'] and lin117b['naoVou'] == 'false',
           f'CT-KAN-271-01: no link, o afastado aparece com "Não vou" marcado e "· afastado", sem o motivo; os outros, normais ({lin117}, {lin117b})')
        p117.locator('li', has=p117.locator('.pn-txt', has_text=n1)).locator('[data-a=pubMark][data-v=in]').click(); p117.wait_for_timeout(1200)
        pres117 = p117.evaluate(LER, f'grupos/{g117}/rodadas/{r117}/presencas/{j1}')
        ok(pres117 and pres117.get('s') == 'in', f'CT-KAN-271-02: o afastado que voltou toca em "Vou" e a presença grava "vai" ({pres117})')
        # Afastamento que acabou no mês anterior: a marca sai e ele volta ao normal no link
        ant117 = p117.evaluate("m=>{const [a,b]=m.split('-').map(Number);const t=a*12+b-2;return Math.floor(t/12)+'-'+String(t%12+1).padStart(2,'0')}", mes117)
        p117.goto(URL + '#/g/' + g117); p117.wait_for_timeout(1500)
        p117.evaluate(PUT, {f'grupos/{g117}/privado/afast': {'a117': {'pid': j1, 'mot': 'Lesao', 'de': ant117, 'ate': ant117}}})
        p117.reload(); p117.wait_for_timeout(2500)
        p117.wait_for_function("j=>!(S.jog[j]||{}).af", arg=j1, timeout=10000)
        ok((p117.evaluate(LER, f'grupos/{g117}/jogadores/{j1}') or {}).get('af') is None, 'CT-KAN-271-03: afastamento que acabou tira a marca do jogador')
        ctx117.close()

    if parte('b'):
        # ---------- v35 (KAN-142): "Continuar com o Google" na aba errada entra ou cria a conta e avisa (navegador separado)
        ctx3 = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); p3 = ctx3.new_page()
        p3.on('pageerror', lambda e: errs.append(str(e)))
        abrir_entrada(p3, 'criar')
        p3.fill('#le', 'ja.tenho@teste.com'); p3.fill('#lp', 'Jogo@2026'); p3.fill('#lp2', 'Jogo@2026'); p3.keyboard.press('Enter'); p3.wait_for_timeout(1200)
        p3.evaluate("localStorage.removeItem('pelada-demo-v2-u');localStorage.setItem('pelada-mode','signup')"); p3.reload(); p3.wait_for_timeout(600); abrir_entrada(p3, 'criar')
        p3.fill('#le', 'ja.tenho@teste.com'); p3.click('[data-a=google]'); p3.wait_for_timeout(1300)
        t3 = p3.inner_text('#toast')
        ok('já tinha conta com esse Google' in t3 and p3.evaluate("!!(S.user&&!S.user.anon)"), f'CT-KAN-142-01: "Criar conta" com Google de conta que já existe entra nela e avisa ({t3!r})')
        p3.evaluate("localStorage.removeItem('pelada-demo-v2-u');localStorage.setItem('pelada-mode','login')"); p3.reload(); p3.wait_for_timeout(600); abrir_entrada(p3, 'entrar')
        p3.fill('#le', 'conta.nova@teste.com'); p3.click('[data-a=google]'); p3.wait_for_timeout(1300)
        t4 = p3.inner_text('#toast')
        ok('Conta criada com o Google' in t4, f'CT-KAN-142-02: "Entrar" com Google de conta nova cria a conta e avisa ({t4!r})')
        ctx3.close()
    b.close()

errs = [e for e in errs if not re.search(r'ERR_TUNNEL|fonts\.g|icons/|favicon|ERR_NAME|ERR_INTERNET|net::', e)]
# Sem a pasta icons/ (cópia do Project), o navegador anota "404" sem dizer o arquivo: não é erro do app.
if not TEM_ICONES: errs = [e for e in errs if 'status of 404' not in e]
ok(not sem_traducao, 'todos os textos têm tradução no dicionário' + ('' if not sem_traducao else ': ' + ' | '.join(sem_traducao[:5])))
ok(not nativos, 'CT-KAN-128-05: nenhuma caixa do navegador (confirm ou alert) apareceu em todo o roteiro' + (f' ({nativos[:3]})' if nativos else ''))
ok(not errs, 'nenhum erro de JavaScript' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
# No GitHub a montagem é completa: nada pode ser pulado.
if os.environ.get('GITHUB_ACTIONS') and pulados: ok(False, 'no GitHub nenhuma verificação pode ser pulada: ' + ' | '.join(pulados[:3]))
falhas = [r for r in res if not r['ok']]
json.dump({'total': len(res), 'falhas': len(falhas), 'pulados': pulados, 'resultados': res}, open(f'{OUT}/resultado.json', 'w'), ensure_ascii=False, indent=1)
print(f'\n{len(res) - len(falhas)} de {len(res)} verificações passaram.' + (f' {len(pulados)} puladas por falta de arquivos nesta cópia.' if pulados else ''))
sys.exit(1 if falhas else 0)
