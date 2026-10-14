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
import sys, os, re, json
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'fotos'
os.makedirs(OUT, exist_ok=True)
res = []; errs = []

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
def confirmar_app(pg, sim=True):
    try:
        pg.wait_for_selector('#dlg .conf [data-a=confSim]', timeout=3000)
    except Exception:
        return False
    pg.click('#dlg .conf [data-a=confSim]' if sim else '#dlg .conf [data-a=confNao]'); pg.wait_for_timeout(500)
    return True

def adicionar_pelo_link(pg, nome):
    pg.click('[data-a=pubAdd]'); pg.wait_for_timeout(300); pg.fill('#anm', nome); pg.click('[data-a=pubSaveAdd]'); pg.wait_for_timeout(1200)
    return pg.evaluate("n=>Object.keys(S.pres).find(id=>S.pres[id].nome===n)||null", nome)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, color_scheme='light', service_workers='block')
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
    ok(not ic, 'CT-KAN-59-01: os 5 ícones do app existem e carregam' + (f' (faltando: {ic})' if ic else ''))
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
    pg.goto(URL + '#/criar'); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.activeElement.id") == 'le', 'cursor no e-mail no cadastro')
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
    pg.fill('#le', 'org@teste.com'); pg.fill('#lp', 'Jogo@2026'); pg.fill('#lp2', 'Jogo@2026'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    ok(pg.locator('#ngn').count() == 1, 'Enter cria a conta e abre "Novo grupo"')
    pg.fill('#ngn', 'Futebol de Segunda'); pg.click('[data-a=createGroup]'); pg.wait_for_timeout(1500)
    ok('#/g/' in pg.url, 'grupo de futebol criado')
    gid_fut = pg.url.split('#/g/')[1]
    elenco_e_presenca(pg, 10)
    ok(pg.evaluate("document.querySelector('#tabs').getAttribute('role')") == 'tablist', 'abas com role=tablist')
    ok(pg.locator('.mk button.on-in').count() >= 10, '10 presenças marcadas')
    hsm = pg.evaluate("Math.min(...[...document.querySelectorAll('.btn.sm')].map(b=>b.getBoundingClientRect().height).filter(h=>h>0))")
    ok(hsm >= 36, f'botões pequenos com 36px ou mais ({hsm:.0f}px)')
    shot('02-rodada-claro'); contraste(pg, 'Rodada (claro)')
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
    pg.click('[data-a=tab][data-v=ranking]'); pg.wait_for_timeout(500); ok(pg.locator('table').count() == 1, 'ranking mostra a partida salva')
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
    cx = pg.evaluate("(g)=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')),m=S.month,d=s['grupos/'+g+'/resumos/'+m]||{};return (d.cx||{}).ent||0}", gid_fut)
    ok(cx == 8000, f'CT-KAN-87-05: ficha do mês guarda as entradas do caixa em centavos ({cx})')
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
    pg.click('[data-a=tab][data-v=votacao]'); pg.wait_for_timeout(300); pg.click('[data-a=newVote]'); pg.wait_for_timeout(200)
    pg.click('[data-a=saveVote]'); pg.wait_for_timeout(800)
    ok(pg.locator('#shtxt').is_visible(), 'votação criada e link para o WhatsApp continua aberto')
    pg.click('[data-a=close]'); pg.wait_for_timeout(300)
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
    opts = ' | '.join(pg.locator('select[data-c=rid] option').all_inner_texts())
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
        pg.locator('.team [data-a=color]').first.click(); pg.wait_for_timeout(800)
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
    pg.locator('.team [data-a=color][data-v="1"]').click(); pg.wait_for_timeout(800)
    d0 = pg.evaluate(RODDB, [gid_fut, rid_main])
    pg.evaluate("S.rod[S.rid]=Object.assign({},S.rod[S.rid]);delete S.rod[S.rid].cores")  # este aparelho não viu a troca de cor
    sortear(pg)
    d1 = pg.evaluate(RODDB, [gid_fut, rid_main])
    ok((d0.get('cores') or {}).get('1') is not None and d1.get('drawnAt') != d0.get('drawnAt') and d1.get('cores') == d0.get('cores') and d1.get('locked'),
       f'CT-KAN-108-02: sortear de novo com a tela desatualizada grava o sorteio novo e mantém as cores escolhidas ({d1.get("cores")})')
    # KAN-108 CT-06: o link do jogador mostra os times novos com as cores novas, sem notas
    esperado = [[CORES[((d1.get('cores') or {}).get(str(i), t.get('c', 0)) or 0) % 8], len(t['players'])] for i, t in enumerate(d1['times'])]
    pg.goto(URL + '#/p/' + gid_fut); pg.wait_for_timeout(1200)
    visto = pg.evaluate("[...document.querySelectorAll('.team')].map(t=>[t.querySelector('.th b').textContent,+t.querySelector('.th .tag').textContent])")
    ok(pg.evaluate("S.route.id") == rid_main and visto == esperado and pg.locator('.lvl-tag').count() == 0,
       f'CT-KAN-108-06: link do jogador mostra os times novos com as cores novas e sem notas ({visto})')
    # KAN-108 CT-05: basquete não perde nenhuma mudança; em duplas (beach tennis) não existe botão de Cor, de propósito
    pg.goto(URL + '#/g/' + gid_bq); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
    rid_bq = pg.evaluate("S.rid")
    novo = json.dumps([t['players'] for t in pg.evaluate(RODDB, [gid_bq, rid_bq])['times']], separators=(',', ':'))
    pg.evaluate("S.rod[S.rid]=Object.assign({},S.rod[S.rid],{times:S.rod[S.rid].times.map(t=>Object.assign({},t,{players:t.players.slice().reverse()}))})")
    pg.locator('.team [data-a=color]').first.click(); pg.wait_for_timeout(800)
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
        vals = pg.evaluate("[...document.querySelectorAll('#drawBox .dp')].map(x=>x.value)")
        pg.click('#drawGo'); pg.wait_for_timeout(2500)
        d1 = pg.evaluate(RODDB, [g, rg])
        bons = all(re.fullmatch(r'[A-Za-z0-9_-]{1,64}', x) for x in vals) and XSS not in json.dumps(d1.get('times'))
        forma = ('Dupla 1' in pg.inner_text('main')) if nome_g == 'beach tennis' else pg.locator('.team').count() >= 2
        ok(bons and len(vals) >= 4 and d1.get('drawnAt') != d0.get('drawnAt') and forma and pg.evaluate(SEM_XSS),
           f'CT-KAN-76-12: {nome_g}: sorteio com a carga gravada funciona, só com identificadores válidos e nada injetado')
        pg.evaluate(DEL, [pres_k(g, rg, XSS)]); pg.reload(); pg.wait_for_timeout(800)

    # ---------- Sugestões da Qualidade (09/10): versão em todas as telas, convite e tema escuro
    pg.goto(URL + '#/'); pg.wait_for_timeout(900)
    ok(f'versão {VER}' in (pg.inner_text('main .versao') if pg.locator('main .versao').count() else ''), 'CT-KAN-107-03: Meus grupos mostra a versão do app')
    pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
    pg.click('[data-a=inviteLink]'); pg.wait_for_timeout(500); token = pg.evaluate("S.convite&&S.convite.token"); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
    # Sair (KAN-80): com algo ainda sem enviar, pergunta antes; Cancelar mantém a pessoa conectada
    pg.evaluate("window.__demoPendente=true")
    pg.click('#topright [data-a=logout]'); pg.wait_for_timeout(800)
    sj = pg.inner_text('#dlg .conf') if pg.locator('#dlg .conf').count() else ''
    ok('Sair sem enviar' in sj and 'Sair mesmo assim' in sj, 'CT-KAN-128: Sair com alterações sem enviar pergunta na janela do app ("Sair mesmo assim")')
    confirmar_app(pg, False)
    ok(pg.evaluate("!!(S.user&&!S.user.anon)"), 'CT-KAN-80-03: com alterações sem enviar, Sair pergunta antes e Cancelar mantém conectado')
    pg.evaluate("window.__demoPendente=false")
    pg.click('#topright [data-a=logout]'); pg.wait_for_timeout(1500)
    ok(pg.locator('.ld-nav').count() == 1 and pg.evaluate("!S.user||S.user.anon") and pg.evaluate("Object.keys(S.caixa||{}).length==0&&!S.rat"), 'CT-KAN-80-01: Sair desconecta, recarrega na apresentação e não deixa dados do grupo na tela')
    pg.goto(URL + '#/entrar'); pg.wait_for_timeout(900)
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
    pg.goto(URL + '#/entrar'); pg.wait_for_timeout(900)
    pg.fill('#le', 'org@teste.com'); pg.fill('#lp', 'Jogo@2026'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1500)
    ok(pg.evaluate("!!(S.user&&!S.user.anon)") and pg.locator('[data-a=tab]').count() >= 8 and pg.inner_text('#gname') == 'Futebol de Segunda' and pg.locator('.hero-r').count() == 1,
       'CT-KAN-80-06: entrar de novo com a mesma conta traz o grupo de volta')
    ok(pg.evaluate("document.documentElement.dataset.theme") == 'dark' and pg.evaluate("(()=>{const r=document.querySelector('#topright [data-a=logout]').getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth})()"),
       'CT-KAN-80-06: no tema escuro, o botão Sair cabe na tela de 390px')
    contraste(pg, 'gestão com Sair (escuro, CT-KAN-80-06)')
    pg.click('#topright [data-a=logout]')
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
    pg.goto(URL + '#/entrar'); pg.wait_for_timeout(900)
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
    pg.click('#topright [data-a=logout]')
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
    conta_org = pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2')||'{}');return s['contas/u-orgtestecom']||null})()")
    ok(bool(conta_org) and conta_org.get('email') == 'org@teste.com' and isinstance(conta_org.get('acesso'), (int, float)) and conta_org.get('criada'),
       f'CT-KAN-116-03: ao entrar, a conta registra o último acesso, o e-mail e a data de registro ({conta_org and sorted(conta_org.keys())})')
    # O app dos clientes não tem portal: nenhum botão, nem para o e-mail do Kleber, e #/portal cai em Meus grupos
    pg.goto(URL + '#/entrar'); pg.wait_for_timeout(900)
    pg.fill('#le', 'kleberkoch@gmail.com'); pg.fill('#lp', 'Jogo@2026'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    pg.goto(URL + '#/'); pg.wait_for_timeout(1000)
    if pg.locator('#dlg[open]').count(): pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(300)
    pg.goto(URL + '#/portal'); pg.wait_for_timeout(900)
    ok(pg.locator('a[href*="portal"]').count() == 0 and 'Portal do Nosso Jogo' not in pg.inner_text('main') and pg.locator('li.cli').count() == 0,
       'CT-KAN-116-02: o app dos clientes não tem portal (nenhum botão, nem para o e-mail da administração; #/portal não abre nada)')
    pg.click('#topright [data-a=logout]')
    try: pg.wait_for_selector('.ld-nav', timeout=8000)
    except Exception: pass

    # ---------- Portal do Nosso Jogo: site separado (KAN-116), aqui em modo demonstração com os dados de teste
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
    p2.goto(URL + '#/criar'); p2.wait_for_timeout(800)
    p2.fill('#le', 'relogio@teste.com'); p2.fill('#lp', 'Jogo@2026'); p2.fill('#lp2', 'Jogo@2026'); p2.keyboard.press('Enter'); p2.wait_for_timeout(1200)
    p2.fill('#ngn', 'Sexta Noite')
    p2.select_option('#sched .sd', '5'); p2.fill('#sched .si', '23:00'); p2.fill('#sched .sf', '01:00')
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
    b.close()

errs = [e for e in errs if not re.search(r'ERR_TUNNEL|fonts\.g|icons/|favicon|ERR_NAME|ERR_INTERNET|net::', e)]
ok(not sem_traducao, 'todos os textos têm tradução no dicionário' + ('' if not sem_traducao else ': ' + ' | '.join(sem_traducao[:5])))
ok(not nativos, 'CT-KAN-128-05: nenhuma caixa do navegador (confirm ou alert) apareceu em todo o roteiro' + (f' ({nativos[:3]})' if nativos else ''))
ok(not errs, 'nenhum erro de JavaScript' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
falhas = [r for r in res if not r['ok']]
json.dump({'total': len(res), 'falhas': len(falhas), 'resultados': res}, open(f'{OUT}/resultado.json', 'w'), ensure_ascii=False, indent=1)
print(f'\n{len(res) - len(falhas)} de {len(res)} verificações passaram.')
sys.exit(1 if falhas else 0)
