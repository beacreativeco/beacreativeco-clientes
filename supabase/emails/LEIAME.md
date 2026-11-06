# E-mails do login (Supabase Auth)

Textos dos e-mails que o Supabase manda (convite, nova senha, troca de e-mail), em português e
com a logo. Ficam no painel do Supabase (Authentication → Emails → Templates), que só deixa
editar com o SMTP próprio ligado (Resend, `nao-responda@beacreativeco.com.br`). Estes arquivos
são a cópia versionada: mudou aqui, colar lá (produção; no dev só se quiser ver igual).

| Modelo no Supabase | Assunto | Arquivo |
| --- | --- | --- |
| Invite user | Seu acesso ao portal da BeaCreative | `convite.html` |
| Reset password | Criar uma nova senha na BeaCreative | `redefinir-senha.html` |
| Change email address | Confirme o seu novo e-mail na BeaCreative | `trocar-email.html` |

A logo vem de `public/assets/img/logo-email.png` (PNG, porque o Gmail não mostra SVG), pelo
endereço da produção: só aparece depois que a `main` tem o arquivo.

Validade dos links: Authentication → Sign In / Providers → Email → "Email OTP Expiration" =
86400 (24 h, o máximo; vale para todos os links de e-mail). Os textos dizem "24 horas": mudou lá, mudar aqui.
