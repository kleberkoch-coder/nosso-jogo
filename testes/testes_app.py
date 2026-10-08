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
    ok(pg.locator('#themeBtn').is_visible(), 'chip de tema no cabeçalho do cadastro')
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

    # ---------- Partida, ranking, caixa, votação
    pg.click('[data-a=tab][data-v=partida]'); pg.wait_for_timeout(400)
    pg.locator('[data-a=goal][data-v=a]').first.click(); pg.wait_for_timeout(200); pg.locator('[data-a=addGoal][data-p]').first.click(); pg.wait_for_timeout(300)
    pg.evaluate("S.live.dur=1"); pg.click('[data-a=clock]'); pg.wait_for_timeout(1600)
    ok(pg.locator('#clockMsg').is_visible(), 'aviso visual "Tempo esgotado" no cronômetro')
    shot('04-placar'); pg.click('[data-a=clock]')
    pg.click('[data-a=saveMatch]'); pg.wait_for_timeout(800)
    pg.click('[data-a=tab][data-v=ranking]'); pg.wait_for_timeout(300); ok(pg.locator('table').count() == 1, 'ranking mostra a partida salva')
    pg.click('[data-a=tab][data-v=caixa]'); pg.wait_for_timeout(300); pg.click('[data-a=addLan]'); pg.wait_for_timeout(200)
    pg.select_option('#lp2', index=1); pg.click('[data-a=saveLan]'); pg.wait_for_timeout(800)
    ok(pg.locator('.money').first.inner_text().strip() != 'R$ 0,00', 'lançamento entra no caixa'); shot('05-caixa')
    pg.click('[data-a=tab][data-v=votacao]'); pg.wait_for_timeout(300); pg.click('[data-a=newVote]'); pg.wait_for_timeout(200)
    pg.click('[data-a=saveVote]'); pg.wait_for_timeout(800)
    ok(pg.locator('#shtxt').is_visible(), 'votação criada e link para o WhatsApp continua aberto')
    pg.click('[data-a=close]'); pg.wait_for_timeout(300)

    # ---------- Aba Grupo e tema escuro na gestão
    pg.click('[data-a=tab][data-v=grupo]'); pg.wait_for_timeout(300)
    ok(pg.locator('.theme-seg').count() == 1, 'painel Aparência na aba Grupo')
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
    pg.locator('.mk.lg [data-v=out]').nth(11).click(); pg.wait_for_timeout(900)
    ok(pg.locator('.mk.lg button.on-out').first.inner_text().startswith('✕'), 'Não vou marcado mostra ✕')
    ok(pg.locator('.mk.lg button.on-in').first.inner_text().startswith('✓'), 'Vou marcado mostra ✓')
    pg.click('[data-a=pubAdd]'); pg.wait_for_timeout(300); pg.fill('#anm', 'Avulso Teste'); pg.click('[data-a=pubSaveAdd]'); pg.wait_for_timeout(900)
    ok('Avulso Teste' in pg.inner_text('main'), 'avulso se adiciona pelo link')
    shot('08-link-publico-escuro'); contraste(pg, 'link público (escuro)')
    pg.locator('#themeBtn').click(); pg.locator('.theme-menu [data-v=light]').click(); pg.wait_for_timeout(300)
    shot('09-link-publico-claro'); contraste(pg, 'link público (claro)')

    # ---------- Outros esportes: nada de futebol fixo
    pg.goto(URL + '#/g/' + gid_fut); pg.wait_for_timeout(800)
    novo_grupo(pg, 'Beach Domingo', 'beach_tennis')
    ok('#/g/' in pg.url and pg.url.split('#/g/')[1] != gid_fut, 'grupo de beach tennis criado')
    elenco_e_presenca(pg, 8)
    ok(pg.locator('main .pos').count() == 0, 'beach tennis sem siglas de posição')
    sortear(pg)
    ok('Dupla 1' in pg.inner_text('main'), 'beach tennis sorteia em duplas')
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
    b.close()

errs = [e for e in errs if not re.search(r'ERR_TUNNEL|fonts\.g|icons/|favicon|ERR_NAME|ERR_INTERNET|net::', e)]
ok(not sem_traducao, 'todos os textos têm tradução no dicionário' + ('' if not sem_traducao else ': ' + ' | '.join(sem_traducao[:5])))
ok(not errs, 'nenhum erro de JavaScript' + ('' if not errs else ': ' + ' | '.join(errs[:5])))
falhas = [r for r in res if not r['ok']]
json.dump({'total': len(res), 'falhas': len(falhas), 'resultados': res}, open(f'{OUT}/resultado.json', 'w'), ensure_ascii=False, indent=1)
print(f'\n{len(res) - len(falhas)} de {len(res)} verificações passaram.')
sys.exit(1 if falhas else 0)
