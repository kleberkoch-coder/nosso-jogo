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
    pg.click('[data-a=pubAdd]'); pg.wait_for_timeout(300); pg.fill('#anm', nome); pg.click('[data-a=pubSaveAdd]'); pg.wait_for_timeout(1200)
    return pg.evaluate("n=>Object.keys(S.pres).find(id=>S.pres[id].nome===n)||null", nome)

with sync_playwright() as pw:
    b = pw.chromium.launch()
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
        ok(pg.locator(f'a[href="https://wa.me/14155550100"]').count() >= 1, 'CT-KAN-156-02: link do WhatsApp abre o número dos EUA, sem o 55 na frente')
        pg.locator(f'[data-a=editPlayer][data-p="{pid156}"]').click(); pg.wait_for_timeout(300)
        # KAN-162: o combo do telefone voltou com os EUA (o número salvo); número brasileiro sem trocar o combo não salva errado
        ok(pg.input_value('#ppais') == 'US' and pg.input_value('#ptel') == '4155550100', 'CT-KAN-162-03: ao editar, o combo mostra o país do número salvo (+1) e o campo só o número')
        pg.fill('#ptel', '(11) 98765-4321'); pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(400)
        ok(pg.evaluate("document.getElementById('dlg').open") and 'Telefone inválido' in pg.inner_text('#toast'), 'CT-KAN-162-03: número brasileiro com o combo nos EUA não vira um número americano errado')
        pg.select_option('#ppais', 'BR'); pg.wait_for_timeout(100)
        ok(pg.get_attribute('#ptel', 'placeholder') == '(11) 98765-4321', 'CT-KAN-162-03: trocar o país do combo troca o exemplo do campo')
        pg.click('#dlg [data-a=savePlayer]'); pg.wait_for_timeout(600)
        ok(pg.evaluate("(id)=>S.cont[id].tel", pid156) == '+5511987654321' and pg.locator('a[href="https://wa.me/5511987654321"]').count() >= 1,
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
        achou = [x.split(' ·')[0].strip() for x in pg.locator('.mk.lg').locator('xpath=..').locator('.pn').all_inner_texts()]
        ok(len(achou) >= 1 and all('fern' in n.lower() for n in achou), f'CT-KAN-127-02: busca "FERN" mostra só os nomes com "fern", sem diferenciar maiúsculas ({achou})')
        pg.fill('#pbusca', 'aléMAO'); pg.wait_for_timeout(150)
        ok(pg.locator('[data-a=pubMark][data-v=in]').count() == 1, 'CT-KAN-127-02: busca ignora acentos ("aléMAO" acha Alemão)')
        pg.fill('#pbusca', ''); pg.wait_for_timeout(150)
        ok(pg.locator('[data-a=pubMark][data-v=in]').count() == total, f'CT-KAN-127-02: apagar a busca volta a lista completa ({total})')
        pg.fill('#pbusca', 'Zezinho Novo'); pg.wait_for_timeout(150)
        ok('Não achou? Toque em Adicionar meu nome' in pg.inner_text('main') and pg.locator('[data-a=pubAdd]').is_visible(), 'CT-KAN-127-03: busca sem resultado orienta e mostra "Adicionar meu nome"')
        pg.click('[data-a=pubAdd]'); pg.wait_for_timeout(300)
        ok(pg.input_value('#anm') == 'Zezinho Novo', 'CT-KAN-127-03: o nome digitado na busca já vem na janela')
        ok(pg.get_attribute('#anm', 'enterkeyhint') == 'done', 'CT-KAN-74-02: o teclado do celular mostra "Concluir" no campo da janela')
        pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200); pg.fill('#pbusca', ''); pg.wait_for_timeout(150)
        ordem = pg.evaluate("(()=>{const h=[...document.querySelectorAll('main h3, main summary')].map(e=>e.textContent.trim());return h})()")
        iv = next((i for i, t in enumerate(ordem) if t.startswith('Você vai')), 99); it = next((i for i, t in enumerate(ordem) if t.startswith('Ver times')), -1)
        ok(it > iv and not pg.locator('main .teams').first.is_visible(), f'CT-KAN-127-04: com a lista aberta, "Você vai?" vem antes e os times ficam recolhidos em "Ver times" ({ordem[:4]})')
        txtp = pg.inner_text('main')
        rep_ = [n for n in [x.split(' ·')[0].strip() for x in pg.locator('main .plist .pn').all_inner_texts()] if n and txtp.count(n) > 1 and not any(n != m and n in m for m in [y.split(' ·')[0].strip() for y in pg.locator('main .plist .pn').all_inner_texts()])]
        ok(not rep_, f'CT-KAN-127-05: fora dos blocos recolhidos, cada nome aparece uma vez ({rep_[:3]})')
        ok('Partidas' in pg.inner_text('main') and ' × ' in pg.inner_text('main') and pg.locator('[data-a=delMatch]').count() == 0, 'CT-KAN-86-03: jogador vê o placar das partidas pelo link, sem botão de apagar')
        pg.locator('.mk.lg [data-v=out]').nth(11).click(); pg.wait_for_timeout(900)
        ok(pg.locator('.mk.lg button.on-out').first.inner_text().startswith('✕'), 'Não vou marcado mostra ✕')
        ok(pg.locator('.mk.lg button.on-in').first.inner_text().startswith('✓'), 'Vou marcado mostra ✓')
        pg.click('[data-a=pubAdd]'); pg.wait_for_timeout(300); pg.fill('#anm', 'Avulso Teste'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
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
        ok(tel162 == '+12125550142' and pg.locator('a[href="https://wa.me/12125550142"]').count() == 1, f'CT-KAN-162-03: número americano sem "+" vira +1 e o WhatsApp abre certo ({tel162})')
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
        pg.click('[data-a=pubAdd]'); pg.wait_for_timeout(300); pg.fill('#anm', 'Zé Avulso 78')
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
        ok(nome_tel in falta9 and href.startswith('https://wa.me/5511987654321?text=') and 'Confirme%20aqui' in href, f'CT-KAN-64-04: com telefone, "WhatsApp" abre a conversa da pessoa com a mensagem ({href[:60]})')
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
        ok(not carregou(), 'CT-KAN-218-03: ao abrir a gestão, as ações de grupo ainda não baixaram (só chegam quando usadas)')
        p35.click('[data-a=groupsDlg]'); p35.wait_for_selector('#dlg[open] .plist', timeout=8000)
        ok(carregou() and 'Seus grupos' in p35.inner_text('#dlg') and 'Textos FC' in p35.inner_text('#dlg'), 'CT-KAN-218-03: "⇄ Grupos" baixa as ações de grupo e abre "Seus grupos"')
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
