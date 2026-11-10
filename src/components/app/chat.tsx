'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { BasicBlock } from '@/components/chat/basic-block';
import type { Integracion } from '@/modules/app-data/types';
import { preguntarChat, votarRespuesta } from '@/modules/chat/actions';
import type { ChatTurnView } from '@/modules/chat/render';

import s from './app.module.css';
import c from './chat.module.css';
import { IconEnviar, IconSubir, MarcaPraxa } from './icons';
import { IntegracionLogo } from './integracion-logo';
import { Avatar, Img } from './ui';

const SUGERENCIAS = [
  '¿Cuánto gasté en los últimos siete días?',
  '¿Cuántos clics tuvieron mis campañas?',
  'Mostrame el gasto por día',
  '¿Qué datos tengo por edad y género?',
];

type Message = { id: number; kind: 'user' | 'assistant'; text?: string;
  time?: string; view?: ChatTurnView; question?: string };
type Vote = 'useful' | 'not_useful';
type QueuedVote = { id: number; feedback: Vote; recordId: string };

const horaActual = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function Chat({ iniciales, conectadas, tieneEmpresa = false,
  conexionActiva = false }: { iniciales: string;
  conectadas: Pick<Integracion, 'id' | 'nombre'>[];
  tieneEmpresa?: boolean; conexionActiva?: boolean }) {
  const [texto, setTexto] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [votes, setVotes] = useState<Record<number, Vote>>({});
  const [voteError, setVoteError] = useState<number | null>(null);
  const [voting, setVoting] = useState<number | null>(null);
  const [queuedVote, setQueuedVote] = useState<QueuedVote | null>(null);
  const queuedVoteRef = useRef<QueuedVote | null>(null);
  const nextId = useRef(0);
  const ta = useRef<HTMLTextAreaElement>(null);

  const send = async (questionOverride?: string) => {
    const question = (questionOverride ?? texto).trim();
    if (!question || busy) return;
    const previous = messages.filter((m) => m.kind === 'user' && m.text)
      .map((m) => m.text!).slice(-3);
    const pendingClarification = [...messages].reverse()
      .find((m) => m.kind === 'assistant')?.view?.pending_clarification ?? undefined;
    setMessages((current) => [...current, { id: nextId.current++, kind: 'user',
      text: question, time: horaActual() }]);
    if (!tieneEmpresa) { setTexto(''); return; }
    setBusy(true);
    try {
      const view = await preguntarChat({ question, previous, pendingClarification });
      setMessages((current) => [...current, { id: nextId.current++, kind: 'assistant',
        view, question }]);
      if (!view.retry_allowed) setTexto('');
    } catch {
      const failure: ChatTurnView = { kind: 'abstention', record_id: null,
        can_vote: false, segments: [{ type: 'plain',
          text: 'No pudimos completar la consulta. Probá de nuevo.' }],
        blocks: [], footer: null, pending_clarification: null,
        retry_allowed: true, link_to_integrations: false };
      setMessages((current) => [...current, { id: nextId.current++, kind: 'assistant',
        view: failure, question }]);
    } finally {
      setBusy(false);
      const queued = queuedVoteRef.current;
      if (queued) {
        queuedVoteRef.current = null;
        setQueuedVote(null);
        void performVote(queued.id, queued.recordId, queued.feedback);
      }
    }
  };

  const performVote = async (id: number, recordId: string, feedback: Vote) => {
    setVoting(id);
    setVoteError(null);
    try {
      const result = await votarRespuesta({ recordId, feedback });
      if (result.ok) setVotes((current) => ({ ...current, [id]: feedback }));
      else setVoteError(id);
    } catch { setVoteError(id); }
    finally { setVoting(null); }
  };

  const vote = (id: number, recordId: string, feedback: Vote) => {
    if (busy) {
      const queued = { id, recordId, feedback };
      queuedVoteRef.current = queued;
      setQueuedVote(queued);
    } else void performVote(id, recordId, feedback);
  };

  const onSubmit = (event: FormEvent) => { event.preventDefault(); void send(); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); void send();
    }
  };

  return <div className={c.wrap}>
    <MarcaPraxa className={c.mark} />
    <h1 className={c.h1}>Tu marketing, en<br /><em>una sola conversación.</em></h1>
    <p className={c.lead}>Preguntá y explorá los datos de tu empresa.</p>
    {conectadas.length > 0 ? <ul className={c.srcs} aria-label="Fuentes conectadas">
      {conectadas.map((source) => <li key={source.id} className={c.src}>
        <IntegracionLogo id={source.id} size={24} />{source.nombre}
        <span className={s.dot} aria-hidden="true" />
      </li>)}
    </ul> : null}
    <p className={c.notice}>Registramos tus preguntas, sin las respuestas, para saber qué se pregunta y si te sirvió.</p>
    {tieneEmpresa && !conexionActiva && messages.length === 0 ?
      <p className={c.connection}>Todavía no hay una cuenta conectada.{' '}
        <a href="/app/integraciones">Ir a Integraciones</a>.</p> : null}

    {messages.length > 0 || busy ? <div className={c.log} role="log"
      aria-label="Conversación" aria-live="polite">
      {messages.map((message) => message.kind === 'user' ?
        <div key={message.id} className={c.user}>
          <div className={c.bubble}><span>{message.text}</span>
            <time dateTime={message.time}>{message.time}</time></div>
          <Avatar className={c.avatar}>{iniciales}</Avatar>
        </div> : message.view ?
        <article key={message.id} className={c.assistant}>
          <p className={c.answerText}>{message.view.segments.map((segment, index) =>
            <span key={index} data-kind={segment.type}>{segment.text}</span>)}</p>
          {message.view.blocks.map((block, index) =>
            <BasicBlock key={`${message.id}-${index}`} block={block} />)}
          {message.view.footer ? <div className={c.footer}>
            {message.view.footer.account ? <p>Cuenta {message.view.footer.account}</p> : null}
            {message.view.footer.period ? <p>Período: {message.view.footer.period}
              {message.view.footer.defaulted ? ' (por defecto)' : ''}</p> : null}
            {message.view.footer.coverage ? <p>Cobertura: {message.view.footer.coverage}</p> : null}
            {message.view.footer.freshness ? <p>Actualización: {message.view.footer.freshness}</p> : null}
            {message.view.footer.data_limits.map((limit) => <p key={limit}>{limit}</p>)}
          </div> : null}
          {message.view.link_to_integrations ?
            <a href="/app/integraciones">Ir a Integraciones</a> : null}
          {message.view.retry_allowed ? <button type="button" className={c.action}
            onClick={() => void send(message.question)}>Reintentar</button> : null}
          {message.view.can_vote && message.view.record_id ?
            <div className={c.votes} aria-label="Votar respuesta">
              {(['useful', 'not_useful'] as const).map((feedback) =>
                <button key={feedback} type="button" className={c.action}
                  aria-pressed={votes[message.id] === feedback}
                  disabled={voting === message.id}
                  onClick={() => vote(message.id, message.view!.record_id!, feedback)}>
                  {feedback === 'useful' ? 'Útil' : 'No útil'}
                </button>)}
              {voting === message.id || queuedVote?.id === message.id ?
                <span role="status">Guardando voto...</span> : null}
              {voteError === message.id ? <span role="alert">No pudimos guardar tu voto</span> : null}
            </div> : null}
        </article> : null)}
      {busy ? <div className={c.think} role="status">
        <Img src="/app/robot-praxa.png" alt="" width={26} height={26} />
        <span className={c.pulse} aria-hidden="true" />Consultando tus datos...
      </div> : null}
    </div> : null}

    <form className={c.box} onSubmit={onSubmit}>
      <textarea ref={ta} className={c.ta} rows={2}
        placeholder="Escribí tu pregunta acá..." aria-label="Tu pregunta"
        value={texto} onChange={(event) => setTexto(event.target.value)}
        onKeyDown={onKeyDown} />
      <div className={c.ctl}>
        <button type="submit" className={c.send} aria-label="Enviar"
          disabled={!texto.trim() || busy}><IconEnviar size={18} stroke={2.2} /></button>
      </div>
    </form>
    <div className={c.sugs} role="group" aria-label="Preguntas sugeridas">
      {SUGERENCIAS.map((suggestion) => <button key={suggestion} type="button"
        className={c.sug} onClick={() => { setTexto(suggestion); ta.current?.focus(); }}>
        <span>{suggestion}</span><IconSubir size={17} stroke={1.9} />
      </button>)}
    </div>
  </div>;
}
