const LABELS: Readonly<Record<string, string>> = {
  purchase: 'Compra',
  lead: 'Cliente potencial',
  link_click: 'Clic en enlace',
  landing_page_view: 'Vista de página de destino',
};

/** Traduce una acción de Meta a español, por ejemplo «purchase» → «Compra (purchase)». */
export function actionLabel(actionType: string): string {
  const label = Object.hasOwn(LABELS, actionType) ? LABELS[actionType] : null;
  return label ? `${label} (${actionType})` : actionType;
}
