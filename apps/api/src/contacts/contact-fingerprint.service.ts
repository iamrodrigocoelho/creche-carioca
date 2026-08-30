import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ENV, type AppEnv } from '../common/config/env';

/**
 * Indice cego dos contatos (ADR-0027).
 *
 * Serve para reconhecer que dois contatos sao o mesmo sem comparar os valores, e
 * para continuar servindo quando os valores passarem a ser cifrados — o indice
 * nao precisara ser recalculado.
 *
 * E um HMAC, e nao um hash simples, porque o espaco de telefones brasileiros e
 * pequeno: menos de 10^11 combinacoes, enumeraveis em minutos. Um SHA-256 sem
 * segredo seria revertido trivialmente e nao mascararia nada.
 *
 * **O que isto NAO faz hoje:** o valor continua gravado em texto. PRD 13.4 pede
 * cifrar em nivel de aplicacao "quando viavel", e essa parte foi adiada
 * conscientemente (ADR-0027). O indice existe para que a cifragem, quando vier,
 * nao exija migrar dados.
 */
@Injectable()
export class ContactFingerprintService {
  private readonly key: string;

  constructor(@Inject(ENV) env: AppEnv) {
    this.key = env.CONTACT_FINGERPRINT_KEY;
  }

  /**
   * O canal entra no calculo para que o telefone `+5521999999999` e um handle
   * homonimo jamais colidam.
   */
  compute(channel: string, value: string): string {
    return createHmac('sha256', this.key).update(`${channel}:${value}`).digest('hex');
  }

  /** Comparacao em tempo constante, por habito e nao por necessidade aqui. */
  matches(fingerprint: string, channel: string, value: string): boolean {
    const expected = Buffer.from(this.compute(channel, value), 'hex');
    const actual = Buffer.from(fingerprint, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
