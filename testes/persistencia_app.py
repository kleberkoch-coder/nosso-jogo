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
    # KAN-222: a linha é a deste roteiro (não a de dentro do Playwright), e vai junto o estado da última página aberta.
    quadros = [f for f in traceback.extract_tb(tb) if f.filename.endswith('persistencia_app.py')] if tb else []
    linha = quadros[-1].lineno if quadros else '?'
    estado = ''
    try:
        if PAGINAS:
            estado = PAGINAS[-1].evaluate("(()=>{const d=document.getElementById('dlg');return location.hash+' | janela: '+(d&&d.open?(d.innerText||'').replace(/\\s+/g,' ').slice(0,120):'fechada')+' | aviso: '+((document.getElementById('toast')||{}).innerText||'').slice(0,80)})()")
    except Exception:
        pass
    msg = f'roteiro parou na linha {linha} ({tipo.__name__}: {str(valor).splitlines()[0][:200]}); último caso: {ultimo}; tela: {estado}'
    print(('::error::Gravação: ' if GITHUB else 'ERRO    ') + msg, flush=True)
    sys.__excepthook__(tipo, valor, tb)
PAGINAS = []
sys.excepthook = _parou
# KAN-222: quando um clique ou uma espera falha, anota o estado da tela na hora (depois o navegador já fechou).
from playwright.sync_api import Page as _Pagina
def _com_estado(nome):
    orig = getattr(_Pagina, nome)
    def f(self, *a, **k):
        try:
            return orig(self, *a, **k)
        except Exception:
            try:
                e = self.evaluate("(()=>{const d=document.getElementById('dlg');return location.hash+' | janela: '+(d&&d.open?(d.innerText||'').replace(/\\s+/g,' ').slice(0,160):'fechada')+' | aviso: '+((document.getElementById('toast')||{}).innerText||'').slice(0,80)})()")
                print(('::error::Gravação: ' if GITHUB else 'ERRO    ') + f'{nome}({str(a[0])[:60] if a else ""}) falhou; tela: {e}', flush=True)
            except Exception:
                pass
            raise
    setattr(_Pagina, nome, f)
for _n in ('click', 'wait_for_selector', 'wait_for_function', 'fill'):
    _com_estado(_n)
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

def sair_e_esperar(pg):
    """Sair pelo menu da conta. Com gravação ainda a caminho, o app pergunta antes (confirma); depois a página
    recarrega: espera a recarga terminar antes de seguir, senão o que for digitado é apagado no meio."""
    pg.click('#topright [data-a=contaMenu]'); pg.wait_for_timeout(300); pg.click('.theme-menu [data-a=logout]')
    try:
        pg.wait_for_selector('#dlg .conf [data-a=confSim]', timeout=2000)
        pg.click('#dlg .conf [data-a=confSim]')
    except Exception:
        pass
    try:
        pg.wait_for_url('**#/', timeout=15000)
    except Exception:
        pass
    pg.wait_for_load_state('load'); pg.wait_for_timeout(1000)

EMAIL, SENHA = 'persistencia@teste.com', 'Jogo@2026'
J = lambda pg, js, arg=None: pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    def novo():
        c = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', timezone_id='America/Sao_Paulo')
        c.on('page', lambda p: PAGINAS.append(p))
        return c
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

    # P22 vagas para diaristas e avulsos (KAN-63): controle no grupo (cfg.vagasCtrl), marca nos diaristas (jogadores.vaga),
    # vagas abertas na rodada (rodadas/{rid}.vagas) e diarista que entra pelo link ocupando uma vaga (limites/vagas)
    pronto(pg, 'rodada'); pg.click('#porPosicao [data-a=abrirMinimos]'); pg.wait_for_timeout(400)
    pg.check('#vagasCtrl'); pg.click('#dlg [data-a=salvarMinimos]'); pg.wait_for_timeout(1500)
    pg.click('#vagasPainel [data-a=abrirVagas]'); pg.wait_for_timeout(400); pg.fill('#vagasN', '2'); pg.click('#dlg [data-a=salvarVagas]')
    gravou(pg); pronto(pg, 'rodada')
    dia = J(pg, "Object.keys(S.jog).filter(id=>(S.pc.tipos||{})[id]==='diarista'&&!(S.pres[id]&&S.pres[id].s==='in'))")
    marcados = J(pg, "Object.keys(S.jog).filter(id=>S.jog[id].vaga).length"); diaristas = J(pg, "Object.keys(S.jog).filter(id=>(S.pc.tipos||{})[id]==='diarista').length")
    vg = J(pg, "JSON.stringify((S.rod[S.presRid]||{}).vagas||null)")
    ok(J(pg, "S.app.cfg.vagasCtrl===true") and marcados == diaristas and diaristas > 0 and vg == '{"aberta":true,"max":2}',
       f'CT-KAN-170-P22: controle de vagas, marca dos diaristas ({marcados} de {diaristas}) e vagas abertas ({vg}) continuam')
    pub = novo() if EMU else None; pp = (pub or ctx).new_page()
    pp.goto(URL + '#/p/' + gid); pp.wait_for_selector('[data-a=pubMark]', timeout=20000); pp.wait_for_timeout(1200)
    pp.click(f'[data-a=pubMark][data-v=in][data-p="{dia[0]}"]'); pp.wait_for_timeout(800); pp.evaluate("window.__njPendentes ? window.__njPendentes(10000) : true")
    pub.close() if pub else pp.close()
    gravou(pg); pronto(pg, 'rodada')
    ok((J(pg, "(S.pres[%r]||{}).s" % dia[0]) == 'in') and J(pg, "(S.limVg||{}).n") == 1, 'CT-KAN-170-P22: diarista que entrou pelo link ocupa 1 vaga e continua depois de recarregar')

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

    # P14 lançamento no caixa (caixa/{id} e resumosCaixa do mês, KAN-207)
    pronto(pg, 'caixa'); pg.click('[data-a=addLan]'); pg.wait_for_timeout(300)
    pg.select_option('#lp2', index=1); pg.click('#dlg [data-a=saveLan]')
    gravou(pg); pronto(pg, 'caixa'); pg.wait_for_timeout(800)
    n14 = J(pg, "Object.keys(S.caixa||{}).length")
    ok(n14 >= 1, f'CT-KAN-170-P14: lançamento do caixa continua depois de recarregar ({n14})')
    ok(J(pg, "Object.values(S.resCx||{}).some(d=>d.cx&&(d.cx.ent||d.cx.sai))"), 'CT-KAN-170-P14: o total do caixa do mês (resumosCaixa) continua depois de recarregar')

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
    # P15b (KAN-222): a troca do voto (votacoes/{vid}/trocas) chega ao administrador com a hora do servidor
    pg.reload(); pronto(pg, 'votacao'); pg.wait_for_function("S.trocas && Object.keys(S.trocas).length >= 1", timeout=20000)
    em15 = J(pg, "Object.values(S.trocas).map(t=>t.em&&(t.em.toMillis?t.em.toMillis():t.em))[0]")
    pg.click('#quemVotou > summary'); pg.wait_for_selector('#quemVotou .aud-linha', timeout=10000)
    t15 = pg.inner_text('#quemVotou')
    ok(isinstance(em15, (int, float)) and em15 > 0 and 'Quem votou (1)' in t15 and 'hora do aparelho' not in t15,
       f'CT-KAN-222-P15b: a troca do voto fica gravada com a hora do servidor e aparece em "Quem votou" ({em15}, {t15[:80]!r})')

    # P15c convite de administrador (privado/convite)
    pronto(pg, 'grupo'); pg.click('[data-a=inviteLink]'); pg.wait_for_timeout(800)
    tk = J(pg, "S.convite&&S.convite.token"); pg.click('#dlg [data-a=close]'); pg.wait_for_timeout(200)
    gravou(pg); pronto(pg, 'grupo'); pg.wait_for_timeout(600)
    ok(bool(tk) and J(pg, "S.convite&&S.convite.token") == tk, 'CT-KAN-170-P15c: link de convite de administrador continua depois de recarregar')

    # P21 mínimo para o jogo: total e por posição, um mapa dentro de cfg (config/app, KAN-179)
    pronto(pg, 'rodada'); pg.click('#porPosicao [data-a=abrirMinimos]'); pg.wait_for_timeout(400)
    pg.fill('#minRaiz .minp[data-k="_total"]', '12'); pg.fill('#minRaiz .minp[data-k="GOL"]', '2'); pg.click('#dlg [data-a=salvarMinimos]')
    gravou(pg); pronto(pg, 'rodada')
    ok(J(pg, "JSON.stringify(S.app.cfg.minPos)") == '{"GOL":2,"_total":12}' and 'de 2' in pg.inner_text('#porPosicao'), 'CT-KAN-170-P21: mínimo para o jogo (total e por posição) continua depois de recarregar')

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
        sair_e_esperar(pg)
        p2 = pg
    p2.on('pageerror', lambda e: errs.append(str(e)))
    p2.goto(URL + '#/entrar'); p2.wait_for_selector('#le', timeout=20000); p2.wait_for_timeout(300)
    p2.fill('#le', EMAIL); p2.fill('#lp', SENHA); p2.keyboard.press('Enter'); p2.wait_for_timeout(2500)
    p2.goto(URL + '#/g/' + gid); pronto(p2); p2.wait_for_timeout(1500)
    tudo = J(p2, """(()=>({nome:S.app.name,pos:(S.app.posx||[]).some(p=>p[1]==='Volante'),moeda:S.app.cfg.moeda,
      jog:Object.values(S.jog).length,sep:((S.rat||{}).sep||[]).length,pix:(S.pc||{}).pix,pais:S.me&&S.me.pais}))()""")
    ok(tudo['nome'] == 'Persistência FC 2' and tudo['pos'] and tudo['moeda'] == 'EUR' and tudo['jog'] >= 13 and tudo['sep'] >= 2
       and tudo['pix'] == 'pix-persistencia@teste.com' and tudo['pais'] == 'US',
       f'CT-KAN-170-P19: em outro navegador, depois de entrar de novo, tudo vem do banco ({tudo})')

    # P23 relógio de 12h (KAN-163): grupo dos EUA com dia fixo 7:00–9:00 PM e rodada às 7:30 PM. O banco guarda 24h
    # (19:00, 21:00, 19:30); a tela mostra 12h depois de recarregar e depois de sair e entrar de novo (config/app, rodadas)
    c23 = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', timezone_id='America/New_York'); p23 = c23.new_page()
    p23.on('pageerror', lambda e: errs.append(str(e)))
    E23 = 'relogio12@teste.com'
    p23.goto(URL + '#/criar'); p23.wait_for_function("document.querySelector('#lpais') && document.querySelector('#lpais').options.length > 10", timeout=20000)
    p23.select_option('#lpais', 'US'); p23.fill('#le', E23); p23.fill('#lp', SENHA); p23.fill('#lp2', SENHA); p23.wait_for_timeout(200)
    p23.click('[data-a=signup]'); p23.wait_for_selector('#ngn', timeout=20000)
    r23 = '#sched .srow:nth-child(1)'
    p23.fill(f'{r23} [data-hora]:has(.si) .hh', '7'); p23.fill(f'{r23} [data-hora]:has(.sf) .hh', '9')
    p23.fill('#ngn', 'Relógio FC'); p23.click('[data-a=createGroup]')
    p23.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g23 = p23.url.split('#/g/')[1].split('/')[0]
    pronto(p23); p23.click('[data-a=newRod]'); p23.wait_for_timeout(400)
    h23 = '#dlg [data-hora]:has(#rtm)'
    p23.fill('#rdt', '2031-06-07'); p23.fill(h23 + ' .hh', '7'); p23.fill(h23 + ' .hm', '30')
    if p23.inner_text(h23 + ' .hap') != 'PM': p23.click(h23 + ' .hap')
    p23.click('#dlg [data-a=saveRod]'); p23.wait_for_timeout(800)
    gravou(p23); pronto(p23, 'grupo')
    def ver23(pg_):
        return J(pg_, "(()=>({f:(S.app.cfg.fixos||[])[0]||{},t:Object.values(S.rod||{}).map(r=>r.time)}))()"), pg_.inner_text('main')
    d23, t23 = ver23(p23)
    ok(d23['f'].get('ini') == '19:00' and d23['f'].get('fim') == '21:00' and '19:30' in d23['t'] and '7:00–9:00 PM' in t23,
       f'CT-KAN-170-P23: grupo dos EUA guarda 19:00–21:00 e 19:30 e mostra 7:00–9:00 PM depois de recarregar ({d23})')
    sair_e_esperar(p23)
    p23.goto(URL + '#/entrar'); p23.wait_for_selector('#le', timeout=20000); p23.wait_for_timeout(300)
    p23.fill('#le', E23); p23.fill('#lp', SENHA); p23.keyboard.press('Enter'); p23.wait_for_timeout(2500)
    p23.goto(URL + '#/g/' + g23); pronto(p23, 'grupo'); p23.wait_for_timeout(800)
    d23b, t23b = ver23(p23)
    ok(d23b['f'].get('ini') == '19:00' and '7:00–9:00 PM' in t23b, 'CT-KAN-170-P23: depois de sair e entrar de novo, continua 7:00–9:00 PM (19:00 no banco)')
    c23.close()

    # P24 planos (KAN-119): grupo novo entra na lista de grupos ativos da conta (contas/{uid}.ativos); inativar e
    # reativar mudam o grupo e a lista na mesma gravação (as regras do Firebase conferem as duas juntas).
    c24 = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); p24 = c24.new_page()
    p24.on('pageerror', lambda e: errs.append(str(e)))
    E24 = 'planos24@teste.com'
    p24.goto(URL + '#/criar'); p24.wait_for_selector('#le', timeout=20000); p24.wait_for_timeout(300)
    p24.fill('#le', E24); p24.fill('#lp', SENHA); p24.fill('#lp2', SENHA); p24.wait_for_timeout(200)
    p24.click('[data-a=signup]'); p24.wait_for_selector('#ngn', timeout=20000)
    p24.fill('#ngn', 'Planos FC'); p24.click('[data-a=createGroup]')
    p24.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g24 = p24.url.split('#/g/')[1].split('/')[0]
    gravou(p24); pronto(p24)
    p24.wait_for_function("S.loaded.conta", timeout=20000)
    ok(J(p24, "(S.conta&&S.conta.ativos)||[]") == [g24], 'CT-KAN-170-P24: o grupo novo fica na lista de grupos ativos da conta, depois de recarregar')
    pronto(p24, 'grupo')
    p24.click('#grupoRaiz [data-a=toggleAtivo]'); conf(p24); p24.wait_for_timeout(800)
    gravou(p24); pronto(p24); p24.wait_for_function("S.loaded.conta", timeout=20000)
    ok(J(p24, "S.app.ativo") is False and J(p24, "(S.conta&&S.conta.ativos)||[]") == [], 'CT-KAN-170-P24: inativar grava o grupo inativo e tira da lista, depois de recarregar')
    p24.click('.inbar [data-a=toggleAtivo]'); p24.wait_for_timeout(800)
    sair_e_esperar(p24)
    p24.goto(URL + '#/entrar'); p24.wait_for_selector('#le', timeout=20000); p24.wait_for_timeout(300)
    p24.fill('#le', E24); p24.fill('#lp', SENHA); p24.keyboard.press('Enter'); p24.wait_for_timeout(2500)
    p24.goto(URL + '#/g/' + g24); pronto(p24); p24.wait_for_function("S.loaded.conta", timeout=20000)
    ok(J(p24, "S.app.ativo!==false") and J(p24, "(S.conta&&S.conta.ativos)||[]") == [g24], 'CT-KAN-170-P24: reativar volta o grupo para a lista, depois de sair e entrar de novo')
    c24.close()

    # P25 permissões e lista de convidados (KAN-201, KAN-204): o convidado entra na lista do grupo (grupos/{gid}.adms) com
    # tudo desligado (membros/{uid}.perm); o organizador libera Notas e isso continua depois de recarregar.
    # No emulador (dois aparelhos ao mesmo tempo), confere também que liberar e tirar vale NA HORA para o convidado.
    c25 = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); p25 = c25.new_page()
    p25.on('pageerror', lambda e: errs.append(str(e)))
    D25, C25 = 'dono25@teste.com', 'conv25@teste.com'
    def entrar25(pg_, email, criar, url):
        pg_.goto(url); pg_.wait_for_selector('#le', timeout=20000); pg_.wait_for_timeout(300)
        modo = 'signup' if criar else 'login'
        if pg_.locator(f'#authRaiz [data-a=authMode][data-v={modo}]').count():
            pg_.click(f'#authRaiz [data-a=authMode][data-v={modo}]'); pg_.wait_for_timeout(200)
        pg_.fill('#le', email); pg_.fill('#lp', SENHA)
        if criar and pg_.locator('#lp2').count(): pg_.fill('#lp2', SENHA)
        pg_.keyboard.press('Enter'); pg_.wait_for_timeout(2500)
    entrar25(p25, D25, True, URL + '#/criar'); p25.wait_for_selector('#ngn', timeout=20000)
    p25.fill('#ngn', 'Permissões FC'); p25.click('[data-a=createGroup]')
    p25.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g25 = p25.url.split('#/g/')[1].split('/')[0]
    pronto(p25, 'grupo'); p25.click('[data-a=inviteLink]'); p25.wait_for_timeout(800)
    tk25 = J(p25, "S.convite&&S.convite.token"); p25.click('#dlg [data-a=close]'); p25.wait_for_timeout(200)
    gravou(p25)
    EMU = bool(J(p25, "!!window.FIREBASE_EMULADOR"))
    if EMU:
        c25b = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); q25 = c25b.new_page()
        q25.on('pageerror', lambda e: errs.append(str(e)))
    else:
        sair_e_esperar(p25); q25 = p25
    entrar25(q25, C25, True, URL + '#/convite/' + g25 + '/' + str(tk25))
    q25.click('[data-a=acceptInv]'); q25.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    gravou(q25); pronto(q25)
    uc25 = J(q25, "S.user.uid")
    ok(J(q25, "S.mem&&S.mem.perm") == {'caixa': False, 'notas': False, 'elenco': False, 'config': False} and J(q25, "S.app.adms") == [uc25],
       'CT-KAN-170-P25: o convidado entra só com o dia a dia e na lista de convidados do grupo, depois de recarregar')
    if not EMU:
        sair_e_esperar(p25); entrar25(p25, D25, False, URL + '#/entrar')
        p25.goto(URL + '#/g/' + g25); pronto(p25)
    else:
        p25.reload(); pronto(p25)
    pronto(p25, 'grupo')
    def perm25(liga):
        p25.click(f'#grupoRaiz [data-a=abrirPerm][data-v="{uc25}"]'); p25.wait_for_timeout(500)
        (p25.check if liga else p25.uncheck)('#perm_notas'); p25.click('#dlg [data-a=salvarPerm]'); p25.wait_for_timeout(1200)
    perm25(True)
    if EMU:
        try:
            q25.wait_for_function("S.mem&&S.mem.perm&&S.mem.perm.notas===true", timeout=10000); na_hora = True
        except Exception:
            na_hora = False
        ok(na_hora, 'CT-KAN-201-06: liberar Notas vale na hora no aparelho do convidado, sem sair e entrar (emulador)')
        perm25(False)
        try:
            q25.wait_for_function("S.mem&&S.mem.perm&&S.mem.perm.notas===false", timeout=10000); tirou = True
        except Exception:
            tirou = False
        ok(tirou, 'CT-KAN-201-07: tirar Notas também vale na hora (emulador)')
        perm25(True)
    gravou(p25); pronto(p25)
    ok(J(p25, "(u)=>S.membros[u]&&S.membros[u].perm", uc25) == {'caixa': False, 'notas': True, 'elenco': False, 'config': False},
       'CT-KAN-170-P25: a permissão liberada pelo organizador continua depois de recarregar')
    if EMU: c25b.close()
    c25.close()

    # P26 afastamento (KAN-208): o afastamento fica em privado/afast e o "não cobrar" em privado/caixa.afIsen, gravados no
    # mesmo lote; "Voltou" fecha o afastamento no mês anterior nos dois. Confere depois de recarregar e de sair e entrar.
    c26 = novo(); p26 = c26.new_page()
    p26.on('pageerror', lambda e: errs.append(str(e)))
    E26 = 'afast26@teste.com'
    p26.goto(URL + '#/criar'); p26.wait_for_selector('#le', timeout=20000); p26.wait_for_timeout(300)
    p26.fill('#le', E26); p26.fill('#lp', SENHA); p26.fill('#lp2', SENHA); p26.wait_for_timeout(200)
    p26.click('[data-a=signup]'); p26.wait_for_selector('#ngn', timeout=20000)
    p26.fill('#ngn', 'Afastamento FC'); p26.click('[data-a=createGroup]')
    p26.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g26 = p26.url.split('#/g/')[1].split('/')[0]
    pronto(p26, 'jogadores'); p26.click('[data-a=seed]'); p26.wait_for_timeout(1500)
    gravou(p26); pronto(p26, 'jogadores'); p26.wait_for_function("S.loaded.pc && S.loaded.af", timeout=20000)
    j26 = J(p26, "Object.keys(S.jog).find(id=>!['diarista','isento'].includes(((S.pc||{}).tipos||{})[id]||'mensalista'))")
    mes26 = J(p26, "(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})()")
    ant26 = J(p26, "(()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})()")
    p26.click(f'[data-a=editPlayer][data-p="{j26}"]'); p26.wait_for_timeout(400)
    p26.click('#dlg [data-a=afastarDlg]'); p26.wait_for_selector('#afMot', timeout=10000)
    p26.select_option('#afMot', 'lesao'); p26.fill('#afObs', 'cirurgia'); p26.select_option('#afDe', ant26); p26.select_option('#afAte', '')
    p26.check('input[name=afCobra][value=nao]'); p26.click('#dlg [data-a=afSalvar]'); p26.wait_for_timeout(800)
    gravou(p26); pronto(p26, 'jogadores'); p26.wait_for_function("S.loaded.pc && S.loaded.af", timeout=20000)
    a26 = J(p26, "(p)=>{const e=Object.entries(S.af||{}).find(([,a])=>a&&a.pid===p);if(!e)return null;return {aid:e[0],a:e[1],i:((S.pc||{}).afIsen||{})[e[0]]||null}}", j26)
    ok(bool(a26) and a26['a'].get('mot') == 'lesao' and a26['a'].get('obs') == 'cirurgia' and a26['a'].get('de') == ant26 and not a26['a'].get('ate')
       and a26['i'] == {'pid': j26, 'de': ant26, 'ate': ''},
       f'CT-KAN-170-P26: afastamento (motivo, início, até voltar) e "não cobrar" continuam depois de recarregar ({a26})')
    p26.click(f'[data-a=editPlayer][data-p="{j26}"]'); p26.wait_for_timeout(400)
    p26.click('#dlg [data-a=afastarDlg]'); p26.wait_for_selector('#afMot', timeout=10000)
    p26.click('#dlg [data-a=afVoltou]'); p26.wait_for_timeout(800)
    sair_e_esperar(p26)
    p26.goto(URL + '#/entrar'); p26.wait_for_selector('#le', timeout=20000); p26.wait_for_timeout(300)
    p26.fill('#le', E26); p26.fill('#lp', SENHA); p26.keyboard.press('Enter'); p26.wait_for_timeout(2500)
    p26.goto(URL + '#/g/' + g26); pronto(p26, 'jogadores'); p26.wait_for_function("S.loaded.pc && S.loaded.af", timeout=20000)
    b26 = J(p26, "(aid)=>[(S.af[aid]||{}).ate||null, (((S.pc||{}).afIsen||{})[aid]||{}).ate||null]", a26['aid'] if a26 else '')
    ok(b26 == [ant26, ant26], f'CT-KAN-170-P26: "Voltou" fecha o afastamento e a isenção no mês anterior, depois de sair e entrar ({b26}, esperado {ant26})')
    c26.close()

    # P27 ciclo da mensalidade (KAN-209): o dia de início fica em privado/caixa.ciclo; "Mensalidade de qual mês" com dois
    # meses grava dois lançamentos (ref de cada mês, mesma data). Confere depois de recarregar e de sair e entrar.
    c27 = novo(); p27 = c27.new_page()
    p27.on('pageerror', lambda e: errs.append(str(e)))
    E27 = 'ciclo27@teste.com'
    p27.goto(URL + '#/criar'); p27.wait_for_selector('#le', timeout=20000); p27.wait_for_timeout(300)
    p27.fill('#le', E27); p27.fill('#lp', SENHA); p27.fill('#lp2', SENHA); p27.wait_for_timeout(200)
    p27.click('[data-a=signup]'); p27.wait_for_selector('#ngn', timeout=20000)
    p27.fill('#ngn', 'Ciclo FC'); p27.click('[data-a=createGroup]')
    p27.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g27 = p27.url.split('#/g/')[1].split('/')[0]
    pronto(p27, 'jogadores'); p27.click('[data-a=seed]'); p27.wait_for_timeout(1500)
    pronto(p27, 'grupo'); p27.click('[data-a=settings]'); p27.wait_for_selector('#cdia', timeout=10000)
    p27.fill('#cm', '85'); p27.select_option('#cdia', '20'); p27.wait_for_timeout(200)
    p27.check('input[name=cdiaQuando][value=atual]'); p27.click('#dlg [data-a=saveSettings]'); p27.wait_for_timeout(800)
    gravou(p27); pronto(p27, 'caixa'); p27.wait_for_function("S.loaded.pc", timeout=20000)
    comp27 = J(p27, "(()=>{const d=new Date();if(d.getDate()<20)d.setMonth(d.getMonth()-1,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})()")
    ant27 = J(p27, "(c)=>{const [a,m]=c.split('-').map(Number);const d=new Date(a,m-2,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}", comp27)
    cic27 = J(p27, "(S.pc&&S.pc.ciclo)||null")
    ok(cic27 == [{'desde': comp27, 'dia': 20}] and J(p27, "S.pc.mensal") == 85,
       f'CT-KAN-170-P27: o dia em que começa o mês da mensalidade (20, já na atual) continua depois de recarregar ({cic27})')
    j27 = J(p27, "Object.keys(S.jog).find(id=>!['diarista','isento'].includes(((S.pc||{}).tipos||{})[id]||'mensalista'))")
    p27.click('[data-a=addLan]'); p27.wait_for_selector('#lanMeses', timeout=10000)
    p27.select_option('#lp2', j27); p27.locator(f'#lanMeses .chk-linha:has(.lm[value="{ant27}"]) span').click(); p27.wait_for_timeout(150)
    p27.click('#dlg [data-a=saveLan]'); p27.wait_for_timeout(1000)
    sair_e_esperar(p27)
    p27.goto(URL + '#/entrar'); p27.wait_for_selector('#le', timeout=20000); p27.wait_for_timeout(300)
    p27.fill('#le', E27); p27.fill('#lp', SENHA); p27.keyboard.press('Enter'); p27.wait_for_timeout(2500)
    p27.goto(URL + '#/g/' + g27); pronto(p27, 'caixa'); p27.wait_for_function("S.loaded.pc", timeout=20000); p27.wait_for_timeout(1200)
    l27 = J(p27, "(p)=>Object.values(S.caixa||{}).filter(l=>l&&l.pid===p&&l.k==='mensal').map(l=>[l.ref,l.v]).sort()", j27)
    ok(l27 == sorted([[ant27, 85], [comp27, 85]]), f'CT-KAN-170-P27: dois meses de mensalidade num lançamento só viram dois lançamentos, depois de sair e entrar ({l27})')
    c27.close()

    # P28 quadro do ano (KAN-212): "Recebi" no Quadro do ano grava a mensalidade da competência e soma no resumo por
    # jogador (resumosCaixa/{mês}.mens). Confere depois de sair e entrar: a célula continua Paga.
    c28 = novo(); p28 = c28.new_page()
    p28.on('pageerror', lambda e: errs.append(str(e)))
    E28 = 'quadro28@teste.com'
    p28.goto(URL + '#/criar'); p28.wait_for_selector('#le', timeout=20000); p28.wait_for_timeout(300)
    p28.fill('#le', E28); p28.fill('#lp', SENHA); p28.fill('#lp2', SENHA); p28.wait_for_timeout(200)
    p28.click('[data-a=signup]'); p28.wait_for_selector('#ngn', timeout=20000)
    p28.fill('#ngn', 'Quadro FC'); p28.click('[data-a=createGroup]')
    p28.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g28 = p28.url.split('#/g/')[1].split('/')[0]
    pronto(p28, 'jogadores'); p28.click('[data-a=seed]'); p28.wait_for_timeout(1500)
    pronto(p28, 'grupo'); p28.click('[data-a=settings]'); p28.wait_for_selector('#cm', timeout=10000)
    p28.fill('#cm', '85'); p28.click('#dlg [data-a=saveSettings]'); p28.wait_for_timeout(800)
    gravou(p28); pronto(p28, 'caixa'); p28.wait_for_function("S.loaded.pc", timeout=20000)
    p28.click('#quadroAno > summary'); p28.wait_for_selector('#quadroTab [data-a=payMes]', timeout=20000)
    alvo28 = p28.locator('#quadroTab [data-a=payMes]').first
    j28, m28 = alvo28.get_attribute('data-p'), alvo28.get_attribute('data-v')
    alvo28.click(); p28.wait_for_function("(a)=>{const i=Number(a[1].slice(5))-1;const c=[...document.querySelectorAll(`#quadroTab tr[data-pid=\"${a[0]}\"] td`)][i];return c&&c.className==='q-pago'}", arg=[j28, m28], timeout=20000); gravou(p28)
    sair_e_esperar(p28)
    p28.goto(URL + '#/entrar'); p28.wait_for_selector('#le', timeout=20000); p28.wait_for_timeout(300)
    p28.fill('#le', E28); p28.fill('#lp', SENHA); p28.keyboard.press('Enter'); p28.wait_for_function("window.S && S.user && !S.user.anon", timeout=20000)
    p28.goto(URL + '#/g/' + g28); pronto(p28, 'caixa'); p28.wait_for_function("S.loaded.pc && S.resCx", timeout=20000); p28.wait_for_timeout(1200)
    r28 = J(p28, "(a)=>((S.resCx[a[1]]||{}).mens||{})[a[0]]||0", [j28, m28])
    l28 = J(p28, "(a)=>Object.values(S.caixa||{}).filter(l=>l&&l.pid===a[0]&&l.k==='mensal').map(l=>[l.ref,l.v])", [j28, m28])
    if not p28.locator('#quadroTab').count():
        p28.click('#quadroAno > summary'); p28.wait_for_selector('#quadroTab', timeout=20000)
    cel28 = J(p28, "(a)=>{const b=[...document.querySelectorAll(`#quadroTab tr[data-pid=\"${a[0]}\"] td`)];const i=Number(a[1].slice(5))-1;return b[i]?b[i].className:null}", [j28, m28])
    ok(r28 == 8500 and l28 == [[m28, 85]] and cel28 == 'q-pago',
       f'CT-KAN-170-P28: "Recebi" no Quadro do ano grava a mensalidade e o resumo por jogador, e a célula segue Paga depois de sair e entrar ({r28}, {l28}, {cel28})')
    c28.close()

    # P29 rateio (KAN-213): criar um rateio, "Recebi" de um participante e "Encerrar". Confere depois de sair e entrar:
    # o rateio (privado/caixa.rat), o pagamento (rat.pg) e a entrada ligada (caixa, com rat).
    c29 = novo(); p29 = c29.new_page()
    p29.on('pageerror', lambda e: errs.append(str(e)))
    E29 = 'rateio29@teste.com'
    p29.goto(URL + '#/criar'); p29.wait_for_selector('#le', timeout=20000); p29.wait_for_timeout(300)
    p29.fill('#le', E29); p29.fill('#lp', SENHA); p29.fill('#lp2', SENHA); p29.wait_for_timeout(200)
    p29.click('[data-a=signup]'); p29.wait_for_selector('#ngn', timeout=20000)
    p29.fill('#ngn', 'Rateio FC'); p29.click('[data-a=createGroup]')
    p29.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g29 = p29.url.split('#/g/')[1].split('/')[0]
    pronto(p29, 'jogadores'); p29.click('[data-a=seed]'); p29.wait_for_timeout(1500)
    gravou(p29); pronto(p29, 'caixa'); p29.wait_for_function("S.loaded.pc", timeout=20000)
    p29.click('[data-a=ratNovo]'); p29.wait_for_selector('#rtn', timeout=10000)
    p29.fill('#rtn', 'Bola nova'); p29.fill('#rtv', '300')
    ids29 = J(p29, "[...document.querySelectorAll('#rtPart .rtp')].map(x=>x.value)")[:3]
    for pid in ids29:
        p29.locator(f'#rtPart .rat-linha:has(.rtp[value="{pid}"]) .chk-linha span').click(); p29.wait_for_timeout(60)
    p29.click('#dlg [data-a=ratSalvar]'); p29.wait_for_timeout(1000)
    rid29 = J(p29, "Object.keys((S.pc||{}).rat||{})[0]")
    p29.click(f'#rat-{rid29} [data-a=ratRecebi][data-p="{ids29[0]}"]'); p29.wait_for_timeout(1000)
    p29.click(f'#rat-{rid29} [data-a=ratEncerrar]'); p29.wait_for_timeout(300)
    if p29.locator('#dlg .conf [data-a=confSim]').count(): p29.click('#dlg .conf [data-a=confSim]')
    p29.wait_for_timeout(1000); gravou(p29)
    sair_e_esperar(p29)
    p29.goto(URL + '#/entrar'); p29.wait_for_selector('#le', timeout=20000); p29.wait_for_timeout(300)
    p29.fill('#le', E29); p29.fill('#lp', SENHA); p29.keyboard.press('Enter'); p29.wait_for_timeout(2500)
    p29.goto(URL + '#/g/' + g29); pronto(p29, 'caixa'); p29.wait_for_function("S.loaded.pc", timeout=20000); p29.wait_for_timeout(1200)
    r29 = J(p29, "(r)=>{const x=((S.pc||{}).rat||{})[r];return x?[x.n,x.part,x.pg||{},!!x.fim,!!x.pend]:null}", rid29)
    l29 = J(p29, "(r)=>Object.values(S.caixa||{}).filter(l=>l&&l.rat===r).map(l=>[l.k,l.pid,l.v])", rid29)
    ok(r29 and r29[0] == 'Bola nova' and r29[1] == {ids29[0]: 10000, ids29[1]: 10000, ids29[2]: 10000} and r29[2] == {ids29[0]: 10000} and r29[3] and r29[4]
       and l29 == [['entrada', ids29[0], 100]],
       f'CT-KAN-170-P29: rateio, pagamento e encerramento continuam depois de sair e entrar ({r29}, {l29})')
    c29.close()

    # P30 avaliação por link (KAN-214): criar a avaliação, dar as minhas notas pelo app e atualizar o cadastro pelo
    # resultado. Confere depois de sair e entrar: a avaliação, as notas dadas e a nota nova do jogador.
    c30 = novo(); p30 = c30.new_page()
    p30.on('pageerror', lambda e: errs.append(str(e)))
    E30 = 'aval30@teste.com'
    p30.goto(URL + '#/criar'); p30.wait_for_selector('#le', timeout=20000); p30.wait_for_timeout(300)
    p30.fill('#le', E30); p30.fill('#lp', SENHA); p30.fill('#lp2', SENHA); p30.wait_for_timeout(200)
    p30.click('[data-a=signup]'); p30.wait_for_selector('#ngn', timeout=20000)
    p30.fill('#ngn', 'Notas FC'); p30.click('[data-a=createGroup]')
    p30.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g30 = p30.url.split('#/g/')[1].split('/')[0]
    pronto(p30, 'jogadores'); p30.click('[data-a=seed]'); p30.wait_for_timeout(1500); gravou(p30)
    pronto(p30, 'jogadores'); p30.click('[data-a=avAbrir]'); p30.wait_for_selector('[data-a=avNova]', timeout=20000)
    p30.click('[data-a=avNova]'); p30.wait_for_selector('#avT', timeout=10000)
    p30.click('#dlg [data-a=avCriar]'); p30.wait_for_selector('#shtxt', timeout=10000)
    link30 = p30.input_value('#shtxt'); aid30 = link30.split('/a/')[1].split()[0].strip()
    p30.click('#dlg [data-a=close]'); p30.wait_for_timeout(1500); gravou(p30)
    pronto(p30, 'jogadores'); p30.click('[data-a=avAbrir]'); p30.wait_for_selector(f'[data-a=avMinhas][data-v="{aid30}"]', timeout=20000)
    p30.click(f'[data-a=avMinhas][data-v="{aid30}"]'); p30.wait_for_selector('#avLista', timeout=20000)
    j30 = J(p30, "[...document.querySelectorAll('#avLista .aval-nota')].map(x=>x.dataset.p)")[:2]
    p30.select_option(f'#avLista .aval-nota[data-p="{j30[0]}"]', '8.5'); p30.select_option(f'#avLista .aval-nota[data-p="{j30[1]}"]', '3')
    p30.click('#dlg [data-a=avEnviar]'); p30.wait_for_timeout(1500); gravou(p30)
    pronto(p30, 'jogadores'); p30.click('[data-a=avAbrir]'); p30.wait_for_selector(f'[data-a=avResultado][data-v="{aid30}"]', timeout=20000)
    p30.click(f'[data-a=avResultado][data-v="{aid30}"]'); p30.wait_for_selector('#avRes', timeout=20000)
    p30.fill(f'#avRes tr[data-pid="{j30[0]}"] .aval-nova', '8.5'); p30.wait_for_timeout(150)
    p30.click('#dlg [data-a=avAplicar]'); p30.wait_for_timeout(1500); gravou(p30)
    sair_e_esperar(p30)
    p30.goto(URL + '#/entrar'); p30.wait_for_selector('#le', timeout=20000); p30.wait_for_timeout(300)
    p30.fill('#le', E30); p30.fill('#lp', SENHA); p30.keyboard.press('Enter'); p30.wait_for_timeout(2500)
    p30.goto(URL + '#/g/' + g30); pronto(p30, 'jogadores'); p30.wait_for_timeout(1200)
    nv30 = J(p30, "(i)=>((S.rat||{}).nivel||{})[i]", j30[0])
    p30.click('[data-a=avAbrir]'); p30.wait_for_selector(f'[data-a=avResultado][data-v="{aid30}"]', timeout=20000)
    p30.click(f'[data-a=avResultado][data-v="{aid30}"]'); p30.wait_for_selector('#avRes', timeout=20000)
    r30 = [p30.inner_text(f'#avRes tr[data-pid="{j30[0]}"] .aval-media'), p30.inner_text(f'#avRes tr[data-pid="{j30[1]}"] .aval-qtd')]
    ok(nv30 == 8.5 and r30 == ['8,5', '1'],
       f'CT-KAN-170-P30: avaliação, as notas dadas e a nota atualizada no cadastro continuam depois de sair e entrar ({nv30}, {r30})')
    c30.close()

    # P31 rateio com pessoa de fora (KAN-216): criar o rateio com "Primo do Bruno" e "Recebi" dele. Confere depois de
    # sair e entrar: o nome no rateio (rat.fora), o pagamento (rat.pg) e a entrada sem jogador, com o id em "fora".
    c31 = novo(); p31 = c31.new_page()
    p31.on('pageerror', lambda e: errs.append(str(e)))
    E31 = 'fora31@teste.com'
    p31.goto(URL + '#/criar'); p31.wait_for_selector('#le', timeout=20000); p31.wait_for_timeout(300)
    p31.fill('#le', E31); p31.fill('#lp', SENHA); p31.fill('#lp2', SENHA); p31.wait_for_timeout(200)
    p31.click('[data-a=signup]'); p31.wait_for_selector('#ngn', timeout=20000)
    p31.fill('#ngn', 'Fora FC'); p31.click('[data-a=createGroup]')
    p31.wait_for_function("location.hash.startsWith('#/g/')", timeout=20000)
    g31 = p31.url.split('#/g/')[1].split('/')[0]
    pronto(p31, 'jogadores'); p31.click('[data-a=seed]'); p31.wait_for_timeout(1500)
    gravou(p31); pronto(p31, 'caixa'); p31.wait_for_function("S.loaded.pc", timeout=20000)
    p31.click('[data-a=ratNovo]'); p31.wait_for_selector('#rtn', timeout=10000)
    p31.fill('#rtn', 'Camisa'); p31.check('input[name=rtModo][value=fixo]'); p31.fill('#rtv', '70')
    p31.fill('#rtFora', 'Primo do Bruno'); p31.click('#rtForaAdd'); p31.wait_for_timeout(150)
    p31.click('#dlg [data-a=ratSalvar]'); p31.wait_for_timeout(1000)
    rid31 = J(p31, "Object.keys((S.pc||{}).rat||{})[0]")
    f31 = J(p31, "(r)=>Object.keys(S.pc.rat[r].fora||{})[0]", rid31)
    p31.click(f'#rat-{rid31} [data-a=ratRecebi][data-p="{f31}"]'); p31.wait_for_timeout(1000); gravou(p31)
    sair_e_esperar(p31)
    p31.goto(URL + '#/entrar'); p31.wait_for_selector('#le', timeout=20000); p31.wait_for_timeout(300)
    p31.fill('#le', E31); p31.fill('#lp', SENHA); p31.keyboard.press('Enter'); p31.wait_for_timeout(2500)
    p31.goto(URL + '#/g/' + g31); pronto(p31, 'caixa'); p31.wait_for_function("S.loaded.pc", timeout=20000); p31.wait_for_timeout(1200)
    r31 = J(p31, "(a)=>{const x=((S.pc||{}).rat||{})[a[0]];return x?[(x.fora||{})[a[1]], (x.part||{})[a[1]], (x.pg||{})[a[1]]]:null}", [rid31, f31])
    l31 = J(p31, "(r)=>Object.values(S.caixa||{}).filter(l=>l&&l.rat===r).map(l=>[l.k,l.pid||null,l.fora||null,l.v])", rid31)
    ok(r31 == ['Primo do Bruno', 7000, 7000] and l31 == [['entrada', None, f31, 70]],
       f'CT-KAN-170-P31: a pessoa de fora, o valor dela e o pagamento continuam depois de sair e entrar ({r31}, {l31})')
    c31.close()

    ok(not errs, 'nenhum erro de JavaScript' + (': ' + '; '.join(errs[:3]) if errs else ''))
    b.close()

n = sum(1 for r in res if r['ok'])
print(f'\n{n} de {len(res)} verificações de gravação passaram.')
json.dump(res, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resultado-persistencia.json'), 'w'), ensure_ascii=False, indent=1)
if GITHUB:
    print(f'::notice::Roteiro de gravação: {n} de {len(res)} passaram.')
sys.exit(0 if n == len(res) else 1)
