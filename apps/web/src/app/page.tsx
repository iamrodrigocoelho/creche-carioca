import { ButtonLink, DemoBadge } from '@match/ui';

/**
 * Pagina institucional.
 *
 * Alterna {component.product-tile-light} e {component.product-tile-dark}: no
 * DESIGN.md a mudanca de superficie E o divisor, sem borda nem sombra.
 */
export default function HomePage() {
  return (
    <>
      <section className="mp-tile mp-tile--light">
        <div className="mp-tile__inner mp-stack-lg">
          <DemoBadge>Protótipo de demonstração</DemoBadge>
          <h1 className="mp-hero-display">
            Uma inscrição de creche que faz sentido pra sua rotina
          </h1>
          <p className="mp-lead">
            Descubra o grupamento da sua criança, compare unidades perto de onde você mora, trabalha
            ou tem rede de apoio, e acompanhe cada passo da convocação.
          </p>
          <div className="mp-actions">
            <ButtonLink variant="store-hero" href="/inscricao">
              Iniciar inscrição
            </ButtonLink>
            <ButtonLink variant="secondary" href="/sobre">
              Saiba como funciona
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mp-tile mp-tile--parchment" aria-labelledby="etapas">
        <div className="mp-tile__inner mp-tile__inner--wide mp-stack-lg">
          <h2 className="mp-display-md" id="etapas">
            O que já está disponível nesta versão
          </h2>
          <div className="mp-card-grid">
            <article className="mp-card mp-stack-xs">
              <h3 className="mp-tagline">1. Dados da criança</h3>
              <p className="mp-caption mp-muted">
                Informe mês e ano de nascimento e o turno desejado. O sistema calcula o grupamento
                etário e explica, passo a passo, como chegou nele.
              </p>
              <p className="mp-caption-strong">Disponível agora</p>
            </article>

            <article className="mp-card mp-stack-xs">
              <h3 className="mp-tagline">2. Onde procurar vaga</h3>
              <p className="mp-caption mp-muted">
                Até três pontos de referência por CEP — casa, trabalho e rede de apoio — para
                comparar a distância de cada unidade.
              </p>
              <p className="mp-caption-strong">Em construção</p>
            </article>

            <article className="mp-card mp-stack-xs">
              <h3 className="mp-tagline">3. Escolha e acompanhamento</h3>
              <p className="mp-caption mp-muted">
                Até cinco unidades em ordem de preferência, pontuação explicável e convocação com
                registro de cada tentativa de contato.
              </p>
              <p className="mp-caption-strong">Em construção</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mp-tile mp-tile--dark" aria-labelledby="transparencia">
        <div className="mp-tile__inner mp-stack-md">
          <h2 className="mp-display-md" id="transparencia">
            Regra pública, não caixa-preta
          </h2>
          <p className="mp-lead mp-muted-on-dark">
            Toda decisão desta demonstração é determinística e reproduzível: as mesmas informações,
            com a mesma versão de regra, sempre chegam ao mesmo resultado — e o motivo fica visível
            para a família.
          </p>
          <p className="mp-caption mp-muted-on-dark">
            Nenhum modelo de linguagem participa do cálculo de pontuação, prioridade ou alocação de
            vagas.{' '}
            <a className="mp-link--on-dark" href="/sobre#dados">
              Entenda a origem dos dados
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
