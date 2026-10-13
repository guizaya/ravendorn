import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight, ArrowUpRight, BowArrow, ChevronDown, Compass, Crown, Gamepad2, Menu, Monitor, Mountain, Shield, Sparkles, Swords, Users, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import world from '@/assets/world-map.png'
import worldDialog from '@/assets/world-map-dialog.png'
import classes from '@/assets/classes.jpg'
import archerSprite from '@/assets/class-archer.gif'
import warriorSprite from '@/assets/class-warrior.gif'
import sorcererSprite from '@/assets/class-sorcerer.gif'
import { CLASS_STATS, type ClassStat } from '@/lib/class-stats'
import { DiscordIcon } from '@/components/discord-icon'
import { DISCORD_INVITE_URL } from '@/lib/community'
import { NOME_DO_PROJETO, MarcaRavenDorn } from '@/components/marca-projeto'

export const Route = createFileRoute('/')({
 component: Index,
 head: () => ({ meta: [
  { title: NOME_DO_PROJETO + ' — Um mundo. A sua lenda.' },
  { name: 'description', content: `Descubra ${NOME_DO_PROJETO}, um universo de fantasia em um MMORPG 2D top-down. Explore o mundo, conheça as classes e encontre sua próxima aventura.` },
  { property: 'og:title', content: NOME_DO_PROJETO + ' — Um mundo. A sua lenda.' },
  { property: 'og:description', content: 'Uma nova aventura de fantasia em um MMORPG 2D top-down.' },
  { property: 'og:type', content: 'website' },
  { name: 'twitter:card', content: 'summary_large_image' },
 ] }),
})
type HomeHero = { name: string; role: string; icon: LucideIcon; stats: ClassStat[]; sprite?: { src: string; size: number } }
const heroes: HomeHero[] = [
 { name: 'Guerreiro', role: 'FORÇA & RESISTÊNCIA', icon: Swords, stats: CLASS_STATS.Guerreiro, sprite: { src: warriorSprite, size: 88 } },
 { name: 'Arqueira', role: 'PRECISÃO & AGILIDADE', icon: BowArrow, stats: CLASS_STATS.Arqueiro, sprite: { src: archerSprite, size: 84 } },
 { name: 'Mago', role: 'MAGIA & DESTRUIÇÃO', icon: Sparkles, stats: CLASS_STATS.Mago, sprite: { src: sorcererSprite, size: 88 } },
]
const nav = [{ label: 'O jogo', id: 'inicio' }, { label: 'O mundo', id: 'mundo' }, { label: 'Classes', id: 'classes' }, { label: 'Comunidade', id: 'comunidade' }]
function Index() {
 const [menu, setMenu] = useState(false)
 const [dialog, setDialog] = useState<'world' | 'community' | null>(null)
 return <>
  <header className="site-header"><div className="page-width header-inner">
   <a href="#inicio" className="wordmark no-underline text-foreground"><MarcaRavenDorn /></a>
   <nav className="desktop-nav" aria-label="Navegação principal">{nav.map((item, i) => <a key={item.id} href={`#${item.id}`} className={i === 0 ? 'active' : ''}>{item.label}</a>)}</nav>
   <Button variant="game" className="header-cta" asChild><Link to="/auth"><Swords /> Começar aventura <ArrowUpRight /></Link></Button>
   <Button variant="navigation" size="icon" className="mobile-menu-button" aria-label={menu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</Button>
  </div>{menu && <nav className="mobile-nav" aria-label="Navegação móvel">{nav.map(item => <a href={`#${item.id}`} key={item.id} onClick={() => setMenu(false)}>{item.label}</a>)}<Button variant="game" asChild onClick={() => setMenu(false)}><Link to="/auth">Começar aventura <ArrowRight /></Link></Button></nav>}</header>
  <main>
   <section className="hero" id="inicio">
    <img src={world} className="hero-art" alt="Mapa em pixel art das terras de ${NOME_DO_PROJETO}, com florestas, rio, ponte e o castelo no alto da colina sob a lua" width={2176} height={1216} />
    <div className="page-width hero-content"><div className="eyebrow">MMORPG 2D • UM NOVO CAPÍTULO</div>
     <h1>{NOME_DO_PROJETO}</h1><p className="hero-subtitle">Um mundo. A sua lenda.</p>
     <p className="hero-copy">Além das muralhas, o desconhecido espera por você.<br />Explore terras esquecidas, encontre seus aliados e escreva sua história em um mundo que nunca para.</p>
     <div className="hero-actions"><Button variant="game" asChild><Link to="/auth"><Swords /> Começar aventura <ArrowRight /></Link></Button><Button variant="gameOutline" onClick={() => document.getElementById('mundo')?.scrollIntoView({ block: 'start' })}><Compass /> Explorar o mundo</Button></div>
     <div className="platform-note"><Monitor size={13} /> 2D top-down <span className="mx-1">•</span> Fantasia sem limites</div>
    </div>
   </section>
   <div className="feature-strip"><div className="page-width feature-grid">{[
    { icon: Mountain, title: 'Um mundo para descobrir', subtitle: 'Cada caminho, uma nova história' },
    { icon: Swords, title: 'Batalhas épicas', subtitle: 'Coragem em cada encontro' },
    { icon: Users, title: 'A aventura é melhor juntos', subtitle: 'Encontre sua próxima guilda' },
    { icon: Gamepad2, title: 'A essência do RPG 2D', subtitle: 'Clássico na alma. Novo no mundo.' },
   ].map(item => <div className="feature" key={item.title}><item.icon /><div><strong>{item.title}</strong><small>{item.subtitle}</small></div></div>)}</div></div>
   <section className="section page-width" id="mundo"><div className="section-heading"><div className="eyebrow">ALÉM DO HORIZONTE</div><h2>Não é apenas um mapa. É um mundo.</h2><p>Das florestas silenciosas às ruínas de reinos antigos,<br />há sempre algo esperando para ser descoberto.</p></div>
    <div className="world-grid"><img className="world-image" src={world} alt={`Mapa em pixel art das terras de ${NOME_DO_PROJETO}, com a ponte de pedra sobre o rio e o castelo ao fundo`} loading="lazy" width={2176} height={1216} /><div className="world-detail"><div className="eyebrow">{`AS TERRAS DE ${NOME_DO_PROJETO.toUpperCase()}`}</div><h3>O chamado do desconhecido.</h3><p>{`Uma luz brilha entre as árvores. Algo desperta nas profundezas. E do outro lado da ponte, uma nova jornada começa. Em ${NOME_DO_PROJETO}, o próximo passo é sempre seu.`}</p></div></div>
   </section>
   <section className="section classes-section" id="classes"><div className="page-width"><div className="section-heading"><div className="eyebrow">ENCONTRE SEU CAMINHO</div><h2>Qual será a sua lenda?</h2><p>A força da espada, a precisão do arco ou o poder do desconhecido.<br />Todo herói tem um começo.</p></div><div className="class-grid">{heroes.map((item, i) => <article className="class-card" key={item.name}><div className={`class-art class-art-${i}${item.sprite ? ' has-sprite' : ''}`}>{item.sprite ? <img src={item.sprite.src} alt={item.name} loading="lazy" width={item.sprite.size} height={item.sprite.size} /> : <img src={classes} alt={item.name} loading="lazy" width={1536} height={1024} />}</div><div className="class-info"><div className="eyebrow mb-3">{item.role}</div><h3 className="class-title"><item.icon />{item.name}</h3><div className="chars-stats class-stats">{item.stats.map((s) => <div className="chars-stat" key={s.label}><span>{s.label}</span><div className="chars-stat-bar"><i style={{ width: `${s.percent}%` }} /></div><b>{s.value}</b></div>)}</div></div></article>)}</div></div></section>
   <section id="comunidade" className="section community"><div className="page-width"><div className="eyebrow justify-center"><Users size={16} /> NENHUMA LENDA NASCE SOZINHA</div><h2>Sua próxima guilda começa aqui.</h2><p>Histórias compartilhadas. Amizades reais. Aventuras que ficam.</p><div className="community-actions"><Button variant="discord" asChild><a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer"><DiscordIcon size={18} /> Entrar no Discord <ArrowUpRight /></a></Button></div></div></section>
   <section className="section page-width"><div className="section-heading"><div className="eyebrow">ANTES DA JORNADA</div><h2>Perguntas frequentes</h2></div><div className="faq"><details><summary>{`O que é ${NOME_DO_PROJETO}?`}</summary><p>{`${NOME_DO_PROJETO} é o nome conceitual desta apresentação de um MMORPG 2D top-down. O nome, as classes e as imagens podem ser adaptados ao seu jogo.`}</p></details><details><summary>O jogo já está disponível?</summary><p>A data de lançamento e o link de acesso ainda não foram informados. O download será disponibilizado aqui quando estiver pronto.</p></details><details><summary>Como posso acompanhar as novidades?</summary><p>Entre no nosso Discord — é por lá que as novidades, eventos e avisos de lançamento aparecem primeiro.</p></details></div></section>
  </main><footer><div className="page-width footer-inner"><a href="#inicio" className="wordmark no-underline text-foreground"><MarcaRavenDorn /></a><p>Um mundo. A sua lenda.</p><p>© {new Date().getFullYear()} {NOME_DO_PROJETO} · Apresentação conceitual</p></div></footer>
   <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null) }}><DialogContent>
     <DialogTitle className="font-display text-2xl leading-normal">{dialog === 'world' ? `As terras de ${NOME_DO_PROJETO}` : 'Sua comunidade está no Discord'}</DialogTitle>
     <DialogDescription>{dialog === 'world' ? 'Uma visão conceitual do universo do jogo. Cada caminho pode ser o começo de uma nova história.' : 'Entre no servidor do Discord para acompanhar as novidades, achar sua guilda e conversar com outros aventureiros.'}</DialogDescription>
     {dialog === 'community' && <Button variant="discord" asChild className="mt-5 w-full"><a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer"><DiscordIcon size={18} /> Entrar no Discord <ArrowUpRight /></a></Button>}
    {dialog === 'world' && <img src={worldDialog} alt={`Mapa em pixel art das terras de ${NOME_DO_PROJETO}`} className="dialog-art" width={924} height={516} />}
  </DialogContent></Dialog>
 </>
}
