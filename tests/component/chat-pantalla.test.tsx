import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Chat } from '@/components/app/chat';
import type { ChatTurnView } from '@/modules/chat/render';

const preguntarChat = vi.fn();
const votarRespuesta = vi.fn();
vi.mock('@/modules/chat/actions', () => ({
  preguntarChat: (...args: unknown[]) => preguntarChat(...args),
  votarRespuesta: (...args: unknown[]) => votarRespuesta(...args),
}));

const answer: ChatTurnView = { kind: 'answer', record_id: 'e0000000-0000-4000-8000-000000000001',
  can_vote: true, segments: [{ type: 'plain', text: 'Dato sintético' }],
  blocks: [], footer: null, pending_clarification: null,
  retry_allowed: false, link_to_integrations: false };

describe('M25a-T-47/48/68/95: pantalla de chat', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
    preguntarChat.mockResolvedValue(answer); votarRespuesta.mockResolvedValue({ ok: true }); });

  it('sin empresa deja solo el mensaje local y no llama a la acción', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa={false} conexionActiva={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Hola{Enter}');
    expect(screen.getByRole('log')).toHaveTextContent('Hola');
    expect(screen.queryByText('Dato sintético')).not.toBeInTheDocument();
    expect(preguntarChat).not.toHaveBeenCalled();
    expect(screen.queryByText(/Todavía no hay una cuenta conectada/)).not.toBeInTheDocument();
  });

  it('con empresa conecta, muestra aviso, respuesta y voto confirmado', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva />);
    expect(screen.getByText(/Registramos tus preguntas, sin las respuestas/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Gasto{Enter}');
    expect(await screen.findByText('Dato sintético')).toBeInTheDocument();
    expect(preguntarChat).toHaveBeenCalledWith({ question: 'Gasto', previous: [],
      pendingClarification: undefined });
    await user.click(screen.getByRole('button', { name: 'Útil' }));
    expect(votarRespuesta).toHaveBeenCalledWith({ recordId: answer.record_id,
      feedback: 'useful' });
    expect(screen.getByRole('button', { name: 'Útil' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('una pregunta sugerida copia el texto fijo al cuadro y recupera el foco', async () => {
    const user = userEvent.setup();
    preguntarChat.mockResolvedValueOnce({ ...answer, blocks: [{
      type: 'preguntas_sugeridas', title: 'Preguntas sugeridas',
      aria_label: 'Preguntas sugeridas', series: [], notes: [],
      table: { headers: ['Pregunta'], rows: [['Ver en tabla']] },
      suggestions: [{ id: 'ver_en_tabla', text: 'Ver en tabla' }],
    }] });
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Consulta{Enter}');
    await screen.findByText('Dato sintético');
    await user.click(screen.getByRole('button', { name: 'Ver en tabla' }));
    expect(screen.getByRole('textbox', { name: 'Tu pregunta' })).toHaveValue('Ver en tabla');
    expect(screen.getByRole('textbox', { name: 'Tu pregunta' })).toHaveFocus();
  });

  it('voto fallido no queda marcado y muestra texto fijo', async () => {
    const user = userEvent.setup();
    votarRespuesta.mockResolvedValueOnce({ ok: false });
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Gasto{Enter}');
    await screen.findByText('Dato sintético');
    await user.click(screen.getByRole('button', { name: 'No útil' }));
    expect(screen.getByText('No pudimos guardar tu voto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No útil' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fallo de modelo conserva la pregunta y habilita reintento nuevo', async () => {
    const user = userEvent.setup();
    preguntarChat.mockResolvedValueOnce({ ...answer, kind: 'abstention',
      record_id: 'e0000000-0000-4000-8000-000000000002',
      segments: [{ type: 'plain', text: 'El asistente no está disponible.' }],
      retry_allowed: true }).mockResolvedValueOnce(answer);
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Gasto{Enter}');
    expect(await screen.findByText('El asistente no está disponible.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tu pregunta' })).toHaveValue('Gasto');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Dato sintético')).toBeInTheDocument();
    expect(preguntarChat).toHaveBeenCalledTimes(2);
  });

  it('sin conexión activa muestra enlace antes del primer turno', () => {
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva={false} />);
    expect(screen.getByText(/Todavía no hay una cuenta conectada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Integraciones/ })).toHaveAttribute('href', '/app/integraciones');
  });

  it('una abstención registrada permite votar y sin retry_allowed no ofrece reintento', async () => {
    const user = userEvent.setup();
    preguntarChat.mockResolvedValueOnce({ ...answer, kind: 'abstention',
      segments: [{ type: 'plain', text: 'Fuera de alcance' }] });
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Consulta{Enter}');
    expect(await screen.findByText('Fuera de alcance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Útil' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('una aclaración visible pasa al siguiente turno sin persistirla en el navegador', async () => {
    const user = userEvent.setup();
    preguntarChat.mockResolvedValueOnce({ ...answer, kind: 'clarification',
      segments: [{ type: 'plain', text: '¿Qué campaña?' }],
      pending_clarification: '¿Qué campaña?' }).mockResolvedValueOnce(answer);
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Primera{Enter}');
    await screen.findByText('¿Qué campaña?');
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'La segunda{Enter}');
    await screen.findByText('Dato sintético');
    expect(preguntarChat).toHaveBeenLastCalledWith({ question: 'La segunda',
      previous: ['Primera'], pendingClarification: '¿Qué campaña?' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('un voto durante otro turno espera y muestra estado pendiente', async () => {
    const user = userEvent.setup();
    let release!: (view: ChatTurnView) => void;
    preguntarChat.mockResolvedValueOnce(answer).mockImplementationOnce(() =>
      new Promise<ChatTurnView>((resolve) => { release = resolve; }));
    render(<Chat iniciales="GM" conectadas={[]} tieneEmpresa conexionActiva />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Primera{Enter}');
    await screen.findByText('Dato sintético');
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Segunda{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Consultando tus datos...');
    await user.click(screen.getByRole('button', { name: 'Útil' }));
    expect(votarRespuesta).not.toHaveBeenCalled();
    expect(screen.getByText('Guardando voto...')).toBeInTheDocument();
    release({ ...answer, can_vote: false, record_id: null,
      segments: [{ type: 'plain', text: 'Segunda respuesta' }] });
    await screen.findByText('Segunda respuesta');
    expect(votarRespuesta).toHaveBeenCalledTimes(1);
  });
});
