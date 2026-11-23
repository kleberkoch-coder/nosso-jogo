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
  const [ocupado, setOcupado] = useState<'' | 'subir'>('');
  const [erro, setErro] = useState('');
  const [, redesenhar] = useState(0);
  aoMudar = () => redesenhar(n => n + 1);
  const [aut, setAut] = useState(!!((st().cont || {})[pid] || {}).fa);
  const arq = useRef<HTMLInputElement>(null);
  const gid = st().gid as string,
    j = st().jog[pid] || {},
    src = srcFoto(gid, pid, j.foto),
    jaAutorizou = !!((st().cont || {})[pid] || {}).fa;

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setErro('');
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
        return;
      }
      const antes = j.foto,
        nome = await m.subirFoto(gid, pid, b);
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
      if (arq.current) arq.current.value = '';
    }
  };
  const busy = (k: string) => ({ class: ocupado === k ? 'btn sm busy' : 'btn sm', 'aria-busy': ocupado === k });
  const podeEscolher = jaAutorizou || aut;

  return (
    <div class="f foto-jog" id="fotoJogador">
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
            onClick={() => arq.current?.click()}
          >
            {tx(src ? 'foto.trocar' : 'foto.escolher')}
          </button>
          {src ? (
            <button type="button" class="btn sm" id="fotoTirar" data-a="fotoTirar" data-p={pid} disabled={!!ocupado}>
              {tx('foto.remover')}
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
