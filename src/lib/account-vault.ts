import 'server-only';
import {open, seal} from './secret-box';

// Game account logins (and the Hypixel API key) are encrypted at rest with a key derived from AUTH_SECRET.
// CHANGING AUTH_SECRET MAKES EVERY STORED LOGIN UNREADABLE: export them first with the Reveal button in Admin (see DEPLOYMENT.md).
const LOGIN_INFO = 'game-account-login';
const API_KEY_INFO = 'hypixel-api-key';
const secret = () => process.env.AUTH_SECRET || 'local-demo-secret-change-before-production';

export const sealLogin = (value: string) => seal(value, secret(), LOGIN_INFO);
export const openLogin = (sealed: string) => open(sealed, secret(), LOGIN_INFO);
export const sealApiKey = (value: string) => seal(value, secret(), API_KEY_INFO);
export const openApiKey = (sealed: string) => open(sealed, secret(), API_KEY_INFO);
