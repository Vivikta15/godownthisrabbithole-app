// Mail is OFF. No provider is connected or chosen (decision for the user: provider + sending domain, see docs/AUTH.md).
// getMailer returns null until a real provider is implemented here AND MAIL_ENABLED === 'true'.
export interface Mailer { send(to: string, subject: string, text: string): Promise<boolean> }
export function getMailer(_env: { MAIL_ENABLED?: string }): Mailer | null { return null; }
