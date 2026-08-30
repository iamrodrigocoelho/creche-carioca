'use client';

import { useEffect, useRef, useState } from 'react';

import { Button, SelectField, TextField } from '@match/ui';
import type {
  ApiError,
  ContactListResponse,
  ContactPointResponse,
  ContactRelation,
  SocialPlatform,
} from '@match/schemas';

import {
  addPhoneContact,
  addSocialContact,
  confirmContactVerification,
  listContacts,
  removeContact,
  setPrimaryContact,
  startContactVerification,
} from '@/lib/api-client';

/**
 * Etapa 3 da jornada (RF-03, RF-04, PRD 8.3 e 8.4).
 *
 * Os contatos aparecem sempre mascarados, porque e assim que a API os devolve
 * (PRD 13.4) — nao ha decisao de exibicao a tomar aqui.
 *
 * O consentimento e sempre explicito e nunca vem marcado por padrao, exceto a
 * ligacao, que e o meio que a SME de fato usa para convocar. Marcar SMS ou
 * WhatsApp por conta propria seria presumir autorizacao que a familia nao deu.
 */

const RELATION_LABELS: Readonly<Record<ContactRelation, string>> = {
  RESPONSAVEL: 'Responsável pela criança',
  MAE: 'Mãe',
  PAI: 'Pai',
  FAMILIAR: 'Outro familiar',
  VIZINHO: 'Vizinho ou conhecido',
  OUTRO: 'Outra pessoa',
};

/** Relações que caracterizam telefone de terceiro (PRD 8.3). */
const THIRD_PARTY: readonly ContactRelation[] = ['FAMILIAR', 'VIZINHO', 'OUTRO'];

const PLATFORM_LABELS: Readonly<Record<SocialPlatform, string>> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  TIKTOK: 'TikTok',
  X: 'X (Twitter)',
};

const STATUS_LABELS: Readonly<Record<ContactPointResponse['status'], string>> = {
  INFORMED: 'Informado',
  PENDING_VERIFICATION: 'Aguardando código',
  VERIFIED: 'Verificado',
  INVALID: 'Não verificado',
  REVOKED: 'Revogado',
};

interface Props {
  readonly applicationId: string;
}

export function ContactsStep({ applicationId }: Props) {
  const [list, setList] = useState<ContactListResponse | null>(null);
  const [error, setError] = useState<ApiError['error'] | null>(null);
  const [busy, setBusy] = useState(false);

  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState<ContactRelation>('MAE');
  const [label, setLabel] = useState('');
  const [allowsCall, setAllowsCall] = useState(true);
  const [allowsSms, setAllowsSms] = useState(false);
  const [allowsWhatsapp, setAllowsWhatsapp] = useState(false);
  const [thirdPartyAuthorized, setThirdPartyAuthorized] = useState(false);

  const [platform, setPlatform] = useState<SocialPlatform>('INSTAGRAM');
  const [handle, setHandle] = useState('');
  const [allowsSocial, setAllowsSocial] = useState(false);

  const [challenge, setChallenge] = useState<{ contactId: string; code: string } | null>(null);
  const [typedCode, setTypedCode] = useState('');
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    void listContacts(applicationId).then((result) => {
      if (active && result.ok) setList(result.data);
    });
    return () => {
      active = false;
    };
  }, [applicationId]);

  async function run(
    operation: () => Promise<
      { ok: true; data: ContactListResponse } | { ok: false; error: ApiError['error'] }
    >,
  ) {
    setBusy(true);
    setError(null);
    const result = await operation();
    setBusy(false);
    if (result.ok) {
      setList(result.data);
      queueMicrotask(() => statusRef.current?.focus());
    } else {
      setError(result.error);
    }
    return result.ok;
  }

  async function handleAddPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salvo = await run(() =>
      addPhoneContact(applicationId, {
        phone,
        relation,
        allowsCall,
        allowsSms,
        allowsWhatsapp,
        thirdPartyAuthorized,
        ...(label.trim() ? { label: label.trim() } : {}),
      }),
    );
    if (salvo) {
      setPhone('');
      setLabel('');
      setThirdPartyAuthorized(false);
    }
  }

  async function handleAddSocial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salvo = await run(() =>
      addSocialContact(applicationId, { platform, handle, allowsSocial }),
    );
    if (salvo) {
      setHandle('');
      setAllowsSocial(false);
    }
  }

  async function handleStartVerification(contactId: string) {
    setBusy(true);
    setError(null);
    const result = await startContactVerification(applicationId, contactId);
    setBusy(false);
    if (result.ok) {
      setChallenge({ contactId, code: result.data.simulatedCode });
      setTypedCode('');
    } else {
      setError(result.error);
    }
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    const confirmado = await run(() =>
      confirmContactVerification(applicationId, challenge.contactId, { code: typedCode }),
    );
    if (confirmado) setChallenge(null);
  }

  const phones = list?.contacts.filter((contact) => contact.channel === 'TELEFONE') ?? [];
  const socials = list?.contacts.filter((contact) => contact.channel === 'SOCIAL') ?? [];
  const isThirdParty = THIRD_PARTY.includes(relation);
  const canReceiveMessages = phone.replace(/\D/g, '').length >= 11;

  return (
    <section className="mp-card mp-stack-md" aria-labelledby="contacts-title">
      <h3 id="contacts-title">Contatos</h3>
      <p className="mp-caption">
        Precisamos de pelo menos um telefone para avisar quando surgir uma vaga. Você escolhe por
        quais meios podemos falar com você.
      </p>

      {phones.length > 0 ? (
        <ul className="mp-anchor-list" aria-label="Telefones cadastrados">
          {phones.map((contact) => (
            <li key={contact.id} className="mp-anchor mp-stack-xs">
              <span className="mp-body-strong">{contact.masked}</span>
              <span className="mp-caption">
                {`${RELATION_LABELS[contact.relation]} · ${STATUS_LABELS[contact.status]}`}
                {contact.isPrimary ? ' · contato principal' : ''}
              </span>
              {contact.label ? <span className="mp-caption">{contact.label}</span> : null}
              <span className="mp-caption mp-muted">{consentSummary(contact)}</span>

              {contact.duplicateOfId !== null ? (
                <span className="mp-caption mp-muted">
                  Este telefone é igual a outro já informado. Pode continuar assim, se for o caso.
                </span>
              ) : null}

              <div className="mp-actions">
                {contact.isPrimary ? null : (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void run(() => setPrimaryContact(applicationId, contact.id))}
                  >
                    Tornar principal
                  </Button>
                )}
                {contact.status === 'VERIFIED' ? null : (
                  <Button
                    variant="pearl"
                    disabled={busy}
                    onClick={() => void handleStartVerification(contact.id)}
                  >
                    Verificar
                  </Button>
                )}
                {phones.length > 1 ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void run(() => removeContact(applicationId, contact.id))}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {challenge ? (
        <form className="mp-form" onSubmit={handleConfirm} noValidate>
          <p className="mp-caption-strong">
            {`Verificação simulada: nenhuma mensagem foi enviada. Use o código ${challenge.code}.`}
          </p>
          <TextField
            id="otp"
            label="Código de 6 dígitos"
            inputMode="numeric"
            value={typedCode}
            onChange={(event) => setTypedCode(event.target.value)}
            required
          />
          <div className="mp-actions">
            <Button type="submit" disabled={busy}>
              Confirmar código
            </Button>
            <Button variant="secondary" onClick={() => setChallenge(null)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <form className="mp-form" onSubmit={handleAddPhone} noValidate>
        <TextField
          id="phone"
          label={phones.length === 0 ? 'Telefone para contato' : 'Outro telefone'}
          hint="Com DDD. Aceitamos celular ou fixo."
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />

        <SelectField
          id="relation"
          label="De quem é este telefone"
          value={relation}
          onChange={(event) => setRelation(event.target.value as ContactRelation)}
        >
          {Object.entries(RELATION_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </SelectField>

        <TextField
          id="contact-label"
          label="Rótulo (opcional)"
          hint="Um nome curto para você reconhecer, como “celular do trabalho”."
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />

        <fieldset className="mp-fieldset">
          <legend className="mp-field__label">Podemos falar com você por</legend>
          <p className="mp-field__hint" id="consent-hint">
            Você autoriza cada meio separadamente, e pode mudar depois.
          </p>
          <div className="mp-radio-row" aria-describedby="consent-hint">
            <label className={chipClass(allowsCall)}>
              <input
                className="mp-chip__input"
                type="checkbox"
                checked={allowsCall}
                onChange={(event) => setAllowsCall(event.target.checked)}
              />
              Ligação
            </label>
            <label className={chipClass(allowsSms)}>
              <input
                className="mp-chip__input"
                type="checkbox"
                checked={allowsSms}
                disabled={!canReceiveMessages}
                onChange={(event) => setAllowsSms(event.target.checked)}
              />
              SMS
            </label>
            <label className={chipClass(allowsWhatsapp)}>
              <input
                className="mp-chip__input"
                type="checkbox"
                checked={allowsWhatsapp}
                disabled={!canReceiveMessages}
                onChange={(event) => setAllowsWhatsapp(event.target.checked)}
              />
              WhatsApp
            </label>
          </div>
          {canReceiveMessages ? null : (
            <span className="mp-field__hint">
              SMS e WhatsApp ficam disponíveis ao informar um celular.
            </span>
          )}
        </fieldset>

        {isThirdParty ? (
          <label className="mp-caption">
            <input
              type="checkbox"
              checked={thirdPartyAuthorized}
              onChange={(event) => setThirdPartyAuthorized(event.target.checked)}
            />{' '}
            Confirmo que esta pessoa sabe e autorizou o uso do telefone dela para falar sobre esta
            inscrição.
          </label>
        ) : null}

        <div className="mp-actions">
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Adicionar telefone'}
          </Button>
        </div>
      </form>

      <h4>Redes sociais (opcional)</h4>
      <p className="mp-caption">
        Um perfil ajuda a te encontrar se o telefone mudar. Nunca escrevemos nada público, e uma
        rede social sozinha não substitui o telefone.
      </p>

      {socials.length > 0 ? (
        <ul className="mp-anchor-list" aria-label="Perfis cadastrados">
          {socials.map((contact) => (
            <li key={contact.id} className="mp-anchor mp-stack-xs">
              <span className="mp-body-strong">
                {`${PLATFORM_LABELS[contact.platform ?? 'INSTAGRAM']} · ${contact.masked}`}
              </span>
              <span className="mp-caption mp-muted">
                {contact.allowsSocial
                  ? 'Você autorizou contato por esta rede.'
                  : 'Sem autorização para contato por esta rede.'}
              </span>
              <div className="mp-actions">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void run(() => removeContact(applicationId, contact.id))}
                >
                  Remover perfil
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="mp-form" onSubmit={handleAddSocial} noValidate>
        <SelectField
          id="platform"
          label="Rede social"
          value={platform}
          onChange={(event) => setPlatform(event.target.value as SocialPlatform)}
        >
          {Object.entries(PLATFORM_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </SelectField>

        <TextField
          id="handle"
          label="Perfil"
          hint="Só o nome de usuário, sem o endereço completo."
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
        />

        <label className="mp-caption">
          <input
            type="checkbox"
            checked={allowsSocial}
            onChange={(event) => setAllowsSocial(event.target.checked)}
          />{' '}
          Autorizo o contato por esta rede social.
        </label>

        <div className="mp-actions">
          <Button variant="secondary" type="submit" disabled={busy || handle.trim() === ''}>
            Adicionar perfil
          </Button>
        </div>
      </form>

      {error ? (
        <div className="mp-error-summary" role="alert">
          <p className="mp-caption-strong">Não foi possível salvar</p>
          <p className="mp-caption">{error.message}</p>
          <p className="mp-micro-legal">Código de referência: {error.correlationId}</p>
        </div>
      ) : null}

      <p ref={statusRef} className="mp-status" role="status" tabIndex={-1}>
        {list?.hasReachableContact
          ? 'Telefone cadastrado. Você já pode seguir com a inscrição.'
          : 'Informe ao menos um telefone para concluir esta etapa.'}
      </p>
    </section>
  );
}

function chipClass(selected: boolean): string {
  return ['mp-chip', selected ? 'mp-chip--selected' : ''].filter(Boolean).join(' ');
}

function consentSummary(contact: ContactPointResponse): string {
  const meios = [
    contact.allowsCall ? 'ligação' : null,
    contact.allowsSms ? 'SMS' : null,
    contact.allowsWhatsapp ? 'WhatsApp' : null,
  ].filter(Boolean);
  return meios.length > 0 ? `Autorizado por ${meios.join(', ')}.` : 'Sem autorização de contato.';
}
