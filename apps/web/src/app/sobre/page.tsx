import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre a demonstração | Creche Carioca',
};

/**
 * Transparencia obrigatoria: PRD 1.2 proibe apresentar dados anonimizados como
 * retrato oficial e PRD 4.3 lista explicitamente o que o MVP nao faz.
 */
export default function SobrePage() {
  return (
    <>
      <section className="mp-tile mp-tile--light">
        <div className="mp-tile__inner mp-stack-md">
          <h1 className="mp-display-md">Sobre esta demonstração</h1>
          <p className="mp-lead">
            O Creche Carioca é um protótipo construído para o Hackathon SME-Rio + Rio Impact Lab
            2026. Ele demonstra como a inscrição, a classificação e a convocação de vagas de creche
            poderiam funcionar de forma integrada e rastreável.
          </p>
        </div>
      </section>

      <section className="mp-tile mp-tile--parchment" id="dados">
        <div className="mp-tile__inner mp-stack-md">
          <h2 className="mp-display-md">Origem dos dados</h2>
          <p>
            Os dados exibidos são sintéticos ou anonimizados. Eles preservam estrutura e
            relacionamentos suficientes para a demonstração, mas seus indicadores{' '}
            <strong>não representam a realidade do município</strong> e não constituem indicador
            oficial da Secretaria Municipal de Educação.
          </p>
          <p>
            As faixas de idade, os pesos de pontuação e os critérios de desempate usados aqui estão
            marcados como dados de demonstração e ainda dependem de confirmação oficial.
          </p>
        </div>
      </section>

      <section className="mp-tile mp-tile--light" id="privacidade">
        <div className="mp-tile__inner mp-stack-md">
          <h2 className="mp-display-md">Como tratamos os dados</h2>
          <ul className="mp-stack-xs">
            <li>Coletamos apenas o mínimo necessário para a etapa em questão.</li>
            <li>Não pedimos o nome da criança nem do responsável.</li>
            <li>
              Telefones, CEPs e perfis sociais nunca aparecem por inteiro em registros técnicos.
            </li>
            <li>Nenhuma mensagem real é enviada: todos os canais são simulados.</li>
            <li>Nenhum dado pessoal real deve ser utilizado nesta demonstração.</li>
          </ul>
        </div>
      </section>

      <section className="mp-tile mp-tile--dark" id="acessibilidade">
        <div className="mp-tile__inner mp-stack-md">
          <h2 className="mp-display-md">Acessibilidade</h2>
          <p className="mp-muted-on-dark">
            A interface é operável por teclado, tem ordem de foco previsível, associa mensagens de
            erro aos campos e nunca comunica um status apenas por cor. Sempre que houver mapa,
            haverá uma lista equivalente em texto.
          </p>
          <p className="mp-caption mp-muted-on-dark">
            Encontrou uma barreira de acesso? Ela é considerada um defeito do produto.
          </p>
        </div>
      </section>
    </>
  );
}
