import { BRAND_ALT_TEXT, LOGO_VERTICAL_BLUE } from '../brand';

/**
 * {component.footer} do DESIGN.md.
 *
 * Fundo {colors.canvas-parchment}, texto {colors.ink-muted-80}, padding vertical
 * 64px, logotipo oficial de `/img/logo`. A variante vertical azul e usada porque
 * o fundo do rodape e claro.
 *
 * O aviso legal e obrigatorio: PRD 1.2 e 4.3 proibem apresentar o MVP como
 * sistema oficial de matricula ou seus dados como retrato oficial do municipio.
 */
export function Footer() {
  const logo = LOGO_VERTICAL_BLUE;

  return (
    <footer className="mp-footer">
      <div className="mp-footer__inner">
        <img
          className="mp-footer__logo"
          src={logo.src}
          width={logo.intrinsicWidth}
          height={logo.intrinsicHeight}
          alt={BRAND_ALT_TEXT}
        />

        <div className="mp-footer__columns">
          <div>
            <h2 className="mp-footer__heading">Sobre esta demonstração</h2>
            <ul>
              <li>
                <a className="mp-footer__link" href="/sobre">
                  O que é o Match Perfeito
                </a>
              </li>
              <li>
                <a className="mp-footer__link" href="/sobre#dados">
                  Origem dos dados
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mp-footer__heading">Acessibilidade</h2>
            <ul>
              <li>
                <a className="mp-footer__link" href="/sobre#acessibilidade">
                  Recursos de acessibilidade
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mp-footer__heading">Privacidade</h2>
            <ul>
              <li>
                <a className="mp-footer__link" href="/sobre#privacidade">
                  Como tratamos os dados
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mp-footer__legal">
          Protótipo desenvolvido para o Hackathon SME-Rio + Rio Impact Lab 2026. Não substitui o
          sistema oficial de matrícula da Secretaria Municipal de Educação. Todos os dados exibidos
          são sintéticos ou anonimizados e não representam a realidade do município.
        </p>
      </div>
    </footer>
  );
}
