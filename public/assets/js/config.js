// Dados públicos do projeto Supabase (pode ir pro Git).
// A chave aqui é a anon/publishable. NUNCA colocar a service_role.
export const SUPABASE_URL = 'https://dudxbbqyofzetuvpuzrh.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_ihe5BwV3tW0q9vnvcJQSEw_QVdJR-oM';

// Google Drive ("Enviar pro Drive" no editor; projeto 493593349658 no Google Cloud).
// Públicos por natureza: o ID do cliente OAuth e o número do projeto. A chave de API do
// Picker NÃO fica aqui: vem de /api/drive/chave (só admin), lida de GOOGLE_API_KEY no servidor.
export const GOOGLE_CLIENT_ID = '493593349658-k0289urhpknpt5moe7jpr9ht64bl65aj.apps.googleusercontent.com';
export const GOOGLE_APP_ID = '493593349658';

// Notificações push (Web Push): chave PÚBLICA VAPID, usada pelo navegador para se inscrever.
// A privada fica só no servidor (VAPID_PRIVATE_KEY, Secret no Cloudflare e .dev.vars).
export const VAPID_PUBLIC_KEY = 'BKrZRkcQlvIzUTEOq4Y8_4kkWMtZjHZKYQASlMyqI1RWHoiiA2ZFUN6bNaKnyKL_N_99ZW2ur7aP7mnYLL4o6vM';
