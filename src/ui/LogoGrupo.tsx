/* Logotipo do grupo em Editar grupo (KAN-273): escolher, trocar e remover. Grava na hora (não espera o "Salvar"),
   porque a imagem sobe antes. Só aparece para quem tem a permissão Configurações. Os limites ficam escritos na tela:
   JPG, PNG, WebP ou GIF, até 5 MB. */
import { useRef, useState } from 'preact/hooks';
import { LOGO_MAX_MB, LOGO_TIPOS, arquivoLogo } from '../dominio/logo';
import { tx } from '../i18n/index.js';
import { editApp } from '../nucleo/edicoes.js';
import { S as estado } from '../nucleo/estado.js';
import { toast } from '../nucleo/util.js';
import { upMyGroup } from '../rotas';
import { apagarLogo, prepararLogo, subirLogo } from '../acoes/logo';
import { srcLogo } from './logo-src';

type Obj = Record<string, any>;
const st = () => estado as Obj;

function gravar(nome: string | null) {
  const gid = st().gid as string,
    antes = st().app?.logo;
  const p = editApp(a => {
    if (nome) a.logo = nome;
    else delete a.logo;
  });
  upMyGroup(gid, { logo: nome }).catch(() => {});
  return Promise.resolve(p).then(() => {
    if (antes && antes !== nome) apagarLogo(gid, antes);
  });
}

export function LogoGrupo() {
  const [ocupado, setOcupado] = useState<'' | 'subir' | 'tirar'>('');
  const [erro, setErro] = useState('');
  const arq = useRef<HTMLInputElement>(null);
  const gid = st().gid as string,
    src = srcLogo(gid, st().app?.logo);

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setErro('');
    const ruim = arquivoLogo(f);
    if (ruim) {
      setErro(tx(ruim === 'tipo' ? 'logo.tipoRuim' : 'logo.grande', { mb: LOGO_MAX_MB }));
      return;
    }
    setOcupado('subir');
    try {
      const b = await prepararLogo(f);
      if (!b) {
        setErro(tx('logo.naoAbriu'));
        return;
      }
      await gravar(await subirLogo(gid, b));
      toast(tx('logo.salvo'));
    } catch (e) {
      console.warn('logo', e);
      setErro(tx('logo.naoSalvou'));
    } finally {
      setOcupado('');
      if (arq.current) arq.current.value = '';
    }
  };
  const tirar = async () => {
    setErro('');
    setOcupado('tirar');
    try {
      await gravar(null);
      toast(tx('logo.removido'));
    } catch (e) {
      setErro(tx('logo.naoSalvou'));
    } finally {
      setOcupado('');
    }
  };
  const busy = (k: string) => ({ class: ocupado === k ? 'btn sm busy' : 'btn sm', 'aria-busy': ocupado === k });

  return (
    <div class="f" id="logoGrupo">
      <span class="lbl">{tx('logo.titulo')}</span>
      <div class="row" style="align-items:center;gap:12px">
        {src ? (
          <img class="gem logo-prev" src={src} alt={tx('logo.atual')} width={56} height={56} />
        ) : (
          <span class="gem logo-prev" aria-hidden="true">
            🖼️
          </span>
        )}
        <button
          type="button"
          id="logoEscolher"
          {...busy('subir')}
          disabled={!!ocupado}
          onClick={() => arq.current?.click()}
        >
          {tx(src ? 'logo.trocar' : 'logo.escolher')}
        </button>
        {src ? (
          <button type="button" id="logoTirar" {...busy('tirar')} disabled={!!ocupado} onClick={tirar}>
            {tx('logo.remover')}
          </button>
        ) : null}
        <input
          ref={arq}
          id="logoArq"
          type="file"
          accept={LOGO_TIPOS.join(',')}
          hidden
          onChange={e => escolher((e.currentTarget as HTMLInputElement).files?.[0])}
        />
      </div>
      <p class="small muted" id="logoLimites" style="margin:6px 0 0">
        {tx('logo.limites', { mb: LOGO_MAX_MB })}
      </p>
      <div class="err" id="logoErr" role="alert">
        {erro}
      </div>
    </div>
  );
}
