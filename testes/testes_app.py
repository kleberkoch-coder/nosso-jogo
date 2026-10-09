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

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, color_scheme='light', service_workers='block')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # Janelas de confirmação (confirm): recusadas, a não ser quando o teste liga aceitar['v'].
    aceitar = {'v': False}
    pg.on('dialog', lambda d: d.accept() if aceitar['v'] else d.dismiss())
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    sem_traducao = []
    pg.on('console', lambda m: sem_traducao.append(m.text) if m.type == 'warning' and m.text.startswith('Texto sem tradução') else None)
    shot = lambda n: pg.screenshot(path=f'{OUT}/{n}.png')

    # ---------- Página de apresentação e seletor de tema
    import time
    t0 = time.time(); pg.goto(URL); pg.wait_for_selector('.ld-nav', timeout=10000); ms = (time.time() - t0) * 1000
    ok(ms <= 1500, f'primeira tela desenhada em até 1,5 s (levou {ms:.0f} ms)')
    pg.wait_for_timeout(600); shot('01-apresentacao')
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
    sortear(pg); ok(pg.locator('.team').count() >= 2, 'times de futebol sorteados'); shot('03-times')

    # ---------- v15 (KAN-90 a KAN-92): lista fechada, sorteio fecha a lista, aviso de lista diferente dos times e pôr no time
    mark = lambda pid, v: pg.click(f'[data-a=mark][data-p="{pid}"][data-v={v}]')
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
    aceitar['v'] = True; pg.click('[data-a=lock]'); pg.wait_for_timeout(600)
    ok(pg.locator('[data-a=mark]').count() > 0, 'CT-KAN-90-02: reabrir a lista volta a permitir marcar presença')
    t0p = pg.evaluate("S.rod[S.rid].times[0].players[0]")
    aceitar['v'] = False; mark(t0p, 'out'); pg.wait_for_timeout(500)
    ok(pg.evaluate("(id)=>S.pres[id].s", t0p) == 'in', 'CT-KAN-91-02: com times sorteados, mudar presença pede confirmação (Cancelar não muda)')
    aceitar['v'] = True; mark(t0p, 'out'); pg.wait_for_timeout(600)
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
    pg.click('[data-a=lock]'); pg.wait_for_timeout(600)  # reabre para os testes do link público abaixo

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
    aceitar['v'] = True; pg.locator('[data-a=delMatch]').last.click(); pg.wait_for_timeout(800); aceitar['v'] = False
    pg.click('[data-a=tab][data-v=ranking]'); pg.wait_for_timeout(500)
    j1 = pg.evaluate("Object.values(S.res).reduce((s,d)=>s+Object.values(d.jog||{}).reduce((a,x)=>a+(x.j||0),0),0)")
    ok(j1 == 10 and pg.locator('[data-a=delMatch]').count() == 0, f'CT-KAN-87-03: apagar partida desconta do ranking ({j1})')
    # Recalcular: estraga a ficha no banco e manda refazer
    pg.evaluate("(g)=>{const K='pelada-demo-v2',s=JSON.parse(localStorage.getItem('pelada-demo-v2')),m=Object.keys(s).find(k=>k.startsWith('grupos/'+g+'/resumos/'));const d=s[m];const p=Object.keys(d.jog)[0];d.jog[p].j=99;localStorage.setItem(K,JSON.stringify(s))}", gid_fut)
    pg.reload(); pg.wait_for_timeout(1200); pg.click('[data-a=tab][data-v=ranking]'); pg.wait_for_timeout(600)
    ok('99' in pg.inner_text('table'), 'CT-KAN-87-04: ficha estragada aparece no ranking (preparação)')
    aceitar['v'] = True; pg.click('[data-a=recalc]'); pg.wait_for_timeout(1500); aceitar['v'] = False
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
    ok('Partidas' in pg.inner_text('main') and ' × ' in pg.inner_text('main') and pg.locator('[data-a=delMatch]').count() == 0, 'CT-KAN-86-03: jogador vê o placar das partidas pelo link, sem botão de apagar')
    pg.locator('.mk.lg [data-v=out]').nth(11).click(); pg.wait_for_timeout(900)
    ok(pg.locator('.mk.lg button.on-out').first.inner_text().startswith('✕'), 'Não vou marcado mostra ✕')
    ok(pg.locator('.mk.lg button.on-in').first.inner_text().startswith('✓'), 'Vou marcado mostra ✓')
    pg.click('[data-a=pubAdd]'); pg.wait_for_timeout(300); pg.fill('#anm', 'Avulso Teste'); pg.click('[data-a=pubSaveAdd]'); pg.wait_for_timeout(900)
    ok('Avulso Teste' in pg.inner_text('main'), 'avulso se adiciona pelo link')
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
    pg.click('[data-a=lock]'); pg.wait_for_timeout(500)
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
    elenco_e_presenca(pg, 10); sortear(pg)
    ok(not FUTEBOL.search(pg.inner_text('main')), 'Rodada do basquete sem palavras de futebol')
    pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(400)
    sc = [x.strip() for x in pg.locator('[data-a=goal][data-v=a]').all_inner_texts()]
    ok(sc == ['+1', '+2', '+3'], f'placar do basquete com +1, +2 e +3 ({sc})')
    pg.locator('[data-a=goal][data-v=a]').nth(2).click(); pg.wait_for_timeout(200); pg.locator('[data-a=addGoal][data-p]').first.click(); pg.wait_for_timeout(300)
    ok(pg.locator('.board .sc').first.inner_text().strip() == '3', 'cesta de 3 soma 3 pontos'); shot('11-basquete-placar')

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
    pg.evaluate("S.loaded.pres=false"); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(200)
    txt = pg.inner_text('main')
    ok('Carregando' in txt and 'Ninguém confirmou ainda' not in txt, 'CT-KAN-109-01: presença carregando mostra "Carregando…"')
    pg.evaluate("S.loaded.pres=true"); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(200)
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
    pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=rodada]'); pg.wait_for_timeout(500)
    av = pg.inner_text('.aviso-limite') if pg.locator('.aviso-limite').count() else ''
    ok('limite de avulsos novos (1)' in av and pg.locator('[data-a=addAvulso]').count() >= 1, f'CT-KAN-89-03: organizador vê o aviso do limite na aba Rodada e ainda pode adicionar avulso ({av[:50]})')
    contraste(pg, 'Rodada com aviso de limite')
    ng = pg.evaluate("(()=>{const s=JSON.parse(localStorage.getItem('pelada-demo-v2'));return (s['contas/'+S.user.uid]||{}).ng||0})()")
    ok(ng >= 2, f'CT-KAN-89-04: cada grupo criado soma 1 no contador da conta ({ng})')
    pg.evaluate(LIM, {'gruposPorConta': ng}); pg.reload(); pg.wait_for_timeout(1200)
    antes = pg.evaluate("Object.keys(S.me.grupos||{}).length")
    novo_grupo(pg, 'Grupo Além do Limite', 'futebol')
    err = pg.inner_text('#ngErr') if pg.locator('#ngErr').count() else ''
    ok('limite atual' in err and pg.evaluate("Object.keys(S.me.grupos||{}).length") == antes, f'CT-KAN-89-05: no limite de grupos aparece mensagem clara e nenhum grupo é criado ({err[:40]})')
    shot('21-limite-grupos')
    pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
    pg.evaluate(LIM, None); pg.evaluate(TRAVA, [gid_fut, rid_lim, True]); pg.reload(); pg.wait_for_timeout(1000)

    # ---------- Sugestões da Qualidade (09/10): versão em todas as telas, convite e tema escuro
    pg.goto(URL + '#/'); pg.wait_for_timeout(900)
    ok(f'versão {VER}' in (pg.inner_text('main .versao') if pg.locator('main .versao').count() else ''), 'CT-KAN-107-03: Meus grupos mostra a versão do app')
    pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(1000); pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(400)
    pg.click('[data-a=inviteLink]'); pg.wait_for_timeout(500); token = pg.evaluate("S.convite&&S.convite.token"); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
    # Sair (KAN-80): com algo ainda sem enviar, pergunta antes; Cancelar mantém a pessoa conectada
    pg.evaluate("window.__demoPendente=true"); aceitar['v'] = False
    pg.click('#topright [data-a=logout]'); pg.wait_for_timeout(800)
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
    b.close()

errs = [e for e in errs if not re.search(r'ERR_TUNNEL|fonts\.g|icons/|favicon|ERR_NAME|ERR_INTERNET|net::', e)]
ok(not sem_traducao, 'todos os textos têm tradução no dicionário' + ('' if not sem_traducao else ': ' + ' | '.join(sem_traducao[:5])))
ok(not errs, 'nenhum erro de JavaScript' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
falhas = [r for r in res if not r['ok']]
json.dump({'total': len(res), 'falhas': len(falhas), 'resultados': res}, open(f'{OUT}/resultado.json', 'w'), ensure_ascii=False, indent=1)
print(f'\n{len(res) - len(falhas)} de {len(res)} verificações passaram.')
sys.exit(1 if falhas else 0)
