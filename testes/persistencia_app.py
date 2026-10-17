# Roteiro de gravação (KAN-170): tudo que o app grava precisa voltar do banco depois de recarregar a página.
# No GitHub, roda com o app ligado ao EMULADOR do Firebase (Firestore e login de verdade, com as regras valendo),
# na tarefa "persistencia". Aqui, também roda em modo demonstração (que recusa o que o Firestore recusa).
#   python3 testes/persistencia_app.py http://127.0.0.1:8765/index.html
# Cada caso: grava pela tela, espera chegar ao banco, recarrega (F5) e confere. No fim, sai, entra de novo
# num navegador limpo (sem nada guardado no aparelho) e confere tudo outra vez, direto do banco.
# Os casos têm código P01, P02…; testes/persistencia-cobertura.json liga cada tipo de dado gravado a um caso,
# e a conferência da entrega barra gravação nova sem caso aqui.
import json, os, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/index.html'
GITHUB = bool(os.environ.get('GITHUB_ACTIONS'))

# Se o roteiro parar no meio (seletor que não aparece, tempo esgotado), o motivo vira anotação no GitHub,
# com o último caso que passou: o log completo nem sempre está acessível.
def _parou(tipo, valor, tb):
    import traceback
    ultimo = res[-1]['teste'][:80] if res else 'nenhum'
    linha = traceback.extract_tb(tb)[-1].lineno if tb else '?'
    msg = f'roteiro parou na linha {linha} ({tipo.__name__}: {str(valor).splitlines()[0][:200]}); último caso: {ultimo}'
    print(('::error::Gravação: ' if GITHUB else 'ERRO    ') + msg, flush=True)
    sys.__excepthook__(tipo, valor, tb)
sys.excepthook = _parou
res = []; errs = []

def ok(cond, msg):
    res.append({'ok': bool(cond), 'teste': msg})
    print(('OK      ' if cond else 'FALHOU  ') + msg, flush=True)
    if not cond and GITHUB:
        print('::error::Gravação: ' + msg, flush=True)

def gravou(pg):
    """Espera as gravações chegarem ao banco e recarrega a página (F5)."""
    pg.wait_for_timeout(400)
    pg.evaluate("window.__njPendentes ? window.__njPendentes(10000) : true")
    pg.reload()
    pg.wait_for_function("window.S && S.user !== undefined", timeout=20000)
    pg.wait_for_timeout(1500)

def pronto(pg, aba=None):
    pg.wait_for_function("window.S && S.loaded && S.loaded.app && S.loaded.mem", timeout=20000)
    if aba:
        pg.click(f'[data-a=tab][data-v={aba}]'); pg.wait_for_timeout(700)

def conf(pg):
    try:
        pg.wait_for_selector('#dlg .conf [data-a=confSim]', timeout=2500)
        pg.click('#dlg .conf [data-a=confSim]'); pg.wait_for_timeout(500)
    except Exception:
        pass

EMAIL, SENHA = 'persistencia@teste.com', 'Jogo@2026'
J = lambda pg, js, arg=None: pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    novo = lambda: b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', timezone_id='America/Sao_Paulo')
    ctx = novo(); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))

    # P01 conta: criar e gravar o país (usuarios/{uid})
    pg.goto(URL + '#/criar'); pg.wait_for_function("document.querySelector('#lpais') && document.querySelector('#lpais').options.length > 10", timeout=20000)
    pg.select_option('#lpais', 'PT')
    pg.fill('#le', EMAIL); pg.fill('#lp', SENHA); pg.fill('#lp2', SENHA); pg.wait_for_timeout(200)
    pg.click('[data-a=signup]')
    pg.wait_for_selector('#ngn', timeout=20000)  # conta nova abre "Novo grupo"
    ok(pg.evaluate("S.me && S.me.pais") == 'PT', 'CT-KAN-170-P01: conta nova grava o país escolhido no cadastro')

    # P02 grupo (grupos/{gid}, membros, contas): criar com nome, país e moeda
    pg.select_option('#ngp', 'BR'); pg.wait_for_timeout(100)
    pg.fill('#ngn', 'Persistência FC'); pg.click('[data-a=createGroup]')
    pg.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    gid = pg.url.split('#/g/')[1].split('/')[0]
    gravou(pg); pronto(pg)
    ok(pg.inner_text('#gname') == 'Persistência FC' and J(pg, "S.app.cfg.pais") == 'BR' and J(pg, "S.app.cfg.moeda") == 'BRL',
       'CT-KAN-170-P02: grupo novo (nome, país e moeda) continua depois de recarregar')

    # P03 posição criada (config/app, posx: lista dentro de lista, KAN-167)
    pronto(pg, 'grupo'); pg.click('[data-a=addPos]'); pg.wait_for_timeout(300)
    pg.fill('#psg', 'vol'); pg.fill('#pnmx', 'Volante'); pg.click('#dlg [data-a=savePos]')
    gravou(pg); pronto(pg, 'grupo')
    ok('Volante' in pg.inner_text('main'), 'CT-KAN-170-P03: posição criada continua depois de recarregar')

    # P04 elenco de exemplo (jogadores, privado/ratings com pares separados, privado/caixa)
    pronto(pg, 'jogadores'); pg.click('[data-a=seed]'); pg.wait_for_timeout(1500)
    gravou(pg); pronto(pg, 'jogadores')
    n4 = J(pg, "Object.values(S.jog).filter(p=>p.ativo!==false).length")
    ok(n4 >= 10 and len(J(pg, "(S.rat&&S.rat.sep)||[]")) >= 1, f'CT-KAN-170-P04: elenco de exemplo, notas e par separado continuam ({n4} jogadores)')

    # P05 jogador novo com nota, tipo, telefone e e-mail (jogadores, privado/ratings, privado/caixa, privado/contatos)
    pg.click('[data-a=addPlayer]'); pg.wait_for_timeout(400)
    pg.fill('#pnm', 'Zé Persistente')
    pg.evaluate("(()=>{const r=document.querySelector('#plv');r.value='8.5';r.dispatchEvent(new Event('input',{bubbles:true}))})()")
    pg.select_option('#ptp', 'diarista'); pg.fill('#ptel', '(11) 98765-4321'); pg.fill('#pmail', 'ze@clube.com.br')
    pg.click('#dlg [data-a=savePlayer]')
    gravou(pg); pronto(pg, 'jogadores')
    ze = J(pg, """(()=>{const e=Object.entries(S.jog).find(([,p])=>p.name==='Zé Persistente');if(!e)return null;const id=e[0];
      return {id,nota:(S.rat.nivel||{})[id],tipo:((S.pc||{}).tipos||{})[id],tel:(S.cont||{})[id]&&S.cont[id].tel,mail:(S.cont||{})[id]&&S.cont[id].email}})()""")
    ok(bool(ze) and ze['nota'] == 8.5 and ze['tipo'] == 'diarista' and ze['tel'] == '+5511987654321' and ze['mail'] == 'ze@clube.com.br',
       f'CT-KAN-170-P05: jogador novo com nota, tipo, telefone e e-mail continua depois de recarregar ({ze})')

    # P06 mudar a nota de um jogador (privado/ratings, com par separado no mesmo registro: o defeito do KAN-167)
    pg.click(f'[data-a=editPlayer][data-p="{ze["id"]}"]'); pg.wait_for_timeout(400)
    pg.evaluate("(()=>{const r=document.querySelector('#plv');r.value='3';r.dispatchEvent(new Event('input',{bubbles:true}))})()")
    pg.click('#dlg [data-a=savePlayer]')
    gravou(pg); pronto(pg, 'jogadores')
    ok(J(pg, "(id)=>(S.rat.nivel||{})[id]", ze['id']) == 3, 'CT-KAN-170-P06: nota mudada continua depois de recarregar')

    # P07 par "não colocar no mesmo time" (privado/ratings)
    n7 = len(J(pg, "(S.rat&&S.rat.sep)||[]"))
    pg.click('[data-a=addSep]'); pg.wait_for_timeout(300)
    ops = pg.eval_on_selector_all('#sa option', 'os=>os.map(o=>o.value)')
    pg.select_option('#sa', ops[-1]); pg.select_option('#sb', ops[-2]); pg.click('#dlg [data-a=saveSep]')
    gravou(pg); pronto(pg, 'jogadores')
    ok(len(J(pg, "(S.rat&&S.rat.sep)||[]")) == n7 + 1, 'CT-KAN-170-P07: par separado novo continua depois de recarregar')

    # P08 mensalidade, diária e Pix (privado/caixa)
    pronto(pg, 'grupo'); pg.click('[data-a=settings]'); pg.wait_for_timeout(300)
    pg.fill('#cm', '150'); pg.fill('#cd', '30'); pg.fill('#cpx', 'pix-persistencia@teste.com'); pg.click('#dlg [data-a=saveSettings]')
    gravou(pg); pronto(pg)
    pc = J(pg, "S.pc||{}")
    ok(pc.get('mensal') == 150 and pc.get('diaria') == 30 and pc.get('pix') == 'pix-persistencia@teste.com', f'CT-KAN-170-P08: mensalidade, diária e Pix continuam ({pc.get("mensal")}, {pc.get("diaria")})')

    # P09 importar da planilha (jogadores em lote)
    pronto(pg, 'jogadores'); pg.click('[data-a=importarDlg]'); pg.wait_for_timeout(400)
    pg.fill('#impTexto', 'Nome\tNota\nImportado Um\t6\nImportado Dois\t7'); pg.wait_for_timeout(300)
    pg.click('#dlg [data-a=importarJogadores]')
    gravou(pg); pronto(pg, 'jogadores')
    ok(J(pg, "['Importado Um','Importado Dois'].every(n=>Object.values(S.jog).some(p=>p.name===n))"), 'CT-KAN-170-P09: jogadores importados da planilha continuam')

    # P10 presença marcada pela gestão (rodadas/{rid}/presencas)
    pronto(pg, 'rodada')
    bt = pg.locator('[data-a=mark][data-v=in]')
    for i in range(10):
        bt.nth(i).click(); pg.wait_for_timeout(250)
    gravou(pg); pronto(pg, 'rodada'); pg.wait_for_timeout(800)
    n10 = pg.locator('[data-a=mark][data-v=in][aria-pressed=true]').count()
    ok(n10 == 10, f'CT-KAN-170-P10: presenças marcadas pela gestão continuam ({n10} de 10)')

    # P11 presença e avulso pelo link do jogador, sem conta (presencas, avulsos, limites)
    # Com o emulador, o jogador abre num navegador limpo; no modo demonstração, o banco mora no navegador, então na mesma janela.
    EMU = J(pg, "!!window.FIREBASE_EMULADOR")
    pub = novo() if EMU else None; pp = (pub or ctx).new_page()
    pp.goto(URL + '#/p/' + gid); pp.wait_for_selector('[data-a=pubMark]', timeout=20000); pp.wait_for_timeout(800)
    pp.locator('[data-a=pubMark][data-v=out]').last.click(); pp.wait_for_timeout(800)
    pp.click('[data-a=pubAdd]'); pp.wait_for_timeout(300); pp.fill('#anm', 'Avulso Persistente'); pp.click('[data-a=pubSaveAdd]')
    pp.wait_for_timeout(800); pp.evaluate("window.__njPendentes ? window.__njPendentes(10000) : true")
    pp.reload(); pp.wait_for_selector('[data-a=pubMark]', timeout=20000); pp.wait_for_timeout(1200)
    ok('Avulso Persistente' in pp.inner_text('main') and pp.locator('[data-a=pubMark][data-v=out][aria-pressed=true]').count() >= 1,
       'CT-KAN-170-P11: presença e avulso pelo link do jogador continuam depois de recarregar')
    pub.close() if pub else pp.close()

    # P12 sorteio (rodadas/{rid}: times, lista fechada)
    gravou(pg); pronto(pg, 'rodada')
    pg.click('[data-a=drawDlg]'); pg.wait_for_timeout(400); conf(pg)
    pg.click('#drawGo'); pg.wait_for_timeout(2500)
    gravou(pg); pronto(pg, 'rodada'); pg.wait_for_timeout(800)
    ok(pg.locator('.team').count() >= 2, f'CT-KAN-170-P12: times sorteados continuam ({pg.locator(".team").count()} times)')

    # P13 partida salva (rodadas/{rid}/partidas e resumos do mês)
    pronto(pg, 'partida')
    pg.locator('[data-a=goal][data-v=a]').first.click(); pg.wait_for_timeout(200)
    if pg.locator('[data-a=addGoal][data-p]').count(): pg.locator('[data-a=addGoal][data-p]').first.click(); pg.wait_for_timeout(300)
    pg.click('[data-a=saveMatch]')
    gravou(pg); pronto(pg, 'partida'); pg.wait_for_timeout(800)
    ok(pg.locator('[data-a=delMatch]').count() == 1, 'CT-KAN-170-P13: partida salva continua depois de recarregar')

    # P13b partida editada depois de salva (rodadas/{rid}/partidas com versão, resumos do mês) (KAN-176)
    ga13 = J(pg, "Object.values(S.parts||{})[0].ga")
    pg.locator('[data-a=editarPartida]').first.click(); pg.wait_for_timeout(500)
    pg.click('#dlg .ed-mais[data-lado=a]'); pg.wait_for_timeout(200); pg.click('#dlg [data-a=salvarEdicao]')
    gravou(pg); pronto(pg, 'partida'); pg.wait_for_timeout(800)
    m13 = J(pg, "Object.values(S.parts||{})[0]||{}")
    ok(m13.get('ga') == ga13 + 1 and m13.get('ver') == 1, f'CT-KAN-170-P13b: partida editada continua depois de recarregar ({ga13} → {m13.get("ga")}, versão {m13.get("ver")})')

    # P13c artilharia da rodada (rodadas/{rid}/partidas/art: cria e depois edita com versão) (KAN-178)
    pg.click('#artPainel [data-a=abrirArtilharia]'); pg.wait_for_timeout(500)
    art = pg.eval_on_selector('#dlg #artLista li button[data-p]', 'b=>b.dataset.p')
    pg.click(f'#dlg #artLista button[data-p="{art}"]'); pg.wait_for_timeout(100); pg.click(f'#dlg #artLista button[data-p="{art}"]'); pg.wait_for_timeout(100)
    pg.click('#dlg [data-a=salvarArtilharia]')
    gravou(pg); pronto(pg, 'partida'); pg.wait_for_timeout(800)
    g1 = J(pg, "(id)=>((S.parts.art||{}).gols||{})[id]", art)
    pg.click('#artPainel [data-a=abrirArtilharia]'); pg.wait_for_timeout(500)
    pg.click(f'#dlg #artLista button[data-p="{art}"]'); pg.wait_for_timeout(100); pg.click('#dlg [data-a=salvarArtilharia]')
    gravou(pg); pronto(pg, 'partida'); pg.wait_for_timeout(800)
    a13 = J(pg, "(id)=>[((S.parts.art||{}).gols||{})[id], (S.parts.art||{}).ver]", art)
    ok(g1 == 2 and a13 == [3, 1], f'CT-KAN-170-P13c: artilharia lançada e corrigida continua depois de recarregar ({g1} → {a13})')

    # P14 lançamento no caixa (caixa/{id} e resumos do mês)
    pronto(pg, 'caixa'); pg.click('[data-a=addLan]'); pg.wait_for_timeout(300)
    pg.select_option('#lp2', index=1); pg.click('#dlg [data-a=saveLan]')
    gravou(pg); pronto(pg, 'caixa'); pg.wait_for_timeout(800)
    n14 = J(pg, "Object.keys(S.caixa||{}).length")
    ok(n14 >= 1, f'CT-KAN-170-P14: lançamento do caixa continua depois de recarregar ({n14})')

    # P20 isento que recebe por jogo (privado/caixa: tipos e porJogo) e pagamento dos jogos (caixa/{id} com refs) (KAN-172)
    rid20, pid20 = J(pg, """(()=>{for(const [r,d] of Object.entries(S.rod)){if(!d.times)continue;const p=d.times.flatMap(t=>t.players).find(x=>S.jog[x]);if(p)return [r,p]}return [null,null]})()""")
    pronto(pg, 'jogadores'); pg.click(f'[data-a=editPlayer][data-p="{pid20}"]'); pg.wait_for_timeout(300)
    pg.select_option('#ptp', 'isento'); pg.check('#prj'); pg.fill('#prv', '40'); pg.click('#dlg [data-a=savePlayer]')
    gravou(pg); pronto(pg, 'caixa'); pg.wait_for_timeout(1200)
    ok(J(pg, "(id)=>S.pc.tipos[id]==='isento'&&S.pc.porJogo[id].v===40", pid20) and pg.locator(f'#apagarLista [data-a=abrirPagar][data-v="{pid20}"]').count() == 1,
       'CT-KAN-170-P20: tipo isento e "Recebe por jogo" continuam, e o jogo aparece em A pagar')
    pg.click(f'#apagarLista [data-a=abrirPagar][data-v="{pid20}"]'); pg.wait_for_timeout(400); pg.click('#dlg [data-a=pagarJogos]')
    gravou(pg); pronto(pg, 'caixa'); pg.wait_for_timeout(1200)
    ok(J(pg, "(a)=>Object.values(S.caixa).some(l=>l.k==='despesa'&&l.pid===a[0]&&(l.refs||[]).includes(a[1]))", [pid20, rid20])
       and pg.locator(f'#apagarLista [data-a=abrirPagar][data-v="{pid20}"]').count() == 0,
       'CT-KAN-170-P20: pagamento dos jogos continua e o jogo pago não volta para A pagar')

    # P15 votação (votacoes/{vid})
    pronto(pg, 'votacao'); pg.click('[data-a=newVote]'); pg.wait_for_timeout(300); pg.click('#dlg [data-a=saveVote]')
    gravou(pg); pronto(pg, 'votacao'); pg.wait_for_timeout(600)
    n15 = J(pg, "Object.keys(S.vot||{}).length")
    ok(n15 >= 1, f'CT-KAN-170-P15: votação criada continua depois de recarregar ({n15})')

    # P15b voto pelo link da votação, sem conta (votacoes/{vid}/votos)
    vid = J(pg, "S.vid || Object.keys(S.vot||{})[0]")
    pv = (novo() if EMU else None); pvp = (pv or ctx).new_page()
    pvp.goto(URL + '#/p/' + gid + '/v/' + vid); pvp.wait_for_selector('[data-c=voter]', timeout=20000); pvp.wait_for_timeout(600)
    pvp.select_option('[data-c=voter]', index=1); pvp.wait_for_timeout(400)
    pvp.locator('[data-a=pubVote]').first.click(); pvp.wait_for_timeout(1000)
    pvp.evaluate("window.__njPendentes ? window.__njPendentes(10000) : true"); pvp.reload(); pvp.wait_for_timeout(2000)
    ok('Voto registrado' in pvp.inner_text('main'), 'CT-KAN-170-P15b: voto pelo link da votação continua depois de recarregar')
    pv.close() if pv else pvp.close()

    # P15c convite de administrador (privado/convite)
    pronto(pg, 'grupo'); pg.click('[data-a=inviteLink]'); pg.wait_for_timeout(800)
    tk = J(pg, "S.convite&&S.convite.token"); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
    gravou(pg); pronto(pg, 'grupo'); pg.wait_for_timeout(600)
    ok(bool(tk) and J(pg, "S.convite&&S.convite.token") == tk, 'CT-KAN-170-P15c: link de convite de administrador continua depois de recarregar')

    # P16 editar o grupo: nome e moeda (config/app)
    pronto(pg, 'grupo'); pg.click('[data-a=editGroup]'); pg.wait_for_timeout(400)
    pg.fill('#ngn', 'Persistência FC 2'); pg.select_option('#ngm', 'EUR'); pg.click('#dlg [data-a=saveGroup]'); pg.wait_for_timeout(300); conf(pg)
    gravou(pg); pronto(pg)
    ok(pg.inner_text('#gname') == 'Persistência FC 2' and J(pg, "S.app.cfg.moeda") == 'EUR', 'CT-KAN-170-P16: nome e moeda do grupo editados continuam')

    # P17 país da conta trocado pelo menu da conta (usuarios/{uid})
    pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(300); pg.click('.theme-menu [data-a=contaPais]'); pg.wait_for_timeout(400)
    pg.select_option('#cpais', 'US'); pg.click('#dlg [data-a=salvarPaisConta]')
    gravou(pg)
    ok(J(pg, "S.me && S.me.pais") == 'US', 'CT-KAN-170-P17: país da conta trocado continua depois de recarregar')

    # P18 gravação recusada: avisa e a tela volta ao que está gravado (só em modo demonstração, que simula a recusa)
    if not EMU:
        pronto(pg, 'grupo'); pg.evaluate("window.__falharGravacao = true")
        pg.click('[data-a=addPos]'); pg.wait_for_timeout(300); pg.fill('#psg', 'lat'); pg.fill('#pnmx', 'Lateral Fantasma'); pg.click('#dlg [data-a=savePos]')
        pg.wait_for_timeout(1500); aviso = pg.inner_text('#toast'); pg.evaluate("window.__falharGravacao = false"); pg.wait_for_timeout(800)
        ok('Não foi possível salvar' in aviso and 'Lateral Fantasma' not in pg.inner_text('main') and not J(pg, "(S.app.posx||[]).some(p=>p[1]==='Lateral Fantasma')"),
           f'CT-KAN-170-P18: gravação recusada avisa ("{aviso}") e a tela não mostra o que não foi salvo')

    # P19 sair e entrar de novo num navegador limpo: tudo vem do banco
    if EMU:
        ctx.close(); ctx2 = novo(); p2 = ctx2.new_page()
    else:
        pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(300); pg.click('.theme-menu [data-a=logout]'); pg.wait_for_timeout(1500)
        p2 = pg
    p2.on('pageerror', lambda e: errs.append(str(e)))
    p2.goto(URL + '#/entrar'); p2.wait_for_selector('#le', timeout=20000)
    p2.fill('#le', EMAIL); p2.fill('#lp', SENHA); p2.keyboard.press('Enter'); p2.wait_for_timeout(2500)
    p2.goto(URL + '#/g/' + gid); pronto(p2); p2.wait_for_timeout(1500)
    tudo = J(p2, """(()=>({nome:S.app.name,pos:(S.app.posx||[]).some(p=>p[1]==='Volante'),moeda:S.app.cfg.moeda,
      jog:Object.values(S.jog).length,sep:((S.rat||{}).sep||[]).length,pix:(S.pc||{}).pix,pais:S.me&&S.me.pais}))()""")
    ok(tudo['nome'] == 'Persistência FC 2' and tudo['pos'] and tudo['moeda'] == 'EUR' and tudo['jog'] >= 13 and tudo['sep'] >= 2
       and tudo['pix'] == 'pix-persistencia@teste.com' and tudo['pais'] == 'US',
       f'CT-KAN-170-P19: em outro navegador, depois de entrar de novo, tudo vem do banco ({tudo})')

    ok(not errs, 'nenhum erro de JavaScript' + (': ' + '; '.join(errs[:3]) if errs else ''))
    b.close()

n = sum(1 for r in res if r['ok'])
print(f'\n{n} de {len(res)} verificações de gravação passaram.')
json.dump(res, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resultado-persistencia.json'), 'w'), ensure_ascii=False, indent=1)
if GITHUB:
    print(f'::notice::Roteiro de gravação: {n} de {len(res)} passaram.')
sys.exit(0 if n == len(res) else 1)
