/* Foto do jogador na ficha (KAN-293, pelada-v125): escolher, trocar e remover. Grava na hora (não espera o "Salvar"
   da ficha), porque a imagem sobe antes. Só para quem tem a permissão de Elenco e só em jogador já cadastrado.
   Na primeira foto, pede a confirmação de que o jogador autorizou; quem confirmou e quando ficam em privado/contatos
   (fa, fp). Os limites ficam escritos na tela: JPG, PNG ou WebP, até 5 MB. A preparação e o envio (acoes/foto.ts)
   baixam só ao escolher. */
import { useRef, useState } from 'preact/hooks';
import { FOTO_MAX_MB, FOTO_TIPOS, arquivoFoto } from '../dominio/foto';
import { tx } from '../i18n/index.js';
import * as banco from '../nucleo/backend.js';
import { GB, S as estado, clean, w } from '../nucleo/estado.js';
import { cl, toast } from '../nucleo/util.js';
import { ACT } from '../acoes.js';
import { recurso } from '../dominio/grupo.js';
import { confirmou } from './dialogos.js';
import { srcFoto } from './foto-src';
import { changed } from './render.js';
import { usarEstilo } from './estilo';
import estilo from '../estilos/foto.css' with { type: 'text' };

usarEstilo('foto', estilo);

type Obj = Record<string, any>;
const st = () => estado as Obj;
const acoes = () => import('../acoes/foto');
let aoMudar = () => {};

/* O jogador guarda só o nome do arquivo (campo "foto"). */
function gravarNome(pid: string, nome: string | null) {
  const j = st().jog[pid];
  if (!j) return Promise.resolve();
  const o = Object.assign({}, j);
  if (nome) o.foto = nome;
  else delete o.foto;
  st().jog[pid] = o;
  changed();
  return w(GB.patch('jogadores/' + pid, { foto: nome || (banco as Obj).op.apagar() }));
}

/* Quem autorizou e quando, em privado/contatos (só quem tem Elenco lê). */
function gravarAutorizacao(pid: string) {
  const c = cl(st().cont) || {};
  c[pid] = Object.assign({}, c[pid] || {}, { fa: Date.now(), fp: st().user?.uid || '' });
  st().cont = c;
  return w(GB.set('privado/contatos', clean(c)));
}

export function FotoJogador({ pid }: { pid: string }) {
  const [ocupado, setOcupado] = useState<'' | 'subir' | 'card'>('');
  const [erro, setErro] = useState('');
  const [, redesenhar] = useState(0);
  aoMudar = () => redesenhar(n => n + 1);
  const [aut, setAut] = useState(!!((st().cont || {})[pid] || {}).fa);
  const arq = useRef<HTMLInputElement>(null);
  const gid = st().gid as string,
    j = st().jog[pid] || {},
    src = srcFoto(gid, pid, j.foto),
    jaAutorizou = !!((st().cont || {})[pid] || {}).fa;

  /* KAN-301: com fundo liso, a janela mostra antes e depois e pergunta antes de gravar. */
  const [proposta, setProposta] = useState<{ normal: Blob; sem: Blob; antes: string; depois: string } | null>(null);
  const fecharProposta = () => {
    if (proposta) {
      URL.revokeObjectURL(proposta.antes);
      URL.revokeObjectURL(proposta.depois);
    }
    setProposta(null);
  };
  const gravar = async (b: Blob) => {
    setOcupado('subir');
    try {
      const m = await acoes();
      const antes = j.foto,
        nome = await m.subirFoto(gid, pid, b as Blob & { type: string });
      if (!jaAutorizou) await gravarAutorizacao(pid);
      await gravarNome(pid, nome);
      if (antes && antes !== nome) m.apagarFoto(gid, pid, antes);
      toast(tx('foto.salva'));
      redesenhar(n => n + 1);
    } catch (e) {
      console.warn('foto', e);
      setErro(tx('foto.naoSalvou'));
    } finally {
      setOcupado('');
    }
  };
  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setErro('');
    fecharProposta();
    const ruim = arquivoFoto(f);
    if (ruim) {
      setErro(tx(ruim === 'tipo' ? 'foto.tipoRuim' : 'foto.grande', { mb: FOTO_MAX_MB }));
      return;
    }
    setOcupado('subir');
    try {
      const m = await acoes();
      const b = await m.prepararFoto(f);
      if (!b) {
        setErro(tx('foto.naoAbriu'));
        setOcupado('');
        return;
      }
      const sem = await m.semFundoLiso(f);
      if (sem) {
        setOcupado('');
        setProposta({ normal: b, sem, antes: URL.createObjectURL(b), depois: URL.createObjectURL(sem) });
        return;
      }
      await gravar(b);
    } catch (e) {
      console.warn('foto', e);
      setErro(tx('foto.naoSalvou'));
      setOcupado('');
    } finally {
      if (arq.current) arq.current.value = '';
    }
  };
  const decidir = async (semFundo: boolean) => {
    if (!proposta) return;
    const b = semFundo ? proposta.sem : proposta.normal;
    fecharProposta();
    await gravar(b);
  };
  const busy = (k: string) => ({ class: ocupado === k ? 'btn sm busy' : 'btn sm', 'aria-busy': ocupado === k });
  const podeEscolher = jaAutorizou || aut;
  /* KAN-295 (pelada-v129): o card de verdade, com os números do jogador (sob demanda). */
  const verCard = () => {
    setOcupado('card');
    import('./CardJogador').then(
      m => m.abrirCardJogador(pid, 'ficha'),
      () => {
        setOcupado('');
        setErro(tx('comum.naoCarregou'));
      }
    );
  };

  return (
    <div class="f foto-jog" id="fotoJogador" data-sem-descarte="">
      <span class="lbl">{tx('foto.titulo')}</span>
      <div class="foto-linha">
        {src ? (
          <img class="foto-prev" src={src} alt={tx('foto.atual', { nome: j.name || '' })} />
        ) : (
          <span class="foto-prev foto-vazia" aria-hidden="true">
            👤
          </span>
        )}
        <div class="foto-acoes">
          <button
            type="button"
            id="fotoEscolher"
            {...busy('subir')}
            disabled={!!ocupado || !podeEscolher}
            aria-describedby={podeEscolher ? undefined : 'fotoMotivo'}
            onClick={() => arq.current?.click()}
          >
            {tx(src ? 'foto.trocar' : 'foto.escolher')}
          </button>
          {src ? (
            <button type="button" class="btn sm" id="fotoTirar" data-a="fotoTirar" data-p={pid} disabled={!!ocupado}>
              {tx('foto.remover')}
            </button>
          ) : null}
          {src && recurso('cards') ? (
            <button type="button" id="fotoCard" {...busy('card')} disabled={!!ocupado} onClick={verCard}>
              {tx('foto.verCard')}
            </button>
          ) : null}
        </div>
        <input
          ref={arq}
          id="fotoArq"
          type="file"
          accept={FOTO_TIPOS.join(',')}
          hidden
          onChange={e => escolher((e.currentTarget as HTMLInputElement).files?.[0])}
        />
      </div>
      {proposta ? (
        <div class="foto-semfundo" id="fotoSemFundo" role="group" aria-labelledby="fotoSemFundoT">
          <p class="small" id="fotoSemFundoT">
            <b>{tx('foto.semFundoTitulo')}</b> {tx('foto.semFundoTexto')}
          </p>
          <div class="foto-par">
            <figure>
              <img class="foto-prev" src={proposta.antes} alt={tx('foto.antes')} />
              <figcaption class="small muted">{tx('foto.antes')}</figcaption>
            </figure>
            <figure>
              <img class="foto-prev foto-xadrez" src={proposta.depois} alt={tx('foto.depois')} />
              <figcaption class="small muted">{tx('foto.depois')}</figcaption>
            </figure>
          </div>
          <div class="foto-acoes">
            <button type="button" class="btn sm primary" id="fotoUsarSem" onClick={() => decidir(true)}>
              {tx('foto.usarSemFundo')}
            </button>
            <button type="button" class="btn sm" id="fotoManter" onClick={() => decidir(false)}>
              {tx('foto.manter')}
            </button>
          </div>
        </div>
      ) : null}
      {jaAutorizou ? null : (
        <label class="chk-linha foto-aut">
          <input
            type="checkbox"
            id="fotoAut"
            checked={aut}
            onChange={e => setAut((e.currentTarget as HTMLInputElement).checked)}
          />
          <span>{tx('foto.autorizacao')}</span>
        </label>
      )}
      {podeEscolher ? null : (
        <p class="small muted" id="fotoMotivo">
          {tx('foto.motivoAut')}
        </p>
      )}
      <p class="small muted" id="fotoLimites">
        {tx('foto.limites', { mb: FOTO_MAX_MB })}
      </p>
      <div class="err" id="fotoErr" role="alert">
        {erro}
      </div>
    </div>
  );
}

/* Remover foto: com a janela de confirmação do app (ela roda a ação de novo ao confirmar, por isso é uma ação data-a). */
Object.assign(ACT, {
  fotoTirar: async (el: HTMLElement & { dataset: DOMStringMap }) => {
    const pid = el.dataset.p || '',
      j = st().jog[pid];
    if (!j || !j.foto) return;
    if (
      confirmou(el, {
        titulo: tx('foto.removerTitulo', { nome: j.name || '' }),
        texto: tx('foto.removerTexto'),
        acao: tx('foto.remover'),
        perigo: true,
      }) !== 'sim'
    )
      return;
    const antes = j.foto;
    await gravarNome(pid, null);
    (await acoes()).apagarFoto(st().gid as string, pid, antes);
    toast(tx('foto.removida'));
    aoMudar();
  },
});
