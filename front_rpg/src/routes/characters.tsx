import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Play, LogOut, Swords, Sparkles, Crosshair, Lock } from 'lucide-react'
import { IconeDiamante } from '@/components/icone-diamante'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import world from '@/assets/world-map.png'
import { NOME_DO_PROJETO, MarcaRavenDorn } from '@/components/marca-projeto'
/**
 * O SPRITE DO GUERREIRO.
 *
* ## POR QUE UM ARQUIVO LOCAL E NAO UM CDN
 *
 * Antes era `class-warrior.gif.asset.json`, um manifesto que apontava para
 * `/__l5e/assets-v1/<uuid>/class-warrior.gif` — um caminho de CDN com uuid.
 * Em deploy proprio, outra maquina ou atencao no servidor, esse caminho nao
 * existe e o retrato virava 404
 *
 * O arquivo local e o `idle/south.gif` do proprio jogo
 * (`src/assets/sprites/warrior/idle/south.gif`): a mesma arte, na mesma
 * direcao em que o boneco aparece parado no mapa
 *
 * ## POR QUE SO O `south`
 *
 * Porque a tela mostra UM retrato, nao uma animacao. O `south` parado e o
 * que o jogador ve no mapa dele, e mostrar o boneco virado para a camera
 * seria desorientador ao comparar com o jogo
 */
import warriorSprite from '@/assets/class-warrior.gif'
import sorcererSprite from '@/assets/class-sorcerer.gif'
import archerArt from '@/assets/class-archer.gif'
import {
  carregarResumo,
  criarPersonagem as criarNoServidor,
  apagarPersonagem as apagarNoServidor,
  desbloquearVaga as liberarVagaNoServidor,
  pedirTokenDeEntrada,
  guardarTokenPendente,
  limparSessao,
  sessaoSalva,
  urlDoJogo,
  type Personagem,
} from '@/lib/api'
import { assinarComCarteira } from '@/lib/carteira'
import { CLASS_STATS, type ClassStat } from '@/lib/class-stats'

export const Route = createFileRoute('/characters')({
  head: () => ({ meta: [
    { title: `Personagens - ${NOME_DO_PROJETO}` },
    { name: 'description', content: `Escolha ou crie até 3 personagens para sua aventura em ${NOME_DO_PROJETO}.` },
    { property: 'og:title', content: `Personagens - ${NOME_DO_PROJETO}` },
    { property: 'og:description', content: `Escolha ou crie até 3 personagens para sua aventura em ${NOME_DO_PROJETO}.` },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: CharactersPage,
})

const MAX_CHARACTERS = 3
const CUSTO_DAS_VAGAS = [0, 10, 20]

/**
 * O ID DA CLASSE E O DO JOGO, EM PORTUGUES.
 *
 * Antes o front tinha `Guerreiro | Arqueiro | Mago` e o jogo tinha
 * `warrior | arbalist | sorcerer | lancer`, sem nenhuma sobreposicao de
 * nomes: quem traduzia era a tela, e o servidor nunca viu o nome
 *
 * Agora o id que viaja e o do JOGO, e o rotulo fica so na tela. O catalogo
 * do jogo e o que vale, e o servidor recusa o que nao estiver nele
 */
type IdDaClasse = 'warrior' | 'arbalist' | 'sorcerer'

const CLASS_META: Record<IdDaClasse, {
  nome: string; art: string; icon: typeof Swords; tagline: string; description: string
  stats: ClassStat[]; sprite?: boolean; spriteSize?: number
}> = {
  warrior: {
    nome: 'Guerreiro', art: warriorSprite, icon: Swords, tagline: 'Muralha de aço', sprite: true, spriteSize: 84,
    description: 'Linha de frente inquebrável. Absorve dano, protege aliados e esmaga inimigos com golpes pesados.',
    stats: CLASS_STATS.Guerreiro,
  },
sorcerer: {
      nome: 'Mago', art: sorcererSprite, icon: Sparkles, tagline: 'Senhor do arcano',
      sprite: true, spriteSize: 88,
      description: 'Devasta grupos inteiros com magias de área. Frágil de perto, letal de longe.',
      stats: CLASS_STATS.Mago,
    },
  arbalist: {
    nome: 'Arqueiro', art: archerArt, icon: Crosshair, tagline: 'Sombra da floresta', sprite: true, spriteSize: 84,
    description: 'Precisão mortal e velocidade. Derruba alvos antes que eles percebam de onde veio a flecha.',
    stats: CLASS_STATS.Arqueiro,
  },
}

/**
 * O CODIGO DE ERRO DO SERVIDOR, TRADUZIDO.
 *
 * O servidor e quem decide o que e um nome valido, quantas vagas existem e
 * se o saldo basta. Ele devolve o codigo e a tela mostra a frase — o
 * contrario mandaria a tela reimplementar as regras e as duas metades
 * divergiriam
 */
const ERROS: Record<string, string> = {
  NOME_INVALIDO: 'Esse nome não serve. Use de 3 a 16 letras, números ou espaços.',
  NOME_EM_USO: 'Você já tem um personagem com esse nome.',
  CLASSE_INVALIDA: 'Essa classe não existe.',
  SEM_VAGA: 'Todas as suas vagas estão ocupadas. Desbloqueie uma nova com diamantes.',
  DIAMANTES_INSUFICIENTES: 'Você não tem diamantes suficientes.',
  LIMITE_DE_VAGAS: 'Você já tem todas as vagas.',
PERSONAGEM_NAO_ENCONTRADO: 'Esse personagem não existe mais.',
  SEM_SESSAO: 'Sua sessão expirou. Entre de novo.',

  /*
   * OS ERROS DA ASSINATURA DE ENTRADA.
   *
   * Sao os mesmos codigos do login, mais dois: entrar no jogo assina, e
   * `characters.tsx` era a tela que mais exibia "Não foi possível. Tente de
   * novo." para um caso que tem frase propria
   *
   * `NONCE_DESCONHECIDO` e `NONCE_EXPIRADO` tem a MESMA frase de proposito:
   * o jogador nao pode escolher entre pedir a mensagem de novo e esperar, e
   * nenhum dos dois e o problema dele
   */
  ASSINATURA_INVALIDA: 'A assinatura não confere. Tente de novo.',
  ASSINATURA_DE_OUTRA_CARTEIRA: 'Essa assinatura é de outra carteira.',
  ASSINATURA_VAZIA: 'A assinatura não chegou. Tente de novo.',
  NONCE_DESCONHECIDO: 'A assinatura expirou. Tente de novo.',
  NONCE_EXPIRADO: 'A assinatura expirou. Tente de novo.',
  PERSONAGEM_DIVERGENTE: 'Essa assinatura é de outro personagem. Clique em Jogar de novo.',
  CONTA_SEM_CARTEIRA: 'Esta conta não tem carteira conectada.',
}

function traduzir(erro: unknown): string {
  const e = erro as { status?: number; dados?: { erro?: string; detalhe?: string } }

  if (e?.status === 401) return ERROS['SEM_SESSAO'] ?? 'Sessão expirada.'

  const codigo = e?.dados?.erro

  return (codigo ? ERROS[codigo] : undefined) ?? 'Não foi possível. Tente de novo.'
}

function CharactersPage() {
  const navigate = useNavigate()
  const [pronto, setPronto] = useState(false)
  const [list, setList] = useState<Personagem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [cls, setCls] = useState<IdDaClasse>('warrior')
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [diamantes, setDiamantes] = useState(0)
  const [vagas, setVagas] = useState(1)
  const [pending, setPending] = useState<number | null>(null)
  const [entrando, setEntrando] = useState(false)

  /**
   * A CARGA VEM DO SERVIDOR.
   *
   * Antes lia do `localStorage`, e o servidor nao sabia de nada. Agora quem
   * responde o que a conta tem e o servidor — inclusive se a sessao
   * expirou enquanto a aba estava aberta
   */
  async function recarregar() {
    try {
      const resumo = await carregarResumo()
      setList(resumo.personagens)
      setDiamantes(resumo.diamantes)
      setVagas(resumo.unlockedSlots)
      setCreating(resumo.personagens.length === 0)
      setPronto(true)
    } catch (e) {
      // 401 e sessao vencida: o jogador volta para o login em vez de ver
      // uma tela de personagem vazia sem explicacao
      if ((e as { status?: number }).status === 401) {
        limparSessao()
        navigate({ to: '/auth' })
        return
      }
      setError(traduzir(e))
      setPronto(true)
    }
  }

  useEffect(() => {
    // sem sessao, nem vale a chamada: o servidor responderia 401 e a tela
    // piscaria antes de redirecionar
    if (!sessaoSalva()) {
      navigate({ to: '/auth' })
      return
    }

    recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  if (!pronto) return <div className="auth-screen" />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    try {
      const personagem = await criarNoServidor(name, cls)
      await recarregar()
      setSelected(personagem.id)
      setName('')
      setCreating(false)
    } catch (err) {
      setError(traduzir(err))
    }
  }

  async function remove(c: Personagem) {
    if (!confirm(`Apagar ${c.nome}? Isso não pode ser desfeito.`)) return
    try {
      await apagarNoServidor(c.id)
      await recarregar()
      if (selected === c.id) setSelected(null)
    } catch (err) {
      setError(traduzir(err))
    }
  }

  async function confirmUnlock() {
    if (pending === null) return
    setPending(null)
    try {
      const novo = await liberarVagaNoServidor()
      setDiamantes(novo.diamantes)
      setVagas(novo.unlockedSlots)
      setMsg(`Vaga ${novo.unlockedSlots} desbloqueada! Agora você pode criar mais um herói.`)
      setError(null)
    } catch (err) {
      setError(traduzir(err))
    }
  }

  /**
   * O JOGAR: O PONTO QUE NUNCA EXISTIU.
   *
   * Antes disto so escrevia "o mundo abre em breve" e a selecao morria ali.
   * Agora o front pede um TOKEN DE ENTRADA ao servidor — que so emite para
   * um personagem que a conta realmente tem — e navega para a rota `/jogo`,
   * que monta o iframe do mapa
   *
   * E o token que dura 60 segundos e vale uma vez, e o `GameServer` que
   * confere no JOIN
   *
   * ## POR QUE O TOKEN NAO VAI NA URL
   *
   * Ele vai para o `sessionStorage`, e a rota `/jogo` le de la. A URL do
   * site fica sempre `/jogo`, sem query: o historico do navegador, o
   * `Referer` de qualquer link aberto dali e a tela de quem estiver olhando
   * nao veem a credencial do personagem
   *
   * Quem chegou pela query (link antigo, `F5`) ainda funciona: a rota aceita
   * os dois caminhos, e limpa a URL assim que le
   */
  async function jogar() {
    if (!chosen) return

    setEntrando(true)
    setError(null)

try {
      const token = await pedirTokenDeEntrada(chosen.id, assinarComCarteira)
      guardarTokenPendente(token)
      navigate({ to: '/jogo' })
    } catch (err) {
      setError(traduzir(err))
      setEntrando(false)
    }
  }

  const chosen = list.find((c) => c.id === selected)
  const meta = CLASS_META[cls]
  const pendingCost = pending === null ? 0 : CUSTO_DAS_VAGAS[pending] ?? 0
  const canPay = diamantes >= pendingCost

  return (
    <div className="chars-screen">
      <img src={world} className="auth-art" alt="" aria-hidden="true" width={2176} height={1216} />
      <div className="auth-veil" />

      <div className="chars-shell">
        <header className="chars-header">
          <Link to="/" className="wordmark no-underline text-foreground"><MarcaRavenDorn /></Link>
          <span className="chars-diamonds" title="Seus diamantes"><IconeDiamante tamanho={14} /> {diamantes}</span>
          <div className="chars-header-right">
            <span className="chars-count">Heróis · {list.length}/{vagas}</span>
            <button className="chars-signout" onClick={() => { limparSessao(); navigate({ to: '/auth' }) }}>
              <LogOut size={14} /> Sair
            </button>
          </div>
        </header>

        {creating ? (
          <div className="chars-create">
            <div className={`chars-preview ${meta.sprite ? 'has-sprite' : ''}`}>
              <img src={meta.art} alt={cls} className={meta.sprite ? 'is-sprite' : ''}
                style={meta.sprite ? ({ '--sprite-size': `${meta.spriteSize ?? 84}px` } as React.CSSProperties) : undefined}
                width={meta.sprite ? 64 : 736} height={meta.sprite ? 64 : 912} />
              <div className="chars-preview-info">
                <div className="eyebrow">{meta.tagline}</div>
                <h2>{name.trim() || 'Sem nome'}</h2>
                <p className="chars-preview-cls">{meta.nome} · Nível 1</p>
              </div>
            </div>

            <form onSubmit={submit} className="chars-form">
              <div className="eyebrow">Nova lenda</div>
              <h1>Criar personagem</h1>

              <label className="chars-field">Nome do herói
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} autoFocus
                  placeholder="Ex: Aldric" />
              </label>

              <div className="chars-class-grid">
                {(Object.keys(CLASS_META) as IdDaClasse[]).map((c) => {
                  const m = CLASS_META[c]
                  const Icon = m.icon
                  return (
                    <button type="button" key={c} onClick={() => setCls(c)}
                      className={`chars-class-card ${cls === c ? 'is-active' : ''} ${m.sprite ? 'has-sprite' : ''}`}>
                      <img src={m.art} alt="" aria-hidden="true" loading="lazy"
                        className={m.sprite ? 'is-sprite' : ''} width={m.sprite ? 64 : 736} height={m.sprite ? 64 : 912} />
                      <span className="chars-class-name"><Icon size={13} /> {m.nome}</span>
                    </button>
                  )
                })}
              </div>

              <p className="chars-class-desc">{meta.description}</p>

              <div className="chars-stats">
                {meta.stats.map((s) => (
                  <div key={s.label} className="chars-stat">
                    <span>{s.label}</span>
                    <div className="chars-stat-bar"><i style={{ width: `${s.percent}%` }} /></div>
                    <b>{s.value}</b>
                  </div>
                ))}
              </div>

              {error && <p className="auth-error">{error}</p>}
              <Button variant="game" type="submit" className="w-full">Criar herói</Button>
              {list.length > 0 && (
                <Button variant="gameOutline" type="button" className="w-full"
                  onClick={() => { setCreating(false); setError(null) }}>Voltar</Button>
              )}
            </form>
          </div>
        ) : (
          <div className="chars-select">
            <div className="chars-select-head">
              <div className="eyebrow justify-center">Salão dos heróis</div>
              <h1>Escolha seu personagem</h1>
              <p>Selecione um herói para entrar no mundo, ou crie uma nova lenda.</p>
            </div>

            <div className="chars-slots">
              {Array.from({ length: MAX_CHARACTERS }).map((_, i) => {
                const c = list[i]
                if (!c) {
                  if (i >= vagas) return (
                    <button key={`locked-${i}`} onClick={() => setPending(i)} className="chars-slot chars-slot-locked">
                      <Lock size={22} />
                      <span>Vaga bloqueada</span>
                      <small><IconeDiamante tamanho={11} /> {CUSTO_DAS_VAGAS[i] ?? 0} diamantes para desbloquear</small>
                    </button>
                  )
                  return (
                    <button key={`empty-${i}`} onClick={() => setCreating(true)} className="chars-slot chars-slot-empty">
                      <Plus size={22} />
                      <span>Vaga livre</span>
                      <small>Criar personagem</small>
                    </button>
                  )
                }
                const m = CLASS_META[c.classe as IdDaClasse]
                return (
                  <div key={c.id} role="button" tabIndex={0}
                    onClick={() => setSelected(c.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelected(c.id) }}
                    className={`chars-slot ${selected === c.id ? 'is-active' : ''} ${m.sprite ? 'has-sprite' : ''}`}>
                    <img src={m.art} alt={m.nome} loading="lazy" className={m.sprite ? 'is-sprite' : ''}
                      style={m.sprite ? ({ '--sprite-size': `${m.spriteSize ?? 84}px` } as React.CSSProperties) : undefined}
                      width={m.sprite ? 64 : 736} height={m.sprite ? 64 : 912} />
                    <div className="chars-slot-info">
                      <strong>{c.nome}</strong>
                      <small>{m.nome} · Nível {c.nivel ?? 1}</small>
                    </div>
                    <button aria-label={`Apagar ${c.nome}`} className="chars-slot-delete"
                      onClick={(e) => { e.stopPropagation(); remove(c) }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>

            <Button variant="game" className="chars-play" disabled={!chosen || entrando}
              onClick={jogar}>
              <Play /> {entrando ? 'Abrindo o mundo…' : `Jogar${chosen ? ` com ${chosen.nome}` : ''}`}
            </Button>
            {msg && <p className="auth-note">{msg}</p>}
            {error && <p className="auth-error">{error}</p>}
          </div>
        )}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <DialogContent className="unlock-dialog">
          <div className="unlock-icon"><Lock size={20} /></div>
          <div className="unlock-head">
            <div className="eyebrow justify-center">Vaga bloqueada</div>
            <DialogTitle className="font-display text-2xl leading-normal">
              Desbloquear a vaga {pending === null ? '' : pending + 1}
            </DialogTitle>
            <DialogDescription>
              Cada vaga guarda um herói. Gaste seus diamantes para abrir esta vaga e criar mais um personagem.
            </DialogDescription>
          </div>

          <div className="unlock-cost">
            <div><span>Custa</span><b><IconeDiamante tamanho={13} /> {pendingCost}</b></div>
<div><span>Seu saldo</span><b><IconeDiamante tamanho={13} /> {diamantes}</b></div>
            {canPay && <div className="is-after"><span>Depois</span><b><IconeDiamante tamanho={13} /> {diamantes - pendingCost}</b></div>}
          </div>

          {!canPay && (
            <p className="unlock-short">Faltam <b>{pendingCost - diamantes}</b> diamantes para abrir esta vaga.</p>
          )}

          <div className="unlock-actions">
            <Button variant="gameOutline" onClick={() => setPending(null)}>Agora não</Button>
            <Button variant="game" disabled={!canPay} onClick={confirmUnlock}>
              <IconeDiamante tamanho={15} /> Desbloquear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
