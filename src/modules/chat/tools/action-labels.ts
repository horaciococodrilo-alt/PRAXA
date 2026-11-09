const LABELS: Readonly<Record<string, string>> = {
  purchase: 'Compra',
  lead: 'Cliente potencial',
  link_click: 'Clic en enlace',
  landing_page_view: 'Vista de página de destino',
};

export function actionLabel(actionType: string): string {
  const label = Object.hasOwn(LABELS, actionType) ? LABELS[actionType] : null;
  return label ? `${label} (${actionType})` : actionType;
}
